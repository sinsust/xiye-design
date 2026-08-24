import type { NextRequest } from "next/server";

/**
 * 内存滑动窗口限流：按 key（通常为客户端 IP）统计窗口内请求数。
 * 仅适合单实例部署；多实例/生产请替换为 Redis 等共享存储。
 */

const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

/** 从请求头提取客户端 IP（优先 x-forwarded-for，回退 x-real-ip） */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * 判断是否放行。windowMs 内请求数超过 limit 返回 false（应拒绝）。
 * 简单清理：键数超上限时淘汰已过期窗口的 key，避免内存无限增长。
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);

  if (hits.size > MAX_TRACKED_KEYS) {
    for (const [k, v] of hits) {
      if (v.length && now - v[v.length - 1] > windowMs) hits.delete(k);
    }
  }
  return true;
}
