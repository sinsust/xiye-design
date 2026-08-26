/**
 * 表格处理 —— 服务端会话缓存
 *
 * upload 时把解析/清洗/画像结果缓存到内存，返回 tableId；
 * analyze 只传 tableId，避免每次回传大体积 rows（Vercel 生产请求体 4.5MB 限制）。
 * TTL 30 分钟自动清理；进程内 Map（单实例够用，多实例需换 Redis）。
 */

import { randomUUID } from "crypto";

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
  /** 创建时间戳 */
  createdAt: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 分钟
const CLEAN_INTERVAL_MS = 5 * 60 * 1000; // 每 5 分钟清理过期

const store = new Map<string, CacheEntry>();
let lastClean = Date.now();

/** 保存解析结果（绑定归属用户），返回 tableId */
export function cacheTable(userId: string, headers: string[], rows: unknown[][], columnTypes: string[]): string {
  cleanup();
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  store.set(id, { userId, headers, rows, columnTypes, createdAt: Date.now() });
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

/** 删除缓存（如用户主动放弃） */
export function deleteTableCache(id: string): void {
  store.delete(id);
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
