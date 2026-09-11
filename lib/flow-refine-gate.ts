import type { AgentOutput } from "@/lib/store/flow-store";

interface RefineGateInput {
  productBrief?: { vision?: string; pages?: unknown[] } | null;
  visualStyle?: string | null;
  techStack?: string | null;
  panelOutput?: Record<string, AgentOutput> | null;
}

/**
 * 「方案落地」阶段完善度（0-100）。
 *
 * 单一判据源：refine-stage 内部「下一步」按钮与 workflow 页面门禁共用同一个函数，
 * 消除「按钮要求完善度 ≥80% 但页面门禁只查技术栈+视觉风格」的两套规则漂移
 * （步骤条可绕过门禁的 P1 根因）。
 *
 * 计分：产品愿景(60/100，列过页面则满) + 视觉风格(100) + 技术栈(100) + 会诊 guard 产出(100)，取均值。
 */
export function refineOverallProgress(input: RefineGateInput): number {
  const pm = input.productBrief?.vision
    ? (input.productBrief.pages?.length ?? 0) > 0
      ? 100
      : 60
    : 0;
  const designer = input.visualStyle ? 100 : 0;
  const architect = input.techStack ? 100 : 0;
  const guard = input.panelOutput?.guard?.details?.length ? 100 : 0;
  return Math.round((pm + designer + architect + guard) / 4);
}
