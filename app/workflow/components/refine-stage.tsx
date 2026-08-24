"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Layout,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore, type AgentOutput } from "@/lib/store/flow-store";
import { buildPrdMdForState } from "@/lib/project-generator";
import { AGENT_PROFILES, type AgentId } from "../agents";
import { AgentAvatar, AgentStatusBadge, type AgentStatus } from "./agent-common";
import { VISUAL_STYLES } from "@/data/visual-styles";
import { TECH_STACKS } from "@/data/tech-stacks";
import { matchVisualStyles, extractPrimaryColor } from "@/lib/visual-match";
import type { ProductBrief } from "@/lib/ai-discover";
import type { IntentNarrative } from "@/lib/ai-intent";

type ViewId = "all" | "pm" | "designer" | "architect" | "guard";

interface AgentPanelState {
  status: AgentStatus;
  progress: number;
  summary: string;
  details: string[];
}

const EMPTY_AGENT_STATE: AgentPanelState = { status: "standby", progress: 0, summary: "", details: [] };

const DEFAULT_PANEL: Record<AgentId, AgentPanelState> = {
  moderator: { ...EMPTY_AGENT_STATE },
  pm: { ...EMPTY_AGENT_STATE },
  architect: { ...EMPTY_AGENT_STATE },
  designer: { ...EMPTY_AGENT_STATE },
  guard: { ...EMPTY_AGENT_STATE },
};

const WORK_AGENTS = AGENT_PROFILES.filter((a) => a.id !== "moderator");

/** 卡片/CTA 用角色短名，避免顶部 Tab 过长溢出 */
const AGENT_ROLE_LABEL: Record<AgentId, string> = {
  moderator: "老鸨子",
  pm: "产品专家",
  architect: "架构专家",
  designer: "视觉专家",
  guard: "开发规范",
};

/** 顶部 Tab：全部 + 4 位可调整专家（主持人无独立 Tab，产出并入「全部」视图的风险块） */
const VIEW_TABS: { id: ViewId; label: string }[] = [
  { id: "all", label: "全部" },
  ...WORK_AGENTS.map((a) => ({
    id: a.id as ViewId,
    label: AGENT_ROLE_LABEL[a.id],
  })),
];

function decisionLabel(id: AgentId): string {
  switch (id) {
    case "pm":
      return "页面清单";
    case "designer":
      return "视觉风格";
    case "architect":
      return "技术栈";
    case "guard":
      return "规范边界";
    default:
      return "";
  }
}

export function RefineStage({ onAdvance, onBack }: { onAdvance: () => void; onBack: () => void }) {
  const [activeView, setActiveView] = useState<ViewId>("all");
  const productBrief = useFlowStore((s) => s.productBrief);
  const techStackId = useFlowStore((s) => s.techStack);
  const visualStyleId = useFlowStore((s) => s.visualStyle);
  const intentNarrative = useFlowStore((s) => s.intentNarrative);
  const panelOutput = useFlowStore((s) => s.panelOutput);
  const setPanelOutput = useFlowStore((s) => s.setPanelOutput);
  const setVisualStyle = useFlowStore((s) => s.setVisualStyle);
  const setTechStack = useFlowStore((s) => s.setTechStack);
  const designSystem = useFlowStore((s) => s.designSystem);
  const setDesignSystem = useFlowStore((s) => s.setDesignSystem);
  const intentSession = useFlowStore((s) => s.intentSession);
  const messages = intentSession?.messages ?? [];

  // 初始复用 collab 阶段会诊结果；无则回到空态
  const [panelAgents, setPanelAgents] = useState<Record<AgentId, AgentPanelState>>(() => {
    if (!panelOutput) return DEFAULT_PANEL;
    return (Object.keys(DEFAULT_PANEL) as AgentId[]).reduce((acc, id) => {
      const o = panelOutput[id];
      acc[id] = o
        ? { status: o.status, progress: o.progress, summary: o.summary, details: o.details }
        : { ...EMPTY_AGENT_STATE };
      return acc;
    }, {} as Record<AgentId, AgentPanelState>);
  });
  const [consulting, setConsulting] = useState(false);

  const techName = TECH_STACKS.find((t) => t.id === techStackId)?.name ?? (techStackId ?? "未选择");
  const styleName = VISUAL_STYLES.find((v) => v.id === visualStyleId)?.name ?? (visualStyleId ?? "未选择");

  const runPanel = useCallback(async () => {
    setConsulting(true);
    try {
      const res = await fetch("/api/ai/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: productBrief,
          messages: messages
            .filter((m) => m.content?.trim())
            .slice(-30)
            .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content}`)
            .join("\n"),
        }),
      });
      if (!res.ok) throw new Error("会诊失败");
      const data = (await res.json()) as {
        agents?: { id: AgentId; status: string; progress: number; summary: string; details?: string[] }[];
      };
      const next: Record<AgentId, AgentPanelState> = { ...DEFAULT_PANEL };
      for (const a of data.agents ?? []) {
        next[a.id] = { status: a.status as AgentStatus, progress: a.progress, summary: a.summary, details: a.details ?? [] };
      }
      setPanelAgents(next);
      setPanelOutput(
        (Object.keys(next) as AgentId[]).reduce((acc, id) => {
          const s = next[id];
          acc[id] = { status: s.status, progress: s.progress, summary: s.summary, details: s.details };
          return acc;
        }, {} as Record<string, AgentOutput>),
      );
    } finally {
      setConsulting(false);
    }
  }, [productBrief, messages, setPanelOutput]);

  // 完善度 = 用户已拍板（选了视觉风格/技术栈即满，不再只看 AI 是否产出过）
  const completeness = useMemo(
    () => ({
      pm: productBrief?.vision ? (productBrief.pages?.length ? 100 : 60) : 0,
      designer: visualStyleId ? 100 : 0,
      architect: techStackId ? 100 : 0,
      guard: panelAgents.guard?.details?.length ? 100 : 0,
    }),
    [productBrief, visualStyleId, techStackId, panelAgents],
  );

  const overallProgress = useMemo(() => {
    const vals = Object.values(completeness);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [completeness]);

  // 会诊期间：全部视图专家卡显示正在思考
  const displayAgents = useMemo<Record<AgentId, AgentPanelState>>(() => {
    if (!consulting) return panelAgents;
    return (Object.keys(panelAgents) as AgentId[]).reduce((acc, id) => {
      acc[id] = { ...panelAgents[id], status: "thinking" };
      return acc;
    }, {} as Record<AgentId, AgentPanelState>);
  }, [consulting, panelAgents]);

  // 进入引导：缺口驱动的待完善项（缺什么 → 去哪调）
  const needs = useMemo(() => {
    const list: { label: string; view: ViewId }[] = [];
    if (!productBrief?.vision) list.push({ label: "缺产品愿景", view: "pm" });
    if (!visualStyleId) list.push({ label: "未选视觉风格", view: "designer" });
    if (!techStackId) list.push({ label: "未选技术栈", view: "architect" });
    if (!panelAgents.guard?.details?.length) list.push({ label: "开发规范待产出", view: "guard" });
    return list;
  }, [productBrief, visualStyleId, techStackId, panelAgents]);

  // 对话产出的设计系统（extra.visualSpec）→ 匹配相近预设风格，供视觉专家「AI 对话推荐」
  const recommendedStyles = useMemo(() => {
    const spec = productBrief?.extra?.visualSpec;
    return matchVisualStyles(typeof spec === "string" ? spec : undefined);
  }, [productBrief]);

  // 对话里的主色 hex（一键套用入口），无则 null
  const specPrimary = useMemo(() => {
    const spec = productBrief?.extra?.visualSpec;
    return extractPrimaryColor(typeof spec === "string" ? spec : null);
  }, [productBrief]);

  const renderView = () => {
    switch (activeView) {
      case "pm":
        return <PrdView />;
      case "designer":
        return (
          <VisualView
            styleId={visualStyleId}
            styleName={styleName}
            onPick={(id) => setVisualStyle(id)}
            panelAgents={panelAgents}
            recommendedIds={recommendedStyles}
            specPrimary={specPrimary}
            appliedPrimary={designSystem?.colorPrimary ?? null}
            onApplyPrimary={(hex) => setDesignSystem({ colorPrimary: hex })}
          />
        );
      case "architect":
        return (
          <TechView
            stackId={techStackId}
            stackName={techName}
            onPick={(id) => setTechStack(id)}
            panelAgents={panelAgents}
          />
        );
      case "guard":
        return <GuardView panelAgents={panelAgents} />;
      default:
        return (
          <AllView
            panelAgents={displayAgents}
            completeness={completeness}
            overallProgress={overallProgress}
            onGoto={(id) => setActiveView(id)}
            onConsult={() => void runPanel()}
            consulting={consulting}
            productBrief={productBrief}
          />
        );
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* 顶部专家 Tab 条 */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border/30 pb-1">
        {VIEW_TABS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setActiveView(v.id)}
            className={[
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition",
              activeView === v.id ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted",
            ].join(" ")}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* 进入引导：缺口驱动，告诉用户从哪开始调 */}
      <GuideBar needs={needs} onGoto={(v) => setActiveView(v)} />

      {/* 内容区：单栏工作区，独立滚动 */}
      <div className="min-h-0 flex-1 overflow-y-auto">{renderView()}</div>

      {/* 底部操作条 */}
      <div className="shrink-0 rounded-2xl bg-muted/30 px-4 py-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Layout className="size-4 shrink-0" />
            <span className="whitespace-nowrap">方案完善度 {overallProgress}%</span>
            {overallProgress >= 80 && (
              <span className="whitespace-nowrap text-emerald-600">已达到可搭建水平</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={onBack}>
              返回协同
            </Button>
            <Button
              size="sm"
              className="gap-2"
              onClick={onAdvance}
              disabled={overallProgress < 80}
              title={
                overallProgress < 80
                  ? `还有 ${needs.length} 项待完善，完善度达 80% 后可进入页面搭建`
                  : undefined
              }
            >
              进入页面搭建
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 进入引导条：有缺口 → 逐个去调；都就绪 → 提示可微调                */

function GuideBar({
  needs,
  onGoto,
}: {
  needs: { label: string; view: ViewId }[];
  onGoto: (v: ViewId) => void;
}) {
  if (needs.length) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-amber-500/10 px-3 py-2">
        <AlertTriangle className="size-4 shrink-0 text-amber-600" />
        <span className="text-xs text-amber-700">还有 {needs.length} 项待完善：</span>
        {needs.map((n) => (
          <button
            key={n.view}
            type="button"
            onClick={() => onGoto(n.view)}
            className="rounded-full border border-amber-600/30 bg-background px-2.5 py-0.5 text-[11px] text-amber-700 transition hover:bg-amber-500/10"
          >
            {n.label} → 去调整
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
      <CheckCircle2 className="size-4 shrink-0 text-primary" />
      <span className="text-xs text-muted-foreground">
        方案初稿已就绪。点任意专家进去微调——特别是视觉风格与技术栈，换成你的偏好完全正常。
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 「全部」视图：4 位专家总览 + 风险待办                              */

function AllView({
  panelAgents,
  completeness,
  overallProgress,
  onGoto,
  onConsult,
  consulting,
  productBrief,
}: {
  panelAgents: Record<AgentId, AgentPanelState>;
  completeness: Record<"pm" | "designer" | "architect" | "guard", number>;
  overallProgress: number;
  onGoto: (id: ViewId) => void;
  onConsult: () => void;
  consulting: boolean;
  productBrief: ProductBrief | null;
}) {
  return (
    <div className="space-y-4 p-4">
      {!WORK_AGENTS.some((a) => (panelAgents[a.id]?.progress ?? 0) > 0) && (
        <p className="rounded-xl border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
          四位专家尚未产出：点下方「重新会诊」一键唤醒，或进入某位专家查看职责与缺口。
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {WORK_AGENTS.map((a) => {
          const st = panelAgents[a.id];
          const pct = completeness[a.id as "pm" | "designer" | "architect" | "guard"];
          const hasOutput = (st?.progress ?? 0) > 0 || (st?.details?.length ?? 0) > 0;
          const working = st?.status === "thinking" || st?.status === "producing";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onGoto(a.id as ViewId)}
              className="flex flex-col rounded-xl bg-muted/30 p-3 text-left transition hover:bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <AgentAvatar role={a.id} className="size-9 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{a.specialty}</p>
                </div>
                <AgentStatusBadge status={st?.status ?? "standby"} />
              </div>
              <p className="mt-2 line-clamp-2 min-h-[2.5em] text-xs leading-snug text-muted-foreground">
                {st?.summary || (working ? "正在整理…" : "")}
              </p>
              <div className="mt-auto flex items-center justify-between pt-2 text-[11px] text-muted-foreground">
                <span>{decisionLabel(a.id)}</span>
                {pct === 100 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600">
                    <CheckCircle2 className="size-3" /> 已定
                  </span>
                ) : hasOutput ? (
                  <span className="text-amber-600">{pct}%</span>
                ) : working ? (
                  <span className="text-muted-foreground">待产出</span>
                ) : (
                  <span className="text-muted-foreground">待会诊</span>
                )}
              </div>
              {hasOutput ? (
                <p className="mt-1 text-right text-[11px] font-medium text-primary">进入微调 →</p>
              ) : (
                <p className="mt-1 text-right text-[11px] text-muted-foreground/60">
                  {working ? "生成中…" : "待会诊"}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* 风险与待办：规划师-丽颖（会诊汇总）产出 */}
      <div className="rounded-xl bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <AlertTriangle className="size-4 text-amber-600" />
          风险与待办
        </p>
        {panelAgents.moderator?.details?.length ? (
          <ul className="mt-2 space-y-1.5">
            {panelAgents.moderator.details.map((d, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-500" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            暂无风险提示，可重新会诊让规划师-丽颖再审视一遍。
          </p>
        )}
        {overallProgress < 100 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
            {!productBrief?.vision && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">缺产品愿景</span>}
            {!productBrief?.pages?.length && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">缺页面清单</span>}
            {!panelAgents.guard?.details?.length && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700">开发规范待确认</span>}
          </div>
        )}
      </div>

      <Button size="sm" variant="outline" className="gap-2" onClick={onConsult} disabled={consulting}>
        {consulting ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {consulting ? "专家会诊中…" : "重新会诊"}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 产品专家-亦菲：PRD 全文（与交付包 docs/PRD.md 完全一致）            */

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground/70">{text}</p>;
}

/* 轻量 Markdown 渲染：只覆盖 PRD 生成用的结构（标题/表格/列表/引用/代码块/粗体）。
   其余结构兜底为等宽文本块，保证任何内容都能无损展示。 */
function PrdRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        <pre key={i} className="my-2 overflow-x-auto rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
          {buf.join("\n")}
        </pre>,
      );
      continue;
    }
    if (/^#### /.test(line)) {
      out.push(<h4 key={i} className="mt-3 mb-1 text-base font-bold text-foreground">{line.replace(/^#### /, "")}</h4>);
      i++;
      continue;
    }
    if (/^### /.test(line)) {
      out.push(<h3 key={i} className="mt-4 mb-1.5 text-lg font-bold text-foreground">{line.replace(/^### /, "")}</h3>);
      i++;
      continue;
    }
    if (/^## /.test(line)) {
      out.push(<h2 key={i} className="mt-5 mb-2 border-b border-border/40 pb-1 text-xl font-bold text-foreground">{line.replace(/^## /, "")}</h2>);
      i++;
      continue;
    }
    if (/^# /.test(line)) {
      out.push(<h1 key={i} className="mb-2 text-2xl font-bold text-foreground">{line.replace(/^# /, "")}</h1>);
      i++;
      continue;
    }
    if (line.startsWith("|") && i + 1 < lines.length && /^(\|[\s:-]*)+\|?$/.test(lines[i + 1])) {
      const header = line
        .split("|")
        .filter((c) => c.trim())
        .map((c) => inline(c));
      let j = i + 2;
      const rows: React.ReactNode[] = [];
      while (j < lines.length && lines[j].startsWith("|")) {
        rows.push(
          <tr key={j}>
            {lines[j]
              .split("|")
              .filter((c) => c.trim() !== undefined)
              .map((c, ci) => (ci < header.length ? <td key={ci}>{inline(c.trim())}</td> : null))}
          </tr>,
        );
        j++;
      }
      out.push(
        <table key={i} className="my-2 w-full border-collapse overflow-hidden rounded-lg border border-border/60 text-xs">
          <thead>
            <tr>{header.map((h, hi) => <th key={hi} className="border-b border-border/60 bg-muted/40 px-2 py-1.5 text-left font-medium text-foreground">{h}</th>)}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>,
      );
      i = j;
      continue;
    }
    if (line.trim() === "") {
      out.push(<div key={i} className="h-2" />);
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      out.push(<p key={i} className="my-1 border-l-2 border-primary/30 pl-2 text-xs italic leading-relaxed text-muted-foreground">{inline(line.replace(/^>\s?/, ""))}</p>);
      i++;
      continue;
    }
    if (/^\s*[-•] /.test(line)) {
      const indent = line.match(/^\s*/)![0].length;
      out.push(
        <div key={i} style={{ paddingLeft: indent * 8 }} className="flex gap-1.5 py-0.5 text-[13px] leading-relaxed text-foreground">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-primary/50" />
          <span className="min-w-0">{inline(line.replace(/^\s*[-•] /, ""))}</span>
        </div>,
      );
      i++;
      continue;
    }
    out.push(<p key={i} className="py-0.5 text-[13px] leading-relaxed text-foreground">{inline(line)}</p>);
    i++;
  }
  return <div className="space-y-0.5">{out}</div>;
}

/* 行内解析：粗体 / 行内代码，最小程度地还原可读性 */
function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((seg, idx) => {
    if (seg.startsWith("**") && seg.endsWith("**"))
      return <strong key={idx} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
    if (seg.startsWith("`") && seg.endsWith("`"))
      return <code key={idx} className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.9em] text-primary">{seg.slice(1, -1)}</code>;
    return seg;
  });
}

function PrdView() {
  const state = useFlowStore();
  const [copiedPrd, setCopiedPrd] = useState(false);
  const hasContent = Boolean(
    state.intentNarrative ||
      state.productBrief?.vision ||
      state.projectType ||
      state.pageBlueprint.length,
  );
  const prd = useMemo(() => (hasContent ? buildPrdMdForState(state) : ""), [state, hasContent]);

  if (!hasContent)
    return (
      <div className="p-4">
        <Empty text="暂无产品定义，请返回协同工作台与专家聊清楚需求后，这里会生成可交付开发的 PRD。" />
      </div>
    );

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">产品需求文档（PRD）</p>
          <p className="text-[11px] text-muted-foreground">
            与交付包 <code className="rounded bg-muted/60 px-1 font-mono text-[10px]">docs/PRD.md</code> 完全一致，AI 开发据此实现
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              void navigator.clipboard?.writeText(prd);
              setCopiedPrd(true);
              setTimeout(() => setCopiedPrd(false), 1500);
            }}
          >
            {copiedPrd ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copiedPrd ? "已复制" : "复制 PRD"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => {
              const blob = new Blob([prd], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "PRD.md";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-3.5" /> 下载 .md
          </Button>
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-background/40 p-4">
        <PrdRenderer text={prd} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 视觉专家-冰冰：视觉风格选择器                                       */

function VisualView({
  styleId,
  styleName,
  onPick,
  panelAgents,
  recommendedIds,
  specPrimary,
  appliedPrimary,
  onApplyPrimary,
}: {
  styleId: string | null;
  styleName: string;
  onPick: (id: string) => void;
  panelAgents: Record<AgentId, AgentPanelState>;
  recommendedIds: string[];
  specPrimary: string | null;
  appliedPrimary: string | null;
  onApplyPrimary: (hex: string) => void;
}) {
  const applied = specPrimary !== null && appliedPrimary?.toLowerCase() === specPrimary;
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-medium">当前视觉风格：<span className="text-primary">{styleName}</span></h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          视觉专家-冰冰 给出了推荐，但你可以换——点选即切换，会带入页面搭建与交付工程包。
        </p>
        {recommendedIds.length > 0 && (
          <p className="mt-1.5 text-xs text-amber-700">
            对话里聊过的设计偏好已匹配为「AI 对话推荐」，点选即可把对话方案落进视觉规范。
          </p>
        )}
      </div>
      {specPrimary !== null && (
        <div
          className={[
            "flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3",
            applied ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-5 shrink-0 rounded-md border border-border/60" style={{ background: specPrimary }} />
            <div className="min-w-0">
              <p className="text-sm font-medium">对话主色 <span className="font-mono text-primary">{specPrimary}</span></p>
              <p className="truncate text-[11px] text-muted-foreground">
                {applied
                  ? "已套用为当前视觉风格的主色 token（DESIGN_SPEC / globals.css 会用它生成）"
                  : "对话里聊出的主色，一键套用到当前风格——选一个风格后点击生效，token 仍保持单一真值。"}
              </p>
            </div>
          </div>
          {!applied && (
            <Button size="sm" variant={styleId ? "default" : "outline"} disabled={!styleId} onClick={() => onApplyPrimary(specPrimary)}>
              一键套用
            </Button>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {VISUAL_STYLES.map((s) => {
          const active = s.id === styleId;
          const recommended = !active && recommendedIds.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onPick(s.id)}
              className={[
                "rounded-xl p-3 text-left transition",
                active
                  ? "bg-primary/10 ring-1 ring-primary/25"
                  : recommended
                    ? "bg-amber-500/10 ring-1 ring-amber-500/30 hover:bg-amber-500/15"
                    : "bg-muted/30 hover:bg-muted/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {[s.palette.accent, s.palette.accent2, s.palette.text, s.palette.bg].map((c, i) => (
                    <span key={i} className="size-3 rounded-full border border-border/60" style={{ background: c }} />
                  ))}
                </div>
                {active ? (
                  <span className="text-[11px] font-medium text-primary">当前</span>
                ) : recommended ? (
                  <span className="text-[11px] font-medium text-amber-700">AI 对话推荐</span>
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium">{s.name}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{s.description}</p>
            </button>
          );
        })}
      </div>
      {panelAgents.designer?.details?.length ? (
        <div className="rounded-xl bg-muted/30 p-3">
          <p className="text-sm font-medium">视觉专家-冰冰 会诊建议</p>
          <ul className="mt-2 space-y-1.5">
            {panelAgents.designer.details.map((d, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 架构专家-热巴：技术栈选择器                                         */

const LEARNING_LABEL: Record<string, string> = { low: "低", medium: "中", high: "高" };
const LEARNING_COLOR: Record<string, string> = {
  low: "text-emerald-600",
  medium: "text-amber-600",
  high: "text-red-600",
};

function TechView({
  stackId,
  stackName,
  onPick,
  panelAgents,
}: {
  stackId: string | null;
  stackName: string;
  onPick: (id: string) => void;
  panelAgents: Record<AgentId, AgentPanelState>;
}) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="text-sm font-medium">当前技术栈：<span className="text-primary">{stackName}</span></h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          架构专家-热巴 给出了推荐，但你可以换——点选即切换，会带入页面搭建与交付工程包。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {TECH_STACKS.map((t) => {
          const active = t.id === stackId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              className={[
                "rounded-xl p-3 text-left transition",
                active ? "bg-primary/10 ring-1 ring-primary/25" : "bg-muted/30 hover:bg-muted/50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{t.name}</p>
                {active && <span className="text-[11px] font-medium text-primary">当前</span>}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.frontend} · {t.backend} · {t.database}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>月成本 <span className="font-medium text-foreground">{t.estimatedCost}</span></span>
                <span>周期 <span className="font-medium text-foreground">{t.devDuration}</span></span>
                <span>
                  门槛
                  <span className={["font-medium", LEARNING_COLOR[t.learningCurve]].join(" ")}>
                    {LEARNING_LABEL[t.learningCurve]}
                  </span>
                </span>
              </div>
              {t.suitableFor && <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">{t.suitableFor}</p>}
            </button>
          );
        })}
      </div>
      {panelAgents.architect?.details?.length ? (
        <div className="rounded-xl bg-muted/30 p-3">
          <p className="text-sm font-medium">架构专家-热巴 会诊建议</p>
          <ul className="mt-2 space-y-1.5">
            {panelAgents.architect.details.map((d, i) => (
              <li key={i} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 开发规范-苍老师：AI 编程边界规范                                    */

function GuardView({ panelAgents }: { panelAgents: Record<AgentId, AgentPanelState> }) {
  const details = panelAgents.guard?.details ?? [];
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldCheck className="size-4 text-primary" />
          开发边界规范
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          开发规范-苍老师 定义未来 AI 编程时不漂移的边界，最终会写入交付工程包（AGENTS / CLAUDE / 设计规范 / 验收脚本）。
        </p>
      </div>
      {details.length ? (
        <ul className="space-y-2">
          {details.map((d, i) => (
            <li key={i} className="flex gap-2 rounded-xl bg-muted/30 p-3 text-sm leading-relaxed text-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty text="点击「全部」视图中的重新会诊，让开发规范-苍老师产出边界规范。" />
      )}
    </div>
  );
}
