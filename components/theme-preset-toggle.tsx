"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, RotateCcw } from "lucide-react";
import {
  mergePalette,
  presetStyle,
  presetSwatch,
  useApplyPalette,
  useThemePaletteStore,
  type PaletteOverride,
} from "@/lib/use-theme-palette";

// 顶部主题切换的 7 个 preset 选项
const PRESET_OPTIONS = [
  { label: "默认 · 粗野", value: "aw-brutalist" },
  { label: "Soft Pop 柔和流行", value: "aw-soft-pop" },
  { label: "自然绿", value: "nature-green" },
  { label: "Tangerine 柑橘", value: "aw-tangerine" },
  { label: "Claude 编辑", value: "aw-claude" },
  { label: "Amethyst Haze 紫雾", value: "aw-amethyst-haze" },
  { label: "T3 Chat 玫粉", value: "aw-t3-chat" },
] as const;

const STORAGE_KEY = "theme-preset";

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 hover:bg-muted/50">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] transition hover:border-primary/40"
        title="点击调色"
      >
        <span
          className="size-3.5 rounded border border-black/10"
          style={{ background: value }}
        />
        <span className="font-mono uppercase text-foreground/80">{value}</span>
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}

export function ThemePresetToggle() {
  const [preset, setPresetState] = useState<string>("aw-brutalist");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const custom = useThemePaletteStore((s) => s.custom);
  const setOverride = useThemePaletteStore((s) => s.setOverride);
  const resetOverride = useThemePaletteStore((s) => s.resetOverride);

  // 挂载后从 localStorage 读取当前 preset
  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEY);
      if (p) setPresetState(p);
    } catch {
      /* ignore */
    }
  }, []);

  // 把当前 preset 同步到 <html> CSS 变量（统一复用 hook）
  useApplyPalette(preset);

  // 持久化 preset
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preset);
    } catch {
      /* ignore */
    }
  }, [preset]);

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

  const style = presetStyle(preset);
  const ov = custom[preset] ?? {};
  const merged = style ? mergePalette(style, ov) : null;
  const isCustomized = Object.keys(ov).length > 0;

  const updateAccent = (idx: number, v: string) => {
    const seed = style?.palette.accents ?? [];
    const cur = ov.accents ?? seed;
    const next = [...cur];
    next[idx] = v;
    setOverride(preset, { accents: next } as Partial<PaletteOverride>);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`主题色盘（当前：${PRESET_OPTIONS.find((p) => p.value === preset)?.label ?? preset}）`}
        title="主题色盘"
        className="inline-flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground"
      >
        {isCustomized && merged ? (
          <span
            className="size-5 rounded-full border border-border"
            style={{
              background: `linear-gradient(135deg, ${merged.accent} 0%, ${merged.accent} 50%, ${merged.surface} 50%, ${merged.surface} 100%)`,
            }}
          />
        ) : (
          <Palette className="size-3.5" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[260px] rounded-xl border border-border bg-card p-2 shadow-xl">
          <p className="px-2 pb-1.5 text-xs font-medium text-foreground">主题色盘</p>

          {/* 预设 tab */}
          <div className="grid grid-cols-3 gap-1.5 px-1 pb-2">
            {PRESET_OPTIONS.map((opt) => {
              const active = opt.value === preset;
              const s = presetSwatch(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPresetState(opt.value)}
                  className={[
                    "flex flex-col items-center gap-1 rounded-md border px-1.5 py-1.5 text-[10px] transition",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  ].join(" ")}
                  title={opt.label}
                >
                  <span className="flex gap-0.5">
                    {s.map((c, i) => (
                      <span
                        key={i}
                        className="size-2.5 rounded-full border border-black/10"
                        style={{ background: c }}
                      />
                    ))}
                  </span>
                  <span className="line-clamp-1 w-full text-center">
                    {opt.label.replace(/^默认 · /, "")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 当前色盘编辑 */}
          {merged && (
            <div className="border-t border-border pt-1.5">
              <div className="mb-1 flex items-center justify-between px-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {PRESET_OPTIONS.find((p) => p.value === preset)?.label}
                  {isCustomized && (
                    <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] font-medium text-primary">
                      已定制
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => resetOverride(preset)}
                  disabled={!isCustomized}
                  className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw className="size-3" />
                  重置
                </button>
              </div>
              <div className="space-y-0.5">
                <ColorRow
                  label="背景"
                  value={merged.bg}
                  onChange={(v) => setOverride(preset, { bg: v })}
                />
                <ColorRow
                  label="表面"
                  value={merged.surface}
                  onChange={(v) => setOverride(preset, { surface: v })}
                />
                <ColorRow
                  label="文字"
                  value={merged.text}
                  onChange={(v) => setOverride(preset, { text: v })}
                />
                <ColorRow
                  label="主色"
                  value={merged.accent}
                  onChange={(v) => setOverride(preset, { accent: v })}
                />
                <ColorRow
                  label="辅色"
                  value={merged.accent2}
                  onChange={(v) => setOverride(preset, { accent2: v })}
                />
                {(style?.palette.accents ?? []).slice(0, 2).map((_, i) => {
                  const seed = style?.palette.accents ?? [];
                  const fallback = seed[i] ?? merged.accent;
                  const cur = merged.accents[i] ?? fallback;
                  return (
                    <ColorRow
                      key={i}
                      label={`扩展 ${i + 1}`}
                      value={cur}
                      onChange={(v) => updateAccent(i, v)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 导出供 builder 视觉选择器复用
export { ColorRow };
