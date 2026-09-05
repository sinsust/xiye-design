"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FluidText from "@/components/originkit/ui/fluid-text";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Copy,
  Layers,
  Palette,
  Shirt,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  VISUAL_STYLES,
  FONT_STACK,
  styleToCss,
  styleToTailwind,
  type StyleFont,
  type VisualStyle,
} from "@/data/visual-styles";
import { resolveStyleVars } from "@/lib/style-resolver";
import { useFlowStore } from "@/lib/store/flow-store";
import { gsap, useGSAP } from "@/lib/gsap";

const FONT_LABEL: Record<StyleFont, string> = {
  serif: "衬线",
  sans: "无衬线",
  mono: "等宽",
  grotesk: "Grotesk",
};

/** 由 hex 求亮度，判断深浅（rgba 毛玻璃表面一律归为深色系） */
/** 读取当前主题（跟随 html.dark class + localStorage） */
function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const read = () =>
      document.documentElement.classList.contains("dark") ? "dark" : "light";
    setTheme(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme") setTheme(read());
    };
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    window.addEventListener("storage", onStorage);
    return () => {
      obs.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return theme ?? "dark";
}

/** 根据视口宽度计算流体标题的像素字号（替代 CSS clamp，因为 FluidText 只认 px 数字） */
function useFluidTitleFontSize(): number {
  const [size, setSize] = useState(48);
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      // 移动端 32px → 平板 44px → 桌面 64px，两行布局更有冲击力
      if (vw < 480) return 32;
      if (vw < 768) return 40;
      if (vw < 1024) return 48;
      if (vw < 1280) return 56;
      return 64;
    };
    setSize(calc());
    const onResize = () => setSize(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/** 流体文字两套调色板：浅色模式低饱和清新，深色模式高饱和科技 */
const FLUID_PALETTE_LIGHT = ["#6366F1", "#EC4899", "#10B981", "#F59E0B"];
const FLUID_PALETTE_DARK = ["#A855F7", "#EC4899", "#3B82F6", "#22D3EE"];

/** 首页副标题文案（Shiny Pill 扫光效果使用，保持原文字与字号） */
const HERO_SUBTITLE =
  "用一句话描述你的产品，AI 自动解构类型、技术栈与视觉风格，从页面骨架一路搭到可导出的整站。";

function luminance(hex: string): number {
  if (hex.startsWith("rgba")) return 0;
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isDark(hex: string): boolean {
  return luminance(hex) < 150;
}

function contrastText(hex: string): string {
  return luminance(hex) > 150 ? "#000" : "#fff";
}

function luminance255(hex: string): number {
  if (hex.startsWith("rgba")) return 0;
  if (hex.startsWith("rgb")) {
    const m = hex.match(/\d+/g);
    if (m && m.length >= 3) {
      return (
        0.2126 * parseInt(m[0]) +
        0.7152 * parseInt(m[1]) +
        0.0722 * parseInt(m[2])
      );
    }
    return 0;
  }
  const n = Number.parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const l1 = luminance255(a) / 255 + 0.05;
  const l2 = luminance255(b) / 255 + 0.05;
  return Math.max(l1, l2) / Math.min(l1, l2);
}

function readableInk(fg: string, bg: string): string {
  return contrastRatio(fg, bg) >= 2.8 ? fg : contrastText(bg);
}

function mutedInk(bg: string): string {
  const t = contrastText(bg);
  return t === "#000" ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)";
}

/** 把风格 palette 映射为完整的 shadcn/token 变量集，用于「整页试穿」整站换肤。 */
function chromeVars(style: VisualStyle): CSSProperties {
  const p = style.palette;
  const r = `${style.radius}px`;
  const accentInk = contrastText(p.accent);
  const accent2Ink = contrastText(p.accent2);
  return {
    "--background": p.bg,
    "--foreground": p.text,
    "--card": p.surface,
    "--card-foreground": p.text,
    "--popover": p.surface,
    "--popover-foreground": p.text,
    "--primary": p.accent,
    "--primary-foreground": accentInk,
    "--secondary": p.accent2,
    "--secondary-foreground": accent2Ink,
    "--muted": p.surface,
    "--muted-foreground": p.muted,
    "--accent": p.surface,
    "--accent-foreground": p.text,
    "--border": p.border,
    "--input": p.border,
    "--ring": p.accent,
    "--radius": r,
    backgroundColor: p.bg,
    color: p.text,
    fontFamily: FONT_STACK[style.font],
  } as CSSProperties;
}

const TONES = [
  { id: "all", name: "深浅不限" },
  { id: "light", name: "浅色" },
  { id: "dark", name: "深色" },
] as const;

/** 风格迷你预览：用真实 palette 做一张设计标本，避免重复占位文案 */
function StylePreview({ style }: { style: VisualStyle }) {
  const p = style.palette;
  const vars = useMemo(() => resolveStyleVars(style), [style]);
  const fg = readableInk(p.text, p.bg);
  const mg = mutedInk(p.bg);
  const accentInk = readableInk(contrastText(p.accent), p.accent);
  return (
    <div
      style={{
        ...vars,
        background: p.bg,
        color: fg,
        fontFamily: FONT_STACK[style.font],
        fontSize: 12,
      }}
      className="relative flex h-full flex-col gap-3 overflow-hidden border-b border-border p-4"
    >
      {style.blur && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: style.previewBg }}
        />
      )}
      {/* 真实设计标本：字体、字号、配色一眼可见差异 */}
      <div className="relative mt-1 space-y-2">
        <p className="font-bold leading-tight" style={{ fontSize: 18 }}>
          {style.name}
        </p>
        <p className="line-clamp-2 text-xs leading-snug" style={{ color: mg }}>
          {style.description}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <span
            className="inline-flex items-center rounded-[var(--radius)] px-2.5 py-1 text-[10px] font-medium"
            style={{ background: p.accent, color: accentInk }}
          >
            主要动作
          </span>
          <span
            className="inline-flex items-center rounded-[var(--radius)] border px-2.5 py-1 text-[10px]"
            style={{ borderColor: p.border, color: fg }}
          >
            次要动作
          </span>
        </div>
      </div>
      {/* Token 条：色板 / 字体 / 圆角——这才是每个风格真正不同的地方 */}
      <div className="relative mt-auto flex items-center justify-between gap-2 pt-3" style={{ borderTop: `1px solid ${p.border}` }}>
        <div className="flex -space-x-1.5">
          {[p.surface, p.accent, p.accent2, p.text].map((c, i) => (
            <span
              key={i}
              className="size-4 rounded-full border-2"
              style={{ background: c, borderColor: p.border }}
              title={c}
            />
          ))}
        </div>
        <span className="truncate text-[10px]" style={{ color: mg }}>
          {FONT_LABEL[style.font]} · {style.radius}px
        </span>
      </div>
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* 剪贴板不可用时静默 */
        }
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? "已复制" : label}
    </Button>
  );
}

/** 详情弹层：色板 / 字型 / 圆角 / 提示词 / Token 代码 */
function StyleDialog({
  style,
  anchorRect,
  onClose,
  onTryOn,
  onApply,
}: {
  style: VisualStyle;
  anchorRect?: DOMRect;
  onClose: () => void;
  onTryOn: (s: VisualStyle) => void;
  onApply: (s: VisualStyle, target: "builder" | "flow") => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 弹窗锚定在卡片附近（卡片已在本页可视区域内），并把弹窗完整约束在视口内，
  // 不产生任何页面滚动，避免出现弹窗跑偏 / 显示不全。
  const computePanelPos = useCallback(() => {
    const panel = panelRef.current;
    if (!anchorRect || !panel) return;
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 16;
    // 水平：卡片水平居中，但夹取到视口内
    let left = Math.min(
      anchorRect.left + anchorRect.width / 2 - pw / 2,
      vw - pw - margin,
    );
    left = Math.max(left, margin);
    // 垂直：优先放卡片下方，放不下放上方，仍放不下则垂直居中
    let top = anchorRect.bottom + 12;
    if (top + ph > vh - margin) top = anchorRect.top - ph - 12;
    if (top < margin) top = Math.max(margin, (vh - ph) / 2);
    setPos({ left, top });
  }, [anchorRect]);

  useLayoutEffect(() => {
    computePanelPos();
  }, [computePanelPos]);

  useEffect(() => {
    const onResize = () => computePanelPos();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computePanelPos]);

  // 弹窗打开期间锁定底层滚动，避免背景内容滚动与锚定位置错动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const p = style.palette;
  const swatches = [
    { name: "背景", hex: p.bg },
    { name: "表面", hex: p.surface },
    { name: "描边", hex: p.border },
    { name: "正文", hex: p.text },
    { name: "次文本", hex: p.muted },
    { name: "强调", hex: p.accent },
    { name: "次强调", hex: p.accent2 },
  ];
  const css = styleToCss(style);
  const tw = styleToTailwind(style);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="modal-panel-enter absolute flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        style={{
          width: "min(48rem, calc(100vw - 2rem))",
          left: pos?.left ?? 0,
          top: pos?.top ?? 0,
          visibility: pos ? "visible" : "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：紧凑，只放名称、描述、来源与关闭 */}
        <div
          style={{
            ...resolveStyleVars(style),
            background: p.bg,
            color: readableInk(p.text, p.bg),
          }}
          className="relative shrink-0 border-b border-border p-4"
        >
          {style.blur && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: style.previewBg }}
            />
          )}
          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: FONT_STACK[style.font] }}
              >
                {style.name}
              </p>
              <p
                className="mt-1 line-clamp-2 text-xs leading-snug"
                style={{ color: mutedInk(p.bg) }}
              >
                {style.description}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[11px]" style={{ color: mutedInk(p.bg) }}>
                <span>来源 · {style.sourceSkill}</span>
                <span>字体 · {FONT_LABEL[style.font]}</span>
                <span>圆角 · {style.radius}px</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="rounded-md p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
              style={{ color: mutedInk(p.bg) }}
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 space-y-5 overflow-y-auto p-5">
          {/* 色板 */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Palette className="size-3.5" /> 色板
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {swatches.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2"
                >
                  <span
                    className="size-7 shrink-0 rounded-md border border-black/10"
                    style={{ background: s.hex }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-foreground">{s.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {s.hex}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                `字体 · ${FONT_LABEL[style.font]}`,
                `圆角 · ${style.radius}px`,
                `来源 · ${style.sourceSkill}`,
              ].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* 风格提示词 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" /> 风格提示词
              </p>
              <CopyBtn text={style.prompt} label="复制" />
            </div>
            <pre className="max-h-40 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
              {style.prompt}
            </pre>
          </div>

          {/* CSS Token */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="size-3.5" /> 设计 Token 代码
              </p>
              <CopyBtn text={css} label="复制" />
            </div>
            <pre className="max-h-44 overflow-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
              {css}
            </pre>
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={() => onTryOn(style)}
            className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-primary hover:underline"
          >
            <Shirt className="size-3.5" /> 整页试穿这套风格
          </button>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <p className="text-xs text-muted-foreground">应用此风格，进入？</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => onApply(style, "builder")}>
                页面搭建 <ArrowUpRight className="size-3.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onApply(style, "flow")}>
                流程工作台 <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** 单张风格卡 */
function StyleCard({
  style,
  active,
  onSelect,
  onTryOn,
}: {
  style: VisualStyle;
  active: boolean;
  onSelect: (s: VisualStyle, rect?: DOMRect) => void;
  onTryOn: (s: VisualStyle) => void;
}) {
  const p = style.palette;
  const ink = contrastText(p.accent);
  const ref = useRef<HTMLDivElement>(null);
  const handleSelect = () => {
    // 不滚动页面：卡片本就在可视区域内，直接把其视口坐标传给弹窗做锚定即可
    const el = ref.current;
    const rect = el?.getBoundingClientRect();
    onSelect(style, rect);
  };
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      }}
      className={[
        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        active ? "border-primary ring-2 ring-primary/30" : "border-border",
      ].join(" ")}
    >
      <StylePreview style={style} />
      <div className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{style.name}</p>
          <span className="text-[11px] text-muted-foreground">{style.sourceSkill}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            {[p.accent, p.accent2, p.text].map((c, i) => (
              <span
                key={i}
                className="size-3 rounded-full border border-black/10"
                style={{ background: c }}
              />
            ))}
            {active && (
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
               试穿中
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTryOn(style);
            }}
            className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
            style={{ background: `color-mix(in srgb, ${p.accent} 12%, transparent)`, color: ink }}
          >
            整页试穿
          </button>
        </div>
      </div>
    </div>
  );
}

/** 首页 AI 意图快速入口：输入后跳转 /workflow?intent=... 自动触发分析 */
function HomeIntentInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    // reset=1：明确「新开一个项目」，进入流程后清空上一次的历史状态，避免跳到旧步骤/残留旧字段
    router.push(`/workflow?intent=${encodeURIComponent(t)}&reset=1`);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
          rows={3}
          placeholder="描述你想做的东西，例如：想做一个销售 CRM 工作台，帮团队管线索和商机…"
          className="w-full resize-none bg-transparent px-5 py-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground"
        />
        <div className="pointer-events-none absolute bottom-4 right-5 text-xs text-muted-foreground">
          ⌘/Ctrl + ↵ 提交
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          AI 将自动匹配类型、技术栈、视觉风格与页面骨架
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href="/workflow" />}
            nativeButton={false}
            variant="outline"
            size="sm"
          >
            打开流程工作台
          </Button>
          <Button size="sm" onClick={submit} disabled={!value.trim()}>
            让 AI 解构 <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const titleFontSize = useFluidTitleFontSize();
  const titleLines = 2;
  const titleLineHeight = "1.15em";
  const titleLineHeightRatio = 1.15;
  const [tone, setTone] = useState<string>("all");
  const [active, setActive] = useState<{ style: VisualStyle; rect?: DOMRect } | null>(null);
  const [tryOn, setTryOn] = useState<VisualStyle | null>(null);

  // 滚动逐块入场：hero / 统计 / 工具箱依次 reveal
  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const blocks = gsap.utils.toArray<HTMLElement>(".reveal");
      blocks.forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 26,
          duration: 0.72,
          ease: "cubic-bezier(0.22, 1, 0.36, 1)",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            once: true,
          },
        });
      });

      // 卡片渲染以静态为主，避免 stagger 动画带来的"加载慢"体感。
      // hover 与 focus 的过渡仍保留在组件自身 transition 中。
    },
    { scope: rootRef },
  );

  // 试穿切换过渡：整页快速呼吸，强调换肤瞬间
  useGSAP(
    () => {
      const el = rootRef.current;
      if (!el) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        el,
        { opacity: 0.86 },
        {
          opacity: 1,
          duration: 0.4,
          ease: "power2.out",
          clearProps: "opacity",
        },
      );
    },
    { scope: rootRef, dependencies: [tryOn] },
  );

  /** 应用风格并进入目标工作台：写入 store 的 visualStyle 后跳转 */
  const applyAndGo = (
    style: VisualStyle,
    target: "builder" | "flow" = "builder",
  ) => {
    useFlowStore.getState().setVisualStyle(style.id);
    router.push(target === "flow" ? "/workflow" : "/builder");
  };

  const filtered = useMemo(() => {
    return VISUAL_STYLES.filter((s) => {
      if (tone === "light" && isDark(s.palette.bg)) return false;
      if (tone === "dark" && !isDark(s.palette.bg)) return false;
      return true;
    });
  }, [tone]);

  return (
    <div
      ref={rootRef}
      className="mx-auto xiye-container px-4 pb-36 pt-6 transition-colors duration-300 sm:pt-10"
      style={tryOn ? chromeVars(tryOn) : undefined}
    >
      {/* Hero */}
      <section className="reveal mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <Sparkles className="size-3.5" />
          原创预设与主流 UI 库，即选即用
        </span>
        <h1
          className="relative mt-5 w-full"
          style={{ height: `${titleFontSize * titleLineHeightRatio * titleLines + 24}px` }}
        >
          <span className="sr-only">你的下一个产品，从一行字开始</span>
          <FluidText
            text={"你的下一个产品\n从一行字开始"}
            color={theme === "dark" ? "#FFFFFF" : "#0F172A"}
            paletteColors={theme === "dark" ? FLUID_PALETTE_DARK : FLUID_PALETTE_LIGHT}
            splatRadius={6}
            splatForce={8}
            curl={40}
            densityDissipation={4}
            font={{
              fontSize: titleFontSize,
              fontWeight: 700,
              lineHeight: titleLineHeight,
              letterSpacing: "-0.02em",
              textAlign: "center",
            }}
            style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
          />
        </h1>
        <p className="relative mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          <span>{HERO_SUBTITLE}</span>
          {/* Shiny Pill 扫光：叠加一层同文案的高亮副本，用往复扫过的渐变蒙版露出高光 */}
          <span
            aria-hidden
            className="subtitle-shine pointer-events-none absolute inset-0 select-none text-primary"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 28%, #000 50%, transparent 72%)",
              maskImage:
                "linear-gradient(to right, transparent 28%, #000 50%, transparent 72%)",
              WebkitMaskSize: "150% auto",
              maskSize: "150% auto",
              animation: "subtitleShineSweep 2s linear infinite",
            }}
          >
            {HERO_SUBTITLE}
          </span>
        </p>

        {/* 首页 AI 意图入口：直接输入，跳转流程工作台自动分析 */}
        <div className="mx-auto mt-8 max-w-2xl">
          <HomeIntentInput />
        </div>
      </section>

      {/* 三步引导：新手也能一分钟上手 */}
      <section className="reveal mx-auto mt-12 max-w-4xl">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-5 sm:flex-row sm:items-center sm:justify-center sm:gap-5">
          {[
            { icon: Palette, title: "浏览风格", desc: "筛选 / 搜索 / 深浅分级" },
            { icon: Shirt, title: "整页试穿", desc: "hover 卡片或详情里一键换肤" },
            { icon: ArrowUpRight, title: "带入搭建", desc: "应用风格进页面搭建并导出" },
          ].map((s, i) => (
            <div key={s.title} className="flex items-center gap-3 sm:gap-5">
              {i > 0 && (
                <span aria-hidden className="hidden text-muted-foreground/60 sm:block">
                  →
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    <span className="mr-1 font-semibold text-primary">{i + 1}.</span>
                    {s.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 深浅筛选（仅保留 tone：group / 搜索已移除） */}
      <section className="reveal mt-16 flex justify-center">
        <div className="flex flex-wrap items-center gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTone(t.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                tone === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/60",
              ].join(" ")}
            >
              {t.name}
            </button>
          ))}
        </div>
      </section>

      {/* 风格画廊（入场由卡片逐张 stagger 承担，不再整块 reveal） */}
      <section className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-16 text-center">
            <p className="text-sm text-muted-foreground">没有匹配的风格，试试调整筛选条件。</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {filtered.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                active={tryOn?.id === style.id}
                onSelect={(s, rect) => setActive({ style: s, rect })}
                onTryOn={setTryOn}
              />
            ))}
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          共 {filtered.length} 个风格 · 点击卡片看详情，hover 卡片可「整页试穿」
        </p>
      </section>

      {active && (
        <StyleDialog
          style={active.style}
          anchorRect={active.rect}
          onClose={() => setActive(null)}
          onTryOn={setTryOn}
          onApply={applyAndGo}
        />
      )}

      {/* 试穿中的浮动胶囊 */}
      {tryOn && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div
            className={[
              "flex items-center gap-2 rounded-full border px-2 py-1 shadow-lg backdrop-blur sm:gap-3 sm:px-3",
              "border-border bg-card/95",
            ].join(" ")}
          >
            <span
              className="size-3 rounded-full border border-black/10"
              style={{ background: tryOn.palette.accent }}
            />
            <span className="text-xs font-medium text-foreground">
              整页试穿：{tryOn.name}
            </span>
            <button
              type="button"
              onClick={() => setTryOn(null)}
              className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <X className="size-3" /> 退出
            </button>
          </div>
        </div>
      )}

      <style>{`
        .modal-panel-enter { animation: xiye-modal-in 0.22s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes xiye-modal-in {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: none; }
        }
        @keyframes subtitleShineSweep {
          0% { -webkit-mask-position: 200%; mask-position: 200%; }
          100% { -webkit-mask-position: -100%; mask-position: -100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .subtitle-shine { animation: none !important; mask-image: none !important; -webkit-mask-image: none !important; }
        }
      `}</style>
    </div>
  );
}