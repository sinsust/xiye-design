import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut(); // 清空会话 cookie
  return NextResponse.json({ ok: true });
}