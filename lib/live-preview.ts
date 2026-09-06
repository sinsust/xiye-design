import type { CSSProperties } from "react";

/** 预览宽度档位（决策17：桌面 / 平板 / 手机 切换） */
export const PREVIEW_WIDTHS = {
  desktop: 1280,
  tablet: 768,
  phone: 390,
} as const;

export type PreviewWidth = keyof typeof PREVIEW_WIDTHS;

/** 把 resolveStyleVars 返回的 CSSProperties 转成 :root 作用域 CSS 字符串，
 *  复用实时预览同一套 token 映射，保证静态档与 builder 内联预览视觉一致。 */
export function cssPropsToRootVars(style: CSSProperties): string {
  return Object.entries(style)
    .map(([key, value]) => {
      if (value == null) return "";
      const prop = key.startsWith("--")
        ? key
        : key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      return `${prop}: ${String(value)};`;
    })
    .filter(Boolean)
    .join("\n");
}

export interface BuildPreviewDocOptions {
  innerHtml: string;
  tokenCss: string;
  bridgeCss: string;
}

/** 组装可在 <iframe srcDoc> 中即时预览的静态 HTML 文档。
 *  - Tailwind Play CDN 负责工具类样式（JIT 扫描 DOM，无需本地 node / 重建 dev server）
 *  - :root token 变量 + designTokenBridge 还原风格与设计系统覆盖 */
export function buildPreviewDoc({
  innerHtml,
  tokenCss,
  bridgeCss,
}: BuildPreviewDocOptions): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://cdn.tailwindcss.com"></script>
<style>
${tokenCss}
${bridgeCss}
html,body{margin:0;padding:0;}
body{font-family:var(--font-sans, system-ui, sans-serif);background:var(--background);color:var(--foreground);}
.dtox-root{min-height:100vh;}
</style>
</head>
<body class="dtox-root"><div class="dtox-root">${innerHtml}</div></body>
</html>`;
}
