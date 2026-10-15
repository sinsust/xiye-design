// instrumentation 的 node 专属部分：单独成文件，好让 edge 编译能整块剪掉。
//
// 为什么必须拆开：Next 会按编译目标把 process.env.NEXT_RUNTIME 内联成字面量，
// 只有写在 `if (NEXT_RUNTIME === "nodejs") { await import(...) }` 里的动态 import
// 才会被 webpack 静态剪除。之前守卫写成开头的 `if (... !== "nodejs") return;`，
// return 之后的代码 webpack 不认为是死代码，于是 edge 包仍去解析
// lib/obsidian-watch → lib/db → better-sqlite3 → require('fs') → Module not found。
//
// 关闭方式：设 OBSIDIAN_AUTOSTART=0；public 部署模式默认即关闭（没有本地 vault 可监听），
// 显式 OBSIDIAN_AUTOSTART=1 可强开。

import { accessCodes, hasProfileHmacKey, isPublicDeploy } from "@/lib/deploy-mode";
import { getLastHeartbeat } from "@/lib/dev-heartbeat";

// dev 模式「浏览器关闭自动停机」：前端每 20s ping /api/__hb，此处监测若连续超时无任何
// ping（=所有标签页关掉）则 process.exit(0) 释放端口。生产构建不安装此计时器。
function startDevIdleWatcher(): void {
  const g = globalThis as unknown as Record<string, boolean | undefined>;
  if (g["__xiye_dev_idle_watcher__"]) return; // HMR 防重复
  g["__xiye_dev_idle_watcher__"] = true;

  const timeoutMs = Number(process.env.XIYE_IDLE_KEEPALIVE_MS ?? "180000");
  const timer = setInterval(() => {
    try {
      if (Date.now() - getLastHeartbeat() > timeoutMs) {
        console.log(
          `[dev] 无浏览器访问已超过 ${Math.round(timeoutMs / 1000)}s，自动退出以释放端口`,
        );
        process.exit(0);
      }
    } catch {
      /* ignore */
    }
  }, 30_000);
  timer.unref?.();
}

export async function registerNode(): Promise<void> {
  // public 模式启动自检（fail fast）：缺关键 env 直接让部署失败，
  // 好过上线后所有请求 401/500 或静默降级到不安全状态。
  if (isPublicDeploy()) {
    const missing: string[] = [];
    if (!hasProfileHmacKey()) missing.push("PROFILE_HMAC_KEY（≥32 字符随机串）");
    if ((process.env.IMA_ENC_KEY ?? "").length < 32) missing.push("IMA_ENC_KEY（≥32 字符）");
    if (accessCodes().length === 0) missing.push("ACCESS_CODE（邀请码白名单，逗号分隔多个）");
    if (missing.length > 0) {
      throw new Error(
        `[instrumentation] public 部署模式缺少必需环境变量：${missing.join(" / ")}。配置清单见 docs/vercel-公开版部署.md`,
      );
    }
    if (process.env.OBSIDIAN_AUTOSTART !== "1") {
      console.log(
        "[instrumentation] public 部署模式：跳过 Obsidian watcher（无本地 vault；OBSIDIAN_AUTOSTART=1 可强开）",
      );
      return;
    }
  }

  if (process.env.OBSIDIAN_AUTOSTART === "0") return;

  // dev 模式：浏览器关闭后自动停机（生产不安装，避免误杀线上服务）
  if (process.env.NODE_ENV === "development") {
    startDevIdleWatcher();
  }

  try {
    // 超时保护：register() 是 server 启动的前置 await，一旦 DB 不可达/连接池耗尽，
    // startObsidianWatch 会一直挂着等待连接 —— try/catch 拦不住 hang，整个 server 会
    // 处于「端口在听但所有请求无响应」的状态。这里给 10s 上限，超时先放行启动，
    // watcher 若后续成功仍会自行生效（它内部先 stop 再建，不会重复监听）。
    const res = await Promise.race([
      // import 必须一并纳入超时：@/lib/obsidian-watch 会连带加载 lib/db，
      // 而 lib/db 有 top-level await（建连/建表），DB 不可达时卡在 import 而非函数调用。
      (async () => {
        const { startObsidianWatch } = await import("@/lib/obsidian-watch");
        return startObsidianWatch();
      })(),
      new Promise<{ ok: boolean; error?: string; watching: number }>((resolve) => {
        const t = setTimeout(
          () => resolve({ ok: false, error: "autostart 超时（10s），DB 可能不可达或连接池已满", watching: 0 }),
          10_000,
        );
        t.unref?.();
      }),
    ]);
    if (res.watching > 0) {
      console.log(`[instrumentation] obsidian watch started: ${res.watching} vault(s)`);
    } else {
      // 无启用配置是正常状态（尚未在「第二大脑 → 看板」里配置 vault 路径），不打 error。
      console.log("[instrumentation] obsidian watch: no enabled vault config");
    }
    if (res.error) console.error("[instrumentation] obsidian watch error:", res.error);
  } catch (err) {
    // 启动钩子绝不能阻断 server 启动：DB 不可用 / 表缺失 / 路径无权限都只告警。
    console.error("[instrumentation] obsidian autostart failed (non-fatal):", err);
  }
}
