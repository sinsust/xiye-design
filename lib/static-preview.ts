// 静态产物预览档（决策17）：把工作区蓝图渲染成一页自包含的 <!doctype html>。
// 供 seed 的 preview.html 独立打开，或 builder「静态产物」档位在 iframe 中预览。
//
// 不含 React 运行时依赖，仅用纯 lib 帮手（token 解析、Tailwind Play CDN、设计系统桥）。
// 这里的设计系统桥是 app/builder/previews.tsx 的 designTokenBridgeCss 的整段复刻——
// 为避免在服务端/seed 打包里引入 "use client" 模块，故落一份纯函数副本（逻辑保持一致）。

import type { VisualStyle } from "@/data/visual-styles";
import type { FlowState, BlueprintEntry } from "@/lib/store/flow-store";
import type { DesignSystem } from "@/lib/store/flow-store";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import { resolveStyleVars, cssToVars } from "@/lib/style-resolver";
import {
  RADIUS_TOKENS,
  TYPE_SCALE_TOKENS,
  DENSITY_TOKENS,
  SHADOW_TOKENS,
} from "@/data/design-tokens";
import { buildPreviewDoc, cssPropsToRootVars } from "@/lib/live-preview";

/** 把 resolveStyleVars 返回的 CSSProperties 转成 :root 令牌字符串 */
function tokenCss(style: VisualStyle, ds?: DesignSystem | null): string {
  return cssPropsToRootVars(resolveStyleVars(style, ds));
}

/** designTokenBridgeCss 的复刻（见文件头注释）：设计 Token → 工具类桥接 */
function bridgeCss(ds?: DesignSystem | null): string {
  if (!ds) return "";
  let css = "";
  if (ds.radius) {
    const radius = RADIUS_TOKENS.find((r) => r.id === ds.radius)?.preview;
    if (radius) {
      const scale: Array<[string, string]> = [
        ["rounded-sm", "0.5"],
        ["rounded", "1"],
        ["rounded-md", "1"],
        ["rounded-lg", "1.25"],
        ["rounded-xl", "1.5"],
        ["rounded-2xl", "1.75"],
      ];
      for (const [cls, mul] of scale)
        css += `.dtox-root .${cls}{border-radius:calc(${radius} * ${mul}) !important;}`;
    }
  }
  if (ds.type) {
    const vars = cssToVars(TYPE_SCALE_TOKENS.find((t) => t.id === ds.type)?.css ?? "");
    const map: Array<[string, string]> = [
      ["text-4xl", "--text-display"],
      ["text-3xl", "--text-h1"],
      ["text-2xl", "--text-h2"],
      ["text-xl", "--text-h3"],
      ["text-lg", "--text-h4"],
    ];
    for (const [cls, varName] of map) {
      if (vars[varName]) css += `.dtox-root .${cls}{font-size:${vars[varName]} !important;}`;
    }
  }
  if (ds.density) {
    const vars = cssToVars(DENSITY_TOKENS.find((d) => d.id === ds.density)?.css ?? "");
    const spaceY: Array<[string, string]> = [
      ["space-y-1", "--space-1"],
      ["space-y-2", "--space-2"],
      ["space-y-3", "--space-3"],
      ["space-y-4", "--space-4"],
      ["space-y-6", "--space-6"],
    ];
    const gap: Array<[string, string]> = [
      ["gap-1", "--space-1"],
      ["gap-2", "--space-2"],
      ["gap-3", "--space-3"],
      ["gap-4", "--space-4"],
      ["gap-6", "--space-6"],
    ];
    const pad: Array<[string, string]> = [
      ["p-1", "--space-1"],
      ["p-2", "--space-2"],
      ["p-3", "--space-3"],
      ["p-4", "--space-4"],
      ["p-6", "--space-6"],
      ["px-2", "--space-2"],
      ["px-3", "--space-3"],
      ["px-4", "--space-4"],
      ["px-6", "--space-6"],
      ["py-1", "--space-1"],
      ["py-2", "--space-2"],
      ["py-3", "--space-3"],
      ["py-4", "--space-4"],
      ["py-6", "--space-6"],
    ];
    for (const [cls, varName] of spaceY) {
      if (vars[varName])
        css += `.dtox-root .${cls} > :not([hidden]) ~ :not([hidden]){margin-top:${vars[varName]} !important;}`;
    }
    for (const [cls, varName] of gap) {
      if (vars[varName]) css += `.dtox-root .${cls}{gap:${vars[varName]} !important;}`;
    }
    for (const [cls, varName] of pad) {
      if (vars[varName]) {
        const sub = cls.startsWith("px")
          ? ".dtox-root ." + cls + "{padding-right:" + vars[varName] + " !important;}"
          : cls.startsWith("py")
            ? ".dtox-root ." + cls + "{padding-bottom:" + vars[varName] + " !important;}"
            : "";
        const prop = cls.startsWith("px") ? "padding-left" : cls.startsWith("py") ? "padding-top" : "padding";
        css += `.dtox-root .${cls}{${prop}:${vars[varName]} !important;}${sub}`;
      }
    }
  }
  if (ds.shadow) {
    const shadow = SHADOW_TOKENS.find((s) => s.id === ds.shadow)?.css.match(/--shadow:\s*([^;]+);/)?.[1];
    if (shadow) {
      for (const cls of ["shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl"]) {
        css += `.dtox-root .${cls}{box-shadow:${shadow} !important;}`;
      }
    }
  }
  return css;
}

interface AssemblyItem {
  pageSlug: string;
  pageName: string;
  components: Array<{ componentId: string; componentName: string; variantName: string }>;
}

/** 按 pageSlug 归并蓝图（与 seed-project 的 blueprintAssembly 同构） */
function assemble(state: FlowState): AssemblyItem[] {
  const order: string[] = [];
  const byPage = new Map<string, BlueprintEntry[]>();
  for (const e of state.pageBlueprint) {
    if (!order.includes(e.pageSlug)) order.push(e.pageSlug);
    const list = byPage.get(e.pageSlug) ?? [];
    list.push(e);
    byPage.set(e.pageSlug, list);
  }
  return order.map((slug) => {
    const page = SKELETON_PAGE_MAP[slug];
    return {
      pageSlug: slug,
      pageName: page?.name ?? slug,
      components: (byPage.get(slug) ?? []).map((e) => {
        const comp = page?.components.find((c) => c.id === e.componentId);
        const variant = comp?.variants.find((v) => v.id === e.variantId) ?? comp?.variants[0];
        return {
          componentId: e.componentId,
          componentName: comp?.name ?? e.componentId,
          variantName: variant?.name ?? "默认",
        };
      }),
    };
  });
}

/**
 * 生成一页自包含的静态产物预览 HTML。
 * 把每个页面的组件渲染成贴合设计令牌的占位卡片，作为「静态产物预览档」存档，
 * 相对实时预览不依赖 React 运行态，可独立于复制/分发的静态产物中打开。
 */
export function buildStaticPreviewHtml(
  state: FlowState,
  style: VisualStyle,
  designSystem?: DesignSystem | null,
): string {
  const pages = assemble(state);
  const projectName = state.projectInfo?.projectName ?? "你的产品";

  const innerHtml = pages.length
    ? pages
        .map(
          (p, pi) => `<section data-page="${p.pageSlug}" style="padding:48px 0;border-bottom:1px dashed var(--border, rgba(0,0,0,.08));">
  <div class="mx-auto" style="max-width:1200px;padding:0 24px;">
    <h1 class="text-2xl font-bold" style="color:var(--foreground);">${esc(String(pi + 1))}. ${esc(p.pageName)}</h1>
    <div class="mt-4 grid gap-6" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));">
      ${p.components
        .map(
          (c) => `<div class="rounded-2xl border p-5 bg-white/60" style="border-color:var(--border, rgba(0,0,0,.08));">
        <div class="rounded-lg" style="height:96px;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 55%,transparent));opacity:.85;"></div>
        <h3 class="mt-3 text-sm font-semibold" style="color:var(--foreground);">${esc(c.componentName)}</h3>
        <p class="text-xs" style="color:var(--muted-foreground, #64748b);">变体 · ${esc(c.variantName)}</p>
      </div>`,
        )
        .join("\n      ")}
    </div>
  </div>
</section>`,
        )
        .join("\n")
    : `<div class="p-10 text-center" style="color:var(--muted-foreground, #64748b);">蓝图为空：先在流程工作台加入页面组件</div>`;

  const header = `<header style="padding:56px 0;background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 60%,#000));">
  <div class="mx-auto" style="max-width:1200px;padding:0 24px;color:#fff;">
    <p class="text-xs" style="opacity:.85;">静态产物 · 视觉基线预览</p>
    <h1 class="mt-2 text-3xl font-bold" style="color:#fff;">${esc(projectName)}</h1>
    <p class="mt-1 text-sm" style="opacity:.9;">${pages.length} 个页面 · ${pages
      .reduce((n, p) => n + p.components.length, 0)
      } 个组件 · 仅作视觉基线参照，最终以工程源码为准</p>
  </div>
</header>`;

  return buildPreviewDoc({
    innerHtml: `${header}${innerHtml}`,
    tokenCss: tokenCss(style, designSystem),
    bridgeCss: bridgeCss(designSystem),
  });
}

/** 转义 HTML 特殊字符，避免蓝图/组件名泄漏进标签结构 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}