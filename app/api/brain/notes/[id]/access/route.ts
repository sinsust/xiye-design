import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { logBrainNoteAccess, type AccessType } from "@/lib/brain-reminder";

export const runtime = "nodejs";

// POST /api/brain/notes/:id/access
// body: { type?: "view"|"edit"|"rag_reference"|"review" }（默认 view）
// 前端/调用方在打开/编辑/引用笔记时写入访问流水，供知识衰减判定。
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const type: AccessType =
    body?.type === "edit" || body?.type === "rag_reference" || body?.type === "review" ? body.type : "view";
  await logBrainNoteAccess(id, type);
  return NextResponse.json({ ok: true });
}