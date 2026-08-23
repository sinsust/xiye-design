// 设计 token → CSS/Tailwind 的取值逻辑（预览、导出、种子工程共用同一套）。
// 从 project-generator 抽出，避免生成器与种子工程互相导入造成循环依赖。

import type { FlowState } from "@/lib/store/flow-store";
import { FONT_STACK, type VisualStyle } from "@/data/visual-styles";
import { RADIUS_OPTIONS, FONT_OPTIONS, DARK_MODE_OPTIONS } from "@/data/design-presets";
import { TYPE_SCALE_TOKENS, DENSITY_TOKENS, SHADOW_TOKENS, SCROLL_TOKENS } from "@/data/design-tokens";
import { buildAccentList } from "@/lib/style-resolver";

export function buildCssVariables(
  style: VisualStyle,
  ds?: FlowState["designSystem"] | null,
): string {
  const p = style.palette;

  // 设计 Token（覆盖风格默认）：预览与导出共用同一套取值逻辑
  const radiusVar = ds?.radius
    ? RADIUS_OPTIONS.find((r) => r.id === ds.radius)?.value ?? `${style.radius}px`
    : `${style.radius}px`;
  const fontValue = ds?.font
    ? FONT_OPTIONS.find((f) => f.id === ds.font)?.value ?? FONT_STACK[style.font]
    : FONT_STACK[style.font];
  const typeLines = ds?.type
    ? TYPE_SCALE_TOKENS.find((t) => t.id === ds.type)?.css?.trim() ?? ""
    : "";
  const densityLines = ds?.density
    ? DENSITY_TOKENS.find((t) => t.id === ds.density)?.css?.trim() ?? ""
    : "";
  const shadowVar = ds?.shadow
    ? SHADOW_TOKENS.find((t) => t.id === ds.shadow)?.css
        .replace(/^--shadow:\s*/, "")
        .replace(/;\s*$/, "") ?? "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)"
    : "0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06)";

  // 字号/间距 token 生成多行 CSS 变量，缩进对齐嵌入 :root
  const tokenBlock = [typeLines, densityLines]
    .filter(Boolean)
    .join("\n")
    .replace(/^/gm, "  ");

  // 暗色模式：注解进 globals.css（暗色适配策略由应用侧实现）
  const darkModeLabel = ds?.darkMode
    ? DARK_MODE_OPTIONS.find((o) => o.id === ds.darkMode)?.label ?? "跟随系统"
    : "亮色 + 暗色（跟随系统）";

  const accentLines = buildAccentList(p)
    .map((c, i) => `  --accent-${i + 1}: ${c};`)
    .join("\n");

  const body = `  /* 由视觉风格「${style.name}」推导 —— 来源: ${style.sourceSkill} */
  /* 暗色模式：${darkModeLabel} */
  --background: ${p.bg};
  --surface: ${p.surface};
  --border: ${p.border};
  --foreground: ${p.text};
  --muted-foreground: ${p.muted};
  --primary: ${ds?.colorPrimary ?? p.accent};
  --primary-foreground: #ffffff;
  --secondary: ${ds?.colorSecondary ?? p.accent2};
${accentLines}
  --radius: ${radiusVar};
  --shadow: ${shadowVar};
  --font-sans: ${fontValue};
${tokenBlock}`.trimEnd();

  // 滚动是页面级行为（html/section 规则），追加在 :root 之后
  const scrollCss = ds?.scroll
    ? SCROLL_TOKENS.find((t) => t.id === ds.scroll)?.css?.trim() ?? ""
    : "";
  return `:root {\n${body}\n}${scrollCss ? `\n\n${scrollCss}` : ""}`;
}

export function buildTailwindConfig(
  style: VisualStyle,
  ds?: FlowState["designSystem"] | null,
): string {
  const p = style.palette;
  return `import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted-foreground)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        boxShadow: {
          DEFAULT: "var(--shadow)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
        },
      },
      fontFamily: {
        sans: [${FONT_STACK[style.font]
          .split(",")
          .map((f) => `"${f.trim()}"`)
          .join(", ")}],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
} satisfies Config;

/* 调色板参考（视觉风格「${style.name}」）
   注：--primary / --secondary 由 styles/globals.css 以 designSystem.colorPrimary / colorSecondary 覆盖；
   自定义主色后请以 globals.css :root 为唯一真值，本注释块仅作原始风格色参考。
  bg:      ${p.bg}
  surface: ${p.surface}
  border:  ${p.border}
  text:    ${p.text}
  muted:   ${p.muted}
  accent:  ${ds?.colorPrimary ?? p.accent}
  accent2: ${ds?.colorSecondary ?? p.accent2}
*/`;
}
