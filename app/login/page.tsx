"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

// AuthMenu 挂载时会先读这个缓存立即渲染用户信息，避免跳转后头像/邮箱迟迟不出现
const AUTH_CACHE_KEY = "xiye-auth-cache";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // 缓存用户信息，让跳转后右上角立即显示头像+邮箱
      try {
        if (j?.user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(j.user));
      } catch {
        /* ignore */
      }
      setLoading(false);
      setDone(true);
      redirectTimer.current = setTimeout(() => {
        router.push("/builder");
        router.refresh();
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
