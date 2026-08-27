// P4-C：主动风险简报（"今天值得关注"推送层）。
// 目标：每天向用户推荐不超过 3 条真正高价值且可解释的主动建议；用户能理解"为什么看到它"，
// 并能立即处理 / 明天提醒 / 本周静默 / 忽略，而不被通知轰炸。
// 原则：
//  - 只消费既有真实数据，绝不调用 LLM 或外部服务；
//  - 主动简报是独立于规则通知的"推送层"，通过 brain_notifications（同一状态机）提醒；
//  - 所有阈值 / 权重 / 每日上限集中配置在此，不散落在 API 或前端；
//  - 不修改 ProcessingPlan / 任务 / 项目 / 提醒 / 学习复习的数据语义；
//  - 严格按 userId 隔离。
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { db, brainProactiveState, brainProactivePreferences, brainProactiveActions } from "@/lib/db";
import {
  listBrainTasks,
  listBrainProjects,
  listBrainProcessingPlans,
  listBrainInboxItems,
  listBrainNotes,
  listBrainNotifications,
  type BrainTask,
  type BrainProject,
  type BrainProcessingPlan,
  type BrainNotification,
  type BrainNotificationRefType,
} from "./brain-db";
import { listDueLearningReviews } from "./brain-learning-review";
import { computeWeekBounds } from "./brain-review";
import {
  enqueueNotification,
  applyNotificationAction,
  type NotificationInput,
} from "./brain-notification";
import { genId } from "./id";

// ---------------- 规则集中配置 ----------------

export const PROACTIVE_DAILY_CAP = 3;
export const PROACTIVE_DEDUP_WINDOW_MS = 24 * 3600_000;
// 低于该分值的候选不进入简报（"无高优"时返回空，不为凑数生成）
export const PROACTIVE_MIN_SCORE = 50;

export const PROACTIVE_RULES = {
  task: { weight: 100 },
  project: { weight: 95 },
  plan: { weight: 90 },
  week: { weight: 78 },
  inbox: { weight: 65 },
  note: { weight: 58 },
  review: { weight: 54 },
  // 收件箱判定阈值（待处理条数）
  inboxThreshold: 5,
  // 笔记"可能过期"天数
  noteStaleDays: 60,
} as const;

export type ProactiveSeverity = "high" | "medium" | "low";
// proactive_<kind>：task / project / plan / inbox / note / review / week
export type ProactiveBriefKind =
  | "task"
  | "project"
  | "plan"
  | "inbox"
  | "note"
  | "review"
  | "week";

export interface ProactiveBriefItem {
  id: string;
  type: `proactive_${ProactiveBriefKind}`;
  title: string;
  summary: string;
  severity: ProactiveSeverity;
  score: number;
  reasons: string[];
  targetType: string;
  targetId: string;
  projectId: string | null;
  link: string;
  primaryAction: { type: string; label: string };
  generatedAt: number;
}

export type ProactiveBriefAction =
  | "handle_now"
  | "tomorrow"
  | "silence_week"
  | "ignore";
// 忽略 / 静默作用范围
export type ProactiveActionScope = "type" | "object" | "project" | "none";

export interface ProactiveActionInput {
  briefId: string;
  action: ProactiveBriefAction;
  scope?: ProactiveActionScope;
  projectId?: string | null;
}

export interface ProactiveActionResult {
  items: ProactiveBriefItem[];
  updated: boolean;
  reason?: string;
}

const DAY_MS = 86400_000;

function uid(prefix: string): string {
  return genId(prefix);
}

function severityFor(score: number): ProactiveSeverity {
  if (score >= 85) return "high";
  if (score >= 65) return "medium";
  return "low";
}

function todayStart(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dueMs(due: string | null): number {
  if (!due) return NaN;
  const t = new Date(due + "T00:00:00").getTime();
  return Number.isNaN(t) ? NaN : t;
}

function stablySort<T>(arr: T[], cmp: (a: T, b: T) => number, key: (x: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const r = cmp(a, b);
    if (r !== 0) return r;
    return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
}

// ---------------- 类型 / 行映射 ----------------

interface StateRow {
  id: string;
  userId: string;
  briefKey: string;
  type: string;
  title: string;
  summary: string;
  severity: string | null;
  score: number | null;
  reasonsJson: string | null;
  targetType: string;
  targetId: string;
  projectId: string | null;
  link: string;
  primaryActionJson: string | null;
  actionStatus: string | null;
  createdAt: number | null;
}

function toItem(r: StateRow): ProactiveBriefItem | null {
  // 已处理 / 明天提醒 / 忽略 / 本周静默 的项当日不再返回（"snooze 后当天不重复"）
  if (r.actionStatus) return null;
  let reasons: string[] = [];
  try {
    const p = JSON.parse(r.reasonsJson ?? "[]");
    reasons = Array.isArray(p) ? p.map(String) : [];
  } catch {
    reasons = [];
  }
  let primaryAction: { type: string; label: string } = { type: "open", label: "查看" };
  try {
    const p = JSON.parse(r.primaryActionJson ?? "{}");
    if (p && typeof p === "object") {
      primaryAction = {
        type: String(p.type ?? "open"),
        label: String(p.label ?? "查看"),
      };
    }
  } catch {
    /* 忽略 */
  }
  return {
    id: r.id,
    type: r.type as `proactive_${ProactiveBriefKind}`,
    title: r.title,
    summary: r.summary,
    severity: (r.severity as ProactiveSeverity) ?? "medium",
    score: Number(r.score ?? 0),
    reasons,
    targetType: r.targetType,
    targetId: r.targetId,
    projectId: r.projectId,
    link: r.link,
    primaryAction,
    generatedAt: Number(r.createdAt ?? 0),
  };
}

interface StateRowFull extends StateRow {
  actionStatus: string | null;
}

// ---------------- 候选结构（未落库） ----------------

interface RawCandidate {
  kind: ProactiveBriefKind;
  title: string;
  summary: string;
  reasons: string[];
  score: number;
  targetType: string;
  targetId: string;
  projectId: string | null;
  link: string;
  primaryAction: { type: string; label: string };
}

function briefKeyOf(c: RawCandidate): string {
  return `proactive_${c.kind}:${c.targetType}:${c.targetId}`;
}

// ---------------- 数据装载 ----------------

interface CandidateData {
  tasks: BrainTask[];
  projects: BrainProject[];
  plans: BrainProcessingPlan[];
  inboxPending: { id: string; rawContent: string; createdAt: number }[];
  notes: { id: string; title: string; updatedAt: number; superseded: boolean }[];
  dueReviews: { noteId: string; noteTitle: string; noteSummary: string }[];
}

async function loadData(userId: string, now: number): Promise<CandidateData> {
  const [tasks, projects, plans, inbox, notes, reviewData] = await Promise.all([
    listBrainTasks(userId),
    listBrainProjects(userId),
    listBrainProcessingPlans(userId, ["pending_confirmation"]),
    listBrainInboxItems(userId, "pending"),
    listBrainNotes(userId),
    listDueLearningReviews(userId, now),
  ]);

  const notesMeta =
    notes
      .filter((n: any) => !n.superseded)
      .map((n: any) => ({
        id: n.id,
        title: n.title || "(无标题)",
        updatedAt: n.updatedAt,
        superseded: false,
      })) ?? [];

  return {
    tasks,
    projects,
    plans,
    inboxPending: inbox.map((i) => ({
      id: i.id,
      rawContent: i.rawContent,
      createdAt: i.createdAt,
    })),
    notes: notesMeta as { id: string; title: string; updatedAt: number; superseded: boolean }[],
    dueReviews: reviewData.map((r) => ({
      noteId: r.noteId,
      noteTitle: r.noteTitle,
      noteSummary: r.noteSummary,
    })),
  };
}

// ---------------- 候选构建 ----------------

function buildCandidates(d: CandidateData, now: number): RawCandidate[] {
  const out: RawCandidate[] = [];
  const todayStartMs = todayStart(now);

  // 1) 任务：单个高价值逾期 / 今天到期任务
  const openTasks = d.tasks.filter((t) => t.status !== "done");
  const taskCandidates = openTasks
    .filter((t) => {
      const due = dueMs(t.dueDate);
      if (Number.isNaN(due)) return false;
      return due < todayStartMs + DAY_MS; // 今天到期或已逾期
    })
    .map((t): RawCandidate => {
      const due = dueMs(t.dueDate);
      const overdue = due < todayStartMs;
      let score: number;
      let reason: string;
      if (overdue) {
        const days = Math.max(1, Math.round((todayStartMs - due) / DAY_MS));
        score = t.priority === "high" ? PROACTIVE_RULES.task.weight : 72;
        reason = `任务已逾期 ${days} 天`;
      } else {
        score = t.priority === "high" ? 82 : 62;
        reason = "任务今天到期";
      }
      return {
        kind: "task",
        title: t.title,
        summary: `${t.priority === "high" ? "高优先级" : "普通"}任务${overdue ? "已逾期" : "今天到期"}`,
        reasons: [reason],
        score,
        targetType: "task",
        targetId: t.id,
        projectId: t.projectId ?? null,
        link: `/brain?tab=tasks&task=${t.id}`,
        primaryAction: { type: "open_task", label: "打开任务" },
      };
    })
    .sort((a, b) => b.score - a.score);

  // 2) 项目：同一项目多个逾期任务 → 聚合为一条 project_risk
  const overdueByProject = new Map<string, { ids: string[]; high: number }>();
  for (const t of openTasks) {
    if (!t.projectId) continue;
    const due = dueMs(t.dueDate);
    if (Number.isNaN(due) || due >= todayStartMs) continue;
    const rec = overdueByProject.get(t.projectId) ?? { ids: [], high: 0 };
    rec.ids.push(t.id);
    if (t.priority === "high") rec.high++;
    overdueByProject.set(t.projectId, rec);
  }
  const projectById = new Map(d.projects.map((p) => [p.id, p]));
  for (const [pid, rec] of overdueByProject) {
    if (rec.ids.length < 2) continue; // 少于 2 条逾期不聚合（单条走任务源）
    const proj = projectById.get(pid);
    const score = Math.min(
      100,
      PROACTIVE_RULES.project.weight + (rec.ids.length - 2) * 4 + (rec.high > 0 ? 3 : 0),
    );
    out.push({
      kind: "project",
      title: `项目「${proj?.name ?? "未命名项目"}」有 ${rec.ids.length} 个任务逾期`,
      summary: `${rec.high} 个高优先级、${rec.ids.length - rec.high} 个普通任务待处理`,
      reasons: [
        `同项目 ${rec.ids.length} 个任务逾期`,
        rec.high > 0 ? `${rec.high} 个高优先级` : "整体拖延风险",
      ],
      score,
      targetType: "project",
      targetId: pid,
      projectId: pid,
      link: `/brain?tab=projects&project=${pid}`,
      primaryAction: { type: "open_project", label: "查看项目" },
    });
  }

  // 3) 计划：高优先级 pending_confirmation ProcessingPlan（含本周计划周报/日常来源）
  //    按来源划分，避免 plan 与 week 重复：generic 工作台类 → `plan`；周报复盘产生的 → `week`
  const planHasHigh = (p: BrainProcessingPlan): boolean => {
    try {
      const body = JSON.parse(p.planJson) as { suggestedTasks?: { priority?: string }[] };
      return (body.suggestedTasks ?? []).some((t) => t.priority === "high");
    } catch {
      return false;
    }
  };
  for (const p of d.plans) {
    if (!planHasHigh(p)) continue;
    if (p.source === "weekly_review") {
      out.push({
        kind: "week",
        title: `本周周报计划含高优事项：${p.rawContent.slice(0, 18)}`,
        summary: "本周计划中有待确认落地的重点事项",
        reasons: ["本周计划含高优先级事项", "尚未确认落地"],
        score: PROACTIVE_RULES.week.weight,
        targetType: "plan",
        targetId: p.id,
        projectId: p.projectId ?? null,
        link: `/brain?tab=input&plan=${p.id}`,
        primaryAction: { type: "confirm_plan", label: "确认计划" },
      });
      continue;
    }
    out.push({
      kind: "plan",
      title: `待确认的高优先级处理计划：${p.rawContent.slice(0, 18)}`,
      summary: "计划中待落地的高优任务等待确认",
      reasons: ["计划含高优先级任务", "尚未确认并落地"],
      score: PROACTIVE_RULES.plan.weight,
      targetType: "plan",
      targetId: p.id,
      projectId: p.projectId ?? null,
      link: `/brain?tab=input&plan=${p.id}`,
      primaryAction: { type: "confirm_plan", label: "确认计划" },
    });
  }

  // 4) 收件箱：待处理超过阈值
  if (d.inboxPending.length >= PROACTIVE_RULES.inboxThreshold) {
    const rep = d.inboxPending.reduce((a, b) => (a.createdAt < b.createdAt ? a : b));
    out.push({
      kind: "inbox",
      title: `收件箱积压 ${d.inboxPending.length} 条待处理`,
      summary: `最早一条已停留 ${Math.max(
        1,
        Math.round((now - rep.createdAt) / DAY_MS),
      )} 天`,
      reasons: [`待处理 ${d.inboxPending.length} 条`, "超过积压阈值"],
      score: PROACTIVE_RULES.inbox.weight,
      targetType: "inbox",
      targetId: rep.id,
      projectId: null,
      link: "/brain?tab=input",
      primaryAction: { type: "process_inbox", label: "处理收件箱" },
    });
  }

  // 5) 可能过期的关键笔记
  const staleNotes = d.notes
    .filter((n) => now - n.updatedAt >= PROACTIVE_RULES.noteStaleDays * DAY_MS)
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .slice(0, 2);
  for (const n of staleNotes) {
    out.push({
      kind: "note",
      title: `笔记「${n.title.slice(0, 18)}」可能已被遗忘`,
      summary: `${Math.floor((now - n.updatedAt) / DAY_MS)} 天未更新`,
      reasons: [`${Math.floor((now - n.updatedAt) / DAY_MS)} 天未访问`],
      score: PROACTIVE_RULES.note.weight,
      targetType: "note",
      targetId: n.id,
      projectId: null,
      link: `/brain?note=${n.id}`,
      primaryAction: { type: "open_note", label: "快速回顾" },
    });
  }

  // 6) 到期学习复习（低打扰：复习已有独立通知，仅在高价值时进入主动简报）
  const reviewScore = PROACTIVE_RULES.review.weight;
  for (const r of d.dueReviews.slice(0, 2)) {
    out.push({
      kind: "review",
      title: `学习笔记「${r.noteTitle.slice(0, 16)}」待复习`,
      summary: r.noteSummary?.slice(0, 30) || "按计划进行复习",
      reasons: ["学习复习已到期"],
      score: reviewScore,
      targetType: "learning_review",
      targetId: r.noteId,
      projectId: null,
      link: `/brain?note=${r.noteId}`,
      primaryAction: { type: "review", label: "去复习" },
    });
  }

  // 附加任务源：仅当该任务不属于任一已聚合项目时，取单条高分逾期任务
  // （与 project_risk 互相去重，避免同名对象重复展示）
  const aggregatedProjects = new Set(out.filter((c) => c.kind === "project").map((c) => c.targetId));
  const soloTask = taskCandidates.find((t) => !t.projectId || !aggregatedProjects.has(t.projectId));
  if (soloTask) out.push(soloTask);

  return out;
}

// ---------------- 读写 brain_proactive_state ----------------

async function listTodayState(userId: string, now: number): Promise<StateRowFull[]> {
  const start = todayStart(now);
  const rows = (await db
    .select()
    .from(brainProactiveState)
    .where(
      and(
        eq(brainProactiveState.userId, userId),
        gte(brainProactiveState.createdAt, start),
        lte(brainProactiveState.createdAt, now),
      ),
    )) as unknown as StateRowFull[];
  return rows;
}

async function listRecentBriefKeys(userId: string, now: number): Promise<Set<string>> {
  const rows = (await db
    .select({ briefKey: brainProactiveState.briefKey })
    .from(brainProactiveState)
    .where(
      and(
        eq(brainProactiveState.userId, userId),
        gte(brainProactiveState.createdAt, now - PROACTIVE_DEDUP_WINDOW_MS),
        // H4 修复：被用户标记为「明天提醒」的简报不应在 24h 窗口内被去重，应次日重新出现
        ne(brainProactiveState.actionStatus, "tomorrow"),
      ),
    )) as { briefKey: string }[];
  return new Set(rows.map((r) => r.briefKey));
}

async function loadPreferences(userId: string, weekKey: string): Promise<ProactivePreference[]> {
  const rows = (await db
    .select()
    .from(brainProactivePreferences)
    .where(
      and(
        eq(brainProactivePreferences.userId, userId),
        eq(brainProactivePreferences.weekKey, weekKey),
      ),
    )) as unknown as ProactivePreference[];
  return rows;
}

interface ProactivePreference {
  id: string;
  userId: string;
  type: string;
  scope: "type" | "object" | "project";
  targetType: string | null;
  targetId: string | null;
  projectId: string | null;
  weekKey: string;
  createdAt: number;
}

function isSilenced(prefs: ProactivePreference[], c: RawCandidate): boolean {
  const type = `proactive_${c.kind}`;
  for (const p of prefs) {
    if (p.type !== type) continue;
    if (p.scope === "type") return true;
    if (p.scope === "object" && p.targetId === c.targetId) return true;
    if (p.scope === "project" && p.projectId && p.projectId === c.projectId) return true;
  }
  return false;
}

function notificationFor(
  c: RawCandidate & { type: `proactive_${ProactiveBriefKind}`; severity: ProactiveSeverity },
): NotificationInput {
  const refTypeMap: Record<ProactiveBriefKind, BrainNotificationRefType> = {
    task: "task",
    project: "project",
    plan: "plan",
    inbox: "inbox",
    note: "note",
    review: "learning_review",
    week: "generic",
  };
  return {
    type: c.type,
    title: c.title,
    detail: c.summary,
    link: c.link,
    refType: refTypeMap[c.kind],
    refId: c.targetId,
    reason: c.reasons.join("；"),
    priority: c.severity === "high" ? "high" : c.severity === "medium" ? "medium" : "low",
    dedupKey: briefKeyOf(c),
  };
}

// ---------------- 主流程 ----------------

/**
 * 生成并返回"今天值得关注"主动简报（最多 3 条）。
 * 只写 brain_proactive_state 快照 + brain_notifications（同一状态机）；
 * 不修改任何任务 / 项目 / Plan / 笔记 / 学习复习本身。
 */
export async function getProactiveBrief(
  userId: string,
  now = Date.now(),
): Promise<ProactiveBriefItem[]> {
  const { weekKey } = computeWeekBounds(now);
  const [data, prefs, todayRows, recentKeys] = await Promise.all([
    loadData(userId, now),
    loadPreferences(userId, weekKey),
    listTodayState(userId, now),
    listRecentBriefKeys(userId, now),
  ]);

  const candidates = buildCandidates(data, now)
    .map((c) => ({
      ...c,
      type: `proactive_${c.kind}` as const,
      severity: severityFor(c.score),
      primaryAction: c.primaryAction,
    }))
    .filter((c) => c.score >= PROACTIVE_MIN_SCORE)
    .filter((c) => !isSilenced(prefs, c))
    .filter((c) => !recentKeys.has(briefKeyOf(c)));

  // 每日上限：今日已创建数 + 本次新增 ≤ PROACTIVE_DAILY_CAP
  const createdToday = todayRows.length;
  const quota = Math.max(0, PROACTIVE_DAILY_CAP - createdToday);

  // 稳定排序：severity → score → 时间 → ID
  const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const picks = stablySort(
    candidates,
    (a, b) => sevRank[a.severity] - sevRank[b.severity] || b.score - a.score,
    (x) => x.targetId,
  ).slice(0, quota);

  // 落库快照 + 入队通知
  for (const c of picks) {
    const id = uid("pb");
    try {
      await db.insert(brainProactiveState).values({
        id,
        userId,
        briefKey: briefKeyOf(c),
        type: c.type,
        title: c.title,
        summary: c.summary,
        severity: c.severity,
        score: c.score,
        reasonsJson: JSON.stringify(c.reasons),
        targetType: c.targetType,
        targetId: c.targetId,
        projectId: c.projectId,
        link: c.link,
        primaryActionJson: JSON.stringify(c.primaryAction),
        actionStatus: null,
        createdAt: now,
      });
    } catch (err) {
      console.error("[proactive-brief] insert state failed:", err);
      continue;
    }
    try {
      await enqueueNotification(userId, notificationFor(c), now);
    } catch {
      /* 通知入队失败不阻断简报 */
    }
  }

  // 再次读取今日（含本次新增），非 ignored 项作为返回
  const fresh = await listTodayState(userId, now);
  return stablySort(
    fresh.map((r) => toItem(r)).filter((x): x is ProactiveBriefItem => x != null),
    (a, b) => sevRank[a.severity] - sevRank[b.severity] || b.score - a.score || a.generatedAt - b.generatedAt,
    (x) => x.id,
  ).slice(0, PROACTIVE_DAILY_CAP);
}

// ---------------- 控制动作 ----------------

function prefKey(u: string, type: string, scope: string, t: string | null, p: string | null): string {
  return `${u}|${type}|${scope}|${t}|${p}`;
}

async function hasPreference(
  userId: string,
  type: string,
  scope: string,
  targetId: string | null,
  projectId: string | null,
  weekKey: string,
): Promise<boolean> {
  const prefs = await loadPreferences(userId, weekKey);
  const key = prefKey(userId, type, scope, targetId, projectId);
  void key;
  return prefs.some((p) => {
    if (p.type !== type || p.scope !== scope) return false;
    if (scope === "object" && p.targetId !== targetId) return false;
    if (scope === "project" && p.projectId !== projectId) return false;
    return true;
  });
}

async function getStateById(userId: string, id: string): Promise<StateRowFull | null> {
  const rows = (await db
    .select()
    .from(brainProactiveState)
    .where(and(eq(brainProactiveState.id, id), eq(brainProactiveState.userId, userId)))
    .limit(1)) as unknown as StateRowFull[];
  return rows[0] ?? null;
}

async function updateStateStatus(
  userId: string,
  id: string,
  status: string | null,
): Promise<void> {
  await db
    .update(brainProactiveState)
    .set({ actionStatus: status })
    .where(and(eq(brainProactiveState.id, id), eq(brainProactiveState.userId, userId)));
}

async function findNotifications(
  userId: string,
  type: string,
  refType: string,
  refId: string,
): Promise<BrainNotification[]> {
  const all = await listBrainNotifications(userId);
  return all.filter(
    (n) =>
      n.type === type &&
      n.refType === refType &&
      n.refId === refId &&
      (n.status === "new" || n.status === "deferred"),
  );
}

async function insertAudit(
  userId: string,
  input: {
    briefId: string | null;
    action: ProactiveBriefAction;
    scope: ProactiveActionScope;
    briefType: string;
    targetType: string;
    targetId: string | null;
    projectId: string | null;
  },
  now: number,
): Promise<void> {
  await db.insert(brainProactiveActions).values({
    id: uid("pba"),
    userId,
    briefId: input.briefId,
    action: input.action,
    scope: input.scope,
    briefType: input.briefType,
    targetType: input.targetType,
    targetId: input.targetId,
    projectId: input.projectId,
    createdAt: now,
  });
}

function makePrefId(userId: string, type: string, scope: string, targetId: string | null, projectId: string | null, weekKey: string): string {
  return `pp-${[userId, type, scope, targetId ?? "", projectId ?? "", weekKey]
    .join("-")
    .slice(0, 60)}`;
}

/**
 * 执行主动简报控制动作（幂等）：
 *  - handle_now：仅标记当日已处理（不对任务/项目本身做任何修改），关闭关联通知
 *  - tomorrow：简报标记明天，关联通知 snooze（明天再提醒）
 *  - silence_week：本周不再提示该类型（保留通知历史），简报标记 ignored
 *  - ignore：按作用范围（type / object / project）写入本周偏好，简报标记 ignored，关闭通知
 * 写偏好 + 审计，绝不对业务对象本身做改动。
 */
export async function applyProactiveBriefAction(
  userId: string,
  input: ProactiveActionInput,
  now = Date.now(),
): Promise<ProactiveActionResult> {
  const state = await getStateById(userId, input.briefId);
  if (!state) return { items: [], updated: false, reason: "not_found" };

  const { weekKey } = computeWeekBounds(now);
  const stateType = state.type as `proactive_${ProactiveBriefKind}`;
  const scope: ProactiveActionScope =
    input.action === "ignore" ? (input.scope ?? "type") : input.action === "silence_week" ? "type" : "none";
  const projectId = input.projectId ?? state.projectId;

  if (input.action === "handle_now") {
    await updateStateStatus(userId, state.id, "done");
    await insertAudit(userId, {
      briefId: state.id,
      action: "handle_now",
      scope: "none",
      briefType: stateType,
      targetType: state.targetType,
      targetId: state.targetId,
      projectId,
    }, now);
    // 关闭关联通知（done），保留记录
    for (const n of await findNotifications(userId, stateType, state.targetType, state.targetId)) {
      await applyNotificationAction(userId, n.id, "done");
    }
    return { items: await getProactiveBrief(userId, now), updated: true };
  }

  if (input.action === "tomorrow") {
    await updateStateStatus(userId, state.id, "tomorrow");
    await insertAudit(userId, {
      briefId: state.id,
      action: "tomorrow",
      scope: "none",
      briefType: stateType,
      targetType: state.targetType,
      targetId: state.targetId,
      projectId,
    }, now);
    for (const n of await findNotifications(userId, stateType, state.targetType, state.targetId)) {
      await applyNotificationAction(userId, n.id, "snooze", { days: 1 });
    }
    return { items: await getProactiveBrief(userId, now), updated: true };
  }

  // silence_week：写 type 范围本周偏好，简报 ignored，保留通知历史
  if (input.action === "silence_week") {
    const existed = await hasPreference(userId, stateType, "type", null, null, weekKey);
    if (!existed) {
      await db.insert(brainProactivePreferences).values({
        id: makePrefId(userId, stateType, "type", null, null, weekKey),
        userId,
        type: stateType,
        scope: "type",
        targetType: null,
        targetId: null,
        projectId: null,
        weekKey,
        createdAt: now,
      });
    }
    await updateStateStatus(userId, state.id, "ignored");
    await insertAudit(userId, {
      briefId: state.id,
      action: "silence_week",
      scope: "type",
      briefType: stateType,
      targetType: state.targetType,
      targetId: state.targetId,
      projectId,
    }, now);
    return { items: await getProactiveBrief(userId, now), updated: true };
  }

  // ignore：按范围（type / object / project）
  if (input.action === "ignore") {
    const scopeObj =
      scope === "object"
        ? { targetType: state.targetType, targetId: state.targetId, projectId: null }
        : scope === "project"
          ? { targetType: "project", targetId: projectId ?? null, projectId: projectId ?? null }
          : { targetType: null, targetId: null, projectId: null };
    const existed = await hasPreference(
      userId,
      stateType,
      scope,
      scopeObj.targetId,
      scopeObj.projectId,
      weekKey,
    );
    if (!existed) {
      await db.insert(brainProactivePreferences).values({
        id: makePrefId(userId, stateType, scope, scopeObj.targetId, scopeObj.projectId, weekKey),
        userId,
        type: stateType,
        scope,
        targetType: scopeObj.targetType,
        targetId: scopeObj.targetId,
        projectId: scopeObj.projectId,
        weekKey,
        createdAt: now,
      });
    }
    await updateStateStatus(userId, state.id, "ignored");
    await insertAudit(userId, {
      briefId: state.id,
      action: "ignore",
      scope,
      briefType: stateType,
      targetType: state.targetType,
      targetId: state.targetId,
      projectId,
    }, now);
    for (const n of await findNotifications(userId, stateType, state.targetType, state.targetId)) {
      await applyNotificationAction(userId, n.id, "done");
    }
    return { items: await getProactiveBrief(userId, now), updated: true };
  }

  return { items: [], updated: false, reason: "invalid_action" };
}