"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  CloudFog,
  Disc3,
  Download,
  FolderOpen,
  Globe,
  Layers,
  Loader2,
  Keyboard,
  MousePointerClick,
  Orbit,
  Palette,
  PanelsTopLeft,
  PanelLeft,
  PanelLeftClose,
  Package,
  Rotate3d,
  Scan,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Waves,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";

// 重型/带第三方依赖（three、canvas、gsap、整站 bundle）的预览改用 next/dynamic 代码分割，
// 避免首屏静态打进这些大模块；加载中的兜底用轻量骨架。
function PreviewLoading() {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" />
    </div>
  );
}
import { BRAND_SITES } from "@/data/brand-sites";
import { PROJECT_TYPES } from "@/data/project-types";
import { downloadBlob } from "@/lib/zip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
const FluidText = dynamic(() => import("@/components/originkit/ui/fluid-text"), { loading: PreviewLoading });
const SmokyText = dynamic(() => import("@/components/originkit/ui/smokytext"), { loading: PreviewLoading });
const FlashlightText = dynamic(() => import("@/components/originkit/ui/spotlighttext"), { loading: PreviewLoading });
const RingGallery = dynamic(() => import("@/components/originkit/ring-gallery").then((m) => m.RingGallery), { loading: PreviewLoading });
const Smooth3DSlideshow = dynamic(() => import("@/components/originkit/coverflow-gallery/ui/coverflowgallery"), { loading: PreviewLoading });
const RoundCarousel = dynamic(() => import("@/components/originkit/round-carousel/ui/roundcarousel"), { loading: PreviewLoading });
import ShinyPill from "@/components/originkit/ui/shiny-pill";
const WaterButton = dynamic(() => import("@/components/originkit/ui/water-button"), { loading: PreviewLoading });
import KeycapButton from "@/components/originkit/ui/keycap-button";
import MovingGradientButton from "@/components/originkit/ui/moving-gradient-button";
import ButtonResource from "@/components/originkit/ui/button-resource";
const Hero36 = dynamic(() => import("@/components/originkit/hero-36"), { loading: PreviewLoading });
const Hero19 = dynamic(() => import("@/components/originkit/hero-19"), { loading: PreviewLoading });
const Hero04 = dynamic(() => import("@/components/originkit/hero-04"), { loading: PreviewLoading });
import OutstandHero from "@/components/originkit/outstand/hero";
import OutstandPricing from "@/components/originkit/outstand/pricing";
import OutstandFaq from "@/components/originkit/outstand/faq";
import OutstandTestimonials from "@/components/originkit/outstand/testimonials";
import OutstandFeatures from "@/components/originkit/outstand/features";
import OutstandAbout from "@/components/originkit/outstand/about";
import OutstandCta from "@/components/originkit/outstand/cta";
import OutstandProcess from "@/components/originkit/outstand/process";
import OutstandProjects from "@/components/originkit/outstand/projects";
import OutstandWhyChooseUs from "@/components/originkit/outstand/why-choose-us";
import OutstandValues from "@/components/originkit/outstand/values";
import OutstandExpertise from "@/components/originkit/outstand/expertise";
import OutstandDigitalSolutions from "@/components/originkit/outstand/digital-solutions";
import OutstandBenefits from "@/components/originkit/outstand/benefits";
import OutstandBenefitsSection from "@/components/originkit/outstand/benefits-section";
import OutstandContactUs from "@/components/originkit/outstand/contact-us";
import OutstandLetsWorkTogether from "@/components/originkit/outstand/lets-work-together";
import OutstandOurSolutionSection from "@/components/originkit/outstand/our-solution-section";
import OutstandWorksContactUs from "@/components/originkit/outstand/works-contact-us";
import OutstandWorksExcellence from "@/components/originkit/outstand/works-excellence";
import OutstandWorksPartners from "@/components/originkit/outstand/works-partners";
import OutstandWorksPortfolio from "@/components/originkit/outstand/works-portfolio";
import OutstandWorksProjects from "@/components/originkit/outstand/works-projects";
import OutstandWorksProjectsHero from "@/components/originkit/outstand/works-projects-hero";
import OutstandWorksTestimonials from "@/components/originkit/outstand/works-testimonials";
import OutstandServicesBenefits from "@/components/originkit/outstand/services-benefits";
import OutstandServicesComparison from "@/components/originkit/outstand/services-comparison";
import OutstandServicesExpertise from "@/components/originkit/outstand/services-expertise";
import OutstandServicesFaq from "@/components/originkit/outstand/services-faq";
import OutstandServicesHero from "@/components/originkit/outstand/services-hero";
import OutstandServicesKeyFeatures from "@/components/originkit/outstand/services-keyfeatures";
import OutstandServicesPayment from "@/components/originkit/outstand/services-payment";
import OutstandServicesPricingPlan from "@/components/originkit/outstand/services-pricingplan";
import OutstandServicesProcess from "@/components/originkit/outstand/services-process";
import OutstandServicesServices from "@/components/originkit/outstand/services-services";
import OutstandServicesOverview from "@/components/originkit/outstand/services-overview";
import OutstandAboutCallToAction from "@/components/originkit/outstand/about-call-to-action";
import OutstandAboutCareers from "@/components/originkit/outstand/about-careers";
import OutstandAboutExcellence from "@/components/originkit/outstand/about-excellence";
import OutstandAboutFeatures from "@/components/originkit/outstand/about-features";
import OutstandAboutHero from "@/components/originkit/outstand/about-hero";
import OutstandAboutOurCulture from "@/components/originkit/outstand/about-our-culture";
import OutstandAboutOurStory from "@/components/originkit/outstand/about-our-story";
import OutstandAboutTeamMembers from "@/components/originkit/outstand/about-team-members";
import OutstandAboutTestimonials from "@/components/originkit/outstand/about-testimonials";
import OutstandContactDigitalPresence from "@/components/originkit/outstand/contact-digital-presence";
import OutstandContactFaq from "@/components/originkit/outstand/contact-faq";
import OutstandContactHero from "@/components/originkit/outstand/contact-hero";
import OutstandContactSupport from "@/components/originkit/outstand/contact-support";
import OutstandNotFound from "@/components/originkit/outstand/not-found";
import OutstandPrivacyPolicy from "@/components/originkit/outstand/privacy-policy";
const WexoStudio = dynamic(() => import("@/components/originkit/wexo/studio"), { loading: PreviewLoading });
const WexoSite = dynamic(() => import("@/components/originkit/wexo/site"), { loading: PreviewLoading });
const OutstandSite = dynamic(() => import("@/components/originkit/outstand/site"), { loading: PreviewLoading });
const GeniusSite = dynamic(() => import("@/components/originkit/genius/site"), { loading: PreviewLoading });
import {
  COMPONENT_LIB,
  FLUID_PALETTES,
  sourcePathFor,
  type LibraryComponent,
} from "@/data/component-library";

type Settings = Record<string, string | number | string[]>;

const ICONS: Record<string, ReactNode> = {
  Waves: <Waves className="size-4" />,
  CloudFog: <CloudFog className="size-4" />,
  Scan: <Scan className="size-4" />,
  Orbit: <Orbit className="size-4" />,
  PanelsTopLeft: <PanelsTopLeft className="size-4" />,
  Rotate3d: <Rotate3d className="size-4" />,
  Disc3: <Disc3 className="size-4" />,
  Keyboard: <Keyboard className="size-4" />,
  Sparkles: <Sparkles className="size-4" />,
  Palette: <Palette className="size-4" />,
  MousePointerClick: <MousePointerClick className="size-4" />,
};

type SimpleGroup = { type: "simple"; items: LibraryComponent[] };
type SiteGroup = { type: "sites"; sites: Record<string, LibraryComponent[]> };
type Group = { category: string; icon: ReactNode } & (SimpleGroup | SiteGroup);

const CATEGORY_ICONS: Record<string, ReactNode> = {
  特效: <Wand2 className="size-4" />,
  区块: <Layers className="size-4" />,
  按钮: <MousePointerClick className="size-4" />,
  整站模板: <Globe className="size-4" />,
};

function groupComponents(components: LibraryComponent[]): Group[] {
  const byCategory = new Map<string, LibraryComponent[]>();
  for (const c of components) {
    byCategory.set(c.category, [...(byCategory.get(c.category) ?? []), c]);
  }
  return Array.from(byCategory.entries()).map(([category, items]) => {
    const siteItems = items.filter((c) => c.site);
    const plainItems = items.filter((c) => !c.site);
    const icon = CATEGORY_ICONS[category] ?? <PanelsTopLeft className="size-4" />;
    if (siteItems.length > 0) {
      const sites: Record<string, LibraryComponent[]> = {};
      for (const c of siteItems) {
        sites[c.site!] = [...(sites[c.site!] ?? []), c];
      }
      if (plainItems.length > 0) sites["默认"] = plainItems;
      return { category, icon, type: "sites" as const, sites };
    }
    return { category, icon, type: "simple" as const, items };
  });
}

/**
 * 全宽区块/Hero 预览容器：子内容宽度超出容器时自动按 scale 缩小，
 * 保证固定宽度设计稿（如 Outstand 整站模板 1140px）在窄预览区也能完整展示。
 */
function WidePreviewFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const fit = () => {
      // 先把 transform / width 补偿重置为未缩放状态，再测真实溢出宽度。
      // 之前用 absolute + max-content 挪出视口测「自然宽度」，遇到内部有
      // w-full 包装层时读不准（SectionScope 的 w-full 会让 max-content
      // 测回容器宽度），导致 scale 恒为 1、右侧溢出。直接读正常布局下
      // content.scrollWidth（包含子元素溢出）更可靠。
      const prevTransform = content.style.transform;
      const prevWidth = content.style.width;
      content.style.transform = "none";
      content.style.width = "100%";

      const cw = container.clientWidth;
      const sw = content.scrollWidth;
      const s = cw > 0 && sw > cw ? cw / sw : 1;

      content.style.transform = prevTransform;
      content.style.width = prevWidth;
      setScale(s);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    window.addEventListener("load", onResize);
    const timers = [100, 300, 600].map((ms) => setTimeout(fit, ms));
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", onResize);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-[var(--radius)] bg-background"
    >
      <div
        ref={contentRef}
        className="w-full"
        style={{
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          // 缩放后占位宽度随之收缩，保证后续内容不错位
          width: scale < 1 ? `${(100 / scale).toFixed(4)}%` : "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Outstand 区块作用域容器：深色底 + 主题色变量。
 */
function SectionScope({
  children,
  accent,
}: {
  children: ReactNode;
  accent: string;
}) {
  return (
    <div
      className="w-full"
      style={{
        background: "#0f0f0f",
        ["--color-accent" as string]: accent,
        ["--color-accent-soft" as string]: accent,
      }}
    >
      {children}
    </div>
  );
}

function defaultSettings(comp: LibraryComponent): Settings {
  const s: Settings = {};
  for (const st of comp.settings) s[st.key] = st.default;
  return s;
}

function buildUsageCode(comp: LibraryComponent, settings: Settings): string {
  // 每个组件生成可直接复制的使用示例；完整源码由「复制源码」读取源文件给出
  // 整站模板 · 全部：iframe 嵌入完整站点首页，支持多页点击
  if (comp.id.endsWith("-all")) {
    const site = comp.id.slice(0, -4); // e.g. "wexo-all" -> "wexo"
    return `"use client";
// ${comp.name}：iframe 嵌入完整站点首页，还原多页交互
export function Demo() {
  return (
    <iframe
      src="/api/originkit/${site}/index.html"
      style={{ width: "100%", height: "760px", border: 0 }}
      title="${comp.name}"
    />
  );
}`;
  }

  // Wexo 整站模板区块：thin wrapper 直接渲染 Originkit 原版 HTML 片段（动效由 framer.css 承载）
  if (comp.id.startsWith("wexo-")) {
    const slug = comp.id.slice("wexo-".length);
    const Pascal =
      "Wexo" + slug.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    return `"use client";
import ${Pascal} from "@/components/originkit/wexo/${slug}";

export function Demo() {
  return <${Pascal} />;
}`;
  }

  // Genius 整站模板页面：直链线上真实站点（Framer 平台），完整还原交互
  if (comp.id.startsWith("genius-")) {
    const slug = comp.id.slice("genius-".length);
    return `"use client";
// Genius 整站页面：直链 Framer 线上真实站点，完整还原 HTML/CSS/JS 交互
export function Demo() {
  return (
    <iframe
      src="https://genius.framer.wiki/${slug}"
      style={{ width: "100%", height: "760px", border: 0 }}
      title="Genius ${slug}"
    />
  );
}`;
  }

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

  if (comp.id === "coverflow-gallery") {
    const n = (k: string, def = 0) => Number(settings[k] ?? def)
    const s = (k: string, def: string) => String(settings[k] ?? def)
    return `"use client";
import Smooth3DSlideshow from "@/components/originkit/coverflow-gallery/ui/coverflowgallery";

export function Demo() {
  return (
    <div className="relative flex h-[480px] w-full items-center justify-center overflow-hidden bg-[#0c0c0f]">
      <Smooth3DSlideshow
        cardWidth={${n("cardWidth", 400)}}
        cardHeight={${n("cardHeight", 400)}}
        radius={${n("radius", 3)}}
        tilt={${n("tilt", 12)}}
        sideTilt={${n("sideTilt", 8)}}
        gap={${n("gap", 8)}}
        opacity={${n("opacity", 60)}}
        autoplay={${s("autoplay", "off") === "on"}}
        autoplayDirection="${s("autoplayDirection", "rightToLeft")}"
        showTitle={${s("showTitle", "on") !== "off"}}
        titleColor="${s("titleColor", "#ffffff")}"
      />
    </div>
  );
}`;
  }

  if (comp.id === "round-carousel") {
    const n = (k: string, def = 0) => Number(settings[k] ?? def)
    const s = (k: string, def: string) => String(settings[k] ?? def)
    return `"use client";
import RoundCarousel from "@/components/originkit/round-carousel/ui/roundcarousel";

export function Demo() {
  return (
    <div className="relative h-[480px] w-full overflow-hidden">
      <RoundCarousel
        imageWidth={${n("imageWidth", 300)}}
        imageHeight={${n("imageHeight", 300)}}
        spacing={${n("spacing", 3)}}
        speed={${n("speed", 7)}}
        direction="${s("direction", "right")}"
        drag={${s("drag", "on") !== "off"}}
        sensitivity={${n("sensitivity", 5)}}
        tilt={${n("tilt", -7)}}
        perspective={${n("perspective", 3000)}}
        cornerRadius={${n("cornerRadius", 22)}}
        innerDim={${n("innerDim", 3.5)}}
        background="${s("background", "#000000")}"
      />
    </div>
  );
}`;
  }

  if (comp.id === "shiny-pill") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def: number) => Number(settings[k] ?? def);
    return `"use client";
import ShinyPill from "@/components/originkit/ui/shiny-pill";

export function Demo() {
  const font = {
    fontFamily: "Inter",
    fontWeight: 700,
    fontSize: "${n("fontSize", 120)}px",
    letterSpacing: "-0.01em",
    lineHeight: "1em",
  };
  return (
    <div className="flex h-[240px] w-full items-center justify-center bg-[#0c0c0f] overflow-hidden px-6">
      <ShinyPill
        text="${s("text", "SHINY PILL")}"
        textColor="${s("textColor", "#FFFFFF")}"
        shineColor="${s("shineColor", "#78FF83")}"
        speed={${n("speed", 1.5)}}
        font={font}
        ${s("link", "") ? `link="${s("link", "")}"` : ""}
      />
    </div>
  );
}`;
  }

  if (comp.id === "water-button") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def: number) => Number(settings[k] ?? def);
    return `"use client";
import WaterButton from "@/components/originkit/ui/water-button";

export function Demo() {
  return (
    <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#1a1f2e] via-[#232a3f] to-[#12151d] p-8">
      <WaterButton
        label="${s("label", "WATER BUTTON")}"
        textColor="${s("textColor", "#000000")}"
        waterColor="${s("waterColor", "#00EEFF")}"
        waterAmount={${n("waterAmount", 69)}}
        paddingX={${n("paddingX", 64)}}
        paddingY={${n("paddingY", 38)}}
        rounded={${n("rounded", 100)}}
        font={{ fontSize: ${n("fontSize", 16)}, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 500 }}
        border={${s("border", "on")} === "on"}
        press={${s("press", "on")} === "on"}
      />
    </div>
  );
}`;
  }

  if (comp.id === "keycap-button") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def: number) => Number(settings[k] ?? def);
    return `"use client";
import KeycapButton from "@/components/originkit/ui/keycap-button";

export function Demo() {
  return (
    <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#0e0f14] via-[#171a24] to-[#0a0b10] p-8">
      <KeycapButton
        label="${s("label", "KEY CAP")}"
        colors={{ fill: "${s("fill", "#16121D")}", textColor: "${s("textColor", "#A05CFF")}", hoverTextColor: "#FFFFFF" }}
        prism={{ color: "${s("prismColor", "#A05CFF")}" }}
        rounded={${n("rounded", 45)}}
        font={{ fontSize: ${n("fontSize", 24)}, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700 }}
      />
    </div>
  );
}`;
  }

  if (comp.id === "moving-gradient-button") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def: number) => Number(settings[k] ?? def);
    return `"use client";
import MovingGradientButton from "@/components/originkit/ui/moving-gradient-button";

export function Demo() {
  return (
    <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#1a1f2e] via-[#232a3f] to-[#12151d] p-8">
      <MovingGradientButton
        label="${s("label", "MOVING GRADIENT")}"
        colors={{ fill: "${s("fill", "#000000")}", textColor: "${s("textColor", "#FFFFFF")}", hoverTextColor: "${s("hoverTextColor", "#CCC30E")}" }}
        rounded={${n("rounded", 100)}}
        font={{ fontSize: ${n("fontSize", 24)}, fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700 }}
      />
    </div>
  );
}`;
  }

  if (comp.id === "button-resource") {
    const s = (k: string, def: string) => String(settings[k] ?? def);
    const n = (k: string, def: number) => Number(settings[k] ?? def);
    return `"use client";
import ButtonResource from "@/components/originkit/ui/button-resource";

export function Demo() {
  return (
    <div className="flex min-h-[20rem] w-full items-center justify-center bg-[#0c0c0f] p-8">
      <ButtonResource
        style="${s("style", "moving")}"
        label="${s("label", "开始体验")}"
        fill="${s("fill", "#000000")}"
        textColor="${s("textColor", "#FFFFFF")}"
        hoverTextColor="${s("hoverTextColor", "#CCC30E")}"
        prismColor="${s("prismColor", "#A05CFF")}"
        waterColor="${s("waterColor", "#00EEFF")}"
        rounded={${n("rounded", 100)}}
        fontSize={${n("fontSize", 22)}}
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

function bgStyle(bg: string): React.CSSProperties {
  if (bg === "light") return { backgroundColor: "#f4f4f5" };
  if (bg === "black") return { backgroundColor: "#000" };
  return { backgroundColor: "#0c0c0f" };
}

function ItemButton({
  comp,
  active,
  onClick,
}: {
  comp: LibraryComponent;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius)] border px-2 py-1.5 text-left text-xs transition",
        active
          ? "border-primary bg-primary/5 text-primary"
          : "border-transparent text-muted-foreground hover:bg-muted/40"
      )}
    >
      <span className="shrink-0">{ICONS[comp.icon] ?? null}</span>
      <span className="truncate">{comp.name}</span>
    </button>
  );
}

export default function ComponentLibraryPage() {
  const groups = useMemo(() => groupComponents(COMPONENT_LIB), []);
  const [activeId, setActiveId] = useState(COMPONENT_LIB[0]?.id ?? "");
  const comp =
    COMPONENT_LIB.find((c) => c.id === activeId) ?? COMPONENT_LIB[0];
  const [settings, setSettings] = useState<Settings>(() =>
    defaultSettings(comp)
  );
  const [sourceCode, setSourceCode] = useState<string>("");
  const [sourceCopied, setSourceCopied] = useState(false);

  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [brandBusy, setBrandBusy] = useState<string | null>(null); // currently busy site id
  const [brandRewritten, setBrandRewritten] = useState<Record<string, boolean>>({}); // 该整站是否已 AI 改写
  const zipCache = useRef<Record<string, Blob>>({}); // 改写后的 zip 缓存（改写后「左侧」改下这个新包）
  const copyMapBySite = useRef<Record<string, Record<string, string>>>({}); // 改写产出的「用户意愿文案字典」（供下载覆盖层复用，#3）
  const [brandProject, setBrandProject] = useState<{
    name: string;
    typeId: string;
    desc: string;
  }>(() => {
    try {
      const s = localStorage.getItem("xiye.brandProject.v1");
      if (s) return JSON.parse(s);
    } catch {
      /* ignore */
    }
    // 自动带出流程工作台里已有的项目定位（PRD 依据）：项目名 + 描述 + 类型 + AI 一句话定位。
    try {
      const raw = localStorage.getItem("xiye-flow-design");
      if (raw) {
        const fs = JSON.parse(raw)?.state ?? JSON.parse(raw);
        const name = fs?.projectInfo?.projectName?.trim() || "";
        const desc =
          fs?.projectInfo?.projectDescription?.trim() ||
          fs?.intentNarrative?.positioning?.trim() ||
          fs?.intentNarrative?.vision?.trim() ||
          "";
        return { name, typeId: fs?.projectType ?? "", desc };
      }
    } catch {
      /* ignore */
    }
    return { name: "", typeId: "", desc: "" };
  });
  useEffect(() => {
    try {
      localStorage.setItem("xiye.brandProject.v1", JSON.stringify(brandProject));
    } catch {
      /* ignore */
    }
  }, [brandProject]);

  // —— 项目选择器：复用个人中心（My Projects）里已保存的项目，自动带入其 PRD 的品牌 / 产品 / 文案 ——
  const [savedProjects, setSavedProjects] = useState<
    { id: string; name: string; productName?: string }[] | null
  >(null);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [pickedProjectName, setPickedProjectName] = useState(""); // 当前选中的已保存项目名（展示用）
  const pickedPrdRef = useRef<Record<string, any> | null>(null); // 选中项目的 PRD 快照，供改写视为最强背景

  const loadSavedProjects = async () => {
    try {
      const r = await fetch("/api/projects", { cache: "no-store" });
      if (!r.ok) {
        setSavedProjects([]);
        return;
      }
      const j = await r.json();
      setSavedProjects(
        Array.isArray(j.projects)
          ? j.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              productName: p.productName,
            }))
          : []
      );
    } catch {
      setSavedProjects([]);
    }
  };

  const filteredProjects = useMemo(() => {
    const list = savedProjects ?? [];
    const q = projectFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      (p.name + " " + (p.productName ?? "")).toLowerCase().includes(q)
    );
  }, [savedProjects, projectFilter]);

  // 点开品牌包下拉后（首次）懒加载已保存项目
  useEffect(() => {
    if (brandMenuOpen && savedProjects === null) loadSavedProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandMenuOpen]);

  const pickProject = async (pr: { id: string; name: string }) => {
    setProjectPickerOpen(false);
    setProjectFilter("");
    try {
      const r = await fetch(`/api/projects/${pr.id}`, { cache: "no-store" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      const fs =
        typeof d.project?.data === "string"
          ? JSON.parse(d.project.data)
          : d.project?.data;
      const name =
        fs?.projectInfo?.projectName?.trim() || d.project?.name || "";
      const typeId = fs?.projectType ?? "";
      const desc =
        fs?.projectInfo?.projectDescription?.trim() ||
        fs?.intentNarrative?.positioning?.trim() ||
        fs?.intentNarrative?.vision?.trim() ||
        "";
      pickedPrdRef.current = fs || null;
      setBrandProject({ name, typeId, desc });
      setPickedProjectName(d.project?.name || pr.name);
    } catch {
      window.alert("读取项目失败，请稍后重试");
    }
  };

  const clearPickedProject = () => {
    pickedPrdRef.current = null;
    setPickedProjectName("");
    setBrandProject({ name: "", typeId: "", desc: "" });
  };

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      // 手风琴：默认只展开第一个一级分组，其余收起
      const init: Record<string, boolean> = {};
      groups.forEach((g, i) => (init[g.category] = i === 0));
      return init;
    }
  );
  // 点击子菜单/组件：仅展开其所属一级，其余一级全部收起
  const expandOnly = (cat: string) =>
    setExpandedGroups((prev) => ({
      ...Object.fromEntries(groups.map((g) => [g.category, false])),
      [cat]: true,
    }));
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      groups.forEach((g) => {
        if (g.type === "sites") {
          Object.keys(g.sites).forEach((site) => (init[site] = true));
        }
      });
      return init;
    }
  );

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
        fetch(`/api/component-source?path=${encodeURIComponent(p)}`).then(
          (r) => (r.ok ? r.text() : "")
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

  // 选中组件后自动展开其所在分组与站点
  useEffect(() => {
    const group = groups.find((g) =>
      g.type === "simple"
        ? g.items.some((i) => i.id === comp.id)
        : Object.values(g.sites).some((items) =>
            items.some((i) => i.id === comp.id)
          )
    );
    if (!group) return;
    setExpandedGroups((prev) => ({ ...prev, [group.category]: true }));
    if (group.type === "sites") {
      const site = Object.entries(group.sites).find(([, items]) =>
        items.some((i) => i.id === comp.id)
      )?.[0];
      if (site) setExpandedSites((prev) => ({ ...prev, [site]: true }));
    }
  }, [comp.id, groups]);

  const set = (key: string, value: string | number | string[]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const usageCode = useMemo(() => buildUsageCode(comp, settings), [comp, settings]);

  const handleCopySource = async () => {
    try {
      await navigator.clipboard.writeText(sourceCode || usageCode);
      setSourceCopied(true);
      setTimeout(() => setSourceCopied(false), 1500);
    } catch {
      /* 静默 */
    }
  };

  const downloadBrand = async (siteId: string, copyMap?: Record<string, string>) => {
    if (brandBusy) return;
    const cached = zipCache.current[siteId];
    if (cached && !copyMap) {
      downloadBlob(cached, `${siteId}-zh.zip`);
      return;
    }
    try {
      setBrandBusy(siteId);
      // #3 文案覆盖层：优先用显式传入 / 改写产出的文案字典，在完整原始之上叠加后下载；
      // 无字典则回退原始完整 zip（#1 高保真 + #2 完整），非破坏性。
      const effectiveMap = copyMap ?? copyMapBySite.current[siteId];
      if (effectiveMap && Object.keys(effectiveMap).length > 0) {
        const r = await fetch(`/api/brand/zip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site: siteId, copyMap: effectiveMap }),
        });
        if (!r.ok) throw new Error("下载失败");
        const blob = await r.blob();
        downloadBlob(blob, `${siteId}.zip`);
      } else {
        const r = await fetch(`/api/brand/zip?site=${encodeURIComponent(siteId)}`);
        if (!r.ok) throw new Error("下载失败");
        const blob = await r.blob();
        downloadBlob(blob, `${siteId}.zip`);
      }
    } catch (e) {
      console.error(e);
      window.alert("品牌包下载失败，请稍后重试");
    } finally {
      setBrandBusy(null);
    }
  };

  // 从 PDR 结构（flow snapshot / 保存的项目）解析「愿景 / 定位 / 目标用户 / 核心功能」。
  // 功能亮点优先取「探索式访谈 brief.coreModules（name+detail）」，回退到 intentNarrative.coreFeatures（name+why）。
  const narrativeFromFs = (fs: Record<string, any> | null | undefined) => {
    if (!fs || typeof fs !== "object") return null;
    const n = fs?.intentNarrative;
    const brief = fs?.productBrief;

    const briefFeatures = Array.isArray(brief?.coreModules)
      ? brief.coreModules
          .filter((m: unknown) => m && typeof m === "object")
          .map((m: Record<string, unknown>) => ({
            name: typeof m.name === "string" ? m.name : "",
            why: typeof m.detail === "string" ? m.detail : "",
          }))
          .filter((f: { name: string }) => f.name)
      : [];

    const nlFeatures = Array.isArray(n?.coreFeatures)
      ? n.coreFeatures
          .filter((f: unknown) => f && typeof f === "object")
          .map((f: Record<string, unknown>) => ({
            name: typeof f.name === "string" ? f.name : "",
            why: typeof f.why === "string" ? f.why : "",
          }))
          .filter((f: { name: string }) => f.name)
      : [];

    const coreFeatures = briefFeatures.length ? briefFeatures : nlFeatures;

    // PRD 还有更丰满的结构化素材：一句话产品描述、分阶段规划、业务角色、业务专属页面、特种结构点。
    // 一并带上，让不同区块（副标题/流程/评价/核心页面）能各自取用，而不只是标题+一句定位。
    const description =
      typeof brief?.description === "string" ? brief.description : "";
    const phases = Array.isArray(brief?.phases)
      ? (brief.phases as unknown[])
          .filter(
            (p): p is Record<string, unknown> =>
              !!p && typeof p === "object"
          )
          .map((p: Record<string, unknown>) => ({
            name: typeof p.name === "string" ? p.name : "",
            items: Array.isArray(p.items)
              ? p.items.filter((x: unknown) => typeof x === "string")
              : [],
          }))
          .filter((p: { name: string }) => p.name)
      : [];
    const roles = Array.isArray(brief?.roles)
      ? (brief.roles as unknown[])
          .filter(
            (r): r is Record<string, unknown> =>
              !!r && typeof r === "object"
          )
          .map((r: Record<string, unknown>) => ({
            role: typeof r.role === "string" ? r.role : "",
            scope: typeof r.scope === "string" ? r.scope : "",
          }))
          .filter((r: { role: string }) => r.role)
      : [];
    const pages = Array.isArray(brief?.pages)
      ? (brief.pages as unknown[])
          .filter(
            (p): p is Record<string, unknown> =>
              !!p && typeof p === "object"
          )
          .map((p: Record<string, unknown>) => ({
            name: typeof p.name === "string" ? p.name : "",
            description:
              typeof p.description === "string" ? p.description : "",
          }))
          .filter((p: { name: string }) => p.name)
      : [];
    const extra =
      brief?.extra && typeof brief.extra === "object" ? brief.extra : {};

    const prdExtra = { description, phases, roles, pages, extra };

    if (!n) {
      return coreFeatures.length
        ? {
            vision: "",
            positioning: "",
            targetAudience: [],
            coreFeatures,
            ...prdExtra,
          }
        : null;
    }
    return {
      vision: typeof n.vision === "string" ? n.vision : "",
      positioning: typeof n.positioning === "string" ? n.positioning : "",
      targetAudience: Array.isArray(n.targetAudience)
        ? n.targetAudience.filter((x: unknown) => typeof x === "string")
        : [],
      coreFeatures,
      ...prdExtra,
    };
  };

  // 读取流程工作台（flow-store）里 AI 产出的项目定位，作为 AI 改写的 PRD 背景。
  const readFlowStoreNarrative = () => {
    try {
      const raw = localStorage.getItem("xiye-flow-design");
      if (!raw) return null;
      return narrativeFromFs(JSON.parse(raw)?.state ?? JSON.parse(raw));
    } catch {
      return null;
    }
  };

  const rewriteBrand = async (siteId: string) => {
    if (brandBusy) return;
    try {
      setBrandBusy(siteId);
      // 从当前流程工作台的 PRD 定位（flow-store）取愿景/定位/目标用户/核心功能，作为改写的最强背景；
      // 若已在项目选择器里选了个人中心保存的项目，则优先用该项目的 PRD 内容。
      const prd = pickedPrdRef.current
        ? narrativeFromFs(pickedPrdRef.current)
        : readFlowStoreNarrative();
      const narrative = brandProject.desc.trim()
        ? {
            desc: brandProject.desc.trim(),
            vision: prd?.vision || undefined,
            positioning: prd?.positioning || undefined,
            targetAudience: prd?.targetAudience ?? [],
            coreFeatures: prd?.coreFeatures ?? [],
            description: prd?.description || undefined,
            phases: prd?.phases ?? [],
            roles: prd?.roles ?? [],
            pages: prd?.pages ?? [],
            extra: prd?.extra,
          }
        : prd
          ? {
              desc: prd.positioning || prd.vision || "",
              vision: prd.vision || undefined,
              positioning: prd.positioning || undefined,
              targetAudience: prd.targetAudience ?? [],
              coreFeatures: prd.coreFeatures ?? [],
              description: prd.description || undefined,
              phases: prd.phases ?? [],
              roles: prd.roles ?? [],
              pages: prd.pages ?? [],
              extra: prd.extra,
            }
          : undefined;
      const r = await fetch(
        `/api/brand/rewrite?site=${encodeURIComponent(siteId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectName: brandProject.name.trim() || undefined,
            projectType: brandProject.typeId || undefined,
            narrative,
          }),
        }
      );
      if (!r.ok) {
        const err = await r.json().catch(() => null);
        throw new Error(err?.error ?? "改写失败");
      }
      const blob = await r.blob();
      zipCache.current[siteId] = blob; // 改写完成后「左侧」品牌下载这个新包
      // 回灌「用户意愿文案字典」：后续点击下载即按覆盖层（完整原始 + 用户文案）重新打包
      const mapHeader = r.headers.get("X-Copy-Map");
      if (mapHeader) {
        try {
          const decoded = JSON.parse(atob(mapHeader)) as Record<string, string>;
          if (decoded && Object.keys(decoded).length) copyMapBySite.current[siteId] = decoded;
        } catch {
          /* 头损坏则忽略，不影响已缓存的 -zh.zip */
        }
      }
      setBrandRewritten((p) => ({ ...p, [siteId]: true }));
    } catch (e) {
      console.error(e);
      window.alert(
        e instanceof Error ? e.message : "AI 改写失败，请检查 LLM 配置后重试"
      );
    } finally {
      setBrandBusy(null);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-3rem)] overflow-hidden rounded-[var(--radius)] border border-border bg-background">
      {/* 侧边栏：sticky 固定，内部独立滚动 */}
      <aside
        className={cn(
          "sticky top-2 self-start flex h-[calc(100vh-3rem)] shrink-0 flex-col overflow-hidden border-r border-border transition-all duration-200 ease-in-out",
          sidebarOpen ? "w-[180px]" : "w-[44px]"
        )}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-1 border-b border-border px-2">
          {sidebarOpen && (
            <span className="text-sm font-semibold">组件库</span>
          )}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition hover:bg-muted hover:text-foreground",
              !sidebarOpen && "mx-auto"
            )}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </button>
        </div>

        {sidebarOpen ? (
          <div className="flex-1 overflow-y-auto p-2">
            {groups.map((group) => (
              <div key={group.category} className="mb-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGroups((prev) => ({
                      // 手风琴互斥：打开当前一级，其余一级全部收起
                      ...Object.fromEntries(groups.map((g) => [g.category, false])),
                      [group.category]: !prev[group.category],
                    }))
                  }
                  className={cn(
                    "mb-1 flex w-full items-center justify-between rounded-[var(--radius)] border-l-2 px-1 py-1 text-left transition hover:bg-muted/50",
                    expandedGroups[group.category]
                      ? "border-foreground bg-muted/60"
                      : "border-transparent"
                  )}
                >
                  <span className="text-sm font-bold text-foreground">
                    {group.category}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3.5 text-muted-foreground transition-transform",
                      expandedGroups[group.category] ? "rotate-180" : ""
                    )}
                  />
                </button>

                {expandedGroups[group.category] &&
                  (group.type === "simple" ? (
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((c) => (
                        <ItemButton
                          key={c.id}
                          comp={c}
                          active={c.id === comp.id}
                          onClick={() => {
                            expandOnly(group.category);
                            setActiveId(c.id);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {Object.entries(group.sites).map(([site, items]) => (
                        <div
                          key={site}
                          className="ml-1 border-l border-border pl-2"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              // 点击二级站点：互斥切换（其他所有 site 都收起），同时确保所属一级展开
                              expandOnly(group.category);
                              setExpandedSites((prev) => {
                                const next: Record<string, boolean> = {};
                                // 把所有一级下的所有 site 都收起
                                for (const g of groups) {
                                  if (g.type === "sites") {
                                    for (const s of Object.keys(g.sites)) {
                                      next[s] = false;
                                    }
                                  }
                                }
                                next[site] = !prev[site];
                                return next;
                              });
                            }}
                            className="mb-0.5 flex w-full items-center justify-between rounded-[var(--radius)] px-1 py-1 text-left transition hover:bg-muted/50"
                          >
                            <span className="text-xs font-medium text-foreground/80">
                              {site}
                            </span>
                            <ChevronDown
                              className={cn(
                                "size-3 text-muted-foreground transition-transform",
                                expandedSites[site] ? "rotate-180" : ""
                              )}
                            />
                          </button>
                          {expandedSites[site] && (
                            <div className="flex flex-col gap-0.5">
                              {items.map((c) => (
                                <ItemButton
                                  key={c.id}
                                  comp={c}
                                  active={c.id === comp.id}
                                  onClick={() => {
                                    // 点击子组件：所属一级展开；该 site 也保持展开；其他 site 收起
                                    expandOnly(group.category);
                                    setExpandedSites((prev) => {
                                      const next: Record<string, boolean> = {};
                                      for (const g of groups) {
                                        if (g.type === "sites") {
                                          for (const s of Object.keys(g.sites)) {
                                            next[s] = false;
                                          }
                                        }
                                      }
                                      next[site] = true;
                                      return next;
                                    });
                                    setActiveId(c.id);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-1 py-2">
            {groups.map((group) => {
              const firstId =
                group.type === "simple"
                  ? group.items[0]?.id
                  : Object.values(group.sites)[0]?.[0]?.id;
              return (
                <button
                  key={group.category}
                  type="button"
                  title={group.category}
                  onClick={() => {
                    if (firstId) setActiveId(firstId);
                    setExpandedGroups((prev) => ({
                      ...prev,
                      [group.category]: true,
                    }));
                    setSidebarOpen(true);
                  }}
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    group.category === comp.category && "bg-primary/10 text-primary"
                  )}
                >
                  {group.icon}
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* 主区域 */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 顶部工具条：参数设置 / 复制源码 */}
        <div className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
          <span className="truncate text-sm font-medium text-foreground">
            {comp.name}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {/* 品牌包：下载 / AI 改写 */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBrandMenuOpen((v) => !v)}
              >
                <Package className="size-3.5" />
                品牌包
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform",
                    brandMenuOpen && "rotate-180"
                  )}
                />
              </Button>
              {brandMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setBrandMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 max-h-[min(80vh,34rem)] w-[20rem] overflow-y-auto overflow-x-hidden rounded-[var(--radius)] border border-border bg-background shadow-lg">
                  <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                    整站品牌包（完整可运行项目）
                  </div>
                  {BRAND_SITES.map((site) => (
                    <div
                      key={site.id}
                      className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">
                            {site.name}
                          </span>
                          {brandRewritten[site.id] && (
                            <span className="shrink-0 rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              已改写
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-8 shrink-0 px-0"
                        disabled={brandBusy === site.id}
                        onClick={() => downloadBrand(site.id)}
                        title={brandRewritten[site.id] ? "下载改写后的整站" : "下载整站（原版）"}
                      >
                        {brandBusy === site.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Download className="size-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="shrink-0"
                        disabled={brandBusy === site.id}
                        onClick={() => rewriteBrand(site.id)}
                      >
                        {brandBusy === site.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="size-3.5" />
                        )}
                        改写
                      </Button>
                    </div>
                  ))}
                  <div className="border-t border-border px-3 py-2">
                    <div className="mb-2 text-xs font-medium text-foreground">
                      改写按当前项目生成
                    </div>

                    {/* 项目选择器：点开筛选个人中心已保存的项目，自动带入其 PRD 的品牌 / 产品 / 文案 */}
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => {
                          loadSavedProjects();
                          setProjectPickerOpen((v) => !v);
                        }}
                        title="选择已保存项目，自动带入 PRD 的品牌 / 产品 / 文案"
                        className={[
                          "flex h-8 w-full items-center justify-between gap-1 rounded-[var(--radius)] border border-border bg-background px-2 text-xs outline-none focus:border-ring",
                          pickedProjectName
                            ? "text-foreground"
                            : "text-muted-foreground",
                        ].join(" ")}
                      >
                        <span className="min-w-0 flex-1 truncate text-left">
                          {pickedProjectName || "选择已保存项目…"}
                        </span>
                        <ChevronDown
                          className={[
                            "size-3 shrink-0 text-muted-foreground transition-transform",
                            projectPickerOpen && "rotate-180",
                          ].join(" ")}
                        />
                      </button>
                      {pickedProjectName && (
                        <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                          <span className="min-w-0 flex-1 truncate">
                            已选：{pickedProjectName}
                          </span>
                          <button
                            type="button"
                            onClick={clearPickedProject}
                            className="shrink-0 text-primary hover:underline"
                          >
                            清除
                          </button>
                        </div>
                      )}
                      {projectPickerOpen && (
                        <div className="mt-1 overflow-hidden rounded-[var(--radius)] border border-border">
                          <input
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            placeholder="搜索项目…"
                            autoFocus
                            className="h-7 w-full border-b border-border bg-background px-2 text-xs text-foreground outline-none"
                          />
                          <div className="max-h-44 overflow-y-auto">
                            {savedProjects === null ? (
                              <div className="px-2 py-2 text-[11px] text-muted-foreground">
                                加载中…
                              </div>
                            ) : filteredProjects.length === 0 ? (
                              <div className="px-2 py-2 text-[11px] text-muted-foreground">
                                {savedProjects.length === 0
                                  ? "暂无已保存项目（登录后可在流程 / 页面搭建里保存）"
                                  : "无匹配项目"}
                              </div>
                            ) : (
                              filteredProjects.map((pp) => (
                                <button
                                  key={pp.id}
                                  type="button"
                                  onClick={() => pickProject(pp)}
                                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted"
                                >
                                  <FolderOpen className="size-3 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 flex-1 truncate">
                                    {pp.name}
                                  </span>
                                  {pp.productName && (
                                    <span className="max-w-32 shrink-0 truncate text-[10px] text-muted-foreground">
                                      {pp.productName}
                                    </span>
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                        项目名称
                        <input
                          value={brandProject.name}
                          onChange={(e) =>
                            setBrandProject((p) => ({ ...p, name: e.target.value }))
                          }
                          placeholder="如：宠遇 Pety"
                          className="h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                        />
                      </label>
                      <label className="flex min-w-0 flex-col gap-1 text-[11px] text-muted-foreground">
                        项目类型
                        <select
                          value={brandProject.typeId}
                          onChange={(e) =>
                            setBrandProject((p) => ({
                              ...p,
                              typeId: e.target.value,
                            }))
                          }
                          className="h-8 w-full rounded-[var(--radius)] border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:border-ring"
                        >
                          <option value="">选行业…</option>
                          {PROJECT_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <input
                      value={brandProject.desc}
                      onChange={(e) =>
                        setBrandProject((p) => ({ ...p, desc: e.target.value }))
                      }
                      placeholder="一句话描述（可选）：如「AI 宠物健康管理，主打睡眠与慢病随访」"
                      className="mt-2 h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                    />
                  </div>
                  <div className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    下载原版 zip；「改写」把整站文案按上面项目重写为中文（只作用于下载包、不改动预览与其他用户），改完后左侧下载按钮即更新为新包。
                  </div>
                  </div>
                </>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopySource}
              disabled={!sourceCode}
            >
              {sourceCopied ? (
                <Check className="size-3.5" />
              ) : (
                <Code2 className="size-3.5" />
              )}
              {sourceCopied ? "已复制" : "复制源码"}
            </Button>
            <Button
              variant={panelOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setPanelOpen((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              参数设置
            </Button>
          </div>
        </div>

        {/* 画布 + 参数面板 */}
        {/* min-w-0：flex item 默认 min-width:auto 会被内部定宽内容（1140px 设计稿）
            撑破，导致预览区/参数面板溢出根容器；必须显式归零 */}
        <div className="relative flex min-w-0 flex-1">
          <div className="min-w-0 flex-1 p-4">
            <div
              className="relative overflow-hidden rounded-[var(--radius)]"
              style={{
                ...bgStyle(String(settings.bg ?? "dark")),
                ...(String(settings.bg) === "zebra"
                  ? {
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0, rgba(255,255,255,0.05) 12px, transparent 12px, transparent 24px)",
                      backgroundColor: "#111",
                    }
                  : {}),
                minHeight: "20rem",
              }}
            >
              {comp.id === "fluid-text" && (
                <div className="relative h-[360px] w-full">
                  <FluidText
                    text={String(settings.text ?? "FLUID TEXT")}
                    color={String(settings.color ?? "#FFFFFF")}
                    paletteColors={
                      Array.isArray(settings.palette) &&
                      (settings.palette as string[]).length
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
                </div>
              )}

              {comp.id === "smoky-text" && (
                <div className="flex min-h-[20rem] items-center justify-center bg-black px-6 py-8">
                  <div className="h-[220px] w-full">
                    <SmokyText
                      text={String(settings.text ?? "SMOKY\nTEXT")}
                      color={String(settings.color ?? "#f5f5f5")}
                      intensity={Number(settings.intensity ?? 10)}
                      appearTrigger={
                        String(settings.appearTrigger ?? "default") as any
                      }
                      animationMode={
                        String(settings.animationMode ?? "singleLine") as any
                      }
                      position={
                        String(settings.position ?? "bottomLeft") as any
                      }
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
                      text={String(
                        settings.text ??
                          "Not everything is meant to be seen at once. Hover to reveal."
                      )}
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
                      transition={{
                        type: "tween",
                        duration: 0.3,
                        ease: "easeInOut",
                      }}
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

              {comp.id === "coverflow-gallery" && (
                <div className="flex min-h-[480px] w-full items-center justify-center overflow-hidden">
                  <Smooth3DSlideshow
                    cardWidth={Number(settings.cardWidth ?? 400)}
                    cardHeight={Number(settings.cardHeight ?? 400)}
                    radius={Number(settings.radius ?? 3)}
                    tilt={Number(settings.tilt ?? 12)}
                    sideTilt={Number(settings.sideTilt ?? 8)}
                    gap={Number(settings.gap ?? 8)}
                    opacity={Number(settings.opacity ?? 60)}
                    autoplay={String(settings.autoplay ?? "on") === "on"}
                    autoplayDirection={
                      String(settings.autoplayDirection ?? "rightToLeft") as any
                    }
                    showTitle={settings.showTitle !== "off"}
                    titleColor={String(settings.titleColor ?? "#ffffff")}
                  />
                </div>
              )}

              {comp.id === "round-carousel" && (
                <div className="flex h-[480px] w-full items-center justify-center overflow-hidden">
                  <div className="h-[480px] w-full">
                    <RoundCarousel
                      imageWidth={Number(settings.imageWidth ?? 300)}
                      imageHeight={Number(settings.imageHeight ?? 300)}
                      spacing={Number(settings.spacing ?? 3)}
                      speed={Number(settings.speed ?? 7)}
                      direction={String(settings.direction ?? "right") as any}
                      drag={settings.drag !== "off"}
                      sensitivity={Number(settings.sensitivity ?? 5)}
                      tilt={Number(settings.tilt ?? -7)}
                      perspective={Number(settings.perspective ?? 3000)}
                      cornerRadius={Number(settings.cornerRadius ?? 22)}
                      innerDim={Number(settings.innerDim ?? 3.5)}
                      background={String(settings.background ?? "#000000")}
                    />
                  </div>
                </div>
              )}

              {comp.id === "shiny-pill" && (
                <div className="flex min-h-[20rem] w-full items-center justify-center overflow-hidden bg-[#0c0c0f] px-6 py-10">
                  <ShinyPill
                    text={String(settings.text ?? "SHINY PILL")}
                    textColor={String(settings.textColor ?? "#FFFFFF")}
                    shineColor={String(settings.shineColor ?? "#78FF83")}
                    speed={Number(settings.speed ?? 1.5)}
                    font={{
                      fontFamily: "Inter",
                      fontWeight: 700,
                      fontSize: `${Number(settings.fontSize ?? 120)}px`,
                      letterSpacing: "-0.01em",
                      lineHeight: "1em",
                    }}
                    link={String(settings.link ?? "") || undefined}
                  />
                </div>
              )}

              {comp.id === "water-button" && (
                <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#1a1f2e] via-[#232a3f] to-[#12151d] p-8">
                  <WaterButton
                    label={String(settings.label ?? "WATER BUTTON")}
                    textColor={String(settings.textColor ?? "#000000")}
                    waterColor={String(settings.waterColor ?? "#00EEFF")}
                    waterAmount={Number(settings.waterAmount ?? 69)}
                    paddingX={Number(settings.paddingX ?? 64)}
                    paddingY={Number(settings.paddingY ?? 38)}
                    rounded={Number(settings.rounded ?? 100)}
                    font={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontWeight: 500,
                      fontSize: Number(settings.fontSize ?? 16),
                    }}
                    border={String(settings.border ?? "on") === "on"}
                    press={String(settings.press ?? "on") === "on"}
                  />
                </div>
              )}

              {comp.id === "keycap-button" && (
                <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#0e0f14] via-[#171a24] to-[#0a0b10] p-8">
                  <KeycapButton
                    label={String(settings.label ?? "KEY CAP")}
                    colors={{
                      fill: String(settings.fill ?? "#16121D"),
                      textColor: String(settings.textColor ?? "#A05CFF"),
                      hoverTextColor: "#FFFFFF",
                    }}
                    prism={{ color: String(settings.prismColor ?? "#A05CFF") }}
                    rounded={Number(settings.rounded ?? 45)}
                    font={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: Number(settings.fontSize ?? 24),
                    }}
                  />
                </div>
              )}

              {comp.id === "moving-gradient-button" && (
                <div className="flex min-h-[20rem] w-full items-center justify-center bg-gradient-to-br from-[#1a1f2e] via-[#232a3f] to-[#12151d] p-8">
                  <MovingGradientButton
                    label={String(settings.label ?? "MOVING GRADIENT")}
                    colors={{
                      fill: String(settings.fill ?? "#000000"),
                      textColor: String(settings.textColor ?? "#FFFFFF"),
                      hoverTextColor: String(settings.hoverTextColor ?? "#CCC30E"),
                    }}
                    rounded={Number(settings.rounded ?? 100)}
                    font={{
                      fontFamily: "Inter, system-ui, sans-serif",
                      fontWeight: 700,
                      fontSize: Number(settings.fontSize ?? 24),
                    }}
                  />
                </div>
              )}

              {comp.id === "button-resource" && (
                <div className="flex min-h-[20rem] w-full items-center justify-center bg-[#0c0c0f] p-8">
                  <ButtonResource
                    style={String(settings.style ?? "moving") as "water" | "keycap" | "moving"}
                    label={String(settings.label ?? "开始体验")}
                    fill={String(settings.fill ?? "#000000")}
                    textColor={String(settings.textColor ?? "#FFFFFF")}
                    hoverTextColor={String(settings.hoverTextColor ?? "#CCC30E")}
                    prismColor={String(settings.prismColor ?? "#A05CFF")}
                    waterColor={String(settings.waterColor ?? "#00EEFF")}
                    rounded={Number(settings.rounded ?? 100)}
                    fontSize={Number(settings.fontSize ?? 22)}
                  />
                </div>
              )}

              {comp.id === "hero-36" && (
                <WidePreviewFrame>
                  <Hero36 />
                </WidePreviewFrame>
              )}

              {comp.id === "hero-19" && (
                <WidePreviewFrame>
                  <Hero19 />
                </WidePreviewFrame>
              )}

              {comp.id === "hero-04" && (
                <WidePreviewFrame>
                  <Hero04 />
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-hero" && (
                <WidePreviewFrame>
                  <OutstandHero
                    compact
                    heading={String(
                      settings.heading ??
                        "Modern, Cool, and Effective Template for Your Business"
                    )}
                    subheading={String(
                      settings.subheading ??
                        "Boost Your Brand with Our Sleek and Cutting-Edge Framer Template"
                    )}
                    primaryCta={{
                      label: String(settings.ctaLabel ?? "Book a call"),
                      href: "#",
                    }}
                    {...(settings.accentColor
                      ? {
                          style: {
                            "--os-color-accent": settings.accentColor,
                          } as React.CSSProperties,
                        }
                      : {})}
                  />
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-pricing" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandPricing />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-faq" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandFaq />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-testimonials" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandTestimonials />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-features" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandFeatures />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAbout />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-cta" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandCta />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-process" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandProcess />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-projects" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandProjects />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-whychooseus" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWhyChooseUs />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-values" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandValues />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-expertise" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandExpertise />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-digitalsolutions" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandDigitalSolutions />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-benefits" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandBenefits />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-benefits-section" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandBenefitsSection />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-contact-us" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandContactUs />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-lets-work-together" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandLetsWorkTogether />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-our-solution-section" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandOurSolutionSection />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-contact-us" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksContactUs />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-excellence" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksExcellence />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-partners" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksPartners />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-portfolio" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksPortfolio />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-projects" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksProjects />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-projects-hero" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksProjectsHero />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-works-testimonials" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandWorksTestimonials />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-benefits" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesBenefits />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-comparison" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesComparison />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-expertise" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesExpertise />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-faq" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesFaq />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-hero" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesHero />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-keyfeatures" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesKeyFeatures />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-payment" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesPayment />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-pricingplan" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesPricingPlan />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-process" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesProcess />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-services" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesServices />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-services-overview" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandServicesOverview />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-call-to-action" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutCallToAction />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-careers" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutCareers />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-excellence" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutExcellence />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-features" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutFeatures />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-hero" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutHero />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-our-culture" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutOurCulture />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-our-story" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutOurStory />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-team-members" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutTeamMembers />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-about-testimonials" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandAboutTestimonials />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-contact-digital-presence" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandContactDigitalPresence />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-contact-faq" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandContactFaq />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-contact-hero" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandContactHero />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-contact-support" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandContactSupport />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-not-found" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandNotFound />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {comp.id === "outstand-privacy-policy" && (
                <WidePreviewFrame>
                  <SectionScope accent={String(settings.accentColor ?? "#CDF140")}>
                    <OutstandPrivacyPolicy />
                  </SectionScope>
                </WidePreviewFrame>
              )}

              {/* 整站模板 · 全部：直链线上真实站点（Framer 平台），交互 100% 还原 */}
              {comp.id === "wexo-all" && <WexoSite liveUrl="https://wexo.framer.website/" />}
              {comp.id === "outstand-all" && <OutstandSite />}
              {comp.id === "genius-all" && <GeniusSite liveUrl="https://genius.framer.wiki/" />}

              {/* Wexo 整站模板区块：可视化编辑器（可在预览内改文案/配色/子区块，并可导出一体化整站 zip） */}
              {comp.id.startsWith("wexo-") && comp.id !== "wexo-all" && (
                <WexoStudio slug={comp.id.slice("wexo-".length)} />
              )}

              {/* Genius 整站模板页面：直链线上真实站点，完整还原交互 */}
              {comp.id.startsWith("genius-") && comp.id !== "genius-all" && (
                <GeniusSite liveUrl={`https://genius.framer.wiki/${comp.id.slice("genius-".length)}`} />
              )}

              {/* 预览左上角名称标签已全部移除（顶部工具条与下方标题区已足够识别当前组件） */}
            </div>
          </div>

          {/* 右侧参数面板 */}
          {panelOpen && (
            <aside className="sticky top-4 self-start flex h-[calc(100vh-4.5rem)] w-[280px] shrink-0 flex-col overflow-hidden border-l border-border bg-background">
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <SlidersHorizontal className="size-4" />
                  参数设置
                </span>
                <button
                  type="button"
                  onClick={() => setPanelOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius)] text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
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
            </aside>
          )}
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
                className={cn(
                  "flex h-7 items-center gap-0.5 border p-0.5 transition",
                  "rounded-[var(--radius)]",
                  selected ? "border-primary" : "border-border hover:border-primary/40"
                )}
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
                className={cn(
                  "rounded-[var(--radius)] px-2.5 py-1 text-xs transition",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-muted/40"
                )}
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
