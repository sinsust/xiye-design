import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listBrainSnippets } from "@/lib/brain-db";

export const runtime = "nodejs";

// GET /api/brain/snippets[?language=python] → 当前用户所有代码片段（isSnippet=1），可选按语言过滤。
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const language = req.nextUrl.searchParams.get("language") || undefined;
  const items = await listBrainSnippets(user.sub, language);
  return NextResponse.json({
    snippets: items.map((n) => ({
      id: n.id,
      title: n.title,
      language: n.language,
      codeContent: n.codeContent,
      tags: n.tags,
      summary: n.summary,
      createdAt: n.createdAt,
      version: n.version,
      superseded: n.superseded,
    })),
  });
}