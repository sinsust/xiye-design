"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  FlaskConical,
  LoaderCircle,
  PencilLine,
  Undo2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChatStream } from "./chat-stream";
import { type AgentId } from "../agents";
import { personaPayload, useAgent, useAgentList } from "../agents-store";
import {
  AgentAvatar,
  AgentStatusBadge,
  AvatarZoom,
  type AgentState,
  type AgentStatus,
} from "./agent-common";
import { useFlowStore, type AgentOutput } from "@/lib/store/flow-store";
import {
  acceptConceptPlan,
  continueConceptWithAssumptions,
  getConceptReadiness,
} from "@/lib/flow-concept";
import { ConceptBlueprintBar } from "./concept-blueprint-bar";
import { syncConcept } from "./concept-sync";
import {
  fetchBlueprint,
  initBlueprint,
  updateBlueprintPath,
  resolveBlueprintItem,
  confirmBlueprintItem,
  rebuildBlueprintItem,
  restoreBlueprintItem,
  type BlueprintSyncResult,
} from "./blueprint-sync";
import { getBlueprintReadiness, conceptChangedSinceBlueprint } from "@/lib/flow-blueprint";
import { JourneyPanel } from "./journey-panel";
import {
  initJourneyItem,
  updateJourneyPath,
  resolveJourneyItem,
  answerJourneyItem,
  confirmJourneyItem,
  rebuildJourneyItem,
  restoreJourneyItem,
  type JourneySyncResult,
} from "./journey-sync";
import {
  getJourneyReadiness,
  blueprintChangedSinceJourney,
  type JourneyAcceptance,
} from "@/lib/flow-journey";
import { ScreenMapPanel } from "./screen-map-panel";
import {
  initScreenMapItem,
  updateScreenMapPath,
  resolveScreenMapItem,
  answerScreenMapItem,
  confirmScreenMapItem,
  rebuildScreenMapItem,
  restoreScreenMapItem,
  type ScreenMapSyncResult,
} from "./screen-map-sync";
import {
  canInitScreenMap,
  screenMapChangedSince,
  type ScreenMapAcceptance,
} from "@/lib/flow-screen-map";
import {
  canInitScreenSpec,
  screenSpecChangedSince,
  type ScreenSpecAcceptance,
} from "@/lib/flow-screen-spec";
import {
  initScreenSpecItem,
  fetchScreenSpec,
  updateScreenSpecPath,
  deferScreenSpecItem,
  answerScreenSpecItem,
  confirmScreenSpecItem,
  rebuildScreenSpecItem,
  restoreScreenSpecItem,
  type ScreenSpecSyncResult,
} from "./screen-spec-sync";
import { ScreenSpecPanel } from "./screen-spec-panel";
import {
  initPrototypeItem,
  fetchPrototype,
  updatePrototypePath,
  addPrototypeFeedbackItem,
  confirmPrototypeItem,
  rebuildPrototypeItem,
  restorePrototypeItem,
  type PrototypeSyncResult,
} from "./prototype-sync";
import {
  getPrototypeReadiness,
  type PrototypeReadiness,
  type PrototypeAcceptance,
} from "@/lib/flow-prototype";
import { PrototypePanel, type PrototypeFeedbackInput } from "./prototype-panel";
import { TECH_STACKS } from "@/data/tech-stacks";
import { VISUAL_STYLES } from "@/data/visual-styles";
import { type DiscoverMessage, type ProductBrief } from "@/lib/ai-discover";
import {
  extractFlowError,
  flowError,
  flowErrorUserMessage,
  newRequestId,
  type FlowAIError,
} from "@/lib/flow-ai-types";

/* ------------------------------------------------------------------ */
/* 状态推导：基于对话深度 + 会诊结果，给出合理的专家状态 */

function deriveAgentStates(
  messages: DiscoverMessage[],
  productBrief: ProductBrief | null,
  consulting: boolean,
  panel?: Record<AgentId, AgentState>,
): Record<AgentId, AgentState> {
  const empty: Record<AgentId, AgentState> = {
    moderator: { status: "standby", progress: 0, summary: "等待访谈开始，老鸨子会先陪你聊清楚需求。", details: [] },
    pm: { status: "standby", progress: 0, summary: "等待产品定义素材。", details: [] },
    architect: { status: "standby", progress: 0, summary: "等待技术需求明确。", details: [] },
    designer: { status: "standby", progress: 0, summary: "等待风格方向输入。", details: [] },
    guard: { status: "standby", progress: 0, summary: "等待开发边界规范输入。", details: [] },
  };

  if (messages.length === 0) return empty;

  if (panel) {
    if (consulting) {
      return (Object.keys(panel) as AgentId[]).reduce((acc, id) => {
        const s = panel[id];
        acc[id] = {
          ...s,
          status: s.progress >= 95 ? "done" : s.status === "done" ? "producing" : s.status,
        };
        return acc;
      }, {} as Record<AgentId, AgentState>);
    }
    return panel;
  }

  const depth = Math.min(messages.length * 10, 40);
  return {
    moderator: { status: "producing", progress: depth, summary: "正在陪你梳理想法、提取关键信息。", details: [] },
    pm: {
      status: messages.length >= 2 ? "thinking" : "standby",
      progress: Math.max(0, depth - 8),
      summary: messages.length >= 2 ? "尝试从对话中提取产品定位。" : "等待更多产品信息。",
      details: [],
    },
    architect: {
      status: messages.length >= 3 ? "thinking" : "standby",
      progress: Math.max(0, depth - 16),
      summary: messages.length >= 3 ? "开始根据需求轮廓思考技术方案。" : "等待功能范围明确。",
      details: [],
    },
    designer: {
      status: messages.length >= 3 ? "thinking" : "standby",
      progress: Math.max(0, depth - 22),
      summary: messages.length >= 3 ? "从描述中提取可能的视觉倾向。" : "等待风格线索。",
      details: [],
    },
    guard: {
      status: messages.length >= 3 ? "thinking" : "standby",
      progress: Math.max(0, depth - 28),
      summary: messages.length >= 3 ? "开始构思冷启动与获客路径。" : "等待用户与场景明确。",
      details: [],
    },
  };
}

/* ------------------------------------------------------------------ */
/* 后宫智囊团：逐一完成 · 卖力抖动 · 完成气泡                          */
/* 会诊是「伪装」的：后端一次性返回，前端把同一批结果排成逐一完成的节奏。 */

/** 每组首次出现 −0.4s 交给协调员，其余按 pm→architect→designer→guard 排队完成 */
const PANEL_ORDER: AgentId[] = ["pm", "architect", "designer", "guard", "moderator"];

/** 每位成员完成时的宠溺称呼与专属交卷文案（互不重复，贴合各自职责） */
const BUBBLE_TEXTS: Record<AgentId, string> = {
  pm: "亲爱的，需求我帮你捋顺啦",
  architect: "老公，技术方案我拍板好了",
  designer: "宝贝，这套视觉基调准没错",
  guard: "哈尼，开发规范我给备齐啦",
  moderator: "爷，姐妹们都交卷了，我这就来汇总",
};

/** 每位成员「开工偏移 + 产出耗时」，错开起跳 → 逐人落袋 */
const STAGGER: Record<AgentId, { start: number; dur: number }> = {
  pm: { start: 0, dur: 2500 },
  architect: { start: 700, dur: 2500 },
  designer: { start: 1400, dur: 2500 },
  guard: { start: 2100, dur: 2500 },
  moderator: { start: 2900, dur: 2400 },
};

function emptyProgress(): Record<AgentId, number> {
  return { pm: 0, architect: 0, designer: 0, guard: 0, moderator: 0 };
}

/** 完成气泡：出现 → 停顿 → 消失，由父容器在逾时后卸载 */
function WorkBubble({ text }: { text: string }) {
  return (
    <span
      className="xiye-bubble pointer-events-none absolute bottom-[calc(100%+4px)] left-1/2 z-20 whitespace-nowrap rounded-lg border border-primary/30 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm"
    >
      {text}
    </span>
  );
}

/**
 * 会诊期间的「逐一完成」动画：consulting 升沿触发一次完整错峰演出；
 * 演出未结束前展示动画进度，结束后保持全员已完成，等真实结果回来后切换为真实状态。
 */
function usePanelStagger(
  consulting: boolean,
  span: number,
  baseAgents: Record<AgentId, AgentState>,
): {
  displayAgents: Record<AgentId, AgentState>;
  bubbles: Partial<Record<AgentId, boolean>>;
} {
  const [runId, setRunId] = useState(0);
  const prevConsulting = useRef(consulting);
  const playedSpanRef = useRef(0);
  const [progress, setProgress] = useState<Record<AgentId, number>>(emptyProgress());
  const [bubbles, setBubbles] = useState<Partial<Record<AgentId, boolean>>>({});
  const sawRun = runId > 0;
  const timeoutsRef = useRef<number[]>([]);

  // 只有当「新一轮会诊」且「消息份额确实变大」时才播一次错峰演出；
  // 同一次内容的重渲染/重复会诊不会重播，避免「完成又重新生成」
  useEffect(() => {
    if (consulting && !prevConsulting.current && span !== playedSpanRef.current) {
      playedSpanRef.current = span;
      setRunId((i) => i + 1);
    }
    prevConsulting.current = consulting;
  }, [consulting, span]);

  useEffect(() => {
    if (runId === 0) {
      setProgress(emptyProgress());
      setBubbles({});
      return;
    }
    setProgress(emptyProgress());
    setBubbles({});
    const start = Date.now();
    const firing = new Set<AgentId>();
    const interval = window.setInterval(() => {
      const el = Date.now() - start;
      const nextP = emptyProgress();
      let allDone = true;
      for (const id of PANEL_ORDER) {
        const s = STAGGER[id];
        const p = el < s.start ? 0 : Math.min(100, Math.round(((el - s.start) / s.dur) * 100));
        nextP[id] = p;
        if (p < 100) allDone = false;
        if (p >= 100 && !firing.has(id)) {
          firing.add(id);
          setBubbles((b) => ({ ...b, [id]: true }));
          timeoutsRef.current.push(
            window.setTimeout(() => setBubbles((b) => ({ ...b, [id]: false })), 2500),
          );
        }
      }
      setProgress(nextP);
      if (allDone) {
        window.clearInterval(interval);
      }
    }, 70);
    return () => {
      window.clearInterval(interval);
      timeoutsRef.current.forEach((t) => window.clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [runId]);

  const displayAgents: Record<AgentId, AgentState> = useMemo(() => {
    if (!consulting || !sawRun) return baseAgents;
    return PANEL_ORDER.reduce((acc, id) => {
      const b = baseAgents[id];
      const p = progress[id] ?? b.progress;
      const st: AgentStatus = p >= 100 ? "done" : p < 45 ? "thinking" : "producing";
      acc[id] = { ...b, progress: p, status: st };
      return acc;
    }, {} as Record<AgentId, AgentState>);
  }, [consulting, sawRun, progress, baseAgents]);

  return { displayAgents, bubbles };
}

/* ------------------------------------------------------------------ */
/* 右栏 · 顶部专家状态条（融合原专家面板） */

function ExpertStrip({
  agents,
  active,
  onSelect,
  bubbles,
}: {
  agents: Record<AgentId, AgentState>;
  active: AgentId;
  onSelect: (id: AgentId) => void;
  bubbles?: Partial<Record<AgentId, boolean>>;
}) {
  const busy = (st: AgentStatus) => st === "thinking" || st === "producing";
  const ags = useAgentList();
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(76px,1fr))] gap-2 border-b border-border/70 pb-3">
      {ags.map((a) => {
        const s = agents[a.id];
        const isActive = a.id === active;
        const working = busy(s.status);
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className={[
              "flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 transition",
              isActive
                ? "border-primary bg-primary/10"
                : "border-border/70 bg-background hover:border-primary/50",
            ].join(" ")}
          >
            <div className="relative flex size-7 items-center justify-center">
              {bubbles?.[a.id] && <WorkBubble text={BUBBLE_TEXTS[a.id]} />}
              {working && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
              )}
              <div className={working ? "xiye-work-shake" : "relative"}>
                <AgentAvatar role={a.id} className="relative size-7" />
              </div>
            </div>
            <p className="max-w-full truncate text-[11px] font-medium text-foreground">{a.name}</p>
            <AgentStatusBadge status={s.status} />
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={["h-full rounded-full bg-primary transition-all", working ? "animate-pulse" : ""].join(" ")}
                style={{ width: `${s.progress}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 右栏 · 各专家负责产出的内容（按角色分组，替代独立文档区） */

function DetailsBlock({
  title,
  details,
  tone = "default",
}: {
  title: string;
  details: string[];
  tone?: "default" | "risk";
}) {
  if (!details.length) return null;
  return (
    <div className="mt-3 border-t border-border/70 pt-3">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">
        {details.map((d, i) => (
          <li key={i} className="flex gap-2 text-xs leading-snug text-foreground">
            <span
              className={[
                "mt-1.5 size-1 shrink-0 rounded-full",
                tone === "risk" ? "bg-destructive" : "bg-primary",
              ].join(" ")}
            />
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const DETAILS_META: Record<AgentId, { title: string; tone: "default" | "risk" }> = {
  pm: { title: "产品设计方案", tone: "default" },
  designer: { title: "设计要点", tone: "default" },
  architect: { title: "选型理由与风险", tone: "default" },
  guard: { title: "开发边界规范", tone: "default" },
  moderator: { title: "风险与待补项", tone: "risk" },
};

function ExpertContent({ role, hasDetails = false }: { role: AgentId; hasDetails?: boolean }) {
  const productBrief = useFlowStore((s) => s.productBrief);
  const pageBlueprint = useFlowStore((s) => s.pageBlueprint);
  const techStackId = useFlowStore((s) => s.techStack);
  const visualStyleId = useFlowStore((s) => s.visualStyle);

  const techName = TECH_STACKS.find((t) => t.id === techStackId)?.name ?? techStackId;
  const styleName = VISUAL_STYLES.find((v) => v.id === visualStyleId)?.name ?? visualStyleId;
  const pages = productBrief?.pages ?? [];
  const pageCount = new Set(pageBlueprint.map((e) => e.pageSlug)).size;

  if (role === "pm") {
    return productBrief?.vision || productBrief?.description ? (
      <div className="space-y-3 text-sm text-muted-foreground">
        {productBrief.description && <p>{productBrief.description}</p>}
        {productBrief.vision && <p>{productBrief.vision}</p>}
        {productBrief.positioning && (
          <p>
            <span className="text-foreground">定位：</span>
            {productBrief.positioning}
          </p>
        )}
        {productBrief.targetAudience?.length ? (
          <div className="flex flex-wrap gap-2">
            {productBrief.targetAudience.map((a) => (
              <span key={a} className="rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs text-foreground">
                {a}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground/70">等待老鸨子访谈，产品定义将在此生长。</p>
    );
  }

  if (role === "designer") {
    return pages.length ? (
      <div className="grid grid-cols-2 gap-2">
        {pages.slice(0, 8).map((p) => (
          <div key={p.name} className="rounded-lg border border-border/70 bg-background p-2 text-xs">
            <p className="font-medium text-foreground">{p.name}</p>
            {p.description && <p className="mt-0.5 text-muted-foreground">{p.description}</p>}
          </div>
        ))}
      </div>
    ) : pageCount ? (
      <p className="text-sm text-muted-foreground">已规划 {pageCount} 个页面（来自蓝图骨架）。</p>
    ) : (
      <p className="text-sm text-muted-foreground/70">页面清单将随访谈产出。</p>
    );
  }

  if (role === "architect") {
    if (techName || styleName) {
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {techName && (
            <div className="rounded-lg border border-border/70 bg-background p-2">
              <p className="text-muted-foreground">技术栈</p>
              <p className="mt-1 font-medium text-foreground">{techName}</p>
            </div>
          )}
          {styleName && (
            <div className="rounded-lg border border-border/70 bg-background p-2">
              <p className="text-muted-foreground">视觉风格</p>
              <p className="mt-1 font-medium text-foreground">{styleName}</p>
            </div>
          )}
        </div>
      );
    }
    if (hasDetails) return null; // 会诊已给出选型要点，交由 DetailsBlock 展示
    return (
      <p className="text-sm text-muted-foreground/70">技术选型将在专家会诊后补齐。</p>
    );
  }

  // guard：规范守门员（无独立 store 字段，内容主要来自会诊 details）
  if (role === "guard") {
    if (hasDetails) return null; // 会诊已给出开发边界规范要点，交由 DetailsBlock 展示
    return (
      <p className="text-sm text-muted-foreground/70">
        视觉 token 唯一真值、代码验收与反 AI 味边界将在专家会诊后产出。
      </p>
    );
  }

  // moderator：风险与下一步
  if (productBrief?.extra && Object.keys(productBrief.extra).length) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        {Object.entries(productBrief.extra).map(([k, v]) => (
          <p key={k}>
            <span className="text-foreground">{k}：</span>
            {Array.isArray(v) ? v.join("、") : v}
          </p>
        ))}
      </div>
    );
  }
  if (hasDetails) return null; // 会诊已标记风险点，交由 DetailsBlock 展示
  return (
    <p className="text-sm text-muted-foreground/70">风险与待补项由审校专家在会诊中标记。</p>
  );
}

function ExpertSection({ role, agent }: { role: AgentId; agent: AgentState }) {
  const meta = DETAILS_META[role];
  const profile = useAgent(role);
  return (
    <div className="rounded-2xl border border-primary/40 bg-card">
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
        <AvatarZoom role={role} className="size-12 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{profile.specialty}</p>
        </div>
        <span
          className="max-w-[45%] shrink-0 truncate text-right text-[11px] text-muted-foreground"
          title={agent.summary || "等待访谈开始"}
        >
          {agent.summary || "等待访谈开始"}
        </span>
        <AgentStatusBadge status={agent.status} />
      </div>
      <div className="px-4 py-3">
        <ExpertContent role={role} hasDetails={(agent.details?.length ?? 0) > 0} />
        <DetailsBlock title={meta.title} details={agent.details ?? []} tone={meta.tone} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 主组件 */

interface CollabStageProps {
  onAdvance: () => void;
}

/** 四个具体产出角色（不含主控人/协调员） */
const AGENT_ROLES: AgentId[] = ["pm", "architect", "designer", "guard"];

export function CollabStage({ onAdvance }: CollabStageProps) {
  const [activeRole, setActiveRole] = useState<AgentId>("moderator");
  const [consulting, setConsulting] = useState(false);
  const [messages, setMessages] = useState<DiscoverMessage[]>([]);
  const [panelAgents, setPanelAgents] = useState<Record<AgentId, AgentState> | undefined>();
  const [needsConsult, setNeedsConsult] = useState(false);
  // F0-A：主对话流是否被失败的 AI 操作阻塞（驱动下一步按钮的说明而非静默禁用）
  const [conversationBlocked, setConversationBlocked] = useState(false);
  // F0-A：会诊自身的失败错误；主失败时专家面板不得伪装「已完成」
  const [panelError, setPanelError] = useState<FlowAIError | null>(null);
  const productBrief = useFlowStore((s) => s.productBrief);
  const setPanelOutput = useFlowStore((s) => s.setPanelOutput);
  const rounds = messages.filter((m) => m.role === "user").length;

  // —— F1-A：产品创意 Brief + 完成度 ——
  const conceptBrief = useFlowStore((s) => s.conceptBrief);
  const setConceptBrief = useFlowStore((s) => s.setConceptBrief);
  const savedProjectId = useFlowStore((s) => s.savedProjectId);
  const readiness = getConceptReadiness(conceptBrief);
  const [confirmForce, setConfirmForce] = useState(false);
  const conceptSyncingRef = useRef(false);
  const lastSyncedCountRef = useRef(0);

  // 每轮对话结束后，把访谈收敛进产品创意 Brief（面板随之刷新；失败静默保留旧值）
  useEffect(() => {
    if (messages.length === 0) return;
    if (messages.length === lastSyncedCountRef.current) return;
    if (conceptSyncingRef.current) return;
    conceptSyncingRef.current = true;
    void (async () => {
      try {
        const pid =
          savedProjectId ||
          (typeof window !== "undefined"
            ? (new URLSearchParams(window.location.search).get("pid") ?? "")
            : "");
        await syncConcept({
          messages,
          prev: useFlowStore.getState().conceptBrief,
          projectId: pid,
          setBrief: setConceptBrief,
        });
        lastSyncedCountRef.current = messages.length;
      } finally {
        conceptSyncingRef.current = false;
      }
    })();
  }, [messages, savedProjectId, setConceptBrief]);
  // —— F1-A 完成度门槛：初版方案就绪 + 用户表态（非字段填满）才允许进入方案落地 ——
  const canAdvance = readiness.canProceed;
  const hasConceptPlan = Boolean(conceptBrief?.planDraft && conceptBrief.planDraft.trim());
  const conceptAccepted =
    conceptBrief?.acceptance === "accepted" ||
    conceptBrief?.acceptance === "continue_with_assumptions";

  // —— F2-A：产品蓝图（F1-A 可继续后自动收敛，随访谈更新及重建）——
  const blueprint = useFlowStore((s) => s.blueprint);
  const setBlueprint = useFlowStore((s) => s.setBlueprint);
  const blueprintReadiness = getBlueprintReadiness(blueprint);
  const [bpBusy, setBpBusy] = useState(false);
  const [bpError, setBpError] = useState<FlowAIError | null>(null);
  // F1-A 决策变化 → 蓝图 stale（服务端也会在 GET 时归一）；局部编辑不会被静默覆盖
  const bpStale = Boolean(blueprint && conceptBrief && (blueprint.stale || conceptChangedSinceBlueprint(conceptBrief, blueprint)));
  // 记录「已为该概念版本尝试过蓝图同步」的版本号，避免每次渲染都重复 fetch/init
  const bpAttemptedForRef = useRef<number | null>(null);

  const applyBlueprint = (r: BlueprintSyncResult) => {
    if (r.blueprint) setBlueprint(r.blueprint);
    if (r.error) setBpError(r.error);
    else setBpError(null);
    return r.error == null;
  };

  // 有保存项目时，进入时应拉取持久化蓝图（刷新恢复）；F1-A 可继续且尚无蓝图 → 自动初始化首版
  useEffect(() => {
    if (!savedProjectId) return;
    if (!conceptBrief) return;
    if (blueprint) return;
    const ver = conceptBrief.version;
    if (bpAttemptedForRef.current === ver) return;
    bpAttemptedForRef.current = ver;
    let cancelled = false;
    void (async () => {
      if (canAdvance) {
        const r = await initBlueprint(savedProjectId);
        if (!cancelled) applyBlueprint(r);
      } else {
        const r = await fetchBlueprint(savedProjectId);
        if (!cancelled) applyBlueprint(r);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, conceptBrief, blueprint, canAdvance]);

  const handleBlueprintLocalEdit = useCallback(
    (path: string, value: string) => {
      if (!blueprint || !savedProjectId) return;
      setBpBusy(true);
      void updateBlueprintPath(savedProjectId, blueprint, path, value).then((r) => {
        applyBlueprint(r);
        setBpBusy(false);
      });
    },
    [blueprint, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleBlueprintResolve = useCallback(
    (decisionId: string, hint: string) => {
      if (!blueprint || !savedProjectId) return;
      setBpBusy(true);
      void resolveBlueprintItem(savedProjectId, blueprint, decisionId, hint).then((r) => {
        applyBlueprint(r);
        setBpBusy(false);
      });
    },
    [blueprint, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleBlueprintConfirm = useCallback(
    (acceptance: "accepted" | "continue_with_assumptions") => {
      if (!blueprint || !savedProjectId) return;
      setBpBusy(true);
      void confirmBlueprintItem(savedProjectId, blueprint, acceptance).then((r) => {
        applyBlueprint(r);
        setBpBusy(false);
      });
    },
    [blueprint, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleBlueprintRebuild = useCallback(() => {
    if (!blueprint || !savedProjectId) return;
    setBpBusy(true);
    void rebuildBlueprintItem(savedProjectId, blueprint).then((r) => {
      applyBlueprint(r);
      setBpBusy(false);
    });
  }, [blueprint, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleBlueprintRestore = useCallback(() => {
    if (!blueprint || !savedProjectId) return;
    setBpBusy(true);
    void restoreBlueprintItem(savedProjectId, blueprint).then((r) => {
      applyBlueprint(r);
      setBpBusy(false);
    });
  }, [blueprint, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // —— F2-B：核心体验旅程（仅 Blueprint 已确认且未过期后自动收敛）——
  const journey = useFlowStore((s) => s.journey);
  const setJourney = useFlowStore((s) => s.setJourney);
  const journeyReadiness = getJourneyReadiness(journey);
  const [journeyBusy, setJourneyBusy] = useState(false);
  const [journeyError, setJourneyError] = useState<FlowAIError | null>(null);
  // Blueprint 版本/签名变化 → 旅程 stale（服务端 GET 也会归一）
  const journeyStale = Boolean(journey && blueprint && blueprintChangedSinceJourney(blueprint, journey));
  const journeyAttemptedForRef = useRef<number | null>(null);

  const applyJourneySync = (r: JourneySyncResult) => {
    if (r.journey) setJourney(r.journey);
    if (r.error) setJourneyError(r.error);
    else setJourneyError(null);
    return r.error == null;
  };

  // 蓝图确认后：有保存项目时自动初始化旅程；无旅程则先拉取持久化版本（刷新恢复）
  useEffect(() => {
    if (!savedProjectId) return;
    if (!blueprint) return;
    if (blueprint.status !== "confirmed") return;
    if (blueprint.stale) return;
    if (journey) return;
    const ver = blueprint.version;
    if (journeyAttemptedForRef.current === ver) return;
    journeyAttemptedForRef.current = ver;
    let cancelled = false;
    void (async () => {
      // init_journey 幂等：新项目则生成首版，已存在则返回既有（刷新恢复）
      const r = await initJourneyItem(savedProjectId);
      if (!cancelled) applyJourneySync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, blueprint, journey, canAdvance]);

  const handleJourneyLocalEdit = useCallback(
    (path: string, value: string) => {
      if (!journey || !savedProjectId) return;
      setJourneyBusy(true);
      void updateJourneyPath(savedProjectId, journey, path, value).then((r) => {
        applyJourneySync(r);
        setJourneyBusy(false);
      });
    },
    [journey, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleJourneyResolve = useCallback(
    (decisionId: string, chosenHint: string) => {
      if (!journey || !savedProjectId) return;
      setJourneyBusy(true);
      void resolveJourneyItem(savedProjectId, journey, decisionId, chosenHint).then((r) => {
        applyJourneySync(r);
        setJourneyBusy(false);
      });
    },
    [journey, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleJourneyAnswer = useCallback(
    (decisionId: string, answer: string) => {
      if (!journey || !savedProjectId) return;
      setJourneyBusy(true);
      void answerJourneyItem(savedProjectId, journey, decisionId, answer).then((r) => {
        applyJourneySync(r);
        setJourneyBusy(false);
      });
    },
    [journey, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleJourneyConfirm = useCallback(
    (acceptance: JourneyAcceptance) => {
      if (!journey || !savedProjectId) return;
      setJourneyBusy(true);
      void confirmJourneyItem(savedProjectId, journey, acceptance).then((r) => {
        applyJourneySync(r);
        setJourneyBusy(false);
      });
    },
    [journey, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleJourneyRebuild = useCallback(() => {
    if (!journey || !savedProjectId) return;
    setJourneyBusy(true);
    void rebuildJourneyItem(savedProjectId, journey).then((r) => {
      applyJourneySync(r);
      setJourneyBusy(false);
    });
  }, [journey, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleJourneyRestore = useCallback(() => {
    if (!journey || !savedProjectId) return;
    setJourneyBusy(true);
    void restoreJourneyItem(savedProjectId, journey).then((r) => {
      applyJourneySync(r);
      setJourneyBusy(false);
    });
  }, [journey, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // —— F3-A：首版页面地图与信息架构（仅体验旅程已确认且未过期后自动生成）——
  const screenMap = useFlowStore((s) => s.screenMap);
  const setScreenMap = useFlowStore((s) => s.setScreenMap);
  const [smBusy, setSmBusy] = useState(false);
  const [smError, setSmError] = useState<FlowAIError | null>(null);
  // Blueprint 或 Journey 版本/签名变化 → ScreenMap 出现更新（局部编辑不会被静默覆盖）
  const smStale =
    Boolean(screenMap?.version && screenMap?.version > 0) &&
    (screenMap?.stale ||
      Boolean(blueprint && journey && screenMapChangedSince(blueprint, journey, screenMap)));
  // 供抽屉把承载的 Journey stepId 翻译成「第 N 步 · 目标」
  const journeySteps = useMemo(
    () => (journey?.steps ?? []).map((s) => ({ id: s.id, order: s.order, userGoal: s.userGoal })),
    [journey],
  );
  const smAttemptedForRef = useRef<number | null>(null);

  const applyScreenMapSync = (r: ScreenMapSyncResult) => {
    if (r.screenMap) setScreenMap(r.screenMap);
    if (r.error) setSmError(r.error);
    else setSmError(null);
    return r.error == null;
  };

  // 体验旅程确认且 Blueprint 未过期后：有保存项目时自动生成首版页面结构（init 幂等，刷新恢复既有版本）
  useEffect(() => {
    if (!savedProjectId) return;
    if (!journey || !blueprint) return;
    if (journey.status !== "confirmed" || journey.stale) return;
    if (!canInitScreenMap(blueprint, journey)) return;
    if (screenMap && screenMap.version > 0) return;
    const ver = journey.version;
    if (smAttemptedForRef.current === ver) return;
    smAttemptedForRef.current = ver;
    let cancelled = false;
    void (async () => {
      const r = await initScreenMapItem(savedProjectId, journey);
      if (!cancelled) applyScreenMapSync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, journey, blueprint, screenMap]);

  const handleScreenMapLocalEdit = useCallback(
    (path: string, value: string) => {
      if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
      setSmBusy(true);
      void updateScreenMapPath(savedProjectId, screenMap, journey, path, value).then((r) => {
        applyScreenMapSync(r);
        setSmBusy(false);
      });
    },
    [screenMap, savedProjectId, journey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenMapResolve = useCallback(
    (decisionId: string, chosenHint: string) => {
      if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
      setSmBusy(true);
      void resolveScreenMapItem(savedProjectId, screenMap, journey, decisionId, chosenHint).then((r) => {
        applyScreenMapSync(r);
        setSmBusy(false);
      });
    },
    [screenMap, savedProjectId, journey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenMapAnswer = useCallback(
    (decisionId: string, answer: string) => {
      if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
      setSmBusy(true);
      void answerScreenMapItem(savedProjectId, screenMap, journey, decisionId, answer).then((r) => {
        applyScreenMapSync(r);
        setSmBusy(false);
      });
    },
    [screenMap, savedProjectId, journey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenMapConfirm = useCallback(
    (acceptance: ScreenMapAcceptance) => {
      if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
      setSmBusy(true);
      void confirmScreenMapItem(savedProjectId, screenMap, journey, acceptance).then((r) => {
        applyScreenMapSync(r);
        setSmBusy(false);
      });
    },
    [screenMap, savedProjectId, journey], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenMapRebuild = useCallback(() => {
    if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
    setSmBusy(true);
    void rebuildScreenMapItem(savedProjectId, screenMap, journey).then((r) => {
      applyScreenMapSync(r);
      setSmBusy(false);
    });
  }, [screenMap, savedProjectId, journey]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleScreenMapRestore = useCallback(() => {
    if (!screenMap || screenMap.version <= 0 || !savedProjectId || !journey) return;
    setSmBusy(true);
    void restoreScreenMapItem(savedProjectId, screenMap, journey).then((r) => {
      applyScreenMapSync(r);
      setSmBusy(false);
    });
  }, [screenMap, savedProjectId, journey]); // eslint-disable-line react-hooks/exhaustive-deps

  // —— F3-B：逐界面信息架构与交互契约（ScreenSpec）——仅在页面结构已确认且未过期后接入 ——
  const screenSpec = useFlowStore((s) => s.screenSpec);
  const setScreenSpec = useFlowStore((s) => s.setScreenSpec);
  const [ssBusy, setSsBusy] = useState(false);
  const [ssError, setSsError] = useState<FlowAIError | null>(null);
  // Blueprint / Journey / ScreenMap 任一版本或签名变化 → ScreenSpec stale（局部编辑不会被静默覆盖）
  const ssStale =
    Boolean(screenSpec?.version && screenSpec?.version > 0) &&
    (screenSpec?.stale ||
      Boolean(blueprint && journey && screenMap && screenSpecChangedSince(blueprint, journey, screenMap, screenSpec)));
  const ssGate =
    canInitScreenSpec(blueprint, journey, screenMap) ||
    Boolean(screenSpec && screenSpec.version > 0);
  const ssAttemptedForRef = useRef<number | null>(null);

  const applyScreenSpecSync = (r: ScreenSpecSyncResult) => {
    if (r.screenSpec) setScreenSpec(r.screenSpec);
    if (r.error) setSsError(r.error);
    else setSsError(null);
    return r.error == null;
  };

  // 页面结构确认且未过期后：有保存项目时自动生成首版界面规格（init 幂等，刷新恢复既有版本）
  useEffect(() => {
    if (!savedProjectId) return;
    if (!screenMap || screenMap.version <= 0) return;
    if (!canInitScreenSpec(blueprint, journey, screenMap)) return;
    if (screenSpec && screenSpec.version > 0) return;
    const ver = screenMap.version;
    if (ssAttemptedForRef.current === ver) return;
    ssAttemptedForRef.current = ver;
    let cancelled = false;
    void (async () => {
      const r = await initScreenSpecItem(savedProjectId, screenMap);
      if (!cancelled) applyScreenSpecSync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, screenMap, screenSpec, blueprint, journey]);

  // 刷新 / 进入时恢复已持久化的界面规格（不重复初始化）
  useEffect(() => {
    if (!savedProjectId) return;
    if (screenSpec && screenSpec.version > 0) return;
    if (!screenMap || screenMap.version <= 0) return;
    let cancelled = false;
    void (async () => {
      const r = await fetchScreenSpec(savedProjectId, screenMap);
      if (!cancelled) applyScreenSpecSync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, screenMap, screenSpec]);

  const handleScreenSpecLocalEdit = useCallback(
    (path: string, value: string) => {
      if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
      setSsBusy(true);
      void updateScreenSpecPath(savedProjectId, screenSpec, screenMap, path, value).then((r) => {
        applyScreenSpecSync(r);
        setSsBusy(false);
      });
    },
    [screenSpec, savedProjectId, screenMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenSpecResolve = useCallback(
    (decisionId: string, chosenHint: string) => {
      if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
      setSsBusy(true);
      void deferScreenSpecItem(savedProjectId, screenSpec, screenMap, decisionId, chosenHint).then((r) => {
        applyScreenSpecSync(r);
        setSsBusy(false);
      });
    },
    [screenSpec, savedProjectId, screenMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenSpecAnswer = useCallback(
    (decisionId: string, answer: string) => {
      if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
      setSsBusy(true);
      void answerScreenSpecItem(savedProjectId, screenSpec, screenMap, decisionId, answer).then((r) => {
        applyScreenSpecSync(r);
        setSsBusy(false);
      });
    },
    [screenSpec, savedProjectId, screenMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenSpecConfirm = useCallback(
    (acceptance: ScreenSpecAcceptance) => {
      if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
      setSsBusy(true);
      void confirmScreenSpecItem(savedProjectId, screenSpec, screenMap, acceptance).then((r) => {
        applyScreenSpecSync(r);
        setSsBusy(false);
      });
    },
    [screenSpec, savedProjectId, screenMap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handleScreenSpecRebuild = useCallback(() => {
    if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
    setSsBusy(true);
    void rebuildScreenSpecItem(savedProjectId, screenSpec, screenMap).then((r) => {
      applyScreenSpecSync(r);
      setSsBusy(false);
    });
  }, [screenSpec, savedProjectId, screenMap]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleScreenSpecRestore = useCallback(() => {
    if (!screenSpec || screenSpec.version <= 0 || !savedProjectId || !screenMap) return;
    setSsBusy(true);
    void restoreScreenSpecItem(savedProjectId, screenSpec, screenMap).then((r) => {
      applyScreenSpecSync(r);
      setSsBusy(false);
    });
  }, [screenSpec, savedProjectId, screenMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // —— F3-C：可点击原型（仅 ScreenSpec 已 confirmed 且未过期后收敛）——
  const prototype = useFlowStore((s) => s.prototype);
  const setPrototype = useFlowStore((s) => s.setPrototype);
  const [protoBusy, setProtoBusy] = useState(false);
  const [protoError, setProtoError] = useState<FlowAIError | null>(null);
  const [prototypeReadiness, setPrototypeReadiness] = useState<PrototypeReadiness>(() =>
    getPrototypeReadiness(null, null, null, null),
  );
  // ScreenSpec 本身或上游任一来源过期 → 原型 stale（服务端 GET/重建也会归一）
  const protoStale = Boolean(
    prototype && prototype.version > 0 && (prototype.stale || Boolean(screenSpec?.stale)),
  );
  // 面板门控：界面规格已确认（生成入口），或已存在一版原型（审阅/恢复入口）
  const protoGate =
    Boolean(screenSpec && screenSpec.version > 0 && screenSpec.status === "confirmed") ||
    Boolean(prototype && prototype.version > 0);
  const protoAttemptedForRef = useRef<number | null>(null);

  const applyPrototypeSync = (r: PrototypeSyncResult) => {
    if (r.prototype) setPrototype(r.prototype);
    if (r.readiness) setPrototypeReadiness(r.readiness);
    if (r.error) setProtoError(r.error);
    else setProtoError(null);
    return r.error == null;
  };

  // 界面规格已确认且未过期：有保存项目时自动生成首版原型（init 幂等，刷新恢复既有版本）
  useEffect(() => {
    if (!savedProjectId) return;
    if (!screenSpec || screenSpec.version <= 0) return;
    if (screenSpec.status !== "confirmed" || screenSpec.stale) return;
    if (prototype && prototype.version > 0) return;
    const ver = screenSpec.version;
    if (protoAttemptedForRef.current === ver) return;
    protoAttemptedForRef.current = ver;
    let cancelled = false;
    void (async () => {
      const r = await initPrototypeItem(savedProjectId, prototype);
      if (!cancelled) applyPrototypeSync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, screenSpec, prototype]);

  // 尚未就绪（例如刷新恢复已存在的原型，或界面规格待确认）时拉取持久化原型而非重复初始化
  useEffect(() => {
    if (!savedProjectId) return;
    if (prototype && prototype.version > 0) return;
    const confirmedAndFresh = Boolean(
      screenSpec && screenSpec.version > 0 && screenSpec.status === "confirmed" && !screenSpec.stale,
    );
    if (confirmedAndFresh) return; // 由 init 走 get-or-create，避免重复请求
    let cancelled = false;
    void (async () => {
      const r = await fetchPrototype(savedProjectId);
      if (!cancelled) applyPrototypeSync(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedProjectId, screenSpec, prototype]);

  const handlePrototypeLocalEdit = useCallback(
    (path: string, value: string) => {
      if (!prototype || prototype.version <= 0 || !savedProjectId) return;
      setProtoBusy(true);
      void updatePrototypePath(savedProjectId, prototype, path, value).then((r) => {
        applyPrototypeSync(r);
        setProtoBusy(false);
      });
    },
    [prototype, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handlePrototypeFeedback = useCallback(
    (fb: PrototypeFeedbackInput | PrototypeFeedbackInput[]) => {
      if (!prototype || prototype.version <= 0 || !savedProjectId) return;
      const items = Array.isArray(fb) ? fb : [fb];
      setProtoBusy(true);
      let done = 0;
      items.forEach((item) => {
        void addPrototypeFeedbackItem(savedProjectId, prototype, item).then((r) => {
          applyPrototypeSync(r);
          if (++done === items.length) setProtoBusy(false);
        });
      });
    },
    [prototype, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handlePrototypeConfirm = useCallback(
    (acceptance: PrototypeAcceptance) => {
      if (!prototype || prototype.version <= 0 || !savedProjectId) return;
      setProtoBusy(true);
      void confirmPrototypeItem(savedProjectId, prototype, acceptance).then((r) => {
        applyPrototypeSync(r);
        setProtoBusy(false);
      });
    },
    [prototype, savedProjectId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const handlePrototypeRebuild = useCallback(() => {
    if (!prototype || prototype.version <= 0 || !savedProjectId) return;
    setProtoBusy(true);
    void rebuildPrototypeItem(savedProjectId, prototype).then((r) => {
      applyPrototypeSync(r);
      setProtoBusy(false);
    });
  }, [prototype, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps
  const handlePrototypeRestore = useCallback(() => {
    if (!prototype || prototype.version <= 0 || !savedProjectId) return;
    setProtoBusy(true);
    void restorePrototypeItem(savedProjectId, prototype).then((r) => {
      applyPrototypeSync(r);
      setProtoBusy(false);
    });
  }, [prototype, savedProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 镜像最新会话，供异步会诊完成后判断「用户是否已重置」，避免迟到结果污染
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  });

  const agents = deriveAgentStates(messages, productBrief, consulting, panelAgents);
  const { displayAgents, bubbles } = usePanelStagger(consulting, messages.length, agents);

  // 记录「最近一次成功会诊覆盖到的消息数」：新一轮访谈未会诊前，旧会诊结果视为「上一轮建议」
  const lastConsultedRef = useRef(0);
  const panelIsStale = Boolean(panelAgents) && !consulting && messages.length > lastConsultedRef.current;

  // 主调用失败时，专家面板不得伪装「已完成」：把 done 降级为 95% 产出中
  const agentsForRender = useMemo(() => {
    if (!panelError) return displayAgents;
    return (Object.keys(displayAgents) as AgentId[]).reduce((acc, id) => {
      const a = displayAgents[id];
      const st: AgentStatus = a.status === "done" ? "producing" : a.status;
      acc[id] = st === a.status ? a : { ...a, status: st, progress: Math.min(a.progress, 95) };
      return acc;
    }, {} as Record<AgentId, AgentState>);
  }, [displayAgents, panelError]);

  const handleSummon = useCallback(async () => {
    if (messages.length === 0) return;
    // 会诊一开始就记录本轮已覆盖的消息数，避免同一次内容的重复自动会诊（生成好就是生成好）
    lastConsultedRef.current = messages.length;
    setConsulting(true);
    setPanelError(null);
    const operationId = newRequestId("op");
    try {
      const res = await fetch("/api/ai/panel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: productBrief,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          agents: personaPayload(),
          operationId,
        }),
      });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      const flowErr = extractFlowError(data);
      const agentsArr = data?.agents;
      const validAgents = Array.isArray(agentsArr) && agentsArr.length > 0;
      if (!res.ok || flowErr || !validAgents) {
        // 主失败：专家面板不伪装「已完成」，保留历史建议并标记为上一轮
        setPanelAgents((prev) => prev); // 保留但下面的 panelIsStale 会标注为上一轮
        setPanelError(
          flowErr ??
            flowError(flowErr || !res.ok ? "provider_unavailable" : "invalid_response", {
              operation: "panel",
              phase: "collab",
            }),
        );
        return;
      }
      // 用户已在会诊期间重置会话：丢弃迟到结果，不写入
      if (messagesRef.current.length === 0) return;
      const next: Record<AgentId, AgentState> = {
        moderator: { status: "standby", progress: 0, summary: "", details: [] },
        pm: { status: "standby", progress: 0, summary: "", details: [] },
        architect: { status: "standby", progress: 0, summary: "", details: [] },
        designer: { status: "standby", progress: 0, summary: "", details: [] },
        guard: { status: "standby", progress: 0, summary: "", details: [] },
      };
      for (const a of agentsArr as { id: AgentId; status: AgentStatus; progress: number; summary: string; details?: unknown }[]) {
        if (a.id in next)
          next[a.id] = {
            status: a.status,
            progress: a.progress,
            summary: a.summary,
            details: Array.isArray(a.details) ? a.details.filter((d) => typeof d === "string" && d.trim()) : [],
          };
      }
      lastConsultedRef.current = messages.length;
      setPanelAgents(next);
      setPanelError(null);
      // 写入 store，供 refine 方案完善阶段跨阶段复用
      setPanelOutput(
        (Object.keys(next) as AgentId[]).reduce((acc, id) => {
          const s = next[id];
          acc[id] = { status: s.status, progress: s.progress, summary: s.summary, details: s.details ?? [] };
          return acc;
        }, {} as Record<string, AgentOutput>),
      );
    } catch {
      setPanelAgents((prev) => prev);
      setPanelError(flowError("provider_unavailable", { operation: "panel", phase: "collab" }));
    } finally {
      setConsulting(false);
    }
  }, [messages, productBrief, setPanelOutput]);

  useEffect(() => {
    if (messages.length === 0) {
      setPanelAgents(undefined);
      setPanelOutput(null);
      lastConsultedRef.current = 0;
      setNeedsConsult(false);
      setConversationBlocked(false);
      setPanelError(null);
      return;
    }
    if (messages.length > lastConsultedRef.current) setNeedsConsult(true);
  }, [messages, setPanelOutput]);

  useEffect(() => {
    if (!needsConsult || consulting) return;
    const timer = setTimeout(() => {
      const lenAtStart = messages.length;
      void handleSummon().then(() => {
        lastConsultedRef.current = lenAtStart;
      });
      setNeedsConsult(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, [needsConsult, consulting, handleSummon, messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {/* F1-A + F2-A 合并状态条：产品创意 PRD 决策 + 产品蓝图，一行展示 */}
      <ConceptBlueprintBar
        brief={conceptBrief}
        readiness={readiness}
        onConfirm={(b) => setConceptBrief(b)}
        onChanged={setConceptBrief}
        blueprint={blueprint}
        blueprintReadiness={blueprintReadiness}
        bpStale={bpStale}
        bpBusy={bpBusy}
        bpError={bpError ? flowErrorUserMessage(bpError) : null}
        onBlueprintLocalEdit={handleBlueprintLocalEdit}
        onBlueprintResolve={handleBlueprintResolve}
        onBlueprintAccept={() => handleBlueprintConfirm("accepted")}
        onBlueprintContinue={() => handleBlueprintConfirm("continue_with_assumptions")}
        onBlueprintRebuild={handleBlueprintRebuild}
        onBlueprintRestore={handleBlueprintRestore}
      />
      {/* F2-B：核心体验旅程（蓝图确认后自动收敛；状态条 + 抽屉，默认不占对话主体） */}
      {(blueprint?.status === "confirmed" || (journey && journey.version > 0)) && (
        <JourneyPanel
          journey={journey}
          readiness={journeyReadiness}
          stale={journeyStale}
          busy={journeyBusy}
          error={journeyError ? flowErrorUserMessage(journeyError) : null}
          onLocalEdit={handleJourneyLocalEdit}
          onResolve={handleJourneyResolve}
          onAnswer={handleJourneyAnswer}
          onAccept={() => handleJourneyConfirm("accepted")}
          onContinueAssumptions={() => handleJourneyConfirm("continue_with_assumptions")}
          onRebuild={handleJourneyRebuild}
          onRestore={handleJourneyRestore}
        />
      )}
      {/* F3-A：首版页面地图与信息架构（体验旅程确认后自动生成；状态条 + 抽屉，默认不占对话主体） */}
      {(journey?.status === "confirmed" || (screenMap && screenMap.version > 0)) && (
        <ScreenMapPanel
          screenMap={screenMap}
          stale={smStale}
          busy={smBusy}
          error={smError ? flowErrorUserMessage(smError) : null}
          journeySteps={journeySteps}
          onLocalEdit={handleScreenMapLocalEdit}
          onResolve={handleScreenMapResolve}
          onAnswer={handleScreenMapAnswer}
          onAccept={() => handleScreenMapConfirm("accepted")}
          onContinueAssumptions={() => handleScreenMapConfirm("continue_with_assumptions")}
          onRebuild={handleScreenMapRebuild}
          onRestore={handleScreenMapRestore}
        />
      )}
      {/* F3-B：逐界面信息架构与交互契约（界面规格，仅在页面结构已确认且未过期后接入） */}
      {ssGate && (
        <ScreenSpecPanel
          screenSpec={screenSpec}
          stale={ssStale}
          busy={ssBusy}
          error={ssError ? flowErrorUserMessage(ssError) : null}
          onLocalEdit={handleScreenSpecLocalEdit}
          onResolve={handleScreenSpecResolve}
          onAnswer={handleScreenSpecAnswer}
          onAccept={() => handleScreenSpecConfirm("accepted")}
          onContinueAssumptions={() => handleScreenSpecConfirm("continue_with_assumptions")}
          onRebuild={handleScreenSpecRebuild}
          onRestore={handleScreenSpecRestore}
        />
      )}
      {/* F3-C：可点击原型（界面规格确认且未过期后自动收敛；内嵌原型试玩器供走查与验收反馈） */}
      {protoGate && (
        <PrototypePanel
          prototype={prototype}
          readiness={prototypeReadiness}
          stale={protoStale}
          busy={protoBusy}
          error={protoError ? flowErrorUserMessage(protoError) : null}
          onLocalEdit={handlePrototypeLocalEdit}
          onAccept={() => handlePrototypeConfirm("accepted")}
          onContinueAssumptions={() => handlePrototypeConfirm("continue_with_assumptions")}
          onRebuild={handlePrototypeRebuild}
          onRestore={handlePrototypeRestore}
          onFeedback={handlePrototypeFeedback}
        />
      )}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 overflow-hidden max-xl:grid-rows-2 xl:grid-cols-[1fr_440px]">
          {/* 左列：真实对话流（独立滚动） */}
        <div className="min-h-0 overflow-hidden xl:col-start-1">
          <ChatStream
            onConversationChange={({ messages: ms, blocked }) => {
              setMessages(ms);
              setConversationBlocked(Boolean(blocked));
            }}
            onSummon={handleSummon}
            consulting={consulting}
            onManualProceed={() => setConversationBlocked(false)}
            onViewCurrentPlan={() => setActiveRole("moderator")}
          />
        </div>

        {/* 右列：后宫智囊团产出流（独立滚动） */}
        <Card className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border/70 p-0 shadow-sm xl:col-start-2">
          <CardHeader className="shrink-0 px-3 py-2">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <CardTitle className="text-base">后宫智囊团</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
            {panelError && (
              <div className="rounded-2xl border border-destructive/30 bg-card px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-destructive">本轮专家协作暂未完成</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      你的输入已保存，可以稍后继续。{flowErrorUserMessage(panelError)}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Button
                    size="icon"
                    onClick={() => void handleSummon()}
                    disabled={consulting}
                    title="重试本轮"
                  >
                    <PencilLine className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => setPanelError(null)}
                    title="继续手动完善"
                  >
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}
            {panelIsStale && !panelError && (
              <div className="flex items-center gap-1.5 rounded-xl border border-dashed border-border bg-background px-3 py-1.5 text-[11px] text-muted-foreground">
                <Clock className="size-3.5" /> 以下为上一轮建议，当前仍在等待新一轮会诊。
              </div>
            )}
            <ExpertStrip agents={agentsForRender} active={activeRole} onSelect={setActiveRole} bubbles={bubbles} />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {activeRole === "moderator" ? (
                <>
                  {AGENT_ROLES.map((r) => (
                    <ExpertSection key={r} role={r} agent={agentsForRender[r]} />
                  ))}
                  {(agents.moderator.details?.length ?? 0) > 0 && (
                    <div className="rounded-2xl border border-primary/40 bg-card px-4 py-3">
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">老鸨子小结</p>
                      <ul className="space-y-1.5">
                        {(agents.moderator.details ?? []).map((d, i) => (
                          <li key={i} className="flex gap-2 text-xs leading-snug text-foreground">
                            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-destructive" />
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <ExpertSection role={activeRole} agent={agentsForRender[activeRole]} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 底部状态操作条 */}
      <Card className="shrink-0 rounded-2xl border-border/70 p-0 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              {consulting ? "后宫智囊团会诊中" : "协同生成方案"}
            </div>
            {consulting && (
              <div className="flex items-center gap-2">
                <LoaderCircle className="size-4 animate-spin" />
                <span>各成员正卖力产出中…</span>
              </div>
            )}
            <span className="hidden h-4 w-px bg-border sm:block" />
            <span>已对话 {rounds} 轮</span>
          </div>
          <div className="flex items-center gap-2">
            {conversationBlocked || panelError ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs text-amber-600"
                title="本轮 AI 操作未完成，可重试或用「继续手动完善」解除阻塞"
              >
                <AlertTriangle className="size-3.5 shrink-0" />
                待完成
              </span>
            ) : null}
            {confirmForce && (
              <>
                {hasConceptPlan && !conceptAccepted && (
                  <Button
                    size="icon"
                    variant="outline"
                    title="接受当前方案并进入方案落地"
                    onClick={() => {
                      if (conceptBrief) setConceptBrief(acceptConceptPlan(conceptBrief));
                      onAdvance();
                    }}
                  >
                    <CheckCircle2 className="size-4" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="outline"
                  title={
                    hasConceptPlan && !conceptAccepted
                      ? "带着假设继续"
                      : (readiness.reasons[0] ?? "带着待确认项继续")
                  }
                  onClick={() => {
                    if (hasConceptPlan && !conceptAccepted && conceptBrief) {
                      setConceptBrief(continueConceptWithAssumptions(conceptBrief));
                    }
                    onAdvance();
                  }}
                >
                  <FlaskConical className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  title="返回补充"
                  onClick={() => setConfirmForce(false)}
                >
                  <Undo2 className="size-4" />
                </Button>
              </>
            )}
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (canAdvance) onAdvance();
                else setConfirmForce(true);
              }}
              disabled={!!(conversationBlocked || panelError) || messages.length === 0}
              title={
                conversationBlocked || panelError
                  ? "需先完成或解除本轮 AI 操作"
                  : canAdvance
                    ? "进入方案落地"
                    : readiness.reasons[0] ?? "继续访谈，让方案长得更丰满"
              }
            >
              下一步
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
