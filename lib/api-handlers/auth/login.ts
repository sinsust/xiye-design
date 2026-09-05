import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    return await handleLogin(req);
  } catch (err) {
    // 兜底：supabase 网络/配置异常不应裸抛 500 暴露内部细节
    console.error("[auth/login] 登录失败:", err);
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }
}

async function handleLogin(req: NextRequest) {
  if (!await rateLimit(`auth:login:${getClientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const { supabase, attachCookies } = await createServerSupabaseWithCookies();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // 统一收窄为「账号/密码错误」，避免泄露账号是否存在
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  const u = data.user;
  return attachCookies(
    NextResponse.json({ user: { id: u.id, email: u.email } }),
  );
}