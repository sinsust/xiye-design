import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainTasks,
  updateBrainTask,
  deleteBrainTask,
  type BrainTaskStatus,
} from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES: BrainTaskStatus[] = ["todo", "in_progress", "done"];

function isStatus(v: unknown): v is BrainTaskStatus {
  return typeof v === "string" && STATUSES.includes(v as BrainTaskStatus);
}

// GET /api/brain/tasks[?status=todo]  → 当前用户全部任务（可选按状态过滤）
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status") as BrainTaskStatus | null;
  const tasks = await listBrainTasks(user.sub, status && isStatus(status) ? status : undefined);
  return NextResponse.json({ tasks });
}

// PUT /api/brain/tasks?id=<id>
// body: { status?; dueDate? }  → 更新状态/截止日期（status=done 自动带完成时间）
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
    const body = await req.json().catch(() => null);
    const patch: { status?: BrainTaskStatus; dueDate?: string | null } = {};
    if (body?.status !== undefined) {
      if (!isStatus(body.status)) return NextResponse.json({ error: "bad_status" }, { status: 400 });
      patch.status = body.status;
    }
    if (body?.dueDate !== undefined) {
      patch.dueDate = typeof body.dueDate === "string" && body.dueDate.trim()
        ? body.dueDate.trim().slice(0, 10)
        : null;
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