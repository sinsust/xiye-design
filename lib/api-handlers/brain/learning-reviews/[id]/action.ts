// P4-B：学习复习动作 API。
//  POST /api/brain/learning-reviews/:id/action  { action, days? }
//  action ∈ mastered / not_sure / snooze / pause / resume
//  幂等：双击 / 未到期 / 状态不允许 → noop，不推进 stage。
//  严格按 userId 隔离；action 不修改学习笔记正文。
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  applyLearningReviewAction,
  getLearningReview,
  type LearningReviewAction,
} from "@/lib/brain-learning-review";
import { getBrainNote } from "@/lib/brain-db";

export const runtime = "nodejs";

const ACTIONS: LearningReviewAction[] = [
  "mastered",
  "not_sure",
  "snooze",
  "pause",
  "resume",
];

// POST /api/brain/learning-reviews/[id]/action
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => null)) ?? {};
    const action = body.action;
    if (!ACTIONS.includes(action)) {
      return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    const days =
      typeof body.days === "number" && body.days > 0 ? Math.round(body.days) : undefined;

    const result = await applyLearningReviewAction(user.sub, id, action, { days });
    if (!result) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // 返回结构：当前复习状态 + 下一次时间 + 行动结果 + 关联笔记摘要
    const note = await getBrainNote(user.sub, result.review.noteId);
    return NextResponse.json({
      review: result.review,
      event: result.event,
      noop: result.noop,
      reason: result.reason ?? null,
      note: note
        ? { id: note.id, title: note.title, summary: note.summary }
        : null,
    });
  } catch (err) {
    console.error("learning review action failed:", err);
    return NextResponse.json({ error: "action_failed" }, { status: 500 });
  }
}

// GET /api/brain/learning-reviews/[id] → 单条复习状态（含笔记摘要）
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { id } = await ctx.params;
    const review = await getLearningReview(user.sub, id);
    if (!review) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const note = await getBrainNote(user.sub, review.noteId);
    return NextResponse.json({
      review,
      note: note
        ? { id: note.id, title: note.title, summary: note.summary }
        : null,
    });
  } catch (err) {
    console.error("learning review get failed:", err);
    return NextResponse.json({ error: "get_failed" }, { status: 500 });
  }
}
