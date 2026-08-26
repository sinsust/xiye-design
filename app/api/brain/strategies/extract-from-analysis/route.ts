/**
 * POST /api/brain/strategies/extract-from-analysis
 * body: { analysisResult: AnalysisResult }
 * AI 从分析解读中提炼策略建议 → 创建 brain_strategies（复用 insertBrainStrategies）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { insertBrainStrategies } from "@/lib/brain-db";
import { chatLLMJson } from "@/lib/table/llm";
import type { AnalysisResult } from "@/lib/table/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const result = body?.analysisResult as AnalysisResult | undefined;
    if (!result || !result.title) {
      return NextResponse.json({ error: "analysis_result_required", message: "缺少分析结果信息" }, { status: 400 });
    }

    // AI 提炼策略（2-5 条）
    const system = `你是策略提炼助手。以下是数据分析结果：
标题：${result.title}
解读：${result.interpretation || ""}
计算摘要：${result.execution?.summary || ""}

请从分析结论中提炼 2-5 条长期策略建议，输出 JSON 数组：
[
  { "title": "策略名（≤30字）", "description": "为什么与怎么做（≤80字）" }
]
只返回 JSON 数组，不要其他内容。`;

    const raw = await chatLLMJson<unknown>(system, "提炼策略");
    // 兼容裸数组或包裹对象（{ 策略建议: [...] } / { strategies: [...] }）
    const items = Array.isArray(raw)
      ? (raw as Array<{ title?: string; description?: string }>)
      : ((raw as { 策略建议?: unknown; strategies?: unknown })?.策略建议 ??
          (raw as { strategies?: unknown })?.strategies) ?? [];
    const valid = (Array.isArray(items) ? items : [])
      .map((it) => ({
        noteId: "",
        title: String(it?.title ?? "").trim().slice(0, 40),
        description: String(it?.description ?? "").trim().slice(0, 120) || undefined,
      }))
      .filter((it) => it.title)
      .slice(0, 5);

    if (valid.length === 0) {
      return NextResponse.json({ created: [], count: 0 });
    }

    const created = await insertBrainStrategies(user.sub, valid);
    return NextResponse.json({ created, count: created.length });
  } catch (err) {
    console.error("brain extract strategies failed:", err);
    return NextResponse.json({ error: "extract_failed", message: `提取策略失败：${(err as Error).message}` }, { status: 500 });
  }
}
