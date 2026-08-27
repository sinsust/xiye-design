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
import type { AnalysisPlan } from "./analysis-plan";

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
  /** 当前生成的分析计划（T2-A；随确认版本失效，不落库） */
  plan?: AnalysisPlan;
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

/* ─────────────── AnalysisPlan 存储（T2-A） ─────────────── */

/** 写入分析计划（随 tableId + userId + TTL 隔离；非本人 / 过期 / 不存在 → false） */
export function saveTablePlan(id: string, userId: string, plan: AnalysisPlan): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.plan = plan;
  return true;
}

/** 读取分析计划；非本人 / 过期 / 不存在 → null */
export function getTablePlan(id: string, userId: string): AnalysisPlan | null {
  const entry = store.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return null;
  }
  if (entry.userId !== userId) return null;
  return entry.plan ?? null;
}

/** 清除分析计划（字段 / Sheet / 表头变更时使旧计划失效；非本人 / 过期 / 不存在 → false） */
export function clearTablePlan(id: string, userId: string): boolean {
  const entry = store.get(id);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(id);
    return false;
  }
  if (entry.userId !== userId) return false;
  entry.plan = undefined;
  return true;
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
