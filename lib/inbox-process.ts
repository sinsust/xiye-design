// 第二大脑 · 收件箱确认处理：把收件箱条目（已 AI 整理、待确认）落库为正式资产。
// 核心契约：收起件箱先预览、确认后才写 brain_notes / brain_tasks / brain_strategies。
// 已整理结果(organized)在 POST /inbox 阶段已随条目存下，这里不再重复调用 LLM，只做落地 + 覆盖。

import type { OrganizedNote } from "./brain-organizer";
import { embed, buildListableText } from "./embedding";
import {
  insertBrainNote,
  insertBrainTasks,
  insertBrainStrategies,
  insertBrainReview,
  getBrainInboxItem,
  updateBrainInboxItem,
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

/**
 * 处理一条收件箱条目。
 * - dismiss → 仅标记 ignored（不落库）
 * - confirm / edit → 按 intent 落库（note / ticketing task / meeting / snippet / project），
 *   覆盖项(overrides)可改标题/分类/标签/意图。
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
  const intent: BrainInboxIntent = (
    overrides.intent &&
    ["note", "task", "meeting", "snippet", "project", "unknown"].includes(overrides.intent)
      ? overrides.intent
      : item.intent ?? "note"
  ) as BrainInboxIntent;

  const title = (overrides.title?.trim() || item.suggestedTitle || item.rawContent.slice(0, 50)).slice(0, 200);
  const category = overrides.category?.trim() || item.suggestedCategory || "未分类";
  const tags = overrides.tags?.length ? overrides.tags : item.suggestedTags;

  const isSnippet = intent === "snippet";
  const language = isSnippet ? (organized?.language ?? null) : null;
  const codeContent = isSnippet ? (organized?.codeContent ?? item.rawContent) : null;
  // 用户手动改成 snippet 时兜底：给一段代码语言启发
  const snippetLanguage = isSnippet && !language && organized?.language ? organized.language : language;

  const note = await insertBrainNote(userId, {
    source: "text",
    title,
    content: organized?.rewritten || item.rawContent,
    category,
    summary: organized?.summary ?? "",
    tags,
    related: organized?.related ?? [],
    isSnippet,
    language: snippetLanguage,
    codeContent,
    embedding: await embeddingFor(title, item.rawContent, organized),
    // 保留 AI 整理全量结果，刷新不丢
    struct: item.organized?.slice(0, 20000) ?? null,
  });
  if (!note) return { ok: false, action: "processed", error: "note_create_failed" };

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
    } else {
      // note / snippet / unknown：仅落笔记（不建任务/策略）
      createdTasks = 0;
      createdStrategies = 0;
    }
  } catch (err) {
    console.error("[inbox-process] create assets failed:", err);
  }

  await updateBrainInboxItem(userId, item.id, {
    status: "processed",
    noteId: note.id,
    taskId: null,
  });

  return {
    ok: true,
    action: "processed",
    noteId: note.id,
    taskId: null,
    createdTasks,
    createdStrategies,
  };
}