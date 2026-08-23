// L2 视觉契约 · 单一事实源 (Single Source of Truth)
// xiye 生成系统中，所有骨架 code 与最终产物必须只引用下列 token，
// 禁止硬编码颜色 / 字号 / 圆角，确保「视觉一致、非天马行空」。
// 推导自：flow-store DesignSystem + visual-styles VisualStyle + style-resolver。

/** 契约规定的全部 CSS 变量（生成项目必须定义这些变量） */
export const CONTRACT_CSS_VARS = [
  "--background",
  "--surface",
  "--border",
  "--foreground",
  "--muted-foreground",
  "--primary",
  "--secondary",
  "--on-primary",
  "--success",
  "--danger",
  "--warning",
  "--radius",
  "--accent-1",
  "--accent-2",
  "--accent-3",
  "--accent-4",
  "--accent-5",
  "--accent-6",
  "--font-sans",
  "--font-heading",
  "--font-mono",
  "--shadow",
  "--text-display",
  "--text-h1",
  "--text-h2",
  "--text-h3",
  "--text-h4",
  "--text-body",
  "--text-sm",
  "--text-caption",
] as const;

export type ContractVar = (typeof CONTRACT_CSS_VARS)[number];

/** 扩展强调色（多色 / 霓虹演示变体锚定的风格自身色板，共 6 档） */
export const CONTRACT_ACCENT_VARS = [
  "--accent-1",
  "--accent-2",
  "--accent-3",
  "--accent-4",
  "--accent-5",
  "--accent-6",
] as const;

/** 原子组件规约：每个组件只消费契约 token，不得引入新颜色 */
export const CONTRACT_ATOMS = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow)",
  },
  buttonPrimary: {
    background: "var(--primary)",
    color: "var(--on-primary)",
    borderRadius: "var(--radius)",
  },
  buttonSecondary: {
    background: "transparent",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    borderRadius: "var(--radius)",
  },
  input: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    color: "var(--foreground)",
    borderRadius: "var(--radius)",
  },
} as const;

/** 允许的样式来源（lint 用）：契约变量 / 带透明度 / 基于契约变量的 color-mix */
export const ALLOWED_COLOR_SOURCES = [
  /var\(--[\w-]+\)/,
  /var\(--[\w-]+\s*\/\s*[\d.]+%?\)/,
  /color-mix\(in srgb,\s*var\(--[\w-]+\)/,
] as const;

/** 禁止的硬编码颜色（lint 用）：任何 #hex 或 rgba/rgb 字面量 */
export const FORBIDDEN_COLOR_PATTERNS = [
  /#[0-9a-fA-F]{3,8}\b/,
  /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/,
] as const;

/** 校验某段样式值是否合规（仅引用契约来源，无硬编码颜色） */
export function isContractCompliant(value: string): boolean {
  if (FORBIDDEN_COLOR_PATTERNS.some((re) => re.test(value))) return false;
  return true;
}
