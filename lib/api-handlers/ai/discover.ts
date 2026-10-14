import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { logAuditReq, AUDIT_ACTION } from "@/lib/audit-log";
import { discover } from "@/lib/ai-discover-server";
import {
  emptyBrief,
  type DiscoverMessage,
  type ProductBrief,
} from "@/lib/ai-discover";
import { resolveLLM } from "@/lib/llm/resolve";
import { FLOW_OPERATION, flowError, flowMetaDone, flowMetaRunning, flowMetaToJSON } from "@/lib/flow-ai-types";
import { getStyle } from "@/lib/agent-styles";
import { safeDetail } from "@/lib/api-error";
import {
  loadProjectPreferences,
  formatPreferencesSummary,
} from "@/lib/project-preferences";

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
  const { user, res } = await requireUser();
  if (res) return res;
  void logAuditReq(req, { userId: user.sub, action: AUDIT_ACTION.AI_CALL, targetType: "ai", targetId: "discover" });
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const running = flowMetaRunning({ operation: FLOW_OPERATION.discover, phase: "dialog", operationId: typeof rawBody?.operationId === "string" ? rawBody.operationId : undefined });
  if (!await rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
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

    const model = await resolveLLM(user.sub, "flow-discover");
    if (!model) {
      const errObj = flowError("model_not_configured", { operation: running.operation, phase: running.phase, requestId: running.requestId });
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
      return NextResponse.json({
        reply: errObj.message,
        branches: [],
        brief: brief ?? emptyBrief(),
        done: false,
        error: "model_not_configured",
        message: errObj.message,
        flowMeta: meta,
      });
    }

    try {
      // B1：加载用户历史偏好作为推荐底座（读 DB 失败静默，不影响访谈）
      const prefs = await loadProjectPreferences(user.sub).catch(() => null);
      const prefsUsed = prefs
        ? { count: prefs.sampleCount, summary: formatPreferencesSummary(prefs) }
        : null;
      const pay = await discover(
        messages,
        brief,
        model,
        moderatorName(body?.agents) ?? getStyle(body?.styleId).moderatorTitle,
        prefs,
      );
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: false }));
      return NextResponse.json({ ...pay, flowMeta: meta, prefsUsed });
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
