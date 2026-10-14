// node 内置模块的浏览器替身：只在真正被调用时点名报错，不在 import 期做任何事。
//
// 为什么不是「静默返回空」：这些调用都属于只能服务端做的功能（Obsidian 读写本机 vault、
// brand-pack 写临时目录、static-site 读仓库目录、knowledge 扫描本地素材、飞书配置落盘）。
// 返回空值会让界面显示「什么都没有」，把功能缺失伪装成数据缺失；抛错则由 handler 的
// try/catch 变成可读的错误文案，前端再按 isBrowserData 直接把入口藏掉。
//
// 例外：randomUUID 是真正通用的能力（Web Crypto 有），业务主键生成依赖它，必须可用。

const say = (what: string) => (): never => {
  throw new Error(`此功能仅在本地版可用：${what}（浏览器数据层没有 Node 运行时与文件系统）`);
};

// —— node:crypto ——
export const randomUUID = (): string => globalThis.crypto.randomUUID();
export const createHash = say("crypto.createHash");
export const randomBytes = say("crypto.randomBytes（浏览器轨道凭证不加密，见 lib/ima-config.encrypt）");
export const createCipheriv = say("crypto.createCipheriv");
export const createDecipheriv = say("crypto.createDecipheriv");

// —— node:fs ——
export const existsSync = say("fs.existsSync");
export const readFileSync = say("fs.readFileSync");
export const writeFileSync = say("fs.writeFileSync");
export const mkdirSync = say("fs.mkdirSync");
export const statSync = say("fs.statSync");
export const readdirSync = say("fs.readdirSync");
export const rmSync = say("fs.rmSync");
export const cpSync = say("fs.cpSync");
/** fs.promises：任意方法被调用都点名（skill-content 用 promises.readFile） */
export const promises: Record<string, () => never> = new Proxy(
  {},
  {
    get: (_t, key) => say(`fs.promises.${String(key)}`),
  },
);

// —— node:path ——
// path 是纯字符串运算，浏览器里可以真做：部分模块（component-pack 等）在 import 期就调用
// join/resolve 拼常量路径，若这里抛错会导致整个 sw 脚本评估失败（ServiceWorker cannot be started）。
// 语义按 POSIX 子集实现，够本项目这些路径拼接场景使用；涉及真实磁盘访问的调用在 fs 层点名。
const collapse = (p: string): string =>
  p
    .replace(/\/{2,}/g, "/")
    .replace(/\/+$/, (m) => (m.length === p.length ? "/" : ""));

export const join = (...parts: Array<string | undefined>): string =>
  collapse(parts.filter((x): x is string => Boolean(x)).join("/"));

export const normalize = (p: string): string => collapse(String(p));

export const resolve = (...parts: Array<string | undefined>): string => {
  const joined = join(...parts);
  return joined.startsWith("/") ? joined : `/${joined}`;
};

export const extname = (p: string): string => {
  const base = String(p).slice(String(p).lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot) : "";
};

export const dirname = (p: string): string => {
  const s = String(p).replace(/\/+$/, "");
  const i = s.lastIndexOf("/");
  return i <= 0 ? "/" : s.slice(0, i);
};

export const basename = (p: string, ext?: string): string => {
  let b = String(p).replace(/\/+$/, "").slice(String(p).replace(/\/+$/, "").lastIndexOf("/") + 1);
  if (ext && b.endsWith(ext)) b = b.slice(0, -ext.length);
  return b;
};

export const relative = (from: string, to: string): string => String(to).replace(new RegExp(`^${String(from).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?`), "");
export const isAbsolute = (p: string): boolean => String(p).startsWith("/");
export const sep = "/";

// —— node:zlib ——
export const deflateRawSync = say("zlib.deflateRawSync");
export const deflateSync = say("zlib.deflateSync");
export const inflateRawSync = say("zlib.inflateRawSync");
export const gzipSync = say("zlib.gzipSync");

// —— node:os / node:url ——
export const homedir = say("os.homedir");
export const tmpdir = say("os.tmpdir");
export const fileURLToPath = say("url.fileURLToPath");

const named = {
  randomUUID,
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  readdirSync,
  rmSync,
  cpSync,
  promises,
  join,
  resolve,
  normalize,
  extname,
  dirname,
  basename,
  relative,
  isAbsolute,
  sep,
  deflateRawSync,
  deflateSync,
  inflateRawSync,
  gzipSync,
  homedir,
  tmpdir,
  fileURLToPath,
};

export default named;
