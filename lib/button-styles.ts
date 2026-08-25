// 主 CTA 按钮交互样式：作用于当前组件的主导按钮/主 CTA，不覆盖组件其余结构。
// 与「动效」模型同构：state 里按 `${pageId}:${componentId}` 存样式 id，预览与导出 code 均反映。

import type { CSSProperties } from "react";

export interface ButtonStyleDef {
  id: string;
  name: string;
  description: string;
  /** 应用到「主按钮/主 CTA」的外观（覆盖默认实心） */
  preview: CSSProperties;
  /** 追加到按钮 className；可从「实心默认」转变 */
  className?: string;
  /** className 圆角片段替换，例如实心直角 → 胶囊 */
  round?: { from: string; to: string };
  /** 导出 code：主按钮文字色由 text-white 替换为……（outline/ghost/underline 需要） */
  codeTextClass?: string;
  /** 导出 code：替换主按钮 style 的完整 JSX 对象文本；缺省表示保持实心背景 */
  codeStyleText?: string;
  /** 顶部按钮角标色：选中时高亮主色圆点 */
  dot?: boolean;
  /** 原生交互按钮（水波/键帽/流光）：导出 code 会把主按钮替换为 ButtonResource 并注入 import */
  component?: "water" | "keycap" | "moving";
}

export const BUTTON_STYLES: ButtonStyleDef[] = [
  {
    id: "solid",
    name: "实心（默认）",
    description: "accent 实底 + 白色文字，最强烈的主导操作",
    preview: { background: "var(--primary)", color: "var(--on-primary)" },
  },
  {
    id: "outline",
    name: "描边",
    description: "透明底 + accent 描边 + 主色文字，hover 填充",
    preview: { background: "transparent", border: "1px solid var(--primary)", color: "var(--primary)" },
    codeTextClass: "text-[var(--primary)]",
    codeStyleText: '{ background: "transparent", border: "1px solid var(--primary)" }',
  },
  {
    id: "underline",
    name: "下划线",
    description: "纯文字链接 + 主色下划线，hover 时下划线上移",
    preview: { background: "transparent", color: "var(--primary)", borderRadius: 0, padding: "0", borderBottom: "1px solid var(--primary)" },
    className: "rounded-none !px-0 !py-0",
    codeTextClass: "text-[var(--primary)]",
    codeStyleText: '{ background: "transparent", borderBottom: "1px solid var(--primary)", borderRadius: 0, padding: 0 }',
  },
  {
    id: "ghost",
    name: "幽灵",
    description: "无底纯主色文字，hover 轻微加深底色",
    preview: { background: "transparent", color: "var(--primary)" },
    codeTextClass: "text-[var(--primary)]",
    codeStyleText: '{ background: "transparent" }',
  },
  {
    id: "pill",
    name: "胶囊",
    description: "全圆角胶囊 + hover 轻微浮起",
    preview: { background: "var(--primary)", color: "var(--on-primary)" },
    round: { from: "rounded-[var(--radius)]", to: "rounded-full" },
    className: "hover:-translate-y-0.5",
  },
  {
    id: "keycap",
    name: "键帽",
    description: "等轴机械键帽，呼应『从一行字/键盘输入』——产品签名按钮",
    preview: { background: "#16121D", color: "#A05CFF" },
    component: "keycap",
    dot: true,
  },
  {
    id: "moving",
    name: "流光",
    description: "常驻流动的动态渐变，通用专业的主行动按钮",
    preview: { background: "#000", color: "#CCC30E" },
    component: "moving",
    dot: true,
  },
  {
    id: "water",
    name: "水波",
    description: "拨开水面的玻璃按钮，点缀与引导场景",
    preview: { background: "#0a0f2e", color: "#00EEFF" },
    component: "water",
    dot: true,
  },
];

export function findButtonStyle(id?: string | null): ButtonStyleDef {
  return BUTTON_STYLES.find((s) => s.id === id) ?? BUTTON_STYLES[0];
}

/** 主 CTA 的导出 code 开标签：`<a ... className="..." style={{ background: "var(--primary)" }}>` 统一形态 */
const CTA_OPEN_RE = /(<a\b[^>]*?className=")([^"]*)("[^>]*?style)(=\{\{\s*background:\s*"var\(--primary\)"\s*\}\})([^>]*>)/;

// 原生交互按钮：匹配完整的主 CTA 锚点 `<a className="…" style={{ background: "var(--primary)" }}>文字</a>`
const CTA_FULL_RE =
  /<a\b[^>]*?className="[^"]*"[^>]*?style=\{\{\s*background:\s*"var\(--primary\)"\s*\}\}[^>]*>([^<]*)<\/a>/;

const BUTTON_RESOURCE_IMPORT = `import ButtonResource from "@/components/originkit/ui/button-resource";`;

/** 把主 CTA 替换为所选 Originkit 交互按钮组件，并在文件头注入 import（缺货/未匹配则安全返回原码） */
function applyButtonResource(code: string, style: "water" | "keycap" | "moving"): string {
  const label = (code.match(CTA_FULL_RE)?.[1] ?? "").trim();
  const quote = (s: string) => s.replace(/"/g, '\\"');
  const inner = `style="${style}"${label ? ` label="${quote(label)}"` : ""}`;
  const isFull = CTA_FULL_RE.test(code);
  const next = isFull
    ? code.replace(CTA_FULL_RE, `<ButtonResource ${inner} />`)
    : code;
  return next.includes("ui/button-resource") ? next : `${BUTTON_RESOURCE_IMPORT}\n${next}`;
}

/**
 * 把「实心默认」主按钮的导出 TSX code 替换为所选样式（预览与导出一致）。
 * component 样式走整锚点替换为 ButtonResource；找不到符合形态的主按钮则原样返回，保证安全。
 */
export function applyButtonStyleToCode(code: string, styleId?: string | null): string {
  const def = findButtonStyle(styleId);
  if (def.component) return applyButtonResource(code, def.component);
  if (def.id === "solid") return code;
  return code.replace(CTA_OPEN_RE, (_m, pre, cls, sPre, styleToken, sPost) => {
    let nextCls = cls;
    if (def.codeTextClass) nextCls = nextCls.replace(/\btext-white\b/, def.codeTextClass);
    if (def.round) nextCls = nextCls.replace(def.round.from, def.round.to);
    const nextStyle = def.codeStyleText ? `={${def.codeStyleText}}` : styleToken;
    return pre + nextCls + sPre + "style" + nextStyle + sPost;
  });
}