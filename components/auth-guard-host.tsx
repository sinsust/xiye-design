"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CACHE_KEY } from "@/lib/auth-events";

function hasLocalUser(): boolean {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    if (!cached) return false;
    const u = JSON.parse(cached);
    return Boolean(u?.id && u?.email);
  } catch {
    return false;
  }
}

function safePath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

// 只有「写/生成类」受保护接口且非 GET 才拦截；auth 接口自身的 401（如密码错误）不提示
function isGuardedWrite(path: string, method: string): boolean {
  if (!path.startsWith("/api/") || path.startsWith("/api/auth/")) return false;
  if (method.toUpperCase() === "GET") return false;
  const guarded = [
    "/api/ai/",
    "/api/brand/rewrite",
    "/api/knowledge",
    "/api/projects",
    "/api/agents",
    "/api/brain/",
  ];
  return guarded.some((g) => path.includes(g));
}

/**
 * 全局登录门禁：常驻于导航栏。拦截受保护写接口的 401，
 * 未登录用户触发时在顶部弹「需要先登录」提示并引导跳转登录页，
 * 避免静默失败也无从提示。
 */
export function AuthGuardHost() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const showBlock = () =>
      setShow((v) => {
        if (v) return v;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setShow(false), 4500);
        return true;
      });
    const original = window.fetch.bind(window);
    const wrapped: typeof fetch = (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : (input as { url?: string }).url ?? "";
      const method =
        (init?.method ??
          (input instanceof Request ? input.method : "GET")) ||
        "GET";
      const path = safePath(url);
      if (isGuardedWrite(path, method) && !hasLocalUser()) {
        // 未登录：直接拦截该写请求，不发出；弹登录引导（不再静默/不必要发送）
        showBlock();
        return Promise.resolve(new Response(null, { status: 401 }));
      }
      const promise = original(input, init);
      if (isGuardedWrite(path, method)) {
        promise
          .then((res) => {
            // 本地缓存存在但服务端已失效（会话过期/他端登出）时后端兜底
            if (res.status === 401 && !hasLocalUser()) showBlock();
          })
          .catch(() => {
            /* 网络错误不触发 */
          });
      }
      return promise;
    };
    window.fetch = wrapped;

    return () => {
      window.fetch = original;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed left-1/2 top-16 z-[100] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 text-sm shadow-2xl">
      <Lock className="size-4 text-primary" />
      <span className="text-foreground">此操作需要先登录才能继续</span>
      <Button
        size="sm"
        onClick={() =>
          router.push(
            `/login?next=${encodeURIComponent(window.location.pathname)}`,
          )
        }
      >
        <LogIn className="size-3.5" /> 去登录
      </Button>
    </div>
  );
}