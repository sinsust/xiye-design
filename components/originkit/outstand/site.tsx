"use client";

import { Globe, Download, ExternalLink } from "lucide-react";

// Outstand 是完整 Next.js 项目源码（多页面路由），没有单一静态 HTML 首页，
// 因此「全部」入口给出演示说明，引导用户下载后本地运行或部署。
export function OutstandSite() {
  return (
    <div className="flex h-[760px] w-full flex-col items-center justify-center gap-6 rounded-[var(--radius)] border border-dashed border-border bg-muted/20 p-8 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Globe className="size-8 text-primary" />
      </div>
      <div className="max-w-md space-y-2">
        <h3 className="text-lg font-semibold text-foreground">Outstand 完整站点预览</h3>
        <p className="text-sm text-muted-foreground">
          Outstand 是完整的 Next.js 项目源码（含首页 / 关于 / 服务 / 作品 / 联系等多页面路由），
          需要下载后在本地运行 <code>npm run dev</code> 或部署到 Vercel 才能查看完整交互。
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm border border-border">
          <Download className="size-3.5" />
          下载品牌包获取完整源码
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-[var(--radius)] bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-sm border border-border">
          <ExternalLink className="size-3.5" />
          部署后即可多页访问
        </span>
      </div>
    </div>
  );
}

export default OutstandSite;
