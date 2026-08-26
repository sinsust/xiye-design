// middleware 专用：用 @supabase/ssr 校验会话并在响应里回写/刷新 auth cookie。
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "./env";

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

  // API 请求：不重定向（未登录由路由自身返回 401 JSON），只负责刷新 cookie
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  if (!user && !isApi) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }

  return supabaseResponse;
}