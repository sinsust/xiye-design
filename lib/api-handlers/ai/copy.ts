import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { logAuditReq, AUDIT_ACTION } from "@/lib/audit-log";
import { generateCopyOverride, type CopyContext } from "@/lib/copy-generator";
import { generateCopyWithLLM } from "@/lib/copy-generator-server";
import { resolveLLM } from "@/lib/llm/resolve";
import { MODEL_NOT_CONFIGURED_MESSAGE } from "@/lib/llm/chat";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";

export const runtime = "nodejs";

// POST /api/ai/copy
// body: { projectName?; projectType?; narrative? }
// 200  → ContentOverride（根据项目 PRD/特征生成的全站文案覆盖）
// 文案生成走统一 LLM 层解析模型；调用失败时回退本地启发式
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  void logAuditReq(req, { userId: user.sub, action: AUDIT_ACTION.AI_CALL, targetType: "ai", targetId: "copy" });
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.siteCopy, phase: "copy", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  const limited = !await rateLimit(`ai:${getClientIp(req)}`, 30, 60_000);
  if (limited) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  try {
    const body = rawBody;
    const ctx: CopyContext = {
      projectName: typeof body?.projectName === "string" ? body.projectName : null,
      projectType: typeof body?.projectType === "string" ? body.projectType : null,
      narrative: body?.narrative && typeof body.narrative === "object" ? body.narrative : null,
    };

    const model = await resolveLLM(user.sub, "copy");
    if (!model) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("model_not_configured", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "model_not_configured", message: MODEL_NOT_CONFIGURED_MESSAGE, flowMeta: meta }, { status: 412 });
    }
    let fallbackUsed = true;
    try {
      const override = await generateCopyWithLLM(ctx, model);
      fallbackUsed = false;
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
      return NextResponse.json({ ...override, flowMeta: meta });
    } catch {
      // 模型失败 → 回退启发式
    }
    const override = generateCopyOverride(ctx);
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed }));
    return NextResponse.json({ ...override, flowMeta: meta });
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "copy_failed", flowMeta: meta }, { status: 502 });
  }
}