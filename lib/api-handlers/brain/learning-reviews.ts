// P4-B：学习笔记复习闭环 API。
//  GET    → 当前用户到期 / 即将到期学习复习列表（含笔记摘要）
//  POST   → { noteId } 加入学习计划（幂等：已存在返回现有）
//  DELETE → ?noteId=xxx 移出学习计划
// 严格按 userId 隔离；复习 action 见 /[id]/action。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  addToLearningPlan,
  removeFromLearningPlan,
  listDueLearningReviews,
  listLearningReviewsWithNotes,
  getLearningReviewByNote,
} from "@/lib/brain-learning-review";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

// GET /api/brain/learning-reviews → { due, upcoming }；?noteId=xxx → { review }
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const noteId = req.nextUrl.searchParams.get("noteId");
    if (noteId) {
      const review = await getLearningReviewByNote(user.sub, noteId);
      return NextResponse.json({ review });
    }
    const now = Date.now();
    const [due, all] = await Promise.all([
      listDueLearningReviews(user.sub, now),
      listLearningReviewsWithNotes(user.sub),
    ]);
    const upcoming = all
      .filter((r) => r.status === "active" && r.nextReviewAt > now)
      .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
    return NextResponse.json({ due, upcoming });
  } catch (err) {
    console.error("learning reviews get failed:", err);
    return NextResponse.json({ error: "learning_reviews_failed" }, { status: 500 });
  }
}

// POST /api/brain/learning-reviews  { noteId } → 加入学习计划
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = (await req.json().catch(() => null)) ?? {};
    const noteId = typeof body.noteId === "string" ? body.noteId : "";
    if (!noteId) return NextResponse.json({ error: "note_id_required" }, { status: 400 });
    const { review, created } = await addToLearningPlan(user.sub, noteId);
    return NextResponse.json({ review, created });
  } catch (err) {
    const msg = safeDetail(err, "");
    if (msg === "note_not_found") {
      return NextResponse.json({ error: "note_not_found" }, { status: 404 });
    }
    if (msg === "note_archived") {
      return NextResponse.json({ error: "note_archived" }, { status: 400 });
    }
    console.error("learning review add failed:", err);
    return NextResponse.json({ error: "add_failed" }, { status: 500 });
  }
}

// DELETE /api/brain/learning-reviews?noteId=xxx → 移出学习计划
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const noteId = req.nextUrl.searchParams.get("noteId") || "";
    if (!noteId) return NextResponse.json({ error: "note_id_required" }, { status: 400 });
    const ok = await removeFromLearningPlan(user.sub, noteId);
    if (!ok) return NextResponse.json({ error: "remove_failed" }, { status: 500 });
    return NextResponse.json({ removed: true });
  } catch (err) {
    console.error("learning review remove failed:", err);
    return NextResponse.json({ error: "remove_failed" }, { status: 500 });
  }
}
