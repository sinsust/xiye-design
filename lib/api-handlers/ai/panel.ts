import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { consultAgents } from "@/lib/ai-panel-server";
import { type ProductBrief } from "@/lib/ai-discover";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";

export const runtime = "nodejs";

const ROLE_KEYS = ["moderator", "pm", "architect", "designer", "guard"] as const;
/** 客户端传来的人群名覆盖：{ role, name }[]，用于个性化 AI 人设 */
function parseAgents(v: unknown): { role: string; name: string }[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is { role: string; name: string } =>
      !!x &&
      typeof x === "object" &&
      (ROLE_KEYS as readonly string[]).includes((x as { role?: unknown }).role as string) &&
      typeof (x as { name?: unknown }).name === "string",
  );
}

// POST /api/ai/panel
// body: { brief: ProductBrief | null }
// 200 → { agents: PanelAgentResult[] }
// 无 key / 异常：返回启发式兜底结果（不中断前端）

export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.panel, phase: "panel", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", agents: [], flowMeta: meta }, { status: 429 });
  }
  try {
    const body = rawBody;
    const brief: ProductBrief | null =
      body?.brief && typeof body.brief === "object"
        ? (body.brief as ProductBrief)
        : null;

    const messages = Array.isArray(body?.messages)
      ? (body.messages as { role: string; content: string }[])
      : undefined;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const agents = parseAgents(body?.agents);
    if (!apiKey) {
      // 无 key：启发式兜底
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: true }));
      const results = await consultAgents(brief, undefined, messages, agents);
      return NextResponse.json({ agents: results, flowMeta: meta });
    }
    try {
      const results = await consultAgents(brief, apiKey, messages, agents);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
      return NextResponse.json({ agents: results, flowMeta: meta });
    } catch (err) {
      console.error("[api/ai/panel] failed:", err instanceof Error ? err.message : err);
      // 失败 ≠ 空：回显失败元信息，前端据此把专家置为「暂未完成」，绝不误标「已完成」
      const code = "provider_unavailable";
      const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj, fallbackUsed: true }));
      return NextResponse.json({ agents: [], error: code, flowMeta: meta }, { status: 200 });
    }
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ agents: [], error: "unknown", flowMeta: meta }, { status: 200 });
  }
}
