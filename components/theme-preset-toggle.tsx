"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { VISUAL_STYLES } from "@/data/visual-styles";

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

function presetSwatch(value: string) {
  const style = value
    ? VISUAL_STYLES.find((s) => s.id === `aw-${value}`)
    : undefined;
  return style
    ? [style.palette.accent, style.palette.accent2, style.palette.surface, style.palette.text]
    : ["#378ADD", "#B4B2A9", "#FFFFFF", "#2C2C2A"];
}

export function ThemePresetToggle() {
  // 初始一律用确定性默认值（粗野），避免 SSR/客户端 hydration 不一致；
  // 真实存储值由下方 useEffect 挂载后读取，保证首帧两端一致。
  const [preset, setPreset] = useState<string>("brutalist");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 挂载后再读 localStorage，避免 useState 初始化器在服务端/客户端取值不同导致 hydration mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setPreset(saved);
    } catch {
      /* localStorage 不可用时忽略 */
    }
  }, []);

  // 挂载即应用「持久化或默认(粗野)」预设，刷新后真实生效
  useEffect(() => {
    const el = document.documentElement;
    if (preset) el.setAttribute("data-theme-preset", preset);
    else el.removeAttribute("data-theme-preset");
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

  const apply = (value: string) => {
    setPreset(value);
    setOpen(false);
    const el = document.documentElement;
    if (value) {
      el.setAttribute("data-theme-preset", value);
    } else {
      el.removeAttribute("data-theme-preset");
    }
    try {
      if (value) localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* 忽略 */
    }
  };

  const current = PRESET_OPTIONS.find((p) => p.value === preset) ?? PRESET_OPTIONS[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`切换主题预设（当前：${current.label}）`}
        title={`主题预设：${current.label}`}
        className="inline-flex size-8 items-center justify-center rounded-full bg-background text-muted-foreground transition-colors hover:text-foreground"
      >
        <Palette className="size-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-border bg-card p-2 shadow-xl">
          <p className="px-2 pb-1.5 text-xs text-muted-foreground">主题预设</p>
          <div className="space-y-0.5">
            {PRESET_OPTIONS.map((opt) => {
              const active = opt.value === preset;
              const s = presetSwatch(opt.value);
              return (
                <button
                  key={opt.value || "default"}
                  type="button"
                  onClick={() => apply(opt.value)}
                  className={[
                    "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                    active ? "bg-muted font-medium text-foreground" : "text-foreground hover:bg-muted",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex gap-0.5">
                      {s.map((c, i) => (
                        <span key={i} className="size-2.5 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                    {opt.label}
                  </span>
                  {active && <Check className="size-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
