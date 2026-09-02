// P3-C 周报复盘：规则化地把「本周真实数据」组织成可读复盘与下周建议。
// 原则：只消费真实对象（已完成任务 / TaskOutcome / 逾期·阻塞·风险 / 知识决策 / 待确认计划 /
//        收件箱积压 / 里程碑），不编造项目状态；AI 仅作可选摘要增强（本文件不含 LLM 调用）。
// 系统只给出建议，最终选择权始终在用户：生成「下周计划」走 pending_confirmation Plan，用户确认后才落库。

import {
  listBrainTasks,
  listBrainProjects,
  listBrainStrategies,
  listBrainProcessingPlans,
  listBrainInboxItems,
  listOutcomesInRange,
  listBrainRelations,
  insertBrainProcessingPlan,
  type BrainTask,
  type BrainProject,
  type BrainStrategy,
  type BrainProcessingPlan,
  type BrainInboxItem,
  type BrainTaskOutcome,
  type BrainRelation,
  type BrainTaskPriority,
} from "./brain-db";
import type { ProcessingTask, ProcessingPlanBody } from "./brain-plan";

export type ReviewRefType =
  | "task"
  | "note"
  | "project"
  | "plan"
  | "inbox"
  | "outcome"
  | "strategy"
  | "milestone";
export type ReviewTone = "positive" | "risk" | "neutral";

export interface ReviewItem {
  id: string;
  refType: ReviewRefType;
  refId: string | null;
  title: string;
  reason: string;
  tone: ReviewTone;
  seq: number;
}

export interface WeeklyReviewData {
  weekKey: string;
  weekLabel: string;
  periodStart: number;
  periodEnd: number;
  summary: string;
  counts: {
    completedTasks: number;
    outcomeCount: number;
    confirmedKnowledge: number;
    handledInbox: number;
    overdueTasks: number;
    pendingPlans: number;
    staleInbox: number;
    blockedTasks: number;
    milestonesDue: number;
  };
  /** 完成与进展：统计徽标 */
  progress: { label: string; value: number; hint?: string }[];
  keyResults: ReviewItem[];
  risks: ReviewItem[];
  nextSuggestions: ReviewItem[];
  blockedTasks: number;
  staleInboxCount: number;
}

/** 一键生成的下周计划的 source 标记 */
export const NEXT_WEEK_PLAN_SOURCE = "weekly_review";

// ---------------- 周界 / 周键 ----------------
export function computeWeekBounds(now = Date.now()): {
  weekStart: number;
  weekEnd: number;
  weekKey: string;
  weekLabel: string;
} {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  const start = d.getTime();
  const end = start + 7 * 86400_000;

  // ISO 周编号
  const thursday = new Date(start);
  thursday.setDate(thursday.getDate() + 3);
  const iso = new Date(Date.UTC(thursday.getUTCFullYear(), thursday.getUTCMonth(), thursday.getUTCDate()));
  const yearStartThu = new Date(Date.UTC(iso.getUTCFullYear(), 0, 4));
  const weekNumber = Math.ceil(
    ((iso.getTime() - yearStartThu.getTime()) / 86400000 + (yearStartThu.getUTCDay() + 1) % 7) / 7,
  );
  const weekKey = `${iso.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

  const fmt = (ts: number) =>
    `${new Date(ts).getMonth() + 1}.${String(new Date(ts).getDate()).padStart(2, "0")}`;
  const weekLabel = `${fmt(start)} - ${fmt(end - 1)}`;
  return { weekStart: start, weekEnd: end, weekKey, weekLabel };
}

function todayStr(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysUntilDate(due: string, now: number): number {
  const today = new Date(todayStr(now)).getTime();
  const dueTs = new Date(due + "T00:00:00").getTime();
  return Math.round((dueTs - today) / 86400_000);
}

// ---------------- 构建复盘 ----------------
export async function buildWeeklyReview(
  userId: string,
  now = Date.now(),
): Promise<WeeklyReviewData> {
  const { weekStart, weekEnd, weekKey, weekLabel } = computeWeekBounds(now);

  const [
    tasks,
    projects,
    strategies,
    plans,
    inbox,
    outcomes,
    relations,
  ] = await Promise.all([
    listBrainTasks(userId),
    listBrainProjects(userId),
    listBrainStrategies(userId),
    listBrainProcessingPlans(userId),
    listBrainInboxItems(userId),
    listOutcomesInRange(userId, weekStart, weekEnd),
    listBrainRelations(userId),
  ]);

  const projectById = new Map(projects.map((p) => [p.id, p]));

  const activeTasks = tasks.filter((t) => !t.archived);
  const openTasks = activeTasks.filter((t) => t.status !== "done");
  const doneTasks = activeTasks.filter((t) => t.status === "done");

  const completedThisWeek = doneTasks.filter(
    (t) => t.completedAt && t.completedAt >= weekStart && t.completedAt < weekEnd,
  );
  const completedIds = new Set(completedThisWeek.map((t) => t.id));

  const today = todayStr(now);
  const overdue = openTasks.filter((t) => t.dueDate && t.dueDate < today).sort((a, b) =>
    (a.dueDate || "").localeCompare(b.dueDate || ""),
  );

  const confirmedKnowledge = strategies.filter((s) => s.createdAt >= weekStart && s.createdAt < weekEnd);
  const handledInbox = inbox.filter((i) => {
    const t = i.convertedAt ?? i.processedAt;
    return t != null && t >= weekStart && t < weekEnd;
  });
  const pendingPlans = plans.filter((p) => p.status === "pending_confirmation" && !p.archivedAt);
  const staleInbox = inbox.filter((i) => {
    if (i.status === "converted" || i.status === "processed" || i.status === "dismissed") return false;
    return i.createdAt < now - 7 * 86400_000;
  });

  // 里程碑：按名称聚合未完成任务，最近到期 ≤3 天内或已逾期 → 风险
  const milestoneMap = new Map<string, { name: string; tasks: BrainTask[] }>();
  for (const t of openTasks) {
    if (!t.milestone) continue;
    const m = milestoneMap.get(t.milestone) ?? { name: t.milestone, tasks: [] };
    m.tasks.push(t);
    milestoneMap.set(t.milestone, m);
  }
  const milestonesDue: { name: string; dueDate: string | null; projectName: string | null; rep: BrainTask }[] = [];
  for (const m of milestoneMap.values()) {
    const nearest = m.tasks
      .filter((t) => t.dueDate)
      .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))[0];
    if (!nearest?.dueDate) continue;
    const dueIn = daysUntilDate(nearest.dueDate, now);
    if (dueIn <= 3) {
      milestonesDue.push({
        name: m.name,
        dueDate: nearest.dueDate,
        projectName: nearest.projectId ? projectById.get(nearest.projectId)?.name ?? null : null,
        rep: nearest,
      });
    }
  }

  // 阻塞：depends_on_task 依赖未完成。约定 source=依赖方(被阻塞)，target=前置依赖。
  const taskDepSources = new Set(
    relations
      .filter(
        (r) =>
          r.type === "depends_on_task" &&
          r.sourceType === "task" &&
          r.sourceId != null,
      )
      .map((r) => r.sourceId),
  );
  const blockedTasks = openTasks.filter((t) => taskDepSources.has(t.id));
  const taskById = new Map(activeTasks.map((t) => [t.id, t]));
  const outcomeByTask = new Map<string, BrainTaskOutcome>();
  for (const o of outcomes) {
    if (!o.summary || o.summary === "无需记录") continue;
    if (!outcomeByTask.has(o.taskId)) outcomeByTask.set(o.taskId, o);
  }

  let seq = 0;
  function item(
    refType: ReviewRefType,
    refId: string | null,
    title: string,
    reason: string,
    tone: ReviewTone,
  ): ReviewItem {
    return { id: `rv-${seq++}`, refType, refId, title, reason, tone, seq };
  }

  // —— 关键结果：resolved outcome / 本周完成高优任务 + resolved / 新确认知识 ——
  const keyResults: ReviewItem[] = [];
  const outcomeTasks = [];
  for (const o of outcomes) {
    if (o.status === "resolved") {
      const t = taskById.get(o.taskId);
      const when = t?.completedAt && completedIds.has(t.id) ? "" : "";
      outcomeTasks.push({ o, t, when });
    }
  }
  // 已完成高优任务 + resolved outcome → 关键成果
  for (const o of outcomes) {
    if (o.status !== "resolved") continue;
    const t = taskById.get(o.taskId);
    if (t && completedIds.has(t.id) && (t.priority === "high" || t.projectId)) {
      keyResults.push(
        item("outcome", o.taskId, o.summary, "高优任务完成并沉淀结果", "positive"),
      );
    }
  }
  // 其余 resolved outcome（未覆盖）补充为关键结果
  const covered = new Set(keyResults.map((k) => k.refId));
  for (const o of outcomes) {
    if (o.status !== "resolved") continue;
    if (covered.has(o.taskId)) continue;
    keyResults.push(item("outcome", o.taskId, o.summary, "本周沉淀的结果经验", "positive"));
  }
  for (const s of confirmedKnowledge) {
    keyResults.push(
      item("note", s.noteId, s.title, "新确认的知识 / 决策", "positive"),
    );
  }

  // —— 风险与阻塞 ——
  const risks: ReviewItem[] = [];
  for (const t of overdue) {
    risks.push(
      item(
        "task",
        t.id,
        `任务逾期：${t.title}`,
        `原定 ${t.dueDate} 完成`,
        "risk",
      ),
    );
  }
  for (const m of milestonesDue) {
    const dueIn = daysUntilDate(m.dueDate!, now);
    risks.push(
      item(
        "milestone",
        m.rep.id,
        `里程碑「${m.name}」${dueIn < 0 ? "已逾期" : `${dueIn + 1} 天内到期`}${m.projectName ? `（${m.projectName}）` : ""}`,
        `最近任务 ${m.dueDate} 到期`,
        "risk",
      ),
    );
  }
  for (const p of pendingPlans) {
    risks.push(
      item("plan", p.id, `待确认处理计划：${p.rawContent.slice(0, 30)}`, "计划尚未确认并落地", "neutral"),
    );
  }
  for (const o of outcomes) {
    if (o.status === "new_issue") {
      risks.push(item("outcome", o.taskId, `新问题：${o.summary}`, "从任务结果中发现的新问题", "risk"));
    }
  }
  for (const t of blockedTasks) {
    risks.push(item("task", t.id, `阻塞：${t.title}`, "依赖的前置任务尚未完成", "risk"));
  }

  // —— 下周建议 ——
  const next: ReviewItem[] = [];
  const highPriorityPending = pendingPlans
    .filter((p) => {
      try {
        const body = JSON.parse(p.planJson) as { suggestedProjectId?: string | null };
        return true;
      } catch {
        return true;
      }
    });
  for (const p of highPriorityPending.slice(0, 3)) {
    next.push(
      item("plan", p.id, `优先确认处理计划：「${p.rawContent.slice(0, 24)}」`, "待确认高优先级计划", "neutral"),
    );
  }
  for (const t of overdue.filter((x) => x.priority === "high")) {
    next.push(item("task", t.id, `尽快完成逾期高优任务：${t.title}`, "逾期且高优先级", "neutral"));
  }
  for (const o of outcomes) {
    if (o.status === "new_issue") {
      const t = taskById.get(o.taskId);
      next.push(
        item("outcome", o.taskId, `跟进新问题：${o.summary}`, "需制定后续动作", "neutral"),
      );
    }
    if (o.status === "partial") {
      next.push(
        item("outcome", o.taskId, `继续推进：${o.summary}`, "部分完成，可作为下周目标", "neutral"),
      );
    }
  }
  if (staleInbox.length > 0) {
    next.push(
      item(
        "inbox",
        null,
        `整理 ${staleInbox.length} 条停留超过 7 天的收件箱内容`,
        "长时间未处理",
        "neutral",
      ),
    );
  }

  const counts = {
    completedTasks: completedThisWeek.length,
    outcomeCount: outcomes.length,
    confirmedKnowledge: confirmedKnowledge.length,
    handledInbox: handledInbox.length,
    overdueTasks: overdue.length,
    pendingPlans: pendingPlans.length,
    staleInbox: staleInbox.length,
    blockedTasks: blockedTasks.length,
    milestonesDue: milestonesDue.length,
  };

  const progress = [
    { label: "完成任务", value: counts.completedTasks },
    { label: "记录结果", value: counts.outcomeCount },
    { label: "确认知识", value: counts.confirmedKnowledge },
    { label: "处理收件箱", value: counts.handledInbox },
  ];

  const summary =
    `本周完成 ${counts.completedTasks} 项任务，记录 ${counts.outcomeCount} 条结果，` +
    `确认 ${counts.confirmedKnowledge} 条知识；${counts.overdueTasks ? `有 ${counts.overdueTasks} 项任务逾期` : "无任务逾期"}。`;

  return {
    weekKey,
    weekLabel,
    periodStart: weekStart,
    periodEnd: weekEnd,
    summary,
    counts,
    progress,
    keyResults,
    risks,
    nextSuggestions: next,
    blockedTasks: blockedTasks.length,
    staleInboxCount: staleInbox.length,
  };
}

// ---------------- 生成「下周计划」→ 待确认 Plan ----------------
export function buildNextWeekPlanBody(review: WeeklyReviewData): ProcessingPlanBody {
  const tasks: ProcessingTask[] = [];
  const seen = new Set<string>();
  for (const s of review.nextSuggestions) {
    if (tasks.length >= 5) break;
    if (s.refId && seen.has(s.refId)) continue;
    if (s.refId) seen.add(s.refId);
    tasks.push({
      title: s.title,
      owner: "",
      dueDate: null,
      priority: (s.tone === "risk" ? "high" : "medium") as BrainTaskPriority,
      makeReminder: false,
    });
  }
  return {
    version: 1,
    rawContent: review.nextSuggestions.map((s) => s.title).join("；"),
    inputType: "weekly_review",
    title: `下周计划（${review.weekLabel}复盘）`,
    category: "工作",
    summary: review.summary,
    body: `基于 ${review.weekLabel} 复盘生成的下周建议，请确认后加入任务列表。`,
    tags: ["下周计划"],
    related: [],
    entities: [],
    note: {
      isMeeting: false,
      isSnippet: false,
      language: "zh",
      codeContent: "",
      source: "weekly_review",
      keyPoints: [],
      insights: [],
      decisions: [],
      attendees: [],
      metrics: [],
      problemDomains: [],
      openQuestions: [],
      strategies: [],
      strategy: [],
      relatedReason: "",
      rewritten: "",
    },
    suggestedTasks: tasks,
    suggestedReminders: [],
    suggestedProjectId: null,
    suggestedProjectName: null,
    confidence: 0.9,
    reasons: [`来源：${review.weekLabel} 周报复盘`],
    evidence: [],
    aiUsed: false,
  };
}

/** 生成并持久化一条 pending_confirmation「下周计划」；不直接建任务。 */
export async function saveNextWeekPlan(
  userId: string,
  review: WeeklyReviewData,
): Promise<BrainProcessingPlan | null> {
  const planJson = buildNextWeekPlanBody(review);
  return insertBrainProcessingPlan(userId, {
    rawContent: planJson.rawContent,
    inputType: "weekly_review",
    planJson: JSON.stringify(planJson),
    source: NEXT_WEEK_PLAN_SOURCE,
  });
}