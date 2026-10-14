// 给「浏览器轨道根本不该加载」的服务端依赖用的替身：被调用时点名说明，而不是静默返回空。
// 由 scripts/build-sw.mjs 通过 esbuild alias 注入（better-sqlite3 / postgres / transformers 等）。

class Unavailable {
  constructor() {
    throw new Error("此功能仅在本地版可用：该依赖不参与浏览器数据层");
  }
}

export function drizzle(): never {
  throw new Error("此功能仅在本地版可用：驱动未接入浏览器数据层");
}

export function initSqlJs(): never {
  throw new Error("此功能仅在本地版可用");
}

/** postgres(...) 返回的 client：任何方法被调用都点名 */
export default function postgresStub(): never {
  throw new Error("此功能仅在本地版可用：浏览器数据层不连 Postgres");
}

export { postgresStub as Database };
export { Unavailable };
