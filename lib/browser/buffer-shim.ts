// 浏览器轨道的 Buffer：用纯 JS 的 buffer 实现顶替 Node 内置 buffer。
//
// 为什么不是抛错替身：iconv-lite → safer-buffer 在 **模块求值期** 就 require("buffer")
// 并读 Buffer.prototype。给一个抛错的 stub 会让整个 sw 脚本评估失败（ServiceWorker 起不来），
// 而不是只在用到时报错 —— 表格上传那类真需要的功能反而被连坐。
//
// 相对路径导入：esbuild 的 alias 把裸标识符 "buffer" 指向本文件，
// 若这里再写 import "buffer" 就自引用成环，所以直接按文件路径取包。
//
// 类型只声明到这里用到的形状：buffer@5.7.1 的 .d.ts 不含 SlowBuffer/kMaxLength/INSPECT_MAX_BYTES
// （运行时确实有），而本模块的消费者是被 esbuild 打包的 CJS 依赖，不走 TS 检查。
import * as bufferPkgRaw from "../../node_modules/buffer/index.js";

interface BufferPkg {
  Buffer: unknown;
  SlowBuffer?: unknown;
  kMaxLength?: number;
  INSPECT_MAX_BYTES?: number;
  default?: BufferPkg;
}

const raw = bufferPkgRaw as unknown as BufferPkg;
const pkg = raw.default ?? raw;

// 全局兜底：不少依赖（xlsx / exceljs / 部分 polyfill 分支）直接读裸 Buffer
const g = globalThis as { Buffer?: unknown };
if (!g.Buffer) g.Buffer = pkg.Buffer;

export const Buffer = pkg.Buffer;
export const SlowBuffer = pkg.SlowBuffer;
export const kMaxLength = pkg.kMaxLength;
export const INSPECT_MAX_BYTES = pkg.INSPECT_MAX_BYTES;

export default pkg;
