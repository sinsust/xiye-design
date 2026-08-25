import { createServerSupabaseReadonly } from "@/lib/supabase/server";

// 会话用户形状保持不变（{sub, email}），上层所有依赖 getSessionUser 的接口零改动。
export interface SessionUser {
  sub: string;
  email: string;
}

/**
 * 从请求 cookie 读取当前登录用户（基于 Supabase Auth 会话）；未登录返回 null。
 * 仅服务端调用。返回的 sub 即 Supabase auth.users.id（也就是业务主键 users.id）。
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabaseReadonly();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return { sub: user.id, email: user.email ?? "" };
}