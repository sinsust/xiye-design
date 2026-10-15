import { NextResponse } from "next/server";
import { markHeartbeat } from "@/lib/dev-heartbeat";

// 浏览器心跳端点：components/dev-heartbeat.tsx 周期调用，标记「还有前端在访问」。
// 生产环境此端点仍可访问但无副作用（不触发任何退出逻辑）。
// 注意：路由段不能用前导下划线（如 __hb），Next 会把它当私有/保留目录而不注册路由 → 404。
export const dynamic = "force-dynamic";

export async function GET() {
  markHeartbeat();
  return NextResponse.json({ ok: true });
}
