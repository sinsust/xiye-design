import { NextRequest, NextResponse } from "next/server";
import {
  discover,
  runDiscoveryHeuristic,
} from "@/lib/ai-discover-server";
import {
  emptyBrief,
  type DiscoverMessage,
  type ProductBrief,
} from "@/lib/ai-discover";

export const runtime = "nodejs";

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
  try {
    const body = await req.json().catch(() => null);
    const messages: DiscoverMessage[] = Array.isArray(body?.messages)
      ? body.messages.filter(isMessage)
      : [];
    const brief: ProductBrief | null =
      body?.brief && typeof body.brief === "object"
        ? (body.brief as ProductBrief)
        : null;

    if (!messages.length) {
      return NextResponse.json({ error: "empty_messages" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      // 无 key：首轮启发式兜底（保证 UI 永远能跑起来）
      const first = messages.find((m) => m.role === "user");
      return NextResponse.json(runDiscoveryHeuristic(first?.content ?? ""));
    }

    try {
      const res = await discover(messages, brief, apiKey);
      return NextResponse.json(res);
    } catch (err) {
      // DeepSeek 调用失败：不中断对话，回传降级提示，brief 原样保留
      const reason = err instanceof Error ? err.message : "unknown";
      console.error("[api/ai/discover] failed:", reason);
      const kind = reason.startsWith("network:")
        ? "network"
        : reason.startsWith("http:")
          ? "api"
          : reason.startsWith("parse:")
            ? "parse"
            : "unknown";
      return NextResponse.json({
        reply:
          kind === "network"
            ? "（网络连不上 AI 服务，请检查网络后重试，或继续用文字补充想法。）"
            : kind === "api"
              ? "（AI 服务返回异常，请稍后重试，或继续用文字补充想法。）"
              : kind === "parse"
                ? "（AI 返回内容解析失败，已记录日志，请重试或继续补充想法。）"
                : "（AI 服务暂时不可用，你可以用文字继续补充想法，或稍后重试。我已保留当前进度。）",
        branches: [],
        brief: brief ?? emptyBrief(),
        done: false,
        error: kind,
      });
    }
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
