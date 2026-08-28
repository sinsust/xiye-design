/**
 * POST /api/brain/tasks/extract-from-analysis
 * body: { analysisResult: AnalysisResult }
 * AI 从分析解读中提取行动项 → 创建 brain_tasks（复用 insertBrainTasks）。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { insertBrainTasks, insertBrainNote } from "@/lib/brain-db";
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

    // AI 提取行动项（3-8 条）
    const system = `你是行动项提取助手。以下是数据分析结果：
标题：${result.title}
解读：${result.interpretation || ""}
计算摘要：${result.execution?.summary || ""}

请从分析结论中提取 3-8 条可执行的行动项，输出 JSON 数组：
[
  { "text": "行动项内容（≤40字，动作导向）", "priority": "high|medium|low" }
]
只返回 JSON 数组，不要其他内容。`;

    const raw = await chatLLMJson<unknown>(system, "提取行动项");
    // 兼容模型返回裸数组或包裹对象（{ action_items: [...] } / { tasks: [...] }）
    const items = Array.isArray(raw)
      ? (raw as Array<{ text?: string; priority?: string }>)
      : ((raw as { action_items?: unknown; tasks?: unknown; items?: unknown })?.action_items ??
          (raw as { tasks?: unknown })?.tasks ??
          (raw as { items?: unknown })?.items) ?? [];
    const valid = (Array.isArray(items) ? items : [])
      .map((it) => ({
        title: String(it?.text ?? "").trim().slice(0, 60),
        priority: (it?.priority === "high" || it?.priority === "low" ? it.priority : "medium") as
          | "high"
          | "medium"
          | "low",
      }))
      .filter((it) => it.title)
      .slice(0, 8);

    if (valid.length === 0) {
      return NextResponse.json({ created: [], count: 0 });
    }

    // noteId 为 schema 必填外键：先建一条轻量「分析任务」支撑笔记（与 POST /api/brain/tasks 同模式），
    // 保证任务可落库且能回溯到本次分析来源。
    const supporting = await insertBrainNote(user.sub, {
      source: "text",
      title: "分析任务 · " + (result.title ?? "").slice(0, 40),
      content: `由表格分析「${result.title ?? ""}」提取的行动项。`,
      category: "任务",
      summary: "",
      tags: [],
      related: [],
      isSnippet: false,
    });
    if (!supporting?.id) {
      return NextResponse.json({ error: "source_note_failed", message: "创建来源笔记失败" }, { status: 500 });
    }
    const noteId = supporting.id;

    const created = await insertBrainTasks(
      user.sub,
      valid.map((it) => ({ ...it, noteId })),
    );
    return NextResponse.json({ created, count: created.length });
  } catch (err) {
    console.error("brain extract tasks failed:", err);
    return NextResponse.json({ error: "extract_failed", message: `提取任务失败：${(err as Error).message}` }, { status: 500 });
  }
}
