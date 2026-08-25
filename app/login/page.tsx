"use client";

import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CHANGED_EVENT, AUTH_CACHE_KEY } from "@/lib/auth-events";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="text-sm text-muted-foreground">加载中…</div>
        </main>
      }
    >
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const verifyFailed = searchParams.get("verify") === "failed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function sendReset(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) {
      setError("请先填写邮箱");
      return;
    }
    setError(null);
    setResetState("sending");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) setResetState("sent");
    else {
      setResetState("idle");
      setError("发送失败，请重试");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const j = await res.json().catch(() => null);
    if (res.ok) {
      // 缓存用户信息，并广播事件让常驻的 AuthMenu 立即刷新右上角
      try {
        if (j?.user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(j.user));
      } catch {
        /* ignore */
      }
      try {
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      } catch {
        /* ignore */
      }
      setLoading(false);
      setDone(true);
      redirectTimer.current = setTimeout(() => {
        router.push(next?.startsWith("/") ? next : "/builder");
      }, 1200);
      return;
    }
    setLoading(false);
    setError(
      j?.error === "invalid_credentials" ? "邮箱或密码错误" : "登录失败，请重试",
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">登录成功</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            正在进入搭页面…欢迎回来，{email}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-sm"
      >
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <LogIn className="size-5" /> 登录 xiye
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          登录后可保存与加载你的项目。
        </p>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          邮箱
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="you@example.com"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          密码
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="••••••••"
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-transparent">.</span>
          <button
            type="button"
            onClick={sendReset}
            disabled={resetState === "sending"}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {resetState === "sending" ? "发送中…" : "忘记密码？"}
          </button>
        </div>

        {verifyFailed && (
          <p className="mt-3 text-xs text-destructive">
            重置链接已失效，请重新申请。
          </p>
        )}
        {resetState === "sent" && (
          <p className="mt-3 text-xs text-muted-foreground">
            已发送重置邮件，请查收后按邮件指引设置新密码。
          </p>
        )}

        {error && (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        )}

        <Button type="submit" className="mt-5 w-full" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          还没有账号？
          <Link href="/register" className="ml-1 text-primary hover:underline">
            注册
          </Link>
        </p>
      </form>
    </main>
  );
}
