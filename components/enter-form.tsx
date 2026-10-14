"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * 邀请码表单（client）。
 *
 * 页面级「是否 public 模式」的判断放在 app/enter/page.tsx（server component），
 * 这里只负责交互 —— local 模式下本组件根本不会被渲染。
 */
export function EnterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const r = await fetch("/api/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        if (d?.error === "invalid_code") setError("邀请码不正确，请向站长索取");
        else if (d?.error === "access_disabled") setError("站点暂未开放进入");
        else setError(d?.message || "进入失败，请稍后重试");
        return;
      }
      // 整页跳转：让 middleware 放行、服务端读到新 cookie
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <h1 className="text-center text-xl font-semibold text-[var(--card-foreground)]">
          输入邀请码
        </h1>
        <p className="mt-2 text-center text-sm text-[var(--muted-foreground)]">
          本站采用邀请制，请输入站长提供的邀请码进入
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="code"
              className="block text-sm font-medium text-[var(--card-foreground)]"
            >
              邀请码
            </label>
            <input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              autoComplete="off"
              placeholder="例如 XK7M2P"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </div>
          {error ? (
            <p className="text-sm text-[var(--destructive)]" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={submitting || !code.trim()} className="w-full">
            {submitting ? "进入中…" : "进入"}
          </Button>
        </form>
      </div>
    </main>
  );
}
