// A5 · checkpoint 真实 diff（审计 F-6；PRD §9.2「明确 diff」）。
// 纯函数：比较两个检查点快照（captureSnapshot 的 {version,flow,skeleton} JSON 字符串），
// 输出「新增 / 删除 / 修改」三类逐页逐字段变更，供 builder-checkpoints 渲染差异视图。
// 无副作用、不依赖 React/store，可单独单测。

export interface DiffItem {
  kind: "added" | "removed" | "modified";
  page: string; // 页面标识（pageSlug）；全局配置用保留字「全局配置」
  fields: string[]; // 修改项涉及的字段名（新增/删除为空）
}

export interface CheckpointDiff {
  summary: { added: number; removed: number; modified: number };
  items: DiffItem[];
}

/** 全局配置聚合页（flow 顶层 + skeleton 顶层的展示名） */
export const GLOBAL_PAGE = "全局配置";

interface Snap {
  flow?: Record<string, unknown>;
  skeleton?: Record<string, unknown>;
}

/** 值浅比较：不同结构先序列化再比（Object.is 兜底 NaN 等）。 */
function valEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return false;
}

/** 容错解析快照；损坏返回 null（调用方展示「数据不可比」）。 */
function parse(data: string): Snap | null {
  try {
    const s = JSON.parse(data) as Snap;
    if (!s || typeof s !== "object") return null;
    return s;
  } catch {
    return null;
  }
}

/** 按 pageSlug 分组的页面组件条目：{ [pageSlug]: entry[] } */
function pageMap(snap: Snap): Map<string, Array<Record<string, unknown>>> {
  const flow = snap.flow ?? {};
  const bp = Array.isArray(flow.pageBlueprint) ? (flow.pageBlueprint as Array<Record<string, unknown>>) : [];
  const m = new Map<string, Array<Record<string, unknown>>>();
  for (const entry of bp) {
    const slug = typeof entry.pageSlug === "string" && entry.pageSlug ? entry.pageSlug : "(未命名)";
    const arr = m.get(slug) ?? [];
    arr.push(entry);
    m.set(slug, arr);
  }
  return m;
}

export function diffCheckpoints(aData: string, bData: string): CheckpointDiff {
  const a = parse(aData);
  const b = parse(bData);
  if (!a || !b) return { summary: { added: 0, removed: 0, modified: 0 }, items: [] };

  const items: DiffItem[] = [];
  const aPages = pageMap(a);
  const bPages = pageMap(b);

  // 1) 页面级新增 / 删除
  for (const slug of aPages.keys()) if (!bPages.has(slug)) items.push({ kind: "removed", page: slug, fields: [] });
  for (const slug of bPages.keys()) if (!aPages.has(slug)) items.push({ kind: "added", page: slug, fields: [] });

  // 2) 页面级修改：同页按组件条目（componentId）逐字段对比
  for (const [slug, bEntries] of bPages) {
    const aEntries = aPages.get(slug);
    if (!aEntries) continue;
    const aComp = new Map(aEntries.map((e) => [String(e.componentId ?? ""), e]));
    const bComp = new Map(bEntries.map((e) => [String(e.componentId ?? ""), e]));
    const fields = new Set<string>();
    for (const [cid, be] of bComp) {
      const ae = aComp.get(cid);
      if (!ae) {
        fields.add(`组件 ${cid}`);
        continue;
      }
      for (const key of new Set([...Object.keys(ae), ...Object.keys(be)])) {
        if (!valEq(ae[key], be[key])) fields.add(key);
      }
    }
    for (const cid of aComp.keys()) if (!bComp.has(cid)) fields.add(`组件 ${cid}`);
    if (fields.size > 0) items.push({ kind: "modified", page: slug, fields: [...fields] });
  }

  // 3) 全局配置 diff：flow 顶层（除 pageBlueprint）+ skeleton 顶层键
  const flowKeys = new Set([...Object.keys(a.flow ?? {}), ...Object.keys(b.flow ?? {})]);
  const gFields: string[] = [];
  for (const k of flowKeys) {
    if (k === "pageBlueprint") continue;
    if (!valEq(a.flow?.[k], b.flow?.[k])) gFields.push(k);
  }
  const skKeys = new Set([...Object.keys(a.skeleton ?? {}), ...Object.keys(b.skeleton ?? {})]);
  for (const k of skKeys) {
    if (!valEq(a.skeleton?.[k], b.skeleton?.[k])) gFields.push(`骨架·${k}`);
  }
  if (gFields.length > 0) items.push({ kind: "modified", page: GLOBAL_PAGE, fields: gFields });

  return {
    summary: {
      added: items.filter((i) => i.kind === "added").length,
      removed: items.filter((i) => i.kind === "removed").length,
      modified: items.filter((i) => i.kind === "modified").length,
    },
    items,
  };
}

/** flow/skeleton 顶层字段 → 中文标签（UI 展示用）。 */
export const FIELD_LABELS: Record<string, string> = {
  currentStep: "流程步骤",
  projectType: "产品类型",
  aiCapabilities: "AI 能力",
  techStack: "技术栈",
  designSystem: "设计体系",
  uiLibrary: "组件库",
  componentVariants: "组件变体",
  projectInfo: "项目信息",
  apiKeys: "API 密钥",
  visualStyle: "视觉风格",
  motionSelections: "动效选择",
  builderReturnStep: "返回步骤",
  intentNarrative: "产品叙事",
  conceptBrief: "概念简报",
  blueprint: "蓝图",
  "骨架·picks": "骨架·组件挑选",
  "骨架·schemes": "骨架·配色方案",
  "骨架·content": "骨架·页面内容",
  "骨架·elementInteractions": "骨架·交互",
  "骨架·componentMotion": "骨架·动效",
  "骨架·componentOverride": "骨架·组件覆写",
  "骨架·buttonStyles": "骨架·按钮样式",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}
