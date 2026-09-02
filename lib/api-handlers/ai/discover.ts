import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import {
  discover,
  runDiscoveryHeuristic,
} from "@/lib/ai-discover-server";
import {
  emptyBrief,
  type DiscoverMessage,
  type ProductBrief,
} from "@/lib/ai-discover";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";
import { getStyle } from "@/lib/agent-styles";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

// 客户端传来的人群名覆盖（这里只关心老鸨子/主持人姓名）
function moderatorName(v: unknown): string | undefined {
  if (!Array.isArray(v)) return undefined;
  const found = v.find(
    (x) =>
      !!x &&
      typeof x === "object" &&
      (x as { role?: unknown }).role === "moderator" &&
      typeof (x as { name?: unknown }).name === "string",
  );
  return found ? ((found as { name: string }).name.trim() || undefined) : undefined;
}

// POST /api/ai/discover
// body: { messages: DiscoverMessage[], brief: ProductBrief | null }
// 200 → DiscoverResponse { reply, branches, brief, done }
// 失败（网络/超时）→ 优雅降级：200 + 提示文案，brief 原样回传，不丢对话

function isMessage(v: unknown): v is DiscoverMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return m.role === "user" || m.role === "assistant";
}

export async function POST(req: NextRequest) {
  const { res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.discover, phase: "dialog", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  try {
    const body = rawBody;
    const messages: DiscoverMessage[] = Array.isArray(body?.messages)
      ? body.messages.filter(isMessage)
      : [];
    const brief: ProductBrief | null =
      body?.brief && typeof body.brief === "object"
        ? (body.brief as ProductBrief)
        : null;

    if (!messages.length) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "empty_messages", flowMeta: meta }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // 无 key：首轮启发式兜底（保证 UI 永远能跑起来）
      const first = messages.find((m) => m.role === "user");
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: true }));
      return NextResponse.json({ ...runDiscoveryHeuristic(first?.content ?? ""), flowMeta: meta });
    }

    try {
      const pay = await discover(
        messages,
        brief,
        apiKey,
        moderatorName(body?.agents) ?? getStyle(body?.styleId).moderatorTitle,
      );
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
      return NextResponse.json({ ...pay, flowMeta: meta });
    } catch (err) {
      // 模型调用失败：不中断对话、不伪装成功。保留已入文的用户/项目状态，brief 原样回传。
      const reason = safeDetail(err);
      console.error("[api/ai/discover] failed:", reason);
      // 映射为统一错误码（network→provider_unavailable，http→provider_unavailable，parse/schema→invalid_response）
      const code =
        reason.startsWith("network:") || reason.startsWith("http:")
          ? "provider_unavailable"
          : reason.startsWith("parse:") || reason.startsWith("schema:")
            ? "invalid_response"
            : "unknown";
      const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj, fallbackUsed: true }));
      return NextResponse.json({
        reply: errObj.message,
        branches: [],
        brief: brief ?? emptyBrief(),
        done: false,
        error: code,
        flowMeta: meta,
      });
    }
  } catch {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "bad_request", flowMeta: meta }, { status: 400 });
  }
}
