// P3-A「项目工作台」聚合服务 + 可解释风险与下一步规则。
// - 风险与推荐全部基于可解释规则（阈值/权重集中配置于此模块），第一版不依赖 LLM。
// - 只读取当前用户数据（所有查询带 userId 隔离）；项目不存在或无权限时返回 null，不泄露项目存在性。
// - 聚合尽量批量获取（tasks/notes/relations/plans/comments/timeline 一次性取），避免 N+1。

import {
  getBrainProject,
  listBrainNotes,
  listBrainTasks,
  listBrainRelations,
  listBrainProcessingPlans,
  listPendingBrainReminderItems,
  listBrainCommentsForTasks,
  listBrainTimelinesForTasks,
  listOutcomesForTasks,
  type BrainProject,
  type BrainTask,
  type BrainNote,
  type BrainRelation,
  type BrainProjectPriority,
} from "./brain-db";
import { getStaleNotes, getCurateConfig } from "./brain-curate";

const DAY = 86_400_000;

function envNum(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : fallback;
}

// ---------- 集中配置：阈值 / 权重在此唯一维护，不得散落 API 或 UI ----------

export interface WorkbenchConfig {
  milestoneWindowDays: number; // 未来 N 天内到期视为「即将到期」里程碑
  inactivityDays: number;      // 超过 N 天无活动视为「长期无活动」
  staleNoteDays: number;       // 关键笔记过期阈值（复用 P2-B 的 BRAIN_STALE_DAYS）
  nextMaxItems: number;        // 下一步最多条数
}

export function getWorkbenchConfig(): WorkbenchConfig {
  return {
    milestoneWindowDays: envNum("WORKBENCH_MILESTONE_WINDOW_DAYS", 3),
    inactivityDays: envNum("WORKBENCH_INACTIVITY_DAYS", 21),
    staleNoteDays: getCurateConfig().staleDays,
    nextMaxItems: 3,
  };
}

// ---------- 视图模型 ----------

export type WorkbenchSeverity = "high" | "medium" | "low";
export type WorkbenchPrimaryAction =
  | "open_task"
  | "view_milestone"
  | "confirm_plan"
  | "view_note"
  | "update_project";

export type RiskCode =
  | "overdue_tasks"
  | "upcoming_milestone"
  | "blocked_tasks"
  | "low_activity"
  | "pending_plan"
  | "stale_key_notes";

export interface WorkbenchRisk {
  id: string;
  code: RiskCode;
  severity: WorkbenchSeverity;
  title: string;
  reasons: string[];
  relatedType: "task" | "milestone" | "project" | "plan" | "note";
  relatedId: string | null;
  relatedTitle: string | null;
  primaryAction: WorkbenchPrimaryAction;
}

export type NextActionCode =
  | "confirm_plan"
  | "overdue_task"
  | "soon_milestone"
  | "next_task"
  | "stale_note"
  | "update_project";

export interface NextAction {
  code: NextActionCode;
  score: number; // 可解释优先级分
  seq: number; // 同分稳定排序的次级键
  title: string;
  reasons: string[];
  primaryAction: WorkbenchPrimaryAction;
  targetType: "task" | "milestone" | "plan" | "project" | "note";
  targetId: string | null;
  targetTitle: string | null;
  createdAt: number;
}

export type MilestoneStatus = "not_started" | "doing" | "completed";

export interface WorkbenchMilestone {
  name: string;
  dueDate: string | null;
  overdue: boolean;
  isUpcoming: boolean;
  status: MilestoneStatus;
  taskCount: number;
  completedCount: number;
  representativeTaskId: string | null;
}

export interface WorkbenchProgress {
  totalTasks: number;
  todo: number;
  doing: number;
  done: number;
  blocked: number;
  overdue: number;
  completionRate: number; // 0-100
}

export interface KeyKnowledgeItem {
  noteId: string;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  source: BrainNote["source"];
  sourceLabel: string;
  hasPlan: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ActivityType = "task" | "note" | "reminder" | "relation" | "comment" | "plan" | "outcome";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  action: string;
  title: string;
  refId: string | null;
  refType: string | null;
  ts: number;
}

export interface ProjectWorkbenchViewModel {
  project: {
    id: string;
    name: string;
    description: string | null;
    objective: string | null;
    status: BrainProject["status"];
    priority: BrainProjectPriority;
    priorityLabel: string;
    color: string;
    startDate: string | null;
    dueDate: string | null;
    createdAt: number;
    updatedAt: number;
  };
  objective: string | null;
  progress: WorkbenchProgress;
  nextActions: NextAction[];
  milestones: WorkbenchMilestone[];
  risks: WorkbenchRisk[];
  keyKnowledge: KeyKnowledgeItem[];
  recentActivity: ActivityItem[];
  linkedItems: { tasks: number; notes: number; reminders: number };
  config: WorkbenchConfig;
}

const SOURCE_LABEL: Record<BrainNote["source"], string> = {
  text: "直接输入",
  file: "文件导入",
  clip: "剪藏",
  voice: "语音",
  ima: "IMA 同步",
};

const MILESTONE_DEFAULT = "__no_milestone__";

function dueDateMs(d: string | null): number {
  if (!d) return NaN;
  const t = new Date(d + "T00:00:00Z").getTime();
  return Number.isNaN(t) ? NaN : t;
}

/** 距今天数（可为负=已过期）。 */
function daysUntilMs(ms: number, now: number): number {
  return Math.floor((ms - now) / DAY);
}
function todayStart(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---------- 里程碑推导（镜像 MilestoneView 语义） ----------

function buildMilestones(tasks: BrainTask[]): WorkbenchMilestone[] {
  const groups = new Map<string, BrainTask[]>();
  for (const t of tasks) {
    const key = t.milestone?.trim() || MILESTONE_DEFAULT;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const now = todayStart();
  const out: WorkbenchMilestone[] = [];
  for (const [name, list] of groups) {
    let maxDue: number | null = null;
    for (const t of list) {
      if (t.dueDate) {
        const ms = dueDateMs(t.dueDate);
        if (Number.isFinite(ms)) maxDue = maxDue === null ? ms : Math.max(maxDue, ms);
      }
    }
    const done = list.filter((t) => t.status === "done");
    const doing = list.some((t) => t.status === "in_progress");
    const status: MilestoneStatus = list.length === done.length ? "completed" : doing ? "doing" : "not_started";
    const dueDate = maxDue === null ? null : new Date(maxDue).toISOString().slice(0, 10);
    const rep = [...list].sort((a, b) => {
      const da = dueDateMs(a.dueDate);
      const db = dueDateMs(b.dueDate);
      if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
      if (Number.isFinite(da)) return -1;
      if (Number.isFinite(db)) return 1;
      return 0;
    })[0];
    out.push({
      name: name === MILESTONE_DEFAULT ? "无里程碑" : name,
      dueDate,
      overdue: status !== "completed" && maxDue !== null && maxDue < now,
      isUpcoming: status !== "completed" && maxDue !== null && maxDue >= now,
      status,
      taskCount: list.length,
      completedCount: done.length,
      representativeTaskId: rep?.id ?? null,
    });
  }
  return out;
}

// ---------- 聚合入口 ----------

/**
 * 构建某项目的项目工作台视图。项目不存在或无权限访问时返回 null（跨用户统一，不泄露存在性）。
 * 所有数据均在当前用户范围内读取与过滤。
 */
export async function buildProjectWorkbench(
  userId: string,
  projectId: string,
): Promise<ProjectWorkbenchViewModel | null> {
  const project = await getBrainProject(userId, projectId);
  if (!project) return null;

  const cfg = getWorkbenchConfig();

  // —— 一次性批量取当前用户数据，避免 N+1 ——
  const [allTasks, allNotes, allRelations, pendingPlans, allPlans, reminders] = await Promise.all(
    [
      listBrainTasks(userId),
      listBrainNotes(userId),
      listBrainRelations(userId),
      listBrainProcessingPlans(userId, ["pending_confirmation"]),
      listBrainProcessingPlans(userId, undefined, true),
      listPendingBrainReminderItems(userId),
    ],
  );

  const projectTasks = allTasks.filter((t) => t.projectId === projectId && !t.archived);
  const taskIds = new Set(projectTasks.map((t) => t.id));
  const taskById = new Map(allTasks.map((t) => [t.id, t]));

  // 关键笔记：已确认的「属于项目」关系指向的当前用户未归档笔记
  const confirmedNoteIds = new Set<string>();
  for (const r of allRelations) {
    if (r.type !== "belongs_to_project" || r.status !== "confirmed") continue;
    if (r.targetType === "project" && r.targetId === projectId && r.sourceType === "note") {
      confirmedNoteIds.add(r.sourceId);
    }
  }
  const keyNotes = allNotes
    .filter((n) => !n.superseded && confirmedNoteIds.has(n.id))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const keyNoteIds = new Set(keyNotes.map((n) => n.id));

  const now = Date.now();
  const zToday = todayStart();

  // —— 逾期 / 阻塞 ——
  const overdueTasks = projectTasks
    .filter((t) => t.status !== "done" && t.dueDate && dueDateMs(t.dueDate) < zToday)
    .sort((a, b) => dueDateMs(a.dueDate) - dueDateMs(b.dueDate));

  const blockedSet = new Set<string>();
  for (const r of allRelations) {
    if (r.type !== "depends_on_task" && r.type !== "blocks_task") continue;
    if (r.status === "ignored") continue;
    // depends_on_task: source(T) 依赖 target(D)，D 未完成 → T 被阻塞
    if (r.type === "depends_on_task" && taskById.get(r.targetId)?.status !== "done" && taskIds.has(r.sourceId)) {
      blockedSet.add(r.sourceId);
    }
    // blocks_task: source(S) 阻塞 target(T)，S 未完成 → T 被阻塞
    if (r.type === "blocks_task" && taskById.get(r.sourceId)?.status !== "done" && taskIds.has(r.targetId)) {
      blockedSet.add(r.targetId);
    }
  }
  const blockedTasks = projectTasks.filter((t) => blockedSet.has(t.id) && t.status !== "done");

  // —— 进展统计 ——
  const todo = projectTasks.filter((t) => t.status === "todo").length;
  const doing = projectTasks.filter((t) => t.status === "in_progress").length;
  const done = projectTasks.filter((t) => t.status === "done").length;
  const progress: WorkbenchProgress = {
    totalTasks: projectTasks.length,
    todo,
    doing,
    done,
    blocked: blockedTasks.length,
    overdue: overdueTasks.length,
    completionRate: projectTasks.length ? Math.round((done / projectTasks.length) * 100) : 0,
  };

  // —— 里程碑 ——
  const milestones = buildMilestones(projectTasks);
  const relevantMilestones = milestones
    .filter((m) => m.overdue || m.isUpcoming)
    .filter((m) => m.dueDate)
    .sort((a, b) => dueDateMs(a.dueDate) - dueDateMs(b.dueDate));

  const showSoonMile = relevantMilestones.some((m) => m.isUpcoming && !m.overdue);
  const showOverdueMile = relevantMilestones.some((m) => m.overdue);

  // —— 待确认计划（关联本项目）——
  const projectPlans = pendingPlans
    .filter((p) => p.projectId === projectId)
    .sort((a, b) => b.createdAt - a.createdAt);

  // —— 关键笔记过期 ——
  const keyNotesUnstale = keyNotes.concat();
  const staleInfos = new Map(
    getStaleNotes(userId, keyNotesUnstale, cfg.staleNoteDays).map((s) => [s.noteId, s]),
  );
  const staleKeyNotes = keyNotes.filter((n) => staleInfos.has(n.id));

  // —— 无活动 ——
  let lastActivity = project.updatedAt;
  for (const t of projectTasks) {
    lastActivity = Math.max(lastActivity, t.createdAt, t.completedAt ?? 0);
  }
  for (const n of keyNotes) lastActivity = Math.max(lastActivity, n.updatedAt);
  const idleDays = Math.floor((now - lastActivity) / DAY);
  const lowActivity = project.status === "active" && idleDays >= cfg.inactivityDays;

  // ==================== 风险（可解释规则） ====================
  const risks: WorkbenchRisk[] = [];

  if (overdueTasks.length) {
    risks.push({
      id: `risk-overdue-${projectId}`,
      code: "overdue_tasks",
      severity: "high",
      title: `有 ${overdueTasks.length} 个任务已逾期`,
      reasons: overdueTasks.slice(0, 3).map((t) => `「${t.title}」应于 ${t.dueDate} 前完成`),
      relatedType: "task",
      relatedId: overdueTasks[0].id,
      relatedTitle: overdueTasks[0].title,
      primaryAction: "open_task",
    });
  }

  if (showOverdueMile) {
    const m = relevantMilestones.filter((x) => x.overdue)[0];
    risks.push({
      id: `risk-overdue-milestone-${projectId}`,
      code: "upcoming_milestone",
      severity: "high",
      title: `里程碑「${m.name}」已到期`,
      reasons: [`里程碑「${m.name}」截止 ${m.dueDate}，尚未完成`],
      relatedType: "milestone",
      relatedId: m.representativeTaskId,
      relatedTitle: m.name,
      primaryAction: "view_milestone",
    });
  } else if (showSoonMile) {
    const m = relevantMilestones.filter((x) => x.isUpcoming && !x.overdue)[0];
    risks.push({
      id: `risk-soon-milestone-${projectId}`,
      code: "upcoming_milestone",
      severity: "medium",
      title: `里程碑「${m.name}」即将到期`,
      reasons: [`${daysUntilMs(dueDateMs(m.dueDate!), now) === 0 ? "今天" : `还剩 ${daysUntilMs(dueDateMs(m.dueDate!), now)} 天`}内截止，需关注推进`],
      relatedType: "milestone",
      relatedId: m.representativeTaskId,
      relatedTitle: m.name,
      primaryAction: "view_milestone",
    });
  }

  if (blockedTasks.length) {
    risks.push({
      id: `risk-blocked-${projectId}`,
      code: "blocked_tasks",
      severity: "high",
      title: `有 ${blockedTasks.length} 个任务被依赖/阻塞`,
      reasons: blockedTasks.slice(0, 3).map((t) => `「${t.title}」依赖项尚未完成`),
      relatedType: "task",
      relatedId: blockedTasks[0].id,
      relatedTitle: blockedTasks[0].title,
      primaryAction: "open_task",
    });
  }

  if (projectPlans.length) {
    const plan = projectPlans[0];
    const high = planIsHighPriority(plan.planJson);
    risks.push({
      id: `risk-pending-plan-${projectId}`,
      code: "pending_plan",
      severity: high ? "high" : "medium",
      title: high ? `有 ${projectPlans.length} 个高优先级处理计划待确认` : `有 ${projectPlans.length} 个处理计划待确认`,
      reasons: projectPlans.slice(0, 3).map((p) => `「${p.rawContent.slice(0, 32)}」${high ? "（高优先级）" : ""}`),
      relatedType: "plan",
      relatedId: plan.id,
      relatedTitle: plan.rawContent.slice(0, 40),
      primaryAction: "confirm_plan",
    });
  }

  if (staleKeyNotes.length) {
    risks.push({
      id: `risk-stale-notes-${projectId}`,
      code: "stale_key_notes",
      severity: "medium",
      title: `有 ${staleKeyNotes.length} 条关键知识可能过期`,
      reasons: staleKeyNotes.slice(0, 3).map((n) => `「${n.title || "未命名笔记"}」超过 ${cfg.staleNoteDays} 天未更新`),
      relatedType: "note",
      relatedId: staleKeyNotes[0].id,
      relatedTitle: staleKeyNotes[0].title || "未命名笔记",
      primaryAction: "view_note",
    });
  }

  if (lowActivity) {
    risks.push({
      id: `risk-inactive-${projectId}`,
      code: "low_activity",
      severity: "low",
      title: "项目长期无活动",
      reasons: [`已 ${idleDays} 天没有新增任务、笔记或更新`, "建议更新项目状态或补充目标，保持推进"],
      relatedType: "project",
      relatedId: project.id,
      relatedTitle: project.name,
      primaryAction: "update_project",
    });
  }

  // ==================== 下一步（可解释、稳定排序，最多 N 条） ====================
  const nextCandidates: NextAction[] = [];

  if (projectPlans.length) {
    const plan = projectPlans[0];
    nextCandidates.push({
      code: "confirm_plan",
      score: planIsHighPriority(plan.planJson) ? 95 : 90,
      seq: 0,
      title: "确认待处理计划",
      reasons: [`「${plan.rawContent.slice(0, 40)}」整理完成，等待确认落库`],
      primaryAction: "confirm_plan",
      targetType: "plan",
      targetId: plan.id,
      targetTitle: plan.rawContent.slice(0, 40),
      createdAt: plan.createdAt,
    });
  }

  if (overdueTasks.length) {
    const t = overdueTasks[0];
    nextCandidates.push({
      code: "overdue_task",
      score: 85,
      seq: 1,
      title: `处理逾期任务「${t.title}」`,
      reasons: [`任务 ${t.dueDate} 前未完成，逾期 ${Math.max(0, -daysUntilMs(dueDateMs(t.dueDate!), now))} 天`],
      primaryAction: "open_task",
      targetType: "task",
      targetId: t.id,
      targetTitle: t.title,
      createdAt: t.createdAt,
    });
  }

  if (showOverdueMile || showSoonMile) {
    const m = relevantMilestones[0];
    nextCandidates.push({
      code: "soon_milestone",
      score: showOverdueMile ? 80 : 70,
      seq: 2,
      title: `推进里程碑「${m.name}」`,
      reasons: [`「${m.name}」截止 ${m.dueDate}${m.overdue ? "（已逾期）" : ""}`],
      primaryAction: "view_milestone",
      targetType: "milestone",
      targetId: m.representativeTaskId,
      targetTitle: m.name,
      createdAt: todayStart(),
    });
  }

  // 下一未完成任务：排除已逾期与已完成，按优先级/期限排序
  const overdueIds = new Set(overdueTasks.map((t) => t.id));
  const nextTask = projectTasks
    .filter((t) => t.status !== "done" && !overdueIds.has(t.id))
    .sort((a, b) => {
      const pr = { high: 0, medium: 1, low: 2 } as const;
      const da = dueDateMs(a.dueDate);
      const db = dueDateMs(b.dueDate);
      if (pr[a.priority] !== pr[b.priority]) return pr[a.priority] - pr[b.priority];
      if (Number.isFinite(da) && Number.isFinite(db)) return da - db;
      return b.createdAt - a.createdAt;
    })[0];
  if (nextTask) {
    nextCandidates.push({
      code: "next_task",
      score: 60,
      seq: 3,
      title: `继续推进「${nextTask.title}」`,
      reasons: [`优先级 ${PRIORITY_LABEL[nextTask.priority]}${nextTask.dueDate ? ` · ${nextTask.dueDate} 前完成` : ""}`],
      primaryAction: "open_task",
      targetType: "task",
      targetId: nextTask.id,
      targetTitle: nextTask.title,
      createdAt: nextTask.createdAt,
    });
  }

  if (staleKeyNotes.length) {
    const n = staleKeyNotes[0];
    nextCandidates.push({
      code: "stale_note",
      score: 40,
      seq: 4,
      title: "复习可能过期的关键知识",
      reasons: [`「${n.title || "未命名笔记"}」超过 ${cfg.staleNoteDays} 天未更新，建议补充或归档`],
      primaryAction: "view_note",
      targetType: "note",
      targetId: n.id,
      targetTitle: n.title || "未命名笔记",
      createdAt: n.updatedAt,
    });
  }

  if (lowActivity || !project.objective) {
    const reason = lowActivity ? `项目已 ${idleDays} 天无活动` : "尚未填写目标摘要";
    nextCandidates.push({
      code: "update_project",
      score: 30,
      seq: 5,
      title: lowActivity ? "更新项目状态与目标" : "补充项目目标摘要",
      reasons: [reason],
      primaryAction: "update_project",
      targetType: "project",
      targetId: project.id,
      targetTitle: project.name,
      createdAt: project.updatedAt,
    });
  }

  // 稳定排序：score 降序，同分按 seq 升序（保证两次调用结果一致）
  nextCandidates.sort(
    (a, b) => (b.score - a.score) || (a.seq - b.seq) || (a.createdAt - b.createdAt),
  );
  const nextActions = nextCandidates.slice(0, cfg.nextMaxItems);

  // ==================== 关键知识（≤5，附来源摘要） ====================
  const planByNote = new Map<string, boolean>();
  for (const p of allPlans) {
    if (p.noteId) planByNote.set(p.noteId, true);
  }
  const keyKnowledge: KeyKnowledgeItem[] = keyNotes.slice(0, 5).map((n) => ({
    noteId: n.id,
    title: n.title || "未命名笔记",
    summary: n.summary || n.content.slice(0, 120),
    category: n.category || "未分类",
    tags: (n.tags ?? []).slice(0, 3),
    source: n.source,
    sourceLabel: SOURCE_LABEL[n.source] ?? n.source,
    hasPlan: planByNote.has(n.id),
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));

  // ==================== 近期活动（≤10，跨类型合并） ====================
  let actSeq = 0;
  const activities: ActivityItem[] = [];
  const pushAct = (
    type: ActivityType,
    action: string,
    title: string,
    refId: string | null,
    refType: string | null,
    ts: number,
  ) => {
    if (!ts) return;
    activities.push({ id: `act-${actSeq++}`, type, action, title, refId, refType, ts });
  };

  for (const t of projectTasks) {
    pushAct("task", "创建任务", t.title, t.id, "task", t.createdAt);
    if (t.completedAt) pushAct("task", "完成任务", t.title, t.id, "task", t.completedAt);
  }
  for (const n of keyKnowledge) {
    pushAct("note", n.updatedAt === n.createdAt ? "新建笔记" : "更新笔记", n.title, n.noteId, "note", n.updatedAt);
  }
  for (const p of projectPlans) {
    pushAct("plan", "整理待确认", p.rawContent.slice(0, 40), p.id, "plan", p.createdAt);
  }
  for (const r of allRelations) {
    if (r.status === "confirmed" && r.decidedAt) {
      const involved =
        (r.targetType === "project" && r.targetId === projectId) ||
        (r.sourceType === "task" && taskIds.has(r.sourceId)) ||
        ((r.sourceType === "note" && keyNoteIds.has(r.sourceId)) || false);
      if (involved) pushAct("relation", "确认关系", relLabel(r), r.id, "relation", r.decidedAt);
    }
  }
  for (const c of await listBrainCommentsForTasks([...taskIds])) {
    pushAct("comment", "新增评论", c.content.slice(0, 60), c.taskId, "task", c.createdAt);
  }
  for (const tl of await listBrainTimelinesForTasks([...taskIds])) {
    if (tl.action === "created" || tl.action === "comment_added") continue; // 已由上覆盖
    pushAct("task", TIMELINE_LABEL[tl.action] ?? tl.action, "", tl.taskId, "task", tl.createdAt);
  }
  // P3-B：任务结果沉淀 → 近期活动展示（不伪装为正式笔记）
  for (const o of await listOutcomesForTasks(userId, [...taskIds])) {
    pushAct("outcome", `记录结果（${OUTCOME_LABEL[o.status] ?? o.status}）`, o.summary, o.taskId, "task", o.updatedAt);
  }
  const reminderScope = new Set(projectTasks.map((t) => t.id));
  for (const n of keyNotes) reminderScope.add(n.id);
  for (const r of reminders) {
    if (!r.taskId && !r.noteId) continue;
    if (r.taskId && !taskIds.has(r.taskId)) continue;
    if (r.noteId && !reminderScope.has(r.noteId)) continue;
    pushAct("reminder", "提醒", r.title, r.id, "reminder", r.createdAt);
  }

  const recentActivity = activities
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 10)
    .map((a, i) => ({ ...a, id: `act-${i}` }));

  const projectReminders = reminders.filter((r) => {
    if (r.taskId && taskIds.has(r.taskId)) return true;
    if (r.noteId && reminderScope.has(r.noteId)) return true;
    return false;
  });

  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      objective: project.objective,
      status: project.status,
      priority: project.priority,
      priorityLabel: PRIORITY_LABEL[project.priority] ?? "中",
      color: project.color,
      startDate: project.startDate,
      dueDate: project.dueDate,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    },
    objective: project.objective,
    progress,
    nextActions,
    milestones: relevantMilestones,
    risks,
    keyKnowledge,
    recentActivity,
    linkedItems: {
      tasks: projectTasks.length,
      notes: keyNotes.length,
      reminders: projectReminders.length,
    },
    config: cfg,
  };
}

// ---------- 工具 ----------

const PRIORITY_LABEL: Record<BrainProject["priority"], string> & Record<string, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const TIMELINE_LABEL: Record<string, string> = {
  created: "创建任务",
  status_changed: "变更状态",
  comment_added: "新增评论",
  subtask_added: "新增子任务",
  dueDate_changed: "调整截止",
  outcome_recorded: "记录结果",
  outcome_updated: "更新结果",
};

const OUTCOME_LABEL: Record<string, string> = {
  resolved: "已解决",
  partial: "部分完成",
  new_issue: "发现新问题",
  no_record: "无需记录",
};

function planIsHighPriority(planJson: string): boolean {
  try {
    const obj = JSON.parse(planJson);
    const pr = obj?.priority;
    return pr === "high";
  } catch {
    return false;
  }
}

function relLabel(r: BrainRelation): string {
  switch (r.type) {
    case "produces_task":
      return "产生任务关系";
    case "belongs_to_project":
      return "归属项目关系";
    case "supports_conclusion":
      return "支持结论关系";
    case "blocks_task":
      return "阻塞关系";
    case "depends_on_task":
      return "依赖关系";
    case "similar_to":
      return "相似内容关系";
    case "may_conflict":
      return "可能冲突关系";
    case "derived_from":
      return "来源关系";
    default:
      return r.type;
  }
}