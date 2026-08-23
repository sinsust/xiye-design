"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, UserRound, LogOut, FolderOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MeUser {
  id: string;
  email: string;
}

export function AuthMenu() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function doLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  if (loading) return <span className="inline-block h-8 w-[64px]" aria-hidden />;

  if (!user) {
    return (
      <Button size="sm" onClick={() => router.push("/login")}>
        <LogIn className="size-3.5" /> 登录
      </Button>
    );
  }

  const initial = (user.email[0] ?? "?").toUpperCase();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-sm transition-colors hover:border-primary"
      >
        <span className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initial}
        </span>
        <span className="max-w-28 truncate text-xs text-foreground">{user.email}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 z-[80] mt-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <UserRound className="size-4 text-muted-foreground" /> 个人中心
          </Link>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-muted"
          >
            <FolderOpen className="size-4 text-muted-foreground" /> 我的项目
          </Link>
          <div className="my-1 h-px bg-border" />
          <button
            type="button"
            onClick={doLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-destructive transition-colors hover:bg-muted"
          >
            <LogOut className="size-4" /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}
