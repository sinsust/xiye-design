// 第二大脑 · ima 深度集成核心：把 ima 原文跑完整 AI 整理管线后落库。
// 目标：ima 导入的笔记与手动录入完全平等 —— 分类/标签/摘要/任务/策略/代码识别，全流程参与。
// 整理失败时降级：保留原文直接落库，category="未分类"，绝不阻断导入。

import { organizeNote, classifyInput, type OrganizedNote } from "./brain-organizer";
import { embed, buildListableText } from "./embedding";
import {
  insertBrainNote,
  insertBrainTasks,
  insertBrainStrategies,
  insertBrainReview,
  updateBrainNote,
  listBrainNotes,
  type BrainNote,
} from "./brain-db";

export interface ImaImportInput {
  content: string;
  title: string;
  // ima 来源文档标识（用于增量同步去重）
  mediaId?: string;
  // 来源知识库名称（透传展示，不落库）
  kbName?: string;
}

export interface ImaImportResult {
  note: BrainNote | null;
  degraded: boolean;
  createdTasks: number;
  createdStrategies: number;
}

const DAY_MS = 86400_000;
type OrganizedLike = Pick<
  OrganizedNote,
  | "title"
  | "category"
  | "type"
  | "summary"
  | "tags"
  | "related"
  | "isSnippet"
  | "language"
  | "codeContent"
  | "rewritten"
  | "actionItems"
  | "strategies"
  | "source"
  | "keyPoints"
  | "insights"
>;

/**
 * 跑 AI 整理管线；失败时返回启发式兜底结构并标记 degraded。
 * organized 一定是可用的（organizeNote 内部有启发式兜底，此 try/catch 仅防御）。
 */
async function runOrganize(
  content: string,
  existing: BrainNote[],
  title: string,
): Promise<{ organized: OrganizedLike; degraded: boolean }> {
  try {
    const organized = await organizeNote(content, existing);
    return { organized, degraded: false };
  } catch {
    return {
      organized: {
        title,
        category: "未分类",
        type: classifyInput(content),
        summary: "",
        tags: [],
        related: [],
        isSnippet: false,
        language: "",
        codeContent: "",
        rewritten: "",
        actionItems: [],
        strategies: [],
        source: "",
        keyPoints: [],
        insights: [],
      },
      degraded: true,
    };
  }
}

/** 拼接 embedding 文本并生成语义向量（失败返回 null，检索自动降级）。 */
async function embeddingFor(
  title: string,
  content: string,
  organized: OrganizedLike,
): Promise<string | null> {
  const vec = await embed(
    buildListableText({
      title,
      content: organized.codeContent || content,
      summary: organized.summary ?? "",
      tags: organized.tags ?? [],
    }),
  );
  return vec ? JSON.stringify(vec) : null;
}

/**
 * 新建一条 ima 笔记：organize → 落库 → 策略 → 任务 → 初始复习记录。
 * 供「单篇导入 POST /api/brain/ima」与「增量同步新建」复用。
 */
export async function importImaNote(
  userId: string,
  input: ImaImportInput,
): Promise<ImaImportResult> {
  const content = input.content?.trim() || input.title;
  // 关联建议用用户已有笔记
  const existing = await listBrainNotes(userId);
  const { organized, degraded } = await runOrganize(content, existing, input.title);
  // 深度重写：有规范化正文则作为入库正文（导入即规范）
  const noteContent = organized.rewritten || content;

  const note = await insertBrainNote(userId, {
    source: "ima",
    content: noteContent,
    title: organized.title || input.title || "未命名 ima 资料",
    category: organized.category || (degraded ? "未分类" : ""),
    summary: organized.summary ?? "",
    tags: organized.tags ?? [],
    related: organized.related ?? [],
    isSnippet: organized.isSnippet === true,
    language: organized.language || null,
    codeContent: organized.codeContent || null,
    embedding: await embeddingFor(input.title, noteContent, organized),
    imaDocId: input.mediaId ?? null,
    imaSyncedAt: new Date().toISOString(),
    // 完整结构化结果随笔记落库，导入即规范、刷新不丢
    struct: JSON.stringify(organized).slice(0, 20000),
  });
  if (!note) return { note: null, degraded, createdTasks: 0, createdStrategies: 0 };

  // 策略落库；任务按 strategyIndex 关联（下标对应下方创建返回的顺序）
  let createdStrategies: { id: string }[] = [];
  try {
    const strats = (organized.strategies ?? []).slice(0, 8);
    if (strats.length) {
      createdStrategies = await insertBrainStrategies(
        userId,
        strats.map((s) => ({
          noteId: note.id,
          title: s.title.slice(0, 200),
          description: s.description ?? "",
        })),
      );
    }
  } catch (err) {
    console.error("[ima-brain] insert strategies failed:", err);
  }

  let createdTasks = 0;
  try {
    const items = (organized.actionItems ?? []).slice(0, 12);
    if (items.length) {
      const tasks = items.map((t) => ({
        noteId: note.id,
        title: t.text.slice(0, 40),
        dueDate: t.dueDate ?? null,
        priority: (t.priority === "high" || t.priority === "low" ? t.priority : "medium") as "high" | "medium" | "low",
        strategyId:
          typeof t.strategyIndex === "number" &&
          t.strategyIndex >= 0 &&
          t.strategyIndex < createdStrategies.length
            ? createdStrategies[t.strategyIndex].id
            : null,
      }));
      createdTasks = tasks.length;
      await insertBrainTasks(userId, tasks);
    }
  } catch (err) {
    console.error("[ima-brain] insert tasks failed:", err);
  }

  // 与 /api/brain/notes 一致：初始复习记录（1 天后，完整 SM-2 结构：interval/easeFactor/reviewCount）
  try {
    await insertBrainReview(userId, {
      noteId: note.id,
      nextReviewAt: new Date(Date.now() + DAY_MS).toISOString(),
      interval: 1,
      easeFactor: 2.5,
      reviewCount: 0,
    });
  } catch (err) {
    console.error("[ima-brain] insert review failed:", err);
  }

  return { note, degraded, createdTasks, createdStrategies: createdStrategies.length };
}

/**
 * ima 文档已存在且可能被更新 → 重排整理并刷新字段（不重复建任务/策略/复习）。
 * content 未变则仅刷新同步时间并返回 changed=false（用于统计 skipped）。
 */
export async function updateImaNote(
  userId: string,
  note: BrainNote,
  input: ImaImportInput,
): Promise<{ note: BrainNote | null; changed: boolean }> {
  const content = input.content?.trim() || input.title;
  const existing = await listBrainNotes(userId);
  const { organized, degraded } = await runOrganize(content, existing, input.title);
  const noteContent = organized.rewritten || content;

  if (note.content === content && !degraded) {
    await updateBrainNote(userId, note.id, { imaSyncedAt: new Date().toISOString() });
    return { note, changed: false };
  }

  const updated = await updateBrainNote(userId, note.id, {
    title: organized.title || input.title || note.title,
    content: noteContent,
    category: organized.category || (degraded ? "未分类" : note.category),
    summary: organized.summary ?? note.summary,
    tags: organized.tags ?? note.tags,
    codeContent: organized.codeContent ?? note.codeContent,
    embedding: (await embeddingFor(input.title, noteContent, organized)) ?? note.embedding,
    imaSyncedAt: new Date().toISOString(),
    struct: JSON.stringify(organized).slice(0, 20000),
  });
  return { note: updated, changed: true };
}