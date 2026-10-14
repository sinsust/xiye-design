import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getUsageSummary, monthRange } from "@/lib/llm/usage";

export const runtime = "nodejs";

// GET /api/ai/usage?month=YYYY-MM —— 某档案的自然月 AI 调用用量汇总（只读）
// 不传 month 默认当月。仅统计，无上限、无拦截（BYOK：费用归用户自己）。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const month = req.nextUrl.searchParams.get("month");
  const range = monthRange(month);
  const summary = await getUsageSummary(user.sub, range.from, range.to);
  return NextResponse.json({ month: range.month, from: range.from, to: range.to, summary });
}
