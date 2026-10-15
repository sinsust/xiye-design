"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Blocks, Brain, Home, LayoutTemplate, Lightbulb } from "lucide-react";

type TabDef = {
  href: string;
  label: string;
  icon: typeof Home;
};

/**
 * 移动端主导航（P2-4 · 对应 PRD §6.1「补齐移动端主导航」）。
 *
 * 背景：此前手机端唯一的导航入口是顶部汉堡抽屉，进入任何页面都要
 * 「先展开抽屉 → 再点目标」两步，且页面内没有任何常驻的当前位置指示，
 * 用户在多步流程里很容易迷失。
 *
 * 这里补一条底部常驻 tab，覆盖首页 + Studio 三个高频页 + Brain 入口，
 * 并对当前路由高亮。仅在 <sm（<640px）显示，桌面端走顶部导航，两者不重叠。
 */
const TABS: TabDef[] = [
  { href: "/", label: "首页", icon: Home },
  { href: "/workflow", label: "做产品", icon: Lightbulb },
  { href: "/builder", label: "搭页面", icon: LayoutTemplate },
  { href: "/components", label: "找组件", icon: Blocks },
  { href: "/brain", label: "记忆", icon: Brain },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch">
        {TABS.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              ].join(" ")}
            >
              <Icon className="size-5" />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
