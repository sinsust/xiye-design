// P2-A「来源与产出回溯」统一读取层。
// 从任意产出对象（笔记 / 任务 / 提醒 / 收件箱条目 / 处理计划）反向解析出
// 「原始来源 → AI 整理 → 用户确认 → 正式产出」的完整链路（ProvenanceViewModel）。
// 只读取当前用户的数据：所有查询均带 userId 隔离，无法访问他人数据。

import {
  getBrainInboxItem,
  getBrainInboxItemsByPlanId,
  getBrainNote,
  getBrainProject,
  getBrainReminderItem,
  getBrainTaskById,
  listBrainProcessingPlans,
  type BrainInboxItem,
  type BrainProcessingPlan,
  type BrainTaskStatus,
  type BrainProjectStatus,
} from "./brain-db";

const RAW_CAP = 600;

export interface ProvenanceOutputNote {
  id: string;
  title: string;
  source: string;
}
export interface ProvenanceOutputTask {
  id: string;
  title: string;
  status: BrainTaskStatus;
}
export interface ProvenanceOutputReminder {
  id: string;
  title: string;
  dueDate: string | null;
}
export interface ProvenanceOutputProject {
  id: string;
  name: string;
  color: string;
  status: BrainProjectStatus;
}
export interface ProvenanceEvent {
  label: string;
  at: number | null;
}
export interface ProvenanceViewModel {
  found: boolean;
  // —— 来源 ——
  sourceType: string;
  sourceTitle: string;
  sourceCreatedAt: number | null;
  rawContent: string;
  inboxStatus: string | null;
  // —— 处理计划 ——
  planId: string | null;
  planStatus: string | null;
  organizedAt: number | null;
  confirmedAt: number | null;
  // —— 产出 ——
  outputNote: ProvenanceOutputNote | null;
  outputTasks: ProvenanceOutputTask[];
  outputReminders: ProvenanceOutputReminder[];
  outputProject: ProvenanceOutputProject | null;
  // —— 时间线 ——
  timeline: ProvenanceEvent[];
}

function clip(s: string): string {
  const t = (s ?? "").trim();
  return t.length > RAW_CAP ? t.slice(0, RAW_CAP) + "…" : t;
}

/** 从 noteId 反查产出它的处理计划（仅当该笔记确实由计划产生）。 */
async function findPlanByNote(
  userId: string,
  noteId: string,
): Promise<BrainProcessingPlan | null> {
  const plans = await listBrainProcessingPlans(userId, undefined, true);
  return plans.find((p) => p.noteId === noteId) ?? null;
}

async function getPlanById(
  userId: string,
  planId: string,
): Promise<BrainProcessingPlan | null> {
  const plans = await listBrainProcessingPlans(userId, undefined, true);
  return plans.find((p) => p.id === planId) ?? null;
}

async function findPlanByTask(
  userId: string,
  taskId: string,
): Promise<BrainProcessingPlan | null> {
  const plans = await listBrainProcessingPlans(userId, undefined, true);
  return (
    plans.find((p) => (p.taskIds ?? []).includes(taskId)) ??
    null
  );
}

export interface ProvenanceInput {
  noteId?: string | null;
  taskId?: string | null;
  reminderId?: string | null;
  inboxId?: string | null;
  planId?: string | null;
}

/**
 * 构建来源/产出链路视图模型。
 * 解析顺序：收件箱/计划为最可靠锚点 → 从产出对象反查锚点 → 组装 ViewModel。
 * 所有读取均以 userId 硬隔离；找不到或无权访问时返回 found=false，不泄露他人数据。
 */
export async function buildProvenance(
  userId: string,
  input: ProvenanceInput,
): Promise<ProvenanceViewModel> {
  // —— 1) 确定锚点：收件箱条目 + 处理计划 ——
  let inbox: BrainInboxItem | null = null;
  let plan: BrainProcessingPlan | null = null;

  if (input.inboxId) {
    inbox = await getBrainInboxItem(userId, input.inboxId);
    if (!inbox) return empty();
    if (inbox.processingPlanId) {
      plan = (await getPlanById(userId, inbox.processingPlanId)) ?? null;
    }
  }

  // 计划优先（确认/审计场景），再从产出对象反查
  if (!plan && input.planId) {
    plan = await getPlanById(userId, input.planId);
  }

  if (!inbox && !plan) {
    if (input.reminderId) {
      const reminder = await getBrainReminderItem(userId, input.reminderId);
      if (!reminder) return empty();
      if (reminder.planId) plan = await getPlanById(userId, reminder.planId);
      if (plan) inbox = (await getBrainInboxItemsByPlanId(userId, plan.id))[0] ?? null;
      // 提醒关联的笔记也可能指向同一条链路
      if (!plan && reminder.noteId) plan = await findPlanByNote(userId, reminder.noteId);
    } else if (input.taskId) {
      const task = await getBrainTaskById(userId, input.taskId);
      if (!task) return empty();
      plan = await findPlanByTask(userId, input.taskId);
      if (plan) inbox = (await getBrainInboxItemsByPlanId(userId, plan.id))[0] ?? null;
      const usedNoteId = plan?.noteId ?? task.noteId;
      if (usedNoteId) {
        const n = await getBrainNote(userId, usedNoteId);
        if (n) return assemble(userId, plan, inbox, n);
      }
    } else if (input.noteId) {
      const note = await getBrainNote(userId, input.noteId);
      if (!note) return empty();
      plan = await findPlanByNote(userId, input.noteId);
      if (plan) inbox = (await getBrainInboxItemsByPlanId(userId, plan.id))[0] ?? null;
      return assemble(userId, plan, inbox, note);
    }
  }

  // —— 2) 组装 ——
  if (plan) {
    const note = plan.noteId ? await getBrainNote(userId, plan.noteId) : null;
    return assemble(userId, plan, inbox, note);
  }
  // 只有收件箱、无计划（如仅导入未整理）：从条目本身给出来源信息
  if (inbox) {
    return {
      found: true,
      sourceType: "收件箱",
      sourceTitle: inbox.suggestedTitle || inbox.rawContent.slice(0, 40),
      sourceCreatedAt: inbox.createdAt,
      rawContent: clip(inbox.rawContent),
      inboxStatus: inbox.status,
      planId: null,
      planStatus: null,
      organizedAt: null,
      confirmedAt: null,
      outputNote: null,
      outputTasks: [],
      outputReminders: [],
      outputProject: null,
      timeline: [{ label: "已接收", at: inbox.createdAt }],
    };
  }
  return empty();
}

async function assemble(
  userId: string,
  plan: BrainProcessingPlan | null,
  inbox: BrainInboxItem | null,
  note: Awaited<ReturnType<typeof getBrainNote>>,
): Promise<ProvenanceViewModel> {
  const confirmedAt = plan?.applyAt ?? (inbox?.convertedAt != null ? inbox.convertedAt : null);
  const sourceTitle = inbox
    ? inbox.suggestedTitle || inbox.rawContent.slice(0, 40)
    : note
      ? note.title
      : (plan?.rawContent ?? "").slice(0, 40);

  // 产出对象
  const outputNote: ProvenanceOutputNote | null = note
    ? { id: note.id, title: note.title, source: note.source }
    : null;
  const outputTasks: ProvenanceOutputTask[] = [];
  const outputReminders: ProvenanceOutputReminder[] = [];
  if (plan) {
    for (const id of plan.taskIds ?? []) {
      const t = await getBrainTaskById(userId, id);
      if (t) outputTasks.push({ id: t.id, title: t.title, status: t.status });
    }
    for (const id of plan.reminderIds ?? []) {
      const r = await getBrainReminderItem(userId, id);
      if (r) outputReminders.push({ id: r.id, title: r.title, dueDate: r.dueDate });
    }
  } else if (inbox) {
    for (const id of inbox.outputTaskIds ?? []) {
      const t = await getBrainTaskById(userId, id);
      if (t) outputTasks.push({ id: t.id, title: t.title, status: t.status });
    }
    for (const id of inbox.outputReminderIds ?? []) {
      const r = await getBrainReminderItem(userId, id);
      if (r) outputReminders.push({ id: r.id, title: r.title, dueDate: r.dueDate });
    }
  }
  const outputProject: ProvenanceOutputProject | null = await (async () => {
    const pid = plan?.projectId ?? inbox?.outputProjectId ?? null;
    if (!pid) return null;
    const p = await getBrainProject(userId, pid);
    return p ? { id: p.id, name: p.name, color: p.color, status: p.status } : null;
  })();

  // 时间线
  const timeline: ProvenanceEvent[] = [];
  timeline.push({
    label: inbox ? "接收" : "直接输入",
    at: inbox?.createdAt ?? note?.createdAt ?? plan?.createdAt ?? null,
  });
  if (plan) {
    timeline.push({ label: "AI 整理", at: plan.createdAt });
    if (inbox && inbox.status === "pending_confirmation") {
      timeline.push({ label: "待用户确认", at: plan.createdAt });
    }
    if (confirmedAt) timeline.push({ label: "用户确认", at: confirmedAt });
  } else if (inbox && inbox.convertedAt) {
    timeline.push({ label: "用户确认", at: inbox.convertedAt });
  }

  return {
    found: true,
    sourceType: inbox ? "收件箱" : note ? "直接输入" : "处理计划",
    sourceTitle,
    sourceCreatedAt: inbox?.createdAt ?? note?.createdAt ?? plan?.createdAt ?? null,
    rawContent: clip(inbox?.rawContent ?? plan?.rawContent ?? note?.content ?? ""),
    inboxStatus: inbox?.status ?? null,
    planId: plan?.id ?? null,
    planStatus: plan?.status ?? null,
    organizedAt: plan?.createdAt ?? null,
    confirmedAt: confirmedAt ?? null,
    outputNote,
    outputTasks,
    outputReminders,
    outputProject,
    timeline,
  };
}

function empty(): ProvenanceViewModel {
  return {
    found: false,
    sourceType: "",
    sourceTitle: "",
    sourceCreatedAt: null,
    rawContent: "",
    inboxStatus: null,
    planId: null,
    planStatus: null,
    organizedAt: null,
    confirmedAt: null,
    outputNote: null,
    outputTasks: [],
    outputReminders: [],
    outputProject: null,
    timeline: [],
  };
}