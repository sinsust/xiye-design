"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CHANGED_EVENT, AUTH_CACHE_KEY } from "@/lib/auth-events";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("密码至少 8 位");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const j = await res.json().catch(() => null);
    setLoading(false);
    if (res.ok) {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        const md = me.ok ? await me.json() : null;
        if (md?.user) localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(md.user));
      } catch {
        /* ignore */
      }
      try {
        window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      } catch {
        /* ignore */
      }
      setDone(true);
      timerRef.current = setTimeout(() => router.push("/login"), 1400);
      return;
    }
    setError(j?.error === "not_authenticated" ? "链接已失效，请重新申请重置" : "设置失败，请重试");
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <CheckCircle2 className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-lg font-semibold text-foreground">密码已更新</h1>
          <p className="mt-1 text-sm text-muted-foreground">正在跳转登录…</p>
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
          <KeyRound className="size-5" /> 设置新密码
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          为你的账号设置一个新的登录密码。
        </p>

        <label className="mt-5 block text-xs font-medium text-muted-foreground">
          新密码（至少 8 位）
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="••••••••"
        />

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

        <Button type="submit" className="mt-5 w-full" disabled={loading}>
          {loading ? "提交中…" : "确认设置"}
        </Button>
      </form>
    </main>
  );
}