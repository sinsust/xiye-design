import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBrainProject, updateBrainProject, archiveBrainProject } from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES = ["active", "paused", "completed", "archived"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;
function isStatus(v: unknown): v is (typeof STATUSES)[number] {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}
function isPriority(v: unknown): v is (typeof PRIORITIES)[number] {
  return typeof v === "string" && (PRIORITIES as readonly string[]).includes(v);
}
function normalizeDate(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim().slice(0, 10);
  return null;
}

// PUT /api/brain/projects/:id → 更新项目（含状态变更）
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const patch: Parameters<typeof updateBrainProject>[2] = {};
  const body = await req.json().catch(() => null);
  if (body?.name !== undefined) {
    const name = String(body.name).trim().slice(0, 200);
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
    patch.name = name;
  }
  if (body?.description !== undefined) patch.description = typeof body.description === "string" ? body.description.slice(0, 2000) || null : null;
  if (body?.status !== undefined && isStatus(body.status)) patch.status = body.status;
  if (body?.priority !== undefined && isPriority(body.priority)) patch.priority = body.priority;
  if (body?.objective !== undefined) patch.objective = typeof body.objective === "string" ? body.objective.slice(0, 2000) || null : null;
  if (body?.color !== undefined) patch.color = typeof body.color === "string" && /^#[0-9A-Fa-f]{6}$/.test(body.color) ? body.color : undefined;
  if (body?.startDate !== undefined) patch.startDate = normalizeDate(body.startDate);
  if (body?.dueDate !== undefined) patch.dueDate = normalizeDate(body.dueDate);
  if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  const project = await updateBrainProject(user.sub, id, patch);
  if (!project) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ project });
}

// DELETE /api/brain/projects/:id → 归档项目（软删除）
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await getBrainProject(user.sub, id);
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await archiveBrainProject(user.sub, id);
  return NextResponse.json({ ok: true });
}