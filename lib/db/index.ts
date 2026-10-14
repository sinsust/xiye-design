// node 轨道入口：只负责把「数据层就绪」这一件事变成 import 的副作用。
//
// 为什么拆两层：lib/db/core.ts 不能有顶层 await（浏览器数据层的 sw 打包会被逐层插入 await，
// 而 Service Worker 脚本静态禁止顶层 await），但本地/服务端那 35 个 `import { db }` 的调用方
// 依赖「import 即就绪」。于是把唯一一条顶层 await 放在这一层，
// sw 打包时用 alias 把 @/lib/db 指向 ./core.ts 绕开本文件（见 scripts/build-sw.mjs）。
export * from "./core";

import { dbReady } from "./core";

await dbReady;
