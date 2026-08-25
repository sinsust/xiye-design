import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ password: z.string().min(8).max(100) });

/** 重置密码后调用：仅允许在已建立（重置）会话的上下文里改密。 */
export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  const { supabase, attachCookies } = await createServerSupabaseWithCookies();
  const { data: sessionData } = await supabase.auth.getUser();
  if (!sessionData.user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return NextResponse.json({ error: "update_failed" }, { status: 400 });
  }
  return attachCookies(NextResponse.json({ ok: true }));
}