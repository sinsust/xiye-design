import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  listBrainStrategies,
  updateBrainStrategy,
  deleteBrainStrategy,
  type BrainStrategyStatus,
} from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES: BrainStrategyStatus[] = ["active", "paused", "achieved", "abandoned"];

function isStatus(v: unknown): v is BrainStrategyStatus {
  return typeof v === "string" && STATUSES.includes(v as BrainStrategyStatus);
}

// GET /api/brain/strategies[?status=active]  → 当前用户全部策略（可过滤状态）
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const status = req.nextUrl.searchParams.get("status");
  const strategies = await listBrainStrategies(
    user.sub,
    status && isStatus(status) ? status : undefined,
  );
  return NextResponse.json({ strategies });
}

// PUT /api/brain/strategies?id=<id>
// body: { status?; title?; description? }  — 仅更新传入字段
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const updates: { status?: BrainStrategyStatus; title?: string; description?: string } = {};
  const b = body as Record<string, unknown>;
  if (b.status && isStatus(b.status)) updates.status = b.status;
  if (typeof b.title === "string") updates.title = b.title.trim().slice(0, 200);
  if (typeof b.description === "string") updates.description = b.description.trim();
  const ok = await updateBrainStrategy(user.sub, id, updates);
  if (!ok) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/brain/strategies?id=<id>  → 删除策略，关联任务 strategyId 置空（不删任务）
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const ok = await deleteBrainStrategy(user.sub, id);
  if (!ok) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}