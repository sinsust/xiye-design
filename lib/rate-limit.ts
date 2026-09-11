import type { NextRequest } from "next/server";
import { createServerSupabaseService } from "@/lib/supabase/server";

/**
 * 跨实例限流（Vercel Serverless 安全）：
 * 原实现用进程内 Map，在 Serverless 多容器 / 冷启动 / 实例回收下不共享、计数清零，
 * 生产限流失效。改为经 Supabase 原子 RPC `check_rate_limit` 持久化计数，跨实例一致。
 *
 * 失败策略（fail-safe / 降级）：存储或 RPC 不可用时**不再直接放行**，而是退化为
 * 进程内内存限流（单实例粒度）。理由：
 *  - 原 fail-open 在 RPC 缺失/抖动时等于「限流形同不存在」，登录爆破 / AI 额度滥用可无限打；
 *  - 进程内计数的确不跨实例，但对「同一攻击源短时高频」这类典型滥用依然有效，
 *    远优于完全放行；
 *  - 只降级、不拒绝，避免存储抖动时把正常用户也挡成 429（可用性与安全折中）。
 * 降级会打 ERROR 日志，便于监控 RPC 是否长期不可用（该修的是 RPC，不是限流器）。
 */

/** 从请求头提取客户端 IP（优先 x-forwarded-for，回退 x-real-ip） */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 降级用进程内计数器（仅存储故障时启用） */
const memoryHits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

/**
 * 进程内固定窗口限流（降级兜底）。返回 true=放行，false=超限。
 * 与 RPC 语义保持一致：windowMs 内超过 limit 即拒绝。
 */
function memoryRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const rec = memoryHits.get(key);
  if (!rec || rec.resetAt <= now) {
    // 机会式清理，防止 Map 在长驻实例上无限增长
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

/**
 * 判断是否放行。windowMs 内请求数超过 limit 返回 false（调用方应拒绝）。
 * 经 Supabase 原子 RPC，跨实例一致；存储故障时降级为进程内限流（fail-safe）。
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const supabase = createServerSupabaseService();
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) {
      console.error("[rate-limit] RPC 失败，降级为进程内限流:", error.message);
      return memoryRateLimit(key, limit, windowMs);
    }
    return Boolean(data);
  } catch (e) {
    console.error("[rate-limit] 异常，降级为进程内限流:", e);
    return memoryRateLimit(key, limit, windowMs);
  }
}
