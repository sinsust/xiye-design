"use client";

// F3-C 可点击原型模拟器：把 PrototypeSpec 渲染成可点击的低/中保真线框，让用户
// 走完核心 Journey 的步骤、体验 pivotal moment、触发关键状态，并就地记录验收反馈。
// 纯前端组件：只读 PrototypeSpec，交互点击 → 局部导航/状态浮层；反馈经 onFeedback 交回
// prototype-panel（其会调用 addPrototypeFeedbackItem 落库）。不调用任何 AI。

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Flag,
  Lightbulb,
  MousePointerClick,
  RotateCcw,
  ThumbsUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type PrototypeSpec,
  type PrototypeScreen,
  type PrototypeInteraction,
  type PrototypeFlow,
  type PrototypeScreenState,
  type PrototypeFeedbackType,
  type PrototypeBlockRole,
} from "@/lib/flow-prototype";

const ROLE_LABEL: Partial<Record<PrototypeBlockRole, string>> = {
  header: "标题区",
  context: "情境信息",
  primary_content: "主内容",
  secondary_content: "次内容",
  action_area: "操作区",
  feedback: "反馈区",
  navigation: "导航",
};

/** 收集某屏上所有可点击交互（来自全部流程，按 id 去重） */
function interactionsForScreen(proto: PrototypeSpec, screenId: string): PrototypeInteraction[] {
  const byId = new Map<string, PrototypeInteraction>();
  for (const f of proto.flows) {
    for (const it of f.interactions) {
      if (it.screenId === screenId && !byId.has(it.id)) byId.set(it.id, it);
    }
  }
  return Array.from(byId.values());
}

export interface PrototypePlayerProps {
  prototype: PrototypeSpec;
  busy?: boolean;
  onFeedback?: (fb: {
    type: PrototypeFeedbackType;
    screenId?: string;
    interactionId?: string;
    scenarioId?: string;
    message?: string;
  }) => void;
}

interface WalkLog {
  at: number;
  text: string;
}

export function PrototypePlayer({ prototype, busy, onFeedback }: PrototypePlayerProps) {
  const [currentScreenId, setCurrentScreenId] = useState<string>(prototype.entryScreenId);
  const [stateOverlay, setStateOverlay] = useState<PrototypeScreenState | null>(null);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(prototype.testScenarios[0]?.id ?? null);
  const [feedbackText, setFeedbackText] = useState("");
  const [logs, setLogs] = useState<WalkLog[]>([]);

  const screen = useMemo(
    () => prototype.screens.find((s) => s.screenId === currentScreenId) ?? null,
    [prototype.screens, currentScreenId],
  );
  const interactions = useMemo(
    () => (screen ? interactionsForScreen(prototype, screen.screenId) : []),
    [prototype, currentScreenId], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const currentScenario = useMemo(
    () => prototype.testScenarios.find((t) => t.id === currentScenarioId) ?? null,
    [prototype.testScenarios, currentScenarioId],
  );

  const pushLog = (text: string) => setLogs((l) => [{ at: Date.now(), text }, ...l].slice(0, 6));

  const perform = (it: PrototypeInteraction) => {
    if (busy) return;
    if (it.targetScreenId) {
      if (prototype.screens.some((s) => s.screenId === it.targetScreenId)) {
        setCurrentScreenId(it.targetScreenId!);
        setStateOverlay(null);
        pushLog(`点击「${it.triggerLabel}」→ 进入「${it.targetScreenId}」`);
        return;
      }
      // 目标屏不在原型屏列表中：视为触发一次状态反馈（假设呈现）
      setStateOverlay({
        state: it.targetState || "success",
        visibleMessage: it.expectedOutcome || "操作成功",
        preservesInput: it.preservesDraft,
      });
      pushLog(`点击「${it.triggerLabel}」`);
      return;
    }
    if (it.targetState) {
      const st = screen?.prototypeStates.find((s) => s.state === it.targetState);
      setStateOverlay(st ?? { state: it.targetState!, visibleMessage: it.expectedOutcome ?? "操作成功", preservesInput: it.preservesDraft });
      pushLog(`点击「${it.triggerLabel}」→ 触发状态 ${it.targetState}`);
      return;
    }
    setStateOverlay({
      state: "success",
      visibleMessage: it.expectedOutcome || "完成这一步，进入下一步",
      preservesInput: it.preservesDraft,
    });
    pushLog(`点击「${it.triggerLabel}」`);
  };

  const backToEntry = () => {
    setCurrentScreenId(prototype.entryScreenId);
    setStateOverlay(null);
    pushLog("回到入口屏");
  };

  const emitFeedback = (type: PrototypeFeedbackType) => {
    if (!screen) return;
    onFeedback?.({
      type,
      screenId: screen.screenId,
      scenarioId: currentScenarioId ?? undefined,
      message: feedbackText.trim() || undefined,
    });
    setFeedbackText("");
    pushLog(`已记录反馈：${type === "confusion" ? "困惑" : type === "blocker" ? "卡点" : type === "suggestion" ? "建议" : "成功体验"}@${screen.screenId}`);
  };

  const showStatePreview = (st: PrototypeScreenState) => {
    setStateOverlay(st);
    pushLog(`预览状态：${st.visibleMessage}`);
  };

  const meta = { version: prototype.version, mode: prototype.prototypeMode };
  const isPivotScreen = prototype.pivotalMoment?.screenId === screen?.screenId;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-background">
      {/* 顶栏：模式 + 版本 + 回到入口 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/70 px-3 py-1.5">
        <MousePointerClick className="size-3.5 text-primary" />
        <span className="text-[11px] font-medium text-foreground">
          原型试玩 · {meta.mode === "wireframe" ? "线框" : "中保真"} · v{meta.version}
        </span>
        {isPivotScreen && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600">
            <Flag className="size-3" /> 关键时刻
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={backToEntry} disabled={busy}>
            <ArrowLeft className="size-3" /> 回入口
          </Button>
        </div>
      </div>

      {/* 剧本切换 */}
      {prototype.testScenarios.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border/70 px-3 py-1.5">
          {prototype.testScenarios.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setCurrentScenarioId(t.id)}
              className={[
                "rounded-full border px-2 py-0.5 text-[11px] transition",
                t.id === currentScenarioId
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/70 text-muted-foreground hover:border-primary/50",
              ].join(" ")}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}

      {/* 线框主体 */}
      <div className="relative grid min-h-[220px] flex-1 gap-3 p-3 max-md:grid-cols-1 md:grid-cols-[1fr_240px]">
        {/* 当前屏 */}
        <div className="flex min-h-0 flex-col rounded-lg border border-dashed border-border/80 bg-[repeating-linear-gradient(0deg,rgba(0,0,0,0.015),rgba(0,0,0,0.015)_1px,transparent_1px,transparent_24px)] p-3">
          <p className="mb-2 text-xs font-semibold text-foreground">{screen?.name ?? "（无内容）"}</p>
          {screen ? (
            <div className="flex flex-1 flex-col gap-2">
              {screen.layoutBlocks.map((b) => (
                <div
                  key={b.id}
                  className={[
                    "rounded-md border px-3 py-2",
                    b.role === "header"
                      ? "border-primary/40 bg-primary/5"
                      : b.role === "primary_content"
                        ? "border-border bg-card"
                        : "border-border/70 bg-card/50",
                  ].join(" ")}
                >
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {ROLE_LABEL[b.role] ?? b.role} · {b.priority}
                  </p>
                  {b.title && <p className="text-xs font-medium text-foreground">{b.title}</p>}
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{b.purpose}</p>
                </div>
              ))}
              {/* 可点击交互（操作区） */}
              {interactions.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {interactions.map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => perform(it)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-primary/50 bg-primary/10 px-2.5 py-1 text-[12px] font-medium text-foreground transition hover:bg-primary/20 disabled:opacity-50"
                    >
                      {it.triggerLabel}
                      {it.targetState ? (
                        <span className="text-[10px] text-muted-foreground">（状态）</span>
                      ) : it.targetScreenId ? (
                        <ChevronRight className="size-3" />
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              {interactions.length === 0 && (
                <p className="mt-auto pt-2 text-[11px] text-muted-foreground/60">本屏无可点击交互。</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">找不到该屏。</p>
          )}
        </div>

        {/* 侧栏：状态演示 + 反馈 */}
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          {screen && screen.prototypeStates.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">状态演示</p>
              {screen.prototypeStates.map((st) => (
                <button
                  key={st.state}
                  type="button"
                  onClick={() => showStatePreview(st)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-border/70 bg-card/60 px-2 py-1 text-[11px] text-foreground transition hover:border-primary/50"
                >
                  <span>{st.state}</span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">验收反馈</p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="补充这条反馈（可选）…"
              rows={2}
              className="w-full resize-none rounded-md border border-border/70 bg-card px-2 py-1.5 text-[11px] text-foreground outline-none focus:border-primary/50"
            />
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["confusion", "困惑", AlertCircle, "text-sky-600"],
                  ["blocker", "卡点", X, "text-destructive"],
                  ["suggestion", "建议", Lightbulb, "text-amber-600"],
                  ["success", "顺畅", ThumbsUp, "text-emerald-600"],
                ] as const
              ).map(([type, label, Icon, tone]) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  className="h-6 gap-1 px-2 text-[11px]"
                  onClick={() => emitFeedback(type)}
                  disabled={busy || !screen}
                >
                  <Icon className={`size-3 ${tone}`} /> {label}
                </Button>
              ))}
            </div>
            {currentScenario && (
              <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                剧本：{currentScenario.successCriteria.join("；")}
              </p>
            )}
          </div>

          {logs.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">试玩轨迹</p>
              {logs.map((l, i) => (
                <p key={i} className="truncate text-[10px] text-muted-foreground">
                  · {l.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 状态浮层 */}
      {stateOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/70 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 shadow-lg">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {stateOverlay.state === "error" ? (
                  <AlertCircle className="size-4 text-destructive" />
                ) : stateOverlay.state === "success" ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : (
                  <Flag className="size-4 text-amber-600" />
                )}
                <p className="text-sm font-semibold text-foreground">{stateOverlay.state}</p>
              </div>
              <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => setStateOverlay(null)}>
                <X className="size-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{stateOverlay.visibleMessage}</p>
            {stateOverlay.preservesInput && (
              <p className="mt-2 inline-flex items-center gap-1 rounded bg-card px-2 py-0.5 text-[10px] text-muted-foreground">
                <Check className="size-3 text-primary" /> 已输入内容已保留
              </p>
            )}
            {stateOverlay.recoveryAction && (
              <div className="mt-3">
                <Button size="sm" variant="outline" className="gap-1 text-[11px]" onClick={() => setStateOverlay(null)}>
                  <RotateCcw className="size-3" /> {stateOverlay.recoveryAction}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}