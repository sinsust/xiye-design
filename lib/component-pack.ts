// 组件完整包：把组件的源码文件 + 其 public/ 下的素材（图片/字体）一起，保目录结构打成 zip。
// 用于「下载完整包」——多文件组件（如 pricing-01、outstand 区块）复制单个源码文件会丢
// 相对导入与素材，只有整包含素材才能被用户直接搬进自己的开发系统复现。
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { makeZip } from "@/lib/server-zip";
import { SOURCE_FILES } from "@/data/component-library";

function collectDir(absDir: string): { abs: string; rel: string }[] {
  const out: { abs: string; rel: string }[] = [];
  for (const name of readdirSync(absDir)) {
    const abs = join(absDir, name);
    const st = statSync(abs);
    if (st.isDirectory()) out.push(...collectDir(abs));
    else out.push({ abs, rel: name });
  }
  return out;
}

/** 由源码路径推导素材目录（components/originkit/<...>.tsx → public/originkit/<...>），仅保留存在且非空的目录 */
function assetRootsFor(srcPaths: string[]): string[] {
  const cwd = process.cwd();
  const candidates = new Set<string>();
  for (const p of srcPaths) {
    const s = p.replace(/\\/g, "/");
    if (!s.startsWith("components/originkit/")) continue;
    const candidate = "public/" + s.slice("components/".length).replace(/\.[^./]+$/, "");
    const abs = join(cwd, candidate);
    if (existsSync(abs) && statSync(abs).isDirectory() && readdirSync(abs).length > 0) {
      candidates.add(candidate);
    }
  }
  return [...candidates];
}

/**
 * 打包单个组件的完整包，保留仓库相对结构，外层统一以组件 id 命名。
 * @param compId 组件 id（SOURCE_FILES 的 key）
 */
export function packComponent(compId: string): { zip: Buffer; filename: string; fileCount: number } {
  const paths = SOURCE_FILES[compId];
  if (!paths || paths.length === 0) {
    throw new Error(`unknown component id: ${compId}`);
  }
  const cwd = process.cwd();
  const entries: { name: string; content: Buffer | string }[] = [];

  for (const p of paths) {
    const s = p.replace(/\\/g, "/");
    const abs = resolve(cwd, s);
    entries.push({ name: `${compId}/${s}`, content: readFileSync(abs) });
  }

  // 素材目录：把 public/originkit/<slug> 下全部文件按 public/<...> 相对路径纳入，保证不缺图/字体
  for (const root of assetRootsFor(paths)) {
    const abs = join(cwd, root);
    for (const f of collectDir(abs)) {
      entries.push({
        name: `${compId}/${root}/${f.rel}`,
        content: readFileSync(f.abs),
      });
    }
  }

  const zip = makeZip(entries);
  return { zip, filename: `${compId}-package.zip`, fileCount: entries.length };
}