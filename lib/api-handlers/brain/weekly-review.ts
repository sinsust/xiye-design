import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBrainWeeklyReview, upsertBrainWeeklyReview } from "@/lib/brain-db";
import { buildWeeklyReview, computeWeekBounds } from "@/lib/brain-review";

export const runtime = "nodejs";

// GET /api/brain/weekly-review?at=<ts>
// 返回本周（或指定时间所在周）规则化复盘 + 该周已保存的复盘（有则）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Number(req.nextUrl.searchParams.get("at") || Date.now()) || Date.now();
    const { weekKey } = computeWeekBounds(at);
    const review = await buildWeeklyReview(user.sub, at);
    const saved = await getBrainWeeklyReview(user.sub, weekKey);
    return NextResponse.json({ review, saved });
  } catch (err) {
    console.error("weekly review get failed:", err);
    return NextResponse.json({ error: "review_failed" }, { status: 500 });
  }
}

// POST /api/brain/weekly-review
// 保存当周复盘（服务端权威重算，同周幂等覆盖）。只写一份「复盘」快照，不创建任何任务/提醒/关系。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Number(
      (await req.json().catch(() => null))?.at || Date.now(),
    ) || Date.now();
    const review = await buildWeeklyReview(user.sub, at);
    const saved = await upsertBrainWeeklyReview(user.sub, {
      weekKey: review.weekKey,
      weekLabel: review.weekLabel,
      periodStart: review.periodStart,
      periodEnd: review.periodEnd,
      summary: review.summary,
      payloadJson: JSON.stringify(review),
    });
    if (!saved) return NextResponse.json({ error: "save_failed" }, { status: 500 });
    return NextResponse.json({ review, saved });
  } catch (err) {
    console.error("weekly review save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}