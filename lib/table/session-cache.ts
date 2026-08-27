/**
 * 表格处理 —— 服务端会话缓存
 *
 * upload 时把解析/清洗/画像结果缓存到内存，返回 tableId；
 * analyze 只传 tableId，避免每次回传大体积 rows（Vercel 生产请求体 4.5MB 限制）。
 * TTL 30 分钟自动清理；进程内 Map（单实例够用，多实例需换 Redis）。
 *
 * T1-D2 扩展：
 *  - 额外缓存 rawSheet（parser 原始 SheetInfo），供用户确认表头后服务端重新
 *    buildEffectiveDataset + 重新画像（不沿用错误表头的缓存）；
 *  - 存储用户会话级确认状态 TableConfirmation（仅 session 生命周期，不落库）。
 */

import { randomUUID } from "crypto";
import type { SheetInfo, TableConfirmation } from "./types";
import type { AnalysisPlan, PlanExecutionResult } from "./analysis-plan";
import type { AnalysisNarrative } from "./narrative";

/** 缓存条目 */
interface CacheEntry {
  /** 归属用户（防止他人凭 tableId 串读） */
  userId: string;
  /** 清洗后表头 */
  headers: string[];
  /** 清洗后数据行（截断后） */
  rows: unknown[][];
  /** 每列类型 */
  columnTypes: string[];
  /** parser 原始 SheetInfo（供确认表头后重新构建 EffectiveDataset；非本人不可读） */
  rawSheet?: SheetInfo;
  /** 用户会话级确认状态（T1-D2） */
  confirmation?: TableConfirmation;
  /** 已生成的分析计划历史（T2-B；key = planId，随确认版本失效，不落库） */
  plans?: Record<string, AnalysisPlan>;
  /** 各计划对应的执行结果历史（T2-B；key = planId） */
  results?: Record<string, PlanExecutionResult>;
  /** 计划生成顺序（T2-B；用于版本排序与取最新） */
  planOrder?: string[];
  /** 最新计划 id（T2-B） */
  latestPlanId?: string;
  /** LLM 受控解读缓存（T3-A；key = planId:resultId，随确认版本失效） */
  narratives?: Record<string, AnalysisNarrative>;
  /** 创建时间戳 */
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 分钟
const CLEAN_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理过期

const store = new Map<string, CacheEntry>();
let lastClean = Date.now();

/** 保存解析结果（绑定归属用户），返回 tableId */
export function cacheTable(
  userId: string,
  headers: string[],
  rows: unknown[][],
  columnTypes: string[],
  rawSheet?: SheetInfo,
): string {
  cleanup();
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  store.set(id, { userId, headers, rows, columnTypes, rawSheet, createdAt: Date.now() });
  return id;
}

/** 取缓存；不存在 / 已过期 / 非本人 → null */
export function getTableCache(
  id: string,
  userId: string,
): { headers: string[]; rows: unknown[][]; columnTypes: string[] } | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null; // 防串读
  return { headers: entry.headers, rows: entry.rows, columnTypes: entry.columnTypes };
}

/** 更新缓存中的有效数据集（确认表头后重新画像时复用同一 tableId，避免前端失效） */
export function updateTableCache(
  id: string,
  userId: string,
  partial: { headers?: string[]; rows?: unknown[][]; columnTypes?: string[] },
): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  if (partial.headers) entry.headers = partial.headers;
  if (partial.rows) entry.rows = partial.rows;
  if (partial.columnTypes) entry.columnTypes = partial.columnTypes;
  return true;
}

/** 取缓存中的原始 Sheet（供服务端重新构建；非本人 / 过期 / 不存在 → null） */
export function getRawSheet(id: string, userId: string): SheetInfo | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.rawSheet ?? null;
}

/** 写入用户会话级确认状态（T1-D2）；非本人 / 过期 / 不存在 → false */
export function saveTableConfirmation(
  id: string,
  userId: string,
  confirmation: TableConfirmation,
): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.confirmation = confirmation;
  return true;
}

/** 取用户会话级确认状态；非本人 / 过期 / 不存在 → null */
export function getTableConfirmation(id: string, userId: string): TableConfirmation | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.confirmation ?? null;
}

/** 删除缓存（如用户主动放弃） */
export function deleteTableCache(id: string): void {
  store.delete(id);
}

/* ─────────────── AnalysisPlan 存储（T2-A / T2-B 历史版本化） ─────────────── */

/** 写入分析计划（按 planId 追加进历史；随 tableId + userId + TTL 隔离） */
export function saveTablePlan(id: string, userId: string, plan: AnalysisPlan): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.plans = entry.plans ?? {};
  entry.results = entry.results ?? {};
  entry.planOrder = entry.planOrder ?? [];
  entry.plans[plan.id] = plan;
  if (!entry.planOrder.includes(plan.id)) entry.planOrder.push(plan.id);
  entry.latestPlanId = plan.id;
  return true;
}

/** 读取最新分析计划；非本人 / 过期 / 不存在 → null */
export function getTablePlan(id: string, userId: string): AnalysisPlan | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  if (!entry.latestPlanId) return null;
  return entry.plans?.[entry.latestPlanId] ?? null;
}

/** 按 planId 读取指定历史计划；非本人 / 过期 / 不存在 → null */
export function getTablePlanById(id: string, userId: string, planId: string): AnalysisPlan | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.plans?.[planId] ?? null;
}

/** 列出计划 + 结果历史（按生成顺序，含执行结果；供 T2-B 版本切换） */
export function listTablePlans(
  id: string,
  userId: string,
): Array<{ plan: AnalysisPlan; result: PlanExecutionResult | null }> {
  const entry = store.get(id);
  if (!entry) return [];
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return [];
  }
  if (entry.userId !== userId) return [];
  const order = entry.planOrder ?? [];
  return order
    .map((pid) => ({
      plan: entry.plans?.[pid],
      result: entry.results?.[pid] ?? null,
    }))
    .filter((x): x is { plan: AnalysisPlan; result: PlanExecutionResult | null } => !!x.plan);
}

/** 写入某计划的执行结果（按 planId 历史存储） */
export function saveTableResult(id: string, userId: string, planId: string, result: PlanExecutionResult): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.results = entry.results ?? {};
  entry.results[planId] = result;
  return true;
}

/** 读取某计划的执行结果；非本人 / 过期 / 不存在 → null */
export function getTableResult(id: string, userId: string, planId: string): PlanExecutionResult | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.results?.[planId] ?? null;
}

/** 清除全部分析计划与结果历史（字段 / Sheet / 表头变更时使旧计划失效） */
export function clearTablePlan(id: string, userId: string): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.plans = undefined;
  entry.results = undefined;
  entry.planOrder = undefined;
  entry.latestPlanId = undefined;
  entry.narratives = undefined;
  return true;
}

/* ─────────────── LLM 受控解读存储（T3-A） ─────────────── */

/** 写入解读（key = planId:resultId；仅 ready 状态入库；随 tableId + userId + TTL 隔离） */
export function saveTableNarrative(id: string, userId: string, narrative: AnalysisNarrative): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.narratives = entry.narratives ?? {};
  entry.narratives[`${narrative.planId}:${narrative.resultId}`] = narrative;
  return true;
}

/** 读取解读；非本人 / 过期 / 不存在 → null */
export function getTableNarrative(id: string, userId: string, planId: string, resultId: string): AnalysisNarrative | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.narratives?.[`${planId}:${resultId}`] ?? null;
}

/** 惰性清理过期条目 */
function cleanup(): void {
  const now = Date.now();
  if (now - lastClean < CLEAN_INTERVAL_MS) return;
  lastClean = now;
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) store.delete(id);
  }
}
