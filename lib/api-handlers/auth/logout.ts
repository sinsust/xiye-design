import { NextResponse } from "next/server";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const { supabase, attachCookies } = await createServerSupabaseWithCookies();
  await supabase.auth.signOut(); // 清空会话 cookie，并由下方 attachCookies 回写清除指令
  return attachCookies(NextResponse.json({ ok: true }));
}