"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, UserRound, LogOut, FolderOpen, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CHANGED_EVENT, AUTH_CACHE_KEY } from "@/lib/auth-events";
import { fetchSession } from "@/lib/auth-session";
import { clearPushSession } from "@/lib/browser-notification";

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

  async function refreshUser() {
    try {
      const cached = localStorage.getItem(AUTH_CACHE_KEY);
      if (cached) {
        const u = JSON.parse(cached);
        if (u?.id && u?.email) setUser(u); // 秒显缓存
      }
    } catch {
      /* ignore */
    }
    // 后台 fetch 校验真实会话；失效则清除缓存回退未登录（全局共享缓存，避免与其它页面重复请求）
    const u = await fetchSession({ force: true });
    setUser(u as MeUser | null);
    try {
      if (u) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(u));
      else localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  useEffect(() => {
    refreshUser();
    // 订阅登录/注册成功广播：SPA 导航下 AuthMenu 常驻不重挂载，
    // 监听事件即时刷新，避免需手动刷新页面才更新
    window.addEventListener(AUTH_CHANGED_EVENT, refreshUser);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, refreshUser);
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
    // 乐观登出：先立即关下拉、清前端态、跳首页，避免等待远程清 cookie 造成“停留”
    const uid = user?.id;
    // 登出时清理该用户的浏览器通知会话去重记录，避免换账号后残留
    if (uid) clearPushSession(uid);
    setUser(null);
    setOpen(false);
    try {
      localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    router.push("/");
    // cookie 清除放后台并行；完成后 refresh 一次，让首页以真实的未登录态渲染
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
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
