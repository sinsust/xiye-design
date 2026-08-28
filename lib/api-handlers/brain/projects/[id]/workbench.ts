import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildProjectWorkbench } from "@/lib/brain-project-health";

export const runtime = "nodejs";

// GET /api/brain/projects/:id/workbench
// 返回「项目工作台」聚合视图。仅当前登录用户可读；项目不存在或无权限统一返回 404（不泄露存在性）。
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const workbench = await buildProjectWorkbench(user.sub, id);
    if (!workbench) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ workbench });
  } catch (err) {
    console.error("[project-workbench] build failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}