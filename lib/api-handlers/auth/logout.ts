import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseWithCookies } from "@/lib/supabase/server";
import { logAuditReq, AUDIT_ACTION } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { supabase, attachCookies } = await createServerSupabaseWithCookies();
    // 登出前取当前用户，便于审计「谁登出了」；取不到也不阻塞登出。
    const { data: sessionData } = await supabase.auth.getUser();
    const uid = sessionData.user?.id ?? null;
    await supabase.auth.signOut(); // 清空会话 cookie，并由下方 attachCookies 回写清除指令
    if (uid) {
      void logAuditReq(req, {
        userId: uid,
        action: AUDIT_ACTION.LOGOUT,
        targetType: "user",
        targetId: uid,
      });
    }
    return attachCookies(NextResponse.json({ ok: true }));
  } catch (err) {
    // 登出失败时本地会话仍会被前端清理，但要留服务端日志便于排查
    console.error("[auth/logout] 登出失败:", err);
    return NextResponse.json({ error: "logout_failed" }, { status: 500 });
  }
}