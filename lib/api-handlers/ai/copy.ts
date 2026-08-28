import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import {
  generateCopyOverride,
  generateCopyWithLLM,
  type CopyContext,
} from "@/lib/copy-generator";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";

export const runtime = "nodejs";

// POST /api/ai/copy
// body: { projectName?; projectType?; narrative? }
// 200  → ContentOverride（根据项目 PRD/特征生成的全站文案覆盖）
// 文案生成默认使用 LLM_MODEL_*（Qwen），不走 DeepSeek；未配置或调用失败时回退本地启发式
export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.siteCopy, phase: "copy", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  const limited = !rateLimit(`ai:${getClientIp(req)}`, 30, 60_000);
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

    const baseUrl = process.env.LLM_MODEL_BASE_URL;
    const model = process.env.LLM_MODEL_MODEL_ID;
    const apiKey = process.env.LLM_MODEL_API_KEY;
    let fallbackUsed = true;
    if (baseUrl && model && apiKey) {
      try {
        const override = await generateCopyWithLLM(ctx, apiKey, baseUrl, model);
        fallbackUsed = false;
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
        return NextResponse.json({ ...override, flowMeta: meta });
      } catch {
        // Qwen 失败 → 回退启发式
      }
    }
    const override = generateCopyOverride(ctx);
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed }));
    return NextResponse.json({ ...override, flowMeta: meta });
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "copy_failed", flowMeta: meta }, { status: 502 });
  }
}