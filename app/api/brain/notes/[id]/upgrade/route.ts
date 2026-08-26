import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { upgradeBrainNote, listNoteVersions } from "@/lib/brain-db";

export const runtime = "nodejs";

// POST /api/brain/notes/:id/upgrade
// body: { title?; content?; summary?; tags?; category?; isSnippet?; language?; codeContent? }
// 把笔记升级为新版本：旧版标记 superseded=1，新版本 version = 旧 + 1，并继承 related/任务/复习。
// 返回新笔记对象 + 完整版本链（供前端立即渲染时间线）。
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = "then" in ctx.params ? await ctx.params : ctx.params;
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* 空 body 视为全部继承旧版 */
  }
  const b = body as Record<string, unknown>;
  const patch: {
    title?: string;
    content?: string;
    summary?: string;
    tags?: string[];
    category?: string;
    isSnippet?: boolean;
    language?: string | null;
    codeContent?: string | null;
  } = {};
  if (typeof b.title === "string") patch.title = b.title.trim().slice(0, 200);
  if (typeof b.content === "string") patch.content = b.content;
  if (typeof b.summary === "string") patch.summary = b.summary.trim();
  if (typeof b.category === "string") patch.category = b.category.trim();
  if (Array.isArray(b.tags)) patch.tags = b.tags.map(String).filter(Boolean).slice(0, 20);
  if (typeof b.isSnippet === "boolean") patch.isSnippet = b.isSnippet;
  if (typeof b.language === "string") patch.language = b.language.trim() || null;
  if (typeof b.codeContent === "string") patch.codeContent = b.codeContent;

  const { note, invoked } = await upgradeBrainNote(user.sub, id, patch);
  if (!note) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const versions = await listNoteVersions(user.sub, note.id);
  return NextResponse.json({ note, versions, invoked });
}