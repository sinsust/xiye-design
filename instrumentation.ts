// Next.js server 启动钩子（Next 15+ 稳定特性，根目录 instrumentation.ts 自动注册）。
//
// 背景：Obsidian 双向同步的 watcher 此前只在 API handler（保存配置 / 立即同步）内启动，
// 没有任何进程级启动钩子 —— dev server 每次重启监听即丢失，必须用户手动点一次按钮才恢复。
// 这里在 server 启动时按 user_obsidian_config 中 enabled=1 的配置自动恢复监听 + 轮询兜底。
//
// 本文件必须保持「只判断、只转发」：真正的 node 专属逻辑在 lib/instrumentation-node.ts。
// 原因见该文件头 —— 守卫若写成开头的提前 return，webpack 不会把后续代码当死代码，
// edge 编译就会去解析 better-sqlite3 的 require('fs') 并直接构建失败。
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("@/lib/instrumentation-node");
    await registerNode();
  }
}
