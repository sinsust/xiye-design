import { NextRequest, NextResponse } from "next/server";
import { KNOWLEDGE_TYPE_META, type KnowledgeType } from "@/lib/knowledge-types";
import { requireUser } from "@/lib/auth-guard";
import { generateKnowledgeMeta } from "@/lib/knowledge-generator";

export const runtime = "nodejs";

// POST /api/knowledge/generate
// body: { type; name; body?; repoUrl?; source?; localPath? }
// 仅返回 AI（或启发式）完善的 summary / useCase / tags / stack，不落盘，供表单预览。
export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  try {
    const body = await req.json().catch(() => null);
    const type = body?.type as unknown;
    if (typeof type !== "string" || !KNOWLEDGE_TYPE_META.some((m) => m.id === type)) {
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "name_required" }, { status: 400 });
    }
    const meta = await generateKnowledgeMeta({
      type: type as KnowledgeType,
      name,
      body: typeof body?.body === "string" ? body.body : "",
      repoUrl: typeof body?.repoUrl === "string" ? body.repoUrl : "",
      source: typeof body?.source === "string" ? body.source : "",
      localPath: typeof body?.localPath === "string" ? body.localPath : "",
    });
    return NextResponse.json(meta);
  } catch {
    return NextResponse.json({ error: "generate_failed" }, { status: 500 });
  }
}