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
import { executeDimension, buildRecommendPrompt, buildFallbackDimensions } from "@/lib/table/analysis";
import { chatLLMJsonRouted } from "@/lib/table/llm";
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
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const profile = body?.profile as TableProfileResult | undefined;
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";

    // 优先用 tableId 取服务端缓存（避免回传大 rows）
    let headers: string[] = Array.isArray(body?.headers) ? body.headers : [];
    let rows: unknown[][] = Array.isArray(body?.rows) ? body.rows : [];
    let columnTypes: FieldType[] = Array.isArray(body?.columnTypes) ? body.columnTypes : [];
    if (tableId) {
      const cache = getTableCache(tableId, user.sub);
      if (!cache) {
        return NextResponse.json(
          {
            error: "table_expired",
            message: "表格数据已失效（页面停留过久或服务重启导致），请重新上传后再分析",
          },
          { status: 410 },
        );
      }
      headers = cache.headers;
      rows = cache.rows;
      columnTypes = cache.columnTypes as FieldType[];
    }

    const userQuery: string = typeof body?.userQuery === "string" ? body.userQuery.trim() : "";
    const selected: AnalysisDimension[] = Array.isArray(body?.selectedDimensions) ? body.selectedDimensions : [];
    const forceRoute: "qwen" | "deepseek" | undefined =
      body?.forceRoute === "qwen" || body?.forceRoute === "deepseek" ? body.forceRoute : undefined;

    if (!profile || !Array.isArray(profile.columns) || profile.columns.length === 0) {
      return NextResponse.json({ error: "profile_required", message: "缺少字段画像信息" }, { status: 400 });
    }
    if (selected.length > MAX_DIMENSIONS) {
      return NextResponse.json({ error: "too_many_dimensions", message: `一次最多分析 ${MAX_DIMENSIONS} 个维度` }, { status: 400 });
    }

    /* ── a) 自然语言查询：AI 理解意图 → 生成维度 → 执行 → 解读 ── */
    if (userQuery) {
      const { dimension, route: route1 } = await understandQuery(userQuery, profile, headers, forceRoute);
      const execution = executeDimension(dimension, headers, rows, columnTypes);
      // 单维解读：LLM 失败降级为空串（图与数据照常返回，不 500）
      const interpretation = await interpretExecution(dimension, execution, forceRoute).catch(() => ({
        text: "",
        route: route1,
      }));
      return NextResponse.json({
        route: interpretation.route || route1,
        results: [
          {
            dimension,
            execution,
            interpretation: interpretation.text,
            title: dimension.name,
          } satisfies AnalysisResult,
        ],
      });
    }

    /* ── b) 推荐维度（不执行） ── */
    if (selected.length === 0) {
      const { dimensions, route } = await recommendDimensions(profile, forceRoute);
      return NextResponse.json({ dimensions, route });
    }

    /* ── c) 执行选中维度 + AI 解读 ──
     * 性能关键：executeDimension 为纯 JS（毫秒级），先全部同步执行；
     * AI 解读从「每维一次 LLM（串行 N×25s，超时重灾区）」改为
     * 「全部摘要合并为一次 LLM 批量解读」——N 次调用收敛为 1 次。
     * 批量解读失败整体降级为空解读，结果照常返回（前端洞察卡自动隐藏）。
     */
    const items = selected.slice(0, MAX_DIMENSIONS).map((dimension) => ({
      dimension,
      execution: executeDimension(dimension, headers, rows, columnTypes),
    }));
    const { map, route } = await interpretBatch(items, forceRoute).catch(() => ({
      map: {} as Record<string, string>,
      route: "",
    }));
    const results: AnalysisResult[] = items.map(({ dimension, execution }) => ({
      dimension,
      execution,
      interpretation: map[dimension.name] || "",
      title: dimension.name,
    }));
    return NextResponse.json({ results, route });
  } catch (err) {
    console.error("brain table analyze failed:", err);
    return NextResponse.json(
      { error: "analyze_failed", message: `分析失败：${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/* ─────────────── AI 三路 ─────────────── */

/** b) 推荐维度（双线路并行 + LLM 失败本地规则兜底，永不 500） */
async function recommendDimensions(
  profile: TableProfileResult,
  forceRoute?: "qwen" | "deepseek",
): Promise<{ dimensions: AnalysisDimension[]; route: string }> {
  const prompt = buildRecommendPrompt(profile);
  try {
    const { data, route } = await chatLLMJsonRouted<AnalysisDimension[]>(prompt, "请推荐分析维度，返回 JSON 数组", {
      forceRoute,
      // 推荐输出短，25s 足够；并行双线路下最慢 25s 出结果（Vercel Pro 函数 60s 时限内）
      timeoutMs: 25000,
    });
    const dims = (Array.isArray(data) ? data : []).slice(0, MAX_DIMENSIONS);
    if (dims.length === 0) throw new Error("AI 未返回有效维度");
    return { dimensions: dims, route };
  } catch (e) {
    // LLM 全线路失败 → 本地规则兜底：保证「分析建议」永远可用（AI 只做增强，不阻塞主流程）
    console.warn("[table/analyze] LLM 推荐失败，回退本地规则:", (e as Error).message);
    return { dimensions: buildFallbackDimensions(profile), route: "local" };
  }
}

/** a) 自然语言查询理解（双线路路由） */
async function understandQuery(
  query: string,
  profile: TableProfileResult,
  headers: string[],
  forceRoute?: "qwen" | "deepseek",
): Promise<{ dimension: AnalysisDimension; route: string }> {
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
  const { data, route } = await chatLLMJsonRouted<AnalysisDimension>(system, query, { forceRoute });
  return { dimension: data, route };
}

/** c) 解读执行结果（双线路路由，失败抛错由调用方降级） */
async function interpretExecution(
  dimension: AnalysisDimension,
  execution: AnalysisExecutionResult,
  forceRoute?: "qwen" | "deepseek",
): Promise<{ text: string; route: string }> {
  const system = `你是数据分析师。下面是刚才执行的分析结果：
分析：${execution.name}
计算摘要：${execution.summary}
图表类型：${execution.chartType}

请用 2-4 句自然语言解读结果：说明关键发现、值得注意的异常或趋势、给出一个可执行的业务建议。不要复述数据细节，聚焦洞察。`;
  const { data, route } = await chatLLMJsonRouted<{ interpretation: string }>(system, "请解读", {
    temperature: 0.5,
    forceRoute,
  });
  return { text: data.interpretation || "（暂无解读）", route };
}

/**
 * 批量解读（双线路路由）：把 N 个分析结果的摘要合并进一次 LLM 调用。
 * 相比逐维串行调用（N 次、每次最多 25s，N≥3 时 Vercel 函数时限内必超时），
 * 这里一次调用即可完成全部解读，耗时收敛到单次水平。
 * 模型未返回某维度的解读时该维度缺省为空串（前端洞察卡自动隐藏）。
 */
async function interpretBatch(
  items: Array<{ dimension: AnalysisDimension; execution: AnalysisExecutionResult }>,
  forceRoute?: "qwen" | "deepseek",
): Promise<{ map: Record<string, string>; route: string }> {
  if (items.length === 0) return { map: {}, route: "" };
  const block = items
    .map((it, i) => `【${i + 1}】${it.execution.name}\n${it.execution.summary}`)
    .join("\n\n");
  const system = `你是数据分析师。下面是 ${items.length} 个已执行的分析结果摘要，请逐一给出自然语言解读。

${block}

要求：
- 每个解读 2-3 句：关键发现、值得注意的异常或趋势、一条可执行的业务建议；
- 不要复述数据细节，聚焦洞察；
- 解读数量必须与分析数一致，且 name 与上面【N】对应的分析名完全一致。

返回 JSON：{"interpretations": [{"name": "分析名", "text": "解读"}]}
只返回 JSON。`;
  const { data, route } = await chatLLMJsonRouted<{ interpretations?: Array<{ name?: string; text?: string }> }>(
    system,
    "请逐一解读",
    { temperature: 0.5, timeoutMs: 45000, forceRoute },
  );
  const map: Record<string, string> = {};
  for (const item of data.interpretations ?? []) {
    if (item?.name && item.text) map[item.name] = item.text.trim();
  }
  return { map, route };
}
