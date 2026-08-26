import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { organizeToPlan } from "@/lib/brain-plan";

export const runtime = "nodejs";

// POST /api/brain/organize
// body: { content; source? }
// 对用户随手丢进来的原始文本做 AI 转译，生成并持久化一条「待确认」ProcessingPlan（pending_confirmation）。
// AI 阶段绝不直接创建任务/提醒/项目关系——只写 plan_json，等待用户确认后由统一写入服务落库。
// 返回 { plan, body, duplicate }，刷新/重登后仍可按 plan.id 恢复。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });
    const source =
      typeof body?.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 40)
        : "workbench";

    const { plan, body: planBody, duplicate } = await organizeToPlan(user.sub, { rawContent: content, source });
    if (!plan) return NextResponse.json({ error: "plan_create_failed" }, { status: 500 });
    return NextResponse.json({ plan, body: planBody, duplicate });
  } catch (err) {
    console.error("brain organize failed:", err);
    return NextResponse.json({ error: "organize_failed" }, { status: 500 });
  }
}