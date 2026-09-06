"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { VisualStyle } from "@/data/visual-styles";
import type { BlueprintEntry, DesignSystem } from "@/lib/store/flow-store";
import { resolveStyleVars } from "@/lib/style-resolver";
import {
  designTokenBridgeCss,
  ComponentPreview,
  CtaStyleProvider,
} from "@/app/builder/previews";
import { BuilderElementProvider } from "@/lib/builder-element-context";
import {
  buildPreviewDoc,
  cssPropsToRootVars,
  PREVIEW_WIDTHS,
  type PreviewWidth,
} from "@/lib/live-preview";

function tokenCss(style: VisualStyle, ds?: DesignSystem | null): string {
  return cssPropsToRootVars(resolveStyleVars(style, ds));
}

export function LivePreview({
  style,
  designSystem,
  blueprint,
}: {
  style: VisualStyle;
  designSystem?: DesignSystem | null;
  blueprint: BlueprintEntry[];
}) {
  const renderRef = useRef<HTMLDivElement>(null);
  const [srcDoc, setSrcDoc] = useState("");
  const [width, setWidth] = useState<PreviewWidth>("desktop");

  // 按 pageSlug 把蓝图归并为「页面 → 组件列表」
  const pages = useMemo(() => {
    const map = new Map<string, BlueprintEntry[]>();
    for (const e of blueprint) {
      const arr = map.get(e.pageSlug) ?? [];
      arr.push(e);
      map.set(e.pageSlug, arr);
    }
    return Array.from(map.entries());
  }, [blueprint]);

  const generate = () => {
    const html = renderRef.current?.innerHTML ?? "";
    setSrcDoc(
      buildPreviewDoc({
        innerHtml: html,
        tokenCss: tokenCss(style, designSystem),
        bridgeCss: designTokenBridgeCss(designSystem),
      }),
    );
  };

  // 挂载即生成一次（隐藏渲染源已就绪）
  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          实时预览 · Live Preview
        </span>
        <div className="ml-auto flex items-center gap-1">
          {(Object.keys(PREVIEW_WIDTHS) as PreviewWidth[]).map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWidth(w)}
              className={[
                "rounded-md px-2 py-1 text-[11px] capitalize transition-colors",
                width === w
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-background text-muted-foreground hover:border-primary/60",
              ].join(" ")}
            >
              {w}
            </button>
          ))}
          <button
            type="button"
            onClick={generate}
            className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/60"
          >
            刷新
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
        <div className="mx-auto" style={{ width: PREVIEW_WIDTHS[width], maxWidth: "100%" }}>
          <iframe
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            title="live-preview"
            className="h-[80vh] w-full rounded-lg border border-border bg-white"
          />
        </div>
      </div>

      {/* 隐藏渲染源：复用 ComponentPreview 真实输出，读取 innerHTML 注入 iframe。
          组件内部 var(--*) 在 iframe :root 中由 tokenCss 还原，因此此处无需 token 样式。 */}
      <div ref={renderRef} className="dtox-root" style={{ display: "none" }} aria-hidden>
        {pages.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            蓝图为空：先在流程工作台加入页面组件
          </div>
        ) : (
          pages.map(([slug, entries]) => (
            <section key={slug} data-page={slug}>
              {entries.map((e, i) => (
                <BuilderElementProvider
                  key={`${e.componentId}-${e.variantId ?? "x"}-${i}`}
                  scope="main"
                  componentId={e.componentId}
                  variantId={e.variantId ?? ""}
                >
                  <CtaStyleProvider value={null}>
                    <ComponentPreview
                      componentId={e.componentId}
                      variantId={e.variantId ?? ""}
                      style={style}
                    />
                  </CtaStyleProvider>
                </BuilderElementProvider>
              ))}
            </section>
          ))
        )}
      </div>
    </div>
  );
}
