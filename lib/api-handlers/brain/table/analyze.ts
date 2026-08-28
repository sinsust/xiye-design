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
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import { executeDimension, buildRecommendPrompt, buildFallbackDimensions } from "@/lib/table/analysis";
import { chatLLMJsonRouted } from "@/lib/table/llm";
import { profileTable } from "@/lib/table/profiler";
import {
  generatePlan,
  listObjectives,
  executeAnalysisPlan,
  type AnalysisObjective,
  type PlanOptions,
  type AnalysisPlan,
} from "@/lib/table/analysis-plan";
import {
  getTableCache,
  getTableConfirmation,
  saveTablePlan,
  getTablePlan,
  getTablePlanById,
  listTablePlans,
  saveTableResult,
  clearTablePlan,
} from "@/lib/table/session-cache";
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

    // T2-A / T2-B：分析计划生命周期（生成 / 获取 / 确认并执行 / 历史）。向后兼容：无 action 时走原 LLM 推荐 / 执行逻辑。
    const action: string = typeof body?.action === "string" ? body.action : "";
    if (action === "list_objectives" || action === "generate_plan" || action === "execute_plan" || action === "get_plan" || action === "list_plans") {
      return await handlePlanAction(action, body, user);
    }

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

/* ─────────────── T2-A：分析计划生命周期 ───────────────
 * 确定性、无 LLM：generate/list 由纯规则模块产出 AnalysisPlan；
 * execute 复用 lib/table/analysis.ts 的 executeDimension。
 * 全程受 tableId + userId + TTL 隔离，且执行时校验确认版本一致性。
 */

async function handlePlanAction(action: string, body: Record<string, unknown>, user: { sub: string }) {
  const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";
  if (!tableId) {
    return NextResponse.json({ error: "table_id_required", message: "缺少表格标识" }, { status: 400 });
  }

  // 取已确认的有效数据集 + 确认状态（过期 / 非本人 / 不存在 → 410）
  const cached = getTableCache(tableId, user.sub);
  if (!cached) {
    return NextResponse.json(
      { error: "table_expired", message: "表格数据已失效（页面停留过久或服务重启导致），请重新上传后再分析" },
      { status: 410 },
    );
  }
  const confirmation = getTableConfirmation(tableId, user.sub);
  if (!confirmation) {
    return NextResponse.json(
      { error: "confirmation_required", message: "请先完成字段确认再生成分析计划" },
      { status: 400 },
    );
  }

  const { headers, rows, columnTypes } = cached;
  // 服务端基于 confirmed dataset 重新画像（权威，不信任前端传入 profile）
  const sheetName = profileSheetName();
  const profile = profileTable(headers, rows, columnTypes as FieldType[], sheetName);
  const sheetId = profile.sheetName;
  const headerRow = confirmation.headerRowBySheet[sheetId] ?? 0;

  const common = {
    tableId,
    profile,
    headers,
    rows,
    columnTypes: columnTypes as FieldType[],
    sheetId,
    headerRow,
    confirmationVersion: confirmation.version,
    confirmedColumns: confirmation.confirmedColumns,
    columnOverrides: confirmation.columnOverrides,
  };

  // T2-B 质量上下文（低置信覆盖提示用）：字段名 → 置信度 / 是否被用户覆盖
  const confidenceByName: Record<string, number> = {};
  for (const col of profile.columns) {
    const conf = (col as { inference?: { confidence?: number } }).inference?.confidence;
    if (typeof conf === "number") confidenceByName[col.name] = conf;
  }
  const overrideByName: Record<string, boolean> = {};
  for (const k of Object.keys(confirmation.columnOverrides ?? {})) {
    const idx = Number(k);
    if (Number.isInteger(idx) && headers[idx] !== undefined) overrideByName[headers[idx]] = true;
  }
  const qualityContext = { confidenceByName, overrideByName };

  /* list_objectives：列出 5 个业务方向的可用性与元信息 */
  if (action === "list_objectives") {
    const objectives = listObjectives(common);
    return NextResponse.json({ objectives });
  }

  /* generate_plan：生成单个目标的计划（draft），存入 session-cache */
  if (action === "generate_plan") {
    const objective = body?.objective as AnalysisObjective;
    const options = (body?.options as PlanOptions) ?? undefined;
    if (!objective || !["revenue_overview", "product_performance", "logistics_cost", "advertising_performance", "customer_overview", "custom"].includes(objective)) {
      return NextResponse.json({ error: "invalid_objective", message: "不支持的分析目标" }, { status: 400 });
    }
    const res = generatePlan({ ...common, objective, options });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "plan_unavailable", missingReasons: res.missingReasons, missingFieldTypes: res.missingFieldTypes, suggestions: res.suggestions },
        { status: 400 },
      );
    }
    const plan: AnalysisPlan = { ...res.plan, id: randomUUID().replace(/-/g, "").slice(0, 16) };
    saveTablePlan(tableId, user.sub, plan);
    return NextResponse.json({ ok: true, plan });
  }

  /* get_plan：取回计划（可指定 planId 取历史；校验确认版本，防止旧计划复用） */
  if (action === "get_plan") {
    const planId: string = typeof body?.planId === "string" && body.planId ? body.planId : "";
    const plan = planId ? getTablePlanById(tableId, user.sub, planId) : getTablePlan(tableId, user.sub);
    if (!plan) {
      return NextResponse.json({ error: "plan_expired", message: "分析计划已失效，请重新选择分析方向" }, { status: 410 });
    }
    if (plan.confirmationVersion !== confirmation.version) {
      clearTablePlan(tableId, user.sub);
      return NextResponse.json({ error: "plan_invalid", message: "分析计划已失效（字段 / 表头已变更），请重新选择分析方向" }, { status: 409 });
    }
    return NextResponse.json({ plan });
  }

  /* list_plans：列出全部计划 + 结果历史（T2-B 版本切换，不重新计算） */
  if (action === "list_plans") {
    return NextResponse.json({ plans: listTablePlans(tableId, user.sub) });
  }

  /* execute_plan：确认并执行计划（确定性执行，无 LLM 解读）；结果按 planId 留档历史 */
  if (action === "execute_plan") {
    const planId: string = typeof body?.planId === "string" ? body.planId : "";
    const plan = getTablePlanById(tableId, user.sub, planId);
    if (!plan) {
      return NextResponse.json({ error: "plan_expired", message: "分析计划已失效，请重新选择分析方向" }, { status: 410 });
    }
    if (plan.confirmationVersion !== confirmation.version) {
      clearTablePlan(tableId, user.sub);
      return NextResponse.json({ error: "plan_invalid", message: "分析计划已失效（字段 / 表头已变更），请重新选择分析方向" }, { status: 409 });
    }
    if (plan.tableId !== tableId) {
      return NextResponse.json({ error: "unauthorized", message: "计划与当前表格不匹配" }, { status: 401 });
    }
    const result = executeAnalysisPlan(plan, { headers, rows, columnTypes: columnTypes as FieldType[] }, qualityContext);
    if (result.status === "failed") {
      const failed: AnalysisPlan = { ...plan, status: "failed" };
      saveTablePlan(tableId, user.sub, failed);
      saveTableResult(tableId, user.sub, plan.id, result);
      return NextResponse.json({ error: "execute_failed", result, plans: listTablePlans(tableId, user.sub) }, { status: 422 });
    }
    const executed: AnalysisPlan = { ...plan, status: "executed" };
    saveTablePlan(tableId, user.sub, executed);
    saveTableResult(tableId, user.sub, plan.id, result);
    return NextResponse.json({ result, plans: listTablePlans(tableId, user.sub) });
  }

  return NextResponse.json({ error: "unknown_action", message: "未知操作" }, { status: 400 });
}

/** 从 confirmed dataset 推断 sheet 名（无原始 sheet 元信息时回退 Sheet1） */
function profileSheetName(): string {
  return "Sheet1";
}
