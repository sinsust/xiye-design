// 打包浏览器数据层的 Service Worker。
//
// 为什么要单独打一个包：99 个 handler 与 drizzle/sqlite 这套数据层原本跑在服务端，
// 线上形态要求「数据只在访问人浏览器里」，所以同一份源码用 esbuild 再打一次，
// 把服务端专属依赖(next/server、next/headers、node 内置、better-sqlite3、postgres、transformers)
// 换成 lib/browser/ 下的替身。Next 自身的构建完全不参与，本地轨道行为不变。
//
// 产物：
// - public/sw.js（ESM Service Worker，由页面按 NEXT_PUBLIC_BROWSER_DB 注册）
// - public/knowledge.json（内置知识库快照，见下方「先导出快照」）
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// —— 先导出内置知识库快照 ——
// knowledge/categories 下的 .md 是「随产品分发的只读内容」，不是用户数据。
// 浏览器轨道没有文件系统，所以打包前用同一份扫描器（lib/knowledge-scan.ts）导成 JSON，
// 让线上也拿到完整内置条目；用户自己新增的条目走浏览器本地库，不在本文件内。
// 这里失败必须让构建报错：静默导出空数组等于把整个知识库悄悄删掉。
const scanTarget = "scripts/.tmp-knowledge-scan.mjs";
try {
  await build({
    entryPoints: ["lib/knowledge-scan.ts"],
    outfile: scanTarget,
    bundle: true,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const mod = await import(pathToFileURL(path.resolve(scanTarget)).href);
  const root = path.join(process.cwd(), "knowledge", "categories");
  const entries = mod.scanKnowledgeRoot(root);
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`扫描结果为空（${root}）`);
  }
  fs.writeFileSync("public/knowledge.json", JSON.stringify(entries));
  console.log(`knowledge.json：${entries.length} 条内置条目`);
} catch (e) {
  console.error("内置知识库快照导出失败:", e && e.message);
  process.exit(1);
} finally {
  fs.rmSync(scanTarget, { force: true });
}

const STUB = "./lib/browser/module-stub.ts";
const NODE_STUB = "./lib/browser/node-stub.ts";
// buffer 不给抛错替身：iconv-lite→safer-buffer 在模块求值期就读 Buffer.prototype，
// 抛错会让整个 sw 脚本评估失败（Service Worker 直接起不来）。见 lib/browser/buffer-shim.ts。
const BUFFER_STUB = "./lib/browser/buffer-shim.ts";

// node 内置模块清单：本项目 handler 图里出现的都换成替身（带 node: 前缀与裸名两种写法）。
const NODE_BUILTINS = [
  "fs",
  "fs/promises",
  "path",
  "os",
  "crypto",
  "url",
  "zlib",
  "stream",
  "stream/promises",
  "buffer",
  "util",
  "events",
  "http",
  "https",
  "net",
  "dns",
  "tls",
  "assert",
  "constants",
  "child_process",
  "worker_threads",
];
const builtinAliases = Object.fromEntries(
  NODE_BUILTINS.flatMap((m) => [[m, NODE_STUB], [`node:${m}`, NODE_STUB]]),
);
// buffer 覆盖上面 NODE_BUILTINS 里的抛错替身
Object.assign(builtinAliases, { buffer: BUFFER_STUB, "node:buffer": BUFFER_STUB });

// SW_DEBUG=1：输出未压缩的 public/sw.debug.js，便于定位「顶层 await 在哪一模块」
const debug = process.env.SW_DEBUG === "1";

const result = await build({
  entryPoints: ["lib/browser/sw-entry.ts"],
  outfile: debug ? "public/sw.debug.js" : "public/sw.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022", // module SW + top-level await
  minify: !debug,
  legalComments: "none",
  define: {
    // lib/db 的第三轨道开关；浏览器包里恒为 browser
    "process.env.DB_MODE": '"browser"',
  },
  alias: {
    "@": ".",
    // 绕开 lib/db/index.ts 那条唯一的顶层 await（sw 脚本静态禁止顶层 await）：
    // 浏览器包里 @/lib/db 直接解析到 core.ts，dbReady 由 sw 在分发前 await。
    "@/lib/db": "./lib/db/core.ts",
    "next/server": "./lib/browser/next-server-shim.ts",
    "next/headers": "./lib/browser/next-headers-stub.ts",
    "better-sqlite3": STUB,
    "drizzle-orm/better-sqlite3": STUB,
    postgres: STUB,
    "@xenova/transformers": STUB,
    ...builtinAliases,
  },
  banner: {
    // 浏览器没有 process：在 globalThis 上兜一个只读 env，让未被 define 的 process.* 访问
    // 得到 undefined（走各模块自己的默认分支），而不是 ReferenceError 直接崩库。
    // 必须是 globalThis.process 而不是 `var process`：后者会让标识符解析到局部变量，
    // esbuild 就不再对 process.env.DB_MODE 做 define 替换，顶层 await 也就无法被折叠剪掉
    //（sw 脚本静态禁止顶层 await，留着它整个 Service Worker 都起不来）。
    js: `globalThis.process=globalThis.process||{env:{},platform:"browser",argv:[],version:"",cwd:function(){return "/"},nextTick:function(fn){Promise.resolve().then(fn)}};`,
  },
});

const bytes = result.outputFiles?.[0]?.text?.length ?? 0;
console.log(JSON.stringify({ warnings: result.warnings.length, errors: result.errors.length, swBytes: bytes }));
