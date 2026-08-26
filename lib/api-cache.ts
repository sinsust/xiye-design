/**
 * 轻量前端 GET 缓存层：内存 Map + TTL，避免同一浏览器会话内
 * 频繁重复请求同一只读接口（第二大脑首屏 6 连发的数据源等）。
 *
 * 设计约束：
 * - 只缓存 HTTP ok 的响应；失败（非 2xx / 网络错误）不缓存、不吞异常，直接透传。
 * - key 拼上当前登录用户（localStorage 的 AUTH_CACHE_KEY），防止同实例多用户串数据。
 * - TTL 默认 30s；组件可传自定义 ttlMs。
 * - 纯客户端工具（引用 localStorage），仅在 client 组件中调用。
 */

import { AUTH_CACHE_KEY } from "@/lib/auth-events";

interface CacheEntry {
  data: unknown;
  expires: number;
}

const store = new Map<string, CacheEntry>();

/** 当前用户作用域（从登录缓存读取 email；未登录/解析失败回退 anon） */
function scopeKey(): string {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (raw) {
      const u = JSON.parse(raw) as { email?: string };
      if (u?.email) return u.email;
    }
  } catch {
    /* 解析失败回退 anon */
  }
  return "anon";
}

/** 读缓存；未命中或过期返回 null */
function read<T>(key: string): T | null {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.data as T;
  return null;
}

/** 写缓存（TTL 后自动过期，惰性清理） */
function write(key: string, data: unknown, ttlMs: number): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
  // 简单防膨胀：超过 200 条时清掉最老的 50 条
  if (store.size > 200) {
    const keys = [...store.keys()].slice(0, 50);
    for (const k of keys) store.delete(k);
  }
}

/**
 * 带 30s 内存缓存的 GET + JSON 解析。
 * 返回结构与裸 fetch().json() 一致（含 { error } 形态），调用方按原有
 * `res.ok` 等价语义判断（data 里目标字段存在才使用）。
 */
export async function cachedGetJson<T = unknown>(
  url: string,
  ttlMs = 30_000,
): Promise<T> {
  const key = `${scopeKey()}::${url}`;
  const hit = read<T>(key);
  if (hit !== null) return hit;

  const res = await fetch(url);
  const data = (await res.json().catch(() => null)) as T;
  if (res.ok && data !== null) write(key, data, ttlMs);
  return data;
}
