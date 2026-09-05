import type { NextRequest } from "next/server";
import { createServerSupabaseService } from "@/lib/supabase/server";

/**
 * 跨实例限流（Vercel Serverless 安全）：
 * 原实现用进程内 Map，在 Serverless 多容器 / 冷启动 / 实例回收下不共享、计数清零，
 * 生产限流失效。改为经 Supabase 原子 RPC `check_rate_limit` 持久化计数，跨实例一致。
 *
 * 失败策略（fail-open）：存储/RPC 不可用时放行（return true），避免限流器自身抖动
 * 导致全站 429 不可用。日志会点名错误，便于排查；安全性由调用方业务层兜底。
 */

/** 从请求头提取客户端 IP（优先 x-forwarded-for，回退 x-real-ip） */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * 判断是否放行。windowMs 内请求数超过 limit 返回 false（调用方应拒绝）。
 * 经 Supabase 原子 RPC，跨实例一致；存储故障时 fail-open 放行。
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
      console.error("[rate-limit] RPC 失败，fail-open 放行:", error.message);
      return true;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[rate-limit] 异常，fail-open 放行:", e);
    return true;
  }
}
