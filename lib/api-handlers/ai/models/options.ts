import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { getModelById } from "@/lib/llm/config-store";
import { listProviderModels } from "@/lib/llm/validate-model";

export const runtime = "nodejs";

const schema = z.object({
  // 已存配置：留空 API Key 时用库里那把（明文不回传前端）
  id: z.string().max(200).optional(),
  baseUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().max(500).nullable().optional(),
});

// POST /api/ai/models/options —— 拉取该端点/该 key 真实可用的模型名。
// 界面据此给下拉，而不是让人抄一份早就过期的内置清单（见 lib/llm/providers.ts 的说明）。
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { id, baseUrl, apiKey } = parsed.data;

  let targetBase = baseUrl?.trim() ?? "";
  let targetKey = apiKey?.trim() ?? "";

  if (!targetBase || !targetKey) {
    if (!id) {
      return NextResponse.json(
        { error: "missing_target", message: "需要先填 Base URL 与 API Key，或指定要查的已存模型" },
        { status: 400 },
      );
    }
    const stored = await getModelById(user.sub, id);
    if (!stored) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    targetBase = targetBase || stored.baseUrl;
    targetKey = targetKey || stored.apiKey;
  }

  const { models, skipped } = await listProviderModels({ baseUrl: targetBase, apiKey: targetKey });
  return NextResponse.json({ models, skipped: skipped ?? null });
}
