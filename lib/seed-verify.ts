// 客户端「种子自检」：在生成第 4 步 UI 中，用与 seed/scripts/verify.mjs 相同的检查规则，
// 对内存中的 seed.files 就地运行自检，并返回结构化报告供界面展示。
// 这样用户在下载之前就能看到该 seed 是否达标，提示其交给 AI 后的验收预期。

import { SECRET_RE } from "@/lib/security";

export interface SeedCheckResult {
  id: string;
  label: string; // 检查项名称
  status: "pass" | "warn" | "fail" | "info";
  message: string;
}

export interface SeedVerifyReport {
  ok: boolean;
  passed: number;
  warned: number;
  failed: number;
  checks: SeedCheckResult[];
}

interface SeedFileLike {
  path: string;
  content: string;
}

function fileMap(files: SeedFileLike[]): Map<string, string> {
  return new Map(files.map((f) => [f.path.replace(/\\/g, "/"), f.content]));
}

// 与 verify.mjs 保持一致的「架构目录」判定
const ARCH_DIRS = ["app", "src", "backend", "server", "lib", "internal"];

// 需要存在的顶层约定/清单文件
const REQUIRED_MD = [
  "AGENTS.md",
  "CLAUDE.md",
  "BLUEPRINT.md",
  "DATA_CONTRACT.md",
  "README.md",
];
const REQUIRED_SCRIPTS = ["scripts/verify.mjs"];

export function verifySeed(files: SeedFileLike[]): SeedVerifyReport {
  const paths = files.map((f) => f.path.replace(/\\/g, "/"));
  const byPath = fileMap(files);
  const checks: SeedCheckResult[] = [];
  let passed = 0;
  let warned = 0;
  let failed = 0;

  const push = (c: SeedCheckResult) => {
    checks.push(c);
    if (c.status === "pass") passed++;
    else if (c.status === "warn") warned++;
    else if (c.status === "fail") failed++;
  };

  // 1) 设计 token 一致性
  const globalsEntry =
    [...byPath.entries()].find(([p]) => /globals\.css$/.test(p)) ??
    [...byPath.entries()].find(([p]) => /(index|global)\.css$/.test(p));
  if (globalsEntry) {
    const css = globalsEntry[1];
    const missing = ["--primary", "--background", "--foreground", "--font-sans"].filter(
      (t) => !css.includes(t),
    );
    push({
      id: "tokens",
      label: "设计 token 一致性",
      status: missing.length ? "fail" : "pass",
      message: missing.length
        ? `globals.css 缺少 token：${missing.join("、")}`
        : `globals.css 已声明 primary/background/foreground/font-sans 等核心 token（${globalsEntry[0]}）`,
    });
  } else {
    push({
      id: "tokens",
      label: "设计 token 一致性",
      status: "warn",
      message: "未找到 globals.css，跳过 token 检查",
    });
  }

  // 2) 目录结构（非扁平化）
  const hasArch = ARCH_DIRS.some((d) => paths.some((p) => p.startsWith(d + "/") || p === d));
  push({
    id: "structure",
    label: "目录结构分层",
    status: hasArch ? "pass" : "fail",
    message: hasArch
      ? "已检测到架构目录（app/src/backend/lib 等），符合非扁平化约定"
      : "目录结构疑似扁平化：未发现 app/src/backend/server/lib/internal 等架构目录",
  });

  // 3) 顶层约定与清单文件
  const missingMd = REQUIRED_MD.filter((f) => !byPath.has(f));
  const missingScripts = REQUIRED_SCRIPTS.filter((f) => !byPath.has(f));
  push({
    id: "handoff",
    label: "AI 交接文件齐备",
    status: missingMd.length + missingScripts.length ? "warn" : "pass",
    message:
      missingMd.length + missingScripts.length === 0
        ? "AGENTS/CLAUDE/BLUEPRINT/DATA_CONTRACT 与 verify.mjs 均已生成"
        : `缺失：${[...missingMd, ...missingScripts].join("、")}`,
  });

  // 4) 蓝图组件文件落盘
  const componentFiles = paths.filter((p) => /^components\/.+\.tsx$/.test(p) || /^app\/.+\.tsx$/.test(p));
  const hasBlueprint = byPath.has("BLUEPRINT.md");
  push({
    id: "blueprint",
    label: "蓝图落盘（路由 + 组件）",
    status: componentFiles.length ? "pass" : hasBlueprint ? "info" : "warn",
    message: componentFiles.length
      ? `已生成 ${componentFiles.length} 个路由/组件占位文件（app/、components/）`
      : hasBlueprint
        ? "已生成 BLUEPRINT.md，但尚无组件占位（请先「加入蓝图」）"
        : "未生成 BLUEPRINT.md 与组件占位",
  });

  // 5) TODO / FIXME 占位（占位阶段的正常提示，非失败）
  const TODO_RE = /TO\s*DO|FIX\s*ME/;
  const todoFiles = paths.filter((p) => TODO_RE.test(byPath.get(p) ?? ""));
  if (todoFiles.length) {
    push({
      id: "todo",
      label: "TODO / FIXME 占位",
      status: "warn",
      message: `${todoFiles.length} 个文件仍含占位标记（${todoFiles.slice(0, 4).join("、")}${todoFiles.length > 4 ? " 等" : ""}）—— 属实现前正常状态，AI 完成后应清空`,
    });
  } else {
    push({
      id: "todo",
      label: "TODO / FIXME 占位",
      status: "pass",
      message: "未发现占位标记",
    });
  }

  // 6) 密钥泄漏
  const leaked = paths.filter((p) => !/\.env(\.local)?$/.test(p) && SECRET_RE.test(byPath.get(p) ?? ""));
  push({
    id: "secret",
    label: "密钥 / 凭据泄漏",
    status: leaked.length ? "fail" : "pass",
    message: leaked.length
      ? `检测到疑似密钥：${leaked.slice(0, 4).join("、")}`
      : "未在源码中发现疑似密钥/凭据（仅限服务端 .env 持有）",
  });

  return {
    ok: failed === 0,
    passed,
    warned,
    failed,
    checks,
  };
}