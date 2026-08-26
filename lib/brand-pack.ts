// 品牌包管理：遍历整站目录打包 zip；生成可 AI 改写的临时副本。
// 所有操作只读原始 outstand/，改写只发生在 os 临时目录副本，保证原目录与组件库预览零影响。
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, cpSync, existsSync, rmSync } from "fs";
import { join, sep, relative, extname, normalize } from "path";
import { tmpdir } from "os";
import { makeZip } from "@/lib/server-zip";
import { BRAND_SITES, type BrandSiteMeta } from "@/data/brand-sites";

export type { BrandSiteMeta } from "@/data/brand-sites";
export { BRAND_SITES, findBrandSite } from "@/data/brand-sites";

const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".turbo"]);

/** 文件级排除：任何 .env*（含 .env / .env.local / .env.example）不进入品牌包，防密钥/凭据外泄 */
function isExcludedFile(name: string): boolean {
  return name === ".env" || name.startsWith(".env.");
}
// 可被 AI 改写文案的文件扩展名
const COPY_EXT = new Set([".tsx", ".ts", ".jsx", ".js"]);

/** 递归收集目录下所有文件路径（排除 node_modules/.next/.git 与 .env*）。返回项目内绝对路径数组。 */
export function collectFilePaths(dir: string, prefix = ""): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  for (const name of readdirSync(dir)) {
    if (isExcludedFile(name)) continue;
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue;
      out.push(...collectFilePaths(abs, prefix ? `${prefix}/${name}` : name));
    } else {
      out.push({ abs, rel: prefix ? `${prefix}/${name}` : name });
    }
  }
  return out;
}

/**
 * 直接把一个目录打包为 zip Buffer。
 * @param siteId 品牌 id，用于从 BRAND_SITES 解析 rootDir/rootName
 */
export function packBrand(siteId: string): { zip: Buffer; filename: string; fileCount: number } {
  const site = BRAND_SITES.find((s) => s.id === siteId) ?? BRAND_SITES[0];
  const root = join(process.cwd(), site.rootDir);
  if (!existsSync(root)) throw new Error("brand dir not found: " + site.rootDir);

  const files = collectFilePaths(root);
  const zip = makeZip(
    files.map((f) => ({
      name: `${site.rootName}/${f.rel}`,
      content: readFileSync(f.abs),
    }))
  );
  return { zip, filename: `${site.rootName}.zip`, fileCount: files.length };
}

// 文案覆盖层可处理的文件类型：源码 + 静态 HTML（文案多落在可读文本里）。
// 资源（图片/字体/样式二进制）绝不纳入，保证结构与保真度 100% 原始。
const COPY_OVERLAY_EXT = new Set([
  ".tsx", ".ts", ".jsx", ".js",
  ".html", ".htm",
  ".vue", ".svelte",
  ".json", ".md", ".mdx",
]);

/**
 * #3 文案覆盖层：在「完整原始整站」之上，按 { 原文案: 新文案 } 精确替换后打包。
 *
 * 设计约束（对应优先级 高保真 > 完整 > 文案可改）：
 *  - copyMap 为空 / 未提供 → 退化为 packBrand（原始完整，#2），非破坏性；
 *  - 仅处理文案类扩展名文件；资源 / 结构原封不动（#1 高保真）；
 *  - 仅做全串精确匹配；某条原文案在文件中不存在则跳过（不报错、不影响其他内容）；
 *  - 值允许空串（等同删除该文案），便于用户清空占位。
 *
 * @param copyMap 形如 { "Original headline": "新文案" }。
 */
export function packBrandWithCopy(
  siteId: string,
  copyMap?: Record<string, string>,
): { zip: Buffer; filename: string; fileCount: number; applied: number } {
  const entries = copyMap
    ? Object.entries(copyMap).filter(([k, v]) => k && typeof v === "string")
    : [];
  if (entries.length === 0) {
    const r = packBrand(siteId);
    return { ...r, applied: 0 };
  }

  const site = BRAND_SITES.find((s) => s.id === siteId) ?? BRAND_SITES[0];
  const tmp = makeTempCopy(siteId);
  try {
    const files = collectFilePaths(tmp.root).filter((f) =>
      COPY_OVERLAY_EXT.has(extname(f.abs).toLowerCase().replace(/\?.*$/, "")),
    );
    let applied = 0;
    for (const f of files) {
      let content = readFileSync(f.abs, "utf8");
      let changed = false;
      for (const [orig, repl] of entries) {
        if (content.includes(orig)) {
          content = content.split(orig).join(repl);
          changed = true;
          applied++;
        }
      }
      if (changed) writeFileSync(f.abs, content, "utf8");
    }
    const all = collectFilePaths(tmp.root);
    const zip = makeZip(
      all.map((f) => ({
        name: `${site.rootName}/${f.rel}`,
        content: readFileSync(f.abs),
      })),
    );
    return { zip, filename: `${site.rootName}.zip`, fileCount: all.length, applied };
  } finally {
    disposeTempCopy(tmp.dir);
  }
}

let tempSeq = 0;

/**
 * 创建品牌目录的可写临时副本，返回副本绝对路径。
 * 调用方负责在结束后调用 disposeTempCopy 清理。
 */
export function makeTempCopy(siteId: string): { dir: string; root: string; site: BrandSiteMeta } {
  const site = BRAND_SITES.find((s) => s.id === siteId) ?? BRAND_SITES[0];
  const srcRoot = join(process.cwd(), site.rootDir);
  const dir = join(tmpdir(), `brand-${site.id}-${site.rootName}-${Date.now()}-${tempSeq++}`);
  // 复制子目录（排除大体积可重建内容）
  const children = readdirSync(srcRoot).filter((n) => !EXCLUDE_DIRS.has(n) && n !== ".gitignore");
  mkdirSync(dir, { recursive: true });
  for (const c of children) {
    const s = join(srcRoot, c);
    const d = join(dir, c);
    if (statSync(s).isDirectory()) cpSync(s, d, { recursive: true });
    else writeFileSync(d, readFileSync(s));
  }
  return { dir, root: dir, site };
}

export function disposeTempCopy(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export function isCopyExt(f: string): boolean {
  return COPY_EXT.has(extname(f).toLowerCase().replace(/\?.*$/, ""));
}

/** 读取临时副本里某个相对文件内容 */
export function readTempFile(root: string, rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

export function writeTempFile(root: string, rel: string, content: string): void {
  const full = join(root, rel);
  mkdirSync(normalize(join(full, "..")), { recursive: true });
  writeFileSync(full, content, "utf8");
}