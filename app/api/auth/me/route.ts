import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  // 对外统一返回 {id, email}（内部 getSessionUser 仍为 {sub, email}），
  // 供前端 hasLocalUser/AuthMenu 以 id 判断登录态。
  return NextResponse.json({ user: { id: user.sub, email: user.email } });
}
