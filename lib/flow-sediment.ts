// P5-A 「做产品 → 第二大脑」结论沉淀数据源。
// 从 flow-store 提取用户已确认的产品结论（产品定位 / 目标用户 / 关键功能决策 /
// 本轮讨论），构建供 organizeToPlan 生成待确认计划的内容与预填项。
//
// 红线：本模块只负责「提取 + 构建文本」，不触碰任何写入逻辑。
// 真实落库必须由用户在我们既有确认链（organizeToPlan → StructPreview → applyProcessingPlan）上确认。

import type { FlowState } from "@/lib/store/flow-store";

export interface FlowSedimentPayload {
  /** 供 AI 整理的原始结构化文本 */
  content: string;
  /** 预填标题（AI 会据此给建议标题） */
  title: string;
  /** 预填分类（在工作台可改） */
  category: string;
  /** 预填标签 */
  tags: string[];
  /** 预填关联项目名（沿用当前流程项目名，确认时可创建/关联） */
  suggestedProjectName: string | null;
}

/** 是否已产出「可沉淀的已确认结论」，决定流程外壳按钮是否可用 */
export function hasFlowConclusions(
  s: Pick<FlowState, "intentNarrative" | "productBrief">,
): boolean {
  const n = s.intentNarrative;
  const b = s.productBrief;
  return Boolean(
    n?.positioning ||
      n?.targetAudience?.length ||
      n?.coreFeatures?.length ||
      b?.vision ||
      b?.positioning ||
      b?.description ||
      b?.targetAudience?.length,
  );
}

function cap(s: string, n: number): string {
  return (s ?? "").trim().slice(0, n);
}

function bullet(items: unknown[] | undefined, render: (x: string, i: number) => string): string {
  if (!Array.isArray(items) || !items.length) return "";
  return items.map((x, i) => render(String(x), i)).join("\n");
}

/** 从 flow-store 构建可沉淀的结论内容与预填项 */
export function buildFlowSedimentPayload(
  s: Pick<
    FlowState,
    | "intentNarrative"
    | "productBrief"
    | "projectInfo"
    | "techStack"
    | "visualStyle"
    | "projectType"
    | "panelOutput"
  >,
): FlowSedimentPayload {
  const n = s.intentNarrative;
  const b = s.productBrief;
  const projectName =
    s.projectInfo?.projectName?.trim() || b?.name?.trim() || n?.vision?.slice(0, 24) || "";

  const lines: string[] = [];
  if (projectName) lines.push(`# ${projectName} —— 产品概念与决策`);

  if (n?.vision?.trim()) {
    lines.push(`## 产品愿景\n${n.vision.trim()}`);
  }
  if (b?.description?.trim()) {
    lines.push(`## 产品描述\n${b.description.trim()}`);
  }
  const positioning =
    (n?.positioning || "").trim() || (b?.positioning || "").trim();
  if (positioning) {
    lines.push(`## 产品定位（差异化）\n${positioning}`);
  }
  const audience = n?.targetAudience?.length ? n.targetAudience : b?.targetAudience;
  if (audience?.length) {
    lines.push(`## 已确认目标用户\n${bullet(audience, (a) => `- ${a}`)}`);
  }
  const features = n?.coreFeatures ?? [];
  if (features.length) {
    lines.push(
      `## 关键功能决策\n${features
        .map((f, i) => (f.why ? `- ${f.name}：${f.why}` : `- ${f.name}`))
        .join("\n")}`,
    );
  }
  if (n?.nonGoals?.length) {
    lines.push(`## 本期非目标\n${bullet(n.nonGoals, (a) => `- ${a}`)}`);
  }
  if (n?.successMetrics?.length) {
    lines.push(`## 成功指标\n${bullet(n.successMetrics, (a) => `- ${a}`)}`);
  }
  if (n?.marketFit?.trim()) {
    lines.push(`## 市场契合\n${n.marketFit.trim()}`);
  }
  // 技术栈 / 视觉风格（ID 即最终选型，直接入文便于检索）
  if (s.techStack) lines.push(`## 技术栈\n- ${s.techStack}`);
  if (s.visualStyle) lines.push(`## 视觉风格\n- ${s.visualStyle}`);
  if (s.projectType) lines.push(`## 项目类型\n- ${s.projectType}`);

  // 本轮讨论摘要：优先完整 PRD 讨论决策，其次多 Agent 会诊子表
  const discussion: string[] = [];
  if (b?.chosenDirections?.length) {
    discussion.push(bullet(b.chosenDirections, (d) => `- ${d}`));
  }
  if (s.panelOutput) {
    const summaries = Object.values(s.panelOutput)
      .filter((o) => o.status === "done" && o.summary?.trim())
      .map((o) => `- ${o.summary.trim()}`);
    if (summaries.length) discussion.push(summaries.join("\n"));
  }
  if (discussion.join("\n").trim()) {
    lines.push(`## 本轮讨论摘要\n${discussion.join("\n")}`);
  }

  const content = lines.join("\n\n").trim();
  return {
    content,
    title: cap(projectName || n?.vision || "产品概念沉淀", 60) || "产品概念沉淀",
    category: "工作",
    tags: ["产品", "流程沉淀"].concat(s.projectType ? [cap(s.projectType, 8)] : []),
    suggestedProjectName: projectName || null,
  };
}