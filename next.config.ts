import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 构建固定走 webpack（见 package.json 的 build: `next build --webpack`）。
  // 原因：必用的 @xenova/transformers / better-sqlite3 原生包需保持外部化，
  // 而 Turbopack 会在 `.next/node_modules` 生成嵌套外部包 junction，
  // 本项目运行环境（Trae Solo vmcache 覆盖层）无法删除该嵌套 junction，
  // 导致 `next build`（Turbopack 默认）在收尾清理时 EPERM 失败、产物不落盘。
  // Next 16 的 next.config 无顶层引擎布尔开关（`turbopack` 为 TurbopackOptions），
  // 故用 build 脚本 `--webpack` 固化；serverExternalPackages 仍由 webpack externals 处理。
  // 本地开发仍可能静态解析到 better-sqlite3，显式声明为外部包，
  // 避免其原生绑定被打包进 server bundle（线上走 Supabase 时本就不会加载）。
  serverExternalPackages: ["better-sqlite3"],
  // 文件追踪排除：brand-pack / static-site-handler 的宽泛 fs 扫描会把
  // .git/.next 缓存等巨物带进函数 nft 追踪（单文件 >200MB），Vercel 在
  // "Deploying outputs" 上传校验直接拒绝。这些目录运行期均不需要。
  outputFileTracingExcludes: {
    "*": [
      "**/.git/**",
      "**/.next/**",
      "**/.next-*/**",
      "**/.env*",
      "**/build-*.log",
      "**/pnpm-*.log",
      "**/scripts/.tmp-*.mjs",
      "**/scripts/.scratch-*.mjs",
    ],
  },
};

export default nextConfig;
