// P1「今日助理」可解释优先级引擎。
// 第一版不做机器学习，用固定、可测试、可解释的规则打分，并为每项生成可直接呈现在 UI 的 reasons。
// 规则集中于此，避免散落在 dashboard/route、overview-panel 与各任务组件。

export type TodayPriorityType = "task" | "plan" | "project_risk" | "inbox";
export type TodayPriorityLevel = "critical" | "high" | "normal";

export interface TodayPriorityItem {
  id: string;
  type: TodayPriorityType;
  title: string;
  summary?: string;
  priority: TodayPriorityLevel;
  score: number;
  reasons: string[];
  dueAt?: string;
  projectId?: string;
  primaryAction: {
    label: string;
    action: "open_task" | "confirm_plan" | "open_project" | "process_inbox";
    targetId: string;
  };
}

/** 任务/计划/收件箱/项目 的最小输入结构（与实际 DB 行兼容即可，避免强依赖）。 */
export interface PriorityTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  projectId: string | null;
  milestone: string | null;
  completedAt: number | null;
  createdAt: number;
}
export interface PriorityPlan {
  id: string;
  status: string;
  createdAt: number;
  projectId?: string | null;
  contentPreview: string;
}
export interface PriorityInbox {
  id: string;
  status: string;
  createdAt: number;
  rawContent: string;
}
export interface PriorityProject {
  id: string;
  name: string;
  status: string;
  dueDate: string | null;
  createdAt: number;
}

export interface PriorityContext {
  now: number;
  todayStart: number;
  todayEnd: number;
  activeProjectIds: Set<string>;
  projectDueById: Map<string, string | null>;
}

const DAY_MS = 86400_000;

function startOfDayByOffset(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function makeContext(now: number, projects: PriorityProject[]): PriorityContext {
  const todayStart = startOfDayByOffset(now);
  return {
    now,
    todayStart,
    todayEnd: todayStart + DAY_MS,
    activeProjectIds: new Set(projects.filter((p) => p.status === "active").map((p) => p.id)),
    projectDueById: new Map(projects.map((p) => [p.id, p.dueDate])),
  };
}

function dueMs(dueDate: string | null): number {
  if (!dueDate) return NaN;
  const ms = new Date(dueDate).getTime();
  return isNaN(ms) ? NaN : ms;
}

function levelFor(score: number): TodayPriorityLevel {
  if (score >= 85) return "critical";
  if (score >= 40) return "high";
  return "normal";
}

// ---------------- 各项打分（可解释规则） ----------------

export function scoreTaskItem(t: PriorityTask, ctx: PriorityContext): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  let dueAt: string | null = null;

  const due = dueMs(t.dueDate);
  if (!isNaN(due)) {
    dueAt = t.dueDate ?? null;
    if (due < ctx.todayStart) {
      const days = Math.max(1, Math.round((ctx.todayStart - due) / DAY_MS));
      score += 50;
      reasons.push(`已逾期 ${days} 天`);
    } else if (due < ctx.todayEnd) {
      score += 40;
      reasons.push("今天到期");
    } else if (due < ctx.todayStart + 3 * DAY_MS) {
      reasons.push("近 3 天到期");
    }
  }
  if (t.priority === "high") {
    score += 20;
    reasons.push("高优先级");
  }
  if (t.projectId && ctx.activeProjectIds.has(t.projectId)) {
    score += 15;
    const projectDue = ctx.projectDueById.get(t.projectId);
    if (projectDue) {
      const pd = dueMs(projectDue);
      if (!isNaN(pd) && pd >= ctx.todayStart && pd < ctx.todayStart + 7 * DAY_MS) {
        reasons.push("关联项目近期有里程碑截止");
      }
    }
  }
  if (t.milestone) score += 5;
  // 越久未处理，轻微累加，帮助打破平局
  if (t.createdAt) score += Math.min(Math.floor((ctx.now - t.createdAt) / (7 * DAY_MS)), 3);
  return { score, reasons };
}

export function scorePlanItem(p: PriorityPlan, ctx: PriorityContext): { score: number; reasons: string[] } {
  if (p.status !== "pending_confirmation") return { score: 0, reasons: [] };
  const reasons = ["待确认的 AI 处理计划"];
  if (p.projectId && ctx.activeProjectIds.has(p.projectId)) reasons.push("关联活跃项目");
  return { score: 25, reasons };
}

export function scoreInboxItem(i: PriorityInbox, ctx: PriorityContext): { score: number; reasons: string[] } {
  if (i.status !== "pending") return { score: 0, reasons: [] };
  const ageDays = Math.floor((ctx.now - i.createdAt) / DAY_MS);
  const reasons: string[] = [];
  let score = 0;
  if (ageDays >= 3) {
    score += 10;
    reasons.push(`收件箱滞留 ${ageDays} 天`);
  } else {
    reasons.push("收件箱待处理");
  }
  return { score, reasons };
}

export function scoreProjectRiskItem(p: PriorityProject, ctx: PriorityContext): { score: number; reasons: string[] } {
  const due = dueMs(p.dueDate);
  if (p.status !== "active" || isNaN(due)) return { score: 0, reasons: [] };
  const reasons: string[] = [];
  let score = 0;
  if (due < ctx.todayStart) {
    const days = Math.max(1, Math.round((ctx.todayStart - due) / DAY_MS));
    score += 25;
    reasons.push(`项目里程碑已逾期 ${days} 天`);
  } else if (due < ctx.todayEnd) {
    score += 20;
    reasons.push("项目里程碑今天截止");
  } else if (due < ctx.todayStart + 3 * DAY_MS) {
    score += 15;
    reasons.push(`项目里程碑 ${Math.round((due - ctx.todayStart) / DAY_MS)} 天后截止`);
  }
  return { score, reasons };
}

// ---------------- 组装 TodayBrief ----------------

export interface TodayBrief {
  generatedAt: string;
  timezone: string;
  headline: {
    totalPriorityItems: number;
    overdueTasks: number;
    pendingPlans: number;
    inboxCount: number;
  };
  priorities: TodayPriorityItem[];
  pendingPlans: { id: string; title: string; createdAt: number; contentPreview: string }[];
  dueSoon: { id: string; title: string; dueDate: string; projectId: string | null }[];
  projectRisks: { projectId: string; name: string; dueDate: string | null; daysRemaining: number | null; reasons: string[] }[];
  inbox: { id: string; title: string; createdAt: number }[];
  suggestions: { type: "confirm_plan" | "process_inbox" | "review_project" | "open_task"; text: string }[];
}

function stableSort<T>(arr: T[], cmp: (a: T, b: T) => number, key: (x: T) => string): T[] {
  return [...arr].sort((a, b) => {
    const r = cmp(a, b);
    return r !== 0 ? r : key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
  });
}

export interface BuildTodayBriefInput {
  tasks: PriorityTask[];
  plans: PriorityPlan[];
  inbox: PriorityInbox[];
  projects: PriorityProject[];
  now?: number;
  timezone?: string;
}

export function buildTodayBrief(input: BuildTodayBriefInput): TodayBrief {
  const now = input.now ?? Date.now();
  const ctx = makeContext(now, input.projects);
  const timezone = input.timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");

  const candidates: { item: TodayPriorityItem; createdAt: number }[] = [];

  for (const t of input.tasks) {
    if (t.status === "done") continue;
    const { score, reasons } = scoreTaskItem(t, ctx);
    if (score <= 0 && !reasons.length) continue;
    candidates.push({
      item: {
        id: t.id,
        type: "task",
        title: t.title,
        priority: levelFor(score),
        score,
        reasons,
        dueAt: t.dueDate ?? undefined,
        projectId: t.projectId ?? undefined,
        primaryAction: { label: "打开任务", action: "open_task", targetId: t.id },
      },
      createdAt: t.createdAt,
    });
  }
  for (const p of input.plans) {
    const { score, reasons } = scorePlanItem(p, ctx);
    if (score <= 0) continue;
    candidates.push({
      item: {
        id: p.id,
        type: "plan",
        title: p.contentPreview || "(待确认计划)",
        priority: levelFor(score),
        score,
        reasons,
        dueAt: undefined,
        projectId: p.projectId ?? undefined,
        primaryAction: { label: "确认计划", action: "confirm_plan", targetId: p.id },
      },
      createdAt: p.createdAt,
    });
  }
  for (const i of input.inbox) {
    const { score, reasons } = scoreInboxItem(i, ctx);
    if (score <= 0 && !reasons.length) continue;
    candidates.push({
      item: {
        id: i.id,
        type: "inbox",
        title: (i.rawContent ?? "").slice(0, 40),
        priority: levelFor(score),
        score,
        reasons,
        dueAt: undefined,
        primaryAction: { label: "处理收件箱", action: "process_inbox", targetId: i.id },
      },
      createdAt: i.createdAt,
    });
  }
  for (const pr of input.projects) {
    const { score, reasons } = scoreProjectRiskItem(pr, ctx);
    if (score <= 0 || !reasons.length) continue;
    candidates.push({
      item: {
        id: pr.id,
        type: "project_risk",
        title: pr.name,
        priority: levelFor(score),
        score,
        reasons,
        dueAt: pr.dueDate ?? undefined,
        projectId: pr.id,
        primaryAction: { label: "查看项目", action: "open_project", targetId: pr.id },
      },
      createdAt: pr.createdAt,
    });
  }

  const ranked = stableSort(
    candidates,
    (a, b) => b.item.score - a.item.score || b.createdAt - a.createdAt,
    (x) => x.item.id,
  );
  const priorities = ranked.slice(0, 5).map((x) => x.item);

  const overdueTasks = input.tasks.filter((t) => {
    if (t.status === "done") return false;
    const due = dueMs(t.dueDate);
    return !isNaN(due) && due < ctx.todayStart;
  }).length;

  const pendingPlans = input.plans
    .filter((p) => p.status === "pending_confirmation")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((p) => ({ id: p.id, title: p.contentPreview || "(待确认计划)", createdAt: p.createdAt, contentPreview: p.contentPreview }));

  const dueSoon = input.tasks
    .filter((t) => {
      if (t.status === "done") return false;
      const due = dueMs(t.dueDate);
      return !isNaN(due) && due >= ctx.todayStart && due < ctx.todayStart + 4 * DAY_MS;
    })
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate!, projectId: t.projectId }));

  const projectRisks = input.projects
    .map((p) => {
      const { score, reasons } = scoreProjectRiskItem(p, ctx);
      if (score <= 0) return null;
      const due = dueMs(p.dueDate);
      const daysRemaining = isNaN(due) ? null : Math.round((due - ctx.todayStart) / DAY_MS);
      return { projectId: p.id, name: p.name, dueDate: p.dueDate, daysRemaining, reasons };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));

  const inbox = input.inbox
    .filter((i) => i.status === "pending")
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((i) => ({ id: i.id, title: (i.rawContent ?? "").slice(0, 40), createdAt: i.createdAt }));

  const suggestions: TodayBrief["suggestions"] = [];
  if (pendingPlans.length) suggestions.push({ type: "confirm_plan", text: `还有 ${pendingPlans.length} 条 AI 计划等待确认` });
  if (inbox.length) suggestions.push({ type: "process_inbox", text: `收件箱有 ${inbox.length} 条待处理` });
  if (projectRisks.length) suggestions.push({ type: "review_project", text: `${projectRisks.length} 个项目存在推进风险` });
  if (overdueTasks) suggestions.push({ type: "open_task", text: `有 ${overdueTasks} 条任务已逾期` });

  return {
    generatedAt: new Date(now).toISOString(),
    timezone,
    headline: {
      totalPriorityItems: priorities.length,
      overdueTasks,
      pendingPlans: pendingPlans.length,
      inboxCount: inbox.length,
    },
    priorities,
    pendingPlans,
    dueSoon,
    projectRisks,
    inbox,
    suggestions,
  };
}