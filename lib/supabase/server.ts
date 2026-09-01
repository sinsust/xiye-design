// 服务端 Supabase 客户端（Route Handler / Server Component 用）。
// 可读写会话 cookie（登录/登出/换 session 时回写 cookies()）。
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
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

/**
 * 服务端 service_role 客户端：绕过 RLS，仅用于特权服务端读写（如表格会话持久化）。
 * service_role key 仅在服务端可用，绝不向下游 / 客户端暴露。
 * 防串读由调用方在代码层用 userId 校验兜底（见 lib/table/session-persist.ts）。
 */
export function createServerSupabaseService() {
  return createServerClient(
    supabaseEnv.url,
    supabaseEnv.serviceRoleKey || supabaseEnv.anonKey,
    { cookies: { getAll: () => [], setAll() {} } },
  );
}

/**
 * Route Handler 专用：登录/登出/注册等需要「往响应里写会话 cookie」的接口用它。
 *
 * Next.js Route Handler 里的 cookies() 是只读的，直接 cookieStore.set() 会抛错并被静默吞掉，
 * 导致登录/登出后的会话 cookie 从未写入响应、middleware 永远认为未登录。
 * 这里先把 setAll 回调产生的 cookie 收集起来，由调用方在 return 时 attachCookies(res) 写进响应。
 */
export async function createServerSupabaseWithCookies() {
  const cookieStore = await cookies();
  const collected: { name: string; value: string; options?: unknown }[] = [];
  const supabase = createServerClient(supabaseEnv.url, supabaseEnv.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          collected.push({ name, value, options }),
        );
      },
    },
  });
  return {
    supabase,
    /** 把本次产生的会话 cookie 设到响应上并返回该响应（用于 final response）。 */
    attachCookies(res: NextResponse): NextResponse {
      for (const { name, value, options } of collected) {
        res.cookies.set(name, value, options as never);
      }
      return res;
    },
  };
}