import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainNotes } from "@/lib/brain-db";
import { organizeNote, findDuplicateNote } from "@/lib/brain-organizer";

export const runtime = "nodejs";

// POST /api/brain/organize
// body: { content }
// 对用户随手丢进来的原始文本做 AI 整理，返回结构化草稿（不落库），供前端"确认入库"。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });

    const existing = await listBrainNotes(user.sub);
    const organized = await organizeNote(content, existing);
    // 近似重复检测：提示是否更新已有笔记
    const duplicate = findDuplicateNote(content, existing);
    return NextResponse.json({ draft: organized, duplicate });
  } catch (err) {
    console.error("brain organize failed:", err);
    return NextResponse.json({ error: "organize_failed" }, { status: 500 });
  }
}