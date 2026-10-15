import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveLLM } from "@/lib/llm/resolve";
import { isFeatureKey } from "@/lib/llm/features";

export const runtime = "nodejs";

/**
 * GET /api/ai/models/current —— 当前生效（或某功能专属）模型的摘要，供前端展示。
 * 绝不返回明文 apiKey；feature 可选（来自 query，必须是已登记的 FeatureKey），
 * 传了则返回该功能经 featureMap 覆盖后解析到的模型，否则返回「当前生效模型」。
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const f = req.nextUrl.searchParams.get("feature");
  const feature = f && isFeatureKey(f) ? f : undefined;
  const m = await resolveLLM(user.sub, feature);
  if (!m) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({
    configured: true,
    id: m.id,
    name: m.name,
    provider: m.provider,
    model: m.model,
    baseUrl: m.baseUrl,
    source: m.source,
  });
}
