import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().email().max(200) });

/**
 * 重发注册确认邮件（P0-3 闭环的配套）：注册后确认邮件丢失/过期时，
 * 用户在「请查收确认邮件」页可主动重发，不再卡死在「等一封永不来的邮件」。
 * 统一返回成功（不区分邮箱是否已注册/已验证），避免账号枚举。
 */
export async function POST(req: NextRequest) {
  try {
    return await handleResend(req);
  } catch (err) {
    console.error("[auth/resend] 发送失败:", err);
    return NextResponse.json({ error: "resend_failed" }, { status: 500 });
  }
}

async function handleResend(req: NextRequest) {
  if (!await rateLimit(`auth:resend:${getClientIp(req)}`, 3, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email.toLowerCase(),
  });
  return NextResponse.json({ ok: true });
}
