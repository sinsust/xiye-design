import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    return await handleMe();
  } catch (err) {
    // 会话解析异常不应裸抛 500 暴露内部细节
    console.error("[auth/me] 获取失败:", err);
    return NextResponse.json({ error: "me_failed" }, { status: 500 });
  }
}

async function handleMe() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // 对外统一返回 {id, email}（内部 getSessionUser 仍为 {sub, email}），
  // 供前端 hasLocalUser/AuthMenu 以 id 判断登录态。
  return NextResponse.json({ user: { id: user.sub, email: user.email } });
}
