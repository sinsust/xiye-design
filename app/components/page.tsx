"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  CloudFog,
  Code2,
  Copy,
  Orbit,
  PanelsTopLeft,
  Scan,
  SlidersHorizontal,
  Waves,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import FluidText from "@/components/originkit/ui/fluid-text";
import SmokyText from "@/components/originkit/ui/smokytext";
import FlashlightText from "@/components/originkit/ui/spotlighttext";
import { RingGallery } from "@/components/originkit/ring-gallery";
import Hero36 from "@/components/originkit/hero-36";
import Hero19 from "@/components/originkit/hero-19";
import OutstandHero from "@/components/originkit/outstand/hero";
import { COMPONENT_LIB, FLUID_PALETTES, sourcePathFor, type LibraryComponent } from "@/data/component-library";

type Settings = Record<string, string | number | string[]>;

const ICONS: Record<string, ReactNode> = {
  Waves: <Waves className="size-4" />,
  CloudFog: <CloudFog className="size-4" />,
  Scan: <Scan className="size-4" />,
  Orbit: <Orbit className="size-4" />,
  PanelsTopLeft: <PanelsTopLeft className="size-4" />,
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* 静默 */
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : label}
    </Button>
  );
}

function defaultSettings(comp: LibraryComponent): Settings {
  const s: Settings = {};
  for (const st of comp.settings) s[st.key] = st.default;
  return s;
}

function buildUsageCode(comp: LibraryComponent, settings: Settings): string {
  // 每个组件生成可直接复制的使用示例；完整源码由「复制源码」读取源文件给出
  if (comp.id === "ring-gallery") {
    const n = (k: string) => settings[k] ?? 0;
    const s = (k: string, def: string) => String(settings[k] ?? def);
    return `"use client";
import { RingGallery } from "@/components/originkit/ring-gallery";

export function Demo() {
  return (
    <div className="relative flex h-[360px] w-full items-center justify-center overflow-hidden bg-[#0c0c0f]">
      <RingGallery
        rings={${n("rings")}}
        direction="${s("direction", "cw") as string}"
        speed={${n("speed")}}
        innerRadius={${n("innerRadius")}}
        ringGap={${n("ringGap")}}
        cardWidth={${n("cardWidth")}}
        cardHeight={${n("cardHeight")}}
        rounded={${n("rounded")}}
        tilt={${n("tilt")}}
        fit="${s("fit", "cover") as string}"
        count={${Number(s("count", "12"))}}
      />
    </div>
  );
}`;
  }

  if (comp.id === "hero-36") {
    return `"use client";
import Hero36 from "@/components/originkit/hero-36";

export function Demo() {
  return <Hero36 />;
}`;
  }

  if (comp.id === "hero-19") {
    return `"use client";
import Hero19 from "@/components/originkit/hero-19";

export function Demo() {
  return <Hero19 />;
}`;
  }

  if (comp.id === "smoky-text") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def = 10) => Number(settings[k] ?? def);
    return `"use client";
import SmokyText from "@/components/originkit/ui/smokytext";

export function Demo() {
  return (
    <div className="relative flex h-[360px] w-full items-center justify-center overflow-hidden bg-black">
      <SmokyText
        text="${String(settings.text ?? "SMOKY\nTEXT").replace(/"/g, '\\"')}"
        color="${s("color", "#f5f5f5")}"
        intensity={${n("intensity")}}
        appearTrigger="${s("appearTrigger", "default")}"
        animationMode="${s("animationMode", "singleLine")}"
        position="${s("position", "bottomLeft")}"
        font={{ fontFamily: "Inter", fontWeight: 700, fontSize: ${n("fontSize", 120)}, textAlign: "center" }}
        appearTransition={{ type: "tween", ease: "easeOut", duration: ${n("duration", 2)}, delay: 0 }}
      />
    </div>
  );
}`;
  }

  if (comp.id === "spotlight-text") {
    return `"use client";
import FlashlightText from "@/components/originkit/ui/spotlighttext";

export function Demo() {
  return (
    <div className="flex h-[240px] w-full items-center justify-center bg-black">
      <FlashlightText
        text="${String(settings.text ?? "Not everything is meant to be seen at once.")}"
        brightColor="${String(settings.brightColor ?? "#FFFFFF")}"
        dimColor="${String(settings.dimColor ?? "#2A2A2A")}"
        maskSize={${Number(settings.maskSize ?? 150)}}
        intensity={${Number(settings.intensity ?? 10)}}
        font={{ fontFamily: "Inter", fontWeight: 600, fontSize: "${Number(settings.fontSize ?? 40)}px", textAlign: "center" }}
        transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
      />
    </div>
  );
}`;
  }

  // fluid-text
  const args: string[] = [];
  for (const st of comp.settings) {
    const v = settings[st.key];
    if (v === undefined) continue;
    if (st.kind === "palette") {
      args.push(`paletteColors={${JSON.stringify(v)}}`);
    } else if (typeof v === "number") {
      args.push(`${st.key}={${v}}`);
    } else if (st.kind === "text") {
      args.push(`text="${String(v)}"`);
    } else if (st.kind === "color") {
      args.push(`${st.key}="${String(v)}"`);
    } else if (st.kind === "select") {
      args.push(`${st.key}="${String(v)}"`);
    }
  }
  return `"use client";
import FluidText from "@/components/originkit/ui/fluid-text";

export function Demo() {
  return (
    <div className="relative h-[320px] w-full overflow-hidden bg-black">
      <FluidText
        text="FLUID TEXT"
        ${args.join("\n        ")}
      />
    </div>
  );
}`;
}

const ZEBRA_BG = `
  background-color: #111;
  background-image: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.05) 0,
    rgba(255,255,255,0.05) 12px,
    transparent 12px,
    transparent 24px
  );
`;

function bgStyle(bg: string): React.CSSProperties {
  if (bg === "light") return { backgroundColor: "#f4f4f5" };
  if (bg === "black") return { backgroundColor: "#000" };
  if (bg === "zebra") return {};
  return { backgroundColor: "#0c0c0f" };
}

export default function ComponentLibraryPage() {
  const [activeId, setActiveId] = useState(COMPONENT_LIB[0]?.id ?? "");
  const comp = COMPONENT_LIB.find((c) => c.id === activeId) ?? COMPONENT_LIB[0];
  const [settings, setSettings] = useState<Settings>(() => defaultSettings(comp));
  const [sourceCode, setSourceCode] = useState<string>("");
  const [sourceCopied, setSourceCopied] = useState(false);

  // 切换组件时重置设置
  useEffect(() => {
    setSettings(defaultSettings(comp));
  }, [comp.id]);

  // 拉取当前组件源码，供「复制源码」（支持多文件拼接）
  useEffect(() => {
    let alive = true;
    setSourceCode("");
    const paths = sourcePathFor(comp.id);
    if (paths.length === 0) return;
    Promise.all(
      paths.map((p) =>
        fetch(`/api/component-source?path=${encodeURIComponent(p)}`).then((r) =>
          r.ok ? r.text() : ""
        )
      )
    )
      .then((parts) => {
        if (!alive) return;
        const joined = parts
          .map((t, i) => `// ===== ${paths[i]} =====\n${t}`)
          .join("\n\n");
        setSourceCode(joined);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [comp.id]);

  const set = (key: string, value: string | number | string[]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const usageCode = useMemo(() => buildUsageCode(comp, settings), [comp, settings]);

  return (
    <div className="grid gap-6 lg:h-[calc(100vh-9rem)] lg:grid-cols-[210px_minmax(0,1fr)_260px]">
      {/* 侧边栏：组件列表（按分类分组） */}
      <aside className="flex max-h-[60vh] flex-col gap-1.5 overflow-y-auto pb-1 lg:max-h-none lg:pb-0">
        <p className="px-1 pb-1 font-heading text-sm font-semibold text-foreground">
          组件库
        </p>
        {Array.from(new Set(COMPONENT_LIB.map((c) => c.category))).map((cat) => {
          const items = COMPONENT_LIB.filter((c) => c.category === cat);
          return (
            <div key={cat} className="mb-1.5 flex flex-col gap-1.5">
              <p className="truncate px-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {cat}
              </p>
              {items.map((c) => {
                const active = c.id === comp.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={[
                      "flex items-center gap-2 border px-3 py-2 text-left text-sm transition",
                      "rounded-[var(--radius)]",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-transparent bg-transparent text-muted-foreground hover:bg-muted/40",
                    ].join(" ")}
                  >
                    <span className="shrink-0">{ICONS[c.icon] ?? null}</span>
                    <span className="truncate">{c.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
        <p className="mt-auto px-1 pt-3 text-xs leading-5 text-muted-foreground">
          选中组件后，右侧可实时调整参数；下方复制用法或完整源码。
        </p>
      </aside>

      {/* 画布 + 代码 */}
      <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto pr-0.5">
        <div
          className="relative shrink-0 overflow-hidden rounded-[var(--radius)]"
          style={{
            ...bgStyle(String(settings.bg ?? "dark")),
            ...(String(settings.bg) === "zebra" ? { backgroundImage: "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 12px, transparent 12px, transparent 24px)", backgroundColor: "#111" } : {}),
            minHeight: "20rem",
          }}
        >
          {comp.id === "fluid-text" && (
            <FluidText
              text={String(settings.text ?? "FLUID TEXT")}
              color={String(settings.color ?? "#FFFFFF")}
              paletteColors={
                Array.isArray(settings.palette) && (settings.palette as string[]).length
                  ? (settings.palette as string[])
                  : FLUID_PALETTES[0].colors
              }
              splatRadius={Number(settings.splatRadius ?? 7)}
              splatForce={Number(settings.splatForce ?? 10)}
              curl={Number(settings.curl ?? 50)}
              densityDissipation={Number(settings.densityDissipation ?? 5)}
              font={{
                fontSize: `${Number(settings.fontSize ?? 120)}px`,
                fontWeight: Number(settings.fontWeight ?? 700),
                lineHeight: 1.2,
              }}
              style={{ pointerEvents: "auto" }}
            />
          )}

          {comp.id === "smoky-text" && (
            <div className="flex min-h-[20rem] items-center justify-center bg-black px-6 py-8">
              <div className="h-[220px] w-full">
                <SmokyText
                  text={String(settings.text ?? "SMOKY\nTEXT")}
                  color={String(settings.color ?? "#f5f5f5")}
                  intensity={Number(settings.intensity ?? 10)}
                  appearTrigger={String(settings.appearTrigger ?? "default") as any}
                  animationMode={String(settings.animationMode ?? "singleLine") as any}
                  position={String(settings.position ?? "bottomLeft") as any}
                  font={{
                    fontFamily: "Inter",
                    fontWeight: 700,
                    fontSize: Number(settings.fontSize ?? 120),
                    textAlign: "center",
                  }}
                  appearTransition={{
                    type: "tween",
                    ease: "easeOut",
                    duration: Number(settings.duration ?? 2),
                    delay: 0,
                  }}
                />
              </div>
            </div>
          )}

          {comp.id === "spotlight-text" && (
            <div className="flex min-h-[20rem] items-center justify-center bg-black px-6 py-8">
              <div className="h-[240px] w-full">
                <FlashlightText
                  text={String(settings.text ?? "Not everything is meant to be seen at once. Hover to reveal.")}
                  brightColor={String(settings.brightColor ?? "#FFFFFF")}
                  dimColor={String(settings.dimColor ?? "#2A2A2A")}
                  maskSize={Number(settings.maskSize ?? 150)}
                  intensity={Number(settings.intensity ?? 10)}
                  font={{
                    fontFamily: "Inter",
                    fontWeight: 600,
                    fontSize: `${Number(settings.fontSize ?? 40)}px`,
                    lineHeight: "1.3em",
                    letterSpacing: "0em",
                    textAlign: "center",
                  }}
                  transition={{ type: "tween", duration: 0.3, ease: "easeInOut" }}
                />
              </div>
            </div>
          )}

          {comp.id === "ring-gallery" && (
            <div className="flex min-h-[20rem] items-center justify-center py-10">
              <RingGallery
                rings={Number(settings.rings ?? 3)}
                direction={String(settings.direction ?? "cw") as any}
                speed={Number(settings.speed ?? 7)}
                innerRadius={Number(settings.innerRadius ?? 110)}
                ringGap={Number(settings.ringGap ?? 120)}
                cardWidth={Number(settings.cardWidth ?? 72)}
                cardHeight={Number(settings.cardHeight ?? 92)}
                rounded={Number(settings.rounded ?? 6)}
                tilt={Number(settings.tilt ?? 6)}
                fit={String(settings.fit ?? "cover") as any}
                count={Number(settings.count ?? 12)}
              />
            </div>
          )}

          {comp.id === "hero-36" && (
            <div className="min-h-[20rem] bg-background">
              <Hero36 />
            </div>
          )}

          {comp.id === "hero-19" && (
            <div className="min-h-[20rem] bg-background">
              <Hero19 />
            </div>
          )}

          {comp.id === "outstand-hero" && (
            <div className="w-full">
              <OutstandHero
                heading={String(settings.heading ?? "Modern, Cool, and Effective Template for Your Business")}
                subheading={String(settings.subheading ?? "Boost Your Brand with Our Sleek and Cutting-Edge Framer Template")}
                primaryCta={{
                  label: String(settings.ctaLabel ?? "Book a call"),
                  href: "#",
                }}
                {...(settings.accentColor
                  ? {
                      // 通过 CSS 变量注入主题色
                      style: { "--os-color-accent": settings.accentColor } as React.CSSProperties,
                    }
                  : {})}
              />
            </div>
          )}

          <div className="pointer-events-none absolute left-3 top-3">
            <span className="rounded-[var(--radius)] bg-black/40 px-2 py-0.5 text-[11px] text-white/70">
              {comp.name}
              {comp.id === "fluid-text" ? " · 拖动搅动" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* 右侧：源码 + 设置面板 */}
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto pr-0.5">
        <div className="space-y-2 rounded-[var(--radius)] border border-border bg-background p-4">
          <Button
            size="sm"
            className="w-full justify-start bg-primary text-primary-foreground hover:bg-primary/80"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(sourceCode || usageCode);
                setSourceCopied(true);
                setTimeout(() => setSourceCopied(false), 1500);
              } catch {
                /* 静默 */
              }
            }}
            disabled={!sourceCode}
          >
            {sourceCopied ? (
              <Check className="size-3.5" />
            ) : (
              <Code2 className="size-3.5" />
            )}
            {sourceCopied ? "已复制" : "复制源码"}
          </Button>
        </div>

        <div className="space-y-4 rounded-[var(--radius)] border border-border bg-background p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <SlidersHorizontal className="size-4" />
            参数设置
          </p>
          {comp.settings.map((st) => (
            <SettingField
              key={st.key}
              label={st.label}
              kind={st.kind}
              value={settings[st.key]}
              min={st.min}
              max={st.max}
              step={st.step}
              unit={st.unit}
              options={st.options}
              onChange={(v) => set(st.key, v)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingField({
  label,
  kind,
  value,
  min,
  max,
  step,
  unit,
  options,
  onChange,
}: {
  label: string;
  kind: string;
  value: unknown;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: { label: string; value: string }[];
  onChange: (v: string | number | string[]) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {kind === "range" && (
          <span className="font-mono text-[11px]">
            {Number(value)}
            {unit ?? ""}
          </span>
        )}
      </span>

      {kind === "text" && (
        <input
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-[var(--radius)] border border-input bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      )}

      {kind === "range" && (
        <input
          type="range"
          value={Number(value ?? min ?? 0)}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-primary"
        />
      )}

      {kind === "color" && (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? "#fff")}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 w-9 cursor-pointer border border-input bg-background p-0.5"
          />
          <span className="font-mono text-[11px] text-muted-foreground">
            {String(value)}
          </span>
        </div>
      )}

      {kind === "palette" && (
        <div className="flex flex-wrap items-center gap-1.5">
          {FLUID_PALETTES.map((p) => {
            const colors = Array.isArray(value) ? (value as string[]) : [];
            const selected =
              colors.length === p.colors.length &&
              colors.every((c, i) => c.toLowerCase() === p.colors[i].toLowerCase());
            return (
              <button
                key={p.label}
                type="button"
                title={p.label}
                onClick={() => onChange([...p.colors])}
                className={[
                  "flex h-7 items-center gap-0.5 border p-0.5 transition",
                  "rounded-[var(--radius)]",
                  selected ? "border-primary" : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                {p.colors.map((c, i) => (
                  <span
                    key={i}
                    className="h-full w-4 rounded-[3px]"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </button>
            );
          })}
        </div>
      )}

      {kind === "select" && (
        <div className="flex flex-wrap gap-1">
          {(options ?? []).map((o) => {
            const selected = String(value) === o.value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={[
                  "rounded-[var(--radius)] px-2.5 py-1 text-xs transition",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </label>
  );
}