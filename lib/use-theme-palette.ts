"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { VISUAL_STYLES, type VisualStyle } from "@/data/visual-styles";

const CUSTOM_KEY = "theme-preset-custom";

/** 用户在色盘面板里能改的字段（其余 border/muted 跟随基础风格，不让用户直接调，避免破坏对比度） */
export type PaletteOverride = Partial<{
  bg: string;
  surface: string;
  text: string;
  accent: string;
  accent2: string;
  accents: string[];
}>;

export function presetStyle(value: string): VisualStyle | undefined {
  return VISUAL_STYLES.find((s) => s.id === value);
}

export function presetSwatch(value: string): string[] {
  const s = presetStyle(value);
  return s
    ? [s.palette.accent, s.palette.accent2, s.palette.surface, s.palette.text]
    : ["#378ADD", "#B4B2A9", "#FFFFFF", "#2C2C2A"];
}

/** 合并基础 palette 与用户覆盖，得到最终生效的色板 */
export function mergePalette(
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

export function parseHex(hex: string): [number, number, number] | null {
  let h = hex.trim().replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const r = Math.round(ca[0] * t + cb[0] * (1 - t));
  const g = Math.round(ca[1] * t + cb[1] * (1 - t));
  const bl = Math.round(ca[2] * t + cb[2] * (1 - t));
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** 简单对比度挑选：bg 亮用近黑、暗用近白，并把 style.palette.text 混入一缕保持品牌感 */
export function pickReadable(bg: string, hint: string, opacity: number): string {
  const rgb = parseHex(bg);
  if (!rgb) return hint;
  const lum = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  const target = lum > 140 ? "#0F172A" : "#F5F5F5";
  return mixHex(hint, target, opacity);
}

/** 把合并后的 palette 写为 CSS 变量覆盖到 <html>，即时生效 */
export function applyPaletteToRoot(p: ReturnType<typeof mergePalette>) {
  const el = document.documentElement;
  el.style.setProperty("--background", p.bg);
  el.style.setProperty("--surface", p.surface);
  el.style.setProperty("--foreground", pickReadable(p.bg, p.text, 0.95));
  el.style.setProperty("--muted-foreground", pickReadable(p.bg, p.text, 0.55));
  el.style.setProperty("--primary", p.accent);
  el.style.setProperty("--secondary", p.accent2);
  const seed = [p.accent, p.accent2, ...p.accents];
  for (let i = 0; i < 6; i++) {
    el.style.setProperty(`--accent-${i + 1}`, seed[i % seed.length]);
  }
}

/** 清除 CSS 变量覆盖（恢复 data-theme-preset 自带的预设样式） */
export function clearPaletteOverride() {
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

// 单一 store：所有 preset 共享同一份 custom 覆盖映射，组件间状态天然同步
type PaletteState = {
  custom: Record<string, PaletteOverride>;
  setOverride: (id: string, patch: Partial<PaletteOverride>) => void;
  resetOverride: (id: string) => void;
};

export const useThemePaletteStore = create<PaletteState>()(
  persist(
    (set) => ({
      custom: {},
      setOverride: (id, patch) =>
        set((s) => ({
          custom: { ...s.custom, [id]: { ...(s.custom[id] ?? {}), ...patch } },
        })),
      resetOverride: (id) =>
        set((s) => {
          const next = { ...s.custom };
          delete next[id];
          return { custom: next };
        }),
    }),
    {
      name: CUSTOM_KEY,
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

/**
 * 同步把当前 styleId 的覆盖应用到 <html> CSS 变量。
 * 在 ThemePresetToggle 与 builder 视觉选择器里都调用，保证两侧任一改色都即时生效。
 */
export function useApplyPalette(styleId: string | null | undefined) {
  const custom = useThemePaletteStore((s) => s.custom);
  useEffect(() => {
    if (!styleId) return;
    const el = document.documentElement;
    el.setAttribute("data-theme-preset", styleId);
    const style = presetStyle(styleId);
    if (!style) return;
    const ov = custom[styleId];
    if (ov && Object.keys(ov).length > 0) {
      applyPaletteToRoot(mergePalette(style, ov));
    } else {
      clearPaletteOverride();
    }
  }, [styleId, custom]);
}
