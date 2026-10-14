import { NextRequest, NextResponse } from "next/server";
import { KNOWLEDGE_TYPE_META, type KnowledgeType } from "@/lib/knowledge-types";
import { requireUser } from "@/lib/auth-guard";
import { generateKnowledgeMeta } from "@/lib/knowledge-generator";
import { resolveLLM } from "@/lib/llm/resolve";
import { MODEL_NOT_CONFIGURED_MESSAGE } from "@/lib/llm/chat";

export const runtime = "nodejs";

// POST /api/knowledge/generate
// body: { type; name; body?; repoUrl?; source?; localPath? }
// 仅返回 AI（或启发式）完善的 summary / useCase / tags / stack，不落盘，供表单预览。
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
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
    // 统一 LLM 层解析模型；未配置任何模型 → 明确报错（不再有内置兜底）
    const model = await resolveLLM(user.sub, "knowledge");
    if (!model) {
      return NextResponse.json({ error: "model_not_configured", message: MODEL_NOT_CONFIGURED_MESSAGE }, { status: 412 });
    }
    const meta = await generateKnowledgeMeta({
      type: type as KnowledgeType,
      name,
      body: typeof body?.body === "string" ? body.body : "",
      repoUrl: typeof body?.repoUrl === "string" ? body.repoUrl : "",
      source: typeof body?.source === "string" ? body.source : "",
      localPath: typeof body?.localPath === "string" ? body.localPath : "",
    }, model);
    return NextResponse.json(meta);
  } catch {
    return NextResponse.json({ error: "generate_failed" }, { status: 500 });
  }
}