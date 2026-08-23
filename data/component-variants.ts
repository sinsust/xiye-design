export type VariantDimension = "card" | "button" | "navbar" | "form" | "interaction";

export interface VariantOption {
  id: string;
  dimension: VariantDimension;
  name: string;
  description: string;
  preview: string; // 用于描述预览效果的关键词（实际用 Tailwind 渲染）
  css?: string; // 可复制的组件 CSS 片段
  prompt?: string; // 可复制的提示词
  /** 生成的组件名（如 GradientButton），button/card/navbar/form 维度必填 */
  componentName?: string;
}

export const VARIANT_OPTIONS: VariantOption[] = [
  // ═══ 卡片样式 ═══
  {
    id: "card_flat",
    dimension: "card",
    name: "扁平简洁",
    description: "无阴影、细边框、纯色背景，干净利落",
    preview: "border border-gray-200 bg-white rounded-lg",
    componentName: "FlatCard",
  },
  {
    id: "card_shadow",
    dimension: "card",
    name: "柔和阴影",
    description: "无边框、大圆角、柔和阴影，现代感强",
    preview: "shadow-lg bg-white rounded-2xl",
    componentName: "ShadowCard",
  },
  {
    id: "card_glass",
    dimension: "card",
    name: "毛玻璃",
    description: "半透明背景 + 模糊效果，通透高级",
    preview: "bg-white/60 backdrop-blur-xl border border-white/20 rounded-2xl",
    componentName: "GlassCard",
  },
  {
    id: "card_gradient",
    dimension: "card",
    name: "渐变填充",
    description: "彩色渐变背景，视觉冲击力强",
    preview: "bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl",
    componentName: "GradientCard",
  },

  // ═══ 按钮风格 ═══
  {
    id: "btn_solid",
    dimension: "button",
    name: "实心填充",
    description: "纯色背景 + 白字，经典可靠",
    preview: "bg-blue-600 text-white rounded-lg px-4 py-2",
    componentName: "SolidButton",
  },
  {
    id: "btn_outline",
    dimension: "button",
    name: "描边镂空",
    description: "透明背景 + 彩色边框，轻量克制",
    preview: "border-2 border-blue-600 text-blue-600 rounded-lg px-4 py-2",
    componentName: "OutlineButton",
  },
  {
    id: "btn_ghost",
    dimension: "button",
    name: "幽灵按钮",
    description: "无边框无背景，hover 时显示底色",
    preview: "text-blue-600 hover:bg-blue-50 rounded-lg px-4 py-2",
    componentName: "GhostButton",
  },
  {
    id: "btn_gradient",
    dimension: "button",
    name: "渐变按钮",
    description: "渐变色背景，视觉焦点",
    preview: "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full px-6 py-2",
    componentName: "GradientButton",
  },
  {
    id: "btn_pill",
    dimension: "button",
    name: "胶囊圆钮",
    description: "高饱和主色全圆角胶囊，亲和突出",
    preview: "bg-blue-600 text-white rounded-full px-6 py-2",
    componentName: "PillButton",
  },

  // ═══ 导航栏样式 ═══
  {
    id: "nav_transparent",
    dimension: "navbar",
    name: "透明悬浮",
    description: "透明背景悬浮在页面内容上方",
    preview: "bg-transparent",
    componentName: "TransparentNav",
  },
  {
    id: "nav_solid",
    dimension: "navbar",
    name: "实色固定",
    description: "纯色背景 + 底部细线，清晰稳定",
    preview: "bg-white border-b border-gray-200",
    componentName: "SolidNav",
  },
  {
    id: "nav_blur",
    dimension: "navbar",
    name: "毛玻璃",
    description: "半透明 + 模糊，内容若隐若现",
    preview: "bg-white/80 backdrop-blur-lg",
    componentName: "BlurNav",
  },
  {
    id: "nav_dark",
    dimension: "navbar",
    name: "深色沉浸",
    description: "深色背景，适合品牌型/创意型网站",
    preview: "bg-gray-900 text-white",
    componentName: "DarkNav",
  },

  // ═══ 表单风格 ═══
  {
    id: "form_underline",
    dimension: "form",
    name: "下划线",
    description: "仅底部线条，极简风格",
    preview: "border-b-2 border-gray-300 focus:border-blue-500",
    componentName: "UnderlineInput",
  },
  {
    id: "form_outlined",
    dimension: "form",
    name: "描边矩形",
    description: "四边描边 + 圆角，经典 Material 风格",
    preview: "border border-gray-300 rounded-lg focus:border-blue-500",
    componentName: "OutlinedInput",
  },
  {
    id: "form_filled",
    dimension: "form",
    name: "填充灰底",
    description: "灰色背景填充，无边框，focus 时显示边框",
    preview: "bg-gray-100 border border-transparent focus:border-blue-500 rounded-lg",
    componentName: "FilledInput",
  },

  // ═══ 交互动效 ═══
  {
    id: "ix_none",
    dimension: "interaction",
    name: "无交互",
    description: "静态，无 hover/焦点动效",
    preview: "",
    css: `/* 无额外交互动效 */`,
    prompt: "Keep components static with no hover or focus animation.",
  },
  {
    id: "ix_hover_lift",
    dimension: "interaction",
    name: "悬停上浮",
    description: "hover 轻微上浮 + 阴影",
    preview: "",
    css: `.ix-hover-lift { transition: transform .2s ease, box-shadow .2s ease; }\n.ix-hover-lift:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(0,0,0,.12); }`,
    prompt: "Lift elements 4px on hover with a soft shadow over 0.2s.",
  },
  {
    id: "ix_focus_ring",
    dimension: "interaction",
    name: "焦点光环",
    description: "focus 显示主色描边光环",
    preview: "",
    css: `.ix-focus-ring:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }`,
    prompt: "Show a primary-color focus ring with 2px offset on keyboard focus (focus-visible).",
  },
  {
    id: "ix_scale_tap",
    dimension: "interaction",
    name: "点按缩放",
    description: "点击/激活时轻微缩放反馈",
    preview: "",
    css: `.ix-scale-tap { transition: transform .12s ease; }\n.ix-scale-tap:active { transform: scale(.97); }`,
    prompt: "Add a subtle scale(0.97) press feedback on active/tap over 0.12s.",
  },
  {
    id: "ix_ripple",
    dimension: "interaction",
    name: "波纹反馈",
    description: "Material 式点击波纹",
    preview: "",
    css: `.ix-ripple { position: relative; overflow: hidden; }\n.ix-ripple::after { content:""; position:absolute; inset:0; background: radial-gradient(circle, rgba(255,255,255,.5) 10%, transparent 10%); opacity:0; transition: opacity .4s; }\n.ix-ripple:active::after { opacity:1; }`,
    prompt: "Implement a Material-style ripple effect on click.",
  },
];

export const DIMENSION_LABELS: Record<
  VariantDimension,
  { label: string; icon: string }
> = {
  card: { label: "卡片样式", icon: "CreditCard" },
  button: { label: "按钮风格", icon: "MousePointerClick" },
  navbar: { label: "导航栏样式", icon: "Menu" },
  form: { label: "表单风格", icon: "FileInput" },
  interaction: { label: "交互动效", icon: "Sparkles" },
};

/**
 * 由变体推导"可运行组件文件"：button/card/navbar/form → TSX 组件；
 * interaction → CSS 工具类文件。返回 { fileName, code } 供复制/下载。
 */
export function getComponentFile(opt: VariantOption): {
  fileName: string;
  code: string;
} {
  if (opt.dimension === "interaction") {
    const cls = opt.id.replace(/^ix_/, "");
    return {
      fileName: `interaction-${cls}.css`,
      code: `/* ${opt.name} — 由 xiye 流程工作台生成（交互动效） */\n${opt.css ?? ""}\n\n/* 用法：给目标元素添加 class="ix-${cls}" 即可（按钮 / 卡片 / 输入框通用） */`,
    };
  }

  const name = opt.componentName ?? `${opt.dimension}_${opt.id}`;
  const dimLabel = DIMENSION_LABELS[opt.dimension].label;
  const baseByDim: Record<string, string> = {
    button: `import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function ${name}({ className = "", ...props }: Props) {
  return (
    <button
      className={"${opt.preview} inline-flex items-center justify-center font-medium transition hover:opacity-90 active:scale-[0.98] " + className}
      {...props}
    />
  );
}`,
    card: `import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement>;

export function ${name}({ className = "", ...props }: Props) {
  return <div className={"${opt.preview} p-4 " + className} {...props} />;
}`,
    navbar: `import * as React from "react";

type Props = React.HTMLAttributes<HTMLElement>;

export function ${name}({ className = "", ...props }: Props) {
  return (
    <nav className={"${opt.preview} flex items-center justify-between px-6 py-3 " + className} {...props} />
  );
}`,
    form: `import * as React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement>;

export function ${name}({ className = "", ...props }: Props) {
  return (
    <input
      className={"${opt.preview} w-full px-3 py-2 text-sm outline-none " + className}
      {...props}
    />
  );
}`,
  };

  return {
    fileName: `${name}.tsx`,
    code: `// ${name}.tsx — 由 xiye 流程工作台生成（${dimLabel}：${opt.name}）
${baseByDim[opt.dimension] ?? ""}`,
  };
}
