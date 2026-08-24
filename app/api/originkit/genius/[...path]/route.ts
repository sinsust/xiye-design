import { createStaticSiteHandler } from "@/lib/static-site-handler";

// 把整站模板 Genius 的静态文件（index.html / 资源 / 子页面）以正确 content-type 流式返回，
// 供组件库「整站模板 · Genius」分类里的 iframe 预览直接嵌入完整页面。
// 数据源与品牌包下载一致：process.cwd()/genius（仓库根，已入库，部署后随应用目录提供）。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createStaticSiteHandler("genius");
