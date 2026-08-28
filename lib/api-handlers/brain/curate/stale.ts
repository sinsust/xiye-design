import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { decideStale } from "@/lib/brain-curate";

export const runtime = "nodejs";

// POST /api/brain/curate/stale  body: { noteId, action: "keep"|"reorganize"|"archive", reason? }
//   「可能过期」笔记的决策：审计保留用户选择；keep/reorganize 刷新 updatedAt，archive 走 superseded 软归档。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const noteId = typeof body?.noteId === "string" ? body.noteId : "";
    const action = body?.action;
    if (!noteId || !["keep", "reorganize", "archive"].includes(action)) {
      return NextResponse.json({ error: "noteId_or_action_required" }, { status: 400 });
    }
    const reason = body?.reason === "not_referenced" ? "not_referenced" : body?.reason === "not_updated" ? "not_updated" : undefined;
    const ok = await decideStale(user.sub as string, noteId, action, reason);
    if (!ok) return NextResponse.json({ error: "not_found_or_not_owner" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("brain curate stale decision failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}