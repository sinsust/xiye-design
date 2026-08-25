// 浏览器端 Supabase 客户端（可在客户端组件直接做认证/会话操作）。
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

export function createBrowserSupabase() {
  return createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey);
}