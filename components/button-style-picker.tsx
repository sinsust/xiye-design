"use client";

// 主 CTA 按钮风格拾取器：只作用于「当前选中组件」的主导按钮/主 CTA，
// 不覆盖组件其余结构。与「动效」同构：选择即改预览 + 导出 code。

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { BUTTON_STYLES, findButtonStyle } from "@/lib/button-styles";
import { styleVars } from "@/app/builder/previews";
import type { VisualStyle } from "@/data/visual-styles";

export function ButtonStylePicker({
  pageId,
  componentId,
  style,
  designSystem,
}: {
  pageId: string;
  componentId: string;
  style: VisualStyle;
  designSystem?: import("@/lib/store/flow-store").DesignSystem | null;
}) {
  const btnStyles = useSkeletonStore((s) => s.buttonStyles);
  const setBtnStyle = useSkeletonStore((s) => s.setComponentButtonStyle);
  const keyC = `${pageId}:${componentId}`;
  const chosen = btnStyles[keyC] ?? null;
  const vars = styleVars(style, designSystem);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground">组件 · 主按钮外观</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {chosen ? `自定义 · ${findButtonStyle(chosen).name}` : "跟随变体默认（实心）"}
          <span className="ml-1">· 只改主 CTA，不覆盖组件结构</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1" style={vars}>
        {BUTTON_STYLES.map((s) => {
          const sel = chosen === s.id ? true : !chosen && s.id === "solid";
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setBtnStyle(keyC, s.id === "solid" ? null : s.id)}
              className={[
                "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all",
                sel ? "border-primary bg-primary/10" : "border-transparent hover:border-border hover:bg-muted",
              ].join(" ")}
            >
              <span
                className="flex h-7 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold"
                style={s.preview}
              >
                A
              </span>
              <span className="min-w-0">
                <span className={["block text-xs font-medium", sel ? "text-primary" : "text-foreground"].join(" ")}>{s.name}</span>
                <span className="block text-[11px] leading-snug text-muted-foreground">{s.description}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setBtnStyle(keyC, null)}
          title="回到组件默认的实心主按钮"
        >
          <RotateCcw className="size-3" /> 跟随默认
        </Button>
      </div>
    </div>
  );
}