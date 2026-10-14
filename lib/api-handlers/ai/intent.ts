import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { logAuditReq, AUDIT_ACTION } from "@/lib/audit-log";
import { interpretIntentOnline } from "@/lib/ai-intent-server";
import { resolveLLM } from "@/lib/llm/resolve";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";

export const runtime = "nodejs";

// POST /api/ai/intent
// body: { text: string }
// 200 → IntentRecommendation
// 400/502 → 参数或模型调用错误
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  void logAuditReq(req, { userId: user.sub, action: AUDIT_ACTION.AI_CALL, targetType: "ai", targetId: "intent" });
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.intent, phase: "intent", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  if (!await rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
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

    const model = await resolveLLM(user.sub, "flow-intent");
    if (!model) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("model_not_configured", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "model_not_configured", flowMeta: meta }, { status: 412 });
    }
    const rec = await interpretIntentOnline(text, model);
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
    return NextResponse.json({ ...rec, flowMeta: meta });
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("provider_unavailable", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "intent_failed", flowMeta: meta }, { status: 502 });
  }
}