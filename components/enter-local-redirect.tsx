"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * local / 桌面模式下 /enter 不适用：用客户端重定向回首页。
 * 不能用 server 端 redirect() —— 那样会把页面锁成动态渲染，违反 Hobby 函数数削减目标。
 * 见 app/enter/page.tsx 与 docs/vercel-公开版部署.md §5.1.3 措施 E。
 */
export function EnterLocalRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
