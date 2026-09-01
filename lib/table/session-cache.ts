/**
 * 表格处理 —— 服务端会话缓存（L1 内存 + L2 Supabase 双层）
 *
 * upload 时把解析/清洗/画像结果缓存，返回 tableId；analyze 只传 tableId，
 * 避免每次回传大体积 rows（Vercel 生产请求体 4.5MB 限制）。
 *
 * 原实现为进程内 Map，Serverless 冷启动/多实例下 upload 与 analyze 落到不同
 * 容器 → getTableCache 必返回 null → 410 table_expired。
 * 现改为双层：
 *  - L1：进程内 Map，同实例零延迟热缓存；
 *  - L2：Supabase brain_table_sessions 表（gzip+base64 整条 CacheEntry），
 *        跨实例/冷启动兜底。用 service_role 直写（绕过 RLS，不依赖 RLS 开关
 *        是否到位）；防串读由本模块每次读取都比对 userId 兜底，
 *        且 tableId 为随机不可枚举值。
 * TTL 30 分钟（从 createdAt 计，不随访问续期），与旧行为一致。
 *
 * T1-D2 扩展：额外缓存 rawSheet（parser 原始 SheetInfo），供确认表头后服务端
 * 重新 buildEffectiveDataset + 重新画像；存储用户会话级确认状态 TableConfirmation
 * （仅 session 生命周期，不落库到业务表）。
 */

import { randomUUID } from "crypto";
import { saveRemote, loadRemote, deleteRemote } from "./session-persist";
import type { SheetInfo, TableConfirmation } from "./types";
import type { AnalysisPlan, PlanExecutionResult } from "./analysis-plan";
import type { AnalysisNarrative } from "./narrative";

/** 缓存条目（已加 id，便于 L2 主键与 upsert） */
export interface CacheEntry {
  /** 主键（与导出 tableId 一致） */
  id: string;
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

export const TTL_MS = 30 * 60 * 1000; // 30 分钟
const CLEAN_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理过期

const store = new Map<string, CacheEntry>();
let lastClean = Date.now();

/** 惰性清理过期条目（仅 L1；L2 过期在读时顺手删） */
function cleanup(): void {
  const now = Date.now();
  if (now - lastClean < CLEAN_INTERVAL_MS) return;
  lastClean = now;
  for (const [id, entry] of store.entries()) {
    if (now - entry.createdAt > TTL_MS) store.delete(id);
  }
}

function isFresh(e: CacheEntry): boolean {
  return Date.now() - e.createdAt <= TTL_MS;
}

/** L1→L2 读取：命中内存直接返；未命中从 Supabase 拉取回填；过期/非本人/不存在 → null */
async function readEntry(id: string, userId: string): Promise<CacheEntry | null> {
  const local = store.get(id);
  if (local && local.userId === userId && isFresh(local)) return local;
  if (local && !isFresh(local)) store.delete(id);
  const remote = await loadRemote(id, userId);
  if (remote && isFresh(remote)) {
    store.set(id, remote);
    return remote;
  }
  if (remote) await deleteRemote(id); // 远端过期
  return null;
}

/** 写回 L1 内存 + L2 Supabase */
async function writeEntry(entry: CacheEntry): Promise<void> {
  store.set(entry.id, entry);
  await saveRemote(entry);
}

/** 保存解析结果（绑定归属用户），返回 tableId */
export async function cacheTable(
  userId: string,
  headers: string[],
  rows: unknown[][],
  columnTypes: string[],
  rawSheet?: SheetInfo,
): Promise<string> {
  cleanup();
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const entry: CacheEntry = { id, userId, headers, rows, columnTypes, rawSheet, createdAt: Date.now() };
  await writeEntry(entry);
  return id;
}

/** 取缓存；不存在 / 已过期 / 非本人 → null */
export async function getTableCache(
  id: string,
  userId: string,
): Promise<{ headers: string[]; rows: unknown[][]; columnTypes: string[] } | null> {
  const entry = await readEntry(id, userId);
  if (!entry) return null;
  return { headers: entry.headers, rows: entry.rows, columnTypes: entry.columnTypes };
}

/** 更新缓存中的有效数据集（确认表头后重新画像时复用同一 tableId，避免前端失效） */
export async function updateTableCache(
  id: string,
  userId: string,
  partial: { headers?: string[]; rows?: unknown[][]; columnTypes?: string[] },
): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  if (partial.headers) entry.headers = partial.headers;
  if (partial.rows) entry.rows = partial.rows;
  if (partial.columnTypes) entry.columnTypes = partial.columnTypes;
  await writeEntry(entry);
  return true;
}

/** 取缓存中的原始 Sheet（供服务端重新构建；非本人 / 过期 / 不存在 → null） */
export async function getRawSheet(id: string, userId: string): Promise<SheetInfo | null> {
  const entry = await readEntry(id, userId);
  return entry?.rawSheet ?? null;
}

/** 写入用户会话级确认状态（T1-D2）；非本人 / 过期 / 不存在 → false */
export async function saveTableConfirmation(
  id: string,
  userId: string,
  confirmation: TableConfirmation,
): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  entry.confirmation = confirmation;
  await writeEntry(entry);
  return true;
}

/** 取用户会话级确认状态；非本人 / 过期 / 不存在 → null */
export async function getTableConfirmation(id: string, userId: string): Promise<TableConfirmation | null> {
  const entry = await readEntry(id, userId);
  return entry?.confirmation ?? null;
}

/** 删除缓存（如用户主动放弃）；userId 提供时一并清理 L2 */
export async function deleteTableCache(id: string, userId?: string): Promise<void> {
  store.delete(id);
  if (userId) await deleteRemote(id);
}

/* ─────────────── AnalysisPlan 存储（T2-A / T2-B 历史版本化） ─────────────── */

/** 写入分析计划（按 planId 追加进历史；随 tableId + userId + TTL 隔离） */
export async function saveTablePlan(id: string, userId: string, plan: AnalysisPlan): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  entry.plans = entry.plans ?? {};
  entry.results = entry.results ?? {};
  entry.planOrder = entry.planOrder ?? [];
  entry.plans[plan.id] = plan;
  if (!entry.planOrder.includes(plan.id)) entry.planOrder.push(plan.id);
  entry.latestPlanId = plan.id;
  await writeEntry(entry);
  return true;
}

/** 读取最新分析计划；非本人 / 过期 / 不存在 → null */
export async function getTablePlan(id: string, userId: string): Promise<AnalysisPlan | null> {
  const entry = await readEntry(id, userId);
  if (!entry || !entry.latestPlanId) return null;
  return entry.plans?.[entry.latestPlanId] ?? null;
}

/** 按 planId 读取指定历史计划；非本人 / 过期 / 不存在 → null */
export async function getTablePlanById(id: string, userId: string, planId: string): Promise<AnalysisPlan | null> {
  const entry = await readEntry(id, userId);
  return entry?.plans?.[planId] ?? null;
}

/** 列出计划 + 结果历史（按生成顺序，含执行结果；供 T2-B 版本切换） */
export async function listTablePlans(
  id: string,
  userId: string,
): Promise<Array<{ plan: AnalysisPlan; result: PlanExecutionResult | null }>> {
  const entry = await readEntry(id, userId);
  if (!entry) return [];
  const order = entry.planOrder ?? [];
  return order
    .map((pid) => ({
      plan: entry.plans?.[pid],
      result: entry.results?.[pid] ?? null,
    }))
    .filter((x): x is { plan: AnalysisPlan; result: PlanExecutionResult | null } => !!x.plan);
}

/** 写入某计划的执行结果（按 planId 历史存储） */
export async function saveTableResult(
  id: string,
  userId: string,
  planId: string,
  result: PlanExecutionResult,
): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  entry.results = entry.results ?? {};
  entry.results[planId] = result;
  await writeEntry(entry);
  return true;
}

/** 读取某计划的执行结果；非本人 / 过期 / 不存在 → null */
export async function getTableResult(
  id: string,
  userId: string,
  planId: string,
): Promise<PlanExecutionResult | null> {
  const entry = await readEntry(id, userId);
  return entry?.results?.[planId] ?? null;
}

/** 清除全部分析计划与结果历史（字段 / Sheet / 表头变更时使旧计划失效） */
export async function clearTablePlan(id: string, userId: string): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  entry.plans = undefined;
  entry.results = undefined;
  entry.planOrder = undefined;
  entry.latestPlanId = undefined;
  entry.narratives = undefined;
  await writeEntry(entry);
  return true;
}

/* ─────────────── LLM 受控解读存储（T3-A） ─────────────── */

/** 写入解读（key = planId:resultId；仅 ready 状态入库；随 tableId + userId + TTL 隔离） */
export async function saveTableNarrative(
  id: string,
  userId: string,
  narrative: AnalysisNarrative,
): Promise<boolean> {
  const entry = await readEntry(id, userId);
  if (!entry) return false;
  entry.narratives = entry.narratives ?? {};
  entry.narratives[`${narrative.planId}:${narrative.resultId}`] = narrative;
  await writeEntry(entry);
  return true;
}

/** 读取解读；非本人 / 过期 / 不存在 → null */
export async function getTableNarrative(
  id: string,
  userId: string,
  planId: string,
  resultId: string,
): Promise<AnalysisNarrative | null> {
  const entry = await readEntry(id, userId);
  return entry?.narratives?.[`${planId}:${resultId}`] ?? null;
}
