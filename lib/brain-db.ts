// 第二大脑（Second Brain）数据访问层：用户私有的个人知识笔记读写。
// 与 knowledge-db（云端共享技能库）不同，这里按 userId 硬隔离，仅本人可见。

import { db, brainNotes, brainTasks, brainReviews, brainStrategies, brainImaSyncLog, brainInboxItems, brainProjects, brainTaskTimeline, brainTaskComments, brainProcessingPlans, brainReminderItems } from "@/lib/db";
import { eq, and, desc, asc, isNull, inArray } from "drizzle-orm";

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
  // —— 第十阶段：项目 / 子任务 / 工时 ——
  projectId: string | null;
  assignee: string | null;
  startDate: string | null;
  milestone: string | null;
  parentTaskId: string | null;
  sortOrder: number;
  estimatedHours: number | null;
  actualHours: number | null;
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
  // AI 整理完整结构化结果（OrganizedNote 的 JSON 字符串）；null 表示未整理
  struct: string | null;
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
  struct: string | null;
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
    struct: r.struct ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 用户私有的全部笔记，按创建时间倒序。 */
export async function listBrainNotes(userId: string): Promise<BrainNote[]> {
  try {
    // 列表显式选列、剔除大字段 embedding（384 维向量，列表/详情用不到，减小首屏传输）
    const rows = (await db
      .select({
        id: brainNotes.id,
        userId: brainNotes.userId,
        source: brainNotes.source,
        title: brainNotes.title,
        content: brainNotes.content,
        category: brainNotes.category,
        summary: brainNotes.summary,
        tags: brainNotes.tags,
        related: brainNotes.related,
        parentId: brainNotes.parentId,
        version: brainNotes.version,
        superseded: brainNotes.superseded,
        isSnippet: brainNotes.isSnippet,
        language: brainNotes.language,
        codeContent: brainNotes.codeContent,
        imaDocId: brainNotes.imaDocId,
        imaSyncedAt: brainNotes.imaSyncedAt,
        struct: brainNotes.struct,
        createdAt: brainNotes.createdAt,
        updatedAt: brainNotes.updatedAt,
      })
      .from(brainNotes)
      .where(eq(brainNotes.userId, userId))
      .orderBy(desc(brainNotes.createdAt))) as unknown as BrainRow[];
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
  // AI 整理完整结构化结果（JSON 字符串）；可选，落库/回填写入
  struct?: string | null;
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
    struct: row.struct ?? null,
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
    struct: row.struct ?? null,
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
    | "struct"
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
    struct: patch.struct === undefined ? undefined : (patch.struct ?? null),
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
  projectId: string | null;
  assignee: string | null;
  startDate: string | null;
  milestone: string | null;
  parentTaskId: string | null;
  sortOrder: number | null;
  estimatedHours: number | null;
  actualHours: number | null;
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
    projectId: r.projectId ?? null,
    assignee: r.assignee ?? null,
    startDate: r.startDate ?? null,
    milestone: r.milestone ?? null,
    parentTaskId: r.parentTaskId ?? null,
    sortOrder: Number(r.sortOrder ?? 0),
    estimatedHours: r.estimatedHours != null ? Number(r.estimatedHours) : null,
    actualHours: r.actualHours != null ? Number(r.actualHours) : null,
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
  // 第十阶段：项目 / 子任务 / 工时 / 里程碑
  projectId?: string | null;
  assignee?: string | null;
  startDate?: string | null;
  milestone?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
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
        completedAt: item.status === "done" ? now : null,
        strategyId: item.strategyId ?? null,
        projectId: item.projectId ?? null,
        assignee: item.assignee ?? null,
        startDate: item.startDate ?? null,
        milestone: item.milestone ?? null,
        parentTaskId: item.parentTaskId ?? null,
        sortOrder: item.sortOrder ?? 0,
        estimatedHours: item.estimatedHours ?? null,
        actualHours: item.actualHours ?? null,
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
        completedAt: item.status === "done" ? now : null,
        archived: false,
        strategyId: item.strategyId ?? null,
        projectId: item.projectId ?? null,
        assignee: item.assignee ?? null,
        startDate: item.startDate ?? null,
        milestone: item.milestone ?? null,
        parentTaskId: item.parentTaskId ?? null,
        sortOrder: item.sortOrder ?? 0,
        estimatedHours: item.estimatedHours ?? null,
        actualHours: item.actualHours ?? null,
      });
      // 记录"创建"时间线
      await insertBrainTaskTimeline(userId, id, "created", { title: item.title });
    } catch (err) {
      console.error("[brain-db] insert task failed:", err);
    }
  }
  return inserted;
}

export type BrainTaskPatch = {
  status?: BrainTaskStatus;
  dueDate?: string | null;
  priority?: BrainTaskPriority;
  title?: string;
  projectId?: string | null;
  assignee?: string | null;
  startDate?: string | null;
  milestone?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
  strategyId?: string | null;
};

export async function updateBrainTask(
  userId: string,
  id: string,
  patch: BrainTaskPatch,
): Promise<BrainTask | null> {
  try {
    const set: Record<string, unknown> = { ...patch };
    if (patch.status) set.completedAt = patch.status === "done" ? Date.now() : null;
    for (const k of ["dueDate", "projectId", "assignee", "startDate", "milestone", "parentTaskId", "strategyId"] as const) {
      const v = (patch as Record<string, unknown>)[k];
      if (v === "" || v === undefined) set[k] = null;
    }
    await db
      .update(brainTasks)
      .set(set)
      .where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)));
    const rows = (await db
      .select()
      .from(brainTasks)
      .where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)))) as TaskRow[];
    if (!rows[0]) return null;
    // 状态变更 → 自动记录时间线
    if (patch.status && patch.status !== rows[0].status) {
      await insertBrainTaskTimeline(userId, id, "status_changed", {
        from: rows[0].status,
        to: patch.status,
      });
    }
    // 截止日期变更 → 记录时间线
    if (patch.dueDate !== undefined && patch.dueDate !== rows[0].dueDate) {
      await insertBrainTaskTimeline(userId, id, "dueDate_changed", {
        from: rows[0].dueDate,
        to: patch.dueDate ?? null,
      });
    }
    return toTask(rows[0]);
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

// ---------- 第十阶段：项目 / 子任务 / 时间线 / 评论 ----------

export type BrainProjectStatus = "active" | "paused" | "completed" | "archived";

export interface BrainProject {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: BrainProjectStatus;
  color: string;
  startDate: string | null;
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
}

export type NewBrainProject = {
  name: string;
  description?: string | null;
  status?: BrainProjectStatus;
  color?: string;
  startDate?: string | null;
  dueDate?: string | null;
};

interface ProjectRow {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  status: string | null;
  color: string | null;
  startDate: string | null;
  dueDate: string | null;
  createdAt: number;
  updatedAt: number;
}

function toProject(r: ProjectRow): BrainProject {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    description: r.description ?? null,
    status: (r.status ?? "active") as BrainProjectStatus,
    color: r.color ?? "#3B82F6",
    startDate: r.startDate ?? null,
    dueDate: r.dueDate ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** 当前用户全部项目，按创建倒序；归档项目默认不返回。 */
export async function listBrainProjects(userId: string): Promise<BrainProject[]> {
  try {
    const rows = (await db
      .select()
      .from(brainProjects)
      .where(eq(brainProjects.userId, userId))) as ProjectRow[];
    return rows.filter((r) => r.status !== "archived").map(toProject);
  } catch (err) {
    console.error("[brain-db] list projects failed:", err);
    return [];
  }
}

export async function getBrainProject(userId: string, id: string): Promise<BrainProject | null> {
  try {
    const rows = (await db
      .select()
      .from(brainProjects)
      .where(and(eq(brainProjects.id, id), eq(brainProjects.userId, userId)))) as ProjectRow[];
    return rows[0] ? toProject(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get project failed:", err);
    return null;
  }
}

export async function insertBrainProject(userId: string, input: NewBrainProject): Promise<BrainProject | null> {
  const now = Date.now();
  const id = `bp-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await db.insert(brainProjects).values({
      id,
      userId,
      name: input.name.slice(0, 200),
      description: input.description ?? null,
      status: input.status ?? "active",
      color: input.color ?? "#3B82F6",
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return getBrainProject(userId, id);
  } catch (err) {
    console.error("[brain-db] insert project failed:", err);
    return null;
  }
}

export type BrainProjectPatch = {
  name?: string;
  description?: string | null;
  status?: BrainProjectStatus;
  color?: string;
  startDate?: string | null;
  dueDate?: string | null;
};

export async function updateBrainProject(
  userId: string,
  id: string,
  patch: BrainProjectPatch,
): Promise<BrainProject | null> {
  try {
    const set: Record<string, unknown> = { ...patch, updatedAt: Date.now() };
    if (patch.dueDate === "" || patch.dueDate === undefined) set.dueDate = null;
    if (patch.status === "archived") {
      // 归档项目：关联任务 projectId 置空
      await db
        .update(brainTasks)
        .set({ projectId: null })
        .where(and(eq(brainTasks.projectId, id), eq(brainTasks.userId, userId)));
    }
    await db
      .update(brainProjects)
      .set(set)
      .where(and(eq(brainProjects.id, id), eq(brainProjects.userId, userId)));
    return getBrainProject(userId, id);
  } catch (err) {
    console.error("[brain-db] update project failed:", err);
    return null;
  }
}

/** 归档项目（软删除，status → archived）；与 updateBrainProject 的 archived 分支共用。 */
export async function archiveBrainProject(userId: string, id: string): Promise<boolean> {
  const r = await updateBrainProject(userId, id, { status: "archived" });
  return !!r;
}

// —— 任务事件时间线 ——

export type BrainTaskTimelineAction =
  | "created"
  | "status_changed"
  | "comment_added"
  | "subtask_added"
  | "dueDate_changed";

export interface BrainTaskTimelineItem {
  id: string;
  taskId: string;
  action: BrainTaskTimelineAction;
  detail: string | null;
  createdAt: number;
}

export async function insertBrainTaskTimeline(
  userId: string,
  taskId: string,
  action: string,
  detail?: Record<string, unknown> | null,
): Promise<void> {
  try {
    const id = `tt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await db.insert(brainTaskTimeline).values({
      id,
      taskId,
      action,
      detail: detail && Object.keys(detail).length ? JSON.stringify(detail) : null,
      createdAt: Date.now(),
    });
  } catch (err) {
    console.error("[brain-db] insert timeline failed:", err);
  }
}

export async function listBrainTaskTimeline(userId: string, taskId: string): Promise<BrainTaskTimelineItem[]> {
  try {
    const rows = (await db
      .select()
      .from(brainTaskTimeline)
      .where(eq(brainTaskTimeline.taskId, taskId))) as (BrainTaskTimelineItem & { action: string })[];
    return rows
      .filter((r) => r) // 任务已删除时行不存在，无需过滤 userId（taskId 全局唯一）
      .sort((a, b) => a.createdAt - b.createdAt);
  } catch (err) {
    console.error("[brain-db] list timeline failed:", err);
    return [];
  }
}

// —— 任务评论 ——

export interface BrainTaskComment {
  id: string;
  taskId: string;
  content: string;
  createdAt: number;
}

export async function addBrainTaskComment(userId: string, taskId: string, content: string): Promise<BrainTaskComment | null> {
  const id = `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    // 校验任务属于该用户
    const task = await getBrainTaskById(userId, taskId);
    if (!task) return null;
    await db.insert(brainTaskComments).values({ id, taskId, content, createdAt: Date.now() });
    await insertBrainTaskTimeline(userId, taskId, "comment_added", {});
    return { id, taskId, content, createdAt: Date.now() };
  } catch (err) {
    console.error("[brain-db] add comment failed:", err);
    return null;
  }
}

export async function listBrainTaskComments(userId: string, taskId: string): Promise<BrainTaskComment[]> {
  try {
    const rows = (await db
      .select()
      .from(brainTaskComments)
      .where(eq(brainTaskComments.taskId, taskId))
      .orderBy(asc(brainTaskComments.createdAt))) as BrainTaskComment[];
    return rows;
  } catch (err) {
    console.error("[brain-db] list comments failed:", err);
    return [];
  }
}

export async function getBrainTaskById(userId: string, id: string): Promise<BrainTask | null> {
  try {
    const rows = (await db
      .select()
      .from(brainTasks)
      .where(and(eq(brainTasks.id, id), eq(brainTasks.userId, userId)))) as TaskRow[];
    return rows[0] ? toTask(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get task failed:", err);
    return null;
  }
}

/** 子任务添加：校验 parent 归属后插入，并记录 subtask_added 时间线。 */
export async function addBrainSubtask(
  userId: string,
  parentId: string,
  title: string,
  extra?: Partial<NewBrainTask>,
): Promise<BrainTask | null> {
  const parent = await getBrainTaskById(userId, parentId);
  if (!parent) return null;
  const maxOrder = (await getBrainSubtaskMaxOrder(userId, parentId));
  const created = await insertBrainTasks(userId, [{
    noteId: parent.noteId,
    title,
    parentTaskId: parentId,
    sortOrder: maxOrder + 1,
    projectId: parent.projectId,
    dueDate: extra?.dueDate ?? null,
    priority: extra?.priority ?? parent.priority,
  }]);
  if (created[0]) {
    await insertBrainTaskTimeline(userId, created[0].id, "subtask_added", { parentTitle: parent.title });
  }
  return created[0] ?? null;
}

async function getBrainSubtaskMaxOrder(userId: string, parentId: string): Promise<number> {
  try {
    const rows = (await db
      .select({ s: brainTasks.sortOrder })
      .from(brainTasks)
      .where(and(eq(brainTasks.parentTaskId, parentId), eq(brainTasks.userId, userId)))) as { s: number | null }[];
    return rows.reduce((m, r) => Math.max(m, Number(r.s ?? 0)), 0);
  } catch {
    return 0;
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

// ---------- 收件箱（Inbox） ----------

export type BrainInboxIntent = "note" | "task" | "meeting" | "snippet" | "project" | "unknown";

// 收件箱状态机（P2-A 扩展，保持既有值兼容）：
// pending 新接收待处理 → processing AI 处理中 → pending_confirmation Plan 已生成待确认
// → converted 已确认并产出正式对象；failed 处理失败可重试；dismissed 已忽略；processed 旧数据兼容。
export type BrainInboxStatus =
  | "pending"
  | "processing"
  | "pending_confirmation"
  | "converted"
  | "processed"
  | "dismissed"
  | "failed";

export interface BrainInboxItem {
  id: string;
  userId: string;
  rawContent: string;
  intent: BrainInboxIntent | null;
  suggestedTitle: string;
  suggestedCategory: string;
  suggestedTags: string[];
  organized: string | null;
  noteId: string | null;
  taskId: string | null;
  status: BrainInboxStatus;
  createdAt: number;
  processedAt: number | null;
  // —— P2-A 来源/产出链路字段 ——
  processingPlanId: string | null;
  outputTaskIds: string[];
  outputReminderIds: string[];
  outputProjectId: string | null;
  convertedAt: number | null;
  failedReason: string | null;
}

export type NewBrainInboxItem = {
  rawContent: string;
  intent?: BrainInboxIntent;
  suggestedTitle?: string;
  suggestedCategory?: string;
  suggestedTags?: string[];
  organized?: string;
  noteId?: string | null;
  taskId?: string | null;
  status?: BrainInboxStatus;
  processingPlanId?: string | null;
  outputTaskIds?: string[];
  outputReminderIds?: string[];
  outputProjectId?: string | null;
  convertedAt?: number | null;
  failedReason?: string | null;
};

interface InboxRow {
  id: string;
  userId: string;
  rawContent: string;
  intent: string | null;
  suggestedTitle: string | null;
  suggestedCategory: string | null;
  suggestedTags: string | null;
  organized: string | null;
  noteId: string | null;
  taskId: string | null;
  status: string;
  createdAt: number;
  processedAt: number | null;
  processingPlanId: string | null;
  outputTaskIds: string | null;
  outputReminderIds: string | null;
  outputProjectId: string | null;
  convertedAt: number | null;
  failedReason: string | null;
}

function toInbox(r: InboxRow): BrainInboxItem {
  return {
    id: r.id,
    userId: r.userId,
    rawContent: r.rawContent,
    intent: (r.intent as BrainInboxIntent) ?? null,
    suggestedTitle: r.suggestedTitle ?? "",
    suggestedCategory: r.suggestedCategory ?? "",
    suggestedTags: splitList(r.suggestedTags),
    organized: r.organized ?? null,
    noteId: r.noteId ?? null,
    taskId: r.taskId ?? null,
    status: (r.status ?? "pending") as BrainInboxStatus,
    createdAt: Number(r.createdAt),
    processedAt: r.processedAt != null ? Number(r.processedAt) : null,
    processingPlanId: r.processingPlanId ?? null,
    outputTaskIds: splitList(r.outputTaskIds),
    outputReminderIds: splitList(r.outputReminderIds),
    outputProjectId: r.outputProjectId ?? null,
    convertedAt: r.convertedAt != null ? Number(r.convertedAt) : null,
    failedReason: r.failedReason ?? null,
  };
}

/** 写入若干收件箱条目（初态 pending，先预览不直接落库）。 */
export async function insertBrainInboxItems(
  userId: string,
  items: NewBrainInboxItem[],
): Promise<BrainInboxItem[]> {
  const now = Date.now();
  const created: BrainInboxItem[] = [];
  for (const it of items) {
    const id = `bi-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      await db.insert(brainInboxItems).values({
        id,
        userId,
        rawContent: it.rawContent,
        intent: it.intent ?? null,
        suggestedTitle: it.suggestedTitle ?? null,
        suggestedCategory: it.suggestedCategory ?? null,
        suggestedTags: it.suggestedTags?.length ? JSON.stringify(it.suggestedTags) : null,
        organized: it.organized ?? null,
        noteId: it.noteId ?? null,
        taskId: it.taskId ?? null,
        status: it.status ?? "pending",
        createdAt: now,
        processedAt: null,
        processingPlanId: it.processingPlanId ?? null,
        outputTaskIds: it.outputTaskIds?.length ? JSON.stringify(it.outputTaskIds) : null,
        outputReminderIds: it.outputReminderIds?.length ? JSON.stringify(it.outputReminderIds) : null,
        outputProjectId: it.outputProjectId ?? null,
        convertedAt: it.convertedAt ?? null,
        failedReason: it.failedReason ?? null,
      });
      created.push({
        id,
        userId,
        rawContent: it.rawContent,
        intent: it.intent ?? null,
        suggestedTitle: it.suggestedTitle ?? "",
        suggestedCategory: it.suggestedCategory ?? "",
        suggestedTags: it.suggestedTags ?? [],
        organized: it.organized ?? null,
        noteId: it.noteId ?? null,
        taskId: it.taskId ?? null,
        status: it.status ?? "pending",
        createdAt: now,
        processedAt: null,
        processingPlanId: it.processingPlanId ?? null,
        outputTaskIds: it.outputTaskIds ?? [],
        outputReminderIds: it.outputReminderIds ?? [],
        outputProjectId: it.outputProjectId ?? null,
        convertedAt: it.convertedAt ?? null,
        failedReason: it.failedReason ?? null,
      });
    } catch (err) {
      console.error("[brain-db] insert inbox failed:", err);
    }
  }
  return created;
}

export async function listBrainInboxItems(
  userId: string,
  status?: BrainInboxStatus,
): Promise<BrainInboxItem[]> {
  try {
    let q = db
      .select()
      .from(brainInboxItems)
      .where(eq(brainInboxItems.userId, userId));
    if (status) q = q.where(eq(brainInboxItems.status, status));
    const rows = (await q.orderBy(desc(brainInboxItems.createdAt))) as InboxRow[];
    return rows.map(toInbox);
  } catch (err) {
    console.error("[brain-db] list inbox failed:", err);
    return [];
  }
}

export async function getBrainInboxItem(
  userId: string,
  id: string,
): Promise<BrainInboxItem | null> {
  try {
    const rows = (await db
      .select()
      .from(brainInboxItems)
      .where(and(eq(brainInboxItems.id, id), eq(brainInboxItems.userId, userId)))) as InboxRow[];
    return rows[0] ? toInbox(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get inbox failed:", err);
    return null;
  }
}

/** 处理/忽略收件箱条目时更新状态与关联资产 ID / 产出链路字段。 */
export async function updateBrainInboxItem(
  userId: string,
  id: string,
  patch: {
    status?: BrainInboxStatus;
    noteId?: string | null;
    taskId?: string | null;
    processingPlanId?: string | null;
    outputTaskIds?: string[];
    outputReminderIds?: string[];
    outputProjectId?: string | null;
    convertedAt?: number | null;
    failedReason?: string | null;
  },
): Promise<BrainInboxItem | null> {
  try {
    const set: Record<string, unknown> = {};
    if (patch.status) set.status = patch.status;
    if (patch.noteId !== undefined) set.noteId = patch.noteId;
    if (patch.taskId !== undefined) set.taskId = patch.taskId;
    if (patch.processingPlanId !== undefined) set.processingPlanId = patch.processingPlanId;
    if (patch.outputTaskIds !== undefined) set.outputTaskIds = patch.outputTaskIds.length ? JSON.stringify(patch.outputTaskIds) : null;
    if (patch.outputReminderIds !== undefined) set.outputReminderIds = patch.outputReminderIds.length ? JSON.stringify(patch.outputReminderIds) : null;
    if (patch.outputProjectId !== undefined) set.outputProjectId = patch.outputProjectId;
    if (patch.convertedAt !== undefined) set.convertedAt = patch.convertedAt;
    if (patch.failedReason !== undefined) set.failedReason = patch.failedReason;
    if (patch.status === "processed") set.processedAt = Date.now();
    await db
      .update(brainInboxItems)
      .set(set)
      .where(and(eq(brainInboxItems.id, id), eq(brainInboxItems.userId, userId)));
    return getBrainInboxItem(userId, id);
  } catch (err) {
    console.error("[brain-db] update inbox failed:", err);
    return null;
  }
}

/** 与某条处理计划关联的收件箱条目（计划确认/失败时统一回写状态）。 */
export async function getBrainInboxItemsByPlanId(
  userId: string,
  planId: string,
): Promise<BrainInboxItem[]> {
  try {
    const rows = (await db
      .select()
      .from(brainInboxItems)
      .where(
        and(
          eq(brainInboxItems.userId, userId),
          eq(brainInboxItems.processingPlanId, planId),
        ),
      )) as InboxRow[];
    return rows.map(toInbox);
  } catch (err) {
    console.error("[brain-db] get inbox by plan failed:", err);
    return [];
  }
}

// ---------------- P0 统一信息加工确认闭环 ----------------

export type BrainPlanStatus = "draft" | "pending_confirmation" | "applied" | "failed" | "rejected";

export interface BrainProcessingPlan {
  id: string;
  userId: string;
  rawContent: string;
  inputType: string | null;
  planJson: string;
  editsJson: string | null;
  status: BrainPlanStatus;
  source: string;
  noteId: string | null;
  taskIds: string[];
  strategyIds: string[];
  reminderIds: string[];
  projectId: string | null;
  failureReason: string | null;
  recovery: string | null;
  createdAt: number;
  applyAt: number | null;
  updatedAt: number;
  // 软归档时间戳（升级清理策略用）；null = 未归档。审计记录不硬删除。
  archivedAt: number | null;
}

interface PlanRow {
  id: string;
  userId: string;
  rawContent: string;
  inputType: string | null;
  planJson: string;
  editsJson: string | null;
  status: string;
  source: string;
  noteId: string | null;
  taskIds: string | null;
  strategyIds: string | null;
  reminderIds: string | null;
  projectId: string | null;
  failureReason: string | null;
  recovery: string | null;
  createdAt: number;
  applyAt: number | null;
  updatedAt: number;
  archivedAt: number | null;
}

const PLAN_STATUSES: BrainPlanStatus[] = ["draft", "pending_confirmation", "applied", "failed", "rejected"];

function parseIdList(v: string | null): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function toPlan(r: PlanRow): BrainProcessingPlan {
  const status =
    PLAN_STATUSES.find((s) => s === r.status) ?? "pending_confirmation";
  return {
    id: r.id,
    userId: r.userId,
    rawContent: r.rawContent,
    inputType: r.inputType ?? null,
    planJson: r.planJson,
    editsJson: r.editsJson,
    status,
    source: r.source || "workbench",
    noteId: r.noteId ?? null,
    taskIds: parseIdList(r.taskIds),
    strategyIds: parseIdList(r.strategyIds),
    reminderIds: parseIdList(r.reminderIds),
    projectId: r.projectId ?? null,
    failureReason: r.failureReason ?? null,
    recovery: r.recovery ?? null,
    createdAt: r.createdAt,
    applyAt: r.applyAt ?? null,
    updatedAt: r.updatedAt,
    archivedAt: r.archivedAt ?? null,
  };
}

/** 创建一条处理计划（pending_confirmation）。 */
export async function insertBrainProcessingPlan(
  userId: string,
  input: {
    rawContent: string;
    inputType: string | null;
    planJson: string;
    source: string;
  },
): Promise<BrainProcessingPlan | null> {
  const now = Date.now();
  const id = `bp-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await db.insert(brainProcessingPlans).values({
      id,
      userId,
      rawContent: input.rawContent,
      inputType: input.inputType,
      planJson: input.planJson,
      status: "pending_confirmation",
      source: input.source || "workbench",
      createdAt: now,
      updatedAt: now,
    });
    return getBrainProcessingPlan(userId, id);
  } catch (err) {
    console.error("[brain-db] insert plan failed:", err);
    return null;
  }
}

export async function getBrainProcessingPlan(
  userId: string,
  id: string,
): Promise<BrainProcessingPlan | null> {
  try {
    const rows = (await db
      .select()
      .from(brainProcessingPlans)
      .where(and(eq(brainProcessingPlans.id, id), eq(brainProcessingPlans.userId, userId)))) as PlanRow[];
    return rows[0] ? toPlan(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get plan failed:", err);
    return null;
  }
}

/** 当前用户的处理计划（可按状态过滤，desc 时间）。供恢复草稿。 */
export async function listBrainProcessingPlans(
  userId: string,
  status?: BrainPlanStatus[],
  includeArchived = false,
): Promise<BrainProcessingPlan[]> {
  try {
    const rows = (await db
      .select()
      .from(brainProcessingPlans)
      .where(
        and(
          eq(brainProcessingPlans.userId, userId),
          status && status.length ? inArray(brainProcessingPlans.status, status) : undefined,
          includeArchived ? undefined : isNull(brainProcessingPlans.archivedAt),
        ),
      )
      .orderBy(desc(brainProcessingPlans.createdAt))) as PlanRow[];
    return rows.map(toPlan);
  } catch (err) {
    console.error("[brain-db] list plans failed:", err);
    return [];
  }
}

export type BrainPlanPatch = {
  status?: BrainPlanStatus;
  editsJson?: string | null;
  noteId?: string | null;
  taskIds?: string[] | null;
  strategyIds?: string[] | null;
  reminderIds?: string[] | null;
  projectId?: string | null;
  failureReason?: string | null;
  recovery?: string | null;
  applyAt?: number | null;
  archivedAt?: number | null;
};

export async function updateBrainProcessingPlan(
  userId: string,
  id: string,
  patch: BrainPlanPatch,
): Promise<BrainProcessingPlan | null> {
  try {
    const set: Record<string, unknown> = { updatedAt: Date.now() };
    if (patch.status) set.status = patch.status;
    if (patch.editsJson !== undefined) set.editsJson = patch.editsJson;
    if (patch.noteId !== undefined) set.noteId = patch.noteId;
    if (patch.taskIds !== undefined) set.taskIds = patch.taskIds && patch.taskIds.length ? JSON.stringify(patch.taskIds) : null;
    if (patch.strategyIds !== undefined) set.strategyIds = patch.strategyIds && patch.strategyIds.length ? JSON.stringify(patch.strategyIds) : null;
    if (patch.reminderIds !== undefined) set.reminderIds = patch.reminderIds && patch.reminderIds.length ? JSON.stringify(patch.reminderIds) : null;
    if (patch.projectId !== undefined) set.projectId = patch.projectId;
    if (patch.failureReason !== undefined) set.failureReason = patch.failureReason;
    if (patch.recovery !== undefined) set.recovery = patch.recovery;
    if (patch.applyAt !== undefined) set.applyAt = patch.applyAt ?? null;
    if (patch.archivedAt !== undefined) set.archivedAt = patch.archivedAt ?? null;
    await db
      .update(brainProcessingPlans)
      .set(set)
      .where(and(eq(brainProcessingPlans.id, id), eq(brainProcessingPlans.userId, userId)));
    return getBrainProcessingPlan(userId, id);
  } catch (err) {
    console.error("[brain-db] update plan failed:", err);
    return null;
  }
}

export interface BrainReminderItem {
  id: string;
  userId: string;
  title: string;
  remindAt: string | null;
  dueDate: string | null;
  noteId: string | null;
  taskId: string | null;
  planId: string | null;
  done: boolean;
  status: string;
  createdAt: number;
  readAt: number | null;
}

interface ReminderItemRow {
  id: string;
  userId: string;
  title: string;
  remindAt: string | null;
  dueDate: string | null;
  noteId: string | null;
  taskId: string | null;
  planId: string | null;
  done: number | null;
  status: string | null;
  createdAt: number;
  readAt: number | null;
}

function toReminderItem(r: ReminderItemRow): BrainReminderItem {
  return {
    id: r.id,
    userId: r.userId,
    title: r.title,
    remindAt: r.remindAt ?? null,
    dueDate: r.dueDate ?? null,
    noteId: r.noteId ?? null,
    taskId: r.taskId ?? null,
    planId: r.planId ?? null,
    done: (r.done ?? 0) === 1,
    status: r.status ?? "pending",
    createdAt: r.createdAt,
    readAt: r.readAt ?? null,
  };
}

/** 用户确认后创建单条提醒。 */
export async function insertBrainReminderItem(
  userId: string,
  input: {
    title: string;
    remindAt?: string | null;
    dueDate?: string | null;
    noteId?: string | null;
    taskId?: string | null;
    planId?: string | null;
  },
): Promise<BrainReminderItem | null> {
  const now = Date.now();
  const id = `bri-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  try {
    await db.insert(brainReminderItems).values({
      id,
      userId,
      title: input.title,
      remindAt: input.remindAt ?? null,
      dueDate: input.dueDate ?? null,
      noteId: input.noteId ?? null,
      taskId: input.taskId ?? null,
      planId: input.planId ?? null,
      done: 0,
      status: "pending",
      createdAt: now,
    });
    return getBrainReminderItem(userId, id);
  } catch (err) {
    console.error("[brain-db] insert reminder item failed:", err);
    return null;
  }
}

export async function getBrainReminderItem(
  userId: string,
  id: string,
): Promise<BrainReminderItem | null> {
  try {
    const rows = (await db
      .select()
      .from(brainReminderItems)
      .where(and(eq(brainReminderItems.id, id), eq(brainReminderItems.userId, userId)))) as ReminderItemRow[];
    return rows[0] ? toReminderItem(rows[0]) : null;
  } catch (err) {
    console.error("[brain-db] get reminder item failed:", err);
    return null;
  }
}

/** 当前用户待触发的提醒条目（未完成且未读）。 */
export async function listPendingBrainReminderItems(userId: string): Promise<BrainReminderItem[]> {
  try {
    const rows = (await db
      .select()
      .from(brainReminderItems)
      .where(and(eq(brainReminderItems.userId, userId), eq(brainReminderItems.done, 0)))
      .orderBy(asc(brainReminderItems.createdAt))) as ReminderItemRow[];
    return rows.map(toReminderItem);
  } catch (err) {
    console.error("[brain-db] list reminder items failed:", err);
    return [];
  }
}

export async function deleteBrainReminderItem(userId: string, id: string): Promise<boolean> {
  try {
    await db
      .delete(brainReminderItems)
      .where(and(eq(brainReminderItems.id, id), eq(brainReminderItems.userId, userId)));
    return true;
  } catch (err) {
    console.error("[brain-db] delete reminder item failed:", err);
    return false;
  }
}