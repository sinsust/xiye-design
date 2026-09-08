import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listNoteVersions, getBrainNote } from "@/lib/brain-db";

export const runtime = "nodejs";

// GET /api/brain/notes/:id/versions → 沿版本链从初版到最新，返回可完整渲染旧版的笔记对象
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const params = "then" in ctx.params ? await ctx.params : ctx.params;
  const { id } = params;
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  const chain = await listNoteVersions(user.sub, id);
  return NextResponse.json({
    versions: chain.map((n) => ({
      id: n.id,
      userId: n.userId,
      source: n.source,
      title: n.title,
      content: n.content,
      category: n.category,
      summary: n.summary,
      tags: n.tags,
      related: n.related,
      parentId: n.parentId,
      version: n.version,
      superseded: n.superseded,
      isSnippet: n.isSnippet,
      language: n.language,
      codeContent: n.codeContent,
      struct: n.struct,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    current: (await getBrainNote(user.sub, id))?.id ?? null,
  });
}
