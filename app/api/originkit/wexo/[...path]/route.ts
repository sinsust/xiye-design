import { createStaticSiteHandler } from "@/lib/static-site-handler";

// 把整站模板 Wexo 的静态文件（index.html / 资源）以正确 content-type 流式返回，
// 供组件库「整站模板 · Wexo · 全部」iframe 预览直接嵌入完整页面。
// 数据源与品牌包下载一致：process.cwd()/wexo（仓库根，已入库）。

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = createStaticSiteHandler("wexo");
