// 整站品牌站点表（前端与服务端共享的纯声明数据）。
// 服务端 brand-pack.ts 据此打包；前端组件库据此渲染「下载品牌包」下拉。
export interface BrandSiteMeta {
  /** 站点标识（对应组件库 site 值） */
  id: string;
  /** 站点显示名 */
  name: string;
  /** 站点源目录（项目根相对） */
  rootDir: string;
  /** 打包 zip 时顶层文件夹名 */
  rootName: string;
  /** 一句话描述（用于下拉展示） */
  description: string;
}

// 新增整站模板时在此登记，前端下拉与服务端打包会同步出现。
export const BRAND_SITES: BrandSiteMeta[] = [
  {
    id: "Outstand",
    name: "Outstand",
    rootDir: "outstand",
    rootName: "outstand",
    description: "深色高质感 Agency 官网模板（完整 Next.js 项目）",
  },
  {
    id: "Wexo",
    name: "Wexo",
    rootDir: "wexo",
    rootName: "wexo",
    description: "Originkit Framer 整站模板：12 个独立区块（Hero/产品概览/使用方式/用户反馈/定价/独特功能/关于我们/方案对比/团队/博客/评价/CTA），纯 CSS 动效",
  },
  {
    id: "Genius",
    name: "Genius",
    rootDir: "genius",
    rootName: "genius",
    description: "Originkit 整站模板：静态 HTML/CSS 营销站（首页 + 博客/变更日志/联系/隐私/等待列表多页），开箱即用",
  },
];

export function findBrandSite(id: string): BrandSiteMeta | undefined {
  return BRAND_SITES.find((s) => s.id === id);
}