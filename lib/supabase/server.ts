// 服务端 Supabase 客户端（Route Handler / Server Component 用）。
// 可读写会话 cookie（登录/登出/换 session 时回写 cookies()）。
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 从 Server Component 里写 cookie 会抛错，交由 middleware 兜底处理即可。
        }
      },
    },
  });
}

/** 只读会话客户端：拿当前用户，不回写 cookie（用于 getSessionUser 等不产生会话更新的读取）。 */
export async function createServerSupabaseReadonly() {
  const cookieStore = await cookies();
  return createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        /* 只读：忽略回写 */
      },
    },
  });
}