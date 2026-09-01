// AUTO-GENERATED style — 飞书 OAuth + 数据导入路由分发器。
// 把 5 个飞书 handler 合并为 1 个 Serverless Function（URL 与行为不变）。
import { NextRequest, NextResponse } from "next/server";
import * as m0 from "@/lib/api-handlers/feishu/authorize";
import * as m1 from "@/lib/api-handlers/feishu/callback";
import * as m2 from "@/lib/api-handlers/feishu/status";
import * as m3 from "@/lib/api-handlers/feishu/disconnect";
import * as m4 from "@/lib/api-handlers/feishu/import";
import * as m5 from "@/lib/api-handlers/feishu/tables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HandlerFn = (req: NextRequest, ctx?: unknown) => Promise<Response> | Response;
type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
interface RouteDef {
  key: string;
  methods: Partial<Record<Method, HandlerFn>>;
}

const ROUTES: RouteDef[] = [
  { key: "authorize", methods: { GET: m0.GET as HandlerFn } },
  { key: "callback", methods: { GET: m1.GET as HandlerFn } },
  { key: "status", methods: { GET: m2.GET as HandlerFn } },
  { key: "disconnect", methods: { POST: m3.POST as HandlerFn } },
  { key: "import", methods: { POST: m4.POST as HandlerFn } },
  { key: "tables", methods: { GET: m5.GET as HandlerFn } },
];

/** 精确匹配优先，其次 [id] 动态段匹配；返回参数表 */
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
