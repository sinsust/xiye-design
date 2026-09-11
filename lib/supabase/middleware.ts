// middleware 专用：用 @supabase/ssr 校验会话并在响应里回写/刷新 auth cookie。
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

/**
 * 允许匿名访问的 API 前缀（集中鉴权白名单）。
 * - /api/auth/**：认证入口本身（登录/注册/找回/确认/登出），以及前端用于
 *   探测登录态的 /api/auth/me（未登录时自身返回 401 + {user:null}）。
 * - /api/feishu/callback：飞书 OAuth 回调需 302 回前端展示结果，
 *   不能在此被替换成 JSON 401（其自身会校验会话并降级为 302 错误页）。
 * 白名单之外的 API 一律要求已登录。
 */
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/feishu/callback"];

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/** 请求是否携带 Supabase auth cookie（区分「未登录」与「有会话但校验暂时失败」） */
function hasAuthCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some((c) => c.name.includes("-auth-token"));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() 会解析并（必要时）刷新访问令牌；结果用于门禁判断。
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 页面请求：未登录跳登录页（带 next 回跳）
  if (!pathname.startsWith("/api/")) {
    if (!user) {
      const login = new URL("/login", request.url);
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
    return supabaseResponse;
  }

  // —— API 集中鉴权门禁（defense-in-depth）——
  // 此前 API 请求无论是否登录都直接透传，鉴权完全依赖各 handler 自觉调用 requireUser()；
  // 任一 handler 漏写（例如 app/api/strat-fix 曾可匿名触发清表 / 读取笔记正文）即形成越权。
  // 这里补第一道闸：白名单之外的 API，未登录直接 401。
  //
  // 只在「明确没有 auth cookie」时才拦：Supabase 网络抖动会让 getUser() 返回 null，
  // 此时已登录用户仍带 cookie，应交给 handler 自行判定，避免全站 API 被误伤成 401。
  if (request.method === "OPTIONS" || isPublicApi(pathname) || hasAuthCookie(request)) {
    return supabaseResponse;
  }
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return supabaseResponse;
}