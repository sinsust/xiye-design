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
  //
  // @xenova/transformers：本地语义向量（见 lib/embedding.ts）。其依赖树带
  // protobufjs（critical：任意代码执行）与 sharp（high：libvips CVE）。
  // 该包仅在 lib/embedding.ts 内「动态 import」，且 EMBEDDING_ENABLED 默认关闭，
  // 运行时不会加载 —— 这里再外部化一层，确保 critical 依赖既不进 bundle 也不可执行。
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers"],
  // 文件追踪排除：brand-pack / static-site-handler 的宽泛 fs 扫描会把
  // .git / .next/cache（本机实测 1.6G）等巨物带进函数 nft 追踪（单文件 >200MB），
  // Vercel 在 "Deploying outputs" 上传校验直接拒绝。
  // ⚠️ 坑：禁止写 `**/.next/**` 整目录排除——`.next/server/webpack-runtime.js`
  // 是 Next 运行时入口 middleware.js 的必需依赖，整排除会让线上 MODULE_NOT_FOUND。
  // 只排除构建缓存/临时产物（cache / dev），保留 .next/server 与 .next/static。
  outputFileTracingExcludes: {
    "*": [
      "**/.git/**",
      "**/.next/cache/**",
      "**/.next/dev/**",
      "**/.next-*/**",
      "**/.env*",
      "**/build-*.log",
      "**/pnpm-*.log",
      "**/scripts/.tmp-*.mjs",
      "**/scripts/.scratch-*.mjs",
    ],
  },
  // /auth/confirm 已并入 auth 组 catch-all（app/api/auth/[[...path]]，key "confirm"）。
  // 邮件里已发出的 Supabase 回跳链接仍指向 /auth/confirm，用 rewrites 保 URL 兼容
  //（Next 层，dev/prod 均生效，不新增 Serverless Function）。
  async rewrites() {
    return [{ source: "/auth/confirm", destination: "/api/auth/confirm" }];
  },
  // 安全响应头：防 clickjacking / MIME 嗅探 / referrer 泄漏 / 权限滥用。
  // 注：CSP 为「self 基线 + 图片/字体放行 data/blob」，属保守起步值。
  // 开发模式追加 'unsafe-eval'：React dev / Turbopack HMR 需 eval 做调试与热更新，
  // 缺它会出现 "eval() is not supported in this environment" 控制台报错；
  // 生产模式（React 不用 eval）保持严格基线，不放开 unsafe-eval。
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self' 'unsafe-inline'";
    const csp = `default-src 'self'; img-src 'self' data: blob: https://picsum.photos https://imagedelivery.net; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src ${scriptSrc}; connect-src 'self'`;
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: csp,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
