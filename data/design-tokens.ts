// 设计 Token 预设（类B「组件与交互」的数据层）。
// 圆角/字体/间距密度 复用 design-presets；阴影/滚动为新增。
// 每项携带：可直接复制的 CSS 片段 + 给 AI 的提示词 + 预览描述。

import {
  RADIUS_OPTIONS,
  FONT_OPTIONS,
  DENSITY_OPTIONS,
} from "@/data/design-presets";

export interface TokenPreset {
  id: string;
  name: string;
  description: string;
  css: string; // 可复制 CSS 片段
  prompt: string; // 可复制提示词
  preview?: string; // 预览用的关键值/类
}

// ═══ 圆角 ═══
export const RADIUS_TOKENS: TokenPreset[] = RADIUS_OPTIONS.map((r) => ({
  id: r.id,
  name: r.label,
  description: `圆角 ${r.value}`,
  css: `--radius: ${r.value};`,
  prompt: `Use a ${r.label} corner radius (${r.value}) for all surfaces, buttons, and inputs.`,
  preview: r.value,
}));

// ═══ 字体 ═══
export const FONT_TOKENS: TokenPreset[] = FONT_OPTIONS.map((f) => ({
  id: f.id,
  name: f.label,
  description: `字体族 ${f.value}`,
  css: `--font-sans: ${f.value};`,
  prompt: `Set the primary typeface to ${f.label} (${f.value}).`,
  preview: f.value,
}));

// ═══ 间距密度 ═══
export const DENSITY_TOKENS: TokenPreset[] = DENSITY_OPTIONS.map((d) => ({
  id: d.id,
  name: d.label,
  description: d.desc,
  css:
    d.id === "ultra_compact"
      ? `--space-1:2px; --space-2:4px; --space-3:8px; --space-4:12px; --space-6:20px;`
      : d.id === "compact"
        ? `--space-1:4px; --space-2:8px; --space-3:12px; --space-4:16px; --space-6:24px;`
        : d.id === "spacious"
          ? `--space-1:6px; --space-2:12px; --space-3:20px; --space-4:32px; --space-6:48px;`
          : d.id === "relaxed"
            ? `--space-1:8px; --space-2:16px; --space-3:24px; --space-4:40px; --space-6:64px;`
            : `--space-1:4px; --space-2:8px; --space-3:16px; --space-4:24px; --space-6:32px;`,
  prompt: `Apply ${d.label} spacing: ${d.desc}`,
  preview: d.id,
}));

// ═══ 阴影层级（新增）═══
export const SHADOW_TOKENS: TokenPreset[] = [
  {
    id: "shadow-none",
    name: "无阴影",
    description: "完全扁平，靠描边与背景区分",
    css: `--shadow: none;`,
    prompt: "Use no shadows; separate surfaces with borders and background contrast only.",
  },
  {
    id: "shadow-soft",
    name: "柔和微影",
    description: "极淡双层阴影，克制现代",
    css: `--shadow: 0 1px 2px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.06);`,
    prompt: "Apply a soft, barely-there shadow (0 1px 3px rgba(0,0,0,0.06)) for subtle elevation.",
  },
  {
    id: "shadow-medium",
    name: "中等投影",
    description: "清晰悬浮感，卡片常用",
    css: `--shadow: 0 4px 12px rgba(0,0,0,0.08);`,
    prompt: "Apply a medium drop shadow (0 4px 12px rgba(0,0,0,0.08)) to floating cards.",
  },
  {
    id: "shadow-large",
    name: "大弥散阴影",
    description: "强层次，模态/弹层",
    css: `--shadow: 0 12px 32px rgba(0,0,0,0.12);`,
    prompt: "Apply a large diffuse shadow (0 12px 32px rgba(0,0,0,0.12)) for modals and popovers.",
  },
  {
    id: "shadow-colored",
    name: "品牌色投影",
    description: "用主色做晕染投影",
    css: `--shadow: 0 8px 24px color-mix(in srgb, var(--primary) 25%, transparent);`,
    prompt: "Tint shadows with the primary brand color for a cohesive colored glow.",
  },
];

// ═══ 滚动行为（新增）═══
export const SCROLL_TOKENS: TokenPreset[] = [
  {
    id: "scroll-normal",
    name: "默认滚动",
    description: "原生滚动，无特殊行为",
    css: `html { scroll-behavior: auto; }\n* { overflow-y: auto; }`,
    prompt: "Use native default scrolling with no special behavior.",
  },
  {
    id: "scroll-smooth",
    name: "平滑滚动",
    description: "锚点跳转带平滑过渡",
    css: `html { scroll-behavior: smooth; }`,
    prompt: "Enable smooth scrolling (scroll-behavior: smooth) for anchor navigation.",
  },
  {
    id: "scroll-snap",
    name: "整屏吸附",
    description: "垂直整屏滚动吸附",
    css: `section { scroll-snap-type: y mandatory; }\n.panel { scroll-snap-align: start; }`,
    prompt: "Use vertical scroll-snap (scroll-snap-type: y mandatory) for full-screen panels.",
  },
  {
    id: "scroll-horizontal",
    name: "横向滚动",
    description: "横向卡片带吸附",
    css: `.track { overflow-x: auto; scroll-snap-type: x mandatory; }\n.card { scroll-snap-align: start; }`,
    prompt: "Implement a horizontal scroll track with x-axis scroll-snap for card rows.",
  },
  {
    id: "scroll-momentum",
    name: "惯性滚动",
    description: "移动端惯性 + 边界回弹",
    css: `* { -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }`,
    prompt: "Enable momentum scrolling and contain overscroll on touch devices.",
  },
];

// ═══ 字号层级（Type Scale，商业规范必需）═══
export const TYPE_SCALE_TOKENS: TokenPreset[] = [
  {
    id: "type-system",
    name: "系统字号（推荐）",
    description: "1.25 比例：display 48 / h1 36 / h2 30 / h3 24 / h4 20 / body 16 / caption 13",
    css: `--text-display: 3rem;   /* 48px */
--text-h1: 2.25rem;    /* 36px */
--text-h2: 1.875rem;   /* 30px */
--text-h3: 1.5rem;     /* 24px */
--text-h4: 1.25rem;    /* 20px */
--text-body: 1rem;     /* 16px */
--text-sm: 0.875rem;   /* 14px */
--text-caption: 0.8125rem; /* 13px */`,
    prompt: "Use a 1.25 modular type scale: display 48px, h1 36px, h2 30px, h3 24px, h4 20px, body 16px, caption 13px.",
    preview: "1.25×",
  },
  {
    id: "type-compact",
    name: "紧凑字号",
    description: "1.2 比例，信息密度高：h1 32 / body 15 / caption 12",
    css: `--text-display: 2.5rem;  /* 40px */
--text-h1: 2rem;       /* 32px */
--text-h2: 1.625rem;   /* 26px */
--text-h3: 1.375rem;   /* 22px */
--text-h4: 1.125rem;   /* 18px */
--text-body: 0.9375rem; /* 15px */
--text-sm: 0.8125rem;  /* 13px */
--text-caption: 0.75rem; /* 12px */`,
    prompt: "Use a compact 1.2 modular type scale for data-dense interfaces.",
    preview: "1.2×",
  },
  {
    id: "type-editorial",
    name: "编辑字号",
    description: "1.35 比例，阅读优先：display 56 / h1 40 / body 17",
    css: `--text-display: 3.5rem;  /* 56px */
--text-h1: 2.5rem;     /* 40px */
--text-h2: 2rem;       /* 32px */
--text-h3: 1.625rem;   /* 26px */
--text-h4: 1.25rem;    /* 20px */
--text-body: 1.0625rem; /* 17px */
--text-sm: 0.9375rem;  /* 15px */
--text-caption: 0.8125rem; /* 13px */`,
    prompt: "Use an editorial 1.35 modular type scale optimized for long-form reading.",
    preview: "1.35×",
  },
  {
    id: "type-display",
    name: "大字展示",
    description: "首屏高冲击：display 64 / h1 44 / body 15，适合营销 hero",
    css: `--text-display: 4rem;    /* 64px */
--text-h1: 2.75rem;    /* 44px */
--text-h2: 2.125rem;   /* 34px */
--text-h3: 1.625rem;   /* 26px */
--text-h4: 1.25rem;    /* 20px */
--text-body: 0.9375rem; /* 15px */
--text-sm: 0.875rem;   /* 14px */
--text-caption: 0.8125rem; /* 13px */`,
    prompt: "Use a large display-first type scale (display 64px, h1 44px) for high-impact marketing heroes.",
    preview: "展示",
  },
  {
    id: "type-data",
    name: "数据字号",
    description: "高密度表格优先：h1 28 / body 14 / caption 12，dashboard 常用",
    css: `--text-display: 2.25rem; /* 36px */
--text-h1: 1.75rem;    /* 28px */
--text-h2: 1.375rem;   /* 22px */
--text-h3: 1.125rem;   /* 18px */
--text-h4: 1rem;       /* 16px */
--text-body: 0.875rem; /* 14px */
--text-sm: 0.8125rem;  /* 13px */
--text-caption: 0.75rem; /* 12px */`,
    prompt: "Use a dense data-oriented type scale (h1 28px, body 14px, caption 12px) for dashboards and tables.",
    preview: "数据",
  },
];

// 分组元信息，供 Step 4 类B 渲染。
export const TOKEN_GROUPS: {
  key: "radius" | "font" | "density" | "shadow" | "scroll" | "type";
  label: string;
  presets: TokenPreset[];
}[] = [
  { key: "radius", label: "圆角", presets: RADIUS_TOKENS },
  { key: "font", label: "字体", presets: FONT_TOKENS },
  { key: "type", label: "字号层级", presets: TYPE_SCALE_TOKENS },
  { key: "density", label: "间距密度", presets: DENSITY_TOKENS },
  { key: "shadow", label: "阴影层级", presets: SHADOW_TOKENS },
  { key: "scroll", label: "滚动行为", presets: SCROLL_TOKENS },
];
