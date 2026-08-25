// 第二大脑（Second Brain）数据访问层：用户私有的个人知识笔记读写。
// 与 knowledge-db（云端共享技能库）不同，这里按 userId 硬隔离，仅本人可见。

import { db, brainNotes, brainTasks, brainReviews, brainStrategies, brainImaSyncLog } from "@/lib/db";
import { eq, and, desc, isNull } from "drizzle-orm";

export type BrainSource = "text" | "file" | "clip" | "voice" | "ima";

export type BrainTaskStatus = "todo" | "in_progress" | "done";
export type BrainTaskPriority = "high" | "medium" | "low";

export interface BrainTask {
  id: string;
  userId: string;
  noteId: string;
  title: string;
  status: BrainTaskStatus;
  dueDate: string | null;
  priority: BrainTaskPriority;
  createdAt: number;
  completedAt: number | null;
  // 归档标记：来源笔记被复习后，done 任务自动归档（看板隐藏、库内保留）
  archived: boolean;
  // 关联策略（可选），删除策略时置空
  strategyId: string | null;
}

export interface BrainNote {
  id: string;
  userId: string;
  source: BrainSource;
  title: string;
  // 原始正文，用户"只管往里扔"的未经整理内容
  content: string;
  // AI 整理结果
  category: string;
  summary: string;
  tags: string[];
  // 关联建议：其他笔记 id（已入库）或标题（尚未入库的下游可解析）
  related: string[];
  // 版本链：parentId 指向上一版本笔记，null 表示初版
  parentId: string | null;
  // 版本号，从 1 递增
  version: number;
  // 0=当前有效版本，1=已被更高版本取代（归档）
  superseded: boolean;
  // 代码片段标记与编程语言 / 原始代码
  isSnippet: boolean;
  language: string | null;
  codeContent: string | null;
  // 语义向量（384 维 JSON 字符串），null 表示未生成（检索降级为关键词）
  embedding: string | null;
  // ima 增量同步：来源文档唯一标识 + 最近一次同步时间
  imaDocId: string | null;
  imaSyncedAt: string | null;
  createdAt: number;
  updatedAt: number;
}

interface BrainRow {
  id: string;
  userId: string;
  source: string;
  title: string | null;
  content: string;
  category: string | null;
  summary: string | null;
  tags: string | null;
  related: string | null;
  parentId: string | null;
  version: number | null;
  superseded: number | null;
  isSnippet: number | null;
  language: string | null;
  codeContent: string | null;
  embedding: string | null;
  imaDocId: string | null;
  imaSyncedAt: string | null;
  createdAt: number;
  updatedAt: number;
}

function splitList(v: string | null): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function toNote(r: BrainRow): BrainNote {
  return {
    id: r.id,
    userId: r.userId,
    source: (r.source || "text") as BrainSource,
    title: r.title ?? "",
    content: r.content,
    category: r.category ?? "",
    summary: r.summary ?? "",
    tags: splitList(r.tags),
    related: splitList(r.related),
    parentId: r.parentId ?? null,
    version: Number(r.version ?? 1),
    superseded: (r.superseded ?? 0) === 1,
    isSnippet: (r.isSnippet ?? 0) === 1,
    language: r.language ?? null,
    codeContent: r.codeContent ?? null,
    embedding: r.embedding ?? null,
    imaDocId: r.imaDocId ?? null,
    imaSyncedAt: r.imaSyncedAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 用户私有的全部笔记，按创建时间倒序。 */
export async function listBrainNotes(userId: string): Promise<BrainNote[]> {
  try {
    const rows = (await db
      .select()
      .from(brainNotes)
      .where(eq(brainNotes.userId, userId))
      .orderBy(desc(brainNotes.createdAt))) as BrainRow[];
    return rows.map(toNote);
  } catch (err) {
    console.error("[brain-db] list failed:", err);
    return [];
  }
}

export async function getBrainNote(
  userId: string,
  id: string,
): Promise<BrainNote | null> {
  try {
    const rows = (await db
      .select()
      .from(brainNotes)
      .where(and(eq(brainNotes.id, id), eq(brainNotes.userId, userId)))) as BrainRow[];
    return rows[0] ? toNote(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get failed:", err);
    return null;
  }
}

export type NewBrainNote = {
  source: BrainSource;
  title?: string;
  content: string;
  category?: string;
  summary?: string;
  tags?: string[];
  related?: string[];
  // 版本链 / 代码片段字段（可选，供升级与片段识别使用）
  parentId?: string | null;
  version?: number;
  superseded?: boolean;
  isSnippet?: boolean;
  language?: string | null;
  codeContent?: string | null;
  // 语义向量（JSON 字符串）；可选，供落库/回填写入
  embedding?: string | null;
  // ima 增量同步字段
  imaDocId?: string | null;
  imaSyncedAt?: string | null;
};

export async function insertBrainNote(
  userId: string,
  row: NewBrainNote,
): Promise<BrainNote> {
  const now = Date.now();
  const id = `bn-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(brainNotes).values({
    id,
    userId,
    source: row.source,
    title: row.title ?? null,
    content: row.content,
    category: row.category ?? null,
    summary: row.summary ?? null,
    tags: row.tags?.length ? JSON.stringify(row.tags) : null,
    related: row.related?.length ? JSON.stringify(row.related) : null,
    parentId: row.parentId ?? null,
    version: row.version ?? 1,
    superseded: row.superseded ? 1 : 0,
    isSnippet: row.isSnippet ? 1 : 0,
    language: row.language ?? null,
    codeContent: row.codeContent ?? null,
    embedding: row.embedding ?? null,
    imaDocId: row.imaDocId ?? null,
    imaSyncedAt: row.imaSyncedAt ?? null,
    createdAt: now,
    updatedAt: now,
  });
  const inserted = await getBrainNote(userId, id);
  return inserted ?? {
    id,
    userId,
    source: row.source,
    title: row.title ?? "",
    content: row.content,
    category: row.category ?? "",
    summary: row.summary ?? "",
    tags: row.tags ?? [],
    related: row.related ?? [],
    parentId: row.parentId ?? null,
    version: row.version ?? 1,
    superseded: row.superseded ?? false,
    isSnippet: row.isSnippet ?? false,
    language: row.language ?? null,
    codeContent: row.codeContent ?? null,
    embedding: row.embedding ?? null,
    imaDocId: row.imaDocId ?? null,
    imaSyncedAt: row.imaSyncedAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export type UpdateBrainNote = Partial<
  Pick<
    NewBrainNote,
    | "title"
    | "content"
    | "category"
    | "summary"
    | "tags"
    | "related"
    | "embedding"
    | "imaSyncedAt"
    | "codeContent"
  >
>;

export async function updateBrainNote(
  userId: string,
  id: string,
  patch: UpdateBrainNote,
): Promise<BrainNote | null> {
  const set: Record<string, unknown> = {
    title: patch.title ?? undefined,
    content: patch.content ?? undefined,
    category: patch.category ?? undefined,
    summary: patch.summary ?? undefined,
    tags: patch.tags ? JSON.stringify(patch.tags) : patch.tags === undefined ? undefined : null,
    related: patch.related ? JSON.stringify(patch.related) : patch.related === undefined ? undefined : null,
    embedding: patch.embedding === undefined ? undefined : (patch.embedding ?? null),
    imaSyncedAt: patch.imaSyncedAt === undefined ? undefined : (patch.imaSyncedAt ?? null),
    codeContent: patch.codeContent === undefined ? undefined : (patch.codeContent ?? null),
    updatedAt: Date.now(),
  };
  for (const k of Object.keys(set)) {
    if (set[k] === undefined) delete set[k];
  }
  await db
    .update(brainNotes)
    .set(set)
    .where(and(eq(brainNotes.id, id), eq(brainNotes.userId, userId)));
  return getBrainNote(userId, id);
}

export async function deleteBrainNote(userId: string, id: string): Promise<boolean> {
  try {
    await db
      .delete(brainNotes)
      .where(and(eq(brainNotes.id, id), eq(brainNotes.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] delete failed:", err);
    return false;
  }
}

// ---------- 任务看板 ----------

interface TaskRow {
  id: string;
  userId: string;
  noteId: string;
  title: string | null;
  status: string | null;
  dueDate: string | null;
  priority: string | null;
  createdAt: number;
  completedAt: number | null;
  archived: number | null;
  strategyId: string | null;
}

function toTask(r: TaskRow): BrainTask {
  return {
    id: r.id,
    userId: r.userId,
    noteId: r.noteId,
    title: r.title ?? "",
    status: (r.status ?? "todo") as BrainTaskStatus,
    dueDate: r.dueDate,
    priority: (r.priority ?? "medium") as BrainTaskPriority,
    createdAt: r.createdAt,
    completedAt: r.completedAt ?? null,
    archived: r.archived === 1,
    strategyId: r.strategyId ?? null,
  };
}

/** 用户全部任务，按创建倒序；可选按状态过滤。归档任务不返回。 */
export async function listBrainTasks(
  userId: string,
  status?: BrainTaskStatus,
): Promise<BrainTask[]> {
  try {
    let q = db
      .select()
      .from(brainTasks)
      .where(and(eq(brainTasks.userId, userId), eq(brainTasks.archived, 0)));
    if (status) q = q.where(eq(brainTasks.status, status));
    const rows = (await q.orderBy(desc(brainTasks.createdAt))) as TaskRow[];
    return rows.map(toTask);
  } catch (err) {
    console.error("[brain-db] list tasks failed:", err);
    return [];
  }
}

/** 某条笔记下的任务。 */
export async function listBrainTasksByNote(
  userId: string,
  noteId: string,
): Promise<BrainTask[]> {
  try {
    const rows = (await db
      .select()
      .from(brainTasks)
      .where(
        and(eq(brainTasks.noteId, noteId), eq(brainTasks.userId, userId)),
      )) as TaskRow[];
    return rows.map(toTask);
  } catch (err) {
    console.error("[brain-db] list note tasks failed:", err);
    return [];
  }
}

export type NewBrainTask = {
  noteId: string;
  title: string;
  status?: BrainTaskStatus;
  dueDate?: string | null;
  priority?: BrainTaskPriority;
  strategyId?: string | null;
};

export async function insertBrainTasks(
  userId: string,
  items: NewBrainTask[],
): Promise<BrainTask[]> {
  const now = Date.now();
  const inserted: BrainTask[] = [];
  for (const item of items) {
    const id = `bt-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await db.insert(brainTasks).values({
        id,
        userId,
        noteId: item.noteId,
        title: item.title,
        status: item.status ?? "todo",
        dueDate: item.dueDate ?? null,
        priority: item.priority ?? "medium",
        createdAt: now,
        completedAt: null,
        strategyId: item.strategyId ?? null,
      });
      inserted.push({
        id,
        userId,
        noteId: item.noteId,
        title: item.title,
        status: item.status ?? "todo",
        dueDate: item.dueDate ?? null,
        priority: item.priority ?? "medium",
        createdAt: now,
        completedAt: null,
        archived: false,
        strategyId: item.strategyId ?? null,
      });
    } catch (err) {
      console.error("[brain-db] insert task failed:", err);
    }
  }
  return inserted;
}

export async function updateBrainTask(
  userId: string,
  id: string,
  patch: { status?: BrainTaskStatus; dueDate?: string | null },
): Promise<BrainTask | null> {
  try {
    const set: Record<string, unknown> = { ...patch, ...(patch.status ? { completedAt: patch.status === "done" ? Date.now() : null } : {}) };
    if (set.dueDate === "" || set.dueDate === undefined) set.dueDate = null;
    await db
      .update(brainTasks)
      .set(set)
      .where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)));
    const rows = (await db
      .select()
      .from(brainTasks)
      .where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)))) as TaskRow[];
    return rows[0] ? toTask(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] update task failed:", err);
    return null;
  }
}

export async function deleteBrainTask(userId: string, id: string): Promise<boolean> {
  try {
    await db.delete(brainTasks).where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] delete task failed:", err);
    return false;
  }
}

/** 笔记被复习后，其 done 任务自动归档（看板隐藏、库内保留）。 */
export async function archiveDoneTasksForNote(
  userId: string,
  noteId: string,
): Promise<boolean> {
  try {
    await db
      .update(brainTasks)
      .set({ archived: 1 })
      .where(
        and(
          eq(brainTasks.noteId, noteId),
          eq(brainTasks.userId, userId),
          eq(brainTasks.status, "done"),
        ),
      );
    return true;
  } catch (err) {
    console.error("[brain-db] archive tasks failed:", err);
    return false;
  }
}

// ---------- 间隔复习（遗忘曲线） ----------

export type BrainReviewStatus = "pending" | "reviewed" | "skipped";

export interface BrainReview {
  id: string;
  noteId: string;
  userId: string;
  // 下次复习时间（ISO 字符串）
  nextReviewAt: string;
  // 间隔天数
  interval: number;
  // 熟练度系数（SM-2 ease factor）
  easeFactor: number;
  status: BrainReviewStatus;
  reviewCount: number;
  createdAt: number;
}

export type NewBrainReview = {
  noteId: string;
  nextReviewAt: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
};

interface ReviewRow {
  id: string;
  noteId: string;
  userId: string;
  nextReviewAt: string;
  interval: number;
  easeFactor: number;
  status: string;
  reviewCount: number;
  createdAt: number;
}

function toReview(r: ReviewRow): BrainReview {
  return {
    id: r.id,
    noteId: r.noteId,
    userId: r.userId,
    nextReviewAt: r.nextReviewAt,
    interval: Number(r.interval ?? 1),
    easeFactor: Number(r.easeFactor ?? 2.5),
    status: (r.status ?? "pending") as BrainReviewStatus,
    reviewCount: Number(r.reviewCount ?? 0),
    createdAt: r.createdAt,
  };
}

export async function getBrainReview(
  userId: string,
  id: string,
): Promise<BrainReview | null> {
  try {
    const rows = (await db
      .select()
      .from(brainReviews)
      .where(and(eq(brainReviews.id, id), eq(brainReviews.userId, userId)))) as ReviewRow[];
    return rows[0] ? toReview(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get review failed:", err);
    return null;
  }
}

export async function insertBrainReview(
  userId: string,
  row: NewBrainReview,
): Promise<BrainReview> {
  const now = Date.now();
  const id = `br-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.insert(brainReviews).values({
    id,
    noteId: row.noteId,
    userId,
    nextReviewAt: row.nextReviewAt,
    interval: row.interval,
    easeFactor: row.easeFactor,
    status: "pending",
    reviewCount: row.reviewCount,
    createdAt: now,
  });
  const inserted = await getBrainReview(userId, id);
  return inserted ?? {
    id,
    noteId: row.noteId,
    userId,
    nextReviewAt: row.nextReviewAt,
    interval: row.interval,
    easeFactor: row.easeFactor,
    status: "pending" as BrainReviewStatus,
    reviewCount: row.reviewCount,
    createdAt: now,
  };
}

/** 当前用户全部"待复习(pending)"记录，按下次时间升序。 */
export async function listPendingBrainReviews(userId: string): Promise<BrainReview[]> {
  try {
    const rows = (await db
      .select()
      .from(brainReviews)
      .where(eq(brainReviews.userId, userId))) as ReviewRow[];
    return rows
      .filter((r) => (r.status ?? "pending") === "pending")
      .map(toReview)
      .sort((a, b) => a.nextReviewAt.localeCompare(b.nextReviewAt));
  } catch (err) {
    console.error("[brain-db] list reviews failed:", err);
    return [];
  }
}

export async function updateBrainReviewStatus(
  userId: string,
  id: string,
  status: BrainReviewStatus,
): Promise<boolean> {
  try {
    await db
      .update(brainReviews)
      .set({ status })
      .where(and(eq(brainReviews.id, id), eq(brainReviews.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] update review failed:", err);
    return false;
  }
}

const DAY_MS = 86400_000;
const MAX_EASE = 3.0;

/**
 * 标记一条待复习记录为"已复习"，按 SM-2 计算新的间隔与熟练度：
 * newInterval = round(interval × easeFactor)；easeFactor += 0.1（上限 3.0）。
 * 生成下一条复习记录；同时把该笔记下 done 任务归档。
 * 返回新生成的待复习记录；记录不存在或非 pending 时返回 null。
 */
export async function completeBrainReview(
  userId: string,
  id: string,
): Promise<BrainReview | null> {
  const cur = await getBrainReview(userId, id);
  if (!cur || cur.status !== "pending") return null;
  const newInterval = Math.max(1, Math.round(cur.interval * cur.easeFactor));
  const newEase = Math.min(MAX_EASE, +(cur.easeFactor + 0.1).toFixed(2));
  await updateBrainReviewStatus(userId, id, "reviewed");
  await archiveDoneTasksForNote(userId, cur.noteId);
  return insertBrainReview(userId, {
    noteId: cur.noteId,
    nextReviewAt: new Date(Date.now() + newInterval * DAY_MS).toISOString(),
    interval: newInterval,
    easeFactor: newEase,
    reviewCount: cur.reviewCount + 1,
  });
}

/** 跳过一条待复习记录（顺延到明天，间隔/熟练度不变），返回新生成的待复习记录。 */
export async function skipBrainReview(
  userId: string,
  id: string,
): Promise<BrainReview | null> {
  const cur = await getBrainReview(userId, id);
  if (!cur || cur.status !== "pending") return null;
  await updateBrainReviewStatus(userId, id, "skipped");
  return insertBrainReview(userId, {
    noteId: cur.noteId,
    nextReviewAt: new Date(Date.now() + DAY_MS).toISOString(),
    interval: cur.interval,
    easeFactor: cur.easeFactor,
    reviewCount: cur.reviewCount,
  });
}

// ---------- 策略管理 ----------

export type BrainStrategyStatus = "active" | "paused" | "achieved" | "abandoned";

export interface BrainStrategy {
  id: string;
  userId: string;
  noteId: string;
  title: string;
  description: string;
  status: BrainStrategyStatus;
  createdAt: number;
  updatedAt: number;
}

export type NewBrainStrategy = {
  noteId: string;
  title: string;
  description?: string;
  status?: BrainStrategyStatus;
};

interface StrategyRow {
  id: string;
  userId: string;
  noteId: string;
  title: string | null;
  description: string | null;
  status: string | null;
  createdAt: number;
  updatedAt: number;
}

function toStrategy(r: StrategyRow): BrainStrategy {
  return {
    id: r.id,
    userId: r.userId,
    noteId: r.noteId,
    title: r.title ?? "",
    description: r.description ?? "",
    status: (r.status ?? "active") as BrainStrategyStatus,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 用户全部策略，按创建倒序；可选按状态过滤。 */
export async function listBrainStrategies(
  userId: string,
  status?: BrainStrategyStatus,
): Promise<BrainStrategy[]> {
  try {
    let q = db
      .select()
      .from(brainStrategies)
      .where(eq(brainStrategies.userId, userId));
    if (status) q = q.where(eq(brainStrategies.status, status));
    const rows = (await q.orderBy(desc(brainStrategies.createdAt))) as StrategyRow[];
    return rows.map(toStrategy);
  } catch (err) {
    console.error("[brain-db] list strategies failed:", err);
    return [];
  }
}

export async function getBrainStrategy(
  userId: string,
  id: string,
): Promise<BrainStrategy | null> {
  try {
    const rows = (await db
      .select()
      .from(brainStrategies)
      .where(and(eq(brainStrategies.id, id), eq(brainStrategies.userId, userId)))) as StrategyRow[];
    return rows[0] ? toStrategy(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get strategy failed:", err);
    return null;
  }
}

export async function insertBrainStrategies(
  userId: string,
  items: NewBrainStrategy[],
): Promise<BrainStrategy[]> {
  const now = Date.now();
  const inserted: BrainStrategy[] = [];
  for (const item of items) {
    const id = `bs-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await db.insert(brainStrategies).values({
        id,
        userId,
        noteId: item.noteId,
        title: item.title,
        description: item.description ?? null,
        status: item.status ?? "active",
        createdAt: now,
        updatedAt: now,
      });
      const created = await getBrainStrategy(userId, id);
      if (created) inserted.push(created);
    } catch (err) {
      console.error("[brain-db] insert strategy failed:", err);
    }
  }
  return inserted;
}

/** 更新策略状态/标题/描述。 */
export async function updateBrainStrategy(
  userId: string,
  id: string,
  patch: {
    status?: BrainStrategyStatus;
    title?: string;
    description?: string;
  },
): Promise<BrainStrategy | null> {
  try {
    const set: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.status) set.status = patch.status;
    if (patch.title !== undefined) set.title = patch.title;
    if (patch.description !== undefined) set.description = patch.description;
    await db
      .update(brainStrategies)
      .set(set)
      .where(and(eq(brainStrategies.id, id), eq(brainStrategies.userId, userId)));
    return getBrainStrategy(userId, id);
  } catch (err) {
    console.error("[brain-db] update strategy failed:", err);
    return null;
  }
}

/** 删除策略：先将其关联任务的 strategyId 置空（不删除任务），再删除策略。 */
export async function deleteBrainStrategy(userId: string, id: string): Promise<boolean> {
  try {
    await db
      .update(brainTasks)
      .set({ strategyId: null })
      .where(and(eq(brainTasks.strategyId, id), eq(brainTasks.userId, userId)));
    await db
      .delete(brainStrategies)
      .where(and(eq(brainStrategies.id, id), eq(brainStrategies.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] delete strategy failed:", err);
    return false;
  }
}

// ---------- ima 增量同步日志 ----------

/** 追加一条同步日志（每次同步的最新一条用于「最近同步」展示）。 */
export async function insertBrainImaSyncLog(
  userId: string,
  entry: {
    syncedAt: string;
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    status: "success" | "partial" | "failed";
    failures?: { title: string; reason: string }[];
  },
): Promise<void> {
  const now = Date.now();
  const id = `bsl-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await db.insert(brainImaSyncLog).values({
      id,
      userId,
      syncedAt: entry.syncedAt,
      total: entry.total,
      created: entry.created,
      updated: entry.updated,
      skipped: entry.skipped,
      failed: entry.failed,
      status: entry.status,
      failures: JSON.stringify(entry.failures ?? []),
    });
  } catch (err) {
    console.error("[brain-db] insert ima sync log failed:", err);
  }
}

export interface BrainImaSyncLogEntry {
  id: string;
  syncedAt: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: "success" | "partial" | "failed";
  failures: { title: string; reason: string }[];
}

interface SyncLogRow {
  id: string;
  syncedAt: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  status: string;
  failures: string;
}

/** 该用户最近的同步日志（默认 1 条，用于「最近同步时间 + 状态 + 结果摘要」）。 */
export async function listBrainImaSyncLogs(
  userId: string,
  limit = 5,
): Promise<BrainImaSyncLogEntry[]> {
  try {
    const rows = (await db
      .select()
      .from(brainImaSyncLog)
      .where(eq(brainImaSyncLog.userId, userId))
      .orderBy(desc(brainImaSyncLog.syncedAt))
      .limit(limit)) as SyncLogRow[];
    return rows.map((r) => ({
      id: r.id,
      syncedAt: r.syncedAt,
      total: Number(r.total ?? 0),
      created: Number(r.created ?? 0),
      updated: Number(r.updated ?? 0),
      skipped: Number(r.skipped ?? 0),
      failed: Number(r.failed ?? 0),
      status: (r.status ?? "success") as "success" | "partial" | "failed",
      failures: (() => {
        try {
          const v = JSON.parse(r.failures ?? "[]");
          return Array.isArray(v) ? v : [];
        } catch {
          return [];
        }
      })(),
    }));
  } catch (err) {
    console.error("[brain-db] list ima sync logs failed:", err);
    return [];
  }
}

// ---------- 版本演化 ----------

/** 把某条笔记标记为"已被取代"（归档）。 */
export async function markBrainNoteSuperseded(
  userId: string,
  id: string,
): Promise<boolean> {
  try {
    await db
      .update(brainNotes)
      .set({ superseded: 1, updatedAt: Date.now() })
      .where(and(eq(brainNotes.id, id), eq(brainNotes.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] mark superseded failed:", err);
    return false;
  }
}

/**
 * 升级一条笔记为新版本（不覆盖旧版，旧版标记 superseded=1 归档）。
 * 新版本继承旧版的 related / strategyId（任务）/ 复习记录，并接入同一版本链。
 * 返回影响版本链的说明（invoked: 是否确实发生了版本升级）。
 */
export async function upgradeBrainNote(
  userId: string,
  oldNoteId: string,
  patch: {
    title?: string;
    content?: string;
    category?: string;
    summary?: string;
    tags?: string[];
    isSnippet?: boolean;
    language?: string | null;
    codeContent?: string | null;
  },
): Promise<{ note: BrainNote | null; invoked: boolean }> {
  const old = await getBrainNote(userId, oldNoteId);
  if (!old) return { note: null, invoked: false };

  const now = Date.now();
  const newId = `bn-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  // 继承旧版的基础信息与归属：父版本指向旧版本身，版本号 = 旧版 + 1
  const inheritedParent = old.parentId ?? old.id;
  const newNote: NewBrainNote = {
    source: old.source,
    title: patch.title !== undefined ? patch.title : old.title,
    // 无明确 content 时沿用旧版正文（形成可追溯的新快照）
    content: patch.content !== undefined ? patch.content : old.content,
    category: patch.category !== undefined ? patch.category : old.category,
    summary: patch.summary !== undefined ? patch.summary : old.summary,
    tags: patch.tags !== undefined ? patch.tags : old.tags,
    related: old.related,
    parentId: inheritedParent,
    version: old.version + 1,
    superseded: false,
    isSnippet: patch.isSnippet !== undefined ? patch.isSnippet : old.isSnippet,
    language: patch.language !== undefined ? patch.language : old.language,
    codeContent: patch.codeContent !== undefined ? patch.codeContent : old.codeContent,
    // 新版本内容已变化，向量置空，由落库流程重新生成
    embedding: null,
    // 版本演化仍是同一 ima 来源文档，保留 imaDocId 以便增量同步去重
    imaDocId: old.imaDocId,
    imaSyncedAt: old.imaSyncedAt,
  };
  const created = await insertBrainNote(userId, newNote);
  // 旧版归档
  await markBrainNoteSuperseded(userId, old.id);
  return { note: created, invoked: true };
}

/** 版本链：从某条笔记沿 parentId 向上追溯到初版，按版本号升序返回。 */
export async function listNoteVersions(
  userId: string,
  id: string,
): Promise<BrainNote[]> {
  try {
    const all = await listBrainNotes(userId);
    const byId = new Map(all.map((n) => [n.id, n]));
    const chain: BrainNote[] = [];
    let cur = byId.get(id) ?? null;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur); // 从最新向前回溯，插入头部得到"初版 → 最新"顺序
      cur = cur.parentId ? (byId.get(cur.parentId) ?? null) : null;
    }
    return chain;
  } catch (err) {
    console.error("[brain-db] list versions failed:", err);
    return [];
  }
}

/** 顶层初版笔记（parentId 为空）集合：一条笔记链以初版为唯一可编入计数的主体。 */
export async function listBrainRootNotes(userId: string): Promise<BrainNote[]> {
  try {
    const rows = (await db
      .select()
      .from(brainNotes)
      .where(and(eq(brainNotes.userId, userId), isNull(brainNotes.parentId)))) as BrainRow[];
    return rows.map(toNote);
  } catch (err) {
    console.error("[brain-db] list root notes failed:", err);
    return [];
  }
}

/**
 * 按 ima 来源文档 id 查笔记（增量同步去重用）。
 * 同 docId 可能因版本演化存在多条，优先返回当前有效版本(superseded=0)，否则最新一条。
 */
export async function findBrainNoteByImaDocId(
  userId: string,
  docId: string,
): Promise<BrainNote | null> {
  try {
    const rows = (await db
      .select()
      .from(brainNotes)
      .where(and(eq(brainNotes.userId, userId), eq(brainNotes.imaDocId, docId)))
      .orderBy(desc(brainNotes.updatedAt))) as BrainRow[];
    if (!rows.length) return null;
    const list = rows.map(toNote);
    return list.find((n) => !n.superseded) ?? list[0];
  } catch (err) {
    console.error("[brain-db] find by ima doc failed:", err);
    return null;
  }
}

// ---------- 代码片段 ----------

/** 当前用户全部代码片段（isSnippet=1，含所有版本），可选按语言过滤。 */
export async function listBrainSnippets(
  userId: string,
  language?: string,
): Promise<BrainNote[]> {
  try {
    let q = db
      .select()
      .from(brainNotes)
      .where(and(eq(brainNotes.userId, userId), eq(brainNotes.isSnippet, 1)));
    if (language) q = q.where(eq(brainNotes.language, language));
    const rows = (await q.orderBy(desc(brainNotes.createdAt))) as BrainRow[];
    return rows.map(toNote);
  } catch (err) {
    console.error("[brain-db] list snippets failed:", err);
    return [];
  }
}