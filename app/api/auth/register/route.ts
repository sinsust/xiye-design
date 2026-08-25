import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";
import { db, users } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(`auth:register:${getClientIp(req)}`, 5, 60_000)) {
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
    if (/already registered/i.test(error.message)) {
      return NextResponse.json({ error: "email_taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "register_failed" }, { status: 400 });
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