// 第二大脑 · 收件箱确认处理：把收件箱条目（已 AI 整理、待确认）落库为正式资产。
// 核心契约：收起件箱先预览、确认后才写 brain_notes / brain_tasks / brain_strategies。
// 已整理结果(organized)在 POST /inbox 阶段已随条目存下，这里不再重复调用 LLM，只做落地 + 覆盖。

import type { OrganizedNote } from "./brain-organizer";
import { embed, buildListableText } from "./embedding";
import {
  insertBrainNote,
  updateBrainNote,
  insertBrainTasks,
  insertBrainStrategies,
  insertBrainReview,
  getBrainInboxItem,
  updateBrainInboxItem,
  getBrainNote,
  type BrainInboxItem,
  type BrainInboxIntent,
  type BrainTaskPriority,
} from "./brain-db";

const DAY_MS = 86400_000;

export type InboxProcessAction = "confirm" | "edit" | "dismiss";

export interface InboxOverrides {
  title?: string;
  category?: string;
  tags?: string[];
  intent?: string;
}

export interface InboxProcessResult {
  ok: boolean;
  action: "processed" | "dismissed";
  error?: string;
  noteId?: string;
  taskId?: string | null;
  createdTasks?: number;
  createdStrategies?: number;
}

function parseOrganized(s: string | null): Partial<OrganizedNote> | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v ? v : null;
  } catch {
    return null;
  }
}

async function embeddingFor(
  title: string,
  content: string,
  o: Partial<OrganizedNote> | null,
): Promise<string | null> {
  const vec = await embed(
    buildListableText({
      title,
      content: o?.codeContent || content,
      summary: o?.summary ?? "",
      tags: o?.tags ?? [],
    }),
  );
  return vec ? JSON.stringify(vec) : null;
}

function toPriority(p: unknown): BrainTaskPriority {
  return p === "high" || p === "low" ? p : "medium";
}

export interface ApplyInput {
  rawContent: string;
  title?: string;
  category?: string;
  tags?: string[];
  intent?: BrainInboxIntent;
  organized?: Partial<OrganizedNote> | null;
  overrides?: InboxOverrides;
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
  noteId?: string;
  createdTasks?: number;
  createdStrategies?: number;
}

/**
 * 把「已 AI 整理的原始内容」落库为正式笔记。
 * 决策 16：content 恒存用户原文，AI 改写(re-written)另存进 struct，绝不覆盖原文。
 * auto-apply（收录默认直接入库）与收件箱 confirm/edit 两条路径共用，避免逻辑分叉。
 */
export async function applyOrganizedToNote(
  userId: string,
  input: ApplyInput,
): Promise<ApplyResult> {
  const { rawContent, organized } = input;
  const intent: BrainInboxIntent =
    input.overrides?.intent &&
    ["note", "task", "meeting", "snippet", "project", "unknown"].includes(input.overrides.intent)
      ? (input.overrides.intent as BrainInboxIntent)
      : (input.intent ?? "note");

  const title = (input.overrides?.title?.trim() || input.title?.trim() || rawContent.slice(0, 50)).slice(0, 200);
  const category = input.overrides?.category?.trim() || input.category?.trim() || "未分类";
  const tags = input.overrides?.tags?.length ? input.overrides.tags : input.tags ?? [];

  const isSnippet = intent === "snippet";
  const language = isSnippet ? (organized?.language ?? null) : null;
  const codeContent = isSnippet ? (organized?.codeContent ?? rawContent) : null;
  // 用户手动改成 snippet 时兜底：给一段代码语言启发
  const snippetLanguage = isSnippet && !language && organized?.language ? organized.language : language;

  const note = await insertBrainNote(userId, {
    source: "text",
    title,
    content: rawContent, // 决策 16：原文永久保留；改写经 struct 存
    category,
    summary: organized?.summary ?? "",
    tags,
    related: organized?.related ?? [],
    isSnippet,
    language: snippetLanguage,
    codeContent,
    embedding: await embeddingFor(title, rawContent, organized ?? null),
    // 保留 AI 整理全量结果（含 rewritten / 参会人 / 策略等），刷新不丢
    struct: organized ? JSON.stringify(organized).slice(0, 20000) : null,
  });
  if (!note) return { ok: false, error: "note_create_failed" };

  // 与 /api/brain/notes 一致：初始复习记录（1 天后，完整 SM-2 结构）
  try {
    await insertBrainReview(userId, {
      noteId: note.id,
      nextReviewAt: new Date(Date.now() + DAY_MS).toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });
  } catch {
    /* 复习失败不阻断 */
  }

  let createdTasks = 0;
  let createdStrategies = 0;
  const actionItems = organized?.actionItems ?? [];
  const strategies = organized?.strategies ?? [];

  try {
    // 按意图落地关联资产
    if (intent === "meeting" || intent === "project") {
      // 会议/项目：策略 + 任务（含 strategyIndex 关联）
      let created: { id: string }[] = [];
      const strats = (strategies ?? []).slice(0, 8);
      if (strats.length) {
        created = await insertBrainStrategies(
          userId,
          strats.map((s) => ({ noteId: note.id, title: (s.title ?? "").slice(0, 200), description: s.description ?? "" })),
        );
        createdStrategies = created.length;
      }
      const tasks = (actionItems ?? []).slice(0, 12).map((t) => ({
        noteId: note.id,
        title: (t.text ?? "").slice(0, 40),
        dueDate: t.dueDate ?? null,
        priority: toPriority(t.priority),
        strategyId:
          typeof t.strategyIndex === "number" && t.strategyIndex >= 0 && t.strategyIndex < created.length
            ? created[t.strategyIndex].id
            : null,
      }));
      createdTasks = tasks.length;
      if (tasks.length) await insertBrainTasks(userId, tasks);
    } else if (intent === "task") {
      // 任务：无策略，直接建任务（有 actionItems 用其拆解，否则整条原文当作一个任务）
      const tasks =
        actionItems.length > 0
          ? actionItems.slice(0, 12).map((t) => ({
              noteId: note.id,
              title: (t.text ?? "").slice(0, 40),
              dueDate: t.dueDate ?? null,
              priority: toPriority(t.priority),
              strategyId: null,
            }))
          : [{ noteId: note.id, title: title.slice(0, 40), dueDate: null, priority: "medium" as BrainTaskPriority, strategyId: null }];
      createdTasks = tasks.length;
      await insertBrainTasks(userId, tasks);
    }
    // note / snippet / unknown：仅落笔记（不建任务/策略）
  } catch (err) {
    console.error("[inbox-process] create assets failed:", err);
  }

  return { ok: true, noteId: note.id, createdTasks, createdStrategies };
}

/**
 * 后台整理回写：笔记已先以原文快速落库（保存优先），AI 整理完成后
 * 用整理结果增强这条笔记（标题/分类/摘要/标签/struct/向量），并按意图补建任务/策略。
 * 与 applyOrganizedToNote 的资产落地逻辑保持一致，只是把「insert 笔记」换成「update 回写」。
 * 失败仅打日志——原文已保存，整理增强丢了不影响数据完整性，用户可手动重整理。
 */
export async function enrichNoteWithOrganized(
  userId: string,
  noteId: string,
  rawContent: string,
  organized: Partial<OrganizedNote>,
  intent: BrainInboxIntent,
): Promise<void> {
  const title = (organized.title || rawContent.slice(0, 50)).slice(0, 200);
  const category = organized.category || "未分类";
  const tags = organized.tags ?? [];
  const isSnippet = intent === "snippet";

  // P3#1：后台整理回写前先校验笔记仍然存在且尚未被 AI 整理过（struct 仍为空）。
  // ① 若用户在后台整理完成前删除了该笔记 → 直接中止，避免补建「孤儿」任务/策略；
  // ② 若已经 enrich 过（struct 非空）则视为幂等跳过，避免重复整理重复建任务。
  const existing = await getBrainNote(userId, noteId);
  if (!existing || existing.struct) return;

  try {
    const vec = await embed(
      buildListableText({ title, content: organized.codeContent || rawContent, summary: organized.summary ?? "", tags }),
    ).catch(() => null);
    await updateBrainNote(userId, noteId, {
      title,
      category,
      summary: organized.summary ?? "",
      tags,
      related: organized.related ?? [],
      isSnippet,
      language: isSnippet ? (organized.language ?? null) : null,
      codeContent: isSnippet ? (organized.codeContent ?? rawContent) : null,
      embedding: vec ? JSON.stringify(vec) : undefined,
      struct: JSON.stringify(organized).slice(0, 20000),
    });
  } catch (err) {
    console.error("[inbox-process] enrich note failed:", err);
    return;
  }

  // 按意图补建任务/策略（与 applyOrganizedToNote 同规则）
  try {
    let created: { id: string }[] = [];
    const strats = (organized.strategies ?? []).slice(0, 8);
    if ((intent === "meeting" || intent === "project") && strats.length) {
      created = await insertBrainStrategies(
        userId,
        strats.map((s) => ({ noteId, title: (s.title ?? "").slice(0, 200), description: s.description ?? "" })),
      );
    }
    const actionItems = organized.actionItems ?? [];
    if (intent === "meeting" || intent === "project" || intent === "task") {
      const tasks =
        actionItems.length > 0
          ? actionItems.slice(0, 12).map((t) => ({
              noteId,
              title: (t.text ?? "").slice(0, 40),
              dueDate: t.dueDate ?? null,
              priority: toPriority(t.priority),
              strategyId:
                intent !== "task" && typeof t.strategyIndex === "number" && t.strategyIndex >= 0 && t.strategyIndex < created.length
                  ? created[t.strategyIndex].id
                  : null,
            }))
          : intent === "task"
            ? [{ noteId, title: title.slice(0, 40), dueDate: null, priority: "medium" as BrainTaskPriority, strategyId: null }]
            : [];
      if (tasks.length) await insertBrainTasks(userId, tasks);
    }
  } catch (err) {
    console.error("[inbox-process] enrich assets failed:", err);
  }
}

/**
 * 处理一条收件箱条目（preview 确认队列，高级工具内可选保留）。
 * - dismiss → 仅标记 ignored（不落库）
 * - confirm / edit → 委托 applyOrganizedToNote 落库后标记 processed
 */
export async function processInboxItem(
  userId: string,
  itemId: string,
  action: InboxProcessAction,
  overrides: InboxOverrides = {},
): Promise<InboxProcessResult> {
  const item: BrainInboxItem | null = await getBrainInboxItem(userId, itemId);
  if (!item) return { ok: false, action: "processed", error: "not_found" };
  if (item.status !== "pending" && action !== "dismiss") {
    return { ok: false, action: "processed", error: "already_processed" };
  }

  // 忽略：不落库
  if (action === "dismiss") {
    await updateBrainInboxItem(userId, item.id, { status: "dismissed" });
    return { ok: true, action: "dismissed" };
  }

  const organized = parseOrganized(item.organized);
  const res = await applyOrganizedToNote(userId, {
    rawContent: item.rawContent,
    title: item.suggestedTitle ?? undefined,
    category: item.suggestedCategory ?? undefined,
    tags: item.suggestedTags ?? [],
    intent: item.intent ?? "note",
    organized,
    overrides,
  });
  if (!res.ok || !res.noteId) {
    return { ok: false, action: "processed", error: res.error ?? "apply_failed" };
  }

  await updateBrainInboxItem(userId, item.id, {
    status: "processed",
    noteId: res.noteId,
    taskId: null,
  });

  return {
    ok: true,
    action: "processed",
    noteId: res.noteId,
    taskId: null,
    createdTasks: res.createdTasks,
    createdStrategies: res.createdStrategies,
  };
}