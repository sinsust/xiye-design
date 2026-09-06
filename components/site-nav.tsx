"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemePresetToggle } from "@/components/theme-preset-toggle";
import { AuthMenu } from "@/components/auth-menu";
import { BrandLogo } from "@/components/brand-logo";
import { UiPrefsSync } from "@/components/ui-prefs-sync";
import { AuthGuardHost } from "@/components/auth-guard-host";

type NavItem = { href: string; label: string };
type NavGroup = { id: "studio" | "brain"; label: string; items: NavItem[] };

// M1：xiye 2.0 产品线拆分 —— Studio（AI 产品工作台）与 Brain（个人记忆/知识工作台）
// 同一母品牌下两个清晰模式，不在同一导航心智里混用。
const NAV_GROUPS: NavGroup[] = [
  {
    id: "studio",
    label: "Studio",
    items: [
      { href: "/workflow", label: "做产品" },
      { href: "/builder", label: "搭页面" },
      { href: "/components", label: "找组件" },
      { href: "/library", label: "存知识" },
    ],
  },
  {
    id: "brain",
    label: "Brain",
    items: [{ href: "/brain", label: "第二大脑" }],
  },
];

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function SiteNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <UiPrefsSync />
      <AuthGuardHost />
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 xiye-container items-center px-4">
        <BrandLogo />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-3 sm:flex">
          {NAV_GROUPS.map((group, gi) => (
            <div key={group.id} className="flex items-center gap-2">
              {gi > 0 && <span className="h-5 w-px bg-border" aria-hidden />}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
              {group.items.map((link) => {
                const isActive = isItemActive(pathname, link.href);
                return (
                  <Button
                    key={link.href}
                    render={<Link href={link.href} />}
                    nativeButton={false}
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                  >
                    {link.label}
                  </Button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemePresetToggle />
          <ThemeToggle />
          <AuthMenu />
          {/* 移动端汉堡：<sm 显示，点击展开导航抽屉 */}
          <button
            type="button"
            aria-label="打开菜单"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-foreground sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-background sm:hidden">
          <nav className="xiye-container flex flex-col px-4 py-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((link) => {
                  const isActive = isItemActive(pathname, link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
