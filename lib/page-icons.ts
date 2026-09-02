// 页面图标映射 · 共享单一来源。
// 此前 builder（按 SkeletonPage.icon 名查）与 build-stage（按 page.id 查）各自维护一份，
// 现统一收口到此文件，避免两处重复定义、图标选择漂移。

import {
  Home,
  Tags,
  UserRound,
  LayoutDashboard,
  Palette,
  Newspaper,
  ShoppingBag,
  Building2,
  ShieldAlert,
  BookOpenText,
  Bot,
  Loader2,
  LogIn,
  Images,
  Info,
  Mail,
  LayoutGrid,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";

/** 按 SkeletonPage.icon（lucide 图标名）查组件：builder 侧页面图标。 */
export const PAGE_ICONS: Record<string, LucideIcon> = {
  Home,
  Tags,
  UserRound,
  LayoutDashboard,
  Palette,
  Newspaper,
  ShoppingBag,
  Building2,
  ShieldAlert,
  BookOpenText,
  Bot,
  Loader2,
};

/** 按 SkeletonPage.id 查组件：build-stage 侧页面图标（沿用其既有图标选择）。 */
export const PAGE_ICON_BY_ID: Record<string, LucideIcon> = {
  home: Home,
  pricing: Tags,
  auth: LogIn,
  dashboard: LayoutDashboard,
  portfolio: Images,
  blog: Newspaper,
  product: ShoppingBag,
  about: Info,
  contact: Mail,
  misc: LayoutGrid,
  docs: BookOpenText,
  "ai-chat": Bot,
  feedback: MessageSquare,
};
