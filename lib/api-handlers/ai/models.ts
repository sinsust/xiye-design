import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { z } from "zod";
import { listModels, createModel, getSettings } from "@/lib/llm/config-store";
import { PROVIDERS } from "@/lib/llm/providers";
import { FEATURES } from "@/lib/llm/features";
import { checkModelAvailable } from "@/lib/llm/validate-model";

export const runtime = "nodejs";

// GET /api/ai/models —— 模型列表（含内置项）+ 当前生效策略 + 服务商模板 + 功能清单
// 返回体绝不包含明文 Key（仅 hasKey）
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [models, settings] = await Promise.all([
    listModels(user.sub),
    getSettings(user.sub),
  ]);
  return NextResponse.json({ models, settings, providers: PROVIDERS, features: FEATURES });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider: z.string().min(1).max(50),
  baseUrl: z.string().trim().min(1).max(500),
  model: z.string().trim().min(1).max(200),
  // 允许留空（无需 Key 的服务商）；非空则加密落库
  apiKey: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

// POST /api/ai/models —— 新增模型
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const d = parsed.data;
  // 先问厂商「这个名字真的能用吗」再落库：模型名下架/写错如果留到调用时才暴露，
  // 会被各功能的启发式兜底吞成「AI 服务暂时不可用」，用户无从下手。
  const check = await checkModelAvailable({
    baseUrl: d.baseUrl.trim(),
    apiKey: d.apiKey?.trim() ?? "",
    model: d.model.trim(),
  });
  if (!check.ok) {
    return NextResponse.json({ error: "model_unavailable", message: check.message }, { status: 400 });
  }
  const model = await createModel(user.sub, {
    name: d.name.trim(),
    provider: d.provider,
    baseUrl: d.baseUrl.trim(),
    model: d.model.trim(),
    apiKey: d.apiKey?.trim() ? d.apiKey.trim() : null,
    sortOrder: d.sortOrder ?? 0,
  });
  return NextResponse.json({ model });
}