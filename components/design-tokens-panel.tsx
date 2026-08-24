"use client";

import { useState, type ReactNode, type CSSProperties } from "react";
import {
  Sparkles,
  RotateCcw,
  Copy,
  Check,
  Sun,
  Moon,
  SunDim,
} from "lucide-react";
import { useFlowStore } from "@/lib/store/flow-store";
import {
  RADIUS_TOKENS,
  FONT_TOKENS,
  TYPE_SCALE_TOKENS,
  DENSITY_TOKENS,
  SHADOW_TOKENS,
  SCROLL_TOKENS,
} from "@/data/design-tokens";
import { VARIANT_OPTIONS } from "@/data/component-variants";
import { DARK_MODE_OPTIONS } from "@/data/design-presets";
import { VISUAL_STYLES, VISUAL_STYLE_MAP } from "@/data/visual-styles";
import type { VariantDimension } from "@/data/component-variants";

type Opt = { id: string; name: string; preview?: string };

/** 每个可视化选项的缩略图规范 */
interface SwatchDef {
  id: string;
  label: string;
  thumb: ReactNode;
}

/** 可视化选项条：每个选项一个「缩略图 + 标签」卡片，所见即所得 */
function SwatchStrip({
  options,
  value,
  onChange,
}: {
  options: SwatchDef[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.label}
            className={[
              "group flex flex-col items-center gap-1 rounded-lg border px-1 pt-1 pb-1 transition-all",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-transparent hover:border-border hover:bg-muted",
            ].join(" ")}
          >
            <span className="pointer-events-none grid h-9 w-9 place-items-center overflow-hidden rounded-md border border-border/70 bg-muted/40 text-foreground">
              {o.thumb}
            </span>
            <span
              className={[
                "leading-none",
                active ? "text-primary" : "text-muted-foreground",
              ].join(" ")}
              style={{ fontSize: "9px" }}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 按钮样本条：每个样本是一个「真实按钮缩略图 + 标签」卡片 */
function ButtonSwatchStrip({
  options,
  value,
  onChange,
}: {
  options: SwatchDef[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.label}
            className={[
              "group flex flex-col items-center gap-1.5 rounded-xl border p-1.5 transition-all",
              active
                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                : "border-transparent hover:border-border hover:bg-muted/60",
            ].join(" ")}
          >
            <span className="grid h-10 w-[46px] place-items-center rounded-lg border border-border/40 bg-gradient-to-b from-background to-muted/30 px-1">
              {o.thumb}
            </span>
            <span
              className={[
                "leading-none",
                active ? "font-medium text-primary" : "text-muted-foreground",
              ].join(" ")}
              style={{ fontSize: "9px" }}
            >
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 分组标题（hairline 分隔） */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </p>
  );
}

/** 下拉（滚动这类“行为”维度用文字即可，图标作示意） */
function SelectRow({
  label,
  options,
  value,
  onChange,
  defaultLabel,
}: {
  label: string;
  options: Opt[];
  value: string | null;
  onChange: (id: string) => void;
  defaultLabel: string;
}) {
  return (
    <div className="grid grid-cols-[3rem_1fr] items-center gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <div className="relative">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-border bg-background py-1.5 pl-2 pr-7 text-[11px] text-foreground outline-none transition-colors focus:border-primary"
        >
          <option value="">{defaultLabel}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="opacity-70">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </div>
  );
}

/** 大号可复制色块：棋盘格底 + 主色环，hover 出现复制提示 */
function ColorCell({
  label,
  value,
  custom,
  onChange,
}: {
  label: string;
  value: string;
  custom: boolean;
  onChange: (v: string | null) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* 剪贴板不可用时静默 */
    }
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg border border-border bg-muted/20 p-2 transition-colors hover:border-primary/40">
      <span
        className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-md border border-border"
        style={{ backgroundImage: "conic-gradient(#e5e7eb 25%, transparent 0 50%, #e5e7eb 0 75%, transparent 0)", backgroundSize: "10px 10px" }}
        title={label}
      >
        <span className="relative size-full cursor-pointer">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label={label}
          />
          <span
            className="absolute -inset-px rounded-md ring-1 ring-inset ring-black/5"
            style={{ backgroundColor: value }}
          />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium leading-none text-foreground">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="group/hex mt-0.5 flex items-center gap-1 font-mono text-[11px] leading-none text-muted-foreground transition-colors hover:text-foreground"
          title="点击复制 hex"
        >
          {value}
          {copied ? (
            <Check className="size-2.5 text-primary" />
          ) : (
            <Copy className="size-2.5 opacity-0 transition-opacity group-hover/hex:opacity-100" />
          )}
        </button>
      </div>
      {custom && (
        <button
          type="button"
          onClick={() => onChange(null)}
          title="恢复风格默认"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}

export function DesignTokensPanel({
  variant = "popover",
}: {
  variant?: "popover" | "inline";
}) {
  const ds = useFlowStore((s) => s.designSystem);
  const setDesignSystem = useFlowStore((s) => s.setDesignSystem);
  const cv = useFlowStore((s) => s.componentVariants);
  const setComponentVariant = useFlowStore((s) => s.setComponentVariant);
  const visualStyle = useFlowStore((s) => s.visualStyle);

  const style =
    VISUAL_STYLE_MAP[visualStyle ?? VISUAL_STYLES[0].id] ?? VISUAL_STYLES[0];
  const primary = ds?.colorPrimary ?? style.palette.accent;
  const secondary = ds?.colorSecondary ?? style.palette.accent2;

  // ── 每个维度转成可视缩略图 ──
  const radiusSwatches: SwatchDef[] = RADIUS_TOKENS.map((r) => {
    const br = r.preview ?? "8px";
    return {
      id: r.id,
      label: r.name,
      thumb: <span className="block h-5 w-5 rounded-sm border-2 border-current" style={{ borderRadius: br }} />,
    };
  });

  const typeScaleSwatches: SwatchDef[] = TYPE_SCALE_TOKENS.map((t) => {
    const size =
      t.id === "type-display" ? 22 : t.id === "type-editorial" ? 19 : t.id === "type-system" ? 17 : t.id === "type-data" ? 13 : 15;
    return {
      id: t.id,
      label: t.preview ?? t.name,
      thumb: <span className="font-bold leading-none" style={{ fontSize: size }}>Aa</span>,
    };
  });

  const densityPx: Record<string, number> = {
    ultra_compact: 2,
    compact: 5,
    standard: 8,
    spacious: 11,
    relaxed: 15,
  };
  const densitySwatches: SwatchDef[] = DENSITY_TOKENS.map((d) => {
    const gap = densityPx[d.id] ?? 8;
    return {
      id: d.id,
      label: d.name,
      thumb: (
        <span className="flex h-7 w-[26px] flex-col justify-center overflow-hidden">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-[5px] w-full rounded-sm bg-current"
              style={{ marginBottom: i < 2 ? gap : 0, opacity: 0.7 - i * 0.18 }}
            />
          ))}
        </span>
      ),
    };
  });

  const shadowBox: Record<string, string> = {
    "shadow-none": "none",
    "shadow-soft": "0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.08)",
    "shadow-medium": "0 4px 12px rgba(0,0,0,.10)",
    "shadow-large": "0 12px 32px rgba(0,0,0,.14)",
    "shadow-colored": `0 8px 24px ${primary}45`,
  };
  const shadowSwatches: SwatchDef[] = SHADOW_TOKENS.map((s) => ({
    id: s.id,
    label: s.name,
    thumb: (
      <span className="grid h-6 w-6 place-items-center rounded bg-card">
        <span className="block size-3.5 rounded-sm bg-foreground/90" style={{ boxShadow: shadowBox[s.id] ?? "none" }} />
      </span>
    ),
  }));

  const darkSwatches: SwatchDef[] = DARK_MODE_OPTIONS.map((d, i) => ({
    id: d.id,
    label: d.label.replace(/亮色|暗色/g, "").trim() || d.label,
    thumb:
      i === 0 ? <Sun className="size-4" /> : i === 1 ? <SunDim className="size-4" /> : <Moon className="size-4" />,
  }));

  const fontSwatches: SwatchDef[] = FONT_TOKENS.map((f) => ({
    id: f.id,
    label: f.name,
    thumb: <span className="font-bold leading-none" style={{ fontFamily: f.preview }}>Ag</span>,
  }));

  // ── 按钮变体：直接渲染真实按钮样式 ──
  const buttonVariants = VARIANT_OPTIONS.filter((o) => o.dimension === ("button" as VariantDimension));
  const buttonStyle = (id: string): CSSProperties => {
    switch (id) {
      case "btn_solid":
        return { background: primary, color: "#fff", borderRadius: "7px", boxShadow: "0 1px 2px rgba(0,0,0,.12)" };
      case "btn_outline":
        return { border: `1.5px solid ${primary}`, color: primary, borderRadius: "7px" };
      case "btn_ghost":
        return { color: primary, borderRadius: "7px" };
      case "btn_pill":
        return { background: primary, color: "#fff", borderRadius: "9999px", boxShadow: "0 1px 2px rgba(0,0,0,.12)" };
      // btn_gradient
      default:
        return { background: `linear-gradient(135deg, ${primary}, ${secondary})`, color: "#fff", borderRadius: "9999px", boxShadow: "0 1px 2px rgba(0,0,0,.12)" };
    }
  };
  const buttonSwatches: SwatchDef[] = buttonVariants.map((b) => ({
    id: b.id,
    label: b.name,
    thumb: (
      <span className="block whitespace-nowrap px-2 py-1 text-[10px] font-medium leading-none" style={buttonStyle(b.id)}>
        按钮
      </span>
    ),
  }));

  const buttonOpts = buttonVariants.map((o) => ({ id: o.id, name: o.name }));

  const resetAll = () =>
    setDesignSystem({
      radius: null,
      font: null,
      type: null,
      density: null,
      shadow: null,
      scroll: null,
      darkMode: null,
      colorPrimary: null,
      colorSecondary: null,
    });

  return (
    <div className={variant === "popover" ? "w-[340px] max-w-[92vw] space-y-4" : "space-y-4"}>
      {/* 头部 */}
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">设计系统</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            覆盖所选视觉风格，改动即时反映到预览与导出。
          </p>
        </div>
      </div>

      {/* 基础量 */}
      <div>
        <SectionLabel>基础</SectionLabel>
        <div className="space-y-2.5">
          <div>
            <SwatchStrip options={radiusSwatches} value={ds?.radius ?? null} onChange={(id) => setDesignSystem({ radius: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">圆角</p>
          </div>
          <div>
            <SwatchStrip options={typeScaleSwatches} value={ds?.type ?? null} onChange={(id) => setDesignSystem({ type: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">字号层级</p>
          </div>
          <div>
            <SwatchStrip options={densitySwatches} value={ds?.density ?? null} onChange={(id) => setDesignSystem({ density: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">间距密度</p>
          </div>
        </div>
      </div>

      {/* 字面与氛围 */}
      <div>
        <SectionLabel>字面与阴影</SectionLabel>
        <div className="space-y-2.5">
          <div>
            <SwatchStrip options={fontSwatches} value={ds?.font ?? null} onChange={(id) => setDesignSystem({ font: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">字体</p>
          </div>
          <div>
            <SwatchStrip options={shadowSwatches} value={ds?.shadow ?? null} onChange={(id) => setDesignSystem({ shadow: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">阴影</p>
          </div>
          <div>
            <SelectRow
              label="滚动"
              options={SCROLL_TOKENS.map((s) => ({ id: s.id, name: s.name }))}
              value={ds?.scroll ?? null}
              onChange={(id) => setDesignSystem({ scroll: id })}
              defaultLabel="默认滚动"
            />
          </div>
          <div>
            <SwatchStrip options={darkSwatches} value={ds?.darkMode ?? null} onChange={(id) => setDesignSystem({ darkMode: id })} />
            <p className="mt-1 text-[10px] text-muted-foreground">暗色模式</p>
          </div>
        </div>
      </div>

      {/* 配色 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            品牌配色
          </p>
          {(ds?.colorPrimary || ds?.colorSecondary) && (
            <button
              type="button"
              onClick={() => setDesignSystem({ colorPrimary: null, colorSecondary: null })}
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="size-2.5" /> 恢复
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <ColorCell
            label="主色"
            value={ds?.colorPrimary ?? primary}
            custom={!!ds?.colorPrimary}
            onChange={(v) => setDesignSystem({ colorPrimary: v })}
          />
          <ColorCell
            label="辅色"
            value={ds?.colorSecondary ?? secondary}
            custom={!!ds?.colorSecondary}
            onChange={(v) => setDesignSystem({ colorSecondary: v })}
          />
        </div>
      </div>

      {/* 组件默认：按钮直接看效果 */}
      <div>
        <SectionLabel>组件默认 · 按钮</SectionLabel>
        <ButtonSwatchStrip options={buttonSwatches} value={cv?.button ?? null} onChange={(id) => setComponentVariant("button", id)} />
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
          {buttonOpts.find((o) => o.id === (cv?.button ?? null))?.name ?? "跟随风格默认"}
        </div>
      </div>

      {/* 重置 */}
      <div className="border-t border-border pt-2.5 text-right">
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <RotateCcw className="size-2.5" /> 全部重置为跟随视觉风格
        </button>
      </div>
    </div>
  );
}