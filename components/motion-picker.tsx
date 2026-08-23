"use client";

// 按板块动效拾取器：只作用于「当前选中板块」的预览，可单独挑选 + 微调，
// 不依赖变体写死的 motionId、不影响其他板块。供 builder 预览顶栏弹层使用。

import { useState } from "react";
import { Wand2, RotateCcw, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkeletonStore } from "@/lib/skeleton-store";
import {
  COMPONENT_MOTION_GROUPS,
  findComponentMotion,
} from "@/data/component-motions";

/** 位移/时长滑杆 */
function TunableSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono text-foreground">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
      />
    </label>
  );
}

export function MotionPicker({
  pageId,
  componentId,
  /** 变体自带的默认动效（无自定义覆盖时跟随它） */
  variantMotionId,
  variantName,
}: {
  pageId: string;
  componentId: string;
  variantMotionId?: string;
  variantName?: string;
}) {
  const motion = useSkeletonStore((s) => s.componentMotion);
  const setMotion = useSkeletonStore((s) => s.setComponentMotion);
  const keyC = `${pageId}:${componentId}`;
  const override = motion[keyC];
  const [group, setGroup] = useState(() => COMPONENT_MOTION_GROUPS[0].id);

  const chosen = override?.motionId;
  const chosenMeta = findComponentMotion(chosen);
  const tunable = chosenMeta?.option.tunable ?? "none";
  const distance = override?.params?.distance ?? 12;
  const duration = override?.params?.duration ?? 1.2;

  const isLift = chosen === "fade-up" || chosen === "text-rise" || chosen === "hover-lift" || chosen === "reveal-on-scroll" || chosen === "text-rotate";
  const isFloat = chosen === "hover-lift";

  const setParam = (k: "distance" | "duration", v: number) =>
    setMotion(keyC, {
      motionId: chosen!,
      params: { ...(override?.params ?? {}), [k]: v },
    });

  const activeGroup = COMPONENT_MOTION_GROUPS.find((g) => g.id === group)!;

  return (
    <div className="w-[340px] max-w-[85vw] space-y-3">
      {/* 标题 + 当前态 */}
      <div>
        <p className="text-xs font-semibold text-foreground">
          动效 · <span className="text-muted-foreground">仅作用于当前板块</span>
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          {override
            ? chosenMeta
              ? `自定义 · ${chosenMeta.option.name}`
              : "自定义 · 已覆盖"
            : `跟随变体默认 ${variantName ? `（${variantName}）` : ""}`}
        </p>
      </div>

      {/* 场景 Tab */}
      <div className="flex flex-wrap gap-1">
        {COMPONENT_MOTION_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setGroup(g.id)}
            className={[
              "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              group === g.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/50",
            ].join(" ")}
          >
            {g.name}
          </button>
        ))}
      </div>

      {/* 选项 */}
      <div className="grid grid-cols-1 gap-1">
        {activeGroup.options.map((o) => {
          const sel = chosen === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                setMotion(keyC, {
                  motionId: o.id,
                  params: { distance, duration },
                })
              }
              className={[
                "flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition-all",
                sel
                  ? "border-primary bg-primary/10"
                  : "border-transparent hover:border-border hover:bg-muted",
              ].join(" ")}
            >
              <span
                className={[
                  "mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border",
                  sel ? "border-primary bg-primary" : "border-border bg-background",
                ].join(" ")}
              >
                {sel && <span className="size-1.5 rounded-full bg-background" />}
              </span>
              <span className="min-w-0">
                <span className={["block text-xs font-medium", sel ? "text-primary" : "text-foreground"].join(" ")}>
                  {o.name}
                </span>
                <span className="block text-[11px] leading-snug text-muted-foreground">
                  {o.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* 微调区 */}
      {override && tunable !== "none" && (
        <div className="space-y-2.5 rounded-xl border border-border bg-muted/30 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Wand2 className="size-3" /> 微调 {chosenMeta?.option.name ?? chosen}
          </p>
          {isLift && (
            <TunableSlider
              label={isFloat ? "浮动幅度" : "上滑距离"}
              value={distance}
              min={isFloat ? 4 : 8}
              max={isFloat ? 40 : 80}
              step={2}
              unit="px"
              onChange={(v) => setParam("distance", v)}
            />
          )}
          {(tunable === "duration" || tunable === "lift") && (
            <TunableSlider
              label="时长"
              value={duration}
              min={0.6}
              max={2.4}
              step={0.1}
              unit="s"
              onChange={(v) => setParam("duration", v)}
            />
          )}
        </div>
      )}

      {/* 底部操作 */}
      <div className="flex items-center gap-1.5 border-t border-border pt-2.5">
        <Button
          variant={override ? "outline" : "secondary"}
          size="sm"
          className="flex-1"
          onClick={() => setMotion(keyC, null)}
          title="回到变体自带默认动效"
        >
          <RotateCcw className="size-3" /> 跟随默认
        </Button>
        <Button
          variant={chosen === "motion-none" ? "secondary" : "outline"}
          size="sm"
          className="flex-1"
          onClick={() =>
            setMotion(keyC, { motionId: "motion-none", params: undefined })
          }
          title="当前板块不加任何动效"
        >
          <Ban className="size-3" /> 无动效
        </Button>
      </div>
    </div>
  );
}