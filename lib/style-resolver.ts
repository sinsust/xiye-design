// 设计 Token 合成选择器：把 flow-store 的 designSystem token
// 解析为 CSS 变量对象，覆盖 VisualStyle 自带的 radius/font。
// 这是「流程」与「工作台」共用的单一事实源，杜绝两套 token 断层。
import type { CSSProperties } from "react";
import { FONT_STACK, type VisualStyle } from "@/data/visual-styles";
import type { DesignSystem } from "@/lib/store/flow-store";
import { RADIUS_OPTIONS, FONT_OPTIONS } from "@/data/design-presets";
import {
  SHADOW_TOKENS,
  TYPE_SCALE_TOKENS,
  DENSITY_TOKENS,
} from "@/data/design-tokens";

/** sRGB 单通道线性化（WCAG 2.x 公式：≤0.03928 走线性段，否则 gamma 2.4） */
function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** 相对亮度 L（0~1，WCAG 2.x） */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const r = srgbToLinear(rgb[0]);
  const g = srgbToLinear(rgb[1]);
  const b = srgbToLinear(rgb[2]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 对比度 (1~21)，越大越清晰；4.5 = AA 正文，3.0 = AA 大字/次级文本 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * 兜底前景色：若 candidate 与 bg 的对比度 < 阈值，按 bg 亮度返回深/浅前景。
 * 亮底用 #0F172A（slate-900），暗底用 #F5F5F5；保证 ≥7:1 的高对比兜底。
 */
function ensureReadable(bg: string, candidate: string, minRatio: number): string {
  if (contrastRatio(bg, candidate) >= minRatio) return candidate;
  const bgLum = relativeLuminance(bg);
  return bgLum > 0.5 ? "#0F172A" : "#F5F5F5";
}

/** 把 token 的 css 片段（如 `--text-h3: 1.5rem;`）解析成 CSS 变量对象 */
export function cssToVars(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) out[m[1]] = m[2].trim();
  return out;
}

// 未设置 token 时的「跟随视觉风格」默认值（保证预览永远有效）
const DEFAULT_TYPE_SCALE: Record<string, string> = {
  "--text-display": "3rem",
  "--text-h1": "2.25rem",
  "--text-h2": "1.875rem",
  "--text-h3": "1.5rem",
  "--text-h4": "1.25rem",
  "--text-body": "1rem",
  "--text-sm": "0.875rem",
  "--text-caption": "0.8125rem",
};
const DEFAULT_DENSITY: Record<string, string> = {
  "--space-1": "4px",
  "--space-2": "8px",
  "--space-3": "12px",
  "--space-4": "16px",
  "--space-6": "24px",
};
const DEFAULT_SHADOW = "0 1px 2px rgba(0,0,0,0.05)";

/**
 * 合成「视觉风格配色 + 设计 token」的完整 CSS 变量集。
 * 预览里所有圆角/字体/字号/间距/阴影都引用这些变量 → 改 token 实时可见。
 */
export function resolveStyleVars(
  style: VisualStyle,
  ds?: DesignSystem | null,
): CSSProperties {
  const fontValue = ds?.font
    ? FONT_OPTIONS.find((f) => f.id === ds.font)?.value ?? FONT_STACK[style.font]
    : FONT_STACK[style.font];

  const radiusValue = ds?.radius
    ? RADIUS_OPTIONS.find((r) => r.id === ds.radius)?.value ?? `${style.radius}px`
    : `${style.radius}px`;

  const typeVars = ds?.type
    ? cssToVars(TYPE_SCALE_TOKENS.find((t) => t.id === ds.type)?.css ?? "") ||
      DEFAULT_TYPE_SCALE
    : DEFAULT_TYPE_SCALE;

  const densityVars = ds?.density
    ? cssToVars(DENSITY_TOKENS.find((t) => t.id === ds.density)?.css ?? "") ||
      DEFAULT_DENSITY
    : DEFAULT_DENSITY;

  const shadowValue = ds?.shadow
    ? SHADOW_TOKENS.find((t) => t.id === ds.shadow)?.css.match(
        /--shadow:\s*([^;]+);/,
      )?.[1] ?? DEFAULT_SHADOW
    : DEFAULT_SHADOW;

  // 设计系统颜色覆盖：builder 组件主题独立调色，不影响 XIYE 系统主题
  const bgColor = ds?.colorBg ?? style.palette.bg;
  const surfaceColor = ds?.colorSurface ?? style.palette.surface;
  const textColor = ds?.colorText ?? style.palette.text;
  const primaryColor = ds?.colorPrimary ?? style.palette.accent;
  const secondaryColor = ds?.colorSecondary ?? style.palette.accent2;
  const accentsColor = ds?.colorAccents ?? style.palette.accents;

  // 主色上的文字色（对比度兜底）：浅主色用深字、深主色用白字
  const onPrimary = (() => {
    const c = hexToRgb(primaryColor);
    if (!c) return "#FFFFFF";
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return lum > 150 ? "#111111" : "#FFFFFF";
  })();

  // 滚动的平滑项可在组件预览上安全体现；整屏吸附/横向属于页面级，保留在导出规则
  const scrollBehavior: "smooth" | undefined =
    ds?.scroll === "scroll-smooth" ? "smooth" : undefined;

  // 毛玻璃风格（blur: true + previewBg）：用渐变光晕底板代替纯色 bg，
  // 让半透明+backdrop-blur 的玻璃面板背有可模糊的层次，玻璃感才显露。
  const background =
    style.blur && style.previewBg ? style.previewBg : style.palette.bg;

  return {
    "--background": style.blur && style.previewBg ? style.previewBg : bgColor,
    "--surface": surfaceColor,
    "--border": style.palette.border,
    "--foreground": ensureReadable(bgColor, textColor, 4.5),
    "--muted-foreground": ensureReadable(bgColor, style.palette.muted, 3.0),
    "--primary": primaryColor,
    "--secondary": secondaryColor,
    "--on-primary": onPrimary,
    "--success": "#16a34a",
    "--danger": "#dc2626",
    "--warning": "#d97706",
    "--radius": radiusValue,
    "--font-sans": fontValue,
    "--font-heading": fontValue,
    "--muted": `color-mix(in srgb, ${textColor} 8%, ${surfaceColor})`,
    "--accent2": secondaryColor,
    "--shadow": shadowValue,
    ...buildAccentVars({ ...style.palette, accent: primaryColor, accent2: secondaryColor, accents: accentsColor }),
    ...typeVars,
    ...densityVars,
    fontFamily: "var(--font-sans)",
    // 显式声明 color：让子元素无 color 字段时（如 nav/hero 的 "text-sm font-bold"）
    // 自动继承"带对比度保护"的 --foreground，避免和某些浅色背景撞色导致看不见。
    color: "var(--foreground)",
    ...(scrollBehavior ? { scrollBehavior } : {}),
  } as CSSProperties;
}

/** 解析 #rrggbb/#rgb → [r,g,b]；解析失败返回 null */
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * 暗色预览主题：把亮色 token 向暗端映射（深底 + 亮字），
 * 让同一组件在「明/暗」两种底板上衬托，方法与 Uiverse 的暗/亮主题一键切换一致。
 * 源风格本身若是暗色（bg 亮度已低），则原样返回，避免二次压黑。
 */
export function resolveStyleVarsDark(
  style: VisualStyle,
  ds?: DesignSystem | null,
): CSSProperties {
  const bg = hexToRgb(style.palette.bg);
  if (!bg) return {};

  const lum = (c: [number, number, number]) =>
    0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  // 源已是暗色（< 130），不动
  if (lum(bg) < 130) return {};

  const darken = (rgb: [number, number, number], unit: number) =>
    rgbToHex(rgb[0] * (1 - unit), rgb[1] * (1 - unit), rgb[2] * (1 - unit));
  const lighten = (rgb: [number, number, number], unit: number) =>
    rgbToHex(rgb[0] + (255 - rgb[0]) * unit, rgb[1] + (255 - rgb[1]) * unit, rgb[2] + (255 - rgb[2]) * unit);

  const darkBg = darken(bg, 0.88);
  const surface = hexToRgb(style.palette.surface);
  const border = hexToRgb(style.palette.border);
  const text = hexToRgb(style.palette.text);
  const muted = hexToRgb(style.palette.muted);

  const foregroundCandidate = text ? lighten(text, 0.92) : "#F5F5F5";
  const mutedCandidate = muted ? lighten(muted, 0.6) : "#A1A1AA";

  const out: Record<string, string> = {
    "--background": darkBg,
    "--surface": surface ? darken(surface, 0.9) : darken(bg, 0.84),
    "--border": border ? darken(border, 0.55) : "rgba(255,255,255,0.14)",
    "--foreground": ensureReadable(darkBg, foregroundCandidate, 4.5),
    "--muted-foreground": ensureReadable(darkBg, mutedCandidate, 3.0),
  };

  // 投影在暗底上不可见，压暗等级即可
  const shadow = ds?.shadow ?? "";
  if (!shadow.includes("inset")) {
    out["--shadow"] = "0 1px 2px rgba(0,0,0,0.4)";
  }
  return out as CSSProperties;
}

/**
 * 由视觉风格调色板推导 6 档扩展强调色（--accent-1..6）。
 * 顺序：accent → accent2 → 风格自声明 accents[] → 不足则用 seed 循环补足，
 * 保证任何风格都拥有完整 6 档，使霓虹 / 多色演示变体可锚定到「风格自身色板」，
 * 而非硬编码颜色，从而受视觉契约约束、不脱离用户所选风格。
 */
export function buildAccentList(palette: VisualStyle["palette"]): string[] {
  const seed = [palette.accent, palette.accent2, ...(palette.accents ?? [])];
  const out: string[] = [];
  for (let i = 0; i < 6; i++) out.push(seed[i % seed.length]);
  return out;
}

/** 把 6 档扩展强调色展开为 CSS 变量对象（供 resolveStyleVars / 生成器注入） */
export function buildAccentVars(
  palette: VisualStyle["palette"],
): Record<string, string> {
  const list = buildAccentList(palette);
  return Object.fromEntries(
    list.map((c, i) => [`--accent-${i + 1}`, c]),
  );
}
