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

  // 主色上的文字色（对比度兜底）：浅主色用深字、深主色用白字
  const primaryColor = ds?.colorPrimary ?? style.palette.accent;
  const onPrimary = (() => {
    const c = hexToRgb(primaryColor);
    if (!c) return "#FFFFFF";
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return lum > 150 ? "#111111" : "#FFFFFF";
  })();

  // 滚动的平滑项可在组件预览上安全体现；整屏吸附/横向属于页面级，保留在导出规则
  const scrollBehavior: "smooth" | undefined =
    ds?.scroll === "scroll-smooth" ? "smooth" : undefined;

  return {
    "--background": style.palette.bg,
    "--surface": style.palette.surface,
    "--border": style.palette.border,
    "--foreground": style.palette.text,
    "--muted-foreground": style.palette.muted,
    "--primary": primaryColor,
    "--secondary": ds?.colorSecondary ?? style.palette.accent2,
    "--on-primary": onPrimary,
    "--success": "#16a34a",
    "--danger": "#dc2626",
    "--warning": "#d97706",
    "--radius": radiusValue,
    "--font-sans": fontValue,
    "--shadow": shadowValue,
    ...buildAccentVars(style.palette),
    ...typeVars,
    ...densityVars,
    fontFamily: "var(--font-sans)",
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

  const surface = hexToRgb(style.palette.surface);
  const border = hexToRgb(style.palette.border);
  const text = hexToRgb(style.palette.text);
  const muted = hexToRgb(style.palette.muted);

  const out: Record<string, string> = {
    "--background": darken(bg, 0.88),
    "--surface": surface ? darken(surface, 0.9) : darken(bg, 0.84),
    "--border": border ? darken(border, 0.55) : "rgba(255,255,255,0.14)",
    "--foreground": text ? lighten(text, 0.92) : "#F5F5F5",
    "--muted-foreground": muted ? lighten(muted, 0.6) : "#A1A1AA",
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
