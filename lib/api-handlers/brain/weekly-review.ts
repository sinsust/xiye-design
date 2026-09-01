import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getBrainWeeklyReview, upsertBrainWeeklyReview } from "@/lib/brain-db";
import { buildWeeklyReview, computeWeekBounds } from "@/lib/brain-review";

export const runtime = "nodejs";

// P3：多表聚合成本较高，按 userId+weekKey 缓存 60s，避免每次打开实时重算。
const REVIEW_TTL_MS = 60_000;
const reviewCache = new Map<string, { ts: number; at: number; weekKey: string; review: unknown; saved: unknown }>();

// GET /api/brain/weekly-review?at=<ts>
// 返回本周（或指定时间所在周）规则化复盘 + 该周已保存的复盘（有则）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Number(req.nextUrl.searchParams.get("at") || Date.now()) || Date.now();
    const { weekKey } = computeWeekBounds(at);
    const cacheKey = `${user.sub}:${weekKey}`;
    const hit = reviewCache.get(cacheKey);
    if (hit && hit.at === at && Date.now() - hit.ts < REVIEW_TTL_MS) {
      return NextResponse.json({ review: hit.review, saved: hit.saved });
    }
    const review = await buildWeeklyReview(user.sub, at);
    const saved = await getBrainWeeklyReview(user.sub, weekKey);
    reviewCache.set(cacheKey, { ts: Date.now(), at, weekKey, review, saved });
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
    // 失效缓存，确保下次读取返回最新 saved 状态
    for (const k of [...reviewCache.keys()]) if (k.startsWith(`${user.sub}:`)) reviewCache.delete(k);
    return NextResponse.json({ review, saved });
  } catch (err) {
    console.error("weekly review save failed:", err);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}