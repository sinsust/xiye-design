// 导出前的一致性自检：确保交付给其他 AI / 开发 Agent 的每个引用都真实存在、
// 每个传递下去的 id 都落在可控合法集内，绝不产生「悬空引用」，保证底座可建得出来。

import type { FlowState } from "@/lib/store/flow-store";
import { TECH_STACKS } from "@/data/tech-stacks";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { VISUAL_STYLE_MAP } from "@/data/visual-styles";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { RADIUS_OPTIONS, FONT_OPTIONS, DARK_MODE_OPTIONS } from "@/data/design-presets";
import { TYPE_SCALE_TOKENS, DENSITY_TOKENS, SHADOW_TOKENS, SCROLL_TOKENS } from "@/data/design-tokens";
import { VARIANT_OPTIONS, type VariantDimension } from "@/data/component-variants";
import { MOTION_SCENARIO_MAP, MOTION_VARIANT_MAP } from "@/data/motion-library";

export interface ConsistencyReport {
  ok: boolean;
  issues: string[]; // 硬性悬空引用（应为 0）
  warnings: string[]; // 未选择/兜底提示
}

const DIMENSIONS: VariantDimension[] = ["card", "button", "navbar", "form", "interaction"];

export function validateExport(state: FlowState): ConsistencyReport {
  const issues: string[] = [];
  const warnings: string[] = [];

  // 技术栈
  if (state.techStack && !TECH_STACKS.some((t) => t.id === state.techStack)) {
    issues.push(`技术栈引用悬空：${state.techStack}`);
  } else if (!state.techStack) {
    warnings.push("未选择技术栈，架构/依赖将用通用分层兜底。");
  }

  // 视觉风格
  if (state.visualStyle && !VISUAL_STYLE_MAP[state.visualStyle]) {
    issues.push(`视觉风格引用悬空：${state.visualStyle}`);
  } else if (!state.visualStyle) {
    warnings.push("未选择视觉风格，将回退默认风格。");
  }

  // 设计 Token
  const ds = state.designSystem;
  if (ds) {
    const optionId = (opts: { id: string }[], v: string | null, label: string) => {
      if (v && !opts.some((o) => o.id === v)) issues.push(`设计 Token「${label}」引用悬空：${v}`);
    };
    optionId(RADIUS_OPTIONS, ds.radius, "圆角");
    optionId(FONT_OPTIONS, ds.font, "字体");
    optionId(TYPE_SCALE_TOKENS, ds.type, "字号层级");
    optionId(DENSITY_TOKENS, ds.density, "间距密度");
    optionId(SHADOW_TOKENS, ds.shadow, "阴影");
    optionId(SCROLL_TOKENS, ds.scroll, "滚动行为");
    optionId(DARK_MODE_OPTIONS, ds.darkMode, "暗色模式");
    for (const [k, v] of [["主色", ds.colorPrimary], ["辅色", ds.colorSecondary]] as const) {
      if (v && !/^#[0-9a-f]{3,8}$/i.test(v)) issues.push(`自定义${k}不是合法 hex：${v}`);
    }
    // 覆盖一致性（防回归）：designSystem 优先级高于视觉风格 palette，导出文档以 globals.css 为准
    if (ds.colorPrimary || ds.colorSecondary) {
      warnings.push("已自定义主/辅色：designSystem 覆盖视觉风格 accent；globals.css :root 为唯一真值，DESIGN_SPEC/AGENTS/xiye.config 已同源对齐，AI 开发以 globals.css 为准。");
      if (!state.visualStyle) warnings.push("未指定视觉风格但设了自定义主色，将回退默认风格调色板（自定义主色仍覆盖生效）。");
    }
  }

  // UI 库
  const lib = state.uiLibrary;
  if (lib?.main && !UI_LIBRARIES.some((l) => l.id === lib.main)) issues.push(`UI 主库引用悬空：${lib.main}`);
  if (lib?.addon && !UI_LIBRARIES.some((l) => l.id === lib.addon)) issues.push(`UI 增强库引用悬空：${lib.addon}`);

  // 组件变体
  const cv = state.componentVariants;
  if (cv) {
    for (const dim of DIMENSIONS) {
      const v = cv[dim];
      if (!v) continue;
      if (!VARIANT_OPTIONS.some((o) => o.id === v && o.dimension === dim)) {
        issues.push(`组件变体「${dim}」引用悬空：${v}`);
      }
    }
  }

  // 页面蓝图：页面 / 组件 / 变体逐层校验
  for (const entry of state.pageBlueprint) {
    const page = SKELETON_PAGE_MAP[entry.pageSlug];
    if (!page) {
      issues.push(`蓝图页面不存在：${entry.pageSlug}`);
      continue;
    }
    const comp = page.components.find((c) => c.id === entry.componentId);
    if (!comp) {
      issues.push(`蓝图组件不在「${page.name}」中：${entry.componentId}`);
      continue;
    }
    if (entry.variantId && !comp.variants.some((v) => v.id === entry.variantId)) {
      issues.push(`变体不在「${page.name}/${comp.name}」中：${entry.variantId}`);
    }
  }

  // 动效选择：场景 + 变体
  for (const [scenarioId, variantId] of Object.entries(state.motionSelections)) {
    const scenario = MOTION_SCENARIO_MAP[scenarioId];
    if (!scenario) {
      issues.push(`动效场景不存在：${scenarioId}`);
      continue;
    }
    if (!scenario.variants.some((v) => v.id === variantId) && !MOTION_VARIANT_MAP[variantId]) {
      issues.push(`动效变体不存在：${scenarioId}/${variantId}`);
    }
  }

  return { ok: issues.length === 0, issues, warnings };
}