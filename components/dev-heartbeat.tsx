"use client";

import { useEffect } from "react";

// 仅在 dev 构建中出现：app/layout.tsx 用 `process.env.NODE_ENV === "development"` 守卫挂载，
// 该常量在 client 侧是 build-time 替换，生产包不会包含本组件（tree-shake）。
//
// 作用：周期 ping /api/hb。一旦所有标签页都关掉、不再有 ping，dev server 的空闲计时器
// 到时即 process.exit(0)，自动释放端口（见 lib/instrumentation-node.ts）。
export function DevHeartbeat() {
  useEffect(() => {
    const tick = () =>
      fetch("/api/hb", { keepalive: true, cache: "no-store" }).catch(() => {});
    tick();
    const id = setInterval(tick, 20_000);
    // 页面切到后台/隐藏时也补一次 ping（多标签场景，避免误判空闲）
    const onVisibility = () => {
      if (document.visibilityState === "hidden") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(id);
      tick();
    };
  }, []);
  return null;
}
