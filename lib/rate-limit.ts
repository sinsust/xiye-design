import type { NextRequest } from "next/server";

/**
 * 限流（单机版）：纯进程内计数器。
 *
 * 背景：本项目已收敛为单机形态（DB_MODE=sqlite 本地库 + 桌面壳），不存在多实例 /
 * Serverless 冷启动场景，原先「Supabase RPC 跨实例限流 + 熔断降级」的双层实现
 * 已无意义——每次进程首启还要白等 1.5s 超时才降级。现收敛为单一内存实现：
 * 零网络开销、行为确定。
 */

/** 从请求头提取客户端 IP（优先 x-forwarded-for，回退 x-real-ip） */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

// —— 进程内计数器 ——
const memoryHits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = memoryHits.get(key);
  if (!rec || rec.resetAt <= now) {
    if (memoryHits.size >= MEMORY_MAX_KEYS) {
      for (const [k, v] of memoryHits) {
        if (v.resetAt <= now) memoryHits.delete(k);
      }
    }
    memoryHits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (rec.count >= limit) return false;
  rec.count += 1;
  return true;
}

/** 判断是否放行：同一 key 在 windowMs 内超过 limit 次即拒绝 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const allowed = memoryRateLimit(key, limit, windowMs);
  if (!allowed) {
    console.warn(`[rate-limit] DENY key=${key.slice(0, 60)}`);
  }
  return allowed;
}