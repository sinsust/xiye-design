"use client";

// 浏览器数据层的注册闸门。
//
// 为什么必须「先接管、再渲染」：应用一挂载就会打 /api/* 取数据。若此刻 sw 还没成为
// 该页面的 controller，请求会真打到服务器上 —— 线上没有可写的本地 SQLite，只会得到 500。
// 所以这里等 sw 激活并确认 controller 已生效，才把 children 放出来。
//
// 开关：NEXT_PUBLIC_BROWSER_DB=1（Vercel 项目环境变量；本地默认不设=继续走服务端轨道）。
// 这一层必须用 NEXT_PUBLIC_ 前缀：它要进页面包，而 sw 自己的轨道开关是打包时
// define 的 DB_MODE=browser（见 scripts/build-sw.mjs），两个开关各管一边。

import { useEffect, useState } from "react";

const ENABLED = process.env.NEXT_PUBLIC_BROWSER_DB === "1";
/** 等待 sw 接管的上限：超时后明确报错，不静默渲染（静默渲染=满屏 500） */
const CLAIM_TIMEOUT_MS = 20000;

export function BrowserDataBootstrap({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"off" | "waiting" | "ready" | "failed">(
    ENABLED ? "waiting" : "off",
  );
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!ENABLED) {
      setState("off");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      setReason("这个浏览器不支持 Service Worker，无法把数据保存在本机。");
      setState("failed");
      return;
    }
    let alive = true;
    (async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/", type: "module" });
        await navigator.serviceWorker.ready;
        // claim() 之后 controller 才会指向本 sw；轮询确认，避免早期请求漏到网络
        const deadline = Date.now() + CLAIM_TIMEOUT_MS;
        while (!navigator.serviceWorker.controller) {
          if (Date.now() > deadline) throw new Error("本地数据层启动超时");
          await new Promise((r) => setTimeout(r, 60));
          if (!alive) return;
        }
        if (alive) setState("ready");
      } catch (e) {
        if (!alive) return;
        setReason(e instanceof Error ? e.message : String(e));
        setState("failed");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state === "off" || state === "ready") return <>{children}</>;

  // waiting / failed 都不渲染 children —— 见文件头「先接管、再渲染」
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 text-center">
      <div className="max-w-md space-y-2">
        {state === "waiting" ? (
          <>
            <p className="text-sm font-medium text-foreground">正在准备本机数据…</p>
            <p className="text-xs text-muted-foreground">
              数据只保存在这台设备的浏览器里，首次加载需要初始化本地库。
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-destructive">本机数据层启动失败</p>
            <p className="text-xs text-muted-foreground">{reason}</p>
            <p className="text-xs text-muted-foreground">
              请改用 Chrome 或 Edge 打开；也可在本地运行桌面版（start.bat）。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
