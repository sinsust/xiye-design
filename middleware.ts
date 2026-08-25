import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * 页面级登录门禁：只有首页、登录、注册可匿名访问，
 * 其余功能页（搭页面 / 找组件 / 知识库 / 流程 / 个人中心等）未登录直接跳登录页。
 * 认证基于 Supabase Auth 会话 cookie。
 */
export async function middleware(request: NextRequest) {
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
  ],
};