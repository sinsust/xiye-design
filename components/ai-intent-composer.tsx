"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  RotateCcw,
  Check,
  Blocks,
  Palette,
  Server,
  Wrench,
  Layers,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useFlowStore } from "@/lib/store/flow-store";
import {
  interpretIntentSmart,
  applyIntentRecommendation,
  type IntentRecommendation,
} from "@/lib/ai-intent";
import { VISUAL_STYLE_MAP } from "@/data/visual-styles";

const SAMPLES = [
  "我想做一个销售 CRM 工作台，帮团队管理线索和商机",
  "做一个电商官网，展示商品、支持下单，最好能个性化推荐",
  "AI 原生对话应用，带知识库问答和数据分析",
  "企业内部的客服工作台，含审批流和工单",
  "一款开发者工具的文档站，配定价和落地页",
];

const THINKING_STEPS = [
  "解构你的想法…",
  "匹配项目类型与 AI 能力…",
  "定技术选型与视觉风格…",
  "编排页面蓝图…",
];

export function AiIntentComposer({
  onApplied,
  defaultValue = "",
  autoAnalyze = false,
}: {
  onApplied?: () => void;
  defaultValue?: string;
  autoAnalyze?: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState(defaultValue);
  const [phase, setPhase] = useState<"idle" | "thinking" | "done">("idle");
  const [rec, setRec] = useState<IntentRecommendation | null>(null);
  const [source, setSource] = useState<"ai" | "heuristic">("heuristic");
  const timers = useRef<number[]>([]);
  const autoTriggered = useRef(false);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    if (autoAnalyze && defaultValue.trim() && !autoTriggered.current && phase === "idle") {
      autoTriggered.current = true;
      analyze(defaultValue.trim());
    }
  }, [autoAnalyze, defaultValue]);

  const analyze = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("thinking");
    THINKING_STEPS.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setThinkingIndex(i);
        }, i * 420),
      );
    });
    // 优先走服务端真实 LLM，失败自动回退启发式
    const result = await interpretIntentSmart(t);
    if (result.source === "heuristic") {
      // 在线不可用时补一点推导节奏，保持时间线感知完整
      await new Promise((r) => window.setTimeout(r, 420));
    }
    timers.current.forEach(clearTimeout);
    setSource(result.source);
    setRec(result.rec);
    setThinkingIndex(0);
    setPhase("done");
  };

  const [thinkingIndex, setThinkingIndex] = useState(0);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setPhase("idle");
    setRec(null);
    setInput("");
  };

  const apply = () => {
    if (!rec) return;
    applyIntentRecommendation(rec, useFlowStore.getState());
    onApplied?.();
  };

  // 一键应用后直达骨架工作台，AI 选定的页面/区块/变体已回填可见
  const applyOpenBuilder = () => {
    apply();
    const st = useFlowStore.getState();
    st.setBuilderReturnStep(st.currentStep);
    router.push("/builder");
  };

  const styleSwatches = rec?.visualStyle
    ? VISUAL_STYLE_MAP[rec.visualStyle.id]?.palette
    : null;

  if (phase === "thinking") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-6 rounded-2xl border border-border bg-card p-10 text-center">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-2 animate-pulse rounded-full bg-primary/10" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Loader2 className="size-5 animate-spin" />
          </span>
        </div>
        <div className="w-full max-w-xs space-y-3">
          {THINKING_STEPS.map((step, i) => {
            const done = i < thinkingIndex;
            const current = i === thinkingIndex;
            return (
              <div key={step} className="flex items-center gap-3 text-sm">
                <span
                  className={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                    done && "bg-primary text-primary-foreground",
                    current && "relative bg-primary/10 text-primary",
                    !done && !current && "border border-border bg-background text-muted-foreground",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {done ? <Check className="size-3" /> : current ? <span className="relative flex h-2 w-2 rounded-full bg-primary" /> : i + 1}
                </span>
                <span className={current ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted-foreground"}>
                  {step}
                </span>
                {current && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (phase === "done" && rec) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* 结果条 */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">AI 最佳组合已就绪</span>
          <span
            className={
              source === "ai"
                ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {source === "ai" ? "真实 AI" : "本地启发式"}
          </span>
          {!rec.matched && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              类型未精确定位，已按工作台推断
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" /> 重新输入
            </Button>
            <Button size="sm" onClick={apply}>
              <Check className="size-3.5" /> 一键应用
            </Button>
          </div>
        </div>

        {/* 选型一览：单一容器 + 内部分割线，避免卡片套卡片 */}
        <div className="border-t border-border">
          <p className="px-4 pt-3 text-sm text-muted-foreground">{rec.summary}</p>
          <div className="flex items-start gap-2 border-t border-border px-4 py-2.5">
            <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{rec.narrative.vision}</span>
              <br />
              <span className="text-muted-foreground">{rec.narrative.marketFit}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground/70">
                以上将写入 docs/PRD.md（愿景 / 定位 / 目标用户 / 核心功能 / 市场契合）。
              </span>
            </p>
          </div>
          <div className="mt-3 divide-y divide-border">
            {[
              { icon: Wrench, label: "项目类型", value: rec.projectType.name },
              { icon: Server, label: "技术栈", value: rec.techStack?.name ?? "默认" },
              {
                icon: Palette,
                label: "视觉风格",
                value: rec.visualStyle?.name ?? "默认",
                swatches: styleSwatches,
              },
              { icon: Layers, label: "UI 组件库", value: rec.uiLibrary?.main ?? "shadcn/ui" },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <row.icon className="size-4" />
                </span>
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <span className="ml-auto flex min-w-0 items-center justify-end gap-1.5">
                  <span className="truncate text-sm font-semibold text-foreground">{row.value}</span>
                  {row.swatches && (
                    <span className="flex shrink-0 gap-1">
                      {[row.swatches.bg, row.swatches.accent, row.swatches.accent2, row.swatches.text].map((c, i) => (
                        <span key={i} className="size-3 rounded-full border border-black/10" style={{ background: c }} />
                      ))}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* 蓝图：单个容器 + 页面间分割线 */}
          <div className="border-t border-border px-4 py-3">
            <div className="mb-3 flex items-center gap-2">
              <Blocks className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">推荐页面骨架</span>
              <span className="text-xs text-muted-foreground">
                {rec.pagesCount} 页 · {rec.componentsCount} 区块
              </span>
            </div>
            <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {rec.blueprint.map((page) => (
                <div key={page.pageSlug} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <span className="text-sm font-medium text-foreground">{page.pageName}</span>
                  <span className="ml-auto flex flex-wrap justify-end gap-1">
                    {page.components.map((c) => (
                      <span key={c.componentId} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {c.componentName}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-border px-4 py-3">
          <Button variant="outline" className="flex-1" size="sm" onClick={apply}>
            应用并继续流程
          </Button>
          <Button className="flex-1" size="sm" onClick={applyOpenBuilder}>
            回填到页面搭建工作台 <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // idle：主输入，单个表层卡片，不再套内层标题卡
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze(input);
          }}
          rows={4}
          placeholder="描述你想做的东西，例如：想做一个销售 CRM 工作台，帮团队管线索和商机，带数据看板…"
          className="w-full resize-none bg-transparent px-4 py-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground"
        />
        <div className="pointer-events-none absolute bottom-4 right-4 text-xs text-muted-foreground">
          ⌘/Ctrl + ↵ 提交
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3">
        <div className="flex max-w-full flex-wrap gap-1.5">
          {SAMPLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setInput(s)}
              className="max-w-full truncate rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => analyze(input)} disabled={!input.trim()}>
          让 AI 解构 <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}