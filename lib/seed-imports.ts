// 生成期 import 审计 + 兜底打桩（C 项：保证 seed 解压后 `npm run dev` 不因缺失模块崩溃）。
//
// 背景：骨架变体的 `code` 可能 import `@/components/ui/button` 这类 shadcn 风格 UI 原语，
// 而种子工程并未包含这些组件文件。Next dev 在「模块解析失败」时会直接崩溃（区别于类型错误——
// 类型错误不阻断 dev），导致「agent 读文件即开工」在第一步就挂。
//
// 做法：扫描全部 .ts/.tsx 的 import 说明符，
//  - `@/*` 按生成 tsconfig 的 `@/* → ./*` 解析；`~/*` 按 remix 的 `~/* → ./app/*` 解析；
//  - 相对路径按文件目录解析；bare 说明符查 package.json deps。
//  - 命中 `@/components/ui/<name>` 且文件不存在 → 生成最小占位组件（导出正确 PascalCase 名），使模块可解析。
//  - 其余未解析项仅记录到 issues（写入 BUILD_NOTES.md），不臆造代码。

export interface SeedFile {
  path: string;
  content: string;
}

export interface ImportAudit {
  /** 自动生成的兜底占位组件（已可解析缺失模块） */
  stubs: SeedFile[];
  /** 无法自动解析、需人工处理的依赖 */
  issues: string[];
}

function pascal(id: string): string {
  const cleaned = id.replace(/[^A-Za-z0-9]+/g, " ").trim();
  if (!cleaned) return "XBlock";
  return cleaned
    .split(/\s+/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

/** 把说明符解析为相对工程根的路径（不含扩展名） */
function resolveToRoot(spec: string): string | null {
  if (spec.startsWith("@/")) return "./" + spec.slice(2);
  if (spec.startsWith("~/")) return "./app/" + spec.slice(2);
  return null; // 相对 / bare 由调用方处理
}

/** 判断候选路径是否命中已生成文件（含常见扩展名与 index 兜底） */
function exists(pathSet: Set<string>, base: string): boolean {
  const candidates = [
    base,
    base + ".ts",
    base + ".tsx",
    base + ".js",
    base + ".jsx",
    base + "/index.ts",
    base + "/index.tsx",
  ];
  return candidates.some((c) => pathSet.has(c));
}

const IMPORT_RE =
  /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g;

export function auditSeedImports(files: SeedFile[], pkgDeps: Set<string>): ImportAudit {
  const pathSet = new Set(files.map((f) => f.path));
  const knownGlobals = new Set(["react", "react-dom", "next", "react/jsx-runtime"]);
  const stubs: SeedFile[] = [];
  const stubPaths = new Set<string>();
  const issues: string[] = [];

  for (const f of files) {
    if (!/\.(ts|tsx)$/.test(f.path)) continue;
    const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : ".";
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(f.content)) !== null) {
      const spec = m[1] || m[2] || m[3];
      if (!spec) continue;

      if (spec.startsWith(".")) {
        // 相对路径：按当前文件目录解析
        const base = normalizeRel(dir, spec);
        if (!exists(pathSet, base)) {
          issues.push(`未解析相对依赖：${spec}（在 ${f.path}）`);
        }
        continue;
      }

      const rootBased = resolveToRoot(spec);
      if (rootBased) {
        if (exists(pathSet, rootBased)) continue;
        // 未命中：若为 shadcn 风格 UI 原语 → 打桩
        const uiMatch = spec.match(/^@\/components\/ui\/([^/]+)$/);
        if (uiMatch) {
          const name = uiMatch[1];
          const Comp = pascal(name);
          const stubPath = `components/ui/${name}.tsx`;
          if (!stubPaths.has(stubPath)) {
            stubPaths.add(stubPath);
            stubs.push({ path: stubPath, content: uiStub(Comp, name) });
          }
          continue;
        }
        issues.push(`未解析别名依赖：${spec}（在 ${f.path}）`);
        continue;
      }

      // bare 包：查 deps + 已知全局
      const pkgName = spec.split("/")[0];
      if (knownGlobals.has(pkgName) || pkgDeps.has(pkgName)) continue;
      issues.push(`缺失依赖包：${pkgName}（在 ${f.path}，未出现在 package.json）`);
    }
  }

  return { stubs, issues };
}

function normalizeRel(dir: string, spec: string): string {
  const parts = dir.split("/").filter(Boolean);
  for (const seg of spec.split("/")) {
    if (seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "./" + parts.join("/");
}

function uiStub(Comp: string, name: string): string {
  return `// xiye 生成期自动兜底占位（构建就绪）：骨架代码引用了 @/components/ui/${name}，
// 但种子工程未包含该 shadcn 风格组件。此占位仅保证 \`npm run dev\` 不因缺失模块崩溃。
// 投产前请按 docs/DESIGN_SPEC.md 的「组件规范」实现真实版本（含变体/状态/动效）。
import type { ComponentProps } from "react";

export function ${Comp}(props: ComponentProps<"div">) {
  return null;
}

export default ${Comp};
`;
}

/** 生成 BUILD_NOTES.md，列明自动打桩与需人工处理的依赖 */
export function buildNotesMd(audit: ImportAudit): string {
  const lines: string[] = [
    "# BUILD_NOTES.md — 构建就绪说明",
    "",
    "> 由 xiye 生成期 import 审计产出。解压后直接 `npm install && npm run dev` 即可启动；",
    "> 下方列出为保证可运行而自动处理的项，以及需你（或 AI Agent）补完的项。",
    "",
  ];
  if (audit.stubs.length) {
    lines.push("## 已自动兜底（shadcn 风格占位组件）", "");
    lines.push(
      "以下组件已生成最小占位（`components/ui/*`，返回 null），使模块可解析、dev 不崩溃。",
      "请按 `docs/DESIGN_SPEC.md` 实现真实版本：",
      "",
      ...audit.stubs.map((s) => "- `" + s.path + "`"),
      "",
    );
  }
  if (audit.issues.length) {
    lines.push("## 需人工处理（未自动解析）", "");
    lines.push(...audit.issues.map((i) => `- ${i}`), "");
  }
  if (!audit.stubs.length && !audit.issues.length) {
    lines.push("✅ 全部 import 均可解析，无需额外处理。");
  }
  return lines.join("\n");
}
