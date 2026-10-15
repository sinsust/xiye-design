import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { resolveLLM } from "@/lib/llm/resolve";
import { MODEL_NOT_CONFIGURED_MESSAGE } from "@/lib/llm/chat";

export const runtime = "nodejs";

type AgentEnhancement = {
  aiConventions: string[];
  gotchas: string[];
  acceptanceAdditions: string[];
};

/**
 * POST /api/ai/agent-manifest
 * P1-3：让 AI 基于项目结构（前端拼好的 brief）生成「开发契约增强」，
 * 兑现 deliver 阶段 AI 参与代码契约生成（而非纯静态拼装 xiye.agent.json）。
 * 返回 { aiEnhancement }，由 deliver-stage 合并进 xiye.agent.json。
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    const brief = typeof body?.brief === "string" ? body.brief.trim() : "";
    if (!brief) return NextResponse.json({ error: "brief_required" }, { status: 400 });

    const model = await resolveLLM(user.sub, "agent-manifest");
    if (!model) {
      return NextResponse.json({ error: "model_not_configured", message: MODEL_NOT_CONFIGURED_MESSAGE }, { status: 412 });
    }

    const res = await fetch(`${model.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model.model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是资深全栈架构师，负责为 AI 编码 Agent 生成『开发契约增强』。只输出一个 JSON 对象，禁止任何前后解释、禁止 markdown 代码块。结构：{ \"aiConventions\": string[]（3-6 条本项目特有的开发约定/协作纪律，具体可执行）, \"gotchas\": string[]（2-4 条本项目易踩的坑/反模式）, \"acceptanceAdditions\": string[]（2-4 条补充验收点） }。",
          },
          { role: "user", content: `项目信息：\n${brief}\n\n请基于上述项目生成开发契约增强。` },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error(`agent_manifest_${res.status}`);
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const parsed = parseAgentManifest(text);
    if (!parsed) throw new Error("agent_manifest_parse_failed");
    return NextResponse.json({ aiEnhancement: parsed });
  } catch (err) {
    console.error("agent-manifest failed:", err);
    return NextResponse.json({ error: "agent_manifest_failed", detail: String(err) }, { status: 500 });
  }
}

/** 三层防御解析：直接解析 → 提取 ```json → 括号平衡截取（抗截断） */
function parseAgentManifest(text: string): AgentEnhancement | null {
  const candidates = [text.trim()];
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) candidates.push(m[1].trim());
  for (const c of candidates) {
    const j = safeJson(c);
    if (j && Array.isArray(j.aiConventions)) {
      return normalize(j);
    }
  }
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s !== -1 && e > s) {
    const j = safeJson(text.slice(s, e + 1));
    if (j && Array.isArray(j.aiConventions)) return normalize(j);
  }
  return null;
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalize(j: Record<string, unknown>): AgentEnhancement {
  return {
    aiConventions: Array.isArray(j.aiConventions) ? (j.aiConventions as string[]) : [],
    gotchas: Array.isArray(j.gotchas) ? (j.gotchas as string[]) : [],
    acceptanceAdditions: Array.isArray(j.acceptanceAdditions) ? (j.acceptanceAdditions as string[]) : [],
  };
}
