// 部署模式：local（默认，桌面单机）| public（Vercel 公开多用户）。
//
// 背景：本项目原本按「形态 C 桌面单机」设计 —— 档案 id 直接放 cookie、无鉴权
// （本机单人、cookie 不可伪造）。部署到 Vercel 变成公开服务后这个假设失效：
// 任何人手写 cookie 即可冒充任意档案、读写他人全部数据。public 模式引入
// 「服务端 HMAC 签名 cookie」堵住越权（见 lib/profile-signature.ts + middleware.ts）。
//
// ⚠️ 本文件零依赖（无 node:*、无 db），可被客户端组件安全 import。
//    服务端两个 env 都认；客户端 bundle 只会内联 NEXT_PUBLIC_ 前缀的那个，
//    因此公开部署请同时设置 DEPLOY_MODE 与 NEXT_PUBLIC_DEPLOY_MODE（或只设后者）。

export type DeployMode = "local" | "public";

/** 当前部署模式；未设置按 local（桌面/本地开发行为零变化） */
export function deployMode(): DeployMode {
  const raw = (
    process.env.DEPLOY_MODE ??
    process.env.NEXT_PUBLIC_DEPLOY_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  return raw === "public" ? "public" : "local";
}

/** 是否公开多用户部署（Vercel 线上） */
export function isPublicDeploy(): boolean {
  return deployMode() === "public";
}

/**
 * 浏览器数据层是否启用（NEXT_PUBLIC_BROWSER_DB=1）：
 * /api 由 sw 在访问人本机处理，数据存在其浏览器 IndexedDB 里的 SQLite 文件。
 *
 * 与 DEPLOY_MODE=public 是两个正交的轴，别混：
 * - public 决定「身份要不要服务端签名 cookie + 邀请码门户」；
 * - 本开关决定「数据存在哪、谁来处理请求」。
 * 线上走浏览器数据层时可以不设 public —— 隔离是物理的（各人的浏览器库互相看不到），
 * 不需要邀请码也能做到「每个人只有自己那一份」。
 */
export function isBrowserDataMode(): boolean {
  return (process.env.NEXT_PUBLIC_BROWSER_DB ?? "").trim() === "1";
}

/**
 * 「只有本机才做得到的事」是否可用：读写本机文件系统（Obsidian vault、品牌包 zip、
 * 组件源码目录、知识库 .md 扫描）依赖运行本应用的那台机器。
 * 一旦进入任一线上形态，这些能力对访问人就不存在 —— 界面要直接不渲染，
 * 而不是留个按钮让人点了才知道。
 */
export function hasLocalMachine(): boolean {
  return !isPublicDeploy() && !isBrowserDataMode();
}

/** 邀请码白名单（ACCESS_CODE，逗号分隔多个）；未配置 = 不允许任何人进入 */
export function accessCodes(): string[] {
  return (process.env.ACCESS_CODE ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** public 模式是否配置了签名密钥（缺失时启动/请求层给出明确错误，不静默降级） */
export function hasProfileHmacKey(): boolean {
  return (process.env.PROFILE_HMAC_KEY ?? "").length >= 32;
}
