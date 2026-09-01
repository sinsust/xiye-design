/**
 * POST /api/brain/table/narrative
 * body: { tableId, planId, resultId, refresh?, forceRoute? }
 *
 * T3-A：LLM 受控叙述与行动建议。
 *  - LLM 只解释确定性引擎已算好的 AnalysisPlan + Result + Evidence（受控上下文打包，不含原始行）；
 *  - 缓存去重：相同 planId:resultId 且已 ready 时直接返回，不重复调模型；并发请求共享一次调用；
 *  - 跨用户隔离：所有读写走 session-cache userId 校验；
 *  - 失败 / 超时 / 限流：返回 status=failed + retryable，保留上次有效叙述，绝不覆盖确定性结果；
 *  - 解读不落第二大脑、不创建任务 / 提醒 / 通知。
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth";
import {
  getTableCache,
  getTableConfirmation,
  getTablePlanById,
  getTableResult,
  saveTableNarrative,
  getTableNarrative,
} from "@/lib/table/session-cache";
import {
  buildNarrativeContext,
  parseAndValidateNarrative,
  evidenceVersionOf,
  narrativeKey,
  NARRATIVE_SYSTEM_PROMPT,
  type AnalysisNarrative,
} from "@/lib/table/narrative";
import { chatLLMJsonRouted } from "@/lib/table/llm";
import type { AnalysisPlan, PlanExecutionResult } from "@/lib/table/analysis-plan";

export const runtime = "nodejs";

/** 并发去重：同 key 的生成请求共享一次 LLM 调用（避免重复计费 / 限流） */
const inflight = new Map<string, Promise<AnalysisNarrative>>();

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized", message: "未登录" }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const tableId: string = typeof body?.tableId === "string" ? body.tableId : "";
    const planId: string = typeof body?.planId === "string" ? body.planId : "";
    const resultId: string = typeof body?.resultId === "string" ? body.resultId : "";
    const refresh: boolean = body?.refresh === true;
    const forceRoute: "qwen" | "deepseek" | undefined =
      body?.forceRoute === "qwen" || body?.forceRoute === "deepseek" ? body.forceRoute : undefined;

    if (!tableId || !planId || !resultId) {
      return NextResponse.json({ error: "missing_params", message: "缺少表格 / 计划 / 结果标识" }, { status: 400 });
    }

    // 数据与确认状态（userId 隔离 + TTL）
    const cached = await getTableCache(tableId, user.sub);
    if (!cached) {
      return NextResponse.json(
        { error: "table_expired", message: "表格数据已失效（页面停留过久或服务重启导致），请重新上传后再分析" },
        { status: 410 },
      );
    }
    const confirmation = await getTableConfirmation(tableId, user.sub);
    if (!confirmation) {
      return NextResponse.json({ error: "confirmation_required", message: "请先完成字段确认" }, { status: 400 });
    }
    const plan = await getTablePlanById(tableId, user.sub, planId);
    if (!plan) {
      return NextResponse.json({ error: "plan_expired", message: "分析计划已失效，请重新选择分析方向" }, { status: 410 });
    }
    if (plan.confirmationVersion !== confirmation.version) {
      return NextResponse.json({ error: "plan_invalid", message: "分析计划已失效（字段 / 表头已变更），请重新执行分析" }, { status: 409 });
    }
    if (plan.tableId !== tableId) {
      return NextResponse.json({ error: "unauthorized", message: "计划与当前表格不匹配" }, { status: 401 });
    }
    const result = await getTableResult(tableId, user.sub, planId);
    if (!result || result.status !== "executed") {
      return NextResponse.json({ error: "result_not_ready", message: "请先执行分析再生成解读" }, { status: 400 });
    }
    // 目标输出必须存在于本计划
    if (!plan.outputs.some((o) => o.id === resultId)) {
      return NextResponse.json({ error: "invalid_result_id", message: "目标输出不存在" }, { status: 400 });
    }

    const key = narrativeKey(planId, resultId);

    // 缓存命中（ready 且非强制刷新）→ 直接返回，不调模型
    if (!refresh) {
      const cachedNarrative = await getTableNarrative(tableId, user.sub, planId, resultId);
      if (cachedNarrative && cachedNarrative.status === "ready") {
        return NextResponse.json({ narrative: cachedNarrative, cached: true });
      }
    }

    // 并发去重：同一 key 已有进行中的生成 → 共享
    const existing = inflight.get(key);
    if (existing) {
      const n = await existing.catch(() => null);
      if (n) return NextResponse.json({ narrative: n, cached: false });
      inflight.delete(key);
    }

    const task = generateNarrative(plan, result, resultId, tableId, user.sub, forceRoute)
      .then(async (n) => {
        if (n.status === "ready") await saveTableNarrative(tableId, user.sub, n);
        return n;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, task);

    const narrative = await task;
    return NextResponse.json({ narrative, cached: false });
  } catch (err) {
    console.error("[table/narrative] 失败:", err);
    return NextResponse.json(
      { error: "narrative_failed", message: `解读失败：${(err as Error).message}` },
      { status: 500 },
    );
  }
}

/** 生成解读：受控上下文 → LLM → 解析校验；失败时保留上次有效叙述或返回 failed */
async function generateNarrative(
  plan: AnalysisPlan,
  result: PlanExecutionResult,
  resultId: string,
  tableId: string,
  userId: string,
  forceRoute?: "qwen" | "deepseek",
): Promise<AnalysisNarrative> {
  const { prompt, data } = buildNarrativeContext(plan, result, resultId);
  try {
    const { data: parsed } = await chatLLMJsonRouted<unknown>(NARRATIVE_SYSTEM_PROMPT, prompt, {
      temperature: 0.3,
      timeoutMs: 45000,
      forceRoute,
    });
    return parseAndValidateNarrative(parsed, plan, result, data);
  } catch (err) {
    // 失败降级：保留上次有效叙述（明确标记可重试）；无则返回 failed 状态（不覆盖确定性结果）
    console.warn("[table/narrative] LLM 生成失败:", (err as Error).message);
    const prev = await getTableNarrative(tableId, userId, plan.id, resultId);
    if (prev && prev.status === "ready") {
      return { ...prev, retryable: true };
    }
    const msg = (err as Error).message;
    const errorCode = /超时|timeout|abort/i.test(msg) ? "llm_timeout" : /JSON|解析|结构无效|无效/.test(msg) ? "invalid_response" : "llm_error";
    return {
      id: randomUUID().replace(/-/g, "").slice(0, 16),
      planId: plan.id,
      resultId,
      evidenceVersion: evidenceVersionOf(plan),
      status: "failed",
      findings: [],
      caveats: [],
      retryable: true,
      errorCode,
    };
  }
}
