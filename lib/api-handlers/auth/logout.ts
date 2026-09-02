import { NextResponse } from "next/server";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { supabase, attachCookies } = await createServerSupabaseWithCookies();
    await supabase.auth.signOut(); // 清空会话 cookie，并由下方 attachCookies 回写清除指令
    return attachCookies(NextResponse.json({ ok: true }));
  } catch (err) {
    // 登出失败时本地会话仍会被前端清理，但要留服务端日志便于排查
    console.error("[auth/logout] 登出失败:", err);
    return NextResponse.json({ error: "logout_failed" }, { status: 500 });
  }
}