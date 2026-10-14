// next/headers 的浏览器替身：cookies() 从「当前被拦截请求」的 Cookie 头取，
// 语义与 Next 的 cookies().get(name) 一致（见 lib/browser/current-request.ts 的串行前提）。
// headers() 同样从当前请求取。其余 API（revalidate 等）不参与浏览器轨道，点名报错。

import { currentRequest } from "@/lib/browser/current-request";

interface CookieLike {
  name: string;
  value: string;
}

function parseCookies(): Map<string, CookieLike> {
  const map = new Map<string, CookieLike>();
  const raw = currentRequest()?.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    let value = part.slice(eq + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      /* 非法编码原样保留 */
    }
    map.set(name, { name, value });
  }
  return map;
}

export function cookies(): {
  get: (name: string) => CookieLike | undefined;
  getAll: () => CookieLike[];
  has: (name: string) => boolean;
} {
  const map = parseCookies();
  return {
    get: (name) => map.get(name),
    getAll: () => [...map.values()],
    has: (name) => map.has(name),
  };
}

export function headers(): Headers {
  const req = currentRequest();
  if (!req) throw new Error("[browser] 无当前请求上下文，headers() 不可用");
  return req.headers;
}

export function revalidate(): never {
  throw new Error("此功能仅在本地版可用：浏览器数据层没有 Next 路由缓存");
}
