import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { suggestBrandName } from "@/lib/ai-name-server";

export const runtime = "nodejs";

// POST /api/ai/name
// body: { productText: string }  // 已丰满的产品叙事/brief 文本
// 200 → { name, description }
// 503 → 未配置 DEEPSEEK_API_KEY（客户端回退本地启发式）
// 502 → 模型调用失败
export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  try {
    const body = await req.json().catch(() => null);
    const productText = typeof body?.productText === "string" ? body.productText.trim() : "";
    if (!productText) {
      return NextResponse.json({ error: "empty_input" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "missing_api_key" },
        { status: 503 },
      );
    }

    const sug = await suggestBrandName(productText, apiKey);
    return NextResponse.json(sug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ai_call_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}