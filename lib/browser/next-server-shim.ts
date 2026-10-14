// next/server 的浏览器(service worker)垫片。
//
// 为什么要它：99 个 handler 里有 715 处 NextResponse(709 .json + 6 .redirect)，
// 全部是标准 Response 能力。给浏览器编译目标换成这个垫片，handler 一行都不用改，
// 本地/PG 轨道继续用真的 next/server。
//
// 只在 sw 打包时通过 esbuild --alias:next/server 注入，不参与 Next 自身的服务端编译。

type BodyInit_ = BodyInit | null;

function jsonHeaders(init?: ResponseInit): Headers {
  const h = new Headers(init?.headers);
  if (!h.has("content-type")) h.set("content-type", "application/json");
  return h;
}

export class NextResponse<T = unknown> extends Response {
  static json<T>(data: T, init?: ResponseInit): NextResponse<T> {
    return new NextResponse<T>(JSON.stringify(data), { ...init, headers: jsonHeaders(init) });
  }

  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse {
    const status = typeof init === "number" ? init : (init?.status ?? 307);
    const headers = new Headers(typeof init === "object" ? init.headers : undefined);
    headers.set("location", String(url));
    return new NextResponse(null, { status, headers });
  }

  /** Next 的 cookies 面在项目 handler 里未被使用，这里仅保留形状避免误用时静默失效 */
  get cookies(): never {
    throw new Error("[browser] NextResponse.cookies 在浏览器数据层不可用");
  }
}

/** handler 收到的请求：需要 Request 全部能力 + nextUrl + cookies 读取 */
export class NextRequest extends Request {
  readonly nextUrl: URL;

  constructor(input: string | URL | Request, init?: RequestInit) {
    const superInput = input instanceof URL ? String(input) : input;
    super(superInput, init);
    this.nextUrl = new URL(this.url);
  }

  cookies = {
    get: (name: string) => {
      const raw = this.headers.get("cookie") ?? "";
      for (const part of raw.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() === name) {
          const v = part.slice(eq + 1).trim();
          try {
            return { name, value: decodeURIComponent(v) };
          } catch {
            return { name, value: v };
          }
        }
      }
      return undefined;
    },
    getAll: () => [] as Array<{ name: string; value: string }>,
  };
}

/** lib/brain-plan.ts 等用 after() 跑后台任务：sw 里没有「响应之后」的生命周期保证，
 *  这里立刻发起（不 await），失败只记日志——与 after 的 fire-and-forget 语义一致。 */
export function after(fn: (() => Promise<unknown> | unknown) | { run: () => Promise<unknown> }): void {
  const run = async () => {
    try {
      if (typeof fn === "function") await fn();
      else await fn.run();
    } catch (e) {
      console.warn("[browser] after() 后台任务失败:", e);
    }
  };
  void run();
}

export { NextResponse as default };
export type { BodyInit_ };
