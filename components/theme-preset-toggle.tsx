"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Palette, RotateCcw } from "lucide-react";
import { VISUAL_STYLES, type VisualStyle } from "@/data/visual-styles";

// 源：agent-workstudio/src/styles/presets（data-theme-preset 属性切换，含 light+dark 全套）
const PRESET_OPTIONS = [
  { label: "默认 · 粗野", value: "brutalist" },
  { label: "Soft Pop 柔和流行", value: "soft-pop" },
  { label: "Tangerine 柑橘", value: "tangerine" },
  { label: "Claude 编辑", value: "claude" },
  { label: "Amethyst Haze 紫雾", value: "amethyst-haze" },
  { label: "T3 Chat 玫粉", value: "t3-chat" },
] as const;

const STORAGE_KEY = "theme-preset";
const CUSTOM_KEY = "theme-preset-custom";

/** 用户在色盘面板里能改的字段（其余 border/muted 跟随基础风格，不让用户直接调，避免破坏对比度） */
type PaletteOverride = Partial<{
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  accents: string[];
}>;

function presetStyle(value: string): VisualStyle | undefined {
  return VISUAL_STYLES.find((s) => s.id === `aw-${value}`);
}

function presetSwatch(value: string) {
  const s = presetStyle(value);
  return s
    ? [s.palette.accent, s.palette.accent2, s.palette.surface, s.palette.text]
    : ["#378ADD", "#B4B2A9", "#FFFFFF", "#2C2C2A"];
}

/** 合并基础 palette 与用户覆盖，得到最终生效的色板 */
function mergePalette(
  style: VisualStyle,
  ov?: PaletteOverride,
): VisualStyle["palette"] & { accents: string[] } {
  const accents = ov?.accents ?? style.palette.accents ?? [];
  return {
    bg: ov?.bg ?? style.palette.bg,
    surface: ov?.surface ?? style.palette.surface,
    border: style.palette.border,
    text: ov?.text ?? style.palette.text,
    muted: style.palette.muted,
    accent: ov?.accent ?? style.palette.accent,
    accent2: ov?.accent2 ?? style.palette.accent2,
    accents,
  };
}

function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca[0] * t + cb[0] * (1 - t));
  const g = Math.round(ca[1] * t + cb[1] * (1 - t));
  const bl = Math.round(ca[2] * t + cb[2] * (1 - t));
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 简单对比度挑选：bg 亮用近黑、暗用近白，并把 style.palette.text 混入一缕保持品牌感 */
function pickReadable(bg: string, hint: string, opacity: number): string {
  const rgb = parseHex(bg);
  if (!rgb) return hint;
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const target = lum > 140 ? "#0F172A" : "#F5F5F5";
  return mixHex(hint, target, opacity);
}

/** 把合并后的 palette 写为 CSS 变量覆盖到 <html>，即时生效 */
function applyPaletteToRoot(p: ReturnType<typeof mergePalette>) {
  const el = document.documentElement;
  el.style.setProperty("--background", p.bg);
  el.style.setProperty("--surface", p.surface);
  el.style.setProperty("--foreground", pickReadable(p.bg, p.text, 0.95));
  el.style.setProperty(
    "--muted-foreground",
    pickReadable(p.bg, p.text, 0.55),
  );
  el.style.setProperty("--primary", p.accent);
  el.style.setProperty("--secondary", p.accent2);
  // 6 档扩展强调色：accent → accent2 → accents[] → 循环回填
  const seed = [p.accent, p.accent2, ...p.accents];
  for (let i = 0; i < 6; i++) {
    el.style.setProperty(`--accent-${i + 1}`, seed[i % seed.length]);
  }
}

/** 清除 CSS 变量覆盖（恢复 data-theme-preset 自带的预设样式） */
function clearPaletteOverride() {
  const el = document.documentElement;
  const keys = [
    "--background",
    "--surface",
    "--foreground",
    "--muted-foreground",
    "--primary",
    "--secondary",
    "--accent-1",
    "--accent-2",
    "--accent-3",
    "--accent-4",
    "--accent-5",
    "--accent-6",
  ];
  keys.forEach((k) => el.style.removeProperty(k));
}

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
  const [preset, setPreset] = useState<string>("brutalist");
  const [custom, setCustom] = useState<Record<string, PaletteOverride>>({});
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 挂载后再读 localStorage，避免 SSR/客户端 hydration 不一致
  useEffect(() => {
    try {
      const p = localStorage.getItem(STORAGE_KEY);
      if (p) setPreset(p);
      const c = localStorage.getItem(CUSTOM_KEY);
      if (c) setCustom(JSON.parse(c));
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  // 应用：data-theme-preset 由 preset 控制基础；custom[preset] 写为 CSS 变量覆盖到 <html>
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme-preset", preset);
    const style = presetStyle(preset);
    if (!style) return;
    const ov = custom[preset];
    if (ov && Object.keys(ov).length > 0) {
      applyPaletteToRoot(mergePalette(style, ov));
    } else {
      clearPaletteOverride();
    }
  }, [preset, custom]);

  // 持久化
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, preset);
    } catch {
      /* ignore */
    }
  }, [preset]);
  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    } catch {
      /* ignore */
    }
  }, [custom]);

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

  const currentStyle = presetStyle(preset);
  const ov = custom[preset] ?? {};
  const merged = useMemo(
    () => (currentStyle ? mergePalette(currentStyle, ov) : null),
    [currentStyle, ov],
  );
  const isCustomized = Object.keys(ov).length > 0;

  const updateOverride = (patch: Partial<PaletteOverride>) => {
    setCustom((prev) => ({
      ...prev,
      [preset]: { ...(prev[preset] ?? {}), ...patch },
    }));
  };
  const updateAccent = (idx: number, v: string) => {
    const cur = currentStyle?.palette.accents ?? [];
    const next = [...(ov.accents ?? cur), v];
    updateOverride({ accents: next });
  };
  const resetCurrent = () => {
    setCustom((prev) => {
      const next = { ...prev };
      delete next[preset];
      return next;
    });
  };

  const swatchColors = currentStyle
    ? [currentStyle.palette.accent, currentStyle.palette.accent2, currentStyle.palette.surface, currentStyle.palette.text]
    : presetSwatch(preset);

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
                  onClick={() => setPreset(opt.value)}
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
                  onClick={resetCurrent}
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
                  onChange={(v) => updateOverride({ bg: v })}
                />
                <ColorRow
                  label="表面"
                  value={merged.surface}
                  onChange={(v) => updateOverride({ surface: v })}
                />
                <ColorRow
                  label="文字"
                  value={merged.text}
                  onChange={(v) => updateOverride({ text: v })}
                />
                <ColorRow
                  label="主色"
                  value={merged.accent}
                  onChange={(v) => updateOverride({ accent: v })}
                />
                <ColorRow
                  label="辅色"
                  value={merged.accent2}
                  onChange={(v) => updateOverride({ accent2: v })}
                />
                {(currentStyle?.palette.accents ?? []).slice(0, 2).map(
                  (_, i) => {
                    const seed = currentStyle?.palette.accents ?? [];
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
                  },
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
