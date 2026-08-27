import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { interpretIntentOnline } from "@/lib/ai-intent-server";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";

export const runtime = "nodejs";

// POST /api/ai/intent
// body: { text: string }
// 200 → IntentRecommendation
// 503 → 未配置 DEEPSEEK_API_KEY（客户端回退启发式）
// 400/502 → 参数或 DeepSeek 调用错误
export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.intent, phase: "intent", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  try {
    const body = rawBody;
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "empty_input", flowMeta: meta }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("provider_unavailable", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "missing_api_key", flowMeta: meta }, { status: 503 });
    }

    const rec = await interpretIntentOnline(text, apiKey);
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
    return NextResponse.json({ ...rec, flowMeta: meta });
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("provider_unavailable", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "intent_failed", flowMeta: meta }, { status: 502 });
  }
}