// 内容替换管线：把变体 code 里的 {{brand}} / {{cta.primary}} 等占位符
// 替换为统一内容值（默认 DEMO_CONTENT，可传入真实内容覆盖 → 一次替换全站文案）。

import { DEMO_CONTENT, type DemoContent } from "@/data/skeleton-content";

export type ContentOverride = Partial<{
  [K in keyof DemoContent]: DemoContent[K] extends object
    ? Partial<DemoContent[K]>
    : DemoContent[K];
}>;

/** 取深层路径值，如 "hero.heading" */
function getPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** 简易深层合并（override 覆盖 demo，对象递归、标量直接覆盖） */
export function deepMerge(base: DemoContent, override?: ContentOverride): DemoContent {
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const key of Object.keys(override) as (keyof DemoContent)[]) {
    const ov = override[key];
    const bv = base[key];
    if (ov == null) continue;
    if (typeof bv === "object" && typeof ov === "object") {
      out[key] = { ...(bv as object), ...(ov as object) };
    } else {
      out[key] = ov;
    }
  }
  return out as unknown as DemoContent;
}

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * 把 code 里的占位符替换为内容值。
 * @param code    含 {{...}} 占位符的代码片段
 * @param content 真实内容（可选）。不传 → 用 DEMO_CONTENT（统一 demo）。
 * @returns       替换后的代码
 */
export function resolveContent(code: string, content?: ContentOverride): string {
  const merged = deepMerge(DEMO_CONTENT, content);
  return code.replace(PLACEHOLDER_RE, (_m, path: string) => {
    const val = getPath(merged, path);
    return val != null ? val : `{{${path}}}`;
  });
}

/** 收集 code 里出现的所有占位符 key（去重），用于蓝图内容映射表 */
export function collectPlaceholders(code: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(code))) set.add(`{{${m[1]}}}`);
  return [...set];
}
