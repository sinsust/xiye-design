"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home,
  Tags,
  LogIn,
  LayoutDashboard,
  Images,
  Newspaper,
  ShoppingBag,
  Info,
  Mail,
  LayoutGrid,
  BookOpenText,
  Bot,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Palette,
  ShieldCheck,
  FileText,
  ArrowRight,
  Plus,
  Trash2,
  X,
  Loader2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  SKELETON_PAGES,
  SKELETON_PAGE_MAP,
  type SkeletonPage,
  type SkeletonComponent,
} from "@/data/skeletons";
import { useFlowStore } from "@/lib/store/flow-store";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { resolveContent, type ContentOverride } from "@/lib/content-resolver";
import { TECH_STACKS } from "@/data/tech-stacks";
import { VISUAL_STYLES } from "@/data/visual-styles";
import { ComponentPreview, styleVars } from "@/app/builder/previews";
import { briefToNarrative, type ProductBrief } from "@/lib/ai-discover";
import type { ProductPage } from "@/lib/ai-intent";
import type { VisualStyle } from "@/data/visual-styles";
import { Workspace } from "./workspace";

/** 页面图标映射（按 SKELETON_PAGE.id 对应 lucide 图标） */
const PAGE_ICON: Record<string, LucideIcon> = {
  home: Home,
  pricing: Tags,
  auth: LogIn,
  dashboard: LayoutDashboard,
  portfolio: Images,
  blog: Newspaper,
  product: ShoppingBag,
  about: Info,
  contact: Mail,
  misc: LayoutGrid,
  docs: BookOpenText,
  "ai-chat": Bot,
  feedback: MessageSquare,
};

interface BuildPageItem {
  id: string;
  name: string;
  path?: string;
  description: string;
  skeleton: SkeletonPage;
  source: "product" | "skeleton";
}

function pickSkeletonPage(productPage: ProductPage): SkeletonPage {
  const text = `${productPage.name} ${productPage.description ?? ""} ${productPage.path ?? ""}`.toLowerCase();
  const rules: [string[], string][] = [
    [["登录", "注册", "auth", "signin", "signup"], "auth"],
    [["定价", "价格", "套餐", "pricing"], "pricing"],
    [["博客", "文章", "资讯", "blog"], "blog"],
    [["联系", "留言", "contact"], "contact"],
    [["反馈", "建议", "feedback"], "feedback"],
    [["关于", "团队", "公司", "about"], "about"],
    [["文档", "帮助", "指南", "docs"], "docs"],
    [["后台", "管理", "统计", "数据", "dashboard", "仪表板", "分析", "趋势"], "dashboard"],
    [["作品", "案例", "portfolio"], "portfolio"],
    [["商品", "产品", "product", "详情"], "product"],
    [["聊天", "ai", "助手", "bot", "咨询", "智能"], "ai-chat"],
    [["首页", "主页", "home", "落地", "欢迎"], "home"],
  ];
  for (const [needles, id] of rules) {
    if (needles.some((w) => text.includes(w))) return SKELETON_PAGE_MAP[id];
  }
  return SKELETON_PAGE_MAP["home"];
}

/** 项目上下文 → 占位文案联动：把关键文案映射进 skeleton-content，
 *  让本页一切区块（含跨页添加的）预览都渲染项目真实文案，而非全局 demo。 */
function buildContentOverride(opts: {
  projectName: string;
  projectType: string | null;
  brief: ProductBrief | null;
}): ContentOverride {
  const name = opts.projectName.trim() || opts.brief?.name?.trim() || "我的项目";
  const tagline =
    opts.brief?.description?.trim() ||
    opts.brief?.positioning?.trim() ||
    `把 ${name} 的价值讲清楚。`;
  const features = (opts.brief?.coreModules ?? [])
    .filter((m) => m.name)
    .map((m) => ({ name: m.name, desc: m.detail }));
  const badge = opts.projectType
    ? `${opts.projectType.replace(/模[板版]|系统|平台|应用/g, "")} · 数字产品`
    : "数字产品";
  return {
    brand: name,
    product: name,
    tagline,
    cta: {
      primary: "开始体验",
      secondary: "了解更多",
      title: "现在就用起来",
      subheading: tagline,
      button: "开始体验",
    },
    nav: { features: "功能", pricing: "定价", faq: "常见问题", docs: "文档", blog: "博客" },
    hero: { badge, heading: name, subheading: tagline },
    footer: { tagline, copyright: `© ${new Date().getFullYear()} ${name}` },
    features: {
      title: "核心能力",
      subtitle: "围绕业务设计的关键功能",
      items: features.length
        ? features
        : [{ name: "高效", desc: "开箱即用的完整解决方案" }],
    },
  };
}

function buildPagesFromBrief(brief: ProductBrief | null): BuildPageItem[] {
  if (brief?.pages?.length) {
    return brief.pages.map((p, i) => ({
      id: p.path ?? `page-${i}`,
      name: p.name,
      path: p.path,
      description: p.description,
      skeleton: pickSkeletonPage(p),
      source: "product",
    }));
  }
  return SKELETON_PAGES.map((p) => ({
    id: p.id,
    name: p.name,
    path: `/${p.id}`,
    description: p.description,
    skeleton: p,
    source: "skeleton",
  }));
}

/** 区块内联预览：选中某个区块时，在卡片正下方就地渲染其变体效果（无需滚回顶部） */
export function LiveVariantPreview({
  componentId,
  variantId,
  variantName,
  previewStyle,
}: {
  componentId: string | null;
  variantId: string | null;
  variantName: string | null;
  previewStyle: VisualStyle | null;
}) {
  if (!componentId || !variantId || !previewStyle) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-background px-3 py-3 text-xs text-muted-foreground">
        <Sparkles className="size-3.5 shrink-0 text-primary" />
        先在右侧「区块属性」选择此区块的变体，即可就地预览效果
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
          <Sparkles className="size-3" /> 预览
        </p>
        {variantName && (
          <span className="max-w-[60%] truncate rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {variantName}
          </span>
        )}
      </div>
      <div
        className="dtox-root min-h-[12rem] max-h-[26rem] overflow-auto rounded-xl bg-background ring-1 ring-border"
        style={{ ...styleVars(previewStyle), color: "var(--foreground)" }}
      >
        <ComponentPreview componentId={componentId} variantId={variantId} style={previewStyle} />
      </div>
    </div>
  );
}

interface BuildStageProps {
  onAdvance: () => void;
}

export function BuildStage({ onAdvance }: BuildStageProps) {
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);
  const visualStyleId = useFlowStore((s) => s.visualStyle);
  const techStackId = useFlowStore((s) => s.techStack);
  const productBrief = useFlowStore((s) => s.productBrief);
  const projectName = useFlowStore((s) => s.projectInfo?.projectName ?? null);
  const projectType = useFlowStore((s) => s.projectType);
  const addBlueprintComponent = useFlowStore((s) => s.addBlueprintComponent);
  const removeBlueprintComponent = useFlowStore((s) => s.removeBlueprintComponent);
  const setPreviewContent = useSkeletonStore((s) => s.setContent);

  const buildPages = useMemo(() => buildPagesFromBrief(productBrief), [productBrief]);

  const [activePageId, setActivePageId] = useState<string | null>(buildPages[0]?.id ?? null);
  const [activeComp, setActiveComp] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const addPanelRef = useRef<HTMLDivElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 点面板外任意处自动收起添加区块面板
  useEffect(() => {
    if (!showAddPanel) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (addPanelRef.current?.contains(t) || addBtnRef.current?.contains(t)) return;
      setShowAddPanel(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [showAddPanel]);

  // 打开面板时滚动到面板位置，避免列表已滚下时看不见（之前“用不了”的原因）
  useEffect(() => {
    if (showAddPanel) scrollRef.current?.scrollTo({ top: 0 });
  }, [showAddPanel]);

  // 占位文案联动 + 显示级 resolve：名称/描述里的 {{...}} 一律渲染为真实文案
  const skeletonContent = useSkeletonStore((s) => s.content);
  const resolveText = (t: string) => resolveContent(t, skeletonContent);

  // 全局可用组件目录（供“添加区块”加入其它页面/骨架里的通用区块）
  const compCatalog = useMemo(() => {
    const seen = new Map<string, SkeletonComponent>();
    for (const p of SKELETON_PAGES) {
      for (const c of p.components) {
        if (!seen.has(c.id)) seen.set(c.id, c);
      }
    }
    return [...seen.values()];
  }, []);

  // productBrief 更新后，如果当前选中页不在新列表里，回到第一项
  useEffect(() => {
    if (buildPages.length && !buildPages.find((p) => p.id === activePageId)) {
      setActivePageId(buildPages[0]?.id ?? null);
      setActiveComp(null);
    }
  }, [buildPages, activePageId]);

  // 占位文案联动：项目名/类型/brief 变化时，把真实文案映射进 skeleton-content，
  // 让本页一切区块（含跨页添加的）预览都渲染项目文案而非全局 demo。
  useEffect(() => {
    setPreviewContent(
      buildContentOverride({ projectName: projectName ?? "", projectType, brief: productBrief }),
    );
  }, [projectName, projectType, productBrief, setPreviewContent]);

  // 已选变体：skeletonPageId -> compId -> variantId
  const selected = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    for (const e of pageBlueprint) {
      (m[e.pageSlug] ??= {})[e.componentId] = e.variantId ?? "";
    }
    return m;
  }, [pageBlueprint]);

  const visualStyle = VISUAL_STYLES.find((v) => v.id === visualStyleId);
  const techName = TECH_STACKS.find((t) => t.id === techStackId)?.name ?? (techStackId || "未选择");

  const currentBuildPage = activePageId ? buildPages.find((p) => p.id === activePageId) ?? null : null;
  const currentPage = currentBuildPage?.skeleton ?? null;
  const pageSlug = currentBuildPage?.skeleton.id ?? "";

  // 蓝图子集：当前页的真实区块 = pageBlueprint 中属于该页的条目（加过/选过才在）
  const pageBlocks = useMemo(
    () => pageBlueprint.filter((e) => e.pageSlug === pageSlug),
    [pageBlueprint, pageSlug],
  );
  // 各页区块数（左栏计数用）
  const blockCountByPage = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of pageBlueprint) m[e.pageSlug] = (m[e.pageSlug] ?? 0) + 1;
    return m;
  }, [pageBlueprint]);

  // 反查组件定义：优先本页骨架，缺失时回退全局目录（支持跨页添加的区块)
  const compById = (id: string) =>
    currentPage?.components.find((c) => c.id === id) ?? compCatalog.find((c) => c.id === id) ?? null;

  const currentComp = activeComp ? compById(activeComp) : null;
  const currentVariantId = currentComp ? selected[pageSlug]?.[currentComp.id] : undefined;
  const currentVariant = currentComp?.variants.find((v) => v.id === currentVariantId) ?? null;

  const pickVariant = (compId: string, variantId: string) => {
    if (!pageSlug) return;
    addBlueprintComponent({ pageSlug, componentId: compId, variantId });
  };

  const addBlock = (compId: string) => {
    if (!pageSlug) return;
    addBlueprintComponent({ pageSlug, componentId: compId, variantId: null });
    setActiveComp(compId);
    setShowAddPanel(false);
  };

  const removeBlock = (compId: string) => {
    if (!pageSlug) return;
    removeBlueprintComponent(pageSlug, compId);
    setActiveComp((c) => (c === compId ? null : c));
  };

  // 一键补全当前页姿态的推荐区块（等价旧的默认页面结构）
  const fillRecommended = () => {
    if (!pageSlug || !currentPage) return;
    for (const comp of currentPage.components) {
      addBlueprintComponent({
        pageSlug,
        componentId: comp.id,
        variantId: comp.variants[0]?.id ?? null,
      });
    }
    setShowAddPanel(false);
  };

  const totalPicked = pageBlueprint.length;

  const copy = (text: string, key: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
  };

  // 一键 AI 改写全站文案：用项目上下文生成 ContentOverride 并同步到预览（含跨页添加区块）
  const generateSiteCopy = async () => {
    if (copyState === "loading") return;
    setCopyState("loading");
    try {
      const res = await fetch("/api/ai/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName ?? productBrief?.name ?? "",
          projectType,
          narrative: productBrief ? briefToNarrative(productBrief) : null,
        }),
      });
      if (!res.ok) throw new Error(`copy_${res.status}`);
      const override: ContentOverride = await res.json();
      setPreviewContent(override);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
    setTimeout(() => setCopyState((s) => (s === "done" || s === "error" ? "idle" : s)), 2000);
  };

  /* ── 左栏：AI 推荐页面 → 匹配骨架组件 ── */
  const left = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-muted/30">
      <div className="shrink-0 border-b border-border/30 px-3 py-2">
        <h3 className="text-sm font-medium">
          {productBrief?.pages?.length ? "AI 推荐页面清单" : "通用页面骨架"}
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {buildPages.map((buildPage) => {
          const sk = buildPage.skeleton;
          const Icon = PAGE_ICON[sk.id] ?? LayoutGrid;
          const picked = blockCountByPage[sk.id] ?? 0;
          const open = activePageId === buildPage.id;
          return (
            <div key={buildPage.id} className="mb-1">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                  if (activePageId === buildPage.id) {
                    setActivePageId(null);
                    setActiveComp(null);
                  } else {
                    setActivePageId(buildPage.id);
                    setActiveComp(null);
                  }
                }}
                className={[
                  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                  open ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                ].join(" ")}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{buildPage.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{picked}/{sk.components.length}</span>
                {open ? (
                  <ChevronDown className="size-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0" />
                )}
              </button>
              {open && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border/30 pl-2">
                  {sk.components.map((comp) => {
                    const vId = selected[sk.id]?.[comp.id];
                    const isActive = activeComp === comp.id;
                    return (
                      <button
                        key={comp.id}
                        onClick={() => {
                          setActivePageId(buildPage.id);
                          setActiveComp(comp.id);
                        }}
                        className={[
                          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] transition",
                          isActive ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "size-1.5 shrink-0 rounded-full",
                            vId ? "bg-emerald-500" : "bg-muted-foreground/40",
                          ].join(" ")}
                        />
                        <span className="min-w-0 flex-1 truncate">{resolveText(comp.name)}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  /* ── 中栏：当前页面结构预览 ── */
  const center = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-muted/30">
      <div className="flex shrink-0 flex-row items-center justify-between border-b border-border/30 px-4 py-2">
        <div className="flex items-center gap-2">
          {currentPage &&
            (() => {
              const I = PAGE_ICON[currentPage.id] ?? LayoutGrid;
              return <I className="size-4 text-primary" />;
            })()}
          <h3 className="text-sm font-medium">{currentPage?.name ?? "页面预览"}</h3>
          <span className="text-[11px] text-muted-foreground">已搭 {pageBlocks.length} 个区块</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {currentBuildPage?.source === "product" && currentBuildPage.path && (
            <span className="text-[11px] text-muted-foreground">{currentBuildPage.path}</span>
          )}
          {currentPage && (
            <button
              type="button"
              ref={addBtnRef}
              onClick={() => setShowAddPanel((v) => !v)}
              className={[
                "flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] transition",
                showAddPanel
                  ? "bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted",
              ].join(" ")}
            >
              <Plus className="size-3.5" /> 添加区块
            </button>
          )}
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {/* 添加区块：全局组件目录（已在本页的不再列出） */}
        {showAddPanel && currentPage && (
          <div ref={addPanelRef} className="rounded-xl border border-border/60 bg-background p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold text-muted-foreground">添加区块 · 全局组件目录</p>
              <button
                type="button"
                onClick={() => setShowAddPanel(false)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {compCatalog.map((c) => {
                const added = pageBlocks.some((b) => b.componentId === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={added}
                    onClick={() => addBlock(c.id)}
                    className={[
                      "rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                      added
                        ? "cursor-default bg-muted/60 text-muted-foreground/50"
                        : "bg-muted text-foreground hover:bg-primary/10",
                    ].join(" ")}
                  >
                    <span className="font-medium">{resolveText(c.name)}</span>
                    {added && <span className="ml-1.5 text-[10px] text-emerald-600">已添加</span>}
                    <span className="mt-0.5 block line-clamp-1 text-[11px] opacity-80">{resolveText(c.description)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
          <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <LayoutGrid className="size-3.5" /> {currentPage?.name ?? "页面"} 结构
          </p>
          {pageBlocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-xs text-muted-foreground">
              <p>该页面还没有区块。</p>
              <button
                type="button"
                onClick={fillRecommended}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
              >
                <Sparkles className="size-3" /> 一键补全推荐区块
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {pageBlocks.map((blk) => {
                const comp = compById(blk.componentId);
                if (!comp) return null;
                const vId = blk.variantId ?? null;
                const variant = vId ? comp.variants.find((v) => v.id === vId) ?? null : null;
                const isActive = activeComp === comp.id;
                return (
                  <div
                    key={comp.id}
                    className={[
                      "overflow-hidden rounded-xl bg-background transition",
                      isActive ? "ring-1 ring-primary/30" : "hover:bg-muted",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-2 p-3">
                      <button
                        type="button"
                        onClick={() => setActiveComp(isActive ? null : comp.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{resolveText(comp.name)}</p>
                          {variant ? (
                            <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-[10px] text-emerald-600">
                              {resolveText(variant.name)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              未选变体
                            </span>
                          )}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {resolveText(variant ? variant.description : comp.description)}
                        </p>
                        {variant?.tags?.length ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {variant.tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(comp.id)}
                        title="从页面移除该区块"
                        className="shrink-0 rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    {/* 选中的区块：预览就地展开在该卡片正下方，无需滚回顶部 */}
                    {isActive && (
                      <div className="border-t border-border/60 p-3">
                        <LiveVariantPreview
                          componentId={comp.id}
                          variantId={vId}
                          variantName={variant?.name ?? null}
                          previewStyle={visualStyle ?? VISUAL_STYLES[0] ?? null}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ── 右栏：选中区块属性 + AI 建议 ── */
  const right = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-muted/30">
      <div className="shrink-0 border-b border-border/30 px-3 py-2">
        <h3 className="text-sm font-medium">区块属性</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!currentComp ? (
          <p className="text-sm text-muted-foreground/70">从左侧导航或中间预览选择区块，查看属性与 AI 建议。</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-foreground">{resolveText(currentComp.name)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{resolveText(currentComp.description)}</p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">选择变体</p>
              <div className="grid grid-cols-1 gap-1.5">
                {currentComp.variants.map((v) => {
                  const active = v.id === currentVariantId;
                  return (
                    <button
                      key={v.id}
                      onClick={() => pickVariant(currentComp.id, v.id)}
                      className={[
                        "rounded-lg px-2.5 py-1.5 text-left text-xs transition",
                        active
                          ? "bg-primary/10 text-foreground"
                          : "bg-background text-muted-foreground hover:bg-muted",
                      ].join(" ")}
                    >
                      <span className="font-medium">{resolveText(v.name)}</span>
                      <span className="mt-0.5 block text-[11px] opacity-80">{resolveText(v.description)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {currentVariant && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground">实现提示词</p>
                  <button
                    onClick={() => copy(currentVariant.prompt, currentComp.id)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    {copied === currentComp.id ? <Check className="size-3" /> : <Copy className="size-3" />}
                    {copied === currentComp.id ? "已复制" : "复制"}
                  </button>
                </div>
                <p className="rounded-lg bg-background px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {currentVariant.prompt}
                </p>
                {currentVariant.interaction && (
                  <p className="text-[11px] text-muted-foreground">交互：{resolveText(currentVariant.interaction)}</p>
                )}
              </div>
            )}

            <div className="space-y-2 border-t border-border/30 pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Sparkles className="size-3 text-primary" /> AI 协同建议
              </p>
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Palette className="size-3 shrink-0" />
                  <span>视觉风格：{visualStyle?.name ?? "未选择"}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3 shrink-0" />
                  <span>技术栈：{techName}</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <ShieldCheck className="mt-0.5 size-3 shrink-0" />
                  <span>审校：移动端 &lt;768px 单列塌陷、无横向溢出；CTA 对比度满足 WCAG AA。</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <Sparkles className="mt-0.5 size-3 shrink-0" />
                  <span>UX·UI：全页单一 accent 色，避免风格漂移；入场动效只播一次。</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2">
      <Workspace cols="300px minmax(0,1fr) 340px" left={left} center={center} right={right} />
      <div className="shrink-0 rounded-2xl bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            已搭建 <span className="text-foreground">{totalPicked}</span> 个区块
            {productBrief?.pages?.length
              ? ` · 基于 ${productBrief.pages.length} 个 AI 推荐页面`
              : ` · 来自 ${SKELETON_PAGES.length} 个通用页面骨架`}
          </span>
          {copyState === "error" && (
            <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="size-3.5" />
              全站文案改写失败，已保留原文案，可重试。
            </span>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant={copyState === "error" ? "destructive" : "outline"}
              onClick={generateSiteCopy}
              disabled={copyState === "loading"}
              title={copyState === "done" ? "文案已改写" : "AI 改写全站文案"}
            >
              {copyState === "loading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles
                  className={copyState === "done" ? "size-4 text-emerald-600" : "size-4"}
                />
              )}
            </Button>
            <Button size="sm" onClick={onAdvance}>进入交付逻辑 <ArrowRight className="size-3.5" /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
