// 浏览器数据层的 Service Worker 入口：把 /api/* 请求接进本项目原有的 handler。
//
// 形态：线上部署不跑任何服务端业务代码 —— 同一条 handler 源码由 esbuild 打包进本文件
//（见 scripts/build-sw.mjs），数据落在访问人浏览器的 IndexedDB（lib/browser/sqlite.ts）。
// 本地/桌面轨道完全不经过这里：不注册 sw 时，/api 仍由 Next 的服务端路由处理。
//
// 关键约束：sql.js 是单例内存库，且「当前请求」是模块级状态（lib/browser/current-request.ts），
// 因此所有 /api 分发严格串行。代价是没有并发，收益是写路径不存在竞态、且与业务代码零改动等价。

import * as aiRoutes from "@/app/api/ai/[[...path]]/route";
import * as authRoutes from "@/lib/api-handlers/auth/me";
import * as brainRoutes from "@/app/api/brain/[[...path]]/route";
import * as brandRoutes from "@/app/api/brand/[[...path]]/route";
import * as feishuRoutes from "@/app/api/feishu/[[...path]]/route";
import * as knowledgeRoutes from "@/app/api/knowledge/[[...path]]/route";
import * as originkitRoutes from "@/app/api/originkit/[[...path]]/route";
import * as projectsRoutes from "@/app/api/projects/[[...path]]/route";
import * as otherRoutes from "@/app/api/[[...path]]/route";
import * as stratFixRoutes from "@/lib/api-handlers/misc/strat-fix";
import { NextRequest, NextResponse } from "@/lib/browser/next-server-shim";
import { setCurrentRequest } from "@/lib/browser/current-request";
import { persist } from "@/lib/browser/sqlite";
import { dbReady } from "@/lib/db";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RouteModule = Record<string, unknown>;

/** 第一段路径 → 对应的 catch-all 路由模块（与 app/api 目录一一对应） */
const GROUPS: Record<string, RouteModule> = {
  ai: aiRoutes,
  auth: authRoutes,
  brain: brainRoutes,
  brand: brandRoutes,
  feishu: feishuRoutes,
  knowledge: knowledgeRoutes,
  originkit: originkitRoutes,
  projects: projectsRoutes,
};

/** 不属于任何分组时落到 .../api/[[...path]]（account/agents/component-* 等） */
const DEFAULT_GROUP = otherRoutes;

function pick(method: Method, segments: string[]): { mod: RouteModule; rest: string[] } | null {
  if (segments[0] === "strat-fix") {
    return { mod: stratFixRoutes, rest: segments.slice(1) };
  }
  const head = segments[0];
  if (head && GROUPS[head]) return { mod: GROUPS[head], rest: segments.slice(1) };
  return { mod: DEFAULT_GROUP, rest: segments };
}

async function handle(req: Request, url: URL): Promise<Response> {
  // sw 脚本不能有顶层 await，所以 lib/db 的初始化不在 import 期完成；
  // 第一个请求进来时先等它就绪（串行队列保证只等一次）。
  await dbReady;
  const method = req.method.toUpperCase() as Method;
  const segments = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const hit = pick(method, segments);
  if (!hit) {
    return NextResponse.json({ error: "not_found", message: "接口不存在" }, { status: 404 });
  }
  const fn = hit.mod[method];
  if (typeof fn !== "function") {
    return NextResponse.json({ error: "method_not_allowed", message: "方法不支持" }, { status: 405 });
  }
  const next = new NextRequest(req);
  setCurrentRequest(next);
  try {
    // 与 Next 的 catch-all 调用约定一致：ctx.params 解析出 { path: 剩余段 }
    const res = await (fn as (r: unknown, ctx?: unknown) => Promise<Response>)(next, {
      params: Promise.resolve({ path: hit.rest }),
    });
    // 非读请求后整库落盘（sql.js 只能全量导出，见 lib/browser/idb.ts 的代价说明）
    if (method !== "GET") await persist();
    // 运行期标记：便于在浏览器里一眼确认这条响应是本机 sw 出的、而不是漏到了服务器
    //（headers 不可写时忽略，不影响响应本身）
    try {
      res.headers.set("x-xiye-runtime", "browser");
    } catch {
      /* 只读头（如上游已冻结）直接放行 */
    }
    return res;
  } finally {
    setCurrentRequest(null);
  }
}

// —— sw 生命周期（用最小本地类型，避免依赖 WebWorker lib 声明）——
interface FetchEventLike extends Event {
  request: Request;
  respondWith(r: Response | Promise<Response>): void;
}
interface ExtendableEventLike extends Event {
  waitUntil(p: Promise<unknown>): void;
}

const sw = self as unknown as {
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install", cb: (e: ExtendableEventLike) => void): void;
  addEventListener(type: "activate", cb: (e: ExtendableEventLike) => void): void;
  addEventListener(type: "fetch", cb: (e: FetchEventLike) => void): void;
};

// 串行队列：同一时刻只跑一个 handler（见文件头「关键约束」）
let tail: Promise<unknown> = Promise.resolve();
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}

sw.addEventListener("install", (e) => {
  void e.waitUntil(sw.skipWaiting());
});
sw.addEventListener("activate", (e) => {
  void e.waitUntil(sw.clients.claim());
});
sw.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return;
  e.respondWith(
    enqueue(() => handle(e.request, url)).catch(
      (err: unknown) =>
        NextResponse.json(
          {
            error: "browser_handler_failed",
            message: err instanceof Error ? err.message : String(err),
          },
          { status: 500 },
        ),
    ),
  );
});
