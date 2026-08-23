import { NextRequest, NextResponse } from "next/server";
import { interpretIntentOnline } from "@/lib/ai-intent-server";

export const runtime = "nodejs";

// POST /api/ai/intent
// body: { text: string }
// 200 → IntentRecommendation
// 503 → 未配置 DEEPSEEK_API_KEY（客户端回退启发式）
// 400/502 → 参数或 DeepSeek 调用错误
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      return NextResponse.json({ error: "empty_input" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "missing_api_key" },
        { status: 503 },
      );
    }

    const rec = await interpretIntentOnline(text, apiKey);
    return NextResponse.json(rec);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ai_call_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}