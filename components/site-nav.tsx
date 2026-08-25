"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThemePresetToggle } from "@/components/theme-preset-toggle";
import { AuthMenu } from "@/components/auth-menu";
import { BrandLogo } from "@/components/brand-logo";
import { UiPrefsSync } from "@/components/ui-prefs-sync";
import { AuthGuardHost } from "@/components/auth-guard-host";

const NAV_LINKS = [
  { href: "/workflow", label: "做产品" },
  { href: "/builder", label: "搭页面" },
  { href: "/components", label: "找组件" },
  { href: "/library", label: "存知识" },
  { href: "/brain", label: "第二大脑" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <>
      <UiPrefsSync />
      <AuthGuardHost />
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center px-4">
        <BrandLogo />
        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 sm:flex">
          {NAV_LINKS.map((link) => {
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");
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
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemePresetToggle />
          <ThemeToggle />
          <AuthMenu />
        </div>
      </div>
    </header>
    </>
  );
}
