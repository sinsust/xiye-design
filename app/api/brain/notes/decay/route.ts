import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { getDecayedNotes, logBrainNoteAccess } from "@/lib/brain-reminder";
import { db, brainNotes } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/brain/notes/decay → 衰减笔记列表（60 天无访问）＋ 总数
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const notes = await getDecayedNotes(user.sub);
  return NextResponse.json({ notes, total: notes.length });
}

// POST /api/brain/notes/decay
// body: { id; action: "keep"|"archive"|"delete" }
// keep → 记一次 view 访问，重置衰减计时；archive/delete → superseded=1（软删除）
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const action = body?.action === "archive" || body?.action === "delete" ? body.action : body?.action === "keep" ? "keep" : "";
    if (!id || !action) return NextResponse.json({ error: "id_or_action_required" }, { status: 400 });

    if (action === "keep") {
      await logBrainNoteAccess(id, "view");
    } else {
      await db
        .update(brainNotes)
        .set({ superseded: 1 })
        .where(and(eq(brainNotes.id, id), eq(brainNotes.userId, user.sub)));
    }
    const notes = await getDecayedNotes(user.sub);
    return NextResponse.json({ ok: true, total: notes.length });
  } catch (err) {
    console.error("[reminder] decay action failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}