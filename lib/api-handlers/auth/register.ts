import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";
import { db, users } from "@/lib/db";
import { z } from "zod";
import { logAuditReq, maskEmail, AUDIT_ACTION } from "@/lib/audit-log";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  try {
    return await handleRegister(req);
  } catch (err) {
    // 兜底：注册链路异常不应裸抛 500 暴露内部细节
    console.error("[auth/register] 注册失败:", err);
    return NextResponse.json({ error: "register_failed" }, { status: 500 });
  }
}

async function handleRegister(req: NextRequest) {
  if (!await rateLimit(`auth:register:${getClientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();

  const { supabase, attachCookies } = await createServerSupabaseWithCookies();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${new URL(req.url).origin}/login`,
    },
  });

  if (error) {
    // 已注册邮箱返回明确的 409 email_taken：前端据此引导「直接登录/找回密码」，
    // 避免「假成功 → 永远等不到确认邮件」的死路（P0-3）。
    // 枚举风险可接受：找回密码流程本就需要邮箱可达性，且 Supabase 默认注册响应已含该语义。
    const msg = (error.message || "").toLowerCase();
    if (error.status === 422 || msg.includes("already registered")) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    // 其余错误（网络/配置/限流）如实返回失败，让用户重试而非空等邮件
    console.error("[auth/register] signUp 失败:", error.message);
    return NextResponse.json({ error: "register_failed" }, { status: 500 });
  }

  const u = data.user;
  if (!u) {
    return NextResponse.json({ error: "register_failed" }, { status: 400 });
  }

  // 落一条业务侧 profile（id 即 Supabase auth.users.id；密码由 Auth 托管，password_hash 置空）
  try {
    await db
      .insert(users)
      .values({ id: u.id, email, passwordHash: null, createdAt: Date.now() })
      .onConflictDoNothing();
  } catch {
    /* 已存在/冲突可忽略，后续登录时以 auth 身份为准 */
  }

  // 审计：注册成功（去敏邮箱，仅留痕便于追溯）
  void logAuditReq(req, {
    userId: u.id,
    action: AUDIT_ACTION.REGISTER,
    targetType: "user",
    targetId: u.id,
    detail: { email: maskEmail(u.email) },
  });

  // data.session 存在 = 免确认直接登录；否则站了邮箱确认流程，需等确认后再登录
  return attachCookies(
    data.session
      ? NextResponse.json({ user: { id: u.id, email: u.email } })
      : NextResponse.json(
          { user: { id: u.id, email: u.email }, requiresEmailConfirmation: true },
          { status: 200 },
        ),
  );
}