"use client";

// 组件预览渲染器：把「变体」可视化渲染（视觉风格 palette 贯穿）。
// 用法：外层容器注入 CSS 变量（--primary/--surface/...），预览内部元素与
// 变体的 TSX code 写法一致（var(--primary) 等），保证「预览 = 代码效果」。

import { useState, useRef, useEffect, useMemo, createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { VisualStyle } from "@/data/visual-styles";
import { DEMO_CONTENT, type DemoContent } from "@/data/skeleton-content";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { deepMerge } from "@/lib/content-resolver";
import { resolveStyleVars, cssToVars } from "@/lib/style-resolver";
import { Selectable } from "@/components/selectable";
import { findButtonStyle } from "@/lib/button-styles";
import ButtonResource from "@/components/originkit/ui/button-resource";
import {
  RADIUS_TOKENS,
  DENSITY_TOKENS,
  TYPE_SCALE_TOKENS,
  SHADOW_TOKENS,
} from "@/data/design-tokens";
import type { DesignSystem } from "@/lib/store/flow-store";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { premiumImage, resolvePlaceholder, type PlaceholderRole } from "@/lib/placeholder-images";
import { Zap, ShieldCheck, Blocks, Mail, Phone, MapPin, FileText, PenLine, BarChart3, Code } from "lucide-react";

// 精选占位图池：按区块角色取图——签名视觉走精图层，量大场景走摩雷大池（见 lib/placeholder-images.ts）。
const ph = (role: PlaceholderRole, idx: number, w?: number, h?: number) =>
  resolvePlaceholder(role, idx, w || h ? { w: w ?? undefined, h: h ?? undefined } : {});

// 预览器实时内容：默认 DEMO_CONTENT，ComponentPreview 渲染时按面板覆盖更新。
let PREVIEW_CONTENT: DemoContent = DEMO_CONTENT;

/** 归一化 logos 为品牌名字符串数组：兼容数组、键名/值均为字符串的对象，避免自定义内容深浅合并后形状漂移导致 .slice 报错。 */
function getBrands(): string[] {
  const raw = (PREVIEW_CONTENT as unknown as Record<string, unknown>).logos;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (raw && typeof raw === "object") {
    const vals = Object.values(raw as Record<string, unknown>);
    const strVals = vals.filter((v): v is string => typeof v === "string");
    return strVals.length ? strVals : Object.keys(raw as object);
  }
  return [];
}

export function styleVars(
  style: VisualStyle,
  designSystem?: import("@/lib/store/flow-store").DesignSystem | null,
): CSSProperties {
  return resolveStyleVars(style, designSystem);
}

/**
 * 设计 Token → 预览标记 的「作用域化桥接样式」。
 * 预览组件大量使用 Tailwind 内建工具类（rounded-2xl / text-3xl / space-y-4 / shadow-md），
 * 本身不消费 --radius/--text-hN/--space-N/--shadow 变量，改 Token 看不到变化。
 * 这里把最常用的工具类重映射到设计系统变量，仅在 Token 被显式设置时注入，
 * 默认状态（全部跟随风格）不注入 → 预览像素不变。
 * 仅作用于 .dtox-root 作用域，不干扰构建器外壳与胶囊按钮（rounded-full 特意保留）。
 */
export function designTokenBridgeCss(ds?: DesignSystem | null): string {
  if (!ds) return "";
  let css = "";

  // 圆角：把常用的圆形进度径扩展到该级圆形度。rounded-full 不动，保留胶囊/徽章造型。
  if (ds.radius) {
    const radius = RADIUS_TOKENS.find((r) => r.id === ds.radius)?.preview;
    if (radius) {
      const scale: Array<[string, string]> = [
        ["rounded-sm", "0.5"],
        ["rounded", "1"],
        ["rounded-md", "1"],
        ["rounded-lg", "1.25"],
        ["rounded-xl", "1.5"],
        ["rounded-2xl", "1.75"],
      ];
      for (const [cls, mul] of scale) css += `.dtox-root .${cls}{border-radius:calc(${radius} * ${mul}) !important;}`;
    }
  }

  // 字号层级：仅覆盖大标题等级，密集的小字（text-xs/sm）保持不动以免拥挤。
  if (ds.type) {
    const vars = cssToVars(
      TYPE_SCALE_TOKENS.find((t) => t.id === ds.type)?.css ?? "",
    );
    const map: Array<[string, string]> = [
      ["text-4xl", "--text-display"],
      ["text-3xl", "--text-h1"],
      ["text-2xl", "--text-h2"],
      ["text-xl", "--text-h3"],
      ["text-lg", "--text-h4"],
    ];
    for (const [cls, varName] of map) {
      if (vars[varName]) css += `.dtox-root .${cls}{font-size:${vars[varName]} !important;}`;
    }
  }

  // 间距密度：常用整数级 space/gap/p 映射到 --space-*。
  if (ds.density) {
    const vars = cssToVars(
      DENSITY_TOKENS.find((d) => d.id === ds.density)?.css ?? "",
    );
    const spaceY: Array<[string, string]> = [
      ["space-y-1", "--space-1"],
      ["space-y-2", "--space-2"],
      ["space-y-3", "--space-3"],
      ["space-y-4", "--space-4"],
      ["space-y-6", "--space-6"],
    ];
    const gap: Array<[string, string]> = [
      ["gap-1", "--space-1"],
      ["gap-2", "--space-2"],
      ["gap-3", "--space-3"],
      ["gap-4", "--space-4"],
      ["gap-6", "--space-6"],
    ];
    const pad: Array<[string, string]> = [
      ["p-1", "--space-1"],
      ["p-2", "--space-2"],
      ["p-3", "--space-3"],
      ["p-4", "--space-4"],
      ["p-6", "--space-6"],
      ["px-2", "--space-2"],
      ["px-3", "--space-3"],
      ["px-4", "--space-4"],
      ["px-6", "--space-6"],
      ["py-1", "--space-1"],
      ["py-2", "--space-2"],
      ["py-3", "--space-3"],
      ["py-4", "--space-4"],
      ["py-6", "--space-6"],
    ];
    for (const [cls, varName] of spaceY) {
      if (vars[varName])
        css += `.dtox-root .${cls} > :not([hidden]) ~ :not([hidden]){margin-top:${vars[varName]} !important;}`;
    }
    for (const [cls, varName] of gap) {
      if (vars[varName]) css += `.dtox-root .${cls}{gap:${vars[varName]} !important;}`;
    }
    for (const [cls, varName] of pad) {
      if (vars[varName]) {
        const prop =
          cls.startsWith("px")
            ? "padding-left"
            : cls.startsWith("py")
              ? "padding-top"
              : "padding";
        css += `.dtox-root .${cls}{${prop}:${vars[varName]} !important;}${cls.startsWith("px") ? `.dtox-root .${cls}{padding-right:${vars[varName]} !important;}` : cls.startsWith("py") ? `.dtox-root .${cls}{padding-bottom:${vars[varName]} !important;}` : ""}`;
      }
    }
  }

  // 阴影层级：工具类阴影映射到 --shadow；内联 boxShadow 保留原样。
  if (ds.shadow) {
    const shadow = SHADOW_TOKENS.find((s) => s.id === ds.shadow)?.css.match(/--shadow:\s*([^;]+);/)?.[1];
    if (shadow) {
      for (const cls of ["shadow-sm", "shadow", "shadow-md", "shadow-lg", "shadow-xl"]) {
        css += `.dtox-root .${cls}{box-shadow:${shadow} !important;}`;
      }
    }
  }

  return css;
}

/** 当前组件选中的主 CTA 按钮样式 id；null/缺省 = 实心默认 */
const CtaStyleContext = createContext<string | null>(null);
export function useCtaStyle() {
  return useContext(CtaStyleContext);
}
export function CtaStyleProvider({ value, children }: { value: string | null; children: React.ReactNode }) {
  return <CtaStyleContext.Provider value={value}>{children}</CtaStyleContext.Provider>;
}

/** 图片占位：默认渲染中性色块；传入 src 时渲染真实图片（取用精选占位图池，见 lib/placeholder-images.ts） */
function Img({ label = "图片", src }: { label?: string; src?: string }) {
  if (src)
    return (
      <Selectable label="图片">
        <img src={src} alt={label} loading="lazy" className="w-full rounded-[var(--radius)] object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
      </Selectable>
    );
  return (
    <Selectable label="图片">
      <div
        className="flex h-full min-h-24 w-full items-center justify-center rounded-[var(--radius)] text-xs"
        style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)", color: "var(--muted-foreground)" }}
      >
        {label}
      </div>
    </Selectable>
  );
}

/** 加载骨架占位：shimmer 扫光动画（loading 态用） */
function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={"relative overflow-hidden rounded-md " + className}
      style={{ background: "color-mix(in srgb, var(--muted-foreground) 10%, transparent)" }}
    >
      <div className="absolute inset-0 [animation:shimmerSweep_1.4s_linear_infinite]" style={{ background: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--surface) 70%, transparent), transparent)" }} />
      <style>{`@keyframes shimmerSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }`}</style>
    </div>
  );
}

/** 光斑描边卡：hover 时边框泛主色光 + 内部光斑跟随鼠标 */
function SpotlightCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [hover, setHover] = useState(false);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <Selectable label="卡片">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={"relative overflow-hidden rounded-[var(--radius)] border transition-all duration-300 " + className}
        style={{
          borderColor: hover ? "color-mix(in srgb, var(--primary) 45%, var(--border))" : "var(--border)",
          background: "var(--surface)",
          boxShadow: hover ? "0 0 0 1px color-mix(in srgb, var(--primary) 18%, transparent), 0 18px 44px -20px color-mix(in srgb, var(--primary) 30%, transparent)" : "none",
        }}
      >
        <span
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{ opacity: hover ? 1 : 0, background: `radial-gradient(150px circle at ${pos.x}% ${pos.y}%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 65%)` }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    </Selectable>
  );
}

/** 统一区块眉标：主色 pill，Hero / Features(SHead) / Testimonials(THead) 共用同一语言 */
function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]"
      style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}
    >
      {children}
    </span>
  );
}

/** 渐变图标泡：主色线性渐变底 + 主色图标，落地页营销图标的统一语言 */
function SFIcon({ icon, className = "", size = "size-9" }: { icon: React.ReactNode; className?: string; size?: string }) {
  return (
    <div
      className={"flex shrink-0 items-center justify-center rounded-[var(--radius)] text-sm " + size + " " + className}
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 16%, transparent), color-mix(in srgb, var(--primary) 3%, transparent))", color: "var(--primary)" }}
    >
      {icon}
    </div>
  );
}

/** 统一区块标题头：眉标(pill) + 大标题 + 副标题，四要素之一 */
function SectionHead({ badge, title, sub, center = false }: { badge: string; title: string; sub?: string; center?: boolean }) {
  return (
    <div className={center ? "text-center" : ""}>
      <SectionBadge>{badge}</SectionBadge>
      <h3 className="mt-2.5 text-lg font-bold tracking-tight">{title}</h3>
      {sub ? <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{sub}</p> : null}
    </div>
  );
}

/** 预览轮播：横向滚动 + scroll-snap 吸附 + 左右箭头 + 可拖动，真实交互 */
function Carousel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canL, setCanL] = useState(false);
  const [canR, setCanR] = useState(true);
  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setCanL(el.scrollLeft > 4);
    setCanR(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };
  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    return () => el.removeEventListener("scroll", sync);
  }, []);
  const step = () => ref.current?.clientWidth ?? 320;
  const btn =
    "absolute top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition hover:bg-muted";
  return (
    <div className={"relative " + className}>
      <div ref={ref} className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]">
        {children}
      </div>
      {canL && (
        <button aria-label="上一个" type="button" onClick={() => ref.current?.scrollBy({ left: -step(), behavior: "smooth" })} className={btn + " -left-2"} style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          ‹
        </button>
      )}
      {canR && (
        <button aria-label="下一个" type="button" onClick={() => ref.current?.scrollBy({ left: step(), behavior: "smooth" })} className={btn + " -right-2"} style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          ›
        </button>
      )}
    </div>
  );
}

const Btn = ({
  children,
  primary = false,
  glow = false,
  className = "",
}: {
  children: React.ReactNode;
  primary?: boolean;
  glow?: boolean;
  className?: string;
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const ctaDef = findButtonStyle(useCtaStyle());
  let btnClass = [
    "relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-[var(--radius)] px-3.5 py-1.5 text-xs font-medium transition-all duration-200 active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]",
    className,
  ].join(" ");
  if (primary && ctaDef.id !== "solid") {
    if (ctaDef.round) btnClass = btnClass.replace(ctaDef.round.from, ctaDef.round.to);
    if (ctaDef.className) btnClass += " " + ctaDef.className;
  }
  if (primary && ctaDef.component) {
    const label = typeof children === "string" ? children : undefined;
    return (
      <Selectable label="按钮" display="inline-flex">
        <div className="inline-flex max-w-full items-center justify-center overflow-hidden py-1">
          <ButtonResource style={ctaDef.component} label={label} fontSize={16} />
        </div>
      </Selectable>
    );
  }
  return (
    <Selectable label="按钮" display="inline-flex">
      <button
        ref={ref}
        type="button"
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={btnClass}
        style={
          primary
            ? ({
                ...(ctaDef.id === "solid"
                  ? { background: "var(--primary)", color: "#fff" }
                  : ctaDef.preview),
                transform: hover ? `translate(${(pos.x - 32) * 0.12}px, ${(pos.y - 12) * 0.12}px)` : undefined,
              } as React.CSSProperties)
            : {
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                transform: hover ? `translate(${(pos.x - 32) * 0.12}px, ${(pos.y - 12) * 0.12}px)` : undefined,
              }
        }
      >
        {glow && hover && (
          <span
            className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: pos.x,
              top: pos.y,
              background: "radial-gradient(circle, rgba(255,255,255,0.45), transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        )}
        <span className="relative z-10">{children}</span>
      </button>
    </Selectable>
  );
};

const Card = ({
  children,
  className = "",
  interactive = true,
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [hover, setHover] = useState(false);
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <Selectable label="卡片">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={[
          "relative rounded-[var(--radius)] border p-[var(--space-4)] shadow-[var(--shadow)] transition-all duration-200",
          interactive ? "hover:-translate-y-0.5" : "",
          className,
        ].join(" ")}
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          boxShadow: hover
            ? "0 14px 34px -16px color-mix(in srgb, var(--primary) 32%, transparent)"
            : "var(--shadow)",
        }}
      >
        {interactive && (
          <span
            className="pointer-events-none absolute inset-0 rounded-[var(--radius)] transition-opacity duration-200"
            style={{
              opacity: hover ? 1 : 0,
              background: `radial-gradient(200px circle at ${pos.x}% ${pos.y}%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 60%)`,
            }}
          />
        )}
        <div className="relative z-10">{children}</div>
      </div>
    </Selectable>
  );
};

/** 导航链接：hover 下划线滑入 + opacity 提升 */
const NavLink = ({ children }: { children: React.ReactNode }) => (
  <span className="group/navlink relative cursor-pointer pb-0.5 text-xs opacity-70 transition-opacity duration-200 hover:opacity-100 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-[var(--primary)] after:transition-all after:duration-300 hover:after:w-full">
    {children}
  </span>
);

export function ComponentPreview({
  componentId,
  variantId,
  style,
}: {
  componentId: string;
  variantId: string;
  style: VisualStyle;
}) {
  // 预览内容跟随「项目文案」面板（默认 DEMO_CONTENT，覆盖真实内容）。
  const content = useSkeletonStore((s) => s.content);
  PREVIEW_CONTENT = deepMerge(DEMO_CONTENT, content);
  switch (componentId) {
    case "navbar":
      return <NavbarPreview variantId={variantId} />;
    case "hero":
      return <HeroPreview variantId={variantId} />;
    case "features":
      return <FeaturesPreview variantId={variantId} />;
    case "faq":
      return <FaqPreview variantId={variantId} />;
    case "cta":
      return <CtaPreview variantId={variantId} />;
    case "footer":
      return <FooterPreview variantId={variantId} />;
    case "logos":
      return <LogosPreview variantId={variantId} />;
    case "stats":
      return <StatsPreview variantId={variantId} />;
    case "testimonials":
      return <TestimonialsPreview variantId={variantId} />;
    case "pricing":
      return <PricingPreview variantId={variantId} />;
    case "home-process":
      return <ProcessPreview variantId={variantId} />;
    case "home-integrations":
      return <IntegrationsPreview variantId={variantId} />;
    case "home-contact":
      return <ContactPreview variantId={variantId} />;
    case "pricing-tiers":
      return <PricingTiersPreview variantId={variantId} />;
    case "pricing-compare":
      return <PricingComparePreview variantId={variantId} />;
    case "pricing-faq":
      return <FaqPreview variantId={variantId} />;
    case "auth-login":
      return <AuthLoginPreview variantId={variantId} />;
    case "auth-social":
      return <AuthSocialPreview variantId={variantId} />;
    case "auth-split":
      return <AuthSplitPreview variantId={variantId} />;
    case "auth-signup":
      return <AuthSignupPreview variantId={variantId} />;
    case "dash-sidebar":
      return <DashSidebarPreview variantId={variantId} />;
    case "dash-kpi":
      return <DashKpiPreview variantId={variantId} />;
    case "dash-chart":
      return <DashChartPreview variantId={variantId} />;
    case "dash-list":
      return <DashListPreview variantId={variantId} />;
    case "dash-topbar":
      return <DashTopbarPreview variantId={variantId} />;
    case "dash-table":
      return <DashTablePreview variantId={variantId} />;
    case "dash-tasks":
      return <DashTasksPreview variantId={variantId} />;
    case "dash-notifications":
      return <DashNotificationsPreview variantId={variantId} />;
    case "dash-tabs":
      return <DashTabsPreview variantId={variantId} />;
    case "dash-filters":
      return <DashFiltersPreview variantId={variantId} />;
    case "dash-statstrip":
      return <DashStatstripPreview variantId={variantId} />;
    case "dash-permissions":
      return <DashPermissionsPreview variantId={variantId} />;
    case "dash-gauges":
      return <DashGaugesPreview variantId={variantId} />;
    case "dash-activity":
      return <DashActivityPreview variantId={variantId} />;
    case "dash-transfer":
      return <DashTransferPreview variantId={variantId} />;
    case "portfolio-grid":
      return <PortfolioGridPreview variantId={variantId} />;
    case "portfolio-case":
      return <PortfolioCasePreview variantId={variantId} />;
    case "portfolio-about":
      return <PortfolioAboutPreview variantId={variantId} />;
    case "portfolio-ring":
      return <PortfolioRingPreview variantId={variantId} />;
    case "blog-list":
      return <BlogListPreview variantId={variantId} />;
    case "blog-post":
      return <BlogPostPreview variantId={variantId} />;
    case "blog-tags":
      return <BlogTagsPreview variantId={variantId} />;
    case "product-gallery":
      return <ProductGalleryPreview variantId={variantId} />;
    case "product-info":
      return <ProductInfoPreview variantId={variantId} />;
    case "product-grid":
      return <ProductGridPreview variantId={variantId} />;
    case "product-cart":
      return <ProductCartPreview variantId={variantId} />;
    case "about-story":
      return <AboutStoryPreview variantId={variantId} />;
    case "about-team":
      return <AboutTeamPreview variantId={variantId} />;
    case "about-values":
      return <AboutValuesPreview variantId={variantId} />;
    case "contact-form":
      return <ContactFormPreview variantId={variantId} />;
    case "contact-info":
      return <ContactInfoPreview variantId={variantId} />;
    case "contact-faq":
      return <ContactFaqPreview variantId={variantId} />;
    case "misc-404":
      return <Misc404Preview variantId={variantId} />;
    case "misc-coming":
      return <MiscComingPreview variantId={variantId} />;
    case "docs-nav":
      return <DocsNavPreview variantId={variantId} />;
    case "docs-content":
      return <DocsContentPreview variantId={variantId} />;
    case "docs-search":
      return <DocsSearchPreview variantId={variantId} />;
    case "chat-window":
      return <ChatWindowPreview variantId={variantId} />;
    case "chat-input":
      return <ChatInputPreview variantId={variantId} />;
    case "chat-suggest":
      return <ChatSuggestPreview variantId={variantId} />;
    case "loader-feedback":
      // 加载反馈单组件：7 个加载效果以变体承载
      switch (variantId) {
        case "fb_spinner_ring":
          return <LoaderSpinnerPreview variantId={variantId} />;
        case "fb_progress_linear":
          return <LoaderProgressPreview variantId={variantId} />;
        case "fb_circular_ring":
          return <LoaderCircularPreview variantId={variantId} />;
        case "fb_skeleton_lines":
          return <LoaderSkeletonPreview variantId={variantId} />;
        case "fb_shimmer_sweep":
          return <LoaderShimmerPreview variantId={variantId} />;
        case "fb_button_spin":
          return <LoaderButtonPreview variantId={variantId} />;
        case "fb_page_center":
          return <LoaderPagePreview variantId={variantId} />;
        default:
          return <LoaderSpinnerPreview variantId={variantId} />;
      }
    default:
      return (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          该组件的变体预览待补充
        </div>
      );
  }
}

/* ───────── Navbar ───────── */
/** 区块预览兜底：当前函数未匹配到已知变体时渲染该卡，避免整块空白 */
function PreviewFallback({ title }: { title: string }) {
  const label = title.replace(/Preview$/, "");
  return (
    <div className="flex h-40 items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="max-w-xs rounded-xl border border-dashed px-6 py-5 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>可在面板顶部切换该区块的样式变体</p>
      </div>
    </div>
  );
}
function NavbarPreview({ variantId }: { variantId: string }) {
  const links = ["功能", PREVIEW_CONTENT.nav.pricing, PREVIEW_CONTENT.nav.faq];
  const inner = (
    <>
      <span className="text-sm font-bold">{PREVIEW_CONTENT.brand}</span>
      <div className="hidden items-center gap-5 text-xs opacity-70 sm:flex">
        {links.map((l) => <NavLink key={l}>{l}</NavLink>)}
      </div>
      <Btn primary glow>{PREVIEW_CONTENT.cta.primary}</Btn>
    </>
  );
  if (variantId === "nav_transparent")
    return (
      <div className="relative flex items-center justify-between px-5 py-3.5">
        {inner}
      </div>
    );
  if (variantId === "nav_dark")
    return (
      <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-slate-50">
        {inner}
      </div>
    );
  if (variantId === "nav_mega")
    return (
      <div className="relative flex items-center justify-between border-b px-5 py-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <span className="text-sm font-bold">{PREVIEW_CONTENT.brand}</span>
        <div className="hidden items-center gap-5 text-xs opacity-70 sm:flex">
          <span className="cursor-default">产品 ▾</span>
          <NavLink>{PREVIEW_CONTENT.nav.pricing}</NavLink>
          <NavLink>{PREVIEW_CONTENT.nav.faq}</NavLink>
        </div>
        <Btn primary glow>{PREVIEW_CONTENT.cta.primary}</Btn>
        <div className="absolute left-16 top-full mt-1 w-56 rounded-xl border p-3 shadow-lg" style={{ borderColor: "var(--border)", background: "var(--surface)", animation: "megaIn 0.4s cubic-bezier(0.16,1,0.3,1)" }}>
          <div className="grid grid-cols-2 gap-2">
            {["分析", "自动化", "协作", "集成"].map((f, i) => (
              <div key={f} className="rounded-md px-2 py-1.5 text-[10px] font-medium" style={{ background: "var(--background)", animation: "megaItem 0.4s cubic-bezier(0.16,1,0.3,1) both", animationDelay: 0.06 * i + "s" }}>{f}</div>
            ))}
          </div>
          <span className="mt-2 block text-center text-[9px] font-medium" style={{ color: "var(--primary)" }}>查看全部功能 →</span>
        </div>
        <style>{`@keyframes megaIn { from { opacity: 0; transform: translateY(-8px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes megaItem { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    );
  if (variantId === "nav_minimal")
    return (
      <div className="border-b px-5 py-3 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <span className="text-sm font-semibold tracking-tight">{PREVIEW_CONTENT.brand}</span>
        <div className="mt-1.5 flex justify-center gap-5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span>功能</span>
          <span>{PREVIEW_CONTENT.nav.pricing}</span>
          <span>{PREVIEW_CONTENT.nav.faq}</span>
        </div>
      </div>
    );
  if (variantId === "nav_floating_island")
    return (
      <div className="flex justify-center px-6 pt-6">
        <div className="flex w-max items-center gap-5 rounded-full border px-4 py-2" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(16px)", boxShadow: "0 12px 40px -12px rgba(0,0,0,0.18)" }}>
          <span className="text-xs font-bold">{PREVIEW_CONTENT.brand}</span>
          <div className="hidden items-center gap-4 text-[10px] opacity-70 sm:flex">
            <span>功能</span>
            <span>{PREVIEW_CONTENT.nav.pricing}</span>
            <span>{PREVIEW_CONTENT.nav.faq}</span>
          </div>
          <span className="rounded-full px-3 py-1 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.primary}</span>
          <span className="flex size-6 flex-col items-center justify-center gap-[3px] sm:hidden">
            <span className="h-px w-3.5" style={{ background: "var(--foreground)" }} />
            <span className="h-px w-3.5" style={{ background: "var(--foreground)" }} />
          </span>
        </div>
      </div>
    );
  if (variantId === "nav_solid")
    return (
      <div
        className="relative flex items-center justify-between px-5 py-3.5"
        style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", boxShadow: "0 8px 22px -20px rgba(0,0,0,0.5)" }}
      >
        <span className="flex items-center gap-1.5 text-sm font-bold">
          <span className="flex size-5 items-center justify-center rounded-md text-[9px] font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.brand.slice(0, 1)}</span>
          {PREVIEW_CONTENT.brand}
        </span>
        <div className="hidden items-center gap-1 sm:flex">
          {links.map((l, i) => (
            <span
              key={l}
              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={i === 0 ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}
            >
              {l}
            </span>
          ))}
        </div>
        <Btn primary glow>{PREVIEW_CONTENT.cta.primary}</Btn>
      </div>
    );
  // blur 毛玻璃（solid 已单独实现，此处兜底）
  return (
    <div
      className="relative flex items-center justify-between border-b px-5 py-3.5"
      style={
        variantId === "nav_blur"
          ? { borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(12px)" }
          : { borderColor: "var(--border)", background: "var(--surface)" }
      }
    >
      {inner}
    </div>
  );
}

/* ───────── Hero ───────── */
function HeroPreview({ variantId }: { variantId: string }) {
  const hero = PREVIEW_CONTENT.hero;
  if (variantId === "hero_center")
    return (
      <div className="px-6 py-8 text-center">
        <SectionBadge>{hero.badge || "✨ 全新 AI 功能上线"}</SectionBadge>
        <h3 className="mx-auto mt-3 max-w-md text-[length:var(--text-h3)] font-bold leading-snug tracking-tight">把想法变成产品，快 10 倍</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-xs" style={{ color: "var(--muted-foreground)" }}>无需代码，从骨架到上线，几分钟完成可用原型。</p>
        <div className="mt-5 flex justify-center gap-2">
          <Btn primary glow>{PREVIEW_CONTENT.cta.primary}</Btn>
          <Btn>查看演示</Btn>
        </div>
        <div className="group mx-auto mt-5 max-w-xl overflow-hidden rounded-xl border shadow-sm" style={{ borderColor: "var(--border)" }}>
          <Img label="产品截图" src={ph("hero", 0, 1200)} />
        </div>
      </div>
    );
  if (variantId === "hero_left")
    return (
      <div className="grid items-center gap-6 px-6 py-8 md:grid-cols-2">
        <div>
          <SectionBadge>企业级平台</SectionBadge>
          <h3 className="mt-3 text-[length:var(--text-h3)] font-bold">让团队协作更高效</h3>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>一体化工作台：项目、任务、{PREVIEW_CONTENT.nav.docs}、看板。</p>
          <div className="mt-3 flex gap-2"><Btn primary glow>{PREVIEW_CONTENT.cta.secondary}</Btn><Btn>预约演示</Btn></div>
        </div>
        <div className="rounded-xl border p-1.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <Img label="产品界面" src={ph("hero", 1, 1000)} />
        </div>
      </div>
    );
  if (variantId === "hero_split")
    return (
      <div className="grid min-h-56 grid-cols-2">
        <div className="flex items-center px-5">
          <div>
            <SectionBadge>设计与技术</SectionBadge>
            <h3 className="mt-3 text-lg font-bold leading-snug">设计驱动的前沿品牌</h3>
            <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>用设计与技术讲好品牌故事。</p>
            <div className="mt-3 flex gap-2"><Btn primary glow>联系我们</Btn><Btn>查看作品</Btn></div>
          </div>
        </div>
        <div className="flex items-center justify-center bg-gradient-to-br from-[color-mix(in_srgb,var(--primary)_35%,transparent)] to-[color-mix(in_srgb,var(--secondary)_40%,transparent)]">
          <Img label="品牌视觉" src={ph("brand", 2, 900)} />
        </div>
      </div>
    );
  if (variantId === "hero_glass")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--background)), color-mix(in srgb, var(--secondary) 15%, var(--background)))" }}>
        <div className="max-w-sm rounded-2xl border p-6 text-center" style={{ background: "color-mix(in srgb, var(--surface) 60%, transparent)", borderColor: "var(--border)", backdropFilter: "blur(20px)" }}>
          <SectionBadge>玻璃质感</SectionBadge>
          <h3 className="mt-3 text-lg font-bold">轻盈而强大的产品体验</h3>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>玻璃拟态风格，通透现代。</p>
          <div className="mt-3 flex justify-center gap-2"><Btn primary glow>开始体验</Btn><Btn>{PREVIEW_CONTENT.cta.secondary}</Btn></div>
        </div>
      </div>
    );
  if (variantId === "hero_gradient")
    return (
      <div className="px-6 py-10 text-center text-white" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white" style={{ borderColor: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.14)" }}>智能驱动</span>
        <h3 className="mt-3 text-[length:var(--text-h3)] font-bold">开启你的数字之旅</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/80">从零到一，用科技和创意点亮你的品牌。</p>
        <div className="mt-4 flex justify-center gap-2">
          <span className="inline-block cursor-pointer rounded-md bg-white px-3.5 py-1.5 text-xs font-medium text-slate-900 transition-transform duration-200 hover:-translate-y-0.5">{PREVIEW_CONTENT.cta.primary}</span>
          <span className="inline-block cursor-pointer rounded-md border border-white/60 px-3.5 py-1.5 text-xs font-medium text-white transition-transform duration-200 hover:-translate-y-0.5">{PREVIEW_CONTENT.cta.secondary}</span>
        </div>
      </div>
    );
  if (variantId === "hero_dual_cta")
    return (
      <div className="px-6 py-10 text-center">
        <SectionBadge>增长引擎</SectionBadge>
        <h3 className="mt-3 text-[length:var(--text-h3)] font-bold tracking-tight">你的增长引擎，从这里开始</h3>
        <p className="mx-auto mt-1.5 max-w-sm text-xs" style={{ color: "var(--muted-foreground)" }}>加入 50,000+ 团队，用数据驱动每个决策。</p>
        <div className="mt-4 flex justify-center gap-2"><Btn primary glow>免费注册 →</Btn><Btn>观看演示</Btn></div>
        <div className="mt-4 flex justify-center gap-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span className="text-amber-400">★★★★★</span><span className="font-semibold" style={{ color: "var(--foreground)" }}>4.9/5</span><span>·</span><span>50k+ 用户</span><span>·</span><span>SOC2 认证</span>
        </div>
      </div>
    );
  if (variantId === "hero_video")
    return (
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-xl px-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 28%, var(--background)), color-mix(in srgb, var(--secondary) 34%, var(--background)))" }}>
        <div aria-hidden className="absolute inset-0 opacity-20 [background-image:radial-gradient(var(--foreground)_1px,transparent_1px)] [background-size:18px_18px]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 to-black/10" />
        <div className="relative z-10 max-w-md text-center text-white">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/90" style={{ borderColor: "rgba(255,255,255,0.4)", background: "rgba(255,255,255,0.14)" }}>第一视角</span>
          <div className="mx-auto mt-4 flex size-12 items-center justify-center rounded-full border border-white/40 bg-white/10 backdrop-blur">
            <span className="ml-0.5 text-sm">▶</span>
          </div>
          <h3 className="mt-3 text-[length:var(--text-h4)] font-bold">感受真正的身临其境</h3>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/80">用视频把产品体验讲给你听——第一视角，一目了然。</p>
          <span className="mt-3 inline-block cursor-pointer rounded-md bg-white px-4 py-1.5 text-xs font-medium text-slate-900 transition-transform duration-200 hover:-translate-y-0.5">{PREVIEW_CONTENT.cta.primary}</span>
        </div>
      </div>
    );
  if (variantId === "hero_bento")
    return (
      <div className="grid items-center gap-6 px-6 py-8 md:grid-cols-2">
        <div>
          <SectionBadge>一体化工作台</SectionBadge>
          <h3 className="mt-3 text-[length:var(--text-h3)] font-bold leading-snug">把分散的工具，收进一个清爽的空间</h3>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>邮件、消息、任务、文档——结构化呈现。</p>
          <div className="mt-3 flex gap-2"><Btn primary glow>免费开始</Btn><Btn>看演示</Btn></div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { t: "统一收件箱", d: "一处聚合" },
            { t: "AI 摘要", d: "长文提炼" },
            { t: "快捷命令", d: "Cmd+K" },
            { t: "实时同步", d: "多端秒级" },
          ].map((b) => (
            <SpotlightCard key={b.t} className="p-3">
              <p className="text-xs font-semibold">{b.t}</p>
              <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{b.d}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>
    );
  if (variantId === "hero_editorial")
    return (
      <div className="grid gap-6 px-6 py-8 md:grid-cols-12">
        <div className="md:col-span-7">
          <SectionBadge>设计驱动的工作室</SectionBadge>
          <h3 className="mt-3 text-2xl font-bold leading-[1.08] sm:text-3xl">我们替你把复杂，<br />讲成简单。</h3>
        </div>
        <div className="md:col-span-5 md:border-l md:pl-6" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>从策略到交付，一支团队、一条主线。</p>
          <div className="mt-3 space-y-2 text-xs">
            {[["服务", "品牌 / 网站 / 产品"], ["周期", "2–6 周"], ["客户", "120+ 团队"]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--muted-foreground)" }}>{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
          <span className="mt-3 inline-block rounded-full px-4 py-1.5 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>开启合作</span>
        </div>
      </div>
    );
  if (variantId === "hero_morphgradient")
    return (
      <div
        className="relative flex h-44 w-full flex-col items-center justify-start overflow-hidden px-8 pt-10"
        style={{
          background:
            "radial-gradient(55% 60% at 20% 0%, color-mix(in srgb, var(--primary) 30%, transparent), transparent), radial-gradient(50% 55% at 100% 10%, color-mix(in srgb, var(--secondary) 26%, transparent), transparent), radial-gradient(80% 70% at 50% 100%, color-mix(in srgb, var(--accent2, var(--primary)) 20%, transparent), transparent), var(--background)",
        }}
      >
        <div className="max-w-sm text-center">
          <SectionBadge>克制美学</SectionBadge>
          <h3 className="mt-3 text-xl font-bold leading-tight">安静，却足够有力</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm" style={{ color: "var(--muted-foreground)" }}>
            少即是多。把克制，做成一种产品力。
          </p>
          <span
            className="mt-5 inline-block rounded-full px-6 py-2 text-sm font-medium text-white"
            style={{ background: "var(--primary)" }}
          >
            了解更多
          </span>
        </div>
      </div>
    );
  // 兜底：未知变体时渲染首屏默认，避免预览区空白
  return (
    <div className="px-6 py-8 text-center">
      <SectionBadge>{hero.badge}</SectionBadge>
      <h3 className="mx-auto mt-3 max-w-md text-[length:var(--text-h3)] font-bold leading-snug tracking-tight">{hero.heading}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-xs" style={{ color: "var(--muted-foreground)" }}>{hero.subheading}</p>
      <div className="mt-4 flex justify-center gap-2">
        <Btn primary glow>{PREVIEW_CONTENT.cta.primary}</Btn>
        <Btn>{PREVIEW_CONTENT.cta.secondary}</Btn>
      </div>
    </div>
  );
}

/* ───────── Features ───────── */
/** 轻微 3D 倾斜卡：随鼠标 perspective 旋转（克制 ±8°），极简高级 hover 触感 */
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState({ rx: 0, ry: 0 });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setT({ rx: -py * 8, ry: px * 8 });
  };
  return (
    <Selectable label="卡片">
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setT({ rx: 0, ry: 0 })}
        className={"relative rounded-[var(--radius)] border p-[var(--space-4)] transition-transform duration-200 will-change-transform " + className}
        style={{ borderColor: "var(--border)", background: "var(--surface)", transform: `perspective(700px) rotateX(${t.rx}deg) rotateY(${t.ry}deg)` }}
      >
        {children}
      </div>
    </Selectable>
  );
}

function FeaturesPreview({ variantId }: { variantId: string }) {
  const { title, subtitle, items: rawItems } = PREVIEW_CONTENT.features;
  const iconSeq = [
    <Zap className="size-4" key="z" />,
    <ShieldCheck className="size-4" key="s" />,
    <Blocks className="size-4" key="b" />,
  ];
  const items = rawItems.length
    ? rawItems.map((f, i) => ({
        icon: iconSeq[i % 3],
        title: f.name,
        desc: f.desc,
        n: String(i + 1).padStart(2, "0"),
      }))
    : [{ icon: iconSeq[0], title: "核心能力", desc: "从骨架到上线的完整方案", n: "01" }];

  if (variantId === "feat_grid3")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} sub={subtitle} center />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {items.map((f) => (
            <Card key={f.title} className="flex flex-col items-center gap-2 text-center">
              <SFIcon icon={f.icon} />
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_numbered")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} />
        <div className="mt-4 divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((f) => (
            <div key={f.title} className="group flex gap-4 py-3.5">
              <span className="text-2xl font-black opacity-15 transition-colors group-hover:opacity-40" style={{ color: "var(--primary)" }}>{f.n}</span>
              <div className="flex items-start gap-3">
                <SFIcon icon={f.icon} />
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_timeline")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} />
        <div className="mt-5 space-y-5 border-l pl-6" style={{ borderColor: "var(--border)" }}>
          {items.map((f) => (
            <div key={f.title} className="relative">
              <span className="absolute -left-[31.5px] top-1 size-3 rounded-full" style={{ background: "var(--primary)", boxShadow: "0 0 0 4px color-mix(in srgb, var(--primary) 18%, transparent)" }} />
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>步骤 {f.n}</p>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_bento" || variantId === "feat_bento_animated")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} center />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {items.map((f, i) => (
            <Card key={f.title + i} className={i === 0 ? "sm:col-span-2" : ""}>
              <div className="flex items-center gap-2.5">
                <SFIcon icon={f.icon} />
                <p className="text-sm font-semibold">{f.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_image_list")
    return (
      <div className="grid items-center gap-6 px-6 py-7 sm:grid-cols-2">
        <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}><Img label="功能预览" src={ph("feature", 3, 900)} /></div>
        <div>
          <SectionHead badge="核心能力" title={title} sub={subtitle} />
          <ul className="mt-4 space-y-2.5">
            {items.map((f) => (
              <li key={f.title} className="flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✓</span>
                <span><b>{f.title}</b>：{f.desc}</span>
              </li>
            ))}
          </ul>
          <a className="mt-4 inline-block text-xs font-medium" style={{ color: "var(--primary)" }}>{PREVIEW_CONTENT.cta.secondary} →</a>
        </div>
      </div>
    );
  if (variantId === "feat_staggered" || variantId === "feat_iconcard")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} sub={subtitle} center />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {items.map((f) => (
            <Card key={f.title} className="flex flex-col items-center gap-2 text-center">
              <SFIcon icon={f.icon} />
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_tabs")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} center />
        <div className="mt-5 flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {items.slice(0, 3).map((t, i) => (
            <span key={t.title} className={"flex-1 rounded-full px-3 py-1 text-center text-xs font-medium transition-all " + (i === 0 ? "text-[var(--on-primary)] shadow-sm" : "")} style={i === 0 ? { background: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{t.title}</span>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {items.map((f) => (
            <Card key={f.title}>
              <SFIcon icon={f.icon} />
              <p className="mt-2 text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "feat_3dtilt")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="核心能力" title={title} sub={subtitle} center />
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {items.map((f) => (
            <TiltCard key={f.title} className="flex flex-col items-start gap-2">
              <SFIcon icon={f.icon} />
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </TiltCard>
          ))}
        </div>
      </div>
    );
  // 兜底：未知变体时渲染三卡网格，避免预览区空白
  return (
    <div className="px-6 py-7">
      <SectionHead badge="核心能力" title={title} sub={subtitle} center />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {items.map((f) => (
          <Card key={f.title} className="flex flex-col items-center gap-2 text-center">
            <SFIcon icon={f.icon} />
            <p className="text-sm font-semibold">{f.title}</p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────── FAQ ───────── */
/** 数字滚动：进入视口时从 0 滚动到目标值（保留 k/M/%/+ 等后缀） */
function CountUp({ value, className = "", style }: { value: string; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = value.match(/^([\d,.]+)(.*)$/);
    if (!m) {
      el.textContent = value;
      return;
    }
    const numStr = m[1];
    const suffix = m[2];
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const targetNum = parseFloat(numStr.replace(/,/g, ""));
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = targetNum * eased;
      el.textContent = (decimals ? cur.toFixed(decimals) : Math.round(cur).toLocaleString()) + suffix;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          raf = requestAnimationFrame(tick);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [value]);
  return (
    <span ref={ref} className={className} style={style}>
      {value}
    </span>
  );
}

function FaqPreview({ variantId }: { variantId: string }) {
  const faq = PREVIEW_CONTENT.faq;
  const items = faq.items.length ? faq.items : [{ q: "有免费试用吗？", a: "有，新用户可免费体验核心功能。" }];
  const [open, setOpen] = useState<number | null>(0);
  const toggle = (i: number) => setOpen(open === i ? null : i);
  // 多开手风琴（faq_multi）：独立开合集合，与单开的 open 互不影响
  const [openMulti, setOpenMulti] = useState<number[]>([0, 1]);
  const toggleMulti = (i: number) =>
    setOpenMulti(openMulti.includes(i) ? openMulti.filter((x) => x !== i) : [...openMulti, i]);

  const Accordion = ({ dark = false }: { dark?: boolean }) => (
    <div
      className="mx-auto max-w-sm divide-y rounded-lg border"
      style={{ borderColor: dark ? "rgba(255,255,255,0.12)" : "var(--border)", background: dark ? "transparent" : "var(--surface)" }}
    >
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <button
              type="button"
              onClick={() => toggle(i)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-3 text-left text-xs font-medium transition-opacity duration-200 hover:opacity-70"
              style={{ color: dark ? "#fff" : "var(--foreground)" }}
            >
              <span>{f.q}</span>
              <span className={"shrink-0 text-sm transition-transform duration-300 " + (isOpen ? "rotate-180" : "")} style={{ color: "var(--primary)" }}>▾</span>
            </button>
            <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
              <div className="overflow-hidden">
                <p className="px-4 pb-3 text-[11px]" style={{ color: dark ? "rgba(255,255,255,0.6)" : "var(--muted-foreground)" }}>{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (variantId === "faq_twocol")
    return (
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_2fr]">
        <div><SectionHead badge="常见问题" title={faq.title} sub={faq.subtitle} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((f) => (
            <Card key={f.q}>
              <p className="text-xs font-medium">{f.q}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "faq_search")
    return (
      <div className="px-6 py-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>常见问题</span>
          <h3 className="mt-2.5 text-lg font-bold tracking-tight">{faq.title}</h3>
          {faq.subtitle ? <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{faq.subtitle}</p> : null}
        </div>
        <div className="mx-auto mt-5 max-w-sm cursor-text rounded-lg border px-3 py-2 text-xs transition-colors focus-within:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>🔍 搜索问题…</div>
        <div className="mx-auto mt-3 max-w-sm space-y-2"><Accordion /></div>
      </div>
    );
  if (variantId === "faq_dark")
    return (
      <div className="bg-slate-900 px-6 py-7 text-slate-50">
        <h3 className="text-center text-base font-bold">{faq.title}</h3>
        <div className="mt-3"><Accordion dark /></div>
      </div>
    );
  if (variantId === "faq_accordion_animated")
    return (
      <div className="px-6 py-7">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>常见问题</span>
          <h3 className="mt-2.5 text-lg font-bold tracking-tight">{faq.title}</h3>
        </div>
        <div className="mx-auto mt-5 max-w-sm space-y-2">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="overflow-hidden rounded-lg border transition-colors" style={{ borderColor: "var(--border)", background: isOpen ? "color-mix(in srgb, var(--primary) 8%, var(--surface))" : "var(--surface)" }}>
                <button type="button" onClick={() => toggle(i)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-medium">
                  <span>{f.q}</span>
                  <span className={"text-sm transition-transform duration-300 " + (isOpen ? "rotate-180" : "")} style={{ color: "var(--primary)" }}>▾</span>
                </button>
                <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}>
                  <div className="overflow-hidden">
                    <p className="px-4 pb-3 text-[11px] transition-all duration-300" style={{ color: "var(--muted-foreground)", opacity: isOpen ? 1 : 0, transform: isOpen ? "translateY(0)" : "translateY(-6px)", transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}>{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  if (variantId === "faq_editorial")
    return (
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_1.4fr]">
        <div>
          <h3 className="text-lg font-bold tracking-tight">{faq.title}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{faq.subtitle}</p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button type="button" onClick={() => toggle(i)} className="flex w-full items-center justify-between py-3 text-left text-xs font-medium">
                  <span>{f.q}</span>
                  <span className={"text-sm transition-transform duration-300 " + (isOpen ? "rotate-45" : "")} style={{ color: "var(--primary)" }}>+</span>
                </button>
                {isOpen && <p className="pb-3 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  if (variantId === "pfaq_editorial")
    return (
      <div className="px-6 py-7">
        <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>定价 FAQ</p>
        <h3 className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{faq.title}</h3>
        <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2" style={{ borderColor: "var(--border)" }}>
          {items.map((f) => (
            <div key={f.q} className="border-b pb-2.5" style={{ borderColor: "var(--border)" }}>
              <p className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{f.q}</p>
              <p className="mt-0.5 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pfaq_neon" || variantId === "faq_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <h3 className="text-center text-base font-bold text-white">{faq.title}</h3>
        <div className="mx-auto mt-4 max-w-sm divide-y" style={{ borderColor: "#262629" }}>
          {items.map((f) => (
            <div key={f.q} className="py-2.5">
              <p className="text-[11px] font-semibold" style={{ color: "#22D3EE" }}>{f.q}</p>
              <p className="mt-0.5 text-[9px]" style={{ color: "#9A9AA2" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "faq_single")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="常见问题" title={faq.title} center />
        <div className="mx-auto mt-4 max-w-sm divide-y overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} style={isOpen ? { background: "color-mix(in srgb, var(--primary) 5%, transparent)" } : undefined}>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left text-xs font-medium transition-opacity duration-200 hover:opacity-70"
                >
                  <span className="font-mono text-[9px]" style={{ color: "var(--primary)" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span className="flex-1">{f.q}</span>
                  <span className={"shrink-0 text-sm transition-transform duration-300 " + (isOpen ? "rotate-180" : "")} style={{ color: "var(--primary)" }}>▾</span>
                </button>
                {isOpen && <p className="pb-3 pl-9 pr-4 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>单选展开 · 打开一条自动收起其他</p>
      </div>
    );
  if (variantId === "faq_multi")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="常见问题" title={faq.title} center />
        <div className="mx-auto mt-4 max-w-sm space-y-2">
          {items.map((f, i) => {
            const isOpen = openMulti.includes(i);
            return (
              <div
                key={f.q}
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: isOpen ? "color-mix(in srgb, var(--primary) 35%, var(--border))" : "var(--border)", background: "var(--surface)" }}
              >
                <button
                  type="button"
                  onClick={() => toggleMulti(i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium transition-opacity duration-200 hover:opacity-70"
                >
                  <span>{f.q}</span>
                  <span className={"shrink-0 text-sm transition-transform duration-300 " + (isOpen ? "rotate-45" : "")} style={{ color: "var(--primary)" }}>＋</span>
                </button>
                {isOpen && <p className="px-4 pb-2.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>可同时展开多条，互不干扰</p>
      </div>
    );
  if (variantId === "pfaq_single")
    return (
      <div className="px-6 py-7">
        <div className="text-center">
          <SectionBadge>计费相关</SectionBadge>
          <h3 className="mt-2.5 text-lg font-bold tracking-tight">{faq.title}</h3>
          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>升级 · 退款 · 发票，一次只展开一条</p>
        </div>
        <div className="mt-4"><Accordion /></div>
        <p className="mt-3 text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          还有问题？<span style={{ color: "var(--primary)" }}>联系我们 →</span>
        </p>
      </div>
    );
  if (variantId === "pfaq_twocol")
    return (
      <div className="grid gap-6 px-6 py-7 sm:grid-cols-[1fr_2fr]">
        <div>
          <SectionBadge>计费 FAQ</SectionBadge>
          <h3 className="mt-2.5 text-lg font-bold tracking-tight">{faq.title}</h3>
          <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>常见计费问题快速解答，无需展开</p>
        </div>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {items.map((f) => (
            <div key={f.q} className="border-l-2 pl-2.5" style={{ borderColor: "color-mix(in srgb, var(--primary) 45%, transparent)" }}>
              <p className="text-[11px] font-semibold">{f.q}</p>
              <p className="mt-0.5 text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pfaq_dark")
    return (
      <div className="px-6 py-7" style={{ background: "#0F1115" }}>
        <h3 className="text-center text-base font-bold text-white">{faq.title}</h3>
        <p className="mt-1 text-center text-[10px]" style={{ color: "#8A8A93" }}>计费 · 退款 · 升级</p>
        <div className="mx-auto mt-4 max-w-sm space-y-2">
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className="rounded-xl border"
                style={{ borderColor: "rgba(255,255,255,0.12)", background: isOpen ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)" }}
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-medium text-white"
                >
                  <span>{f.q}</span>
                  <span className={"shrink-0 text-sm transition-transform duration-300 " + (isOpen ? "rotate-180" : "")} style={{ color: "var(--primary)" }}>▾</span>
                </button>
                {isOpen && <p className="px-4 pb-2.5 text-[11px]" style={{ color: "rgba(255,255,255,0.62)" }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  // 未匹配变体兜底：居中标题 + 单开手风琴
  return (
    <div className="px-6 py-7">
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--primary)", background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>常见问题</span>
        <h3 className="mt-2.5 text-lg font-bold tracking-tight">{faq.title}</h3>
        {faq.subtitle ? <p className="mt-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{faq.subtitle}</p> : null}
      </div>
      <div className="mt-5"><Accordion /></div>
    </div>
  );
}

/* ───────── CTA ───────── */
/** 鼠标光斑跟随 CTA：容器内 radial 高光跟随指针，极简高级交互质感 */
function CursorCta() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };
  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="relative overflow-hidden rounded-2xl border p-8 text-center"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(400px circle at ${pos.x}% ${pos.y}%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)` }} />
      <div className="relative">
        <p className="mx-auto mt-1.5 max-w-xs text-xs" style={{ color: "var(--muted-foreground)" }}>把想法变成产品，几分钟的事。</p>
        <span className="mt-3 inline-block rounded-md px-5 py-1.5 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费开始</span>
      </div>
    </div>
  );
}

function CtaPreview({ variantId }: { variantId: string }) {
  if (variantId === "cta_solid")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div className="mt-5 rounded-xl px-6 py-9 text-center text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          <p className="mx-auto mt-1.5 max-w-xs text-xs" style={{ color: "color-mix(in srgb, var(--on-primary) 80%, transparent)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
          <span className="mt-4 inline-block rounded-md bg-white px-5 py-1.5 text-xs font-semibold text-slate-900 transition-transform duration-150 hover:scale-[1.04] active:scale-95">{PREVIEW_CONTENT.cta.button} →</span>
        </div>
      </div>
    );
  if (variantId === "cta_gradient")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div className="mt-5 rounded-xl px-6 py-9 text-center text-white" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 88%, #000), var(--secondary))" }}>
          <p className="mx-auto mt-1.5 max-w-xs text-xs text-white/85">{PREVIEW_CONTENT.cta.subheading}</p>
          <span className="mt-4 inline-block rounded-full bg-white px-6 py-1.5 text-xs font-semibold text-slate-900 shadow-lg transition-transform duration-150 hover:scale-[1.04] active:scale-95">立即开始</span>
        </div>
      </div>
    );
  if (variantId === "cta_glass")
    return (
      <div className="relative overflow-hidden rounded-2xl px-6 py-7" style={{ background: "radial-gradient(120% 120% at 20% 0%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 60%), var(--surface)" }}>
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div className="relative z-10 mx-auto mt-5 max-w-xs rounded-2xl border p-6 text-center" style={{ borderColor: "color-mix(in srgb, var(--primary) 20%, var(--border))", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(16px)", color: "var(--foreground)" }}>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
          <span className="mt-4 inline-block rounded-md px-5 py-1.5 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.04] active:scale-95" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.button}</span>
        </div>
      </div>
    );
  if (variantId === "cta_divider")
    return (
      <div className="mx-auto max-w-sm border-t px-6 py-8 text-center" style={{ borderColor: "var(--border)" }}>
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>现在就{PREVIEW_CONTENT.cta.primary}，随时可以取消。</p>
        <span className="mt-4 inline-block rounded-md px-5 py-1.5 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.04] active:scale-95" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.button}</span>
      </div>
    );
  if (variantId === "cta_newsletter")
    return (
      <div className="px-6 py-8 text-center">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
        <div className="mx-auto mt-4 flex max-w-xs gap-1.5">
          <span className="flex-1 rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>you@example.com</span>
          <span className="rounded-md px-4 py-1.5 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.03] active:scale-95" style={{ background: "var(--primary)" }}>订阅</span>
        </div>
        <p className="mt-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>我们重视隐私，绝不发送垃圾邮件。</p>
      </div>
    );
  if (variantId === "cta_card_bento")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div className="mt-5 grid gap-3 rounded-2xl border p-5 sm:grid-cols-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="sm:col-span-2">
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>14 天全功能试用，无需信用卡。</p>
          </div>
          <div className="flex items-center justify-end">
            <Btn primary glow>免费开始</Btn>
          </div>
        </div>
      </div>
    );
  if (variantId === "cta_glow")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div className="mt-5 relative overflow-hidden rounded-2xl border p-8 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent), 0 30px 80px -40px color-mix(in srgb, var(--primary) 45%, transparent)" }}>
          <p className="mx-auto mt-1.5 max-w-xs text-xs" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
          <span className="mt-4 inline-block rounded-md px-5 py-1.5 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.04] active:scale-95" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.button}</span>
        </div>
      </div>
    );
  if (variantId === "cta_cursor")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title="让每一次点击，都有回应" center />
        <CursorCta />
      </div>
    );
  if (variantId === "cta_dualbtn")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
        <div
          className="mx-auto mt-5 max-w-sm rounded-2xl border p-5 text-center"
          style={{ borderColor: "var(--border)", background: "linear-gradient(180deg, color-mix(in srgb, var(--primary) 7%, var(--surface)), var(--surface))" }}
        >
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span
              className="rounded-md px-4 py-1.5 text-xs font-semibold text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.04] active:scale-95"
              style={{ background: "var(--primary)", boxShadow: "0 12px 26px -14px color-mix(in srgb, var(--primary) 70%, transparent)" }}
            >
              {PREVIEW_CONTENT.cta.button}
            </span>
            <span
              className="rounded-md border px-4 py-1.5 text-xs font-medium transition-transform duration-150 hover:scale-[1.03] active:scale-95"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))", background: "var(--surface)", color: "var(--primary)" }}
            >
              {PREVIEW_CONTENT.cta.secondary}
            </span>
          </div>
          <p className="mt-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>✓ 30 天退款保证 · ✓ 无需信用卡</p>
        </div>
      </div>
    );
  // 未匹配变体兜底：双按钮居中
  return (
    <div className="px-6 py-8 text-center">
      <SectionHead badge="行动号召" title={PREVIEW_CONTENT.cta.title || "准备好开始了吗"} center />
      <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.cta.subheading}</p>
      <div className="mt-4 flex justify-center gap-2"><Btn primary glow>{PREVIEW_CONTENT.cta.button}</Btn><Btn>联系销售</Btn></div>
      <p className="mt-3 text-[10px]" style={{ color: "var(--muted-foreground)" }}>✓ 30 天退款保证 · ✓ 无需信用卡</p>
    </div>
  );
}

/* ───────── Footer ───────── */
function FooterPreview({ variantId }: { variantId: string }) {
  const cols = [
    { t: "产品", links: ["功能", PREVIEW_CONTENT.nav.pricing, "更新日志"] },
    { t: "资源", links: [PREVIEW_CONTENT.nav.docs, "教程", "社区"] },
    { t: "公司", links: ["关于", PREVIEW_CONTENT.nav.blog, "联系"] },
  ];
  if (variantId === "footer_simple")
    return (
      <div className="border-t px-6 py-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold">{PREVIEW_CONTENT.brand}</span>
          <span style={{ color: "var(--muted-foreground)" }}>© 2025 {PREVIEW_CONTENT.brand} Inc. All rights reserved.</span>
        </div>
      </div>
    );
  if (variantId === "footer_dark")
    return (
      <div className="bg-slate-900 px-6 py-7 text-slate-50">
        <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <p className="text-sm font-bold">{PREVIEW_CONTENT.brand}</p>
            <p className="mt-1 text-[11px] text-slate-400">{PREVIEW_CONTENT.footer.tagline}</p>
            <div className="mt-2 flex gap-1.5 text-slate-400">
              {(["X", "GitHub", "LinkedIn"] as const).map((i) => (
                <span key={i} className="flex size-5 items-center justify-center rounded border border-white/15 text-[9px]"><BrandMark name={i} className="size-3" /></span>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.t}>
              <p className="text-xs font-semibold">{c.t}</p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-400">
                {c.links.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-between border-t border-white/10 pt-3 text-[10px] text-slate-400">
          <span>© 2025 {PREVIEW_CONTENT.brand} Inc.</span>
          <span>隐私政策 · 条款</span>
        </div>
      </div>
    );
  if (variantId === "footer_cta")
    return (
      <div className="border-t px-6 py-7" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border p-4 sm:flex-row" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-sm font-bold">订阅最新动态</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>产品更新与增长技巧，每周一封。</p>
          </div>
          <div className="flex w-full max-w-xs gap-1.5">
            <span className="flex-1 rounded-md border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>you@example.com</span>
            <span className="rounded-md px-3.5 py-1.5 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>订阅</span>
          </div>
        </div>
        <div className="mt-4 flex justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
          <span>© 2025 {PREVIEW_CONTENT.brand} Inc.</span>
          <span>隐私 · 条款</span>
        </div>
      </div>
    );
  if (variantId === "footer_bento")
    return (
      <div className="px-6 py-7">
        <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="grid gap-5 sm:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            <div>
              <p className="text-sm font-bold">{PREVIEW_CONTENT.brand}</p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.footer.tagline}</p>
              <div className="mt-2 flex gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                {(["X", "GitHub", "LinkedIn"] as const).map((i) => (
                  <span key={i} className="flex size-5 items-center justify-center rounded-md border" style={{ borderColor: "var(--border)" }}><BrandMark name={i} className="size-3" /></span>
                ))}
              </div>
            </div>
            {cols.map((c) => (
              <div key={c.t}>
                <p className="text-xs font-semibold">{c.t}</p>
                <ul className="mt-1.5 space-y-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                  {c.links.map((l) => <li key={l}>{l}</li>)}
                </ul>
              </div>
            ))}
            <div>
              <p className="text-xs font-semibold">订阅</p>
              <div className="mt-1.5 flex gap-1.5">
                <span className="flex-1 rounded-md border px-2 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>you@ex.com</span>
                <span className="rounded-md px-2.5 py-1.5 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>→</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  if (variantId === "footer_editorial")
    return (
      <div className="px-6 py-7">
        <p className="text-2xl font-bold tracking-tight">{PREVIEW_CONTENT.brand}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          <span>功能</span>
          <span>{PREVIEW_CONTENT.nav.pricing}</span>
          <span>{PREVIEW_CONTENT.nav.docs}</span>
          <span>{PREVIEW_CONTENT.nav.blog}</span>
          <span>联系</span>
        </div>
        <div className="mt-4 border-t pt-3 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          © 2025 {PREVIEW_CONTENT.brand} Inc. 保留所有权利。
        </div>
      </div>
    );
  if (variantId === "footer_multi") {
    const multiCols = [...cols, { t: "法律", links: ["隐私政策", "服务条款", "安全"] }];
    return (
      <div className="border-t px-6 py-7" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
        <div className="flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-sm font-bold">{PREVIEW_CONTENT.brand}</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.footer.tagline}</p>
          </div>
          <div className="flex gap-1.5" style={{ color: "var(--muted-foreground)" }}>
            {(["X", "GitHub", "LinkedIn"] as const).map((i) => (
              <span key={i} className="flex size-5 items-center justify-center rounded-md border" style={{ borderColor: "var(--border)" }}><BrandMark name={i} className="size-3" /></span>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {multiCols.map((c) => (
            <div key={c.t}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>{c.t}</p>
              <ul className="mt-2 space-y-1.5 text-[11px]">
                {c.links.map((l) => <li key={l}>{l}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-col justify-between gap-1 border-t pt-3 text-[10px] sm:flex-row sm:items-center" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span>© 2025 {PREVIEW_CONTENT.brand} Inc. 保留所有权利。</span>
          <span className="w-max rounded-md border px-1.5 py-0.5" style={{ borderColor: "var(--border)" }}>简体中文 ▾</span>
        </div>
      </div>
    );
  }
  // 未匹配变体兜底：品牌列 + 三列链接
  return (
    <div className="border-t px-6 py-7" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="grid gap-5 sm:grid-cols-4">
        <div>
          <p className="text-sm font-bold">{PREVIEW_CONTENT.brand}</p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.footer.tagline}</p>
          <div className="mt-2 flex gap-1.5" style={{ color: "var(--muted-foreground)" }}>
                {(["X", "GitHub", "LinkedIn"] as const).map((i) => (
                  <span key={i} className="flex size-5 items-center justify-center rounded-md border" style={{ borderColor: "var(--border)" }}><BrandMark name={i} className="size-3" /></span>
                ))}
              </div>
        </div>
        {cols.map((c) => (
          <div key={c.t}>
            <p className="text-xs font-semibold">{c.t}</p>
            <ul className="mt-1.5 space-y-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {c.links.map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-col justify-between gap-1 border-t pt-3 text-[10px] sm:flex-row" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <span>© 2025 {PREVIEW_CONTENT.brand} Inc. 保留所有权利。</span>
        <span>隐私政策 · 服务条款</span>
      </div>
    </div>
  );
}

/* ───────── Logos ───────── */

// —— 真实品牌 SVG 图形标记（信誉墙）：用当前颜色渲染，随主题色/品牌色变化 ——
const BRAND_MARKS: Record<string, ReactNode> = {
  Vercel: <path d="M12 3 21 20.5H3z" />,
  Apple: (
    <path d="M17.05 12.5c-.03-2.4 1.97-3.55 2.06-3.61-1.12-1.64-2.87-1.87-3.5-1.9-1.49-.15-2.9.87-3.66.87-.75 0-1.92-.85-3.16-.83-1.62.02-3.12.94-3.96 2.4-1.69 2.93-.43 7.27 1.21 9.65.8 1.17 1.76 2.48 3.02 2.43 1.21-.05 1.67-.78 3.13-.78 1.46 0 1.87.78 3.16.76 1.3-.02 2.13-1.19 2.92-2.36.92-1.35 1.3-2.66 1.32-2.73-.03-.01-2.53-.97-2.55-3.87zM13.9 6.24c.67-.82 1.13-1.96 1-3.1-.97.04-2.14.64-2.83 1.46-.62.72-1.17 1.88-1.02 2.99 1.09.08 2.18-.54 2.85-1.35z" />
  ),
  Google: (
    <path d="M17.7 7.2C16.25 5.85 14.4 5.2 12 5.2c-3.4 0-6.2 2.26-7.2 5.3C4 11.5 4 12.5 4.8 13.5c1 3.04 3.8 5.3 7.2 5.3 1.7 0 3.15-.49 4.16-1.34.94-.8 1.44-1.9 1.44-3.2v-.35h-5.6v2.55h3.35c-.4.7-1.6 1.8-3.35 1.8-2.35 0-4.25-1.9-4.25-4.6 0-2.7 1.9-4.6 4.25-4.6 1.2 0 2.2.4 2.9 1.1z" />
  ),
  GitHub: (
    <path d="M12 1.5C6.1 1.5 1.3 6.3 1.3 12.2c0 4.7 3 8.7 7.3 10.1.5.1.6-.2.6-.6 0-.3-.1-1.1-.1-2.2-2.7.6-3.4-1.1-3.6-2.1-.1-.5-.5-1-1-1.8-.4-.2-.9-.6-.6-.7.4-.9-.5-1.2-.5-1.2-.5-.2-.4-1.4-.1-1.4.4-.1 1 .9 1.4 1 .7-1.1 2.2-.9 2.7-.7 0-.6.2-1.1.5-1.5-2.1-.2-4.3-1.1-4.3-4.7 0-1 .4-1.9 1.1-2.5-.1-.2-.5-1.2.1-2.5 0 0 .9-.3 2.8 1 .8-.2 1.6-.3 2.5-.3.8 0 1.7.1 2.5.3 2-1.2 2.8-1 2.8-1 .6 1.3.2 2.3.1 2.5.7.6.1 2.3.1 2.5-.2.4-1 1-1.7 1.1.3.3.5.8.5 1.5 0 3.4-2.2 4.5-4.3 4.7.3.3.6.9.6 1.8 0 1.3-.1 2.4-.1 2.7 0 .3.1.7.6.6 4.3-1.4 7.3-5.4 7.3-10.1C22.7 6.3 17.9 1.5 12 1.5z" />
  ),
  Meta: (
    <path d="M12 8.5C10.8 6.2 8.8 5.1 7 5.1 4.6 5.1 2.5 7.1 2.5 9.9c0 1.7.8 3.2 2.3 4.7.6.6 1.2 1.4 1.7 2.2.5.8.9 1.5 1.3 2.2l2.7 4.1c.5.8.9.8 1.5 0l2.7-4.1c.4-.7.8-1.4 1.3-2.2.5-.8 1.1-1.6 1.7-2.2 1.5-1.5 2.3-3 2.3-4.7 0-2.8-2.1-4.8-4.5-4.8-1.8 0-3.8 1.1-5 3.4z" />
  ),
  Notion: (
    <path d="M4 3.5h3.2l9.6 16.5V3.5c.8 0 1.6 0 2.4 0V20.5h-3.2L6.4 4.05c0 5.48 0 10.97 0 16.45H4z" />
  ),
  腾讯: (
    <path d="M12 3c-4 0-7 3-7 7 0 1 .2 2 .5 2.9C3.9 14.1 2.7 15.9 2.7 18c0 1.4.5 2.6 1.3 3.5.7-.4 2.5-.5 3-.5v.2c3.34 3.7 6.66 3.7 10 0V21c.5 0 2.3.1 3 .5.8-.9 1.3-2.1 1.3-3.5 0-2.1-1.2-3.9-2.8-5.1.3-.9.5-1.9.5-2.9 0-4-3-7-7-7zM8.5 9.5c1 0 1.8.8 1.8 1.8S9.5 13 8.5 13s-1.8-.8-1.8-1.9.8-1.6 1.8-1.6zm7 0c1 0 1.8.8 1.8 1.8s-.8 1.7-1.8 1.7-1.8-.8-1.8-1.9.8-1.6 1.8-1.6z" />
  ),
  阿里巴巴: (
    <path d="M3 7.5h6.5l.8 2.2-2 1.3 1.8 1.8 1.3 2-3.5 1-2.3-1.5-.6-2.3 2-1.4L3 7.5zM16.3 7.5c1.9 0 3.6.5 5 1.5l.6 1.8-2.2.9-1.3-1-1.5.5-2.3 3.1-1.3-1.2 1.1-2-1-1.2 1.4-1 3-3.4zM10.4 7.5c1.4 0 2.5 1 2.5 2.5s-1.1 2.3-2.5 2.3-2.5-1-2.5-2.4 1.1-2.4 2.5-2.4z" />
  ),
  Slack: (
    <g fill="currentColor">
      <rect x="3.8" y="9.4" width="6.1" height="6" rx="1.4" />
      <rect x="8.9" y="3.8" width="6" height="6.1" rx="1.4" />
      <rect x="8.9" y="14.1" width="6" height="6.1" rx="1.4" />
      <rect x="14.1" y="9" width="6.1" height="6" rx="1.4" />
    </g>
  ),
  TikTok: (
    <path d="M15.5 3c.3 2.9 2.1 4.6 5 4.9v3.3c-1.7 0-3.2-.6-4.8-1.7v6.2c0 4-3 6.6-6.7 6.6-3.3 0-6-2.5-6-6 0-3.9 2.3-6.9 6.2-6.5v3.2c-1.7-.3-3 .7-3 3.1 0 1.9 1.1 3.1 3 3.1 1.6 0 2.8-1.1 2.8-3.3V3z" />
  ),
  X: <path d="M17.8 4H21l-6.9 8.8L22.2 20h-5.9l-4.6-5.4L6.5 20H3.3l7.4-9.4L3 4h6l4.2 5z" />,
  LinkedIn: (
    <path d="M6.5 8.6a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zM5 9.9h3V20.5H5zM9.9 9.9h2.9v1.45h.04c.4-.78 1.4-1.6 2.88-1.6 3.08 0 3.64 2.03 3.64 4.66V20.5h-3v-4.92c0-1.17-.02-2.7-1.64-2.7-1.64 0-1.9 1.28-1.9 2.6V20.5h-3z" />
  ),
};

function BrandMark({ name, className }: { name: string; className?: string }) {
  const mark = BRAND_MARKS[name];
  if (!mark)
    return <span className={"font-bold leading-none " + (className ?? "")}>{name}</span>;
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-label={name}
      role="img"
    >
      {mark}
    </svg>
  );
}

function LogosPreview({ variantId }: { variantId: string }) {
  const brands = getBrands().length ? getBrands() : ["Acme"];
  const palette = ["#29725f", "#4b69f0", "#f5693c", "#a0325a", "#82a0ff", "#f0befa"];
  const neonPalette = ["#22D3EE", "#F472B6", "#F59E0B", "#34D399", "#FB7185"];
  if (variantId === "logos_marquee")
    return (
      <div className="relative overflow-hidden border-y px-6 py-7" style={{ borderColor: "var(--border)" }}>
        <SectionHead badge="合作伙伴" title="信任我们的团队" center />
        <div className="mt-4 flex overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
          <div className="flex shrink-0 gap-12 pr-12 [animation:marqueeX_18s_linear_infinite] hover:[animation-play-state:paused]">
            {[...brands, ...brands].map((b, i) => (
              <BrandMark key={i} name={b} className="h-6 w-auto shrink-0 opacity-50 transition hover:opacity-100" />
            ))}
          </div>
          <div aria-hidden className="flex shrink-0 gap-12 pr-12 [animation:marqueeX_18s_linear_infinite] hover:[animation-play-state:paused]">
            {[...brands, ...brands].map((b, i) => (
              <BrandMark key={i} name={b} className="h-6 w-auto shrink-0 opacity-50" />
            ))}
          </div>
        </div>
        <style>{`@keyframes marqueeX { from { transform: translateX(0); } to { transform: translateX(-100%); } }`}</style>
      </div>
    );
  if (variantId === "logos_marquee_double") {
    const tiles = brands.map((n, i) => ({ n, c: palette[i % palette.length] }));
    const col = (dir: "up" | "down") => (
      <div key={dir} className="flex-1 overflow-hidden">
        <div className={dir === "up" ? "flex flex-col gap-2 [animation:marqueeUp_12s_linear_infinite]" : "flex flex-col gap-2 [animation:marqueeDown_12s_linear_infinite]"}>
          {[...tiles, ...tiles].map((t, i) => (
            <div key={i} className="flex h-14 items-center justify-center rounded-lg" style={{ background: t.c }}><BrandMark name={t.n} className="h-6 w-auto text-white" /></div>
          ))}
        </div>
      </div>
    );
    return (
      <div className="relative overflow-hidden py-4" style={{ background: "var(--background)" }}>
        <SectionHead badge="合作伙伴" title="信任我们的团队" center />
        <div className="mt-3 flex gap-2 px-4">
          {col("up")}
          {col("down")}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10" style={{ background: "linear-gradient(to bottom, var(--background), transparent)" }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: "linear-gradient(to top, var(--background), transparent)" }} />
        <style>{`@keyframes marqueeUp { from { transform: translateY(0); } to { transform: translateY(-50%); } } @keyframes marqueeDown { from { transform: translateY(-50%); } to { transform: translateY(0); } }`}</style>
      </div>
    );
  }
  if (variantId === "logos_grid")
    return (
      <div className="px-6 py-7">
        <div className="flex items-center justify-between">
          <div>
            <SectionBadge>合作伙伴</SectionBadge>
            <h3 className="mt-1.5 text-sm font-bold">值得信赖的合作伙伴</h3>
          </div>
          <a className="text-xs font-medium" style={{ color: "var(--primary)" }}>查看全部 →</a>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {brands.slice(0, 6).map((b, i) => (
            <div key={b} className="flex h-12 items-center justify-center rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)", color: ["#2563EB", "#7C3AED", "#059669", "#EA580C", "#0EA5E9", "#DC2626"][i], opacity: 0.75 }}>
              <BrandMark name={b} className="h-5 w-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "logos_bento")
    return (
        <div className="px-6 py-7">
          <SectionBadge>合作伙伴</SectionBadge>
          <h3 className="mb-3 mt-1.5 text-sm font-bold">信任我们的团队</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {brands.slice(0, 6).map((b, i) => (
            <div key={b} className={"flex h-14 items-center justify-center rounded-xl border transition-transform hover:-translate-y-0.5 " + (i === 0 ? "col-span-2" : "")} style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
              <BrandMark name={b} className="h-6 w-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "logos_editorial")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <SectionBadge>合作伙伴</SectionBadge>
          <div className="flex flex-1 flex-wrap items-center gap-x-8 gap-y-3">
            {brands.map((b) => (
              <span key={b} className="inline-flex h-5 items-center" style={{ color: "var(--foreground)" }}><BrandMark name={b} className="h-5 w-auto" /></span>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "logos_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <SectionHead badge="合作伙伴" title="信任我们的团队" center />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {brands.map((n, i) => (
            <span key={n} className="inline-flex h-6 items-center rounded-lg px-3" style={{ border: "1px solid color-mix(in srgb, " + neonPalette[i % neonPalette.length] + " 40%, transparent)", background: "color-mix(in srgb, " + neonPalette[i % neonPalette.length] + " 10%, #141416)", color: neonPalette[i % neonPalette.length] }}><BrandMark name={n} className="h-4 w-auto" /></span>
          ))}
        </div>
      </div>
    );
  if (variantId === "logos_compact")
    return (
      <div
        className="flex flex-col items-center gap-2 border-y px-6 py-4 sm:flex-row sm:justify-center sm:gap-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--muted-foreground)" }}>200+ 团队在用</span>
        <span className="hidden h-4 w-px sm:block" style={{ background: "var(--border)" }} />
        <div className="flex flex-wrap items-center justify-center gap-5">
          {brands.slice(0, 6).map((b) => (
            <BrandMark key={b} name={b} className="h-4 w-auto opacity-70 transition-opacity duration-200 hover:opacity-100" />
          ))}
        </div>
      </div>
    );
  if (variantId === "logos_grayrow")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="合作伙伴" title="信任我们的团队" center />
        <div className="mt-4 flex flex-wrap items-center justify-center divide-x" style={{ borderColor: "var(--border)" }}>
          {brands.slice(0, 6).map((b) => (
            <span key={b} className="px-5" style={{ filter: "grayscale(1)", color: "var(--muted-foreground)" }}>
              <BrandMark name={b} className="h-6 w-auto opacity-55 transition-opacity duration-200 hover:opacity-100" />
            </span>
          ))}
        </div>
        <p className="mt-3 text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>统一灰度处理，弱化品牌色干扰</p>
      </div>
    );
  // 未匹配变体兜底：单行淡色 logo
  return (
    <div className="px-6 py-7">
      <SectionHead badge="合作伙伴" title="信任我们的团队" center />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-8">
        {brands.map((b) => (
          <BrandMark key={b} name={b} className="h-6 w-auto opacity-40" />
        ))}
      </div>
    </div>
  );
}

/* ───────── Stats ───────── */
function StatsPreview({ variantId }: { variantId: string }) {
  const raw = PREVIEW_CONTENT.stats.items.length ? PREVIEW_CONTENT.stats.items : [{ label: "50k+", value: "活跃用户" }];
  const stats = raw.map((s) => ({ n: s.value, l: s.label }));
  if (variantId === "stats_dark")
    return (
      <div className="bg-slate-900 px-6 py-7 text-white">
        <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l}>
              <p className="text-[length:var(--text-h1)] font-black"><CountUp value={s.n} /></p>
              <p className="mt-0.5 text-[10px] text-slate-400">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_withdesc")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {raw.map((s) => (
            <Card key={s.label}>
              <CountUp value={s.value} className="text-[length:var(--text-h1)] font-black" style={{ color: "var(--primary)" }} />
              <p className="mt-1 text-sm font-semibold">{s.label}</p>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>领先同业 · {s.label}专项增长</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_inline")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
        <div className="mt-4 flex justify-center divide-x" style={{ borderColor: "var(--border)" }}>
          {stats.map((s) => (
            <div key={s.l} className="px-6 text-center">
              <CountUp value={s.n} className="text-lg font-bold" style={{ color: "var(--primary)" }} />
              <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_editorial")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
        <div className="mt-4 grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4" style={{ borderColor: "var(--border)" }}>
          {stats.map((s) => (
            <div key={s.l} className="px-6 py-4 text-center sm:text-left">
              <CountUp value={s.n} className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }} />
              <p className="mt-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_countup")
    return (
      <div className="px-6 py-7 text-center">
        <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.l}>
              <CountUp value={s.n} className="text-[length:var(--text-h1)] font-black" style={{ color: "var(--primary)" }} />
              <div className="mx-auto mt-1.5 h-px w-8" style={{ background: "var(--primary)" }} />
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="grid grid-cols-4 gap-3 text-center">
          {raw.map((s, i) => (
            <div key={s.label}>
              <p className="text-lg font-black" style={{ color: ["#22D3EE", "#F472B6", "#34D399", "#F59E0B"][i % 4], textShadow: "0 0 14px " + ["#22D3EE", "#F472B6", "#34D399", "#F59E0B"][i % 4] }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "stats_grid")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.l}
              className="rounded-xl border p-3"
              style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "color-mix(in srgb, var(--primary) 6%, var(--surface))" : "var(--surface)" }}
            >
              <CountUp value={s.n} className="text-lg font-black" style={{ color: "var(--primary)" }} />
              <p className="mt-1 text-[10px] font-medium">{s.l}</p>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--primary) 14%, transparent)" }}>
                <span className="block h-full rounded-full" style={{ width: [72, 58, 84, 46][i % 4] + "%", background: "var(--primary)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  // 未匹配变体兜底：四格数字
  return (
    <div className="px-6 py-7">
      <SectionHead badge="数据概览" title={PREVIEW_CONTENT.stats.title || "有据可查"} center />
      <div className="mt-4 grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l}>
            <CountUp value={s.n} className="text-[length:var(--text-h1)] font-black" style={{ color: "var(--primary)" }} />
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Testimonials ───────── */
function TestimonialsPreview({ variantId }: { variantId: string }) {
  const testi = PREVIEW_CONTENT.testimonials;
  const items = testi.items.length
    ? testi.items.map((t) => ({ q: t.quote, n: t.name, r: t.role }))
    : [{ q: "让团队协作真正快起来了。", n: "林女士", r: "产品经理" }];
  const featured = items[0];
  if (variantId === "testi_featured")
    return (
      <div className="px-6 py-7 text-center">
        <SectionHead badge="客户证言" title={testi.title || "他们怎么说"} sub={testi.subtitle} center />
        <span className="mt-2 inline-block text-2xl" style={{ color: "var(--primary)" }}>"</span>
        <blockquote className="mx-auto mt-1 max-w-xs text-base font-semibold leading-snug">"{featured.q}"</blockquote>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{featured.n.slice(0, 1)}</span>
          <span className="text-xs"><span className="font-semibold">{featured.n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{featured.r}</span></span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {items.slice(1, 4).map((t) => (
            <Card key={t.n} className="text-[10px]">"{t.q}"</Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "testi_dark")
    return (
      <div className="bg-slate-900 px-6 py-7 text-slate-50">
        <SectionHead badge="客户证言" title={PREVIEW_CONTENT.testimonials?.title || "用户怎么说"} center />
        <div className="mx-auto mt-5 grid max-w-sm gap-2 sm:grid-cols-2">
          {items.slice(0, 4).map((t) => (
            <div key={t.n} className="rounded-lg border border-white/10 p-3">
              <p className="text-[11px] leading-relaxed text-slate-200">"{t.q}"</p>
              <p className="mt-2 text-[10px] font-semibold">— {t.n}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "testi_carousel")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="客户证言" title={testi.title || "他们怎么说"} sub={testi.subtitle} center />
        <div className="mx-auto mt-3 max-w-md">
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {items.map((t, i) => (
              <Card key={i} className="flex w-full min-w-[min(100%,17rem)] shrink-0 snap-center flex-col justify-center">
                <span className="text-xl leading-none" style={{ color: "var(--primary)" }}>"</span>
                <p className="mt-1 text-xs leading-relaxed">{t.q}</p>
                <figcaption className="mt-3 flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{t.n.slice(0, 1)}</span>
                  <span className="text-[10px]"><span className="font-semibold">{t.n}</span> <span style={{ color: "var(--muted-foreground)" }}>{t.r}</span></span>
                </figcaption>
              </Card>
            ))}
          </div>
          <div className="mt-2 flex justify-center gap-1.5">
            {items.map((t, i) => (
              <span key={i} className="size-1.5 rounded-full" style={{ background: "var(--primary)", opacity: i === 0 ? 1 : 0.28 }} />
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "testi_logo")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-3 gap-2.5">
          {getBrands().slice(0, 6).map((b, i) => (
            <div key={i} className="flex items-center justify-center rounded-lg border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <span className="text-xs font-black tracking-tight" style={{ color: "var(--muted-foreground)" }}>{b}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {items.slice(0, 3).map((t) => (
            <Card key={t.n}>
              <p className="text-[10px] leading-relaxed">"{t.q}"</p>
              <p className="mt-1.5 text-[10px] font-semibold">— {t.n}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "testi_marquee")
    return (
      <div className="relative overflow-hidden py-7">
        <div className="mb-5"><SectionHead badge="客户证言" title={testi.title || "他们怎么说"} sub={testi.subtitle} center /></div>
        <div className="flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="flex shrink-0 gap-2.5 pr-2.5 [animation:marqueeX_24s_linear_infinite] hover:[animation-play-state:paused]">
            {items.map((t, i) => (
              <Card key={i} className="w-44 shrink-0">
                <p className="text-[10px] leading-relaxed">"{t.q}"</p>
                <figcaption className="mt-2 flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full text-[7px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{t.n.slice(0, 1)}</span>
                  <span className="truncate text-[10px] font-semibold">— {t.n}</span>
                </figcaption>
              </Card>
            ))}
          </div>
          <div aria-hidden className="flex shrink-0 gap-2.5 pr-2.5 [animation:marqueeX_24s_linear_infinite] hover:[animation-play-state:paused]">
            {items.map((t, i) => (
              <Card key={i} className="w-44 shrink-0">
                <p className="text-[10px] leading-relaxed">"{t.q}"</p>
                <figcaption className="mt-2 flex items-center gap-1.5">
                  <span className="flex size-4 items-center justify-center rounded-full text-[7px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{t.n.slice(0, 1)}</span>
                  <span className="truncate text-[10px] font-semibold">— {t.n}</span>
                </figcaption>
              </Card>
            ))}
          </div>
        </div>
        <style>{`@keyframes marqueeX { from { transform: translateX(0); } to { transform: translateX(-100%); } }`}</style>
      </div>
    );
  if (variantId === "testi_3dstack")
    return (
      <div className="flex min-h-52 items-center justify-center px-6 py-7 [perspective:1200px]">
        <div className="relative w-full max-w-xs">
          <div aria-hidden className="absolute inset-x-3 top-3 rounded-2xl border" style={{ borderColor: "var(--border)", background: "var(--surface)", transform: "translateY(16px) scale(0.96)", opacity: 0.5 }} />
          <TiltCard>
            <figure className="relative rounded-2xl border p-5 shadow-[var(--shadow)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-sm font-semibold leading-snug">"{featured.q}"</p>
              <figcaption className="mt-3 flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{featured.n.slice(0, 1)}</span>
                <span className="text-[10px]"><span className="font-semibold">{featured.n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{featured.r}</span></span>
              </figcaption>
            </figure>
          </TiltCard>
        </div>
      </div>
    );
  if (variantId === "testi_split")
    return (
      <div className="grid gap-3 px-6 py-7 md:grid-cols-2">
        <Card className="flex flex-col justify-center">
          <p className="text-sm font-semibold leading-snug">"{featured.q}"</p>
          <figcaption className="mt-3 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{featured.n.slice(0, 1)}</span>
            <span className="text-[10px]"><span className="font-semibold">{featured.n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{featured.r}</span></span>
          </figcaption>
        </Card>
        <div className="grid grid-rows-2 gap-3">
          {items.slice(1, 3).map((t) => (
            <Card key={t.n} className="flex flex-col justify-center">
              <p className="text-[11px] leading-relaxed">"{t.q}"</p>
              <figcaption className="mt-2 text-[10px] font-semibold">— {t.n}</figcaption>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "testi_grid")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="客户证言" title={testi.title || "他们怎么说"} sub={testi.subtitle} center />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {items.slice(0, 6).map((t) => (
            <div key={t.n} className="flex flex-col rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex gap-0.5 text-[9px]" style={{ color: "var(--primary)" }}>
                {[0, 1, 2, 3, 4].map((s) => <span key={s}>★</span>)}
              </div>
              <p className="mt-1.5 flex-1 text-[10px] leading-relaxed">"{t.q}"</p>
              <div className="mt-2.5 flex items-center gap-1.5 border-t pt-2" style={{ borderColor: "var(--border)" }}>
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{t.n.slice(0, 1)}</span>
                <span className="min-w-0 truncate text-[9px]"><span className="font-semibold">{t.n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{t.r}</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  // 未匹配变体兜底：三列证言卡
  return (
    <div className="px-6 py-7">
      <SectionHead badge="客户证言" title={testi.title || "他们怎么说"} sub={testi.subtitle} center />
      <div className="mt-3 grid grid-cols-3 gap-3">
        {items.map((t) => (
          <Card key={t.n} className="flex flex-col">
            <span className="text-sm" style={{ color: "var(--primary)" }}>"</span>
            <p className="mt-1 flex-1 text-[10px] leading-relaxed">{t.q}</p>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{t.n.slice(0, 1)}</span>
              <div>
                <p className="text-[10px] font-semibold">{t.n}</p>
                <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{t.r}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────── Pricing ───────── */
function PricingPreview({ variantId }: { variantId: string }) {
  const [billing, setBilling] = useState<"m" | "y">("m");
  if (variantId === "price_single")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title || "简单透明的定价"} sub={PREVIEW_CONTENT.pricing.subtitle} center />
        <div className="mx-auto mt-5 max-w-xs rounded-xl border p-5 text-center" style={{ borderColor: "var(--primary)", background: "var(--surface)" }}>
          <p className="text-[length:var(--text-h1)] font-black">$19<span className="text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>/月</span></p>
          <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>包括所有功能，无隐藏费用。</p>
          <span className="mt-4 block rounded-md py-2 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.02] active:scale-95" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.primary}</span>
          <ul className="mt-4 space-y-1.5 text-left text-[10px]">
            {["无限项目", "所有集成", "优先支持"].map((f) => (
              <li key={f} className="flex items-center gap-1.5"><span className="flex size-3.5 items-center justify-center rounded-full text-[8px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✓</span>{f}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  if (variantId === "price_billing")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title || "简单透明的定价"} sub={PREVIEW_CONTENT.pricing.subtitle} center />
        <div className="flex items-center justify-center gap-2.5 text-[10px]">
          <button type="button" onClick={() => setBilling("m")} className={"cursor-pointer transition " + (billing === "m" ? "font-semibold" : "")} style={{ color: billing === "m" ? "var(--foreground)" : "var(--muted-foreground)" }}>月付</button>
          <button type="button" onClick={() => setBilling("y")} aria-label="切换计费周期" className="relative inline-flex h-4 w-8 cursor-pointer items-center rounded-full transition-colors" style={{ background: billing === "y" ? "var(--primary)" : "var(--muted-foreground)" }}>
            <span className="absolute size-3 rounded-full bg-white transition-transform duration-200" style={{ transform: billing === "y" ? "translateX(18px)" : "translateX(2px)" }} />
          </button>
          <span className={"font-semibold transition-opacity " + (billing === "y" ? "" : "opacity-0")}>年付 <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-medium text-green-700">省 20%</span></span>
        </div>
        <div className="mx-auto mt-5 grid max-w-md grid-cols-2 gap-3">
          {[
            { n: "基础版", m: "$15", y: "$12" },
            { n: "专业版", m: "$39", y: "$31" },
          ].map((t) => (
            <Card key={t.n}>
              <p className="text-[10px] font-semibold">{t.n}</p>
              <p className="mt-1 text-xl font-black tabular-nums">{billing === "y" ? t.y : t.m}<span className="text-[9px] font-normal" style={{ color: "var(--muted-foreground)" }}>/月</span></p>
              <span className="mt-3 block cursor-pointer rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.03] active:scale-95" style={{ background: "var(--primary)" }}>选择</span>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "price_compare")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title || "简单透明的定价"} sub={PREVIEW_CONTENT.pricing.subtitle} center />
        <div className="mx-auto mt-5 max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <th className="p-2 text-left font-semibold">功能</th>
                <th className="p-2 text-center font-semibold">免费</th>
                <th className="p-2 text-center font-semibold">专业</th>
                <th className="p-2 text-center font-semibold">企业</th>
              </tr>
            </thead>
            <tbody>
              {[
                { f: "项目数", v: ["3", "无限", "无限"] },
                { f: "高级分析", v: ["—", "✓", "✓"] },
                { f: "SSO", v: ["—", "—", "✓"] },
              ].map((r) => (
                <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="p-2">{r.f}</td>
                  {r.v.map((v, i) => <td key={i} className="p-2 text-center">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (variantId === "price_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
          {[
            { p: "基础", price: "$0", c: "#F472B6", hot: false },
            { p: "创意", price: "$19", c: "#22D3EE", hot: true },
            { p: "无限", price: "$49", c: "#34D399", hot: false },
          ].map((x) => (
            <div key={x.p} className={"rounded-lg p-2.5 " + (x.hot ? "ring-2" : "border")} style={x.hot ? { boxShadow: "0 0 0 2px " + x.c + ", 0 12px 30px -12px " + x.c, background: "color-mix(in srgb, " + x.c + " 8%, #141416)" } : { borderColor: "#262629", background: "#141416" }}>
              {x.hot && <span className="block rounded-full text-center py-0.5 text-[7px] font-medium text-white" style={{ background: x.c }}>热门</span>}
              <h3 className="mt-1 text-sm font-semibold" style={{ color: x.c }}>{x.p}</h3>
              <p className="mt-0.5 text-lg font-black text-white">{x.price}<span className="text-[8px] text-slate-400">/月</span></p>
              <span className="mt-1.5 block rounded border py-1 text-center text-[9px] font-semibold" style={{ borderColor: x.c, color: x.c }}>开始</span>
            </div>
          ))}
        </div>
      </div>
    );
  // price_tiers
  return (
    <div className="px-6 py-7">
      <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title || "简单透明的定价"} sub={PREVIEW_CONTENT.pricing.subtitle} center />
      <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3">
        {PREVIEW_CONTENT.pricing.plans.map((t, i) => {
          const pop = i === 1;
          return (
            <Card key={t.name} className={["relative", pop ? "ring-2 ring-[var(--primary)]/30" : ""].join(" ")}>
              {pop && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>最受欢迎</span>
              )}
              <p className="text-[10px] font-semibold">{t.name}</p>
              <p className="mt-1 text-lg font-black">{t.price}{t.period && <span className="text-[9px] font-normal" style={{ color: "var(--muted-foreground)" }}>{t.period}</span>}</p>
              <span className="mt-2 block rounded-md py-1.5 text-center text-[9px] font-medium" style={pop ? { background: "var(--primary)", color: "#fff" } : { border: "1px solid var(--border)" }}>{t.cta}</span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Pricing Tiers（{PREVIEW_CONTENT.nav.pricing}页） ───────── */
function PricingTiersPreview({ variantId }: { variantId: string }) {
  if (variantId === "ptiers_single")
    return (
      <div className="px-6 py-7">
        <div className="text-center">
          <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title} sub={PREVIEW_CONTENT.pricing.subtitle} center />
        </div>
        <Card className="mx-auto mt-5 max-w-xs text-center ring-2 ring-[var(--primary)]/30">
          <p className="text-[length:var(--text-h1)] font-black">$19<span className="text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>/月</span></p>
          <span className="mt-4 block rounded-md py-2 text-xs font-medium text-[var(--on-primary)] transition-transform duration-150 hover:scale-[1.02] active:scale-95" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.cta.primary}</span>
          <ul className="mt-4 space-y-1.5 text-left text-[10px]">
            {["无限项目", "所有集成", "优先支持"].map((f) => (
              <li key={f} className="flex items-center gap-1.5"><span className="flex size-3.5 items-center justify-center rounded-full text-[8px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✓</span>{f}</li>
            ))}
          </ul>
          <p className="mt-3 border-t pt-2 text-[9px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>✓ 30 天退款保证</p>
        </Card>
      </div>
    );
  if (variantId === "ptiers_billing")
    return (
      <div className="px-6 py-7">
        <div className="flex items-center justify-center gap-2 text-[10px]">
          <span style={{ color: "var(--muted-foreground)" }}>月付</span>
          <span className="relative inline-block h-4 w-8 rounded-full" style={{ background: "var(--primary)" }}><span className="absolute left-[18px] top-0.5 size-3 rounded-full bg-white" /></span>
          <span className="font-semibold">年付 <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] text-green-700">省 20%</span></span>
        </div>
        <div className="mx-auto mt-3 grid max-w-sm grid-cols-3 gap-2">
          {[
            { n: "基础", p: "$15" },
            { n: "专业", p: "$39" },
            { n: "旗舰", p: "$79" },
          ].map((t) => (
            <Card key={t.n} className="text-center">
              <p className="text-[10px] font-semibold">{t.n}</p>
              <p className="mt-1 text-base font-black">{t.p}</p>
              <span className="mt-1.5 block rounded-md py-1 text-[9px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>选择</span>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "ptiers_enterprise")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-sm grid-cols-3 items-stretch gap-2">
          <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold">免费</p><p className="mt-1 text-base font-black">$0</p>
            <span className="mt-1.5 block rounded-md border py-1 text-center text-[9px]" style={{ borderColor: "var(--border)" }}>开始</span>
          </div>
          <div className="rounded-lg p-2.5 text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
            <p className="text-[10px] font-semibold">专业</p><p className="mt-1 text-base font-black">$29</p>
            <span className="mt-1.5 block rounded-md bg-white py-1 text-center text-[9px] font-medium text-slate-900">升级</span>
          </div>
          <div className="rounded-lg border border-dashed p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold">企业</p><p className="mt-1 text-base font-black">定制</p>
            <span className="mt-1.5 block rounded-md border py-1 text-center text-[9px]" style={{ borderColor: "var(--border)" }}>联系</span>
          </div>
        </div>
      </div>
    );
  if (variantId === "ptiers_highlight")
    return (
      <div className="px-6 py-7">
        <div className="text-center">
          <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title} center />
        </div>
        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 items-stretch gap-2">
          {[
            { n: "免费", p: "$0", f: ["3 个项目", "社区支持"], pop: false },
            { n: "专业", p: "$29", f: ["无限项目", "优先支持", "高级分析"], pop: true },
            { n: "企业", p: "定制", f: ["SSO / SAML", "专属客服"], pop: false },
          ].map((t) => (
            <div
              key={t.n}
              className="relative flex flex-col rounded-xl p-3"
              style={
                t.pop
                  ? {
                      background: "color-mix(in srgb, var(--primary) 8%, var(--surface))",
                      border: "1px solid var(--primary)",
                      boxShadow: "0 20px 44px -24px color-mix(in srgb, var(--primary) 70%, transparent)",
                    }
                  : { background: "var(--surface)", border: "1px solid var(--border)" }
              }
            >
              {t.pop && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-semibold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>推荐</span>
              )}
              <p className="text-[10px] font-semibold" style={{ color: t.pop ? "var(--primary)" : "var(--foreground)" }}>{t.n}</p>
              <p className="mt-1 text-base font-black">{t.p}</p>
              <ul className="mt-2 flex-1 space-y-1 text-[8px]" style={{ color: "var(--muted-foreground)" }}>
                {t.f.map((x) => (
                  <li key={x} className="flex items-center gap-1"><span style={{ color: "var(--primary)" }}>✓</span>{x}</li>
                ))}
              </ul>
              <span
                className="mt-2 block rounded-md py-1 text-center text-[9px] font-medium"
                style={t.pop ? { background: "var(--primary)", color: "var(--on-primary)" } : { border: "1px solid var(--border)", color: "var(--foreground)" }}
              >
                选择
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  // 未匹配变体兜底：三档 + 推荐档强调
  return (
    <div className="px-6 py-7">
      <div className="text-center">
        <SectionHead badge="定价方案" title={PREVIEW_CONTENT.pricing.title} center />
      </div>
      <div className="mx-auto mt-5 grid max-w-md grid-cols-3 items-center gap-2">
        {[
          { n: "免费", p: "$0", pop: false },
          { n: "专业", p: "$29", pop: true },
          { n: "企业", p: "定制", pop: false },
        ].map((t) => (
          <Card key={t.n} className={["relative", t.pop ? "scale-[1.04] ring-2 ring-[var(--primary)]/30" : ""].join(" ")}>
            {t.pop && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[8px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>最受欢迎</span>}
            <p className="text-[10px] font-semibold">{t.n}</p>
            <p className="mt-1 text-base font-black">{t.p}</p>
            <span className="mt-1.5 block rounded-md py-1 text-center text-[9px] font-medium" style={t.pop ? { background: "var(--primary)", color: "#fff" } : { border: "1px solid var(--border)" }}>选择</span>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ───────── Pricing Compare ───────── */
function PricingComparePreview({ variantId }: { variantId: string }) {
  const plans = PREVIEW_CONTENT.pricing.plans;
  const tierNames = plans.map((p) => p.name);
  const tabFeatures = plans[0]?.features?.length ? plans[0].features : ["项目数", "高级分析", "SSO"];
  const rows = tabFeatures.map((feature, fi) => ({
    f: feature,
    v: plans.map((p) => (p.features && p.features[fi] ? "✓" : "—")),
  }));
  if (variantId === "pcomp_dark")
    return (
      <div className="bg-slate-900 px-6 py-7">
        <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-[10px] text-slate-100">
            <thead><tr className="border-b border-white/10"><th className="p-2 text-left font-semibold">功能</th>{tierNames.map((p, i) => <th key={p} className="p-2 text-center font-semibold">{p}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-b border-white/10 last:border-0">
                  <td className="p-2 text-slate-300">{r.f}</td>
                  {r.v.map((v, i) => <td key={i} className="p-2 text-center">{v === "✓" ? <span className="text-green-400">✓</span> : v === "—" ? <span className="text-slate-600">—</span> : v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (variantId === "pcomp_highlight")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="p-2 text-left font-semibold">功能</th>
                {tierNames.map((p, i) => (
                  <th key={p} className={"p-2 text-center font-semibold " + (i === 1 ? "bg-primary/10" : "")}>
                    {p}{i === 1 && <span className="mt-0.5 block rounded-full py-0.5 text-[8px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>最受欢迎</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="p-2">{r.f}</td>
                  {r.v.map((v, i) => <td key={i} className={"p-2 text-center " + (i === 1 ? "bg-primary/10" : "")}>{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (variantId === "pcomp_editorial")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm">
          <div className="flex items-baseline justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
            <span className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>功能</span>
            <div className="flex gap-6">{tierNames.map((p, i) => <span key={p} className="w-10 text-center text-[11px] font-semibold" style={{ fontFamily: "var(--font-heading)", color: i === 1 ? "var(--primary)" : "var(--foreground)" }}>{p}</span>)}</div>
          </div>
          {rows.map((r) => (
            <div key={r.f} className="flex items-center justify-between border-b py-2.5" style={{ borderColor: "var(--border)" }}>
              <span className="text-[10px] font-medium">{r.f}</span>
              <div className="flex gap-6">{r.v.map((v, i) => <span key={i} className="w-10 text-center text-[10px]" style={{ fontFamily: "var(--font-heading)", color: i === 1 ? "var(--primary)" : v === "✓" ? "var(--foreground)" : "var(--muted-foreground)" }}>{v === "✓" ? <b>✓</b> : v}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pcomp_bento")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
          {plans.map((x, xi) => (
            <div key={x.name} className={"rounded-lg p-2.5 " + (xi === 1 ? "ring-2" : "border")} style={xi === 1 ? { background: "color-mix(in srgb, var(--primary) 8%, var(--surface))", boxShadow: "0 0 0 2px var(--primary)" } : { borderColor: "var(--border)", background: "var(--surface)" }}>
              {xi === 1 && <span className="block rounded-full bg-primary px-1 py-0.5 text-center text-[7px] font-medium text-white">热门</span>}
              <p className="mt-1 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{x.name}</p>
              <ul className="mt-1 space-y-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>{(x.features || []).slice(0, 3).map((n) => <li key={n} className="flex items-center gap-1"><span style={{ color: "var(--primary)" }}>✓</span>{n}</li>)}</ul>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pcomp_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="mx-auto max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: "#262629" }}>
          <table className="w-full text-[9px] text-slate-100">
            <thead><tr className="border-b" style={{ borderColor: "#262629" }}><th className="p-2 text-left text-slate-400">功能</th>{tierNames.map((p, i) => <th key={p} className="p-2 text-center" style={{ color: i === 1 ? "#22D3EE" : "inherit" }}>{p}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "#262629" }}>
                  <td className="p-2 text-slate-300">{r.f}</td>
                  {r.v.map((v, i) => <td key={i} className="p-2 text-center" style={{ color: i === 1 ? "#22D3EE" : "inherit" }}>{v === "✓" ? "◆" : v === "—" ? "·" : v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (variantId === "pcomp_standard")
    return (
      <div className="px-6 py-7">
        <h3 className="text-center text-sm font-bold">功能对比</h3>
        <p className="mt-1 text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>逐项对齐，帮你选对档位</p>
        <div className="mx-auto mt-3 max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr style={{ background: "var(--surface)" }}>
                <th className="border-b p-2 text-left font-semibold" style={{ borderColor: "var(--border)" }}>功能</th>
                {plans.map((p) => (
                  <th key={p.name} className="border-b p-2 text-center font-semibold" style={{ borderColor: "var(--border)" }}>
                    {p.name}
                    <span className="mt-0.5 block text-[8px] font-normal" style={{ color: "var(--muted-foreground)" }}>{p.price}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.f} style={{ background: ri % 2 === 1 ? "color-mix(in srgb, var(--foreground) 4%, transparent)" : "transparent" }}>
                  <td className="border-b p-2" style={{ borderColor: "var(--border)" }}>{r.f}</td>
                  {r.v.map((v, i) => (
                    <td key={i} className="border-b p-2 text-center" style={{ borderColor: "var(--border)" }}>
                      {v === "✓" ? <span style={{ color: "var(--primary)" }}>✓</span> : <span style={{ color: "var(--muted-foreground)" }}>{v}</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-2" />
                {plans.map((p) => (
                  <td key={p.name} className="p-2 text-center">
                    <span className="inline-block rounded-md border px-2 py-0.5 text-[8px] font-medium" style={{ borderColor: "var(--border)" }}>选择</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  // 未匹配变体兜底：分组对比表
  return (
    <div className="px-6 py-7">
      <h3 className="text-center text-sm font-bold">功能对比</h3>
      <div className="mx-auto mt-3 max-w-sm overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <th className="p-2 text-left font-semibold">功能</th>
              {tierNames.map((p) => <th key={p} className="p-2 text-center font-semibold">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}><td colSpan={4} className="bg-muted/40 p-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">基础</td></tr>
            {rows.slice(0, 2).map((r) => (
              <tr key={r.f} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="p-2">{r.f}</td>
                {r.v.map((v, i) => <td key={i} className="p-2 text-center">{v}</td>)}
              </tr>
            ))}
            <tr className="border-b" style={{ borderColor: "var(--border)" }}><td colSpan={4} className="bg-muted/40 p-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">企业</td></tr>
            {rows.slice(2).map((r) => (
              <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-2">{r.f}</td>
                {r.v.map((v, i) => <td key={i} className="p-2 text-center">{v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────── Auth Login ───────── */
function AuthLoginPreview({ variantId }: { variantId: string }) {
  const field = (label: string, ph: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium">{label}</label>
      <span className="rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>{ph}</span>
    </div>
  );
  if (variantId === "alogin_dark")
    return (
      <div className="flex min-h-56 items-center justify-center bg-slate-900 px-6">
        <div className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-800/60 p-5">
          <h3 className="text-center text-sm font-bold text-white">欢迎回来</h3>
          <div className="mt-3 space-y-2.5">
            {field(PREVIEW_CONTENT.auth.email, "you@example.com")}
            {field(PREVIEW_CONTENT.auth.password, "••••••••")}
          </div>
          <span className="mt-3 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
        </div>
      </div>
    );
  if (variantId === "alogin_minimal")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-xs">
          <h3 className="text-center text-base font-bold tracking-tight">登录</h3>
          <div className="mt-5 space-y-4">
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.email}</span>
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.password}</span>
          </div>
          <span className="mt-4 block rounded-full py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
        </div>
      </div>
    );
  if (variantId === "alogin_left")
    return (
      <div className="flex min-h-56 items-center px-6" style={{ background: "var(--surface)" }}>
        <div className="mx-auto w-full max-w-xs">
          <p className="text-sm font-bold">{PREVIEW_CONTENT.brand}</p>
          <h3 className="mt-5 text-base font-bold">登录</h3>
          <div className="mt-3 space-y-2.5">{field(PREVIEW_CONTENT.auth.email, "you@example.com")}{field(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
          <span className="mt-3 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
          <span className="mt-2 block rounded-md border py-1.5 text-center text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>使用 Google 登录</span>
        </div>
      </div>
    );
  if (variantId === "alogin_glass")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)), var(--background) 55%, color-mix(in srgb, var(--secondary) 10%, var(--background)))" }}>
        <div className="w-full max-w-xs rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.22)" }}>
          <div className="text-center">
            <span className="mx-auto flex size-9 items-center justify-center rounded-lg text-sm font-black text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 10px 24px color-mix(in srgb, var(--primary) 35%, transparent)" }}>A</span>
            <h3 className="mt-2 text-sm font-bold">欢迎回来</h3>
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
          </div>
          <div className="mt-3 space-y-2.5">{field(PREVIEW_CONTENT.auth.email, "you@example.com")}{field(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
          <span className="mt-3 block rounded-lg py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent)" }}>登录</span>
        </div>
      </div>
    );
  if (variantId === "alogin_editorial")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-xs">
          <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.brand}</p>
          <h3 className="mt-3 text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>欢迎回来</h3>
          <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
          <div className="mt-4 space-y-4">
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.email}</span>
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.password}</span>
          </div>
          <span className="mt-4 block rounded-full py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
        </div>
      </div>
    );
  if (variantId === "alogin_terminal")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "#0A0A0B" }}>
        <div className="w-full max-w-xs rounded-lg border p-4 font-mono text-[10px]" style={{ borderColor: "#262629", background: "#141416" }}>
          <p style={{ color: "#22D3EE" }}>~/sign-in</p>
          <p className="mt-3 text-slate-400">email:</p>
          <span className="mt-1 block border px-2 py-1.5 text-slate-200" style={{ borderColor: "#262629" }}>you@example.com</span>
          <p className="mt-2.5 text-slate-400">password:</p>
          <span className="mt-1 block border px-2 py-1.5 text-slate-200" style={{ borderColor: "#262629" }}>••••••••</span>
          <span className="mt-3 block rounded border py-1.5 text-center font-semibold" style={{ borderColor: "#22D3EE", color: "#22D3EE" }}>$ ./sign-in --flag</span>
        </div>
      </div>
    );
  if (variantId === "alogin_center")
    return (
      <div
        className="flex min-h-56 items-center justify-center px-6"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--primary) 10%, transparent), transparent 65%), var(--background)" }}
      >
        <div
          className="w-full max-w-[15rem] rounded-2xl border p-5 text-center"
          style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "0 26px 54px -32px rgba(0,0,0,0.4)" }}
        >
          <span className="mx-auto flex size-9 items-center justify-center rounded-xl text-sm font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.brand.slice(0, 1)}</span>
          <h3 className="mt-2.5 text-sm font-bold">{PREVIEW_CONTENT.auth.loginTitle}</h3>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
          <div className="mt-3.5 space-y-2 text-left">{field(PREVIEW_CONTENT.auth.email, "you@example.com")}{field(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
          <span className="mt-3 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
          <p className="mt-2.5 text-[9px]" style={{ color: "var(--muted-foreground)" }}>还没有账号？<span style={{ color: "var(--primary)" }}>免费注册</span></p>
        </div>
      </div>
    );
  // 未匹配变体兜底：居中卡片 + 社交登录
  return (
    <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-xs rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="text-center">
          <span className="mx-auto flex size-9 items-center justify-center rounded-lg text-sm font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</span>
          <h3 className="mt-2 text-sm font-bold">欢迎回来</h3>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
        </div>
        <div className="mt-3 space-y-2.5">{field(PREVIEW_CONTENT.auth.email, "you@example.com")}{field(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
        <div className="mt-2 flex items-center justify-between text-[9px]">
          <label className="flex items-center gap-1"><input type="checkbox" className="accent-[var(--primary)]" /> 记住我</label>
          <a style={{ color: "var(--primary)" }}>忘记{PREVIEW_CONTENT.auth.password}？</a>
        </div>
        <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
        <div className="my-3 flex items-center gap-2 text-[9px]" style={{ color: "var(--muted-foreground)" }}><span className="h-px flex-1" style={{ background: "var(--border)" }} />或<span className="h-px flex-1" style={{ background: "var(--border)" }} /></div>
        <div className="grid grid-cols-2 gap-2">
          <span className="rounded-md border py-1 text-center text-[9px] font-medium" style={{ borderColor: "var(--border)" }}>Google</span>
          <span className="rounded-md border py-1 text-center text-[9px] font-medium" style={{ borderColor: "var(--border)" }}>GitHub</span>
        </div>
      </div>
    </div>
  );
}

/* ───────── Auth Social ───────── */
function AuthSocialPreview({ variantId }: { variantId: string }) {
  if (variantId === "asocial_stacked")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xs space-y-2">
          {["使用 Google 登录", "使用 GitHub 登录", "使用 Microsoft 登录"].map((l) => (
            <span key={l} className="block rounded-md border py-2 text-center text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>{l}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "asocial_iconrow")
    return (
      <div className="px-6 py-7">
        <div className="flex justify-center gap-2.5">
          {["G", "GH", ""].map((s, i) => (
            <span key={i} className="flex size-10 items-center justify-center rounded-full border text-xs font-semibold" style={{ borderColor: "var(--border)" }}>{s}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "asocial_glass")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-xs grid-cols-3 gap-2">
          {["Google", "GitHub", "Apple"].map((s) => (
            <span key={s} className="rounded-xl border py-2 text-center text-[10px] font-medium" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 55%, transparent)", backdropFilter: "blur(12px)" }}>{s}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "asocial_pill")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xs space-y-2">
          {["使用 Google 登录", "使用 GitHub 登录", "使用 Microsoft 登录"].map((l) => (
            <span key={l} className="block rounded-full border py-2 text-center text-[10px] font-medium" style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))", background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--surface)), color-mix(in srgb, var(--secondary) 6%, var(--surface)))" }}>{l}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "asocial_divider")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xs">
          <span className="block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
            使用{PREVIEW_CONTENT.auth.email}登录
          </span>
          <div className="my-3 flex items-center gap-2 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
            <span className="h-px flex-1" style={{ background: "var(--border)" }} />或使用以下方式<span className="h-px flex-1" style={{ background: "var(--border)" }} />
          </div>
          <div className="space-y-2">
            {["Google", "GitHub", "Apple"].map((s) => (
              <span
                key={s}
                className="flex items-center justify-center gap-2 rounded-md border py-1.5 text-[10px] font-medium"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <BrandMark name={s} className="size-3" />继续使用 {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  // 未匹配变体兜底：分隔线 + 三宫格
  return (
    <div className="px-6 py-7">
      <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />或继续使用<span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <div className="mx-auto mt-3 grid max-w-xs grid-cols-3 gap-2">
        {["Google", "GitHub", "Apple"].map((s) => (
          <span key={s} className="rounded-md border py-2 text-center text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>{s}</span>
        ))}
      </div>
    </div>
  );
}

/* ───────── Auth Split ───────── */
function AuthSplitPreview({ variantId }: { variantId: string }) {
  const formCol = (
    <div className="w-full max-w-xs">
      <h3 className="text-sm font-bold">欢迎回来</h3>
      <div className="mt-3 space-y-2">
        <span className="block rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>you@example.com</span>
        <span className="block rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>••••••••</span>
      </div>
      <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
    </div>
  );
  if (variantId === "asplit_dark")
    return (
      <div className="grid min-h-56 bg-slate-950 sm:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-900 p-5 sm:flex">
          <p className="text-xs font-bold text-white">{PREVIEW_CONTENT.brand}</p>
          <p className="text-sm font-semibold leading-snug text-white">为高绩效团队而生</p>
        </div>
        <div className="flex items-center justify-center px-6 py-7">{formCol}</div>
      </div>
    );
  if (variantId === "asplit_image")
    return (
      <div className="grid min-h-56 sm:grid-cols-2">
        <div className="relative hidden items-end bg-slate-700 p-4 sm:flex">
          <div className="absolute inset-0 bg-black/50" />
          <p className="relative z-10 text-xs font-semibold text-white">"最好的决策工具，没有之一。"</p>
        </div>
        <div className="flex items-center justify-center px-6 py-7">{formCol}</div>
      </div>
    );
  if (variantId === "asplit_glass")
    return (
      <div className="grid min-h-56 sm:grid-cols-2">
        <div className="hidden flex-col justify-between p-5 text-white sm:flex" style={{ background: "linear-gradient(150deg, var(--primary), color-mix(in srgb, var(--secondary) 70%, var(--primary)))" }}>
          <p className="text-xs font-bold">{PREVIEW_CONTENT.brand}</p>
          <p className="text-lg font-black leading-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>让每个团队<br />都高效工作</p>
        </div>
        <div className="flex items-center justify-center px-6 py-7" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--background)), var(--background) 60%)" }}>
          <div className="w-full max-w-xs rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.22)" }}>{formCol}</div>
        </div>
      </div>
    );
  if (variantId === "asplit_editorial")
    return (
      <div className="grid min-h-56 sm:grid-cols-2">
        <div className="hidden flex-col justify-between p-6 sm:flex" style={{ background: "var(--background)", borderRight: "1px solid var(--border)" }}>
          <p className="text-sm font-bold" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{PREVIEW_CONTENT.brand}</p>
          <p className="text-2xl font-black leading-[1.05]" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>少即是多，<br />多即是繁。</p>
          <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>© 2025 {PREVIEW_CONTENT.brand}</p>
        </div>
        <div className="flex items-center justify-center px-6 py-7" style={{ background: "var(--surface)" }}>
          <div className="w-full max-w-xs">
            <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>欢迎回来</h3>
            <div className="mt-4 space-y-3">
              <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.email}</span>
              <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.password}</span>
            </div>
            <span className="mt-4 block rounded-full py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
          </div>
        </div>
      </div>
    );
  if (variantId === "asplit_brand")
    return (
      <div className="grid min-h-56 sm:grid-cols-[1.05fr_1fr]">
        <div
          className="hidden flex-col justify-between p-5 text-[var(--on-primary)] sm:flex"
          style={{ background: "linear-gradient(150deg, var(--primary), color-mix(in srgb, var(--secondary) 80%, var(--primary)))" }}
        >
          <p className="flex items-center gap-1.5 text-xs font-bold">
            <span className="flex size-5 items-center justify-center rounded-md text-[9px] font-black" style={{ background: "rgba(255,255,255,0.22)" }}>{PREVIEW_CONTENT.brand.slice(0, 1)}</span>
            {PREVIEW_CONTENT.brand}
          </p>
          <div>
            <p className="text-sm font-semibold leading-snug">让每个团队都高效工作</p>
            <ul className="mt-2 space-y-1 text-[10px]" style={{ opacity: 0.85 }}>
              {["从骨架到上线一站式", "内置数据看板", "SOC2 级安全"].map((x) => (
                <li key={x} className="flex items-center gap-1.5"><span>✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className="flex items-center gap-1.5 text-[9px]" style={{ opacity: 0.85 }}>
            <span className="flex">
              {[0, 1, 2].map((i) => (
                <span key={i} className="-ml-1 size-4 rounded-full border first:ml-0" style={{ borderColor: "rgba(255,255,255,0.55)", background: "rgba(255,255,255,0.24)" }} />
              ))}
            </span>
            2,000+ 团队正在使用
          </div>
        </div>
        <div className="flex items-center justify-center px-6 py-7" style={{ background: "var(--surface)" }}>
          <div className="w-full max-w-xs">
            <h3 className="text-sm font-bold">{PREVIEW_CONTENT.auth.loginTitle}</h3>
            <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>使用工作邮箱登录</p>
            <div className="mt-3 space-y-2">
              <span className="block rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>you@example.com</span>
              <span className="block rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>••••••••</span>
            </div>
            <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</span>
            <p className="mt-2 text-[9px]" style={{ color: "var(--muted-foreground)" }}>还没有账号？<span style={{ color: "var(--primary)" }}>免费注册</span></p>
          </div>
        </div>
      </div>
    );
  // 未匹配变体兜底：品牌渐变 + 表单
  return (
    <div className="grid min-h-56 sm:grid-cols-2">
      <div className="hidden flex-col justify-between p-5 text-white sm:flex" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
        <p className="text-xs font-bold">{PREVIEW_CONTENT.brand}</p>
        <div>
          <p className="text-sm font-semibold leading-snug">让每个团队都高效工作</p>
          <p className="mt-1 text-[10px] text-white/80">一站式工作台，从项目到数据全链路。</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-7">{formCol}</div>
    </div>
  );
}

/* ───────── Auth Signup ───────── */
function AuthSignupPreview({ variantId }: { variantId: string }) {
  const f = (l: string, ph: string) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium">{l}</label>
      <span className="rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>{ph}</span>
    </div>
  );
  if (variantId === "asignup_company")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto w-full max-w-xs">
          <h3 className="text-sm font-bold">创建企业账号</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">{f("公司名", "{PREVIEW_CONTENT.brand} Inc.")}{f("团队规模", "1-10 人")}{f("工作{PREVIEW_CONTENT.auth.email}", "you@company.com")}</div>
          <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>创建账号</span>
        </div>
      </div>
    );
  if (variantId === "asignup_steps")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto w-full max-w-xs">
          <h3 className="text-sm font-bold">创建账号</h3>
          <div className="mt-2 flex gap-1">
            <span className="h-1 flex-1 rounded-full" style={{ background: "var(--primary)" }} />
            <span className="h-1 flex-1 rounded-full opacity-20" style={{ background: "var(--primary)" }} />
          </div>
          <p className="mt-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>第 1 步，共 2 步</p>
          <div className="mt-2 space-y-2">{f("姓名", "张三")}{f(PREVIEW_CONTENT.auth.email, "you@example.com")}</div>
          <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>下一步</span>
        </div>
      </div>
    );
  if (variantId === "asignup_glass")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto w-full max-w-xs rounded-2xl border p-5" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px rgba(0,0,0,0.22)" }}>
          <h3 className="text-sm font-bold">创建账号</h3>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>14 天{PREVIEW_CONTENT.cta.secondary}，无需信用卡。</p>
          <div className="mt-3 space-y-2">{f("姓名", "张三")}{f(PREVIEW_CONTENT.auth.email, "you@example.com")}{f(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
          <span className="mt-2.5 block rounded-lg py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent)" }}>免费注册</span>
        </div>
      </div>
    );
  if (variantId === "asignup_editorial")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto w-full max-w-xs">
          <h3 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>创建账号</h3>
          <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>14 天{PREVIEW_CONTENT.cta.secondary}，无需信用卡。</p>
          <div className="mt-4 space-y-3">
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>姓名</span>
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.email}</span>
            <span className="block border-b pb-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.auth.password}</span>
          </div>
          <span className="mt-4 block rounded-full py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</span>
        </div>
      </div>
    );
  if (variantId === "asignup_gradient")
    return (
      <div className="flex min-h-56 items-center justify-center px-6" style={{ background: "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 50%, var(--secondary)))" }}>
        <div className="w-full max-w-xs rounded-xl border p-4" style={{ border: "1px solid #ffffff33", background: "rgba(255,255,255,0.75)", backdropFilter: "blur(16px)" }}>
          <h3 className="text-base font-bold text-slate-900">创建账号</h3>
          <div className="mt-3 space-y-2">
            <span className="block rounded-md px-2.5 py-2 text-[10px] text-slate-500" style={{ background: "#fff" }}>you@example.com</span>
            <span className="block rounded-md px-2.5 py-2 text-[10px] text-slate-500" style={{ background: "#fff" }}>••••••••</span>
          </div>
          <span className="mt-3 block rounded-md py-2 text-center text-[10px] font-bold text-[var(--on-primary)]" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>注册</span>
        </div>
      </div>
    );
  if (variantId === "asignup_standard")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto w-full max-w-xs rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <h3 className="text-sm font-bold">{PREVIEW_CONTENT.auth.signupTitle}</h3>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>14 天{PREVIEW_CONTENT.cta.secondary}，无需信用卡。</p>
          <div className="mt-3 space-y-2">{f(PREVIEW_CONTENT.auth.username, "张三")}{f(PREVIEW_CONTENT.auth.email, "you@example.com")}{f(PREVIEW_CONTENT.auth.password, "至少 8 位")}</div>
          <div className="mt-1.5 flex gap-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 flex-1 rounded-full" style={{ background: i < 2 ? "var(--primary)" : "color-mix(in srgb, var(--primary) 18%, transparent)" }} />
            ))}
          </div>
          <p className="mt-1 text-[8px]" style={{ color: "var(--muted-foreground)" }}>密码强度：中等</p>
          <label className="mt-2.5 flex items-start gap-1.5 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
            <input type="checkbox" className="mt-0.5 accent-[var(--primary)]" />
            <span>我已阅读并同意<span style={{ color: "var(--primary)" }}>服务条款</span>与<span style={{ color: "var(--primary)" }}>隐私政策</span></span>
          </label>
          <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</span>
          <p className="mt-2 text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>已有账号？<span style={{ color: "var(--primary)" }}>登录</span></p>
        </div>
      </div>
    );
  // 未匹配变体兜底：三字段注册
  return (
    <div className="px-6 py-7">
      <div className="mx-auto w-full max-w-xs">
        <h3 className="text-sm font-bold">创建账号</h3>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>14 天{PREVIEW_CONTENT.cta.secondary}，无需信用卡。</p>
        <div className="mt-3 space-y-2">{f("姓名", "张三")}{f(PREVIEW_CONTENT.auth.email, "you@example.com")}{f(PREVIEW_CONTENT.auth.password, "••••••••")}</div>
        <span className="mt-2.5 block rounded-md py-1.5 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</span>
      </div>
    </div>
  );
}

/* ───────── Dashboard Sidebar ───────── */
function DashSidebarPreview({ variantId }: { variantId: string }) {
  const items = ["仪表盘", "项目", "分析", "设置"];
  if (variantId === "dsb_icon")
    return (
      <div className="flex h-56 w-14 flex-col items-center border-r py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <span className="flex size-8 items-center justify-center rounded-lg text-xs font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</span>
        <div className="mt-4 flex flex-1 flex-col items-center gap-1.5">
          {["▦", "▤", "📊", "⚙"].map((ic, i) => (
            <span key={i} className="flex size-8 items-center justify-center rounded-lg text-xs" style={i === 0 ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted-foreground)" }}>{ic}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "dsb_dark")
    return (
      <div className="flex h-56 w-44 flex-col bg-slate-900 p-2.5 text-slate-100">
        <p className="flex items-center gap-1.5 px-2 py-2 text-xs font-bold"><span className="flex size-6 items-center justify-center rounded-md text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</span>{PREVIEW_CONTENT.brand}</p>
        <div className="mt-1 flex-1 space-y-1">
          {items.map((i, idx) => (
            <p key={i} className={"rounded-md px-2.5 py-1.5 text-[10px] " + (idx === 0 ? "text-[var(--on-primary)]" : "text-slate-400")} style={idx === 0 ? { background: "var(--primary)" } : {}}>{i}</p>
          ))}
        </div>
        <p className="border-t border-white/10 px-2.5 py-2 text-[10px] text-slate-300">张三</p>
      </div>
    );
  if (variantId === "dsb_glass")
    return (
      <div className="flex h-56 w-44 flex-col border-r p-2" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(16px)" }}>
        <p className="flex items-center gap-1.5 px-2 py-2 text-xs font-bold">
          <span className="flex size-6 items-center justify-center rounded-md text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</span>{PREVIEW_CONTENT.brand}
        </p>
        <div className="flex-1 space-y-1">
          {items.map((i, idx) => (
            <p key={i} className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium" style={idx === 0 ? { background: "color-mix(in srgb, var(--primary) 14%, transparent)", color: "var(--primary)", boxShadow: "0 8px 24px color-mix(in srgb, var(--primary) 18%, transparent)" } : { color: "var(--muted-foreground)" }}>{i}</p>
          ))}
        </div>
        <p className="border-t px-2.5 py-2 text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>张三</p>
      </div>
    );
  if (variantId === "dsb_editorial")
    return (
      <div className="flex h-56 w-44 flex-col px-4 py-5" style={{ background: "var(--background)" }}>
        <span className="font-bold tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif", fontSize: "1rem" }}>{PREVIEW_CONTENT.brand}</span>
        <div className="mt-3">
          {items.map((i, idx) => (
            <p key={i} className="border-b py-2.5 text-[10px]" style={idx === 0 ? { color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", fontWeight: 600 } : { color: "var(--muted-foreground)", borderColor: "var(--border)" }}>{i}</p>
          ))}
        </div>
      </div>
    );
  if (variantId === "dsb_standard")
    return (
      <div className="flex h-56 w-44 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold">
          <span className="flex size-6 items-center justify-center rounded-md text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{PREVIEW_CONTENT.brand.slice(0, 1)}</span>{PREVIEW_CONTENT.brand}
        </p>
        <p className="px-3 pb-1 text-[8px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted-foreground)" }}>主导航</p>
        <div className="flex-1 space-y-0.5 px-2">
          {items.map((label, idx) => (
            <p
              key={label}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[10px] font-medium"
              style={idx === 0 ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}
            >
              <span aria-hidden>{["▦", "▤", "📊", "⚙"][idx] ?? "•"}</span>{label}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>张</span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium">张三</p>
            <p className="truncate text-[8px]" style={{ color: "var(--muted-foreground)" }}>zhang@acme.com</p>
          </div>
        </div>
      </div>
    );
  if (variantId === "dsb_ops_console")
    return (
      <div className="flex h-56 w-44 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-black">{PREVIEW_CONTENT.brand}</span>
          <span className="rounded-md border px-1 py-0.5 text-[8px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌘K</span>
        </div>
        <div
          className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 text-[9px]"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--muted-foreground)" }}
        >
          <span style={{ color: "var(--primary)" }}>⌘</span>命令中心…
        </div>
        <div className="flex-1 space-y-0.5 px-2">
          {[
            { l: "工作台", b: "", active: true },
            { l: "订单", b: "12", active: false },
            { l: "任务", b: "4", active: false },
            { l: "数据", b: "", active: false },
            { l: "配置", b: "", active: false },
          ].map((n) => (
            <p
              key={n.l}
              className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-[10px] font-medium"
              style={n.active ? { background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}
            >
              <span>{n.l}</span>
              {n.b ? (
                <span className="rounded-full px-1.5 text-[8px] font-semibold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{n.b}</span>
              ) : (
                <span className="size-1.5 rounded-full" style={{ background: n.active ? "var(--success)" : "transparent" }} />
              )}
            </p>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>运</span>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium">张三</p>
            <p className="flex items-center gap-1 truncate text-[8px]" style={{ color: "var(--muted-foreground)" }}>
              <span className="size-1 rounded-full" style={{ background: "var(--success)" }} />运营负责人 · 在线
            </p>
          </div>
        </div>
      </div>
    );
  // 未匹配变体兜底：标准文字侧栏
  return (
    <div className="flex h-56 w-44 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold">
        <span className="flex size-6 items-center justify-center rounded-md text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</span>{PREVIEW_CONTENT.brand}
      </p>
      <div className="flex-1 space-y-1 px-2">
        {items.map((i, idx) => (
          <p key={i} className="rounded-md px-2.5 py-1.5 text-[10px] font-medium" style={idx === 0 ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{i}</p>
        ))}
      </div>
      <div className="border-t px-2 py-2" style={{ borderColor: "var(--border)" }}>
        <p className="text-[10px] font-medium">张三</p>
        <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>zhang@acme.com</p>
      </div>
    </div>
  );
}

/* ───────── Dashboard KPI ───────── */
function DashKpiPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const kpis = dash.kpis.length
    ? dash.kpis.map((k) => ({ l: k.label, v: k.value, d: k.trend, up: !k.trend.startsWith("-") }))
    : [{ l: "活跃用户", v: "12,847", d: "+12%", up: true }];
  if (variantId === "dkpi_dark")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-lg border border-white/10 bg-slate-900 p-3">
              <p className="text-[9px] text-slate-400">{k.l}</p>
              <p className="mt-1 text-sm font-black text-white">{k.v}</p>
              <p className="mt-0.5 text-[9px] font-medium" style={{ color: k.up ? "#34d399" : "#f87171" }}>{k.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_horizontal")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {kpis.map((k) => (
            <div key={k.l}><p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p><p className="text-xs font-bold">{k.v}</p></div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_spark")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map((k, i) => (
            <div key={k.l} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
              <p className="mt-1 text-sm font-black">{k.v}</p>
              <svg viewBox="0 0 60 20" className="mt-1 h-6 w-full" preserveAspectRatio="none">
                <polyline points={["0,18 12,14 24,16 36,10 48,12 60,5", "0,16 12,12 24,14 36,8 48,10 60,4", "0,6 12,10 24,8 36,14 48,16 60,18"][i]} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
              </svg>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_bento")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 rounded-xl p-4" style={{ background: "var(--primary)", color: "#fff" }}>
            <p className="text-[9px] opacity-80">{kpis[0].l}</p>
            <p className="mt-1 text-lg font-black">{kpis[0].v}</p>
            <p className="mt-0.5 text-[9px] opacity-90">{kpis[0].d} 较上周</p>
          </div>
          {kpis.slice(0, 2).map((k) => (
            <div key={k.l} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
              <p className="mt-1 text-sm font-bold">{k.v}</p>
              <p className="mt-0.5 text-[9px]" style={{ color: k.up ? "#059669" : "#dc2626" }}>{k.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_editorial")
    return (
      <div className="px-6 py-7">
        <div className="space-y-5">
          {kpis.map((k) => (
            <div key={k.l} className="flex items-end justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
                <p className="mt-0.5 text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{k.v}</p>
              </div>
              <span className="pb-1 text-[10px] font-medium" style={{ color: k.up ? "#6B7A5E" : "#dc2626" }}>{k.d}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_grid")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.l} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
              <p className="mt-1.5 text-base font-black tracking-tight">{k.v}</p>
              <span
                className="mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
                style={{
                  background: k.up ? "color-mix(in srgb, #059669 12%, transparent)" : "color-mix(in srgb, #dc2626 12%, transparent)",
                  color: k.up ? "#059669" : "#dc2626",
                }}
              >
                {k.up ? "▲" : "▼"} {k.d}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dkpi_ops_metrics") {
    const ops = [
      { l: "今日订单", v: "286", d: "+12", up: true, dot: "var(--success)" },
      { l: "待处理任务", v: "17", d: "-5", up: true, dot: "var(--warning)" },
      { l: "催发货", v: "9", d: "+3", up: false, dot: "var(--danger)" },
      { l: "待审核", v: "23", d: "+8", up: false, dot: "var(--primary)" },
    ];
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ops.map((k) => (
            <div key={k.l} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between gap-1">
                <p className="truncate text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: k.dot }} />
              </div>
              <p className="mt-1.5 text-base font-black">{k.v}</p>
              <p className="mt-1 text-[8px] font-medium" style={{ color: k.up ? "var(--success)" : "var(--danger)" }}>
                {k.up ? "▲" : "▼"} {k.d} <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>较昨日</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  // 未匹配变体兜底：四格 KPI
  return (
    <div className="px-6 py-7">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.l} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
            <p className="mt-1 text-sm font-black">{k.v}</p>
            <p className="mt-0.5 text-[9px] font-medium" style={{ color: k.up ? "#059669" : "#dc2626" }}>{k.up ? "▲" : "▼"} {k.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Dashboard Chart ───────── */
function DashChartPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  if (variantId === "dchart_loading")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <Shimmer className="h-3.5 w-24" />
            <Shimmer className="h-3 w-10 rounded-full" />
          </div>
          <div className="mt-4 flex h-32 items-end gap-2">
            {[60, 80, 55, 90, 70, 95, 65, 85].map((b, i) => (
              <Shimmer key={i} className="flex-1 rounded-t-md" />
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "dchart_empty")
    return (
      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center" style={{ borderColor: "var(--border)" }}>
        <span className="text-xl">📊</span>
        <p className="mt-2 text-xs font-semibold">还没有数据</p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>接入数据源后展示分析图表。</p>
        <span className="mt-2.5 rounded-md px-3 py-1 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>接入数据源</span>
      </div>
    );
  if (variantId === "dchart_line")
    return (
      <div className="px-6 py-7">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs font-semibold">{dash.chartTitle}</p>
          <svg viewBox="0 0 270 90" className="mt-2 w-full">
            <polyline points="0,80 30,66 60,74 90,52 120,60 150,38 180,46 210,26 240,36 270,18" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
            <polygon points="0,90 0,80 30,66 60,74 90,52 120,60 150,38 180,46 210,26 240,36 270,18 270,90" fill="color-mix(in srgb, var(--primary) 15%, transparent)" />
          </svg>
        </div>
      </div>
    );
  if (variantId === "dchart_donut")
    return (
      <div className="px-6 py-7">
        <div className="flex items-center gap-4 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <svg viewBox="0 0 140 140" className="size-24">
            <circle cx="70" cy="70" r="55" fill="none" stroke="var(--border)" strokeWidth="16" />
            <circle cx="70" cy="70" r="55" fill="none" stroke="var(--primary)" strokeWidth="16" strokeDasharray="200 346" strokeDashoffset="0" transform="rotate(-90 70 70)" />
            <circle cx="70" cy="70" r="55" fill="none" stroke="var(--secondary)" strokeWidth="16" strokeDasharray="83 346" strokeDashoffset="-200" transform="rotate(-90 70 70)" />
            <text x="70" y="74" textAnchor="middle" fontSize="13" fontWeight="700">100%</text>
          </svg>
          <ul className="space-y-1.5 text-[10px]">
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--primary)" }} />订阅 58%</li>
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--secondary)" }} />广告 24%</li>
            <li className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: "var(--border)" }} />其他 18%</li>
          </ul>
        </div>
      </div>
    );
  if (variantId === "dchart_glass")
    return (
      <div className="px-6 py-7">
        <div className="rounded-2xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 65%, transparent)", backdropFilter: "blur(14px)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">{dash.chartTitle}</p>
            <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>■ 营收</span>
          </div>
          <div className="mt-3 flex h-20 items-end gap-1.5">
            {[42, 68, 55, 80, 62, 90, 74, 58].map((b, i) => (
              <div key={i} className="flex-1 rounded-t-sm" style={{ height: b + "%", background: i === 7 ? "var(--secondary)" : "var(--primary)", opacity: 0.85 }} />
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "dchart_bento")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="col-span-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold">{dash.chartTitle}</p>
            <div className="mt-2 flex h-14 items-end gap-1">
              {[42, 68, 55, 80, 62, 90, 74, 58].map((b, i) => (
                <div key={i} className="flex-1 rounded-t-sm" style={{ height: b + "%", background: "var(--primary)", opacity: i === 7 ? 1 : 0.6 }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold">收入结构</p>
            <div className="mt-2 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="size-16">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="12" strokeDasharray="150 251" transform="rotate(-90 50 50)" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  if (variantId === "dchart_bars")
    return (
      <div className="px-6 py-7">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold">{dash.chartTitle}</p>
              <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>近 12 个月 · 单位 万元</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>
              <span className="size-2 rounded-sm" style={{ background: "var(--primary)" }} />营收
              <span className="ml-1 size-2 rounded-sm" style={{ background: "var(--secondary)" }} />本月
            </span>
          </div>
          <div className="relative mt-3 h-24">
            {[0, 1, 2, 3].map((g) => (
              <span
                key={g}
                className="pointer-events-none absolute inset-x-0 border-t border-dashed"
                style={{ top: g * 33 + "%", borderColor: "color-mix(in srgb, var(--border) 70%, transparent)" }}
              />
            ))}
            <div className="relative flex h-full items-end gap-1.5">
              {[42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 92, 70].map((b, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md transition-opacity duration-200 hover:opacity-100"
                  style={{ height: b + "%", background: i === 11 ? "var(--secondary)" : "var(--primary)", opacity: i === 11 ? 1 : 0.8 }}
                />
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex justify-between text-[8px]" style={{ color: "var(--muted-foreground)" }}>
            <span>1月</span><span>4月</span><span>8月</span><span>12月</span>
          </div>
        </div>
      </div>
    );
  // 未匹配变体兜底：柱状卡片
  return (
    <div className="px-6 py-7">
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">{dash.chartTitle}</p>
          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>■ 营收</span>
        </div>
        <div className="mt-3 flex h-24 items-end gap-1.5">
          {[42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 92, 70].map((b, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: b + "%", background: i === 11 ? "var(--secondary)" : "var(--primary)", opacity: 0.85 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[8px]" style={{ color: "var(--muted-foreground)" }}><span>1月</span><span>6月</span><span>12月</span></div>
      </div>
    </div>
  );
}

/* ───────── Dashboard List ───────── */
function DashListPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const T = dash.table.map((r) => ({ n: r.name, s: r.status, c: r.status === "运行中" ? "#059669" : "#d97706" }));
  if (variantId === "dlist_loading")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between border-b px-3.5 py-2.5" style={{ borderColor: "var(--border)" }}>
            <Shimmer className="h-3.5 w-28" />
            <Shimmer className="h-3 w-12 rounded-full" />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b px-3.5 py-3 last:border-0" style={{ borderColor: "var(--border)" }}>
              <Shimmer className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3 w-1/3" />
                <Shimmer className="h-2.5 w-1/2" />
              </div>
              <Shimmer className="h-5 w-14 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dlist_cards")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {T.slice(0, 3).map((i) => (
            <div key={i.n} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[9px] font-medium" style={{ color: i.c }}>{i.s}</p>
              <p className="mt-1 text-[10px] font-semibold">{i.n}</p>
              <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>更新于最近</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dlist_inbox")
    return (
      <div className="px-6 py-7">
        <div className="divide-y rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {(dash.notifications.length ? dash.notifications : [{ text: "新的评论待审阅", time: "2 分钟前" }]).map((m) => (
            <div key={m.text} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="relative flex size-7 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
                {m.text.slice(0, 1)}
              </span>
              <p className="min-w-0 flex-1 truncate text-[10px]"><span className="font-semibold">{m.text}</span></p>
              <span className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{m.time}</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dlist_editorial")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <h3 className="mb-3 text-xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>项目</h3>
          <ul>
            {dash.table.map((r) => (
              <li key={r.name} className="flex items-center justify-between border-b py-3" style={{ borderColor: "var(--border)" }}>
                <div>
                  <p className="text-[10px] font-medium">{r.name}</p>
                  <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{r.company} · 更新于近期</p>
                </div>
                <span className="text-[10px] font-medium" style={{ color: r.status === "运行中" ? "#6B7A5E" : "#d97706" }}>{r.status}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  if (variantId === "dlist_bento")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
            <p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>今日新增</p>
            <p className="mt-1 text-base font-black">+1,204</p>
          </div>
          <div className="col-span-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-[10px] font-semibold">{dash.topbarTitle}</p>
            <ul className="mt-2 space-y-2 text-[9px]">
              {dash.table.map((r) => (
                <li key={r.name} className="flex items-center justify-between border-b pb-1.5" style={{ borderColor: "var(--border)" }}><span>{r.name}</span><span style={{ color: r.status === "运行中" ? "#6B7A5E" : "#d97706" }}>{r.status}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  if (variantId === "dlist_table")
    return (
      <div className="px-6 py-7">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b text-left text-[9px] uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <th className="p-2.5 font-medium">项目</th><th className="p-2.5 font-medium">状态</th><th className="p-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {T.map((r) => (
              <tr key={r.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-2.5">
                  <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md text-[8px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{r.n.slice(0, 1)}</span>{r.n}</span>
                </td>
                <td className="p-2.5"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium" style={{ color: r.c }}><span className="size-1 rounded-full" style={{ background: r.c }} />{r.s}</span></td>
                <td className="p-2.5 text-right">⋯</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  // 未匹配变体兜底：表格视图
  return (
    <div className="px-6 py-7">
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b text-left text-[9px] uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              <th className="p-2.5 font-medium">项目</th><th className="p-2.5 font-medium">状态</th><th className="p-2.5 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {T.map((r) => (
              <tr key={r.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-2.5">
                  <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-md text-[8px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{r.n.slice(0, 1)}</span>{r.n}</span>
                </td>
                <td className="p-2.5"><span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium" style={{ color: r.c }}><span className="size-1 rounded-full" style={{ background: r.c }} />{r.s}</span></td>
                <td className="p-2.5 text-right">⋯</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashTopbarPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const initial = dash.activity.length ? dash.activity[0].text.charAt(0) : "张";
  if (variantId === "dtop_workbench")
    return (
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span aria-hidden>⌕</span> 搜索项目、成员或文档…
        </div>
        <div className="flex items-center gap-2.5">
          <span className="relative">
            <span aria-hidden>🔔</span>
            <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full" style={{ background: "var(--primary)" }} />
          </span>
          <span className="h-4 w-px" style={{ background: "var(--border)" }} />
          <span className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{initial}</span>
        </div>
      </div>
    );
  if (variantId === "dtop_terminal")
    return (
      <div className="flex items-center gap-2 px-4 py-3" style={{ background: "#0A0A0B", borderBottom: "1px solid #262629" }}>
        <span className="font-mono text-[10px]" style={{ color: "#22D3EE" }}>~/app</span>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-[9px]" style={{ borderColor: "#262629", color: "#9A9AA2", background: "#141416" }}>❯ 搜索 <span style={{ color: "#22D3EE" }}>Ctrl K</span></span>
        <span className="flex gap-1">
          <span className="size-1.5 rounded-full" style={{ background: "#22D3EE" }} />
          <span className="size-1.5 rounded-full" style={{ background: "#FB7185" }} />
          <span className="size-1.5 rounded-full" style={{ background: "#F59E0B" }} />
        </span>
      </div>
    );
  if (variantId === "dtop_glass")
    return (
      <div className="flex items-center gap-2 px-4 py-3" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 55%, transparent)", borderRadius: "16px", backdropFilter: "blur(12px)" }}>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>⌕ 搜索</span>
        <span className="text-[10px]">🔔</span>
        <span className="flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{initial}</span>
      </div>
    );
  if (variantId === "dtop_ops_modebar") {
    const modes = ["运营", "议价", "订单", "任务", "审核", "数据", "配置"];
    return (
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
          {modes.map((m, i) => (
            <span
              key={m}
              className={["whitespace-nowrap px-2 py-1 text-[10px] font-medium transition", i === 0 ? "" : ""].join(" ")}
              style={
                i === 0
                  ? { color: "var(--primary)", boxShadow: "inset 0 -2px 0 0 var(--primary)" }
                  : { color: "var(--muted-foreground)" }
              }
            >
              {m}
            </span>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md border px-1.5 py-0.5 text-[9px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌘K 命令中心</span>
          <span className="rounded-md px-2 py-1 text-[9px] font-semibold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>+ 新建</span>
          <span className="flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{initial}</span>
        </div>
      </div>
    );
  }
  return <PreviewFallback title="DashTopbarPreview" />;
}

function DashTablePreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const rows = dash.table.map((r, i) => ({ n: r.name, s: r.status, o: r.company, p: [68, 32, 100][i % 3] }));
  if (variantId === "dtbl_standard")
    return (
      <div className="px-6 py-7">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b text-left text-[9px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
                <th className="p-2.5 font-medium">项目</th>
                <th className="p-2.5 font-medium">状态</th>
                <th className="p-2.5 font-medium">负责人</th>
                <th className="p-2.5 font-medium">进度</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="p-2.5 font-medium">{r.n}</td>
                  <td className="p-2.5">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{r.s}</span>
                  </td>
                  <td className="p-2.5" style={{ color: "var(--muted-foreground)" }}>{r.o}</td>
                  <td className="p-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1 w-12 rounded-full" style={{ background: "var(--muted)" }}>
                        <div className="h-full rounded-full" style={{ width: r.p + "%", background: "var(--primary)" }} />
                      </div>
                      <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{r.p}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  if (variantId === "dtbl_editorial")
    return (
      <div className="px-6 py-7">
        <section className="border-y" style={{ borderColor: "var(--border)" }}>
          {dash.table.map((r, i) => (
            <div key={r.name} className="flex items-baseline justify-between gap-3 border-b py-4 last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="font-mono text-[8px]" style={{ color: "var(--muted-foreground)" }}>{String(i + 1).padStart(2, "0")}</span>
              <h3 className="flex-1 truncate text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{r.name}</h3>
              <span className="rounded-full px-2 py-0.5 text-[8px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{r.status}</span>
            </div>
          ))}
        </section>
      </div>
    );
  if (variantId === "dtbl_dense")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
          {[
            { k: "req/min", v: "12,480", t: "#059669" },
            { k: "p50/ms", v: "84", t: "var(--muted)" },
            { k: "error%", v: "0.12", t: "#dc2626" },
            { k: "qps", v: "428", t: "#059669" },
          ].map((r) => (
            <div key={r.k} className="px-2.5 py-3" style={{ background: "var(--surface)" }}>
              <p className="font-mono text-[8px] uppercase" style={{ color: "var(--muted-foreground)" }}>{r.k}</p>
              <p className="mt-0.5 font-mono text-xs font-semibold">{r.v}</p>
              <span className="mt-0.5 inline-block size-1.5 rounded-full" style={{ background: r.t }} />
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashTablePreview" />;
}

function DashTasksPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const cols = ["待办", "进行中", "已完成"];
  if (variantId === "dtask_board")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cols.map((c, ci) => (
            <div key={c} className="rounded-lg p-2" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
              <p className="px-1 pb-1.5 text-[9px] font-medium" style={{ color: "var(--muted-foreground)" }}>{c} · {ci === 0 ? dash.tasks.length : 0}</p>
              <div className="space-y-1.5">
                {dash.tasks.filter((_, i) => i % 3 === ci).map((t) => (
                  <div key={t.title} className="rounded-md border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                    <span className="inline-block size-1.5 rounded-full" style={{ background: "#1F6C9F" }} />
                    <p className="mt-1 text-[9px] font-medium">{t.title}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dtask_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { t: "待办", c: "#4B69F0" },
            { t: "进行中", c: "#F5693C" },
            { t: "已完成", c: "#22D3EE" },
          ].map((c) => (
            <div key={c.t} className="rounded-lg p-2" style={{ background: "#141416", border: "1px solid #262629" }}>
              <p className="px-1 pb-1.5 text-[9px] font-semibold" style={{ color: c.c }}><span className="mr-1 inline-block size-1.5 rounded-full" style={{ background: c.c }} />{c.t}</p>
              <div className="rounded-md p-2" style={{ border: "1px solid color-mix(in srgb, " + c.c + " 40%, transparent)", background: "color-mix(in srgb, " + c.c + " 10%, #141416)" }}>
                <p className="text-[9px] font-semibold text-white">设计 Sprint</p>
                <p className="mt-0.5 text-[8px]" style={{ color: c.c }}>● 2 子任务</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dtask_wave")
    return (
      <div className="px-6 py-7">
        <div className="space-y-2.5">
          {["一", "二", "三"].map((day, di) => (
            <div key={day} className="flex gap-2.5">
              <div className="w-7 shrink-0 pt-0.5 text-center">
                <span className="mx-auto flex size-5 items-center justify-center rounded-full text-[8px] font-bold" style={di % 2 === 0 ? { background: "var(--primary)", color: "#fff" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>{day}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                {dash.tasks.filter((_, i) => i % 3 === di).map((t) => (
                  <span key={t.title} className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>{t.title}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashTasksPreview" />;
}

function DashNotificationsPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const nots = dash.notifications.length ? dash.notifications.map((m) => ({ i: "•", t: "通知", d: m.text, time: m.time, unread: true })) : [];
  if (variantId === "dnot_list")
    return (
      <div className="px-6 py-7">
        <div className="divide-y rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {nots.map((m) => (
            <div key={m.d} className="flex items-start gap-2.5 px-3 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-md text-[9px]" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{m.i}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px]"><span className="font-semibold">{m.t}</span> · {m.d}</p>
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{m.time}</p>
              </div>
              {m.unread && <span className="mt-1 size-1.5 rounded-full" style={{ background: "var(--primary)" }} />}
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dnot_bento")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border p-3 sm:col-span-2" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--primary) 8%, var(--surface))" }}>
            <p className="text-[7px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>置顶</p>
            <h3 className="mt-1 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>「官网改版」已进入开发</h3>
            <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>李娜 更新了 8 个任务</p>
          </div>
          {["有人@你 · 定价页", "新版本 v2.4 上线", "成员邀请已接受"].map((t) => (
            <div key={t} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[10px] font-medium">{t}</p>
              <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>2 小时前</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dnot_terminal")
    return (
      <div className="px-6 py-7">
        <div className="rounded-lg p-3.5 font-mono text-[9px]" style={{ background: "#0A0A0B", border: "1px solid #262629" }}>
          <span className="mb-2 flex gap-1.5"><span className="size-1.5 rounded-full bg-[#FB7185]" /><span className="size-1.5 rounded-full bg-[#F59E0B]" /><span className="size-1.5 rounded-full bg-[#34D399]" /></span>
          <div className="space-y-1">
            {[
              { t: "[12:01:03]", l: "INFO", m: "build started", c: "#22D3EE" },
              { t: "[12:01:05]", l: "OK", m: "compiled 214 modules", c: "#34D399" },
              { t: "[12:01:08]", l: "WARN", m: "legacy shim in use", c: "#F59E0B" },
              { t: "[12:01:12]", l: "DONE", m: "deploy → production", c: "#FB7185" },
            ].map((r) => (
              <p key={r.m} className="truncate"><span style={{ color: "#9A9AA2" }}>{r.t}</span> <span style={{ color: r.c }}>{r.l}</span> <span style={{ color: "#F5F5F5" }}>{r.m}</span></p>
            ))}
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="DashNotificationsPreview" />;
}

function DashTabsPreview({ variantId }: { variantId: string }) {
  const tabs = PREVIEW_CONTENT.dashboard.tabs.length ? PREVIEW_CONTENT.dashboard.tabs : ["概览"];
  if (variantId === "dtabs_seg")
    return (
      <div className="px-6 py-7">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex gap-1 border-b p-2" style={{ borderColor: "var(--border)" }}>
            {tabs.map((t, i) => (
              <span key={t} className={"rounded px-2.5 py-1 text-[10px] font-medium " + (i === 0 ? "text-[var(--on-primary)]" : "")} style={i === 0 ? { background: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{t}</span>
            ))}
          </div>
          <div className="p-8 text-center text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            面板内容区 · 接入图表或表格
          </div>
        </div>
      </div>
    );
  if (variantId === "dtabs_underline")
    return (
      <div className="px-6 py-7">
        <div className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-6 px-1">
            {tabs.map((t, i) => (
              <span key={t} className="cursor-pointer pb-1.5 text-base font-semibold" style={i === 0 ? { color: "var(--foreground)", borderBottom: "2px solid var(--primary)", fontFamily: "var(--font-heading)" } : { color: "var(--muted-foreground)" }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "dtabs_glass")
    return (
      <div className="px-6 py-7">
        <div className="inline-flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 50%, transparent)", backdropFilter: "blur(10px)" }}>
          {tabs.map((t, i) => (
            <span key={t} className={"cursor-pointer rounded-full px-3 py-1 text-[10px] font-medium " + (i === 0 ? "text-[var(--on-primary)]" : "")} style={i === 0 ? { background: "var(--primary)", boxShadow: "0 4px 16px -6px var(--primary)" } : { color: "var(--muted-foreground)" }}>{t}</span>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashTabsPreview" />;
}

function DashFiltersPreview({ variantId }: { variantId: string }) {
  const filters = PREVIEW_CONTENT.dashboard.filters.length ? PREVIEW_CONTENT.dashboard.filters : ["全部"];
  if (variantId === "dfil_bar")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.map((c, i) => (
            <span key={c} className={"cursor-pointer rounded-full px-2.5 py-1 text-[9px] font-medium " + (i === 1 ? "text-[var(--on-primary)]" : "")} style={i === 1 ? { background: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{c}</span>
          ))}
          <button className="text-[9px] font-medium" style={{ color: "var(--muted-foreground)" }}>重置</button>
        </div>
      </div>
    );
  if (variantId === "dfil_combo")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1.5 text-[9px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌕ 搜索项目、成员…</div>
          <div className="flex flex-wrap gap-1.5">
            {filters.slice(1).map((c, i) => (
              <span key={c} className={"cursor-pointer rounded px-2 py-1 text-[9px] font-medium " + (i === 0 ? "text-[var(--on-primary)]" : "")} style={i === 0 ? { background: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{c}</span>
            ))}
            <button className="px-1 text-[9px] font-medium" style={{ color: "var(--muted-foreground)" }}>重置</button>
          </div>
        </div>
      </div>
    );
  if (variantId === "dfil_range")
    return (
      <div className="px-6 py-7">
        <div className="space-y-2.5">
          <div className="relative h-1 rounded-full bg-muted">
            <div className="absolute h-full rounded-full" style={{ left: "24%", width: "54%", background: "var(--primary)" }} />
            <span className="absolute -top-1 size-3 rounded-full border-2" style={{ left: "24%", background: "var(--surface)", borderColor: "var(--primary)" }} />
            <span className="absolute -top-1 size-3 rounded-full border-2" style={{ left: "78%", background: "var(--surface)", borderColor: "var(--primary)" }} />
          </div>
          <div className="flex items-center justify-between text-[8px]" style={{ color: "var(--muted-foreground)" }}><span>¥24K</span><span>24% – 78%</span><span>¥78K</span></div>
        </div>
      </div>
    );
  return <PreviewFallback title="DashFiltersPreview" />;
}

function DashStatstripPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const strips = dash.kpis.length ? dash.kpis.map((k, i) => ({ l: k.label, v: k.value, d: k.trend, g: ["#7C5CFC", "#22D3EE", "#F472B6", "#34D399"][i % 4] })) : [{ l: "今日活跃", v: "1,204", d: "+12.4%", g: "#7C5CFC" }];
  if (variantId === "dstrip_stack")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-4 divide-x overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {strips.map((s) => (
            <div key={s.l} className="px-3 py-3">
              <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
              <p className="mt-0.5 text-sm font-bold tracking-tight">{s.v}</p>
              <p className="mt-0.5 text-[8px] font-medium" style={{ color: "#059669" }}>{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dstrip_editorial")
    return (
      <div className="px-6 py-7">
        <section className="grid grid-cols-4 divide-x border-y" style={{ borderColor: "var(--border)" }}>
          {strips.map((x) => (
            <div key={x.l} className="px-3 py-4">
              <p className="text-[7px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
              <p className="mt-1 text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>{x.v}</p>
            </div>
          ))}
        </section>
      </div>
    );
  if (variantId === "dstrip_gradient")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="grid grid-cols-4 gap-2">
          {strips.map((x) => (
            <div key={x.l} className="rounded-lg p-2.5" style={{ border: "1px solid #ffffff22", background: "linear-gradient(135deg, color-mix(in srgb, " + x.g + " 22%, transparent), transparent)", boxShadow: "inset 0 1px 0 #ffffff22" }}>
              <p className="text-[7px]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
              <p className="mt-0.5 text-sm font-bold text-white">{x.v}</p>
              <p className="mt-0.5 text-[8px] font-semibold" style={{ color: x.g }}>+▲</p>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashStatstripPreview" />;
}

function DashPermissionsPreview({ variantId }: { variantId: string }) {
  const dash = PREVIEW_CONTENT.dashboard;
  const perms = dash.permissions.length ? dash.permissions : ["管理员", "编辑", "只读"];
  if (variantId === "dperm_list")
    return (
      <div className="px-6 py-7">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <p className="text-[10px] font-semibold">成员与权限</p>
            <span className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>共 {perms.length} 人</span>
          </div>
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {perms.map((r, i) => (
              <li key={r} className="flex items-center gap-2 px-3 py-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{r.slice(0, 1)}</span>
                <span className="min-w-0 flex-1 truncate text-[10px] font-medium">{r}</span>
                <span className="rounded-full px-1.5 py-0.5 text-[8px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{perms[(i + 1) % perms.length]}</span>
                <span className="text-[8px] font-medium" style={{ color: i % 2 === 0 ? "#059669" : "var(--muted-foreground)" }}>编辑</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  if (variantId === "dperm_tree")
    return (
      <div className="px-6 py-7">
        <div className="divide-y rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {[
            { m: "项目 · 官网改版", v: true },
            { m: "数据面板", v: true },
            { m: "成员管理", v: false },
          ].map((n) => (
            <div key={n.m} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <p className="min-w-0 flex-1 truncate text-[10px] font-medium">{n.m}</p>
              <div className="flex gap-2.5">
                {[["读", true], ["写", n.v], ["删", false]].map(([l, on]) => (
                  <span key={l as string} className="flex items-center gap-1 text-[8px]" style={{ color: on ? "var(--primary)" : "var(--muted-foreground)" }}>
                    <span className="flex size-3 items-center justify-center rounded border text-[6px]" style={{ borderColor: on ? "var(--primary)" : "var(--border)", background: on ? "var(--primary)" : "transparent", color: on ? "#fff" : "transparent" }}>✓</span>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dperm_matrix")
    return (
      <div className="px-6 py-7">
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="grid grid-cols-4 border-b text-center text-[8px] font-semibold" style={{ borderColor: "var(--border)" }}>
            <span className="px-3 py-2 text-left">能力</span>
            {["Admin", "Editor", "Viewer"].map((r) => <span key={r} className="px-3 py-2" style={{ color: "var(--primary)" }}>{r}</span>)}
          </div>
          {[
            { c: "创建项目", v: [1, 1, 0] },
            { c: "编辑内容", v: [1, 1, 0] },
            { c: "删除记录", v: [1, 0, 0] },
            { c: "导出数据", v: [1, 1, 1] },
          ].map((row) => (
            <div key={row.c} className="grid grid-cols-4 items-center border-b text-center last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="px-3 py-2 text-left text-[8px]" style={{ color: "var(--muted-foreground)" }}>{row.c}</span>
              {row.v.map((on, i) => <span key={i} className="px-3 py-2"><span className="mx-auto block size-1.5 rounded-full" style={{ background: on ? "var(--primary)" : "var(--muted)" }} /></span>)}
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashPermissionsPreview" />;
}

function DashGaugesPreview({ variantId }: { variantId: string }) {
  if (variantId === "dgauge_dials")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "CPU", p: "72%" },
            { l: "内存", p: "46%" },
            { l: "磁盘", p: "88%" },
          ].map((x) => (
            <div key={x.l} className="flex flex-col items-center rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex size-14 items-center justify-center rounded-full" style={{ background: "conic-gradient(var(--primary) " + parseInt(x.p) + "%, var(--muted) 0)" }}>
                <span className="flex size-11 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "var(--surface)" }}>{x.p}</span>
              </div>
              <p className="mt-1.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dgauge_linear")
    return (
      <div className="px-6 py-7">
        <div className="space-y-3">
          {[
            { l: "队列负载", v: 62 },
            { l: "缓存命中", v: 91 },
            { l: "错误率", v: 12 },
          ].map((x) => (
            <div key={x.l} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
                <p className="font-mono text-[9px] font-semibold">{x.v}%</p>
              </div>
              <div className="h-1 w-full rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: x.v + "%", background: x.v > 80 ? "#dc2626" : "var(--primary)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dgauge_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "CPU", p: 72, c: "#22D3EE" },
            { l: "内存", p: 46, c: "#F472B6" },
            { l: "磁盘", p: 88, c: "#F59E0B" },
          ].map((x) => (
            <div key={x.l} className="flex flex-col items-center rounded-lg p-2.5" style={{ background: "#141416", border: "1px solid #262629" }}>
              <div className="relative size-11"><span className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(" + x.c + " " + x.p * 1.8 + "deg, #222 0deg)" }} /><span className="absolute inset-[4px] flex items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: "#141416" }}>{x.p}</span></div>
              <p className="mt-1.5 text-[8px] font-medium" style={{ color: x.c }}>{x.l}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dgauge_pointer")
    return (
      <div className="px-6 py-7">
        <div className="flex justify-center">
          <svg viewBox="0 0 120 70" className="w-full max-w-48">
            <path d="M10 64 A50 50 0 0 1 110 64" fill="none" stroke="var(--muted)" strokeWidth="8" strokeLinecap="round" opacity="0.35" />
            <path d="M10 64 A50 50 0 0 1 78 17.8" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
            <line x1="60" y1="62" x2="72.6" y2="25" stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="60" cy="62" r="3" fill="var(--primary)" />
            <text x="60" y="42" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)">68%</text>
          </svg>
        </div>
      </div>
    );
  return <PreviewFallback title="DashGaugesPreview" />;
}

function DashActivityPreview({ variantId }: { variantId: string }) {
  const act = PREVIEW_CONTENT.dashboard.activity.length ? PREVIEW_CONTENT.dashboard.activity : [{ text: "李雷 编辑了首页文案", time: "3 分钟前" }];
  if (variantId === "dact_timeline")
    return (
      <div className="px-6 py-7">
        <ol className="space-y-0">
          {act.map((i, idx) => (
            <li key={idx} className="relative flex gap-2.5 pb-4 last:pb-0">
              {idx < act.length - 1 && <span className="absolute left-[4px] top-2.5 h-full w-px" style={{ background: "var(--border)" }} />}
              <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
              <div className="min-w-0">
                <p className="text-[10px] leading-snug">{i.text}</p>
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{i.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  if (variantId === "dact_cards")
    return (
      <div className="px-6 py-7">
        <div className="space-y-1.5">
          {[
            { i: "＋", t: "创建了项目", d: "「官网改版」", time: "10 分钟前" },
            { i: "⇪", t: "上传了 3 张图", d: "设计稿 · 首页", time: "1 小时前" },
            { i: "💬", t: "发表了评论", d: "「定价页」", time: "昨天" },
          ].map((e) => (
            <div key={e.t} className="flex items-center gap-2.5 rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-[10px]" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{e.i}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px]"><span className="font-semibold">{e.t}</span> {e.d}</p>
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{e.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dact_commits")
    return (
      <div className="px-6 py-7">
        <div className="space-y-1.5 rounded-lg border p-3 font-mono text-[9px]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="truncate"><span style={{ color: "var(--primary)" }}>a1f2e3</span> feat: 视觉风格画廊 <span style={{ color: "var(--muted-foreground)" }}>· main · 李娜</span></p>
          <p className="truncate"><span style={{ color: "var(--primary)" }}>9c0b8a</span> fix: 表格空态 <span style={{ color: "var(--muted-foreground)" }}>· main · 王强</span></p>
          <p className="truncate"><span style={{ color: "var(--primary)" }}>b7d6c5</span> refactor: 抽取 MoreTools <span style={{ color: "var(--muted-foreground)" }}>· flow · 张三</span></p>
        </div>
      </div>
    );
  if (variantId === "dact_bento")
    return (
      <div className="px-6 py-7">
        <div className="grid grid-cols-2 gap-1.5">
          <div className="col-span-2 rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--primary) 8%, var(--surface))" }}>
            <p className="text-[7px] uppercase tracking-[0.15em]" style={{ color: "var(--primary)" }}>本周高光</p>
            <p className="mt-0.5 text-sm font-semibold" style={{ fontFamily: "var(--font-heading)" }}>24 次提交 · 3 个里程碑</p>
          </div>
          <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>128</p>
            <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>活跃成员</p>
          </div>
          <div className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="flex h-9 items-end gap-0.5">{Array.from({ length: 8 }).map((_, i) => <span key={i} className="w-full rounded-t" style={{ height: (8 + (i % 4) * 6) + "px", background: i === 5 ? "var(--primary)" : "var(--muted)" }} />)}</div>
            <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>趋势</p>
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="DashActivityPreview" />;
}

function DashTransferPreview({ variantId }: { variantId: string }) {
  if (variantId === "dtrans_toolbar")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div>
            <p className="text-[10px] font-semibold">数据导入 / 导出</p>
            <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>支持 CSV · Excel · JSON</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { n: "导入 CSV", primary: true },
              { n: "导出 Excel", primary: false },
              { n: "定时同步", primary: false },
            ].map((a) => (
              <button key={a.n} className={"rounded-md px-2.5 py-1 text-[9px] font-medium " + (a.primary ? "text-[var(--on-primary)]" : "")} style={a.primary ? { background: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--foreground)" }}>{a.n}</button>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "dtrans_drop")
    return (
      <div className="px-6 py-7">
        <div className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-dashed px-6 py-8 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 50%, transparent)" }}>
          <span className="flex size-8 items-center justify-center rounded-full text-xs" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>⇪</span>
          <p className="text-[10px] font-medium">拖拽文件到这里</p>
          <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>支持 CSV / Excel / JSON</p>
        </div>
      </div>
    );
  if (variantId === "dtrans_jobs")
    return (
      <div className="px-6 py-7">
        <div className="space-y-1.5">
          {PREVIEW_CONTENT.dashboard.transfer.map((j, i) => (
            <div key={j.name} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate font-mono text-[9px]">{j.name}</p>
                <span className="text-[8px]" style={{ color: "var(--primary)" }}>{i === 1 ? "完成" : [72, 100, 34][i % 3] + "%"}</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: [72, 100, 34][i % 3] + "%", background: "var(--primary)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dtrans_editorial")
    return (
      <div className="px-6 py-7">
        <div className="border-y" style={{ borderColor: "var(--border)" }}>
          {[
            { f: "CSV", d: "原始行数据 · 可再入读" },
            { f: "Excel", d: "带样式表格 · 适合报表" },
            { f: "JSON", d: "结构化对象 · 适合 API" },
          ].map((r) => (
            <div key={r.f} className="flex items-center justify-between gap-3 border-b py-3 last:border-0" style={{ borderColor: "var(--border)" }}>
              <div>
                <p className="text-base font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{r.f}</p>
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{r.d}</p>
              </div>
              <span style={{ color: "var(--muted-foreground)" }}>→</span>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DashTransferPreview" />;
}

/* ───────── Portfolio ───────── */
function PortfolioGridPreview({ variantId }: { variantId: string }) {
  const port = PREVIEW_CONTENT.portfolio;
  const proj = port.projects.length ? port.projects.map((p) => p.title) : ["精选作品", "作品二", "作品三", "作品四"];
  if (variantId === "pgrid_masonry")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xl">
          <SectionBadge>作品集</SectionBadge>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-sm font-bold">{port.title}</p>
            <div className="flex gap-1.5">
              {["全部", proj[1] || "Branding", "Web"].map((f, i) => (
                <span key={f} className={"rounded-full px-2 py-0.5 text-[8px] " + (i === 0 ? "text-[var(--on-primary)]" : "border")} style={i === 0 ? { background: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{f}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 columns-2 gap-3">
            {proj.slice(0, 4).map((w, i) => (
              <div key={w} className="group relative mb-3 overflow-hidden rounded-lg">
                <img src={ph("work", 4 + i, 600)} alt={w} loading="lazy" className="w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">{w}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "pgrid_split")
    return (
      <div className="grid gap-5 px-6 py-7 sm:grid-cols-2">
        <a className="block">
          <img src={ph("work", 5, 900)} alt={proj[0]} className="w-full rounded-xl object-cover" />
          <SectionBadge>作品集</SectionBadge>
          <p className="mt-1.5 text-base font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{proj[0]}</p>
        </a>
        <div className="flex flex-col justify-center">
          {proj.slice(1).map((w) => (
            <div key={w} className="flex items-center justify-between border-b py-3" style={{ borderColor: "var(--border)" }}>
              <p className="text-xs font-medium">{w}</p>
              <span className="text-xs opacity-0 transition group-hover:opacity-100">→</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pgrid_hscroll")
    return (
      <div className="px-6 py-7">
        <SectionBadge>作品集</SectionBadge>
        <p className="mt-1.5 text-sm font-bold">{port.title}</p>
        <Carousel className="mt-3">
          {proj.slice(0, 6).map((w, i) => (
            <div key={w} className="group w-44 shrink-0 snap-start">
              <div className="overflow-hidden rounded-lg">
                <img src={ph("work", 6 + i, 700)} alt={w} loading="lazy" className="aspect-[7/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
              </div>
              <p className="mt-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{("0" + (i + 1)).slice(-2)} / {("0" + Math.min(proj.length, 6)).slice(-2)}</p>
            </div>
          ))}
        </Carousel>
      </div>
    );
  return <PreviewFallback title="PortfolioGridPreview" />;
}

function PortfolioCasePreview({ variantId }: { variantId: string }) {
  const port = PREVIEW_CONTENT.portfolio;
  const featured = (port.projects[0]?.title) || "精选项目";
  const steps = PREVIEW_CONTENT.process.items.length ? PREVIEW_CONTENT.process.items.map((s) => s.name).slice(0, 3) : ["发现", "设计", "上线"];
  if (variantId === "pcase_hero")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-lg">
          <SectionBadge>案例</SectionBadge>
          <h3 className="mt-2 text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{featured}</h3>
          <div className="mt-3 flex flex-wrap gap-5 border-y py-2.5" style={{ borderColor: "var(--border)" }}>
            {[{ l: "时间", v: "8 周" }, { l: "角色", v: "品牌+开发" }, { l: "成果", v: "+212%" }].map((m) => (
              <div key={m.l}><p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{m.l}</p><p className="text-xs font-bold">{m.v}</p></div>
            ))}
          </div>
          <img src={ph("case", 7, 1100)} alt={featured} className="mt-4 w-full rounded-xl object-cover" />
        </div>
      </div>
    );
  if (variantId === "pcase_process")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-lg space-y-4">
          <SectionBadge>案例</SectionBadge>
          <p className="mt-1.5 text-sm font-bold">过程</p>
          {steps.map((t, i) => (
            <div key={t} className="flex items-center gap-3 border-b pb-3 last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="text-base font-black" style={{ color: "var(--primary)" }}>{"0" + (i + 1)}</span>
              <p className="flex-1 text-xs font-semibold">{t}</p>
              <img src={ph("case", 8 + i, 600)} alt={t} loading="lazy" className="hidden h-10 w-16 rounded object-cover sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pcase_result")
    return (
      <div className="px-6 py-7" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-3 gap-4 border-y py-5" style={{ borderColor: "var(--border)" }}>
            {[{ v: "212%", l: "转化" }, { v: "-38%", l: "跳出" }, { v: "4.6x", l: "询盘" }].map((m) => (
              <div key={m.l}><CountUp value={m.v} className="text-2xl font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }} /><p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{m.l}</p></div>
            ))}
          </div>
          <p className="mt-5 text-center text-sm font-medium" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{port.subtitle}</p>
          <p className="mt-1 text-center text-[9px]" style={{ color: "var(--muted-foreground)" }}>{featured} · 项目负责人</p>
        </div>
      </div>
    );
  return <PreviewFallback title="PortfolioCasePreview" />;
}

function PortfolioAboutPreview({ variantId }: { variantId: string }) {
  const about = PREVIEW_CONTENT.about;
  const svcs = PREVIEW_CONTENT.features.items.length ? PREVIEW_CONTENT.features.items.map((f) => f.name).slice(0, 3) : ["品牌策略", "界面设计", "动效开发"];
  const stats = PREVIEW_CONTENT.stats.items.length ? PREVIEW_CONTENT.stats.items.map((s) => ({ v: s.value, l: s.label })) : [{ v: "8", l: "年经验" }, { v: "120+", l: "项目" }, { v: "23", l: "奖项" }, { v: "40+", l: "客户" }];
  if (variantId === "pabout_manifesto")
    return (
      <div className="px-6 py-8" style={{ background: "var(--background)" }}>
        <div className="mx-auto max-w-lg">
          <SectionBadge>关于</SectionBadge>
          <h3 className="mt-3 text-xl font-black leading-[1.15] tracking-tight sm:text-2xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{about.story}</h3>
          <div className="mt-5 flex gap-6 border-t pt-3" style={{ borderColor: "var(--border)" }}>
            {svcs.map((s) => <span key={s} className="text-[10px] font-medium">{s}</span>)}
          </div>
        </div>
      </div>
    );
  if (variantId === "pabout_stats")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-3 border-y py-5" style={{ borderColor: "var(--border)" }}>
          {stats.slice(0, 4).map((s) => (
            <div key={s.l} className="text-center"><CountUp value={s.v} className="text-xl font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }} /><p className="mt-0.5 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p></div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pabout_timeline")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <SectionBadge>关于</SectionBadge>
          <p className="mt-1.5 text-sm font-bold">{about.title}</p>
          <div className="mt-3">
            {[
              { y: "2018", t: "工作室成立" },
              { y: "2021", t: "首个国际客户" },
              { y: (new Date().getFullYear()), t: about.team.length ? (about.team.length + " 位伙伴同行") : "40+ 品牌同行" },
            ].map((m) => (
              <div key={m.y} className="flex gap-4 border-b py-3 last:border-0" style={{ borderColor: "var(--border)" }}>
                <span className="text-base font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{m.y}</span>
                <p className="text-xs font-medium">{m.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="PortfolioAboutPreview" />;
}

/* ───────── Portfolio Ring ───────── */
type RingDir = "cw" | "ccw" | "alternate";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function RingSlider({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-[9px]">
        <span style={{ color: "var(--muted-foreground)" }}>{label}</span>
        <span className="tabular-nums" style={{ color: "var(--foreground)" }}>{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-1 w-full cursor-pointer" style={{ accentColor: "var(--primary)" }} />
    </label>
  );
}

function RingSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void; }) {
  return (
    <label className="block">
      <div className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-md border px-1.5 py-1 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function RingPreviewImpl({ preset }: { preset: "circle" | "alt" }) {
  const [rings, setRings] = useState(preset === "alt" ? 2 : 3);
  const [direction, setDirection] = useState<RingDir>(preset === "alt" ? "alternate" : "cw");
  const [speed, setSpeed] = useState(7);
  const [innerRadius, setInnerRadius] = useState(110);
  const [ringGap, setRingGap] = useState(120);
  const [cardWidth, setCardWidth] = useState(72);
  const [cardHeight, setCardHeight] = useState(92);
  const [rounded, setRounded] = useState(6);
  const [tilt, setTilt] = useState(6);
  const [fit, setFit] = useState<"cover" | "contain">("cover");
  const [count, setCount] = useState(12);

  const photos = useMemo(() => Array.from({ length: count }, (_, i) => premiumImage(9 + i, { w: 400 })), [count]);
  const cards = useMemo(() => {
    const ringN = Math.max(1, Math.round(rings));
    const rnd = mulberry32(0x9e3779b1);
    const radii = Array.from({ length: ringN }, (_, r) => Math.max(1, innerRadius + r * ringGap));
    const totalCirc = radii.reduce((s, rad) => s + 2 * Math.PI * rad, 0);
    const out: { angle: number; radius: number; dir: number; tilt: number; img: string }[] = [];
    radii.forEach((rad, r) => {
      const per = Math.max(2, Math.round((count * (2 * Math.PI * rad)) / totalCirc));
      for (let j = 0; j < per; j++) {
        out.push({
          angle: (j / per) * Math.PI * 2 + r * 0.6,
          radius: rad,
          dir: direction === "ccw" ? -1 : direction === "alternate" ? (r % 2 === 0 ? 1 : -1) : 1,
          tilt: (rnd() * 2 - 1) * tilt,
          img: photos[out.length % photos.length],
        });
      }
    });
    return out;
  }, [rings, innerRadius, ringGap, count, direction, tilt, photos]);

  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const angles = cards.map((c) => c.angle);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      for (let i = 0; i < cards.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        angles[i] += speed * 0.0008 * cards[i].dir * (dt / 16.7);
        el.style.transform = "translate(" + (Math.cos(angles[i]) * cards[i].radius).toFixed(2) + "px, " + (Math.sin(angles[i]) * cards[i].radius).toFixed(2) + "px) rotate(" + cards[i].tilt.toFixed(2) + "deg)";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cards, speed]);

  const size = (innerRadius + ringGap * (Math.max(1, rings) - 1)) * 2 + cardHeight + 40;

  return (
    <div className="px-4 pb-6 pt-8">
      <div className="relative mx-auto w-full max-w-md overflow-hidden" style={{ height: size }}>
        {cards.map((c, i) => (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className="absolute overflow-hidden"
            style={{
              left: "50%", top: "50%", width: cardWidth, height: cardHeight,
              marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2,
              borderRadius: rounded,
              boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
              transform: "translate(" + (Math.cos(c.angle) * c.radius).toFixed(2) + "px, " + (Math.sin(c.angle) * c.radius).toFixed(2) + "px) rotate(" + c.tilt.toFixed(2) + "deg)",
              willChange: "transform",
              pointerEvents: "none",
            }}
          >
            <img src={c.img} alt="" draggable={false} className="h-full w-full" style={{ objectFit: fit }} />
          </div>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-md rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>参数面板</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <RingSlider label="环数" value={rings} min={1} max={6} onChange={setRings} />
          <RingSelect label="方向" value={direction} options={["cw", "ccw", "alternate"]} onChange={(v) => setDirection(v as RingDir)} />
          <RingSlider label="内环半径" value={innerRadius} min={60} max={220} onChange={setInnerRadius} />
          <RingSlider label="环间距" value={ringGap} min={50} max={220} onChange={setRingGap} />
          <RingSlider label="卡片宽" value={cardWidth} min={44} max={140} onChange={setCardWidth} />
          <RingSlider label="卡片高" value={cardHeight} min={56} max={180} onChange={setCardHeight} />
          <RingSlider label="速度" value={speed} min={0} max={20} onChange={setSpeed} />
          <RingSlider label="倾斜" value={tilt} min={0} max={24} onChange={setTilt} />
          <RingSlider label="圆角" value={rounded} min={0} max={24} onChange={setRounded} />
          <RingSelect label="填充" value={fit} options={["cover", "contain"]} onChange={(v) => setFit(v as "cover" | "contain")} />
          <RingSelect label="图片数量" value={String(count)} options={["8", "12", "16"]} onChange={(v) => setCount(Number(v))} />
        </div>
      </div>
    </div>
  );
}

function PortfolioRingPreview({ variantId }: { variantId: string }) {
  if (variantId === "pring_circle") return <RingPreviewImpl preset="circle" />;
  if (variantId === "pring_alt") return <RingPreviewImpl preset="alt" />;
  return <PreviewFallback title="PortfolioRingPreview" />;
}

/* ───────── Blog ───────── */
function BlogListPreview({ variantId }: { variantId: string }) {
  const blog = PREVIEW_CONTENT.blog;
  const posts = blog.posts.length
    ? blog.posts.map((p, i) => ({ t: p.title, c: p.tag, d: p.date, i }))
    : [{ t: "设计系统加速交付", c: "设计", d: "2026-08-10", i: 1 }, { t: "动效的克制之美", c: "动效", d: "2026-07-28", i: 2 }, { t: "AI 时代界面叙事", c: "趋势", d: "2026-07-12", i: 3 }];
  if (variantId === "blist_card")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-lg gap-3 sm:grid-cols-3">
          {posts.slice(0, 3).map((p) => (
            <div key={p.t} className="rounded-lg border p-1.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <img src={ph("blog", 10 + p.i, 600)} alt={p.t} loading="lazy" className="aspect-[16/10] w-full rounded-md object-cover" />
              <div className="p-1.5">
                <span className="rounded-full px-1.5 py-0.5 text-[7px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{p.c}</span>
                <p className="mt-1 text-[10px] font-semibold leading-snug">{p.t}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "blist_row")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <SectionHead badge="博客" title={blog.title} center />
          <div className="mt-3">
            {posts.map((p, idx) => (
              <div key={p.t} className="flex items-baseline gap-4 border-b py-3" style={{ borderColor: "var(--border)" }}>
                <span className="text-[9px]" style={{ color: "var(--primary)" }}>{"0" + (idx + 1)}</span>
                <p className="flex-1 text-xs font-medium" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{p.t}</p>
                <span className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{p.c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "blist_feature")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-lg gap-4 sm:grid-cols-[1.5fr_1fr]">
          <div>
            <img src={ph("blog", 11, 1000)} alt={posts[0]?.t || "精选文章"} className="aspect-[5/3] w-full rounded-lg object-cover" />
            <p className="mt-1.5 text-xs font-bold leading-snug">{posts[0]?.t}</p>
            <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{posts[0]?.d} · 6 分钟</p>
          </div>
          <div className="flex flex-col justify-center">
            {posts.slice(1).map((t) => (
              <div key={t.t} className="border-b py-2.5 last:border-0" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] font-medium">{t.t}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="BlogListPreview" />;
}

function BlogPostPreview({ variantId }: { variantId: string }) {
  const blog = PREVIEW_CONTENT.blog;
  const first = blog.posts[0];
  const title = blog.postTitle || first?.title || "一篇新文章";
  const body = blog.postBody || first?.excerpt || "把核心观点沉淀下来。";
  const tag = first?.tag || "设计";
  const date = first?.date || "2026-08-10";
  if (variantId === "bpost_article")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{tag} · {date}</p>
          <h3 className="mt-1.5 text-lg font-bold leading-tight">{title}</h3>
          <div className="mt-3 space-y-3 text-[10px] leading-relaxed">
            <p>{body}</p>
            <blockquote className="border-l-2 pl-3 italic" style={{ borderColor: "var(--primary)", color: "var(--muted-foreground)" }}>"一致性的价值，在于它让用户不用每次重新学习。"</blockquote>
            <pre className="overflow-x-auto rounded-md p-2.5 text-[9px]" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>export const tokens = {"{ radius: \"12px\" }"};</pre>
            <img src={ph("blog", 12, 900)} alt={title} className="w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  if (variantId === "bpost_sidebar")
    return (
      <div className="mx-auto grid max-w-lg gap-5 px-6 py-7 sm:grid-cols-[1fr_120px]">
        <div className="min-w-0">
          <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{tag} · {date}</p>
          <h3 className="mt-1 text-lg font-bold leading-tight">{title}</h3>
          <div className="mt-2.5 space-y-2 text-[10px] leading-relaxed">
            <p className="font-semibold">引言</p>
            <p>{body}</p>
            <img src={ph("blog", 13, 900)} alt={title} className="w-full rounded-lg" />
            <p className="font-semibold">总结</p>
            <p>会用 AI 的设计师会取代不会用 AI 的。</p>
          </div>
        </div>
        <div className="hidden sm:block">
          <div className="sticky top-0 rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
            <p className="text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>目录</p>
            <ul className="mt-2 space-y-1.5 text-[9px]">
              {["引言", "为什么", "怎么做", "总结"].map((t) => <li key={t} style={{ color: "var(--muted-foreground)" }}>{t}</li>)}
            </ul>
            <p className="mt-3 border-t pt-2 text-[9px] font-semibold" style={{ borderColor: "var(--border)" }}>{PREVIEW_CONTENT.about.team[0]?.name || "作者"}</p>
            <p className="text-[7px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.brand} 团队</p>
          </div>
        </div>
      </div>
    );
  if (variantId === "bpost_minimal")
    return (
      <div className="px-6 py-8 text-center" style={{ background: "var(--background)" }}>
        <div className="mx-auto max-w-xs">
          <p className="text-[8px] uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>{tag}</p>
          <h3 className="mt-2 text-xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{title}</h3>
          <p className="mt-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.brand} · {date}</p>
          <div className="mt-4 space-y-3 text-left text-[11px] leading-[1.8]" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
            <p>{body}</p>
            <p>克制不是不做，而是知道什么时候不做。</p>
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="BlogPostPreview" />;
}

function BlogTagsPreview({ variantId }: { variantId: string }) {
  const blog = PREVIEW_CONTENT.blog;
  const tags = blog.tags.length ? blog.tags : ["设计", "动效", "趋势"];
  const tagsData = tags.map((t, i) => ({ t, n: Math.max(4, 14 - i * 4), active: i === 0 }));
  if (variantId === "btags_pills")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <SectionBadge>博客</SectionBadge>
          <p className="mt-1.5 text-sm font-bold">{blog.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tagsData.map((t) => (
              <span key={t.t} className={"rounded-full px-3 py-1 text-[9px] " + (t.active ? "text-[var(--on-primary)]" : "border")} style={t.active ? { background: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{t.t} {t.n}</span>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "btags_cat")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-md gap-2.5 sm:grid-cols-3">
          {tagsData.slice(0, 3).map((c) => (
            <div key={c.t} className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="text-[10px] font-semibold">{c.t}</p>
              <p className="mt-0.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>{blog.subtitle}</p>
              <p className="mt-1.5 text-[8px] font-medium" style={{ color: "var(--primary)" }}>{c.n} 篇 →</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "btags_sidebar")
    return (
      <div className="px-6 py-7">
        <div className="w-44 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="px-1 text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>分类</p>
          <div className="mt-2 space-y-1">
            {[{ t: blog.title, n: tags.length * 12, active: true }, ...tagsData].map((c) => (
              <div key={c.t} className="flex items-center justify-between rounded px-2 py-1 text-[9px]" style={c.active ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>
                {c.t}<span>{c.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="BlogTagsPreview" />;
}

/* ───────── Product ───────── */
function ProductGalleryPreview({ variantId }: { variantId: string }) {
  if (variantId === "pgallery_main") {
    const thumbs = [1, 2, 3, 4];
    const [active, setActive] = useState(0);
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xs">
          <div className="group relative overflow-hidden rounded-xl">
            <span className="absolute left-2 top-2 z-10 rounded-full px-2 py-0.5 text-[8px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>新品</span>
            <img
              key={active}
              src={ph("product", active, 800)}
              alt="商品主图"
              className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              style={{ animation: "galleryIn 0.35s cubic-bezier(0.16,1,0.3,1)" }}
            />
          </div>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {thumbs.map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={"缩略图 " + i}
                className={"overflow-hidden rounded-md transition " + (active === i ? "ring-2 ring-[var(--primary)]" : "opacity-60 hover:opacity-100")}
              >
                <img src={ph("thumb", 18 + i, 400)} alt={"缩略图 " + i} className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-110" />
              </button>
            ))}
          </div>
          <style>{`@keyframes galleryIn { from { opacity: 0.4; transform: scale(1.03); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      </div>
    );
  }
  if (variantId === "pgallery_split")
    return (
      <div className="grid gap-3 px-6 py-7 sm:grid-cols-[1.1fr_1fr]">
        <img src={ph("product", 22, 700)} alt="商品图 A" className="aspect-[3/4] w-full rounded-xl object-cover transition-transform duration-500 hover:scale-[1.03]" />
        <div className="grid gap-3">
          <img src={ph("product", 23, 700)} alt="商品图 B" className="w-full rounded-xl object-cover transition-transform duration-500 hover:scale-[1.03]" />
          <img src={ph("product", 24, 700)} alt="商品图 C" className="w-full rounded-xl object-cover transition-transform duration-500 hover:scale-[1.03]" />
        </div>
      </div>
    );
  return <PreviewFallback title="ProductGalleryPreview" />;
}

function ProductInfoPreview({ variantId }: { variantId: string }) {
  const prod = PREVIEW_CONTENT.shop.products[0];
  const pname = prod?.name || "经典款";
  const pprice = prod?.price || "¥299";
  const pdesc = prod?.desc || "";
  if (variantId === "pinfo_standard")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm">
          <SectionBadge>商品</SectionBadge>
          <h3 className="mt-1.5 text-base font-bold">{pname}</h3>
          <div className="mt-1 flex items-baseline gap-2"><p className="text-lg font-black">{pprice}</p><p className="text-xs line-through" style={{ color: "var(--muted-foreground)" }}>¥899</p></div>
          <p className="mt-3 text-[10px] font-medium">颜色</p>
          <div className="mt-1.5 flex gap-1.5">
            {["var(--primary)", "var(--secondary)", "var(--foreground)"].map((c, i) => (
              <span key={i} className={"size-5 rounded-full border-2 " + (i === 0 ? "" : "opacity-70")} style={{ background: c, borderColor: i === 0 ? "var(--primary)" : "transparent" }} />
            ))}
          </div>
          <p className="mt-3 text-[10px] font-medium">尺码</p>
          <div className="mt-1.5 flex gap-1.5">
            {["S", "M", "L"].map((s, i) => (
              <span key={s} className={"rounded border px-2 py-0.5 text-[9px] " + (i === 1 ? "text-[var(--on-primary)]" : "")} style={i === 1 ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}>{s}</span>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <span className="flex-1 rounded-md py-2 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>加入购物车</span>
            <span className="flex-1 rounded-md border py-2 text-center text-[10px] font-medium" style={{ borderColor: "var(--border)" }}>立即购买</span>
          </div>
        </div>
      </div>
    );
  if (variantId === "pinfo_editorial")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm px-1">
          <SectionBadge>商品</SectionBadge>
          <h3 className="mt-2 text-xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{pname}</h3>
          <p className="mt-1 text-sm font-medium">{pprice}</p>
          <div className="mt-3 border-t" style={{ borderColor: "var(--border)" }}>
            {[{ k: "材质", v: pdesc || "再生尼龙 78%" }, { k: "产地", v: "葡萄牙" }, { k: "工艺", v: "3 年质保" }].map((s) => (
              <div key={s.k} className="flex justify-between border-b py-2 text-[10px]" style={{ borderColor: "var(--border)" }}>
                <span style={{ color: "var(--muted-foreground)" }}>{s.k}</span><span className="font-medium">{s.v}</span>
              </div>
            ))}
          </div>
          <span className="mt-4 block rounded-full py-2 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>加入购物车</span>
        </div>
      </div>
    );
  return <PreviewFallback title="ProductInfoPreview" />;
}

function ProductGridPreview({ variantId }: { variantId: string }) {
  const products = PREVIEW_CONTENT.shop.products.length
    ? PREVIEW_CONTENT.shop.products.map((p, i) => ({ t: p.name, d: p.desc, p: p.price, img: ph("product", 25 + i, 600) }))
    : [{ t: "经典款", d: "", p: "¥299", img: ph("product", 26, 600) }];
  if (variantId === "pgrid_card")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-3">
          {products.slice(0, 4).map((p) => (
            <div key={p.t} className="group">
              <img src={p.img} alt={p.t} loading="lazy" className="aspect-[4/5] w-full rounded-lg object-cover" />
              <p className="mt-1.5 truncate text-[9px] font-medium">{p.t}</p>
              <p className="text-[9px] font-semibold" style={{ color: "var(--primary)" }}>{p.p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "pgrid_hlist")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          {products.slice(0, 3).map((p) => (
            <div key={p.t} className="flex items-center gap-3 border-b py-2.5 last:border-0" style={{ borderColor: "var(--border)" }}>
              <img src={p.img} alt={p.t} loading="lazy" className="h-12 w-16 rounded-md object-cover" />
              <div className="flex-1"><p className="text-[10px] font-medium">{p.t}</p><p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{p.d}</p></div>
              <p className="text-[10px] font-semibold">{p.p}</p>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="ProductGridPreview" />;
}

function ProductCartPreview({ variantId }: { variantId: string }) {
  const goods = PREVIEW_CONTENT.shop.products.length
    ? PREVIEW_CONTENT.shop.products.slice(0, 2).map((g, i) => ({ t: g.name, p: 699 - i * 370, q: i + 1, img: ph("thumb", 27 + i, 300) }))
    : [];
  const subtotal = goods.reduce((s, g) => s + g.p * g.q, 0);
  if (variantId === "pcart_list")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          {goods.map((it) => (
            <div key={it.t} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-0" style={{ borderColor: "var(--border)" }}>
              <img src={it.img} alt={it.t} className="h-10 w-9 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate text-[10px] font-medium">{it.t}</span>
              <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>¥{it.p} × {it.q}</span>
              <span className="text-[10px] font-semibold">¥{it.p * it.q}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 text-[10px]"><span style={{ color: "var(--muted-foreground)" }}>小计</span><b>¥{subtotal}</b></div>
        </div>
      </div>
    );
  if (variantId === "pcart_summary")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-xs rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <SectionBadge>购物车</SectionBadge>
          <p className="mt-1.5 text-xs font-bold">订单摘要</p>
          <div className="mt-2.5 space-y-1.5 text-[10px]">
            {[{ k: "小计", v: "¥" + subtotal }, { k: "运费", v: "免运费" }, { k: "优惠码", v: "-¥" + Math.round(subtotal * 0.1) }].map((r) => (
              <div key={r.k} className="flex justify-between"><span style={{ color: "var(--muted-foreground)" }}>{r.k}</span><span className={r.v.startsWith("-") ? "text-green-600" : "font-medium"}>{r.v}</span></div>
            ))}
            <div className="flex justify-between border-t pt-2 text-xs" style={{ borderColor: "var(--border)" }}><b>合计</b><b>¥{Math.round(subtotal * 0.9)}</b></div>
          </div>
          <span className="mt-3 block rounded-md py-2 text-center text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>去结算</span>
        </div>
      </div>
    );
  return <PreviewFallback title="ProductCartPreview" />;
}

/* ───────── About ───────── */
function AboutStoryPreview({ variantId }: { variantId: string }) {
  const about = PREVIEW_CONTENT.about;
  const founder = about.team[0];
  const storyT = about.story || "我们相信，好产品源于好问题。";
  if (variantId === "astory_manifesto")
    return (
      <div className="px-6 py-10 text-center" style={{ background: "var(--background)" }}>
        <div className="mx-auto max-w-md">
          <SectionBadge>关于</SectionBadge>
          <h3 className="mt-2 text-2xl font-black leading-[1.15] tracking-tight sm:text-3xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{storyT}</h3>
          <p className="mx-auto mt-3 max-w-xs text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{about.subtitle} · {PREVIEW_CONTENT.brand} 陪伴 {about.team.length || 120} 位伙伴。</p>
          <div className="mx-auto mt-6 flex max-w-xs justify-between border-t pt-4" style={{ borderColor: "var(--border)" }}>
            {[{ v: "2016", l: "成立" }, { v: "120", l: "伙伴" }, { v: "30+", l: "国家" }].map((s) => (
              <div key={s.l}><p className="text-lg font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{s.v}</p><p className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p></div>
            ))}
          </div>
        </div>
      </div>
    );
  if (variantId === "astory_split")
    return (
      <div className="grid items-start gap-5 px-6 py-8 sm:grid-cols-2">
        <div className="space-y-8">
          <div className="max-w-xs">
            <SectionBadge>关于</SectionBadge>
            <h3 className="mt-2 text-xl font-black leading-tight tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{about.story}</h3>
            <p className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{about.subtitle}</p>
            <p className="mt-3 text-[9px] font-medium">— {founder?.name || "创始人团队"}</p>
          </div>
          <div className="max-w-xs space-y-4 text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
            <p>我们仍然保持着小团队的速度与好奇心：快速试错，认真打磨。</p>
            <p>今天，{PREVIEW_CONTENT.brand} 服务着全球 30 多个国家的用户。</p>
          </div>
        </div>
        <div className="relative">
          <img src={ph("about", 28, 800)} alt="工作室" className="w-full rounded-xl object-cover sm:sticky sm:top-0" />
          <p className="mt-1.5 text-[8px]" style={{ color: "var(--muted-foreground)" }}>图：2016 年的第一间办公室 · 滚动时图片吸顶</p>
        </div>
      </div>
    );
  if (variantId === "astory_quote")
    return (
      <div className="px-6 py-12 text-center" style={{ background: "var(--surface)" }}>
        <div className="mx-auto max-w-md">
          <SectionBadge>关于</SectionBadge>
          <p className="mt-2 text-lg font-medium leading-relaxed sm:text-xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>"{about.subtitle}"</p>
          <p className="mt-3 text-[10px] font-semibold">{founder?.name || "创始人"} · {PREVIEW_CONTENT.brand} 创始人</p>
          <div className="mx-auto mt-5 h-px w-16" style={{ background: "var(--border)" }} />
        </div>
      </div>
    );
  return <PreviewFallback title="AboutStoryPreview" />;
}

function AboutTeamPreview({ variantId }: { variantId: string }) {
  const team = PREVIEW_CONTENT.about.team.length
    ? PREVIEW_CONTENT.about.team.map((m, i) => ({ n: m.name, r: m.role, img: ph("avatar", 29 + i, 400) }))
    : [{ n: "林一", r: "联合创始人", img: ph("avatar", 29, 400) }, { n: "王越", r: "设计负责人", img: ph("avatar", 30, 400) }];
  if (variantId === "ateam_grid")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-3">
          {team.slice(0, 4).map((m) => (
            <div key={m.n} className="text-center">
              <img src={m.img} alt={m.n} loading="lazy" className="aspect-[4/5] w-full rounded-lg object-cover" />
              <p className="mt-1.5 text-[9px] font-semibold">{m.n}</p>
              <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{m.r}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "ateam_list")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm">
          {team.slice(0, 3).map((m) => (
            <div key={m.n} className="flex items-center gap-3 border-b py-2.5 last:border-0" style={{ borderColor: "var(--border)" }}>
              <img src={m.img} alt={m.n} loading="lazy" className="size-8 rounded-full object-cover" />
              <div className="flex-1"><p className="text-[10px] font-medium">{m.n}</p><p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{m.r}</p></div>
              <span style={{ color: "var(--muted-foreground)" }}>↗</span>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="AboutTeamPreview" />;
}

function AboutValuesPreview({ variantId }: { variantId: string }) {
  const vals = PREVIEW_CONTENT.about.values.length
    ? PREVIEW_CONTENT.about.values.map((v, i) => ({ n: ("0" + (i + 1)).slice(-2), t: v.label, d: v.desc }))
    : [{ n: "01", t: "用户至上", d: "每个决定回到真实场景" }, { n: "02", t: "干净简单", d: "克制而不复杂" }, { n: "03", t: "持续进化", d: "小步快跑" }];
  if (variantId === "avalue_grid")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="我们的价值观" title={PREVIEW_CONTENT.about.title || "我们坚守什么"} center />
        <div className="mx-auto mt-5 grid max-w-lg gap-3 sm:grid-cols-3">
          {vals.slice(0, 3).map((v) => (
            <Card key={v.n}>
              <span className="text-[9px] font-black" style={{ color: "var(--muted-foreground)" }}>{v.n}</span>
              <h3 className="mt-2 text-xs font-semibold">{v.t}</h3>
              <p className="mt-1 text-[9px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{v.d}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "avalue_timeline")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm border-l pl-5" style={{ borderColor: "var(--border)" }}>
          {vals.slice(0, 3).map((v, i) => (
            <div key={v.n} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[22px] top-1 size-2 rounded-full border-2" style={{ background: "var(--background)", borderColor: "var(--primary)" }} />
              <p className="text-sm font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{PREVIEW_CONTENT.brand} {v.t}</p>
              <p className="text-[9px] font-medium">{v.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="AboutValuesPreview" />;
}

/* ───────── Contact ───────── */
function ContactFormPreview({ variantId }: { variantId: string }) {
  const contact = PREVIEW_CONTENT.contact;
  const fNames = contact.formFields.length ? contact.formFields : ["姓名", "邮箱", "主题"];
  const field = (l: string, ph: string, full = false) => (
    <div className={"flex flex-col gap-1 " + (full ? "sm:col-span-2" : "")}>
      <label className="text-[10px] font-medium">{l}</label>
      <span className="rounded-md border px-2.5 py-1.5 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>{ph}</span>
    </div>
  );
  if (variantId === "cform_standard")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">{field(fNames[0] || "姓名", "请填写" + (fNames[0] || "姓名"))}{field(fNames[1] || "邮箱", "you@example.com")}</div>
          {fNames.length > 2 ? field(fNames[2], "请输入" + fNames[2], true) : null}
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label className="text-[10px] font-medium">留言</label>
            <span className="rounded-md border px-2.5 py-4 text-[10px]" style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted-foreground)" }}>简单描述你的需求…</span>
          </div>
          <span className="inline-block rounded-md px-4 py-1.5 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{contact.formTitle}</span>
        </div>
      </div>
    );
  if (variantId === "cform_split")
    return (
      <div className="grid gap-5 px-6 py-7 sm:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionBadge>联系</SectionBadge>
          <h3 className="mt-1.5 text-lg font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{contact.subtitle}</h3>
          <div className="mt-3 space-y-2">
            {contact.infoItems.slice(0, 2).map((i) => (
              <div key={i.label}><p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{i.label}</p><p className="text-[10px] font-medium">{i.value}</p></div>
            ))}
          </div>
        </div>
        <div className="space-y-2">{field(fNames[0] || "姓名", "请填写" + (fNames[0] || "姓名"))}{field(fNames[1] || "邮箱", "you@example.com")}{field("留言", "简单描述你的需求…")}<span className="inline-block rounded-md px-4 py-1.5 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{contact.formTitle}</span></div>
      </div>
    );
  return <PreviewFallback title="ContactFormPreview" />;
}

function ContactInfoPreview({ variantId }: { variantId: string }) {
  const contact = PREVIEW_CONTENT.contact;
  const infos = contact.infoItems.length
    ? contact.infoItems
    : [{ label: "邮箱", value: "hello@acme.com" }, { label: "电话", value: "+86 400-000-0000" }, { label: "地址", value: "上海市 · 徐汇区" }];
  const icons = [<Mail key="m" className="size-4" />, <Phone key="p" className="size-4" />, <MapPin key="mp" className="size-4" />];
  if (variantId === "cinfo_cards")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-3">
          {infos.slice(0, 3).map((c, i) => (
            <Card key={c.label} className="text-center">
              <SFIcon icon={icons[i % 3]} size="size-8" className="mx-auto" />
              <p className="mt-2 text-[8px]" style={{ color: "var(--muted-foreground)" }}>{c.label}</p>
              <p className="mt-0.5 text-[10px] font-semibold">{c.value}</p>
            </Card>
          ))}
        </div>
      </div>
    );
  if (variantId === "cinfo_editorial")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm">
          {infos.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between border-b py-3" style={{ borderColor: "var(--border)" }}>
              <span className="w-14 text-[8px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{r.label}</span>
              <span className="text-[10px] font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="ContactInfoPreview" />;
}

function ContactFaqPreview({ variantId }: { variantId: string }) {
  const faq = PREVIEW_CONTENT.faq;
  const items = faq.items.length
    ? faq.items
    : [{ q: "多久能收到回复？", a: "通常 1 个工作日内回复。" }, { q: "支持远程合作吗？", a: "支持，60% 客户来自异地。" }];
  if (variantId === "cfaq_simple")
    return (
      <div className="grid gap-5 px-6 py-7 sm:grid-cols-[1fr_1.6fr]">
      <div>
          <SectionBadge>常见问题</SectionBadge>
          <h3 className="mt-2 text-lg font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{faq.title}</h3>
          <p className="mt-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{faq.subtitle}</p>
      </div>
      <div>
        {items.map((f) => (
          <div key={f.q} className="border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between py-3">
              <span className="text-[10px] font-medium">{f.q}</span>
              <span className="text-xs" style={{ color: "var(--primary)" }}>+</span>
            </div>
            <p className="pb-3 text-[9px]" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── Misc ───────── */
function Misc404Preview({ variantId }: { variantId: string }) {
  const nf = PREVIEW_CONTENT.misc.notFound;
  if (variantId === "e404_minimal")
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
        <p className="text-5xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>404</p>
        <p className="mt-2 text-sm font-medium">{nf.title}</p>
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{nf.subtitle}</p>
        <span className="mt-4 rounded-md px-4 py-1.5 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{nf.button}</span>
      </div>
    );
  if (variantId === "e404_creative")
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
          <SectionBadge>404</SectionBadge>
          <h3 className="mt-2 text-xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{nf.title}</h3>
        <div className="mt-3 flex w-full max-w-55 items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>⌕</span>
          <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>{PREVIEW_CONTENT.docs.searchTitle}</span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {[PREVIEW_CONTENT.nav.blog, PREVIEW_CONTENT.nav.faq].map((l) => <span key={l} className="rounded-full border px-2.5 py-0.5 text-[9px]" style={{ borderColor: "var(--border)" }}>{l}</span>)}
        </div>
      </div>
    );
  // 兜底：未知变体也渲染完整 404 而非空白
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <p className="text-5xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>404</p>
      <p className="mt-2 text-sm font-medium">{nf.title}</p>
      <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{nf.subtitle}</p>
      <span className="mt-4 rounded-md px-4 py-1.5 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{nf.button}</span>
    </div>
  );
}

function MiscComingPreview({ variantId }: { variantId: string }) {
  const cm = PREVIEW_CONTENT.misc.coming;
  if (variantId === "coming_email")
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
        <span className="flex size-8 items-center justify-center rounded-lg text-xs font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✦</span>
          <SectionBadge>即将上线</SectionBadge>
          <h3 className="mt-2 text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{cm.title}<span style={{ fontStyle: "italic", color: "var(--primary)" }}>。</span></h3>
        <div className="mt-3 flex w-full max-w-60 items-center gap-1.5 rounded-full border p-1 pl-3" style={{ borderColor: "var(--border)" }}>
          <span className="min-w-0 flex-1 text-[9px]" style={{ color: "var(--muted-foreground)" }}>you@example.com</span>
          <span className="shrink-0 rounded-full px-3 py-1 text-[9px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{cm.button}</span>
        </div>
      </div>
    );
  if (variantId === "coming_timer")
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
          <SectionBadge>即将上线</SectionBadge>
          <h3 className="mt-2 text-xl font-black tracking-tight">{cm.title}</h3>
        <div className="mt-3 flex gap-2">
          {[{ v: "12", l: "天" }, { v: "08", l: "小时" }, { v: "36", l: "分钟" }].map((x) => (
            <div key={x.l} className="w-12 rounded-lg border py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="font-mono text-base font-bold">{x.v}</p>
              <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[8px]" style={{ color: "var(--muted-foreground)" }}>{cm.date}</p>
      </div>
    );
  // 兜底：未知变体也渲染完整预告页而非空白
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <span className="flex size-8 items-center justify-center rounded-lg text-xs font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✦</span>
          <SectionBadge>即将上线</SectionBadge>
          <h3 className="mt-2 text-2xl font-black tracking-tight">{cm.title}</h3>
      <p className="mt-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{cm.subtitle}</p>
      <p className="mt-4 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{cm.date}</p>
    </div>
  );
}

/* ───────── Docs ───────── */
function DocsNavPreview({ variantId }: { variantId: string }) {
  const dNav = PREVIEW_CONTENT.docs.nav.length ? PREVIEW_CONTENT.docs.nav : ["快速开始", "指南", "API"];
  const dNavGroups = dNav.map((g, gi) => ({
    g,
    items: PREVIEW_CONTENT.docs.sections.slice(gi * 2, gi * 2 + 2).map((s) => s.title),
  }));
  const dTreeGroups = dNav.map((g, gi) => ({ g, open: gi === 1 }));
  const dTreeItems = PREVIEW_CONTENT.docs.sections.length
    ? PREVIEW_CONTENT.docs.sections.slice(0, 2).map((s) => s.title)
    : ["路由", "数据获取"];
  if (variantId === "dnav_sidebar")
    return (
      <div className="px-6 py-7">
        <div className="w-48 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold">{PREVIEW_CONTENT.brand}</span>
            <span className="rounded-full border px-1.5 py-0.5 text-[8px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>v2.0</span>
          </div>
          {dNavGroups.map((grp) => (
            <div key={grp.g} className="mt-3">
              <p className="px-1.5 text-[8px] font-medium uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{grp.g}</p>
              <div className="mt-1 space-y-0.5">
                {grp.items.map((it, i) => (
                  <p key={it} className="rounded px-1.5 py-1 text-[10px]" style={i === 0 && grp.g === "快速开始" ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{it}</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "dnav_tree")
    return (
      <div className="px-6 py-7">
        <div className="w-48 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="px-1 text-xs font-bold">{PREVIEW_CONTENT.brand} Docs</p>
          {dTreeGroups.map((grp) => (
            <div key={grp.g} className="mt-1.5">
              <p className="flex items-center justify-between rounded px-1.5 py-1 text-[10px] font-medium">
                {grp.g}<span className={"text-[8px] " + (grp.open ? "rotate-90" : "")} style={{ color: "var(--muted-foreground)" }}>▸</span>
              </p>
              {grp.open && (
                <div className="ml-1.5 space-y-0.5 border-l pl-2.5" style={{ borderColor: "var(--border)" }}>
                  {dTreeItems.map((it, i) => (
                    <p key={it} className="rounded px-1.5 py-0.5 text-[9px]" style={i === 0 ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{it}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="DocsNavPreview" />;
}

function DocsContentPreview({ variantId }: { variantId: string }) {
  const dTitle = PREVIEW_CONTENT.docs.title;
  const dSubtitle = PREVIEW_CONTENT.docs.subtitle;
  const dSec0 = PREVIEW_CONTENT.docs.sections[0];
  const dApiParams = PREVIEW_CONTENT.docs.sections.slice(1).map((s, i) => ({ n: s.title, t: i % 2 ? "string" : "enum", r: "否" }));
  if (variantId === "dcont_article")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{dSubtitle}</p>
          <h3 className="mt-1 text-lg font-bold tracking-tight">{dTitle}</h3>
          <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{dSec0?.body}</p>
          <h4 className="mt-4 text-sm font-bold">{dSec0?.title}</h4>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[10px]"><li>Node.js 18+</li><li>npm 或 pnpm</li></ul>
          <div className="mt-3 rounded-md border-l-2 p-2.5 text-[10px]" style={{ borderColor: "var(--primary)", background: "color-mix(in srgb, var(--primary) 6%, transparent)" }}><b>提示：</b>Windows 用户请使用 Git Bash。</div>
          <pre className="mt-3 overflow-x-auto rounded-md border p-3 text-[9px]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>npm create {PREVIEW_CONTENT.brand}@latest my-app</pre>
        </div>
      </div>
    );
  if (variantId === "dcont_api")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-md">
          <div className="flex items-center gap-2">
            <span className="rounded bg-green-600 px-1.5 py-0.5 text-[8px] font-bold text-white">POST</span>
            <code className="text-[10px] font-semibold">/v1/projects</code>
          </div>
          <table className="mt-3 w-full overflow-hidden rounded-md border text-left text-[9px]" style={{ borderColor: "var(--border)" }}>
            <thead><tr className="border-b" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}><th className="p-1.5 font-medium">名称</th><th className="p-1.5 font-medium">类型</th><th className="p-1.5 font-medium">必填</th></tr></thead>
            <tbody>
              {dApiParams.map((p) => (
                <tr key={p.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}><td className="p-1.5 font-mono">{p.n}</td><td className="p-1.5">{p.t}</td><td className="p-1.5">{p.r}</td></tr>
              ))}
            </tbody>
          </table>
          <pre className="mt-3 overflow-x-auto rounded-md border p-3 text-[9px]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>curl -X POST https://api.example.com/v1/projects</pre>
        </div>
      </div>
    );
  return <PreviewFallback title="DocsContentPreview" />;
}

function DocsSearchPreview({ variantId }: { variantId: string }) {
  const dSearchTitle = PREVIEW_CONTENT.docs.searchTitle;
  const dSearchResults = PREVIEW_CONTENT.docs.sections.length
    ? PREVIEW_CONTENT.docs.sections.map((s) => ({ t: s.title, p: PREVIEW_CONTENT.docs.subtitle + " / " + s.title }))
    : [{ t: "快速开始", p: "指南 / 快速开始" }, { t: "配置项", p: "参考 / 配置项" }];
  if (variantId === "dsearch_bar")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto flex max-w-60 items-center gap-2 rounded-md border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>⌕</span>
          <span className="min-w-0 flex-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{dSearchTitle}</span>
          <kbd className="rounded border px-1 py-0.5 text-[8px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌘K</kbd>
        </div>
      </div>
    );
  if (variantId === "dsearch_panel")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-64 overflow-hidden rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)" }}>⌕</span>
            <span className="min-w-0 flex-1 text-[10px]">{dSearchTitle}</span>
            <kbd className="rounded border px-1 text-[8px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>Esc</kbd>
          </div>
          <div className="p-1.5">
            {dSearchResults.map((r) => (
              <div key={r.t} className="rounded px-2.5 py-2 hover:bg-muted">
                <p className="text-[10px] font-medium">{r.t}</p>
                <p className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{r.p}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="DocsSearchPreview" />;
}

/* ───────── AI Chat ───────── */
function ChatWindowPreview({ variantId }: { variantId: string }) {
  if (variantId !== "cwin_messages") return null;
  const chatMessages = PREVIEW_CONTENT.chat.messages.length
    ? PREVIEW_CONTENT.chat.messages.map((m) => ({ from: m.role === "user" ? "user" : "ai", text: m.text }))
    : [{ from: "ai", text: PREVIEW_CONTENT.chat.title }, { from: "user", text: "你好" }];
  return (
    <div className="px-6 py-7">
      <div className="mx-auto flex max-w-sm flex-col gap-3 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        {chatMessages.map((m, i) => (
          <div key={i} className={"flex items-start gap-2 " + (m.from === "user" ? "flex-row-reverse" : "")}>
            {m.from === "ai" && <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[9px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✦</span>}
            <div className={"max-w-[78%] rounded-xl px-3 py-2 text-[10px] " + (m.from === "user" ? "text-[var(--on-primary)]" : "")} style={m.from === "user" ? { background: "var(--primary)" } : { background: "var(--background)" }}>{m.text}</div>
          </div>
        ))}
        <p className="text-center text-[8px]" style={{ color: "var(--muted-foreground)" }}>AI 生成内容，请注意甄别</p>
      </div>
    </div>
  );
}

function ChatInputPreview({ variantId }: { variantId: string }) {
  const chatPlaceholder = PREVIEW_CONTENT.chat.placeholder;
  if (variantId === "cinput_bar")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto flex max-w-sm items-center gap-2 rounded-full border p-1.5 pl-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>＋</span>
          <span className="min-w-0 flex-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{chatPlaceholder}</span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>↑</span>
        </div>
      </div>
    );
  if (variantId === "cinput_panel")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto max-w-sm rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="min-h-6 text-[10px]" style={{ color: "var(--muted-foreground)" }}>{chatPlaceholder}（Enter 发送）</p>
          <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--border)" }}>
            <div className="flex gap-1.5">
              <span className="rounded-full border px-2 py-0.5 text-[8px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>智能模型 v2</span>
              <span className="rounded-full px-2 py-0.5 text-[8px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>对话</span>
            </div>
            <span className="flex size-7 items-center justify-center rounded-full text-[10px] text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>↑</span>
          </div>
        </div>
      </div>
    );
  return <PreviewFallback title="ChatInputPreview" />;
}

function ChatSuggestPreview({ variantId }: { variantId: string }) {
  const sugg = PREVIEW_CONTENT.chat.suggestions.length ? PREVIEW_CONTENT.chat.suggestions : ["总结本周数据", "写一段产品文案", "分析竞品定价"];
  const suggCards = sugg.slice(0, 4).map((c, i) => ({ icon: [<FileText className="size-4" key="a" />, <PenLine className="size-4" key="b" />, <BarChart3 className="size-4" key="c" />, <Code className="size-4" key="d" />][i], t: c, d: c }));
  if (variantId === "csugg_chips")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto flex max-w-sm flex-wrap justify-center gap-2">
          {sugg.map((c) => (
            <span key={c} className="rounded-full border px-3 py-1 text-[9px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{c}</span>
          ))}
        </div>
      </div>
    );
  if (variantId === "csugg_card")
    return (
      <div className="px-6 py-7">
        <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">
          {suggCards.map((c) => (
            <div key={c.t} className="flex items-start gap-2 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <span className="text-sm" style={{ color: "var(--primary)" }}>{c.icon}</span>
              <span><span className="block text-[10px] font-semibold">{c.t}</span><span className="text-[8px]" style={{ color: "var(--muted-foreground)" }}>{c.d}</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="ChatSuggestPreview" />;
}

// ── 动效联动（步骤3）：与 motion-library 变体 id 对应的示意动画 ──
// 现已全切 GSAP：applyMotionPreview(el, motionId) 见下方，由 builder/page.tsx 的
// useGSAP 在 motionId 变化时驱动（替代原 CSS 关键帧示意动画）。
/** 由 motion-library 变体 id → GSAP 示意动画（替代原 CSS 关键帧 motionAnim）。
 *   - 入场类：播放一次即停（不 infinite 频闪）；
 *   - 仅 hover-lift 等持续型保留 repeat:-1，且放慢；
 *   - reveal-on-scroll / scroll-scrub / parallax-*：接入真实 ScrollTrigger，
 *     与 motion-library 产出的蓝图代码保持一致（scroller 由调用方传入预览滚动容器）。 */
export function applyMotionPreview(
  el: HTMLElement,
  motionId?: string,
  scroller?: HTMLElement,
  params?: { distance?: number; duration?: number },
): void {
  if (!el || !motionId) return;
  const opt = (vars: gsap.TweenVars) => ({ overwrite: "auto" as const, ...vars });
  const ST = { trigger: el, scroller } as const;
  // 微调默认值：distance=上浮位移(px)，duration=时长(s)；未传回退引擎预设
  const D = params?.distance;
  const T = params?.duration;
  switch (motionId) {
    case "text-rise":
    case "fade-up":
    case "scroll-fade": {
      const fromY = D ?? 28;
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: fromY },
        opt({ autoAlpha: 1, y: 0, duration: T ?? 2.2, ease: "power3.out" }),
      );
      break;
    }
    case "scroll-clip": {
      // 与蓝图一致：图片自下而上 clip 揭示 + 轻微放大
      const clipImg = el.querySelector("img");
      gsap.set(el, { clipPath: "inset(0 0 100% 0)" });
      const tl = gsap.timeline({ scrollTrigger: { ...ST, start: "top 85%" } });
      tl.to(el, { clipPath: "inset(0 0 0% 0)", duration: 1, ease: "power4.inOut" });
      if (clipImg) tl.fromTo(clipImg, { scale: 1.1 }, { scale: 1, duration: 1.2, ease: "power3.out" }, 0);
      break;
    }
    case "scroll-circle":
      // 与蓝图一致：圆形 clip 从中心扩散揭示
      gsap.fromTo(el, { clipPath: "circle(0% at 50% 50%)" }, opt({ clipPath: "circle(75% at 50% 50%)", duration: 1.1, ease: "power3.inOut", scrollTrigger: { ...ST, start: "top 85%" } }));
      break;
    case "scroll-horizontal":
      // 与蓝图一致：吸顶 + 横向平移（pin + scrub）
      gsap.fromTo(el, { x: 0 }, opt({ x: -160, ease: "none", scrollTrigger: { ...ST, start: "top top", end: "+=120%", pin: true, scrub: 1 } }));
      break;
    case "sticky-stack": {
      // 与蓝图一致：贴卡堆叠——子卡片依次钉在视口顶，前卡被下一张推开时缩小让位
      const cards = Array.from(el.querySelectorAll(":scope > *"));
      if (cards.length > 1) {
        cards.forEach((card, i) => {
          if (i === cards.length - 1) return;
          ScrollTrigger.create({
            trigger: card as HTMLElement,
            start: "top top",
            endTrigger: cards[cards.length - 1] as HTMLElement,
            end: "top top",
            pin: true,
            pinSpacing: false,
          });
          gsap.to(card, {
            scale: 0.92, opacity: 0.55, ease: "none",
            scrollTrigger: {
              trigger: cards[i + 1] as HTMLElement,
              start: "top bottom", end: "top top", scrub: true,
            },
          });
        });
      } else {
        gsap.fromTo(el, { autoAlpha: 0, y: 40 }, opt({ autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out" }));
      }
      break;
    }
    case "reveal-on-scroll":
      // 与蓝图一致：进入视口时淡入上滑（滚动触发一次）
      gsap.from(el, opt({
        opacity: 0, y: D ?? 40, duration: T ?? 0.7, ease: "power2.out",
        scrollTrigger: { ...ST, start: "top 90%" },
      }));
      break;
    case "text-chars":
    case "text-words": {
      // 逐字/逐词揭示：纯文本元素用 SplitText 拆字 stagger；含复杂 DOM（图/按钮）时回退整体动画
      const complex = el.querySelector("img, svg, input, button, a, textarea");
      if (!complex) {
        try {
          const split = new SplitText(el, {
            type: motionId === "text-chars" ? "chars" : "words",
            charsClass: "tx-char",
            wordsClass: "tx-word",
          });
          gsap.fromTo(
            split[motionId === "text-chars" ? "chars" : "words"],
            { opacity: 0, y: 26, rotateX: -50 },
            { opacity: 1, y: 0, rotateX: 0, duration: 1.1, ease: "power3.out", stagger: 0.04 },
          );
          break;
        } catch {
          // SplitText 失败时走整体动画兜底
        }
      }
      gsap.fromTo(el, { autoAlpha: 0, y: 20, scale: 0.98 }, opt({ autoAlpha: 1, y: 0, scale: 1, duration: 2.0, ease: "power3.out" }));
      break;
    }
    case "text-rotate":
      gsap.fromTo(el, { autoAlpha: 0, y: 20, scale: 0.98 }, opt({ autoAlpha: 1, y: 0, scale: 1, duration: T ?? 2.0, ease: "power3.out" }));
      break;
    case "text-mask-reveal":
      gsap.fromTo(el, { clipPath: "inset(0 0 100% 0)", autoAlpha: 0 }, opt({ clipPath: "inset(0 0 0% 0)", autoAlpha: 1, duration: T ?? 1.8, ease: "power3.out" }));
      break;
    case "data-count":
      // 蓝图为数字滚动 CountUp（作用于 span 文本）；预览容器非纯数字，以缩放入场示意
      gsap.fromTo(el, { scale: 1.18, autoAlpha: 0 }, opt({ scale: 1, autoAlpha: 1, duration: T ?? 2.0, ease: "power2.out" }));
      break;
    case "spring":
      gsap.fromTo(el, { scale: 0.9, autoAlpha: 0 }, opt({ scale: 1, autoAlpha: 1, duration: T ?? 1.2, ease: "elastic.out(1, 0.6)" }));
      break;
    case "spring-bounce":
      gsap.fromTo(el, { y: -32, scale: 0.96, autoAlpha: 0 }, opt({ y: 0, scale: 1, autoAlpha: 1, duration: T ?? 1.6, ease: "back.out(2)" }));
      break;
    case "spring-elastic":
      gsap.fromTo(el, { scale: 0.6, autoAlpha: 0 }, opt({ scale: 1, autoAlpha: 1, duration: T ?? 1.8, ease: "elastic.out(1, 0.4)" }));
      break;
    case "wobble": {
      const tl = gsap.timeline({ overwrite: "auto" });
      tl.to(el, { rotation: -4, duration: 0.4 })
        .to(el, { rotation: 3, duration: 0.3 })
        .to(el, { rotation: -2, duration: 0.3 })
        .to(el, { rotation: 1.5, duration: 0.3 })
        .to(el, { rotation: 0, duration: 0.3 });
      break;
    }
    case "hover-lift":
      gsap.to(el, opt({
        y: -(D ?? 8),
        duration: T ?? 1.6,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      }));
      break;
    case "motion-none":
      gsap.set(el, { clearProps: "all" });
      break;
    case "page-transition":
      gsap.fromTo(el, { autoAlpha: 0, x: 28 }, opt({ autoAlpha: 1, x: 0, duration: T ?? 2.4, ease: "power2.out" }));
      break;
    case "parallax-page":
      // 与蓝图一致：路由切换淡入 + 右移挂载转场（非 scroll，mount 时播放一次）
      gsap.from(el, opt({ opacity: 0, x: 16, duration: 0.3, ease: "power2.out" }));
      break;
    case "scroll-scrub":
      // 与蓝图一致：进度绑定滚动位置（scrub，跟手联动）
      gsap.fromTo(el, { x: -60 }, opt({
        x: 60, ease: "none",
        scrollTrigger: { ...ST, start: "top bottom", end: "bottom top", scrub: true },
      }));
      break;
    case "motion-path":
      gsap.fromTo(el, { x: 0, y: 0 }, opt({ x: 48, y: -12, duration: 1.5, ease: "power1.inOut" }));
      break;
    case "parallax-hero":
      // 与蓝图一致：背景/前景不同速度（scrub 纵深位移）
      gsap.fromTo(el, { yPercent: 18 }, opt({
        yPercent: -18, ease: "none",
        scrollTrigger: { ...ST, start: "top bottom", end: "bottom top", scrub: true },
      }));
      break;
    case "parallax-layers":
      // 与蓝图一致：多层不同速度（scrub 纵深位移，幅度更大）
      gsap.fromTo(el, { yPercent: 10 }, opt({
        yPercent: -28, ease: "none",
        scrollTrigger: { ...ST, start: "top bottom", end: "bottom top", scrub: true },
      }));
      break;
    case "zentry-image": {
      // 与蓝图一致：图片 clip 揭示后钉住滚动叙事（pin + scrub）
      const reveal = el.querySelector("img") ?? el;
      const tl = gsap.timeline({
        scrollTrigger: { ...ST, start: "top top", end: "+=120%", pin: true, scrub: 1 },
      });
      tl.fromTo(reveal, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 1 })
        .to(reveal, { scale: 1.1, duration: 1 }, 0);
      break;
    }
    case "data-marquee":
      // 蓝图：无限向左无缝跑马灯（双副本）；预览容器以循环平移示意
      gsap.to(el, opt({ xPercent: -30, duration: 10, ease: "none", repeat: -1, yoyo: true }));
      break;
    default:
      break;
  }
  // 真实滚动联动后刷新度量，避免容器高度随占位变化导致触发点错位
  if (["reveal-on-scroll", "scroll-fade-up", "scroll-clip", "scroll-circle", "scroll-horizontal", "sticky-stack", "scroll-scrub", "parallax-hero", "parallax-layers", "zentry-image"].includes(motionId)) {
    ScrollTrigger.refresh();
  }
}

function ProcessPreview({ variantId }: { variantId: string }) {
  const procTitle = PREVIEW_CONTENT.process.title;
  const procSteps = PREVIEW_CONTENT.process.items.length
    ? PREVIEW_CONTENT.process.items.map((it, i) => ({ n: ("0" + (i + 1)).slice(-2), t: it.name }))
    : [{ n: "01", t: "描述需求" }, { n: "02", t: "选择区块" }, { n: "03", t: "生成代码" }];
  if (variantId === "home_process_editorial")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="流程" title={procTitle} />
        <div className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
          {procSteps.map((s) => (
            <div key={s.n} className="grid grid-cols-[auto_1fr] items-baseline gap-3 py-2.5">
              <span className="text-2xl font-black italic" style={{ color: "var(--primary)", fontFamily: "var(--font-heading)" }}>{s.n}</span>
              <p className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{s.t}</p>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "home_process_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <SectionHead badge="流程" title={procTitle} center />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { n: "1", c: "#22D3EE" },
            { n: "2", c: "#F472B6" },
            { n: "3", c: "#34D399" },
          ].map((s) => (
            <div key={s.n} className="rounded-lg p-3" style={{ border: "1px solid color-mix(in srgb, " + s.c + " 45%, transparent)", background: "color-mix(in srgb, " + s.c + " 8%, #141416)" }}>
              <span className="text-2xl font-black" style={{ color: s.c, textShadow: "0 0 14px " + s.c }}>{s.n}</span>
            </div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="ProcessPreview" />;
}

function IntegrationsPreview({ variantId }: { variantId: string }) {
  const intItems = PREVIEW_CONTENT.features.items.length
    ? PREVIEW_CONTENT.features.items.slice(0, 3).map((f, i) => ({ n: f.name, c: ["#22D3EE", "#F472B6", "#34D399"][i] }))
    : [{ n: "Slack", c: "#22D3EE" }, { n: "Figma", c: "#F472B6" }, { n: "Notion", c: "#34D399" }];
  if (variantId === "home_int_editorial")
    return (
      <div className="px-6 py-7">
        <SectionHead badge="集成" title="集成生态" />
        <div className="mt-3 border-y" style={{ borderColor: "var(--border)" }}>
          {intItems.map((t) => (
            <div key={t.n} className="flex items-center justify-between border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
              <span className="text-[10px] font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{t.n}</span>
              <span className="text-[9px]" style={{ color: "var(--muted-foreground)" }}>→</span>
            </div>
          ))}
        </div>
      </div>
    );
  if (variantId === "home_int_neon")
    return (
      <div className="px-6 py-7" style={{ background: "#0B0B0C" }}>
        <SectionHead badge="集成" title="集成生态" center />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {intItems.map((t) => (
            <div key={t.n} className="rounded-lg py-2.5 text-center text-[9px] font-semibold" style={{ border: "1px solid color-mix(in srgb, " + t.c + " 40%, transparent)", background: "color-mix(in srgb, " + t.c + " 8%, #141416)", color: t.c }}>{t.n}</div>
          ))}
        </div>
      </div>
    );
  return <PreviewFallback title="IntegrationsPreview" />;
}

function ContactPreview({ variantId }: { variantId: string }) {
  const ctTitle = PREVIEW_CONTENT.contact.title;
  const ctSubtitle = PREVIEW_CONTENT.contact.subtitle;
  const ctFormFields = PREVIEW_CONTENT.contact.formFields.length ? PREVIEW_CONTENT.contact.formFields : ["姓名", "邮箱"];
  if (variantId === "home_ct_editorial")
    return (
      <div className="px-6 py-7">
        <SectionBadge>联系</SectionBadge>
        <h3 className="mt-1.5 text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>{ctTitle}</h3>
        <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {ctFormFields.map((l) => (
            <div key={l}>
              <label className="text-[8px] uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>{l}</label>
              <div className="mt-1 h-7 border-b" style={{ borderColor: "var(--border)" }} />
            </div>
          ))}
          <div className="rounded-md py-2 text-center text-[10px] font-semibold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>发送</div>
        </div>
      </div>
    );
  if (variantId === "home_ct_neon")
    return (
      <div className="px-6 py-7" style={{ background: "linear-gradient(135deg,#0B0B0C,#122229)" }}>
        <SectionHead badge="联系" title={ctTitle} center />
        <div className="mx-auto mt-4 max-w-xs rounded-xl p-4" style={{ border: "1px solid color-mix(in srgb, #22D3EE 35%, transparent)", background: "rgba(20,20,22,0.7)", backdropFilter: "blur(14px)" }}>
          <div className="mt-3 space-y-2">
            {ctFormFields.slice(0, 2).map((l) => (
              <div key={l} className="rounded-md px-2.5 py-2 text-[10px] text-slate-500" style={{ background: "#141416" }}>{l}</div>
            ))}
          </div>
          <div className="mt-3 rounded-md py-2 text-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#22D3EE,#F472B6)", boxShadow: "0 8px 22px -10px #22D3EE" }}>发送</div>
        </div>
      </div>
    );
  return <PreviewFallback title="ContactPreview" />;
}

/* ───────── 加载反馈（Feedback） ───────── */
function LoaderSpinnerPreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <span className="size-8 animate-spin rounded-full border-[3px]" style={{ borderColor: "var(--surface)", borderTopColor: "var(--primary)" }} />
    </div>
  );
}

function LoaderProgressPreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-4 px-10" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-xs overflow-hidden rounded-full" style={{ height: 4, background: "var(--surface)" }}>
        <div className="h-full rounded-full" style={{ width: "62%", background: "var(--primary)" }} />
      </div>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>正在上传 · 62%</p>
    </div>
  );
}

function LoaderCircularPreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="relative size-16 rounded-full" style={{ background: "conic-gradient(var(--primary) 0 75%, var(--surface) 75% 100%)" }}>
        <div className="absolute inset-1.5 flex items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--background)" }}>
          75%
        </div>
      </div>
    </div>
  );
}

function LoaderSkeletonPreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 flex-col justify-center gap-3 px-10" style={{ background: "var(--background)" }}>
      <div className="h-3 w-2/3 rounded" style={{ background: "var(--surface)" }} />
      <div className="h-3 w-1/3 rounded" style={{ background: "var(--surface)" }} />
      <div className="mt-2 h-20 rounded-xl" style={{ background: "var(--surface)" }} />
    </div>
  );
}

function LoaderShimmerPreview({ variantId }: { variantId: string }) {
  void variantId;
  const k = "fb-sweep-preview";
  return (
    <>
      <style>{"@keyframes " + k + '{0%{background-position:120% 0}100%{background-position:-120% 0}}'}</style>
      <div className="flex h-40 flex-col justify-center gap-3 px-10" style={{ background: "var(--background)" }}>
        {[12, 10, 72].map((h, i) => (
          <div
            key={i}
            className="rounded"
            style={{
              height: h,
              backgroundImage: "linear-gradient(100deg,var(--surface) 35%,color-mix(in srgb, var(--foreground) 10%, transparent) 50%,var(--surface) 65%)",
              backgroundSize: "200% 100%",
              animation: k + " 1.4s linear infinite",
            }}
          />
        ))}
      </div>
    </>
  );
}

function LoaderButtonPreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <button className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--on-primary)] opacity-80" style={{ background: "var(--primary)" }} disabled>
        <span className="size-4 animate-spin rounded-full border-2" style={{ borderColor: "var(--on-primary)", borderTopColor: "transparent" }} />
        提交中…
      </button>
    </div>
  );
}

function LoaderPagePreview({ variantId }: { variantId: string }) {
  void variantId;
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3" style={{ background: "var(--background)" }}>
      <span className="size-9 animate-spin rounded-full border-[3px]" style={{ borderColor: "var(--surface)", borderTopColor: "var(--primary)" }} />
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>正在加载…</p>
    </div>
  );
}
