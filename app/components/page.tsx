"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Code2,
  CloudFog,
  Globe,
  Layers,
  Orbit,
  PanelsTopLeft,
  PanelLeft,
  PanelLeftClose,
  Scan,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Waves,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import FluidText from "@/components/originkit/ui/fluid-text";
import SmokyText from "@/components/originkit/ui/smokytext";
import FlashlightText from "@/components/originkit/ui/spotlighttext";
import { RingGallery } from "@/components/originkit/ring-gallery";
import Hero36 from "@/components/originkit/hero-36";
import Hero19 from "@/components/originkit/hero-19";
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
  Sparkles: <Sparkles className="size-4" />,
};

type SimpleGroup = { type: "simple"; items: LibraryComponent[] };
type SiteGroup = { type: "sites"; sites: Record<string, LibraryComponent[]> };
type Group = { category: string; icon: ReactNode } & (SimpleGroup | SiteGroup);

const CATEGORY_ICONS: Record<string, ReactNode> = {
  特效: <Wand2 className="size-4" />,
  区块: <Layers className="size-4" />,
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
      // 测量时把内容层临时 absolute + max-content 挪出视口，使其自然撑开到
      // 子内容真实宽度（固定 1140px 等），读准 scrollWidth 后再恢复原位，
      // 避免 width:100% 让 scrollWidth 只等于容器宽度而漏缩放
      const prev = {
        position: content.style.position,
        width: content.style.width,
        transform: content.style.transform,
        left: content.style.left,
        top: content.style.top,
        visibility: content.style.visibility,
        pointerEvents: content.style.pointerEvents,
      };
      content.style.position = "absolute";
      content.style.visibility = "hidden";
      content.style.pointerEvents = "none";
      content.style.left = "-99999px";
      content.style.top = "0";
      content.style.transform = "none";
      content.style.width = "max-content";
      const cw = container.clientWidth;
      const sw = content.scrollWidth;
      content.style.position = prev.position;
      content.style.visibility = prev.visibility;
      content.style.pointerEvents = prev.pointerEvents;
      content.style.left = prev.left;
      content.style.top = prev.top;
      content.style.transform = prev.transform;
      content.style.width = prev.width;
      const s = cw > 0 && sw > cw ? cw / sw : 1;
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      groups.forEach((g) => (init[g.category] = true));
      return init;
    }
  );
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

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] rounded-[var(--radius)] border border-border bg-background">
      {/* 侧边栏：sticky 固定，内部独立滚动 */}
      <aside
        className={cn(
          "sticky top-4 self-start flex h-[calc(100vh-4.5rem)] shrink-0 flex-col overflow-hidden border-r border-border transition-all duration-200 ease-in-out",
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
                      ...prev,
                      [group.category]: !prev[group.category],
                    }))
                  }
                  className="mb-1 flex w-full items-center justify-between rounded-[var(--radius)] px-1 py-1 text-left transition hover:bg-muted/50"
                >
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
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
                          onClick={() => setActiveId(c.id)}
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
                            onClick={() =>
                              setExpandedSites((prev) => ({
                                ...prev,
                                [site]: !prev[site],
                              }))
                            }
                            className="mb-0.5 flex w-full items-center justify-between rounded-[var(--radius)] px-1 py-1 text-left transition hover:bg-muted/50"
                          >
                            <span className="text-xs font-medium text-muted-foreground">
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
                                  onClick={() => setActiveId(c.id)}
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
        <div className="relative flex flex-1">
          <div className="flex-1 p-4">
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

              <div className="pointer-events-none absolute left-3 top-3">
                <span className="rounded-[var(--radius)] bg-black/40 px-2 py-0.5 text-[11px] text-white/70">
                  {comp.name}
                  {comp.id === "fluid-text" ? " · 拖动搅动" : ""}
                </span>
              </div>
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
