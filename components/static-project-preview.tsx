"use client";

// D：静态产物预览档（决策17）。以静态产物 HTML（buildStaticPreviewHtml）在 iframe 中预览，
// 复用 PREVIEW_WIDTHS 做桌面/平板/手机宽度切换。相对 LivePreview 不依赖 React 运行态，
// 与 seed 里导出的 preview.html 同源，所见即所存。

import { useMemo, useState } from "react";
import type { VisualStyle } from "@/data/visual-styles";
import type { BlueprintEntry, DesignSystem } from "@/lib/store/flow-store";
import { buildStaticPreviewHtml } from "@/lib/static-preview";
import { PREVIEW_WIDTHS, type PreviewWidth } from "@/lib/live-preview";

export function StaticProjectPreview({
  style,
  styleId,
  designSystem,
  blueprint,
  projectName,
}: {
  style: VisualStyle;
  styleId: string;
  designSystem?: DesignSystem | null;
  blueprint: BlueprintEntry[];
  projectName?: string | null;
}) {
  const [width, setWidth] = useState<PreviewWidth>("desktop");

  const srcDoc = useMemo(() => {
    const state = {
      pageBlueprint: blueprint,
      visualStyle: styleId,
      designSystem: designSystem ?? null,
      projectInfo: projectName ? { projectName } : undefined,
    } as Parameters<typeof buildStaticPreviewHtml>[0];
    return buildStaticPreviewHtml(state, style, designSystem);
  }, [blueprint, style, styleId, designSystem, projectName]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">
          静态产物 · 视觉基线
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
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
        <div className="mx-auto" style={{ width: PREVIEW_WIDTHS[width], maxWidth: "100%" }}>
          <iframe
            sandbox="allow-scripts"
            srcDoc={srcDoc}
            title="static-preview"
            className="h-[80vh] w-full rounded-lg border border-border bg-white"
          />
        </div>
      </div>
    </div>
  );
}