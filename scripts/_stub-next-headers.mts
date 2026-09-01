/**
 * 测试替身：`next/headers` 在纯 node 进程里无法解析（需 Next 运行时）。
 *
 * 验证脚本走的是 createServerSupabaseService()，它显式传入空 cookie 适配器、
 * 根本不读请求 cookie；但同模块（lib/supabase/server.ts）的其他导出会 import
 * next/headers，导致 bundle 后 node 起不来。
 *
 * 这里只为让 import 链成功；若真被调用则立即抛错，避免验证在错误路径上「假通过」。
 */
export function cookies(): never {
  throw new Error(
    "[stub] next/headers 的 cookies() 不应在验证脚本中被调用 —— " +
      "说明代码走进了依赖请求上下文的分支，请检查是否误用了 createServerSupabase()。",
  );
}

export function headers(): never {
  throw new Error("[stub] next/headers 的 headers() 不应在验证脚本中被调用");
}
