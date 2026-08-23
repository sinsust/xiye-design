// 从流程状态推导「人话化」的产品定位与特点。
// 当用户未填写 projectInfo.projectDescription 时，依据已选的 项目类型/技术栈/AI能力
// 生成具体、可落地的一句话定位与特性描述——供第 4 步「项目总结」与 AI 初始化提示词复用，
// 避免出现「见 docs/DESIGN_SPEC.md」这类空洞兜底。

import type { FlowState } from "@/lib/store/flow-store";
import { PROJECT_TYPES } from "@/data/project-types";
import { AI_CAPABILITIES } from "@/data/ai-capabilities";
import { TECH_STACKS } from "@/data/tech-stacks";

/** 画出项目类型的中文定位（未选时给通用兜底） */
export function inferProductPositioning(state: FlowState): string {
  const pt = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  if (pt) {
    return `${pt.name}：${pt.positioning}。目标用户——${pt.audience}。`;
  }
  return "通用产品：以核心业务为主流程，突出转化与留存。";
}

/** 一句话定位（更短，适合 headline） */
export function inferProductTagline(state: FlowState): string {
  const pt = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  if (pt) return pt.description;
  return "面向核心场景的 Web 产品，聚焦业务主流程。";
}

/** 项目类型的关键模块，作为「技术到底覆盖什么」的具体证据 */
export function inferKeyModules(state: FlowState): string[] {
  const pt = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  return pt?.keyModules ?? [];
}

/** 特点列表：优先项目类型关键模块，其次所选 AI 能力，最后通用占位 */
export function inferFeatureDetails(state: FlowState): { name: string; desc: string }[] {
  const out: { name: string; desc: string }[] = [];
  const seen = new Set<string>();

  const push = (name: string, desc: string) => {
    if (seen.has(name)) return;
    seen.add(name);
    out.push({ name, desc });
  };

  // 1) 项目类型的关键功能模块——名字本身已足够具体，不附加模板式描述
  const pt = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  for (const m of pt?.keyModules ?? []) push(m, "");

  // 2) 所选 AI 能力（带实现与成本提示，落到工程层）
  for (const id of state.aiCapabilities ?? []) {
    const c = AI_CAPABILITIES.find((x) => x.id === id);
    if (c) push(`${c.name}（AI）`, `${c.description} · 难${c.difficulty} · 约${c.costPer1k}/千次`);
  }

  // 3) 技术栈相关特性
  const stack = state.techStack ? TECH_STACKS.find((t) => t.id === state.techStack) : undefined;
  if (stack) push(`${stack.name} 底座`, `${stack.frontend} / ${stack.backend} / ${stack.database}`);

  if (!out.length) {
    push("核心业务", "围绕所选项目类型搭建的主流程与关键模块");
    push("主题体系", "由视觉风格推导的设计 token 与暗色适配");
  }
  return out.slice(0, 8);
}

/** 定位描述段落：优先用户手填，否则用推断结果 */
export function resolvePositioning(state: FlowState): string {
  if (state.projectInfo?.projectDescription?.trim()) {
    return state.projectInfo.projectDescription.trim();
  }
  return inferProductPositioning(state);
}

/** 类型名（中文） */
export function inferProjectTypeName(state: FlowState): string {
  const pt = state.projectType ? PROJECT_TYPES.find((t) => t.id === state.projectType) : undefined;
  return pt?.name ?? "未指定";
}