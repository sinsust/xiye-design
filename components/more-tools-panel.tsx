"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";
import { VISUAL_STYLES } from "@/data/visual-styles";
import { DesignTokensPanel } from "@/components/design-tokens-panel";

/** 流程工作台顶部工具：视觉风格切换 + 设计 Token。
 *  骨架工作台内对应能力（项目文案 / 视觉风格）已显性化为独立顶栏入口，不再走此折叠面板。 */
export function MoreToolsPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const visualStyle = useFlowStore((s) => s.visualStyle);
  const setVisualStyle = useFlowStore((s) => s.setVisualStyle);
  const activeStyle = visualStyle ? VISUAL_STYLES.find((s) => s.id === visualStyle) : undefined;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as HTMLElement)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        {open ? <X className="size-3.5" /> : <Settings2 className="size-3.5" />} 更多
      </Button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[22rem] overflow-auto rounded-xl border border-border bg-card p-3 shadow-xl">
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <p className="mb-2 text-xs font-medium text-foreground">
              视觉风格
              <span className="ml-0.5 text-muted-foreground">（写回流程，Step 4 共享）</span>
            </p>
            {activeStyle && (
              <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Check className="size-3" /> 当前：{activeStyle.name}
              </p>
            )}
            <div className="mt-2 max-h-44 space-y-1 overflow-auto rounded-lg border border-border bg-background p-1.5">
              {VISUAL_STYLES.map((s) => {
                const selected = visualStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setVisualStyle(s.id)}
                    className={[
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                      selected ? "bg-primary/10 text-primary" : "hover:bg-muted",
                    ].join(" ")}
                  >
                    <span className="flex shrink-0 gap-0.5">
                      {[s.palette.accent, s.palette.accent2, s.palette.surface, s.palette.text].map((c, i) => (
                        <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                    <span className={["truncate font-medium", selected ? "text-primary" : "text-foreground"].join(" ")}>
                      {s.name}
                    </span>
                    {selected && <Check className="ml-auto size-3.5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <DesignTokensPanel variant="popover" />
          </div>
        </div>
      )}
    </div>
  );
}