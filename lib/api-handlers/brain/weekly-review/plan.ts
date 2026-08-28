import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildWeeklyReview, saveNextWeekPlan } from "@/lib/brain-review";

export const runtime = "nodejs";

// POST /api/brain/weekly-review/plan
// 「生成下周计划」：把本周复盘的下周建议 → 一条 pending_confirmation ProcessingPlan。
// 绝不直接创建任务/提醒/关系；用户仍需在 StructPreview 确认后才由 applyProcessingPlan 落库。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const at = Number((await req.json().catch(() => null))?.at || Date.now()) || Date.now();
    const review = await buildWeeklyReview(user.sub, at);
    const plan = await saveNextWeekPlan(user.sub, review);
    if (!plan) return NextResponse.json({ error: "plan_create_failed" }, { status: 500 });
    return NextResponse.json({ plan, body: JSON.parse(plan.planJson) });
  } catch (err) {
    console.error("weekly review plan failed:", err);
    return NextResponse.json({ error: "plan_create_failed" }, { status: 500 });
  }
}