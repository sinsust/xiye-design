// 浏览器轨道的「当前请求」上下文。
//
// 为什么需要：服务端版靠 next/headers 的 cookies() 拿「当前档案」，而 Service Worker
// 里既没有 document，也没有 next/headers —— 但被拦截的 /api 请求自带 Cookie 头
//（同源请求浏览器会自动带上），语义与 cookies() 完全一致。
//
// 并发约束：sql.js 是内存库、且这里是模块级单例状态，因此 sw 的分发必须串行
//（见 lib/browser/sw-entry.ts 的 queue）。串行后「当前请求」才是无歧义的。

let current: Request | null = null;

export function setCurrentRequest(req: Request | null): void {
  current = req;
}

export function currentRequest(): Request | null {
  return current;
}

/** 读取当前请求的某个 cookie 值；无请求上下文时返回 null */
export function readRequestCookie(name: string): string | null {
  const raw = current?.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const v = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}
