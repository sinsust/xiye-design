/**
 * 表格分析 —— T1-D2 确认流纯逻辑层
 *
 * 把「选择 Sheet 后进入哪个阶段」「角色/推荐如何转成业务文案」等可判定逻辑
 * 从组件里抽出来，便于单元测试（validation-table-confirmation-flow）复用同一套规则，
 * 也避免把复杂状态塞回单一 TableAnalysisPage。
 *
 * 约束（T1-D2）：
 *  - 不调用 LLM、不发网络、不读库；
 *  - 不改动 sheet-recommender 的规则/阈值（只消费其输出做展示与分支判断）；
 *  - 业务语言化：不向 UI 暴露 score / confidence / EffectiveDataset 等工程术语。
 */

import type { SheetRecommendation, SheetRole } from "./types";

/** 角色 → 中文标签（业务语言） */
export const ROLE_LABELS: Record<SheetRole, string> = {
  primary_data: "主数据",
  secondary_data: "辅助数据",
  summary: "汇总",
  notes: "备注",
  unknown: "待判断",
};

/** 角色对应的视觉强调级别（用于卡片配色） */
export type RoleTone = "primary" | "secondary" | "summary" | "notes" | "unknown";

/** 选择某 Sheet 后应进入的阶段：无需确认的可推荐主数据 → profile；其余 → confirm_header。 */
export function nextPhaseAfterSelect(rec: SheetRecommendation | undefined): "profile" | "confirm_header" {
  if (rec && rec.recommended && !rec.requiresHeaderConfirmation) return "profile";
  return "confirm_header";
}

/** 该 Sheet 是否允许被分析（仅 unknown 视为完全不可分析） */
export function isAnalyzable(rec: SheetRecommendation | undefined): boolean {
  return rec ? rec.role !== "unknown" : false;
}

/**
 * 推荐标签（三态）：
 *  - 推荐分析：推荐且无需确认表头
 *  - 可单独分析：推荐但需先确认表头
 *  - 不建议作为主分析表：不被推荐（汇总/备注/无法判断）
 */
export function recommendationTag(rec: SheetRecommendation): string {
  if (!rec.recommended) {
    if (rec.role === "summary") return "不建议作为主分析表（汇总表）";
    if (rec.role === "notes") return "不建议作为主分析表（备注表）";
    return "不建议作为主分析表";
  }
  return rec.requiresHeaderConfirmation ? "可单独分析（需先确认表头）" : "推荐分析";
}

/**
 * 真实字段类型摘要（业务语言），如「日期 ×1 · 金额 ×2 · 分类 ×1 · 编号 ×1」。
 * 仅用统计计数，不暴露原始值。
 */
export function fieldTypeSummary(rec: SheetRecommendation | undefined): string {
  if (!rec) return "—";
  const m = rec.metrics;
  const parts: string[] = [];
  if (m.dateColumnCount > 0) parts.push(`日期 ×${m.dateColumnCount}`);
  if (m.numericColumnCount > 0) parts.push(`数值/金额 ×${m.numericColumnCount}`);
  if (m.categoryColumnCount > 0) parts.push(`分类 ×${m.categoryColumnCount}`);
  if (m.idColumnCount > 0) parts.push(`编号 ×${m.idColumnCount}`);
  if (m.textOnly) parts.push("仅文本");
  return parts.length > 0 ? parts.join(" · ") : "无可见可分析字段";
}

/** 取前 N 条推荐理由（业务语言，已不含单元格原文） */
export function topReasons(rec: SheetRecommendation | undefined, n = 3): string[] {
  if (!rec) return [];
  return rec.reasons.slice(0, n);
}
