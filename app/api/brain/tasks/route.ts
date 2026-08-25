import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainTasks,
  insertBrainTasks,
  insertBrainNote,
  updateBrainTask,
  deleteBrainTask,
  listBrainProjects,
  type BrainTask,
  type BrainTaskStatus,
  type BrainTaskPriority,
} from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES: BrainTaskStatus[] = ["todo", "in_progress", "done"];
const PRIORITIES: BrainTaskPriority[] = ["high", "medium", "low"];
type GroupBy = "status" | "project" | "assignee" | "milestone";

function isStatus(v: unknown): v is BrainTaskStatus {
  return typeof v === "string" && STATUSES.includes(v as BrainTaskStatus);
}
function isPriority(v: unknown): v is BrainTaskPriority {
  return typeof v === "string" && PRIORITIES.includes(v as BrainTaskPriority);
}
const isGroupBy = (v: unknown): v is GroupBy =>
  v === "status" || v === "project" || v === "assignee" || v === "milestone";

/** 顶层任务（不含子任务）：看板/分组查询只展示父层，子任务在详情抽屉内管理。 */
function topLevel(tasks: BrainTask[]): BrainTask[] {
  return tasks.filter((t) => !t.parentTaskId);
}

function normalizeDate(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return v ?? null;
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 10);
  return null;
}

// GET /api/brain/tasks[?status=][&groupBy=status|project|assignee|milestone]
// groupBy=status（默认）→ 按看板状态分组；其余按项目/负责人/里程碑分组。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status");
  const groupByRaw = req.nextUrl.searchParams.get("groupBy");
  const groupBy: GroupBy = isGroupBy(groupByRaw) && groupByRaw !== "status" ? groupByRaw : "status";

  const tasks = await listBrainTasks(user.sub, status && isStatus(status) ? status : undefined);
  const top = topLevel(tasks);
  const projectName = new Map((await listBrainProjects(user.sub)).map((p) => [p.id, p.name]));

  if (groupBy === "status") {
    const grouped = STATUSES.map((s) => ({
      key: s,
      title: s,
      tasks: top.filter((t) => t.status === s && !t.archived),
    }));
    return NextResponse.json({ groupBy, tasks, groups: grouped });
  }

  // 项目 / 负责人 / 里程碑分组
  const keyFn = (t: BrainTask): string => {
    if (groupBy === "project") return t.projectId ? projectName.get(t.projectId) || "未分类" : "无项目";
    if (groupBy === "assignee") return t.assignee?.trim() || "未分配";
    if (groupBy === "milestone") return t.milestone?.trim() || "无里程碑";
    return "other";
  };
  const map = new Map<string, BrainTask[]>();
  for (const t of top) {
    if (t.archived) continue;
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const keys = (map.keys() as IterableIterator<string>);
  // 项目视图按文件夹排序（无项目排最后）；其余按首字排序
  const drawer = groupBy === "project"
    ? [...keys].sort((a, b) => (a === "无项目" ? 1 : b === "无项目" ? -1 : a.localeCompare(b)))
    : [...keys].sort((a, b) => a.localeCompare(b));
  const groups = drawer.map((key) => ({
    key,
    title: key,
    tasks: map.get(key)!,
  }));
  return NextResponse.json({ groupBy, tasks, groups });
}

// POST /api/brain/tasks  → 手动创建任务（支持项目/负责人/里程碑/父子/工时等新字段）
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
    // 手动建任务：优先挂到用户提供的来源笔记；否则自动生成一条轻量"任务"笔记以保证 note_id 外键成立
    let noteId: string | undefined =
      typeof body?.noteId === "string" && body.noteId ? body.noteId : undefined;
    if (!noteId) {
      const supporting = await insertBrainNote(user.sub, {
        source: "text",
        title: "任务 · " + title,
        content: title,
        category: "任务",
        summary: "",
        tags: [],
        related: [],
        isSnippet: false,
      });
      noteId = supporting?.id;
      if (!noteId) return NextResponse.json({ error: "source_note_failed" }, { status: 500 });
    }
    const created = await insertBrainTasks(user.sub, [{
      noteId,
      title,
      status: body?.status && isStatus(body.status) ? body.status : undefined,
      dueDate: normalizeDate(body?.dueDate),
      priority: body?.priority && isPriority(body.priority) ? body.priority : "medium",
      projectId: typeof body?.projectId === "string" && body.projectId ? body.projectId : null,
      assignee: typeof body?.assignee === "string" ? body.assignee || null : null,
      startDate: normalizeDate(body?.startDate),
      milestone: typeof body?.milestone === "string" ? body.milestone || null : null,
      parentTaskId: typeof body?.parentTaskId === "string" && body.parentTaskId ? body.parentTaskId : null,
      sortOrder: typeof body?.sortOrder === "number" ? body.sortOrder : 0,
      estimatedHours: typeof body?.estimatedHours === "number" ? body.estimatedHours : null,
      actualHours: typeof body?.actualHours === "number" ? body.actualHours : null,
    }]);
    const task = created[0];
    if (!task) return NextResponse.json({ error: "create_failed" }, { status: 500 });
    // 手动任务 noteId 为空哨兵：随后修正为 null 是不可能的（notNull），这里仅返回
    return NextResponse.json({ task });
  } catch (err) {
    console.error("brain task create failed:", err);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }
}

// PUT /api/brain/tasks?id=<id>
// body: { status?; dueDate?; title?; projectId?; assignee?; startDate?; milestone?; parentTaskId?; sortOrder?; estimatedHours?; actualHours? }
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
    const body = await req.json().catch(() => null);
    const patch: {
      status?: BrainTaskStatus;
      dueDate?: string | null;
      title?: string;
      projectId?: string | null;
      assignee?: string | null;
      startDate?: string | null;
      milestone?: string | null;
      parentTaskId?: string | null;
      sortOrder?: number;
      estimatedHours?: number | null;
      actualHours?: number | null;
      priority?: BrainTaskPriority;
    } = {};
    if (body?.status !== undefined) {
      if (!isStatus(body.status)) return NextResponse.json({ error: "bad_status" }, { status: 400 });
      patch.status = body.status;
    }
    if (body?.title !== undefined) patch.title = String(body.title).trim().slice(0, 80) || undefined;
    if (body?.dueDate !== undefined) patch.dueDate = normalizeDate(body.dueDate);
    if (body?.startDate !== undefined) patch.startDate = normalizeDate(body.startDate);
    if (body?.projectId !== undefined) patch.projectId = typeof body.projectId === "string" ? body.projectId || null : null;
    if (body?.assignee !== undefined) patch.assignee = typeof body.assignee === "string" ? body.assignee || null : null;
    if (body?.milestone !== undefined) patch.milestone = typeof body.milestone === "string" ? body.milestone || null : null;
    if (body?.parentTaskId !== undefined) patch.parentTaskId = typeof body.parentTaskId === "string" ? body.parentTaskId || null : null;
    if (body?.sortOrder !== undefined) patch.sortOrder = typeof body.sortOrder === "number" ? body.sortOrder : undefined;
    if (body?.estimatedHours !== undefined) patch.estimatedHours = typeof body.estimatedHours === "number" ? body.estimatedHours : null;
    if (body?.actualHours !== undefined) patch.actualHours = typeof body.actualHours === "number" ? body.actualHours : null;
    if (body?.priority !== undefined) {
      if (!isPriority(body.priority)) return NextResponse.json({ error: "bad_priority" }, { status: 400 });
      patch.priority = body.priority;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }
    const task = await updateBrainTask(user.sub, id, patch);
    if (!task) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ task });
  } catch (err) {
    console.error("brain task update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}

// DELETE /api/brain/tasks?id=<id>
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const ok = await deleteBrainTask(user.sub, id);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}