import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBrainTaskOutcome, updateBrainTaskOutcome } from "@/lib/brain-db";

export const runtime = "nodejs";

const STATUSES = ["resolved", "partial", "new_issue", "no_record"] as const;
type OutcomeStatus = (typeof STATUSES)[number];

function isStatus(v: unknown): v is OutcomeStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

// PUT /api/brain/outcomes/:id  body: { status?; summary?; detail? }
// 编辑一条任务结果（记录 outcome_updated 时间线）。严格按当前用户隔离。
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => null);
    const outcome = await getBrainTaskOutcome(user.sub, id);
    if (!outcome) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const patch: {
      status?: OutcomeStatus;
      summary?: string;
      detail?: string | null;
    } = {};
    if (body?.status !== undefined) {
      if (!isStatus(body.status)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
      patch.status = body.status;
    }
    if (body?.summary !== undefined) patch.summary = String(body.summary).slice(0, 500);
    if (body?.detail !== undefined) {
      patch.detail = typeof body.detail === "string" && body.detail.trim() ? body.detail.trim().slice(0, 4000) : null;
    }
    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }
    const updated = await updateBrainTaskOutcome(user.sub, id, patch);
    if (!updated) return NextResponse.json({ error: "update_failed" }, { status: 500 });
    return NextResponse.json({ outcome: updated });
  } catch (err) {
    console.error("brain outcome update failed:", err);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
}