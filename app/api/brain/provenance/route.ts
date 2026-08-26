import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildProvenance } from "@/lib/brain-provenance";

export const runtime = "nodejs";

// GET /api/brain/provenance
// 来源/产出回溯统一接口（只读当前用户数据）：
//   ?noteId=… | ?taskId=… | ?reminderId=… | ?inboxId=… | ?planId=…
// 从任意产出对象反查「原始来源 → AI 整理 → 用户确认 → 正式产出」链路。
// 未命中或无权限时返回 found=false，绝不泄露其他用户数据。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const input = {
    noteId: sp.get("noteId"),
    taskId: sp.get("taskId"),
    reminderId: sp.get("reminderId"),
    inboxId: sp.get("inboxId"),
    planId: sp.get("planId"),
  };
  const hasAnchor = Boolean(input.noteId || input.taskId || input.reminderId || input.inboxId || input.planId);
  if (!hasAnchor) {
    return NextResponse.json({ error: "anchor_required" }, { status: 400 });
  }
  try {
    const view = await buildProvenance(user.sub as string, input);
    return NextResponse.json(view);
  } catch (err) {
    console.error("brain provenance failed:", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}