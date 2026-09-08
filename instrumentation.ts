// Next.js server 启动钩子（Next 15+ 稳定特性，根目录 instrumentation.ts 自动注册）。
//
// 背景：Obsidian 双向同步的 watcher 此前只在 API handler（保存配置 / 立即同步）内启动，
// 没有任何进程级启动钩子 —— dev server 每次重启监听即丢失，必须用户手动点一次按钮才恢复。
// 这里在 server 启动时按 user_obsidian_config 中 enabled=1 的配置自动恢复监听 + 轮询兜底。
//
// 关闭方式：设 OBSIDIAN_AUTOSTART=0（例如线上部署不需要监听本地文件系统）。

export async function register(): Promise<void> {
  // edge runtime 没有 fs / 数据库连接，直接跳过。
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.OBSIDIAN_AUTOSTART === "0") return;

  try {
    const { startObsidianWatch } = await import("@/lib/obsidian-watch");
    const res = await startObsidianWatch();
    if (res.watching > 0) {
      console.log(`[instrumentation] obsidian watch started: ${res.watching} vault(s)`);
    } else {
      // 无启用配置是正常状态（尚未在「第二大脑 → 看板」里配置 vault），不打 error。
      console.log("[instrumentation] obsidian watch: no enabled vault config");
    }
    if (res.error) console.error("[instrumentation] obsidian watch error:", res.error);
  } catch (err) {
    // 启动钩子绝不能阻断 server 启动：DB 不可用 / 表缺失 / 路径无权限都只告警。
    console.error("[instrumentation] obsidian autostart failed (non-fatal):", err);
  }
}
