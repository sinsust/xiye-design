/**
 * POST /api/brain/table/analyze
 * body: { profile, headers, rows, columnTypes, userQuery?, selectedDimensions? }
 *
 * 三路逻辑：
 *  a) 有 userQuery → AI 理解意图 → 生成维度 → 执行 → AI 解读 → 返回
 *  b) 无 userQuery 无 selectedDimensions → AI 推荐 8-10 个分析维度（不执行）
 *  c) 有 selectedDimensions → 逐维执行（纯 JS）→ AI 解读 → 返回结果集
 *
 * 纯计算不经过 AI，AI 只做：推荐 / 解读 / 自然语言理解。
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { executeDimension, buildRecommendPrompt } from "@/lib/table/analysis";
import { chatLLMJson } from "@/lib/table/llm";
import { getTableCache } from "@/lib/table/session-cache";
import type {
  AnalysisDimension,
  AnalysisExecutionResult,
  AnalysisResult,
  FieldType,
  TableProfileResult,
} from "@/lib/table/types";

export const runtime = "nodejs";

const MAX_DIMENSIONS = 10;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const profile = body?.profile as TableProfileResult | undefined;
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";

    // 优先用 tableId 取服务端缓存（避免回传大 rows）
    let headers: string[] = Array.isArray(body?.headers) ? body.headers : [];
    let rows: unknown[][] = Array.isArray(body?.rows) ? body.rows : [];
    let columnTypes: FieldType[] = Array.isArray(body?.columnTypes) ? body.columnTypes : [];
    if (tableId) {
      const cache = getTableCache(tableId);
      if (!cache) {
        return NextResponse.json({ error: "table_expired" }, { status: 410 });
      }
      headers = cache.headers;
      rows = cache.rows;
      columnTypes = cache.columnTypes as FieldType[];
    }

    const userQuery: string = typeof body?.userQuery === "string" ? body.userQuery.trim() : "";
    const selected: AnalysisDimension[] = Array.isArray(body?.selectedDimensions) ? body.selectedDimensions : [];

    if (!profile || !Array.isArray(profile.columns) || profile.columns.length === 0) {
      return NextResponse.json({ error: "profile_required" }, { status: 400 });
    }
    if (selected.length > MAX_DIMENSIONS) {
      return NextResponse.json({ error: "too_many_dimensions" }, { status: 400 });
    }

    /* ── a) 自然语言查询：AI 理解意图 → 生成维度 → 执行 → 解读 ── */
    if (userQuery) {
      const dimension = await understandQuery(userQuery, profile, headers);
      const execution = executeDimension(dimension, headers, rows, columnTypes);
      const interpretation = await interpretExecution(dimension, execution);
      return NextResponse.json({
        results: [
          {
            dimension,
            execution,
            interpretation,
            title: dimension.name,
          } satisfies AnalysisResult,
        ],
      });
    }

    /* ── b) 推荐维度（不执行） ── */
    if (selected.length === 0) {
      const dimensions = await recommendDimensions(profile);
      return NextResponse.json({ dimensions });
    }

    /* ── c) 执行选中维度 + AI 解读 ── */
    const results: AnalysisResult[] = [];
    for (const dimension of selected.slice(0, MAX_DIMENSIONS)) {
      const execution: AnalysisExecutionResult = executeDimension(dimension, headers, rows, columnTypes);
      const interpretation = await interpretExecution(dimension, execution);
      results.push({
        dimension,
        execution,
        interpretation,
        title: dimension.name,
      });
    }
    return NextResponse.json({ results });
  } catch (err) {
    console.error("brain table analyze failed:", err);
    return NextResponse.json(
      { error: "analyze_failed", message: (err as Error).message },
      { status: 500 },
    );
  }
}

/* ─────────────── AI 三路 ─────────────── */

/** b) 推荐维度 */
async function recommendDimensions(profile: TableProfileResult): Promise<AnalysisDimension[]> {
  const prompt = buildRecommendPrompt(profile);
  const dims = await chatLLMJson<AnalysisDimension[]>(prompt, "请推荐分析维度，返回 JSON 数组");
  return (Array.isArray(dims) ? dims : []).slice(0, MAX_DIMENSIONS);
}

/** a) 自然语言查询理解 */
async function understandQuery(
  query: string,
  profile: TableProfileResult,
  headers: string[],
): Promise<AnalysisDimension> {
  const summary = buildRecommendPrompt(profile);
  const system = `你是数据分析师。用户用自然语言询问表格分析问题。
可用字段：${headers.join("、")}

${summary}

请把用户意图转换为一个分析维度 JSON：
{
  "name": "简短分析名",
  "description": "分析思路（用哪些字段、怎么算）",
  "chartType": "line|bar|pie|heatmap|scatter|boxplot|histogram|table",
  "fields": ["用到的字段名"],
  "insight": "预期洞察"
}
只返回 JSON。`;
  return chatLLMJson<AnalysisDimension>(system, query);
}

/** c) 解读执行结果 */
async function interpretExecution(
  dimension: AnalysisDimension,
  execution: AnalysisExecutionResult,
): Promise<string> {
  const system = `你是数据分析师。下面是刚才执行的分析结果：
分析：${execution.name}
计算摘要：${execution.summary}
图表类型：${execution.chartType}

请用 2-4 句自然语言解读结果：说明关键发现、值得注意的异常或趋势、给出一个可执行的业务建议。不要复述数据细节，聚焦洞察。`;
  return chatLLMJson<{ interpretation: string }>(system, "请解读", { temperature: 0.5 }).then(
    (r) => r.interpretation || "（暂无解读）",
  );
}
