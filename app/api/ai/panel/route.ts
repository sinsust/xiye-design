import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { consultAgents } from "@/lib/ai-panel-server";
import { type ProductBrief } from "@/lib/ai-discover";

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
  if (!rateLimit(`ai:${getClientIp(req)}`, 30, 60_000)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json" } });
  }
  try {
    const body = await req.json().catch(() => null);
    const brief: ProductBrief | null =
      body?.brief && typeof body.brief === "object"
        ? (body.brief as ProductBrief)
        : null;

    const messages = Array.isArray(body?.messages)
      ? (body.messages as { role: string; content: string }[])
      : undefined;

    const apiKey = process.env.DEEPSEEK_API_KEY;
    const agents = parseAgents(body?.agents);
    const results = await consultAgents(brief, apiKey, messages, agents);
    return NextResponse.json({ agents: results });
  } catch (err) {
    console.error("[api/ai/panel] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ agents: [] }, { status: 200 });
  }
}
