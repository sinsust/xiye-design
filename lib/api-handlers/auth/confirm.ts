import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Supabase 魔改/确认链接回跳路由：
 * 链接形如 /auth/confirm?token_hash=xxx&type=recovery（或 code=xxx）。
 * 校验 OTP 建立会话后，跳转到设置新密码页（须把会话 cookie 一并写入响应，否则会话丢失）。
 */
export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams;
  const tokenHash = search.get("token_hash");
  const type = search.get("type");
  const code = search.get("code");
  const tokenParam = search.get("token");

  const { supabase, attachCookies } = await createServerSupabaseWithCookies();

  if ((tokenHash || tokenParam) && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash: (tokenHash || tokenParam) as string,
    });
    if (!error) {
      return attachCookies(NextResponse.redirect(new URL("/auth/update-password", req.url)));
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return attachCookies(NextResponse.redirect(new URL("/auth/update-password", req.url)));
    }
  }

  // 校验失败：回到登录页并带提示
  return NextResponse.redirect(new URL("/login?verify=failed", req.url));
}