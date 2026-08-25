// 全局共享 & 短缓存的会话获取：避免多个组件/页面各自重复请求 /api/auth/me。
// 登录/登出通过 lib/auth-events 广播，相关页面监听事件后再 force 刷新即可。
export type SessionUser = { id?: string; email: string } | null;

let sessionCache: { user: SessionUser; at: number } | null = null;
const TTL = 15000;

export async function fetchSession(options?: {
  force?: boolean;
}): Promise<SessionUser> {
  if (!options?.force && sessionCache && Date.now() - sessionCache.at < TTL) {
    return sessionCache.user;
  }
  let user: SessionUser = null;
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const d = r.ok ? await r.json() : { user: null };
    user = (d.user ?? null) as SessionUser;
  } catch {
    user = null;
  }
  sessionCache = { user, at: Date.now() };
  return user;
}