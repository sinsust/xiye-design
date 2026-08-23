// 架构推导：把「架构知识库」解析成可交付的 ARCHITECTURE.md 文本与结构化视图，
// 供生成端（docs 输出）与骨架工作台（架构面板）共用同一套取值逻辑。

import { ARCHITECTURES, FALLBACK_ARCHITECTURE, type ArchitectureKnowledge } from "@/data/architectures";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";

export function resolveArchitecture(
  stackId: string | null | undefined,
): { kb: ArchitectureKnowledge; usedFallback: boolean } {
  if (stackId && ARCHITECTURES[stackId]) {
    return { kb: ARCHITECTURES[stackId], usedFallback: false };
  }
  return { kb: FALLBACK_ARCHITECTURE, usedFallback: true };
}

export interface PageRef {
  pageSlug: string;
  pageName: string;
  componentNames: string[];
}

/** 骨架蓝图 → 每页及其所含区块名 */
function collectPages(blueprint: { pageSlug: string; componentId: string }[]): PageRef[] {
  const grouped = new Map<string, PageRef>();
  for (const e of blueprint) {
    const page = SKELETON_PAGE_MAP[e.pageSlug];
    if (!page) continue;
    const ref = grouped.get(e.pageSlug) ?? {
      pageSlug: e.pageSlug,
      pageName: page.name,
      componentNames: [],
    };
    const comp = page.components.find((c) => c.id === e.componentId);
    if (comp) ref.componentNames.push(comp.name.replace(/\{\{[^}]*\}\}/g, "").trim());
    grouped.set(e.pageSlug, ref);
  }
  return [...grouped.values()];
}

/** 把页面映射到最贴切的架构层（按层的 keywords 命中打分） */
export function mapPagesToLayers(
  kb: ArchitectureKnowledge,
  blueprint: { pageSlug: string; componentId: string }[],
): { layerId: string; layerName: string; pages: PageRef[] }[] {
  const pages = collectPages(blueprint);
  const noLayers = kb.layers.length === 0;
  const result = kb.layers.map((l) => ({ layerId: l.id, layerName: l.name, pages: [] as PageRef[] }));
  const fallbackIdx = kb.layers.findIndex((l) => l.keywords.some((k) => ["app", "dashboard", "仪表盘"].includes(k)));
  const fallbackLayerId = result[fallbackIdx >= 0 ? fallbackIdx : 0]?.layerId ?? "";

  for (const p of pages) {
    const hay = [p.pageName, ...p.componentNames].join(" ").toLowerCase();
    let best = "";
    let bestScore = 0;
    for (let i = 0; i < kb.layers.length; i++) {
      const l = kb.layers[i];
      const score = l.keywords.reduce((s, kw) => (hay.includes(kw.toLowerCase()) ? s + 1 : s), 0);
      if (score > bestScore) {
        bestScore = score;
        best = l.id;
      }
    }
    if (best) {
      const bucket = result.find((r) => r.layerId === best);
      if (bucket && !bucket.pages.includes(p)) bucket.pages.push(p);
    } else if (fallbackLayerId) {
      const bucket = result.find((r) => r.layerId === fallbackLayerId);
      if (bucket && !bucket.pages.includes(p)) bucket.pages.push(p);
    }
  }
  return result;
}

export interface ArchitectureView {
  pattern: string;
  tree: string;
  layers: { layerId: string; layerName: string; path: string; responsibilities: string[]; pages: PageRef[] }[];
  dataFlow: string[];
  patterns: string[];
  scaling: string[];
  usedFallback: boolean;
}

/** 结构化视图（供骨架工作台「架构面板」渲染） */
export function buildArchitectureView(
  stackId: string | null | undefined,
  blueprint: { pageSlug: string; componentId: string }[],
): ArchitectureView {
  const { kb, usedFallback } = resolveArchitecture(stackId);
  return {
    pattern: kb.pattern,
    tree: kb.tree,
    layers: kb.layers.map((l) => ({
      layerId: l.id,
      layerName: l.name,
      path: l.path,
      responsibilities: l.responsibilities,
      pages: mapPagesToLayers(kb, blueprint).find((m) => m.layerId === l.id)?.pages ?? [],
    })),
    dataFlow: kb.dataFlow,
    patterns: kb.patterns,
    scaling: kb.scaling,
    usedFallback,
  };
}

/** 生成完整的 ARCHITECTURE.md 文本 */
export function buildArchitectureMarkdown(
  stackId: string | null | undefined,
  stackLabel: string,
  projectName: string,
  projectTypeName: string | null,
  featureSummary: string[],
  blueprint: { pageSlug: string; componentId: string }[],
): string {
  const { kb, usedFallback } = resolveArchitecture(stackId);
  const mapped = mapPagesToLayers(kb, blueprint);

  const lines: string[] = [];
  lines.push("# 工程架构说明");
  lines.push("");
  lines.push(`> 由 xiye 流程工作台根据所选技术栈推导的工程架构。`);
  lines.push(`> 技术栈：**${stackLabel || "（未选择，已用通用分层兜底）"}**${usedFallback ? "（该栈暂未沉淀专项架构，先用通用分层，AI 细化可补全）" : ""}`);
  lines.push("");
  lines.push("## 1. 架构模式");
  lines.push("");
  lines.push(kb.pattern);
  lines.push("");
  lines.push("## 2. 目录结构（推荐落地骨架）");
  lines.push("");
  lines.push("```");
  lines.push(kb.tree);
  lines.push("```");
  lines.push("");
  lines.push("## 3. 分层与职责");
  lines.push("");
  if (kb.layers.length) {
    lines.push("| 层 | 挂载路径 | 关键职责 |");
    lines.push("| --- | --- | --- |");
    for (const l of kb.layers) {
      lines.push(`| **${l.name}** | \`${l.path}\` | ${l.responsibilities.join("；")} |`);
    }
  } else {
    lines.push("（无分层条目）");
  }
  lines.push("");
  lines.push("## 4. 数据流（一次典型读写/流式交互）");
  lines.push("");
  kb.dataFlow.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  lines.push("");
  lines.push("## 5. 关键模式与守则");
  lines.push("");
  kb.patterns.forEach((p) => lines.push(`- ${p}`));
  lines.push("");
  lines.push("## 6. 度量与扩展");
  lines.push("");
  kb.scaling.forEach((s) => lines.push(`- ${s}`));
  lines.push("");
  lines.push("## 7. 本蓝图页面 → 架构层映射");
  lines.push("");
  const landed = mapped.filter((m) => m.pages.length);
  if (landed.length) {
    lines.push("| 架构层 | 落点页面与区块 |");
    lines.push("| --- | --- |");
    for (const m of landed) {
      const joined = m.pages
        .map((p) => `${p.pageName}${p.componentNames.length ? `（${p.componentNames.join("/")}）` : ""}`)
        .join("、");
      lines.push(`| ${m.layerName} | ${joined} |`);
    }
  } else {
    lines.push("（尚未把组件加入蓝图，页面落点会在骨架工作台收集后自动补全）");
  }
  lines.push("");
  if (projectName) lines.push(`- 项目：${projectName}`);
  if (projectTypeName) lines.push(`- 项目类型：${projectTypeName}`);
  if (featureSummary.length) lines.push(`- 核心能力：${featureSummary.join("、")}`);
  lines.push("");
  lines.push("> 此架构为知识库确定性推导；可回到骨架工作台用「AI 细化」让大模型按具体项目复核强化。");
  lines.push("");
  return lines.join("\n");
}