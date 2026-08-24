"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  Bot,
  Building2,
  Check,
  Copy,
  Newspaper,
  Palette,
  ShieldAlert,
  ShoppingBag,
  Download,
  Home,
  Menu,
  PanelsTopLeft,
  LayoutGrid,
  MessageCircleQuestion,
  Megaphone,
  PanelBottom,
  Building,
  TrendingUp,
  Quote,
  Tags,
  ChevronDown,
  ChevronRight,
  UserRound,
  LayoutDashboard,
  Table,
  LogIn,
  Share2,
  Columns2,
  UserPlus,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Gauge,
  ChartColumn,
  List,
  Search,
  ListChecks,
  Bell,
  SlidersHorizontal,
  Activity,
  Workflow,
  Blocks,
  Mail,
  X,
  Plus,
  ArrowRight,
  ArrowLeft,
  Trash2,
  RefreshCw,
  Loader2,
  Hash,
  PieChart,
  Sparkles,
  MousePointerClick,
  Loader,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { BuilderElementProvider } from "@/lib/builder-element-context";
import { buildBlueprint } from "@/lib/blueprint-generator";
import { buildPrdMd } from "@/lib/project-generator";
import { buildArchitectureMarkdown } from "@/lib/architecture";
import { TECH_STACKS } from "@/data/tech-stacks";
import { inferProjectTypeName, inferFeatureDetails } from "@/lib/project-narrative";
import { resolveContent } from "@/lib/content-resolver";
import { summarizeCopyChanges } from "@/lib/copy-generator";
import { VISUAL_STYLES, VISUAL_STYLE_MAP, FONT_STACK } from "@/data/visual-styles";
import { SKELETON_PAGES, SKELETON_PAGE_MAP, findVariant, type SkeletonPage } from "@/data/skeletons";
import { ComponentPreview, styleVars, applyMotionPreview, CtaStyleProvider, designTokenBridgeCss } from "./previews";
import { applyButtonStyleToCode, findButtonStyle } from "@/lib/button-styles";


/** 预览区默认主题：未选择视觉风格时，骨架预览默认用「粗野」衬托所搭组件 */
const PREVIEW_DEFAULT_STYLE_ID = "aw-brutalist";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { DesignTokensPanel } from "@/components/design-tokens-panel";
import { BuilderSaveButton } from "@/components/builder-save-button";
import { applySnapshot } from "@/lib/project-snapshot";
import { findComponentMotion } from "@/data/component-motions";
import { ensureWebFonts } from "@/lib/web-fonts";
import { FONT_OPTIONS } from "@/data/design-presets";
import {
  mergePalette,
  useApplyPalette,
  useThemePaletteStore,
  type PaletteOverride,
} from "@/lib/use-theme-palette";
import { ColorRow } from "@/components/theme-preset-toggle";

// —— 页面分组：一级「用途」→ 二级「页面」，左侧栏层级树展示 ——
const PAGE_GROUPS: { label: string; ids: string[] }[] = [
  { label: "营销落地页", ids: ["home", "product", "pricing", "portfolio"] },
  { label: "品牌与内容", ids: ["about", "contact", "blog"] },
  { label: "文档中心", ids: ["docs"] },
  { label: "应用工作台", ids: ["dashboard", "ai-chat", "feedback"] },
  { label: "账号与系统", ids: ["auth", "misc"] },
];

const PAGE_ICONS: Record<string, LucideIcon> = {
  Home,
  Tags,
  UserRound,
  LayoutDashboard,
  Palette,
  Newspaper,
  ShoppingBag,
  Building2,
  ShieldAlert,
  BookOpenText,
  Bot,
  Loader2,
};

const COMPONENT_ICONS: Record<string, LucideIcon> = {
  Menu,
  PanelsTopLeft,
  LayoutGrid,
  MessageCircleQuestion,
  Megaphone,
  PanelBottom,
  Building,
  TrendingUp,
  Quote,
  Tags,
  Table,
  LogIn,
  Share2,
  Columns2,
  UserPlus,
  PanelLeft,
  Gauge,
  ChartColumn,
  List,
  Search,
  ListChecks,
  Bell,
  SlidersHorizontal,
  Activity,
  Download,
  "home-process": Workflow,
  "home-integrations": Blocks,
  "home-contact": Mail,
  "loader-feedback": Loader2,
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
          /* 剪贴板不可用时静默 */
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "已复制" : label}
    </Button>
  );
}

export default function BuilderPage() {
  const visualStyle = useFlowStore((s) => s.visualStyle);
  const setVisualStyle = useFlowStore((s) => s.setVisualStyle);
  const designSystem = useFlowStore((s) => s.designSystem);
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);
  const addBlueprintComponent = useFlowStore((s) => s.addBlueprintComponent);
  const updateBlueprintVariant = useFlowStore((s) => s.updateBlueprintVariant);
  const removeBlueprintComponent = useFlowStore((s) => s.removeBlueprintComponent);
  const clearBlueprint = useFlowStore((s) => s.clearBlueprint);
  const goToStep = useFlowStore((s) => s.goToStep);
  const builderReturnStep = useFlowStore((s) => s.builderReturnStep);
  const setBuilderReturnStep = useFlowStore((s) => s.setBuilderReturnStep);
  const router = useRouter();
  // 是否从「流程工作台」进入骨架（URL 带 ?from=flow）：是则显示「前进到下一步」按钮，
  // 与项目链路结合；独立进入（仅复制效果）则不显示。
  const [inFlow, setInFlow] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && /[?&]from=flow\b/.test(window.location.search)) {
      setInFlow(true);
    }
  }, []);
  // 若持久化的 visualStyle 指向已从预设列表删除的预设（悬空 id，如旧版绿色预设），
  // 自动复位为默认「粗野」，避免刷新后展示失效预设且列表里选不到。
  useEffect(() => {
    if (visualStyle && !VISUAL_STYLE_MAP[visualStyle]) {
      setVisualStyle(PREVIEW_DEFAULT_STYLE_ID);
    }
  }, [visualStyle, setVisualStyle]);
  const picks = useSkeletonStore((s) => s.picks);
  const pickVariant = useSkeletonStore((s) => s.pickVariant);
  const content = useSkeletonStore((s) => s.content);
  const setContent = useSkeletonStore((s) => s.setContent);
  const componentMotion = useSkeletonStore((s) => s.componentMotion);
  const buttonStyles = useSkeletonStore((s) => s.buttonStyles);
  const projectName = useFlowStore((s) => s.projectInfo?.projectName ?? null);
  const projectType = useFlowStore((s) => s.projectType);
  const intentNarrative = useFlowStore((s) => s.intentNarrative);
  const techStack = useFlowStore((s) => s.techStack);
  const [copyState, setCopyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [copySummary, setCopySummary] = useState<string | null>(null);
  const resolveText = (text: string) => resolveContent(text, content);

  // AI 已通过 flow-store 预填 pageBlueprint 时，直接落点到它编排的第一个页面；
  // 否则回到默认首页。一次求值，之后不随蓝图变化跳页。
  const [activePageId, setActivePageId] = useState(
    () =>
      SKELETON_PAGES.find((p) =>
        pageBlueprint.some((e) => e.pageSlug === p.id),
      )?.id ?? SKELETON_PAGES[0].id,
  );

  // 每个页面 / 组件在蓝图里的计数（AI 预填 + 手动加入都算），用于「已回填」标记
  const blueprintCount = (pid: string) =>
    pageBlueprint.reduce((n, e) => (e.pageSlug === pid ? n + 1 : n), 0);
  const isInBlueprint = (pid: string, cid: string) =>
    pageBlueprint.some((e) => e.pageSlug === pid && e.componentId === cid);
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const [tokenOpen, setTokenOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [blueprintOpen, setBlueprintOpen] = useState(false);
  // 侧边栏分类树的展开状态：默认展开当前页所在一级分组
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    const g = PAGE_GROUPS.find((x) => x.ids.includes(activePageId));
    return { [g?.label ?? PAGE_GROUPS[0].label]: true };
  });
  // 二级分类（页面）的展开状态：默认展开；再次点当前页可折叠其三级组件清单
  const [expandedPages, setExpandedPages] = useState<Record<string, boolean>>({});

  // 二级页面交互：点新页 = 选中并展开；点当前页 = 折叠/展开其三级组件
  const togglePage = (p: SkeletonPage) => {
    if (p.id === activePageId) {
      setExpandedPages((prev) => ({ ...prev, [p.id]: !(prev[p.id] ?? true) }));
      setDrawerOpen(false);
    } else {
      selectPage(p.id);
      setExpandedPages((prev) => ({ ...prev, [p.id]: true }));
      // 点击子菜单时：只展开其所属一级，其余一级全部收起（与一级互斥一致）
      setExpandedGroups((prev) => {
        const target = PAGE_GROUPS.find((g) => g.ids.includes(p.id))?.label ?? "";
        return {
          ...Object.fromEntries(PAGE_GROUPS.map((g) => [g.label, false])),
          [target]: true,
        };
      });
    }
  };
  const [styleQuery, setStyleQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const topbarRef = useRef<HTMLDivElement>(null);
  const blueprintPanelRef = useRef<HTMLDivElement>(null);

  // Esc 收起抽屉
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawerOpen(false);
        setBlueprintOpen(false);
        setStyleOpen(false);
        setTokenOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 预载 Google Fonts，保证预览里切换字体立即可见（幂等）
  useEffect(() => {
    ensureWebFonts(FONT_OPTIONS.map((f) => f.id));
  }, []);

  // 从「个人中心 · 我的项目 · 打开」跳入时（/builder?pid=xxx），自动拉取并应用到当前工作台
  const loadedPid = useRef<string | null>(null);
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("pid");
    if (!pid || loadedPid.current === pid) return;
    loadedPid.current = pid;
    (async () => {
      const res = await fetch(`/api/projects/${pid}`);
      if (res.ok) {
        const d = await res.json();
        const snap =
          typeof d.project.data === "string"
            ? JSON.parse(d.project.data)
            : d.project.data;
        applySnapshot(snap);
      }
      window.history.replaceState({}, "", "/builder");
    })();
  }, []);

  // 点击顶栏外空白：收起全部下拉与浮层面板
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (topbarRef.current?.contains(t)) return;
      if (blueprintPanelRef.current?.contains(t)) return;
      setStyleOpen(false);
      setTokenOpen(false);
      setBlueprintOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // 点按抽屉之外（侧栏+抽屉之外）收起抽屉
  const leftRegionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (leftRegionRef.current?.contains(t)) return;
      setDrawerOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const openComponent = (id: string) => {
    setActiveComponentId(id);
    setDrawerOpen(true);
  };

  // 侧边栏选中页面：切页并收起变体抽屉
  const selectPage = (pid: string) => {
    setActivePageId(pid);
    setActiveComponentId(null);
    setDrawerOpen(false);
  };

  const page = SKELETON_PAGES.find((p) => p.id === activePageId) ?? SKELETON_PAGES[0];
  const PageIcon = PAGE_ICONS[page.icon] ?? Home;
  const pagePicks = picks[activePageId] ?? {};

  // 默认选中第一个组件；变体选择读 picks（即时持久化，未选回退第一个）
  const activeComponent = useMemo(() => {
    if (!activeComponentId || !page.components.some((c) => c.id === activeComponentId)) {
      return page.components[0] ?? null;
    }
    return page.components.find((c) => c.id === activeComponentId) ?? null;
  }, [page, activeComponentId]);

  const activeVariant = useMemo(() => {
    if (!activeComponent) return null;
    // 优先显示蓝图里（AI 回填或手动选）的变体，其次读编辑态 picks，再回退首个
    const bp = pageBlueprint.find(
      (e) => e.pageSlug === page.id && e.componentId === activeComponent.id,
    );
    const bpVariant =
      bp?.variantId &&
      activeComponent.variants.some((v) => v.id === bp.variantId)
        ? bp.variantId
        : undefined;
    const pickedId = bpVariant ?? pagePicks[activeComponent.id];
    if (pickedId && activeComponent.variants.some((v) => v.id === pickedId)) {
      return activeComponent.variants.find((v) => v.id === pickedId) ?? null;
    }
    return activeComponent.variants[0] ?? null;
  }, [activeComponent, pagePicks, pageBlueprint, page.id]);

  // 按板块动效覆盖：overrides 存在则只作用于当前板块；否则跟随变体自带 motionId。
  // 该 state 同时驱动预览与「动效拾取器」的当前态展示。
  const motionKey = activeComponent ? `${page.id}:${activeComponent.id}` : "";
  const motionOverride = motionKey ? componentMotion[motionKey] : undefined;

  // 主 CTA 按钮外观：作用于当前组件的主按钮（不覆盖结构）
  const btnKey = activeComponent ? `${page.id}:${activeComponent.id}` : "";
  const btnStyle = btnKey ? buttonStyles[btnKey] : undefined;
  const [effectiveMotionId, motionParams] = (() => {
    if (motionOverride) {
      if (motionOverride.motionId === "motion-none") return [undefined, undefined] as const;
      return [motionOverride.motionId, motionOverride.params] as const;
    }
    return [activeVariant?.motionId, undefined] as const;
  })();

  const style = VISUAL_STYLE_MAP[visualStyle ?? PREVIEW_DEFAULT_STYLE_ID] ?? VISUAL_STYLE_MAP[PREVIEW_DEFAULT_STYLE_ID] ?? VISUAL_STYLES[0];

  // 调色：与顶部 ThemePresetToggle 共享同一份 useThemePaletteStore；
  // custom key 用当前 visualStyle，使每个视觉风格都能独立调色。
  const themeCustom = useThemePaletteStore((s) => s.custom);
  const themeSetOverride = useThemePaletteStore((s) => s.setOverride);
  const themeResetOverride = useThemePaletteStore((s) => s.resetOverride);
  const themeSetActiveStyle = useThemePaletteStore((s) => s.setActiveStyle);
  useApplyPalette();

  // 挂载时把 flow-store 的 visualStyle 同步为全局主题，保证顶部色盘与搭页面预览一致
  useEffect(() => {
    themeSetActiveStyle(visualStyle ?? PREVIEW_DEFAULT_STYLE_ID);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styleOv = themeCustom[style.id] ?? {};
  const styleMerged = mergePalette(style, styleOv);
  const isStyleCustomized = Object.keys(styleOv).length > 0;
  const updateStyleAccent = (idx: number, v: string) => {
    const seed = style.palette.accents ?? [];
    const cur = styleOv.accents ?? seed;
    const next = [...cur];
    next[idx] = v;
    themeSetOverride(style.id, { accents: next } as Partial<PaletteOverride>);
  };

  // —— 页面蓝图：加入 / 移除 / 换变体 / 按页面分组 ——
  const inBlueprint = useMemo(
    () =>
      !!activeComponent &&
      pageBlueprint.some(
        (e) => e.pageSlug === page.id && e.componentId === activeComponent.id,
      ),
    [pageBlueprint, page.id, activeComponent],
  );

  const blueprintGroups = useMemo(() => {
    const map: Record<string, typeof pageBlueprint> = {};
    for (const e of pageBlueprint) {
      (map[e.pageSlug] ??= []).push(e);
    }
    return map;
  }, [pageBlueprint]);

  const toggleAdd = () => {
    if (!activeComponent || !activeVariant) return;
    if (inBlueprint) {
      removeBlueprintComponent(page.id, activeComponent.id);
    } else {
      addBlueprintComponent({
        pageSlug: page.id,
        componentId: activeComponent.id,
        variantId: activeVariant.id,
      });
    }
  };

  const selectVariant = (v: NonNullable<typeof activeComponent>["variants"][number]) => {
    if (!activeComponent) return;
    setActiveComponentId(activeComponent.id);
    pickVariant(page.id, activeComponent.id, v.id);
    if (
      pageBlueprint.some(
        (e) => e.pageSlug === page.id && e.componentId === activeComponent.id,
      )
    ) {
      updateBlueprintVariant(page.id, activeComponent.id, v.id);
    }
  };

  const cycleVariant = (
    pageSlug: string,
    componentId: string,
    variantId: string | null,
  ) => {
    const pg = SKELETON_PAGE_MAP[pageSlug];
    const comp = pg?.components.find((c) => c.id === componentId);
    if (!comp || !comp.variants.length) return;
    const idx = comp.variants.findIndex((v) => v.id === variantId);
    const next = comp.variants[(idx + 1) % comp.variants.length];
    updateBlueprintVariant(pageSlug, componentId, next.id);
  };

  // 跨单页：跳转流程工作台的「生成项目」步（当前为流程第 4 步）
  const gotoFlowGenerate = () => {
    setBuilderReturnStep(4);
    goToStep(4);
    router.push("/workflow");
  };

  // 回程：回到进入骨架时的流程步骤，保证链路不丢上下文
  const gotoFlowReturn = () => {
    goToStep(builderReturnStep);
    router.push("/workflow");
  };

  // 前进：从骨架回到流程，并推进到「下一步」（进入前的步骤 +1，封顶第 4 步）
  const gotoFlowForward = () => {
    goToStep(Math.min(builderReturnStep + 1, 4));
    router.push("/workflow");
  };

  // 变体示意预览：用 GSAP 替代原 CSS 关键帧（motionAnim）。
  // motionId 变化时重跑；useGSAP 的 context 自动清理上一轮 tween。
  const previewRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // scroll 类动效在预览窗内需要真实滚动距离才能演示 ScrollTrigger
  const isScrollMotion = [
    "reveal-on-scroll", "scroll-fade-up", "scroll-clip", "scroll-circle", "scroll-horizontal", "sticky-stack", "scroll-scrub", "parallax-hero", "parallax-layers", "zentry-image", "parallax-smooth",
  ].includes(effectiveMotionId ?? "");
  useGSAP(
    () => {
      if (previewRef.current) applyMotionPreview(previewRef.current, effectiveMotionId, scrollRef.current ?? undefined, motionParams);
    },
    // 单一字符串依赖，保证长度恒定、避免 useGSAP 依赖数组尺寸变化告警
    { scope: previewRef, dependencies: [`${effectiveMotionId ?? "none"}::${JSON.stringify(motionParams ?? null)}`] },
  );

  // parallax-smooth：预览态用 GSAP 平滑滚动 shim 演示惯性平滑（Lenis 安装被沙箱拦截，蓝图导出仍用真实 Lenis）
  const isSmooth = activeVariant?.motionId === "parallax-smooth";
  useGSAP(
    () => {
      const scroller = scrollRef.current;
      if (!isSmooth || !scroller) return;
      let target = scroller.scrollTop;
      let current = scroller.scrollTop;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        target += e.deltaY;
        const max = scroller.scrollHeight - scroller.clientHeight;
        target = Math.max(0, Math.min(target, max));
      };
      scroller.addEventListener("wheel", onWheel, { passive: false });
      const raf = () => {
        current += (target - current) * 0.12;
        scroller.scrollTop = current;
        ScrollTrigger.update();
      };
      gsap.ticker.add(raf);
      return () => {
        scroller.removeEventListener("wheel", onWheel);
        gsap.ticker.remove(raf);
      };
    },
    { dependencies: [isSmooth] },
  );

  // 完整蓝图（随选择实时生成，含 PRD / 架构 / 技术栈 / 真实文案覆盖 + 按板块动效覆盖）
  const blueprint = useMemo(() => {
    const fs = useFlowStore.getState();
    const stack = fs.techStack ? TECH_STACKS.find((t) => t.id === fs.techStack) : undefined;
    const techStackLine = stack
      ? `${stack.name}｜${stack.frontend} / ${stack.backend} / ${stack.database}`
      : undefined;
    const prdMd = fs.intentNarrative ? buildPrdMd(fs, style, fs.intentNarrative) : undefined;
    const archMd = buildArchitectureMarkdown(
      fs.techStack,
      stack?.name ?? "",
      fs.projectInfo?.projectName ?? "你的产品",
      inferProjectTypeName(fs),
      inferFeatureDetails(fs).map((f) => f.name),
      fs.pageBlueprint,
    );
    return buildBlueprint(
      picks,
      style,
      fs.projectInfo?.projectName ?? "我的项目",
      content,
      componentMotion,
      {},
      prdMd,
      archMd,
      techStackLine,
    );
  }, [picks, style, content, componentMotion, intentNarrative, techStack, pageBlueprint]);

  const downloadVariant = () => {
    if (!activeVariant) return;
    const code = applyButtonStyleToCode(resolveContent(activeVariant.code, content), btnStyle);
    const name = `${activeComponent?.id}-${activeVariant?.id}`;
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.tsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** 一键 AI：根据产品 PRD/特征生成全站文案并替换占位 */
  const generateSiteCopy = async () => {
    if (copyState === "loading") return;
    setCopyState("loading");
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, projectType, narrative: intentNarrative }),
      });
      if (!res.ok) throw new Error(`copy_${res.status}`);
      const override = await res.json();
      const { count, paths } = summarizeCopyChanges(content, override);
      setContent(override);
      setCopyState("done");
      setCopySummary(
        count > 0
          ? `已更新 ${count} 处文案${paths.length ? `（${paths.join("、")}）` : ""}`
          : "文案无变化",
      );
    } catch {
      setCopyState("error");
    }
    setTimeout(
      () => setCopyState((s) => (s === "done" || s === "error" ? "idle" : s)),
      2200,
    );
    setTimeout(() => setCopySummary(null), 4000);
  };

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      {/* 顶栏：页面 Tab + 视觉风格切换 */}
      <div ref={topbarRef} className="flex flex-wrap items-center gap-2 border-b border-border bg-background px-4 py-2.5">
        <div className="flex flex-1 items-center gap-1.5">
          {/* 当前页面定位：一级/二级页面的切换已收进左侧栏层级树 */}
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <span>{PAGE_GROUPS.find((g) => g.ids.includes(activePageId))?.label ?? "页面结构"}</span>
            <ChevronRight className="size-3.5 opacity-60" />
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <PageIcon className="size-4 text-primary" />
              {resolveText(page.name)}
            </span>
          </div>
        </div>

        {/* 中间：视觉风格切换 */}
        <div className="flex flex-none items-center gap-1.5">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setStyleOpen((v) => !v);
                setStyleQuery("");
              }}
              className={[
                "inline-flex items-center gap-2 transition-colors",
                style.id === "aw-brutalist"
                  ? "rounded-none border-2 border-black bg-white px-3 py-1.5 text-sm text-black shadow-[3px_3px_0_#000]"
                  : "rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground",
              ].join(" ")}
            >
              <span className="flex gap-0.5">
                {[style.palette.accent, style.palette.accent2, style.palette.surface, style.palette.text].map((c, i) => (
                  <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                ))}
              </span>
              <span className="max-w-28 truncate text-xs font-medium">{style.name}</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
            {styleOpen && (
              <div
                className={[
                  "absolute right-0 z-50 mt-2 w-[19.5rem] p-2",
                  style.id === "aw-brutalist"
                    ? "rounded-none border-2 border-black bg-white shadow-[3px_3px_0_#000]"
                    : "rounded-xl border border-border bg-card shadow-xl",
                ].join(" ")}
              >
                <div className="relative mb-2">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={styleQuery}
                    onChange={(e) => setStyleQuery(e.target.value)}
                    placeholder="搜索风格…"
                    className={[
                      "w-full py-1.5 pl-7 pr-2 text-xs outline-none",
                      style.id === "aw-brutalist"
                        ? "rounded-none border border-black bg-white placeholder:text-black/40"
                        : "rounded-lg border border-border bg-background placeholder:text-muted-foreground",
                    ].join(" ")}
                  />
                </div>
                <div className="grid max-h-60 grid-cols-3 gap-1.5 overflow-auto">
                  {style.id !== "aw-brutalist" && (
                    <button
                      type="button"
                      onClick={() => {
                        setVisualStyle(PREVIEW_DEFAULT_STYLE_ID);
                        themeSetActiveStyle(PREVIEW_DEFAULT_STYLE_ID);
                        setStyleOpen(false);
                      }}
                      className="col-span-3 flex items-center gap-1.5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-2 text-left text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      ↺ 重置为「粗野」（默认风格）
                    </button>
                  )}
                  {VISUAL_STYLES.filter((s) => s.name.includes(styleQuery.trim())).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setVisualStyle(s.id);
                        themeSetActiveStyle(s.id);
                        setStyleOpen(false);
                      }}
                      className={[
                        "flex flex-col items-start gap-1.5 rounded-lg p-2 text-left transition-colors",
                        style.id === s.id
                          ? style.id === "aw-brutalist"
                            ? "border-2 border-black bg-black/5"
                            : "bg-primary/10"
                          : style.id === "aw-brutalist"
                            ? "hover:bg-black/5"
                            : "hover:bg-muted",
                      ].join(" ")}
                    >
                      <span className="flex gap-0.5">
                        {[s.palette.accent, s.palette.accent2, s.palette.surface, s.palette.text].map((c, i) => (
                          <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                        ))}
                      </span>
                      <span
                        className={[
                          "w-full truncate text-[11px] leading-tight",
                          style.id === s.id ? "font-medium text-primary" : "text-foreground",
                        ].join(" ")}
                      >
                        {s.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* 当前风格色盘编辑（与顶部 ThemePresetToggle 共享 storage） */}
                <div className="mt-2 border-t border-border pt-2">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span className="text-[11px] text-muted-foreground">
                      色盘：{style.name}
                      {isStyleCustomized && (
                        <span className="ml-1 rounded bg-primary/15 px-1 text-[10px] font-medium text-primary">
                          已定制
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => themeResetOverride(style.id)}
                      disabled={!isStyleCustomized}
                      className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      重置
                    </button>
                  </div>
                  <div className="space-y-0.5">
                    <ColorRow
                      label="背景"
                      value={styleMerged.bg}
                      onChange={(v) => themeSetOverride(style.id, { bg: v })}
                    />
                    <ColorRow
                      label="表面"
                      value={styleMerged.surface}
                      onChange={(v) => themeSetOverride(style.id, { surface: v })}
                    />
                    <ColorRow
                      label="文字"
                      value={styleMerged.text}
                      onChange={(v) => themeSetOverride(style.id, { text: v })}
                    />
                    <ColorRow
                      label="主色"
                      value={styleMerged.accent}
                      onChange={(v) => themeSetOverride(style.id, { accent: v })}
                    />
                    <ColorRow
                      label="辅色"
                      value={styleMerged.accent2}
                      onChange={(v) => themeSetOverride(style.id, { accent2: v })}
                    />
                    {(style.palette.accents ?? []).slice(0, 2).map((_, i) => {
                      const seed = style.palette.accents ?? [];
                      const fallback = seed[i] ?? styleMerged.accent;
                      const cur = styleMerged.accents[i] ?? fallback;
                      return (
                        <ColorRow
                          key={i}
                          label={`扩展 ${i + 1}`}
                          value={cur}
                          onChange={(v) => updateStyleAccent(i, v)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 右侧操作区：AI 文案 → 设计 Token → 蓝图 → 保存项目 → 返回/前进 */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          {/* AI 一键文案：根据产品 PRD/特征生成全站真实文案并替换占位 */}
          <div className="relative">
            <Button
              size="sm"
              className="px-2"
              variant={copyState === "done" ? "secondary" : "outline"}
              onClick={generateSiteCopy}
              disabled={copyState === "loading"}
              title={
                copyState === "loading"
                  ? "正在生成全站文案…"
                  : copyState === "done"
                    ? "全站文案已应用"
                    : copyState === "error"
                      ? "生成失败，请重试"
                      : "根据 AI 产品 PRD/特征，一键生成全站各页面真实文案并替换占位"
              }
              aria-label="AI 一键生成全站文案"
            >
              {copyState === "loading" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : copyState === "done" ? (
                <Check className="size-3.5" />
              ) : copyState === "error" ? (
                <X className="size-3.5" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
            </Button>
            {copyState === "done" && (
              <span className="absolute -top-1 right-1 size-1.5 rounded-full bg-primary" />
            )}
            {copySummary && (
              <span className="absolute -bottom-9 left-1/2 z-50 flex w-max max-w-[20rem] -translate-x-1/2 items-center gap-1.5 rounded-lg border border-border bg-popover px-3 py-1.5 text-[11px] font-medium text-foreground shadow-md">
                <Check className="size-3 shrink-0 text-primary" />
                {copySummary}
              </span>
            )}
          </div>

          {/* 设计 Token：一级入口（覆盖风格默认，与 Step 4 / 导出联动） */}
          <div className="relative">
            <Button
              variant={tokenOpen ? "secondary" : "outline"}
              size="sm"
              onClick={() => setTokenOpen((v) => !v)}
              title="设计 Token（覆盖风格默认）"
            >
              <SlidersHorizontal className="size-3.5" />
              设计 Token
            </Button>
            {tokenOpen && (
              <div className="absolute right-0 z-50 mt-2 rounded-xl border border-border bg-card p-3 shadow-xl">
                <DesignTokensPanel variant="popover" />
              </div>
            )}
          </div>

          {/* 页面蓝图：收集「页面 + 变体」，供流程生成时并入 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBlueprintOpen((v) => !v)}
            title="页面蓝图收集面板"
          >
            <ListChecks className="size-3.5" />
            蓝图
            {pageBlueprint.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                {pageBlueprint.length}
              </span>
            )}
          </Button>

          {/* 保存项目：流程/全局动作，紧邻返回按钮 */}
          <BuilderSaveButton />

          <span className="mx-1 h-5 w-px bg-border" />

          {/* 返回流程（仅图标） */}
          <Button
            variant="ghost"
            size="icon"
            onClick={gotoFlowReturn}
            title="回到流程工作台（进入前的步骤）"
            aria-label="返回流程"
          >
            <ArrowLeft className="size-4" />
          </Button>
          {/* 流程上下文：前进到下一步（仅从流程进入时显示） */}
          {inFlow && (
            <Button
              variant="ghost"
              size="icon"
              onClick={gotoFlowForward}
              title="前进到流程的下一步"
              aria-label="前进到下一步"
              className="text-primary hover:text-primary"
            >
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 两栏主体 + 变体抽屉（点按展开 / 点空白或 Esc 收起 / 侧栏可收起） */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* 左：组件清单 + 变体抽屉（点按展开，稳定保持） */}
        <div ref={leftRegionRef} className="relative">
        <aside className={["flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-border bg-background transition-[width] duration-200", sidebarCollapsed ? "w-12" : "w-60"].join(" ")}>
          <div className="flex items-center justify-between px-3 py-2.5">
            {sidebarCollapsed ? (
              <span className="mx-auto text-xs font-semibold text-muted-foreground">{SKELETON_PAGES.length}</span>
            ) : (
              <span className="truncate text-xs font-semibold text-muted-foreground">页面结构 · {SKELETON_PAGES.length} 页</span>
            )}
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "展开组件栏" : "收起组件栏"}
              className="shrink-0 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          {sidebarCollapsed ? (
            /* 收起态：图标快捷跳页 */
            <div className="min-h-0 flex flex-1 flex-col items-center gap-1 overflow-y-auto p-1">
              {SKELETON_PAGES.map((p) => {
                const Icon = PAGE_ICONS[p.icon] ?? Home;
                const active = p.id === activePageId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPage(p.id)}
                    title={resolveText(p.name)}
                    className={[
                      "flex w-full items-center justify-center rounded-lg py-2.5 transition-all",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <Icon className="size-4 shrink-0" />
                  </button>
                );
              })}
            </div>
          ) : (
            /* 层级树：一级「用途」→ 二级「页面」→ 三级「区块组件」 */
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
              {PAGE_GROUPS.map((g) => {
                const pages = g.ids
                  .map((pid) => SKELETON_PAGES.find((p) => p.id === pid))
                  .filter((p): p is SkeletonPage => Boolean(p));
                const open = expandedGroups[g.label] ?? true;
                return (
                  <div key={g.label} className="mb-1">
                    {/* 一级：分类（可折叠） */}
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGroups((prev) => ({
                          // 手风琴互斥：打开当前一级，其余一级全部收起
                          ...Object.fromEntries(PAGE_GROUPS.map((grp) => [grp.label, false])),
                          [g.label]: !(prev[g.label] ?? true),
                        }))
                      }
                      className={[
                        "mb-0.5 flex w-full items-center gap-1.5 rounded-lg border-l-2 px-1.5 py-1.5 text-left transition hover:bg-muted",
                        open ? "border-primary bg-primary/5" : "border-transparent",
                      ].join(" ")}
                    >
                      <ChevronDown
                        className={["size-3.5 shrink-0 text-muted-foreground transition-transform", open ? "rotate-180" : ""].join(" ")}
                      />
                      <span className="flex-1 truncate text-sm font-bold text-foreground">
                        {g.label}
                      </span>
                      <span className="rounded-full border border-foreground/10 bg-background px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {pages.length}
                      </span>
                    </button>

                    {open && (
                      <div className="ml-2 border-l border-border pl-1">
                        {pages.map((p) => {
                          const Icon = PAGE_ICONS[p.icon] ?? Home;
                          const isActive = p.id === activePageId;
                          const pCount = blueprintCount(p.id);
                          const pageOpen = expandedPages[p.id] ?? true;
                          return (
                            <div key={p.id}>
                              {/* 二级：页面（点当前页可折叠其三级组件） */}
                              <button
                                type="button"
                                onClick={() => togglePage(p)}
                                className={[
                                  "mb-0.5 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                                  isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                                ].join(" ")}
                              >
                                <ChevronDown
                                  className={[
                                    "size-3 shrink-0 text-muted-foreground transition-transform",
                                    isActive && pageOpen ? "rotate-180" : "",
                                  ].join(" ")}
                                />
                                <Icon
                                  className={[
                                    "size-3.5 shrink-0",
                                    isActive ? "text-primary" : "text-muted-foreground",
                                  ].join(" ")}
                                />
                                <span
                                  className={[
                                    "min-w-0 flex-1 truncate text-sm font-medium",
                                    isActive ? "text-primary" : "text-foreground",
                                  ].join(" ")}
                                >
                                  {resolveText(p.name)}
                                </span>
                                {pCount > 0 && (
                                  <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                                    {pCount}
                                  </span>
                                )}
                              </button>

                              {/* 三级：当前页的区块组件（可被折叠） */}
                              {isActive && pageOpen && (
                                <div className="mb-1 ml-2 flex flex-col gap-0.5 border-l border-border pl-1.5">
                                  {p.components.map((c) => {
                                    const CIcon = COMPONENT_ICONS[c.icon] ?? LayoutGrid;
                                    const cActive = activeComponent?.id === c.id;
                                    return (
                                      <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => openComponent(c.id)}
                                        title={resolveText(c.name)}
                                        className={[
                                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition",
                                          cActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
                                        ].join(" ")}
                                      >
                                        <CIcon
                                          className={[
                                            "size-3.5 shrink-0",
                                            cActive ? "text-primary" : "text-muted-foreground",
                                          ].join(" ")}
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm">{resolveText(c.name)}</span>
                                        {isInBlueprint(p.id, c.id) && (
                                          <span className="shrink-0 rounded-md bg-primary/10 p-1 text-primary" title="已加入蓝图">
                                            <Check className="size-3" />
                                          </span>
                                        )}
                                        <span className="shrink-0 rounded-full border border-border/60 bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                          {c.variants.length}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* 变体抽屉（点按打开；点空白 / Esc / 关闭按钮收起） */}
        <div
          className={[
            "absolute bottom-0 top-0 z-30 flex w-[340px] flex-col overflow-hidden border-r border-border bg-background transition-[transform,opacity] duration-200",
            drawerOpen ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-full opacity-0",
          ].join(" ")}
          style={{
            left: sidebarCollapsed ? "48px" : "240px",
          }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {resolveText(activeComponent?.name ?? "")} · 变体（{activeComponent?.variants.length ?? 0}）
            </span>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="收起抽屉"
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
            {activeComponent?.variants.length ? (
              activeComponent.variants.map((v) => {
                const selected = activeVariant?.id === v.id;
                return (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      selectVariant(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectVariant(v);
                      }
                    }}
                    className={[
                      "w-full cursor-pointer overflow-hidden rounded-xl border text-left transition-all",
                      selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60",
                    ].join(" ")}
                  >
                    {/* mini 预览：缩放 55% 截断显示（pointer-events-none 防干扰） */}
                    <div className="pointer-events-none h-24 overflow-hidden bg-background">
                      <div
                        className="dtox-root"
                        style={{
                          ...styleVars(style, designSystem),
                          transform: "scale(0.55)",
                          transformOrigin: "top left",
                          width: "181.8%",
                        }}
                      >
                        <ComponentPreview componentId={activeComponent.id} variantId={v.id} style={style} />
                      </div>
                    </div>
                    <div className="border-t border-border px-3 py-2">
                      <p className={["text-sm font-medium", selected ? "text-primary" : "text-foreground"].join(" ")}>{resolveText(v.name)}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{resolveText(v.description)}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {v.tags.map((t) => (
                          <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                该组件的变体库正在扩充中
              </div>
            )}
          </div>
        </div>
        </div>

        {/* 页面蓝图收集面板（右侧浮层） */}
        {blueprintOpen && (
          <div ref={blueprintPanelRef} className="absolute bottom-0 right-0 top-0 z-40 flex w-80 flex-col overflow-hidden border-l border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <span className="text-xs font-semibold text-muted-foreground">
                页面蓝图 · 已选 {pageBlueprint.length} 块
              </span>
              <div className="flex items-center gap-1">
                {pageBlueprint.length > 0 && (
                  <Button variant="ghost" size="icon" className="size-7" onClick={clearBlueprint} title="清空蓝图">
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => setBlueprintOpen(false)}
                  aria-label="收起蓝图面板"
                  className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2.5">
              {Object.keys(blueprintGroups).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <ListChecks className="size-8 text-muted-foreground/40" />
                  尚未加入任何区块。
                  <span className="text-xs">选中组件后点顶部「加入蓝图」收集，生成文档时并入。</span>
                </div>
              ) : (
                Object.entries(blueprintGroups).map(([pageSlug, entries]) => {
                  const pg = SKELETON_PAGE_MAP[pageSlug];
                  return (
                    <div key={pageSlug} className="mb-3">
                      <p className="mb-1 px-1 text-xs font-semibold text-foreground">{pg?.name ?? pageSlug}</p>
                      <div className="space-y-1.5">
                        {entries.map((e) => {
                          const comp = pg?.components.find((c) => c.id === e.componentId);
                          const v = e.variantId ? findVariant(pageSlug, e.componentId, e.variantId) : null;
                          const hasChoices = !!comp && comp.variants.length > 1;
                          return (
                            <div key={e.componentId} className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{comp?.name ?? e.componentId}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {e.variantId ? v?.name || "默认变体" : "默认变体"}
                                </p>
                              </div>
                              {hasChoices && (
                                <button
                                  type="button"
                                  onClick={() => cycleVariant(pageSlug, e.componentId, e.variantId)}
                                  title="切换变体"
                                  className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                >
                                  <RefreshCw className="size-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeBlueprintComponent(pageSlug, e.componentId)}
                                title="移除该组件"
                                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              >
                                <X className="size-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="border-t border-border p-2.5">
              <Button className="w-full" size="sm" onClick={gotoFlowGenerate}>
                <ArrowRight className="size-3.5" /> 进入流程 · 生成项目
              </Button>
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                蓝图将并入「生成项目」里的 SKELETON.md
              </p>
            </div>
          </div>
        )}

        {/* 右：大预览 + 复制 */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {resolveText(activeComponent?.name ?? "")} · {resolveText(activeVariant?.name ?? "")}
              </p>
              <p className="text-xs text-muted-foreground">{resolveText(activeVariant?.description ?? "")}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {activeVariant && (
                <>
                  <CopyButton text={resolveText(activeVariant.prompt)} label="提示词" />
                  <CopyButton text={resolveText(activeVariant.code)} label="代码" />
                  <Button
                    variant={inBlueprint ? "outline" : "default"}
                    size="sm"
                    onClick={toggleAdd}
                    title={inBlueprint ? "从蓝图中移除该组件" : "将该组件（含当前变体）加入页面蓝图"}
                  >
                    {inBlueprint ? (
                      <Check className="size-3.5" />
                    ) : (
                      <>
                        <Plus className="size-3.5" /> 加入蓝图
                      </>
                    )}
                  </Button>
                </>
              )}
              <span className="mx-1 h-5 w-px bg-border" />
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
            {/* 大预览：浏览器视窗框架，让预览一眼可辨 */}
            {isScrollMotion && <div aria-hidden style={{ height: "90vh" }} />}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {/* 浏览器顶栏：红黄绿交通灯 + 地址栏 + 变体标签 */}
              <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
                <span className="flex shrink-0 gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ background: "#f53e3e" }} title="关闭" />
                  <span className="size-2.5 rounded-full" style={{ background: "#f5a623" }} title="最小化" />
                  <span className="size-2.5 rounded-full" style={{ background: "#3bbf4c" }} title="缩放" />
                </span>
                <span className="flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded-md border border-border bg-background px-3">
                  <Lock className="mr-1.5 size-3 shrink-0 text-muted-foreground/70" />
                  <span className="truncate text-xs text-muted-foreground">
                    {resolveText(activeComponent?.name ?? "")}.preview
                  </span>
                </span>
                <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
                  {resolveText(activeVariant?.name ?? "")}
                  {btnStyle && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {findButtonStyle(btnStyle).name}
                    </span>
                  )}
                </span>
              </div>
              {/* 预览画布：衬托「页面」，页面居中带留白与投影 */}
              <div className="bg-muted/30 p-5 sm:p-8">
                <div className="mx-auto max-w-4xl">
                  <div
                    ref={previewRef}
                    className="dtox-root min-h-[20rem] overflow-hidden rounded-[var(--radius)] border border-border"
                    style={{
                      ...styleVars(style, designSystem),
                      color: "var(--foreground)",
                      boxShadow: "var(--shadow)",
                    }}
                  >
                    <style>{designTokenBridgeCss(designSystem)}</style>
                    {activeComponent && activeVariant && (
                      <CtaStyleProvider value={btnStyle ?? null}>
                        <BuilderElementProvider scope="main" componentId={activeComponent.id} variantId={activeVariant.id}>
                          <ComponentPreview componentId={activeComponent.id} variantId={activeVariant.id} style={style} />
                        </BuilderElementProvider>
                      </CtaStyleProvider>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {isScrollMotion && <div aria-hidden style={{ height: "60vh" }} />}

            {/* 组件详情：详情 + 交互动效 一行两卡；其下提示词与代码全宽 */}
            {activeVariant && (
              <>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex h-8 items-center justify-between border-b border-border px-3">
                      <span className="text-[11px] font-semibold text-primary">组件详情</span>
                      <span className="truncate text-[11px] text-muted-foreground">{resolveText(activeVariant.name)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 px-3 py-2">
                      {activeVariant.tags.length > 0 ? (
                        activeVariant.tags.map((t) => (
                          <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">#{t}</span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex h-8 items-center justify-between border-b border-border px-3">
                      <span className="text-[11px] font-semibold text-primary">交互动效</span>
                      {activeVariant.interaction && <Sparkles className="size-3.5 text-primary" />}
                    </div>
                    <div className="flex min-h-7 items-center px-3 py-1.5">
                      <p className="truncate text-[11px] leading-5 text-muted-foreground">
                        {activeVariant.interaction || "静态呈现，无内置动效"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold text-primary">实现提示词（可复制）</p>
                  </div>
                  <pre className="m-4 whitespace-pre-wrap rounded-md border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                    {resolveText(activeVariant.prompt)}
                  </pre>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-xs font-semibold text-primary">TSX 代码（可复制/下载）</p>
                    <div className="flex items-center gap-2">
                      {btnStyle && <span className="text-[10px] font-medium text-primary">{findButtonStyle(btnStyle).name} 已应用</span>}
                      <span className="font-mono text-xs text-muted-foreground">
                        {activeComponent?.id}-{activeVariant.id}.tsx
                      </span>
                      <Button variant="ghost" size="sm" onClick={downloadVariant}>
                        <Download className="size-3.5" /> 下载
                      </Button>
                    </div>
                  </div>
                  <pre className="mx-4 mb-4 max-h-72 overflow-auto whitespace-pre rounded-md border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
                    {applyButtonStyleToCode(resolveText(activeVariant.code), btnStyle)}
                  </pre>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
