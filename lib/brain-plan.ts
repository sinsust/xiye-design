// P0 「统一信息加工确认闭环」核心服务。
// 任意第二大脑输入 → organizeToPlan 生成待确认 ProcessingPlan（只落 plan_json，绝不直接建任务/提醒/项目关系）
// → 用户编辑确认 → applyProcessingPlan 在单个服务内原子写入（笔记/策略/任务/提醒/项目/审计），失败回滚。

import {
  listBrainNotes,
  insertBrainNote,
  insertBrainStrategies,
  insertBrainTasks,
  insertBrainReview,
  insertBrainReminderItem,
  deleteBrainNote,
  deleteBrainReminderItem,
  insertBrainProcessingPlan,
  getBrainProcessingPlan,
  updateBrainProcessingPlan,
  getBrainInboxItem,
  getBrainInboxItemsByPlanId,
  updateBrainInboxItem,
  listBrainProjects,
  insertBrainProject,
  listBrainProcessingPlans,
  type BrainProcessingPlan,
  type BrainPlanStatus,
  type BrainTaskPriority,
  type NewBrainTask,
} from "./brain-db";
import {
  organizeNote,
  findDuplicateNote,
  type OrganizedNote,
  type NoteType,
} from "./brain-organizer";
import { embed, buildListableText } from "./embedding";

// ---------------- ProcessingPlan 协议 ----------------

export interface ProcessingEntity {
  name: string;
  type: "person" | "metric" | "keyword" | "domain";
}

export interface ProcessingTask {
  title: string;
  owner: string;
  dueDate: string | null;
  priority: BrainTaskPriority;
  strategyIndex?: number;
  // 用户勾选：确认时是否为此任务创建一条独立提醒
  makeReminder?: boolean;
}

export interface ProcessingReminder {
  title: string;
  remindAt: string | null;
  dueDate: string | null;
}

/** 改写正文时的分隔/保留原文标记：保证 AI 精简改写不丢原文，可在笔记内回溯 */
const ORIGIN_DIVIDER = "--- 原始记录（改写保留，防信息丢失）---";
function withOriginal(primary: string, original: string | null | undefined): string {
  if (!original || original === primary) return primary;
  return `${primary}\n\n${ORIGIN_DIVIDER}\n${original}`;
}

/** 建议知识/笔记的结构化正文承载（对应 OrganizedNote 的可序列化部分） */
export interface ProcessingNoteBody {
  isMeeting: boolean;
  isSnippet: boolean;
  language: string;
  codeContent: string;
  source: string;
  keyPoints: { point: string }[];
  insights: string[];
  decisions: string[];
  attendees: string[];
  metrics: { label: string; value: string }[];
  problemDomains: { domain: string; status: string; conclusion: string }[];
  openQuestions: string[];
  strategies: { title: string; description: string }[];
  strategy: { angle: string; logic: string }[];
  relatedReason: string;
  rewritten: string;
}

/** 一条处理计划（存 brain_processing_plans.plan_json 的序列化体） */
export interface ProcessingPlanBody {
  version: 1;
  rawContent: string;
  inputType: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  tags: string[];
  related: string[];
  entities: ProcessingEntity[];
  note: ProcessingNoteBody;
  suggestedTasks: ProcessingTask[];
  suggestedReminders: ProcessingReminder[];
  suggestedProjectId: string | null;
  suggestedProjectName: string | null;
  confidence: number;
  reasons: string[];
  evidence: string[];
  // 本次整理是否实际走了 AI 模型（false = 本地启发式兜底）
  aiUsed: boolean;
}

/** 用户确认时提交的编辑（仅覆盖可视字段，note 内部的派生字段保持原始计划） */
export interface ProcessingEdits {
  title?: string;
  category?: string;
  summary?: string;
  body?: string;
  tags?: string[];
  related?: string[];
  suggestedProjectId?: string | null;
  // P5-A：按名称关联项目（确认时若不存在同名校则自动创建），与 suggestedProjectId 二选一优先
  suggestedProjectName?: string | null;
  tasks?: ProcessingTask[];
  reminders?: ProcessingReminder[];
}

/** organize 阶段的预填（P5-A：来自产品流程的已确认结论），只影响计划建议，确认权仍在用户 */
export interface OrganizePreset {
  title?: string;
  category?: string;
  tags?: string[];
  suggestedProjectName?: string | null;
}

export const PLAN_VERSION = 1 as const;

// ---------------- 计划构建 ----------------

function cap(s: string, n: number): string {
  return (s ?? "").trim().slice(0, n);
}

function extractEntities(o: OrganizedNote): ProcessingEntity[] {
  const out: ProcessingEntity[] = [];
  for (const a of o.attendees ?? []) {
    if (a.trim()) out.push({ name: cap(a, 12), type: "person" });
  }
  for (const m of o.metrics ?? []) {
    if (m.label.trim()) out.push({ name: cap(`${m.label} ${m.value}`, 16), type: "metric" });
  }
  for (const k of o.tags ?? []) {
    if (k.trim()) out.push({ name: cap(k, 10), type: "keyword" });
  }
  for (const p of o.problemDomains ?? []) {
    if (p.domain.trim()) out.push({ name: cap(p.domain, 10), type: "domain" });
  }
  const seen = new Set<string>();
  return out.filter((e) => !seen.has(e.name) && (seen.add(e.name), true)).slice(0, 16);
}

function evidenceSnippets(raw: string): string[] {
  return raw
    .split(/\n|；|。/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 6)
    .slice(0, 3)
    .map((l) => cap(l, 48));
}

export function buildProcessingPlanBody(
  rawContent: string,
  o: OrganizedNote,
  duplicate: { id: string; title: string; score: number } | null,
  preset?: OrganizePreset | null,
): ProcessingPlanBody {
  // P5-A：预填优先（来自产品流程的已确认结论），未被预填的仍走 AI 识别
  const title = (preset?.title ?? "").trim() || o.title || cap(rawContent.split("\n")[0], 30);
  const category = (preset?.category ?? "").trim() || o.category || "随手记";
  const tags = Array.isArray(preset?.tags) && preset.tags.length ? preset.tags : (o.tags ?? []);
  const suggestedProjectName =
    (preset?.suggestedProjectName ?? "").trim() || null;
  const suggestedTasks: ProcessingTask[] = (o.actionItems ?? []).map((a) => ({
    title: cap(a.text, 40),
    owner: cap(a.owner ?? "", 12),
    dueDate: a.dueDate ?? null,
    priority: a.priority ?? "medium",
    strategyIndex: a.strategyIndex,
    // 带明确截止日期或命中时间线索的任务，默认建议创建提醒（用户可在确认前取消）
    makeReminder: Boolean(a.dueDate),
  }));
  const suggestedReminders: ProcessingReminder[] = suggestedTasks
    .filter((t) => t.makeReminder && t.dueDate)
    .map((t) => ({ title: t.title, remindAt: t.dueDate ? `${t.dueDate}T09:00:00` : null, dueDate: t.dueDate }))
    .slice(0, 4);
  const hasAiShape =
    (o.decisions?.length || 0) > 0 ||
    (o.metrics?.length || 0) > 0 ||
    (o.problemDomains?.length || 0) > 0 ||
    (o.keyPoints?.length || 0) > 0 ||
    Boolean(o.rewritten);
  const reasons = [`输入已分类为「${o.type}」`, duplicate ? "与已有笔记相似，建议作为补充/更新" : "未发现近似重复笔记"];
  if (suggestedTasks.length) reasons.push(`识别出 ${suggestedTasks.length} 条待办`);
  if (suggestedReminders.length) reasons.push(`为 ${suggestedReminders.length} 条待办建议了到期提醒`);
  return {
    version: PLAN_VERSION,
    rawContent,
    inputType: o.type,
    aiUsed: o.aiUsed ?? false,
    title,
    category,
    summary: o.summary || cap(rawContent.replace(/\n+/g, " "), 60),
    body: withOriginal(o.rewritten || rawContent, o.rewritten ? rawContent : null),
    tags,
    related: o.related ?? [],
    entities: extractEntities(o),
    note: {
      isMeeting: Boolean(o.isMeeting),
      isSnippet: Boolean(o.isSnippet),
      language: cap(o.language ?? "", 20),
      codeContent: o.codeContent ?? "",
      source: cap(o.source ?? "", 300),
      keyPoints: o.keyPoints ?? [],
      insights: o.insights ?? [],
      decisions: o.decisions ?? [],
      attendees: o.attendees ?? [],
      metrics: o.metrics ?? [],
      problemDomains: o.problemDomains ?? [],
      openQuestions: o.openQuestions ?? [],
      strategies: o.strategies ?? [],
      strategy: o.strategy ?? [],
      relatedReason: o.relatedReason ?? "",
      rewritten: o.rewritten ?? "",
    },
    suggestedTasks,
    suggestedReminders,
    suggestedProjectId: null,
    suggestedProjectName,
    confidence: hasAiShape ? 0.85 : 0.55,
    reasons,
    evidence: evidenceSnippets(rawContent),
  };
}

/**
 * 统一信息入口：把任意原始文本转译成一条「待确认」处理计划并持久化。
 * AI 阶段只写 plan_json，不创建任何正式记录。
 */
export async function organizeToPlan(
  userId: string,
  input: { rawContent: string; source?: string; preset?: OrganizePreset | null },
): Promise<{
  plan: BrainProcessingPlan | null;
  body: ProcessingPlanBody | null;
  duplicate: { id: string; title: string; score: number } | null;
}> {
  const rawContent = (input?.rawContent ?? "").trim();
  const existing = await listBrainNotes(userId);
  const organized = await organizeNote(rawContent, existing);
  const duplicate = findDuplicateNote(rawContent, existing);
  // P5-A：预填项目名 → 尽量解析为已有项目 id 预选中；未找到时保留名称待确认创建
  const body = buildProcessingPlanBody(rawContent, organized, duplicate, input?.preset ?? null);
  const presetName = (input?.preset?.suggestedProjectName ?? "").trim();
  if (presetName && !body.suggestedProjectId) {
    const proj = (await listBrainProjects(userId)).find((p) => p.name === presetName);
    if (proj) {
      body.suggestedProjectId = proj.id;
      body.suggestedProjectName = proj.name;
    }
  }
  const plan = await insertBrainProcessingPlan(userId, {
    rawContent,
    inputType: body.inputType,
    planJson: JSON.stringify(body),
    source: input?.source || "workbench",
  });
  return { plan, body, duplicate };
}

// ---------------- 收件箱 ↔ 处理计划 状态编排（P2-A）----------------
// 收件箱发起「查看并确认」：先标记 processing，据此驱动前端进入整理中态。
// 幂等：仅当条目处于 pending / processing / failed 时允许推进，避免打扰已转化的旧数据。
export async function markInboxProcessing(
  userId: string,
  inboxId: string,
): Promise<{ ok: boolean; error?: string }> {
  const item = await getBrainInboxItem(userId, inboxId);
  if (!item) return { ok: false, error: "not_found" };
  if (
    item.status !== "pending" &&
    item.status !== "processing" &&
    item.status !== "failed"
  ) {
    return { ok: false, error: "already_processed" };
  }
  await updateBrainInboxItem(userId, inboxId, { status: "processing" });
  return { ok: true };
}

/** 从收件箱条目走完整「整理 → 待确认计划」闭环：pending → processing → pending_confirmation。 */
export async function organizeInboxToPlan(
  userId: string,
  inboxId: string,
  overrides?: { source?: string },
): Promise<{
  ok: boolean;
  error?: string;
  plan?: Awaited<ReturnType<typeof organizeToPlan>>["plan"];
  body?: Awaited<ReturnType<typeof organizeToPlan>>["body"];
  duplicate?: Awaited<ReturnType<typeof organizeToPlan>>["duplicate"];
}> {
  const item = await getBrainInboxItem(userId, inboxId);
  if (!item) return { ok: false, error: "not_found" };
  if (item.status !== "pending" && item.status !== "processing" && item.status !== "failed") {
    return { ok: false, error: "already_processed" };
  }
  await markInboxProcessing(userId, inboxId);
  try {
    const { plan, body, duplicate } = await organizeToPlan(userId, {
      rawContent: item.rawContent,
      source: overrides?.source ?? "inbox",
    });
    if (!plan) {
      await updateBrainInboxItem(userId, inboxId, {
        status: "failed",
        failedReason: "处理计划生成失败，请重试",
      });
      return { ok: false, error: "plan_create_failed" };
    }
    await updateBrainInboxItem(userId, inboxId, {
      status: "pending_confirmation",
      processingPlanId: plan.id,
    });
    return { ok: true, plan, body, duplicate };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "AI 整理失败";
    await updateBrainInboxItem(userId, inboxId, { status: "failed", failedReason: reason });
    return { ok: false, error: "organize_failed", duplicate: null };
  }
}

/** 计划确认成功 / 失败后，把所有关联收件箱统一回写 converted / failed。仅 best-effort，不影响 P0 原子写入。 */
async function syncInboxFromPlan(
  userId: string,
  planId: string,
  patch: {
    status: "converted" | "failed";
    noteId?: string | null;
    outputTaskIds?: string[];
    outputReminderIds?: string[];
    outputProjectId?: string | null;
    failedReason?: string | null;
  },
): Promise<void> {
  try {
    const items = await getBrainInboxItemsByPlanId(userId, planId);
    for (const it of items) {
      await updateBrainInboxItem(userId, it.id, {
        status: patch.status,
        noteId: patch.status === "converted" ? (patch.noteId ?? null) : undefined,
        outputTaskIds: patch.status === "converted" ? (patch.outputTaskIds ?? []) : undefined,
        outputReminderIds: patch.status === "converted" ? (patch.outputReminderIds ?? []) : undefined,
        outputProjectId: patch.status === "converted" ? (patch.outputProjectId ?? null) : undefined,
        convertedAt: patch.status === "converted" ? Date.now() : undefined,
        failedReason: patch.status === "failed" ? (patch.failedReason ?? "处理失败") : undefined,
      });
    }
  } catch (err) {
    console.error("[brain-plan] sync inbox from plan failed:", err);
  }
}

// ---------------- 确认写入（统一写入服务） ----------------

function toNewTask(
  noteId: string,
  t: ProcessingTask,
  strategyIndexMap: Map<number, string>,
  projectId: string | null,
): NewBrainTask {
  const strategyId = typeof t.strategyIndex === "number" ? strategyIndexMap.get(t.strategyIndex) ?? null : null;
  return {
    noteId,
    title: cap(t.title, 40),
    dueDate: t.dueDate || null,
    priority: t.priority ?? "medium",
    strategyId,
    projectId,
    assignee: t.owner || null,
  };
}

function applyEdits(body: ProcessingPlanBody, edits?: ProcessingEdits | null): ProcessingPlanBody {
  if (!edits) return body;
  return {
    ...body,
    title: (edits.title ?? "").trim() || body.title,
    category: (edits.category ?? "").trim() || body.category,
    summary: (edits.summary ?? "").trim() || body.summary,
    body: edits.body ?? body.body,
    tags: Array.isArray(edits.tags) ? edits.tags : body.tags,
    related: Array.isArray(edits.related) ? edits.related : body.related,
    suggestedProjectId: edits.suggestedProjectId !== undefined ? edits.suggestedProjectId || null : body.suggestedProjectId,
    suggestedProjectName: edits.suggestedProjectName !== undefined ? edits.suggestedProjectName || null : body.suggestedProjectName,
    suggestedTasks: Array.isArray(edits.tasks) ? edits.tasks : body.suggestedTasks,
    suggestedReminders: Array.isArray(edits.reminders) ? edits.reminders : body.suggestedReminders,
  };
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  reason?: string;
  note?: Awaited<ReturnType<typeof insertBrainNote>>;
  strategyIds: string[];
  taskIds: string[];
  reminderIds: string[];
  plan: BrainProcessingPlan | null;
}

/** 校验项目归属，防止跨用户关联。P5-A：未命中 id 时，若给出项目名则按名查找，不存在则自动创建后关联。 */
async function resolveProject(
  userId: string,
  projectId: string | null,
  projectName: string | null,
): Promise<{ id: string | null; name: string | null }> {
  if (projectId) {
    const projects = await listBrainProjects(userId);
    const hit = projects.find((p) => p.id === projectId);
    return hit ? { id: hit.id, name: hit.name } : { id: null, name: null };
  }
  const name = (projectName ?? "").trim();
  if (!name) return { id: null, name: null };
  const projects = await listBrainProjects(userId);
  const existing = projects.find((p) => p.name === name);
  if (existing) return { id: existing.id, name: existing.name };
  const created = await insertBrainProject(userId, { name, status: "active", priority: "medium" });
  return created ? { id: created.id, name: created.name } : { id: null, name: null };
}

/**
 * 用户「确认保存」后统一执行的原子写入：
 * 笔记（含策略）→ 确认的任务 → 确认的提醒 → 项目关联 → 审计。
 * 任一步失败：回滚已写入对象，标记 failed 并记录 recovery。
 */
export async function applyProcessingPlan(
  userId: string,
  plan: BrainProcessingPlan,
  edits?: ProcessingEdits | null,
): Promise<ApplyResult> {
  // 并发/连点/页面恢复后的重复确认护栏：以库内最新状态为准，已应用则不再重复产出。
  const fresh = await getBrainProcessingPlan(userId, plan.id);
  if (fresh && fresh.status === "applied") {
    return { ok: false, error: "already_applied", reason: "该计划已确认保存，请勿重复提交", strategyIds: [], taskIds: [], reminderIds: [], plan: fresh };
  }
  let body: ProcessingPlanBody;
  try {
    body = JSON.parse(plan.planJson);
  } catch {
    return { ok: false, error: "invalid_plan", reason: "处理计划数据损坏，无法解析", strategyIds: [], taskIds: [], reminderIds: [], plan };
  }
  if (!Array.isArray(body.suggestedTasks)) {
    body = { ...body, suggestedTasks: [], suggestedReminders: Array.isArray(body.suggestedReminders) ? body.suggestedReminders : [] };
  }
  if (!Array.isArray(body.suggestedReminders)) {
    body = { ...body, suggestedReminders: [] };
  }
  const final = applyEdits(body, edits);
  const content = final.body?.trim() || plan.rawContent;
  if (!content.trim()) {
    // P2-A：内容为空也算一次「处理失败」，统一回写关联收件箱为 failed，保证状态机闭合
    await syncInboxFromPlan(userId, plan.id, { status: "failed", failedReason: "正文为空，无法保存" });
    return { ok: false, error: "content_required", reason: "正文为空，无法保存", strategyIds: [], taskIds: [], reminderIds: [], plan };
  }

  // 确认阶段才允许写：ensure plan 仍处于可应用状态
  let createdNoteId: string | null = null;
  let createdTaskIds: string[] = [];
  let createdStrategyIds: string[] = [];
  let createdReminderIds: string[] = [];
  const { id: projectId } = await resolveProject(userId, final.suggestedProjectId, final.suggestedProjectName);

  const fail = async (error: string, reason: string) => {
      // 回滚本次已写入的对象（任务/策略/复习随笔记级联删除；独立提醒单独删）
      const recovery: Record<string, unknown> = { noteId: createdNoteId, taskIds: createdTaskIds, strategyIds: createdStrategyIds, reminderIds: createdReminderIds };
      try {
        for (const id of createdReminderIds) await deleteBrainReminderItem(userId, id);
        if (createdNoteId) await deleteBrainNote(userId, createdNoteId);
        createdNoteId = null;
        createdTaskIds = [];
        createdStrategyIds = [];
        createdReminderIds = [];
        recovery.rolledBack = true;
      } catch (rbErr) {
        console.error("[brain-plan] rollback partial failed:", rbErr);
        recovery.rolledBack = false;
        recovery.recoveryState = "pending_recovery";
      }
      await updateBrainProcessingPlan(userId, plan.id, {
        status: "failed",
        failureReason: reason,
        recovery: JSON.stringify(recovery),
      });
      // P2-A：关联收件箱统一回写 failed（best-effort）
      await syncInboxFromPlan(userId, plan.id, { status: "failed", failedReason: reason });
      return { ok: false, error, reason, strategyIds: createdStrategyIds, taskIds: createdTaskIds, reminderIds: createdReminderIds, plan } satisfies ApplyResult;
    };

  try {
    // 1) 笔记 + 策略
    // SKIP_EMBED=1 仅用于离线/验证脚本，跳过向量模型加载，生产不受影响
    const embedding =
      process.env.SKIP_EMBED === "1"
        ? null
        : await embed(buildListableText({ title: final.title, content, summary: final.summary, tags: final.tags })).catch(() => null);
    const note = await insertBrainNote(userId, {
      source: "text",
      content,
      title: final.title,
      category: final.category,
      summary: final.summary,
      tags: final.tags,
      related: final.related,
      isSnippet: final.note.isSnippet,
      language: final.note.language || null,
      codeContent: final.note.codeContent || null,
      embedding: embedding ? JSON.stringify(embedding) : null,
      struct: JSON.stringify(buildStructDraft(final)).slice(0, 20000),
    });
    createdNoteId = note?.id ?? null;
    if (!createdNoteId) return fail("save_note_failed", "笔记写入失败");

    // 2) 策略
    const strats = final.note.strategies ?? [];
    const createdStrategies = strats.length
      ? await insertBrainStrategies(
          userId,
          strats.map((s) => ({ noteId: createdNoteId as string, title: cap(s.title, 200), description: cap(s.description, 1000) })),
        )
      : [];
    createdStrategyIds = createdStrategies.map((s) => s.id);
    const strategyIndexMap = new Map<number, string>();
    createdStrategies.forEach((s, idx) => strategyIndexMap.set(idx, s.id));

    // 3) 确认的任务（含项目关联 / 负责人 / 截止 / 优先级）
    const tasks = final.suggestedTasks.filter((t) => t.title.trim());
    if (tasks.length) {
      const created = await insertBrainTasks(
        userId,
        tasks.map((t) => toNewTask(createdNoteId as string, t, strategyIndexMap, projectId)),
      );
      createdTaskIds = created.map((t) => t.id);
    }

    // 4) 确认的提醒（任务勾选 makeReminder + 用户显式追加的 reminders）
    const reminderSources: ProcessingReminder[] = [];
    for (const t of tasks) {
      if (t.makeReminder) {
        reminderSources.push({
          title: t.title,
          remindAt: t.dueDate ? `${t.dueDate}T09:00:00` : null,
          dueDate: t.dueDate,
        });
      }
    }
    for (const r of final.suggestedReminders ?? []) {
      if (r.title.trim() && !reminderSources.some((x) => x.title === r.title)) reminderSources.push(r);
    }
    const remindAtToTaskId = (title: string): string | null => {
      if (!tasks.length) return null;
      const t = tasks.find((x) => x.title === title);
      return t ? createdTaskIds[tasks.indexOf(t)] ?? null : null;
    };
    for (const r of reminderSources.slice(0, 8)) {
      const item = await insertBrainReminderItem(userId, {
        title: cap(r.title, 80),
        remindAt: r.remindAt || null,
        dueDate: r.dueDate || null,
        noteId: createdNoteId,
        taskId: remindAtToTaskId(r.title),
        planId: plan.id,
      });
      if (item?.id) createdReminderIds.push(item.id);
    }

    // 5) 复习记录（1 天后）
    await insertBrainReview(userId, {
      noteId: createdNoteId,
      nextReviewAt: new Date(Date.now() + 86400_000).toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });

    // 6) 审计：回写 plan 状态与产出对象 ID
    await updateBrainProcessingPlan(userId, plan.id, {
      status: "applied",
      noteId: createdNoteId,
      taskIds: createdTaskIds,
      strategyIds: createdStrategyIds,
      reminderIds: createdReminderIds,
      projectId: projectId ?? undefined,
      editsJson: edits ? JSON.stringify(edits) : undefined,
      applyAt: Date.now(),
      failureReason: null,
      recovery: null,
    });
    // P2-A：关联收件箱统一回写 converted + 产出对象（best-effort，不阻断主流程）
    await syncInboxFromPlan(userId, plan.id, {
      status: "converted",
      noteId: createdNoteId,
      outputTaskIds: createdTaskIds,
      outputReminderIds: createdReminderIds,
      outputProjectId: projectId,
    });
    const updated = await getBrainProcessingPlan(userId, plan.id);
    return { ok: true, note, strategyIds: createdStrategyIds, taskIds: createdTaskIds, reminderIds: createdReminderIds, plan: updated };
  } catch (err) {
    console.error("[brain-plan] apply failed:", err);
    return fail("apply_failed", err instanceof Error ? err.message : "写入过程发生未知错误");
  }
}

/** 从最终计划构造落库 struct 的结构化草稿（兼容 OrganizedDraft / struct-preview / 详情页） */
function buildStructDraft(final: ProcessingPlanBody): Record<string, unknown> {
  return {
    title: final.title,
    category: final.category,
    type: final.inputType,
    summary: final.summary,
    tags: final.tags,
    related: final.related,
    relatedReason: final.note.relatedReason,
    actionItems: final.suggestedTasks.map((t) => ({ text: t.title, owner: t.owner, dueDate: t.dueDate, priority: t.priority, strategyIndex: t.strategyIndex })),
    strategies: final.note.strategies,
    decisions: final.note.decisions,
    attendees: final.note.attendees,
    metrics: final.note.metrics,
    problemDomains: final.note.problemDomains,
    openQuestions: final.note.openQuestions,
    strategy: final.note.strategy,
    isMeeting: final.note.isMeeting,
    isSnippet: final.note.isSnippet,
    language: final.note.language,
    codeContent: final.note.codeContent,
    source: final.note.source,
    keyPoints: final.note.keyPoints,
    insights: final.note.insights,
    rewritten: final.note.rewritten,
  };
}

// ---------------- 审计查询 ----------------

/** 解析 plan_json 为可读 body */
export function parsePlanBody(plan: BrainProcessingPlan | null | undefined): ProcessingPlanBody | null {
  if (!plan) return null;
  try {
    const b = JSON.parse(plan.planJson) as ProcessingPlanBody;
    return b && typeof b === "object" ? b : null;
  } catch {
    return null;
  }
}

/** 可恢复性：查询用户的待确认/失败的 plan（刷新/重登后恢复草稿）。 */
export async function listRecoverablePlans(userId: string, status?: BrainPlanStatus[]): Promise<BrainProcessingPlan[]> {
  return listBrainProcessingPlans(userId, status);
}

// ---------------- P0.5 恢复与运维安全网 ----------------

export interface PlanRecoveryView {
  id: string;
  createdAt: number;
  applyAt: number | null;
  step: string | null; // 失败步骤（恢复链第一步）+ 语义化分类
  reason: string | null;
  status: BrainPlanStatus;
  // 已写出的对象（用于内部人眼可读的补偿说明）
  written: { noteId: string | null; taskIds: string[]; strategyIds: string[]; reminderIds: string[] };
  // recovery 原样（JSON 字符串）
  recovery: string | null;
  rolledBack: boolean;
  pendingRecovery: boolean;
  contentPreview: string;
}

function parseRecovery(plan: BrainProcessingPlan): {
  rolledBack: boolean;
  pendingRecovery: boolean;
  step: string | null;
} {
  let rolledBack = false;
  let pendingRecovery = false;
  let step: string | null = null;
  if (plan.recovery) {
    try {
      const r = JSON.parse(plan.recovery);
      rolledBack = r?.rolledBack === true;
      pendingRecovery = r?.recoveryState === "pending_recovery";
      step = r?.failedStep?.toString() ?? r?.step ?? null;
    } catch {
      /* 忽略 */
    }
  }
  return { rolledBack, pendingRecovery, step };
}

/** 待恢复计划（failed / pending_recovery），内部回收站可见；审计记录永久保留，不做硬删除。 */
export async function listPendingRecoveryPlans(userId: string): Promise<PlanRecoveryView[]> {
  const failed = await listBrainProcessingPlans(userId, ["failed"]);
  const out: PlanRecoveryView[] = [];
  for (const p of failed) {
    const { rolledBack, pendingRecovery, step } = parseRecovery(p);
    out.push({
      id: p.id,
      createdAt: p.createdAt,
      applyAt: p.applyAt,
      step: step ?? "apply",
      reason: p.failureReason,
      status: p.status,
      written: { noteId: p.noteId, taskIds: p.taskIds, strategyIds: p.strategyIds, reminderIds: p.reminderIds },
      recovery: p.recovery,
      rolledBack,
      pendingRecovery,
      contentPreview: (p.rawContent ?? "").slice(0, 60),
    });
  }
  out.sort((a, b) => b.createdAt - a.createdAt);
  return out;
}

/** 补偿回滚：删除失败计划已写出的对象（提醒 + 笔记级联任务/策略/复习），并保留审计记录。 */
export async function compensateProcessingPlan(
  userId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const plan = await getBrainProcessingPlan(userId, planId);
  if (!plan) return { ok: false, error: "not_found" };
  const reminderIds = [...(plan.reminderIds ?? [])];
  const noteId = plan.noteId;
  try {
    for (const rid of reminderIds) {
      try {
        await deleteBrainReminderItem(userId, rid);
      } catch (e) {
        console.error("[brain-plan] compensate reminder failed:", rid, e);
      }
    }
    if (noteId) {
      try {
        await deleteBrainNote(userId, noteId);
      } catch (e) {
        console.error("[brain-plan] compensate note failed:", noteId, e);
      }
    }
    let recovery: Record<string, unknown> = { rolledBack: true, compensatedAt: Date.now(), noteId, reminderIds };
    if (plan.recovery) {
      try {
        recovery = { ...JSON.parse(plan.recovery), ...recovery };
      } catch {
        /* 忽略 */
      }
    }
    await updateBrainProcessingPlan(userId, planId, {
      status: "rejected",
      recovery: JSON.stringify(recovery),
      failureReason: (plan.failureReason ?? "") + "（已人工补偿回滚）",
    });
    return { ok: true };
  } catch (err) {
    console.error("[brain-plan] compensate failed:", err);
    return { ok: false, error: "compensate_failed" };
  }
}

/** 标记人工已处理（不再出现在待恢复列表，但保留审计记录）。 */
export async function markPlanHandled(
  userId: string,
  planId: string,
): Promise<{ ok: boolean; error?: string }> {
  const plan = await getBrainProcessingPlan(userId, planId);
  if (!plan) return { ok: false, error: "not_found" };
  let recovery: Record<string, unknown> = { handledBy: "manual", handledAt: Date.now() };
  if (plan.recovery) {
    try {
      recovery = { ...JSON.parse(plan.recovery), ...recovery };
    } catch {
      /* 忽略 */
    }
  }
  await updateBrainProcessingPlan(userId, planId, {
    status: "rejected",
    recovery: JSON.stringify(recovery),
    failureReason: plan.failureReason ?? "（人工标记已处理）",
  });
  return { ok: true };
}

/** 重试应用：先补偿清理残留，再以用户已编辑的计划重新走原子写入。 */
export async function retryProcessingPlan(
  userId: string,
  planId: string,
): Promise<ApplyResult & { error?: string }> {
  const plan = await getBrainProcessingPlan(userId, planId);
  if (!plan) return { ok: false, error: "not_found", reason: "计划不存在", strategyIds: [], taskIds: [], reminderIds: [], plan: null };
  if (plan.status === "applied") {
    return { ok: false, error: "already_applied", reason: "计划已应用，无需重试", strategyIds: [], taskIds: [], reminderIds: [], plan };
  }
  const { rolledBack } = parseRecovery(plan);
  if (!rolledBack && (plan.noteId || (plan.reminderIds ?? []).length || (plan.taskIds ?? []).length)) {
    // 存在未回滚的部分产物，先补偿清理，避免重复产出
    const comp = await compensateProcessingPlan(userId, planId);
    if (!comp.ok) {
      return { ok: false, error: comp.error ?? "prerequisite_cleanup_failed", reason: "清理残留失败，无法重试", strategyIds: [], taskIds: [], reminderIds: [], plan };
    }
  }
  const edits: ProcessingEdits | null = plan.editsJson ? safeParse<ProcessingEdits>(plan.editsJson) : null;
  return applyProcessingPlan(userId, plan, edits);
}

function safeParse<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/** 计划清理策略（软归档，不硬删除审计记录）：
 * - pending_confirmation / failed / draft：永久保留，直到用户确认/拒绝/人工处理；
 * - applied：保留 180 天作为可追溯审计；
 * - rejected：保留 30 天。
 */
export async function cleanupProcessingPlans(userId: string): Promise<{ archived: string[]; skipped: number }> {
  const DAY = 86400_000;
  const now = Date.now();
  const plans = await listBrainProcessingPlans(userId, undefined, true);
  const archived: string[] = [];
  let skipped = 0;
  for (const p of plans) {
    if (p.archivedAt) continue;
    const age = now - p.createdAt;
    let shouldArchive = false;
    if (p.status === "applied" && age > 180 * DAY) shouldArchive = true;
    else if (p.status === "rejected" && age > 30 * DAY) shouldArchive = true;
    if (shouldArchive) {
      const ok = await updateBrainProcessingPlan(userId, p.id, { archivedAt: now });
      if (ok) archived.push(p.id);
      else skipped++;
    }
  }
  return { archived, skipped };
}

export type { NoteType, OrganizedNote };