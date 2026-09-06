// 私人资料路由分发器：合并为 1 个 Serverless Function（满足 Vercel Hobby 12 函数上限）。
// 与 projects/ brain 分发器同构；private-data 独立于 brain 路由文件，避免与 M3 重构冲突。
import { NextRequest, NextResponse } from "next/server";
import * as m0 from "@/lib/api-handlers/private-data";
import * as m1 from "@/lib/api-handlers/private-data/[id]";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HandlerFn = (req: NextRequest, ctx?: unknown) => Promise<Response> | Response;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface RouteDef {
  key: string;
  methods: Partial<Record<Method, HandlerFn>>;
}

const ROUTES: RouteDef[] = [
  { key: "", methods: { GET: m0.GET as HandlerFn, POST: m0.POST as HandlerFn } },
  { key: "[id]", methods: { GET: m1.GET as HandlerFn, PUT: m1.PUT as HandlerFn, DELETE: m1.DELETE as HandlerFn } },
];

function matchRoute(path: string[]): { def: RouteDef; params: Record<string, string> } | null {
  const key = path.join("/");
  for (const def of ROUTES) {
    if (def.key === key) return { def, params: {} };
  }
  for (const def of ROUTES) {
    const parts = def.key.split("/");
    if (parts.length !== path.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const m = parts[i].match(/^\[([^\]]+)\]$/);
      if (m) params[m[1]] = decodeURIComponent(path[i]);
      else if (parts[i] !== path[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { def, params };
  }
  return null;
}

async function dispatch(
  method: Method,
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  const { path: p } = await ctx.params;
  const hit = matchRoute(p ?? []);
  if (!hit) {
    return NextResponse.json({ error: "not_found", message: "接口不存在" }, { status: 404 });
  }
  const fn = hit.def.methods[method];
  if (!fn) {
    return NextResponse.json({ error: "method_not_allowed", message: "方法不支持" }, { status: 405 });
  }
  return fn(req, { params: Promise.resolve(hit.params) }) as Promise<Response>;
}

export const GET = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("GET", req, ctx);
export const POST = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("POST", req, ctx);
export const PUT = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("PUT", req, ctx);
export const PATCH = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("PATCH", req, ctx);
export const DELETE = (req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) => dispatch("DELETE", req, ctx);
