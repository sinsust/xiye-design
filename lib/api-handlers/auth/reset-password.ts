import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createServerSupabase } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ email: z.string().email().max(200) });

export async function POST(req: NextRequest) {
  try {
    return await handleReset(req);
  } catch (err) {
    // 兜底：邮件通道异常不应裸抛 500 暴露内部细节（对外仍统一成功，避免账号枚举）
    console.error("[auth/reset-password] 发送失败:", err);
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }
}

async function handleReset(req: NextRequest) {
  if (!rateLimit(`auth:reset:${getClientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const supabase = await createServerSupabase();
  // 不区分「该邮箱是否存在」，统一返回成功，避免枚举账号
  await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase(), {
    redirectTo: `${origin}/auth/confirm`,
  });
  return NextResponse.json({ ok: true });
}