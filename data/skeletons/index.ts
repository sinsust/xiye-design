// 页面骨架工作台 · 数据入口。
// 汇总所有页面数据，提供查询函数。

import type { SkeletonPage } from "./types";
import { HOME_PAGE } from "./home";
import { PRICING_PAGE } from "./pricing";
import { AUTH_PAGE } from "./auth";
import { DASHBOARD_PAGE } from "./dashboard";
import { PORTFOLIO_PAGE } from "./portfolio";
import { BLOG_PAGE } from "./blog";
import { PRODUCT_PAGE } from "./product";
import { ABOUT_PAGE } from "./about";
import { CONTACT_PAGE } from "./contact";
import { MISC_PAGE } from "./misc";
import { DOCS_PAGE } from "./docs";
import { AI_CHAT_PAGE } from "./ai-chat";
import { FEEDBACK_PAGE } from "./feedback";

export type { SkeletonPage, SkeletonComponent, SkeletonVariant } from "./types";

export const SKELETON_PAGES: SkeletonPage[] = [
  HOME_PAGE,
  PRICING_PAGE,
  AUTH_PAGE,
  DASHBOARD_PAGE,
  PORTFOLIO_PAGE,
  BLOG_PAGE,
  PRODUCT_PAGE,
  ABOUT_PAGE,
  CONTACT_PAGE,
  MISC_PAGE,
  DOCS_PAGE,
  AI_CHAT_PAGE,
  FEEDBACK_PAGE,
];

export const SKELETON_PAGE_MAP: Record<string, SkeletonPage> = Object.fromEntries(
  SKELETON_PAGES.map((p) => [p.id, p]),
);

/** 由页面/组件/变体 id 反查变体（找不到返回 null） */
export function findVariant(
  pageId: string,
  componentId: string,
  variantId: string,
) {
  const page = SKELETON_PAGE_MAP[pageId];
  const comp = page?.components.find((c) => c.id === componentId);
  return comp?.variants.find((v) => v.id === variantId) ?? null;
}
