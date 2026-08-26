import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * 页面级登录门禁：只有首页、登录、注册可匿名访问，
 * 其余功能页（搭页面 / 找组件 / 知识库 / 流程 / 个人中心等）未登录直接跳登录页。
 * 认证基于 Supabase Auth 会话 cookie。
 *
 * Next 16 起 middleware 文件约定弃用，迁移为 proxy（同名函数签名与行为）。
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/builder/:path*",
    "/components/:path*",
    "/library/:path*",
    "/workflow/:path*",
    "/flow/:path*",
    "/flow-v2/:path*",
    "/brain/:path*",
    "/account/:path*",
    "/skills/:path*",
    "/styles/:path*",
    // API 也经过 proxy：负责刷新 auth cookie（否则 access token 1h 过期后，
    // 停在页面的用户调 API 会 401 —— 页面导航能触发刷新，但 API 请求不会）
    "/api/:path*",
  ],
};
