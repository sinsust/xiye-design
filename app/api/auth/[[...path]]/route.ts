// 本地档案模式下仅保留 /api/auth/me —— 供前端探测「当前档案」。
// 需求①（去掉注册登录）后，login/register/reset-password/update-password/confirm/resend/logout
// 已全部移除，此分发器随之收缩为单一路由。
import { NextRequest, NextResponse } from "next/server";
import * as m0 from "@/lib/api-handlers/auth/me";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel 公开版：AI 生成/zip 打包等长任务（Pro 档上限 300s）
export const dynamic = "force-dynamic";

type HandlerFn = (req: NextRequest, ctx?: unknown) => Promise<Response> | Response;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const ROUTES: Record<string, Partial<Record<Method, HandlerFn>>> = {
  me: { GET: m0.GET as HandlerFn },
};

async function dispatch(
  method: Method,
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: p } = await ctx.params;
  const key = (p ?? []).join("/");
  const def = ROUTES[key];
  if (!def) {
    return NextResponse.json({ error: "not_found", message: "接口不存在" }, { status: 404 });
  }
  const fn = def[method];
  if (!fn) {
    return NextResponse.json({ error: "method_not_allowed", message: "方法不支持" }, { status: 405 });
  }
  return fn(req) as Promise<Response>;
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("GET", req, ctx);
export const POST = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("POST", req, ctx);
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("PUT", req, ctx);
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("PATCH", req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("DELETE", req, ctx);