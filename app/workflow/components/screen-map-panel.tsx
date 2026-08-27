// F3-A 首版页面地图与信息架构：**不占据主工作区的状态条 + 完整页面结构右侧抽屉**。
//
// 原则（保持访谈节奏，不回退为功能表 / 画布编辑器 / 高保真页面）：
// - 主工作区上方只放一条极简状态：「页面结构已形成 N 个关键界面 · 仍有 M 项关键选择」+ stale + 「查看页面结构」入口。
// - 完整 ScreenMap 全部收进右侧抽屉，默认不遮挡「老鸭子对话」。
// - 抽屉按「设计叙事」组织：首版页面结构摘要 → 每个界面职责（含承载的体验步骤）→ 页面间关键跳转 →
//   当前假设 / 待决定事项。每项带证据徽标（已确认 / 假设 / 待确认）与来源；支持局部「修改」与「按假设暂缓」。
// - 底部页脚：接受当前页面结构 / 带假设进入下一步 / 返回继续讨论（沿用 F0-A 保存与失败恢复）。
// - 不显示 JSON、内部 id、代码术语、技术 schema 或画布编辑器。

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  GitBranch,
  LayoutTemplate,
  Monitor,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  ScreenMap,
  ScreenMapEvidence,
  ScreenType,
  ScreenState,
} from "@/lib/flow-screen-map";

interface JourneyStepRef {
  id: string;
  order: number;
  userGoal: string;
}

interface ScreenMapPanelProps {
  screenMap: ScreenMap | null;
  /** Blueprint 或 Journey 变化导致 screenMap stale（需重建） */
  stale: boolean;
  busy?: boolean;
  error?: string | null;
  /** 由哪些体验步骤承载某界面时，用于把 stepId 翻译成「第 N 步 · 目标」 */
  journeySteps?: JourneyStepRef[];
  onLocalEdit: (path: string, value: string) => void;
  onResolve: (decisionId: string, chosenHint: string) => void;
  onAnswer: (decisionId: string, answer: string) => void;
  onAccept: () => void;
  onContinueAssumptions: () => void;
  onRebuild: () => void;
  onRestore: () => void;
}

const TYPE_LABEL: Record<ScreenType, string> = {
  page: "主页面",
  modal: "弹层",
  drawer: "抽屉",
  embedded_state: "页内状态",
};
const STATE_LABEL: Record<ScreenState, string> = {
  default: "默认",
  first_use: "首次使用",
  empty: "空状态",
  loading: "加载中",
  error: "出错",
  success: "成功",
  permission_required: "需授权",
};

export function ScreenMapPanel({
  screenMap,
  stale,
  busy,
  error,
  journeySteps,
  onLocalEdit,
  onResolve,
  onAnswer,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
}: ScreenMapPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasSm = Boolean(screenMap && screenMap.version > 0);
  const pageCount = screenMap?.screens.filter((s) => s.type === "page").length ?? 0;
  const unresolved = screenMap?.unresolvedDecisions?.length ?? 0;
  const headline = !hasSm
    ? "页面结构将在核心体验确认后自动生成"
    : stale
      ? "产品蓝图或核心体验已更新，请基于最新方案重建页面结构。"
      : `页面结构已形成 ${pageCount} 个关键界面 · 仍有 ${unresolved} 项关键选择`;

  return (
    <>
      <Card className="shrink-0 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <LayoutTemplate className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  页面结构
                  {screenMap?.status === "confirmed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                      <ShieldCheck className="size-3" /> v{screenMap.version} 已确认
                    </span>
                  )}
                  {stale && !busy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                      <AlertTriangle className="size-3" /> 蓝图或体验已更新待重建
                    </span>
                  )}
                  {busy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Sparkles className="size-3 animate-pulse" /> 处理中…
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={headline}>
                  {headline}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {stale && !busy && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onRebuild}>
                  <RotateCcw className="size-3.5" /> 重建页面结构
                </Button>
              )}
              <Button
                size="sm"
                variant={hasSm ? "default" : "outline"}
                className="gap-1.5"
                disabled={!hasSm}
                onClick={() => setDrawerOpen(true)}
              >
                <LayoutTemplate className="size-3.5" />
                查看页面结构
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {drawerOpen && screenMap && (
        <ScreenMapDrawer
          screenMap={screenMap}
          stale={stale}
          busy={busy}
          error={error}
          journeySteps={journeySteps ?? []}
          onClose={() => setDrawerOpen(false)}
          onLocalEdit={onLocalEdit}
          onResolve={onResolve}
          onAnswer={onAnswer}
          onAccept={onAccept}
          onContinueAssumptions={onContinueAssumptions}
          onRebuild={onRebuild}
          onRestore={onRestore}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 证据徽标与来源                                                       */

function EvidenceBadge({ evidence }: { evidence: ScreenMapEvidence }) {
  if (evidence === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
        <CheckCircle2 className="size-2.5" /> 已确认
      </span>
    );
  }
  if (evidence === "assumption") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
        <FlaskConical className="size-2.5" /> 假设
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <CircleDashed className="size-2.5" /> 待确认
    </span>
  );
}

function SourceHint({ source }: { source: { journeyStepIds?: string[]; blueprintPaths?: string[]; decisionIds?: string[]; note?: string } }) {
  const note = source?.note;
  const bp = source?.blueprintPaths?.length ? `源自蓝图 ${source.blueprintPaths[0]}` : null;
  const dec = source?.decisionIds?.length ? `来自 ${source.decisionIds.length} 条决策` : null;
  const text = note || bp || dec || "来源待定";
  if (!text) return null;
  return <p className="text-[10px] text-muted-foreground/60">{text}</p>;
}

/* ------------------------------------------------------------------ */
/* 主抽屉                                                               */

function ScreenMapDrawer({
  screenMap,
  stale,
  busy,
  error,
  journeySteps,
  onClose,
  onLocalEdit,
  onResolve,
  onAnswer,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
}: {
  screenMap: ScreenMap;
  stale: boolean;
  busy?: boolean;
  error?: string | null;
  journeySteps: JourneyStepRef[];
  onClose: () => void;
  onLocalEdit: (path: string, value: string) => void;
  onResolve: (decisionId: string, chosenHint: string) => void;
  onAnswer: (decisionId: string, answer: string) => void;
  onAccept: () => void;
  onContinueAssumptions: () => void;
  onRebuild: () => void;
  onRestore: () => void;
}) {
  const confirmed = screenMap.status === "confirmed";
  const screens = screenMap.screens ?? [];
  const nav = screenMap.navigation ?? [];
  const decisions = screenMap.unresolvedDecisions ?? [];
  const pages = screens.filter((s) => s.type === "page");
  const stepLabel = (id: string) => {
    const s = journeySteps.find((x) => x.id === id);
    return s ? `第 ${s.order} 步 · ${s.userGoal}` : "";
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(640px,100vw)] flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              首版页面结构
              {confirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="size-3" /> v{screenMap.version} 已确认
                </span>
              ) : screenMap.status === "reviewing" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  <Sparkles className="size-3" /> 审阅中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  v{screenMap.version} 草稿
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              由蓝图 v{screenMap.sourceBlueprintVersion} 与体验 v{screenMap.sourceJourneyVersion} 收敛 · 共 {screens.length} 个界面 · 仍有 {decisions.length} 项关键选择
            </p>
            {error && (
              <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="size-3" /> {error}（已保留最近有效版本）
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="关闭">
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {stale && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-700">蓝图或核心体验已更新</p>
                <p className="mt-0.5 text-xs text-amber-600/80">你的手动修改会被保留，冲突将标为待确认。建议基于最新方案重建页面结构。</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={onRebuild} disabled={busy}>
                  <RotateCcw className="size-3.5" /> 基于最新方案重建
                </Button>
              </div>
            </div>
          )}

          {/* 首版页面结构摘要 */}
          <SectionTitle icon={<GitBranch className="size-3.5" />} title="首版页面结构摘要" />
          <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
            <p className="text-sm text-foreground/90">
              收敛为 <span className="font-semibold text-foreground">{pages.length}</span> 个关键界面，覆盖全部 {journeySteps.length} 段核心体验；
              主任务放独立页面，辅助步骤收进抽屉/弹层，尽量让用户在更少的界面间切换。
            </p>
          </div>

          {/* 每个界面职责 */}
          <SectionTitle icon={<Monitor className="size-3.5" />} title={`每个界面的职责 · ${screens.length} 个`} />
          <div className="space-y-3">
            {screens.map((s, i) => (
              <div key={s.id} className="rounded-xl border border-border/60 bg-card px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 inline-grid size-4 place-items-center rounded bg-indigo-500/10 text-[10px] text-indigo-600">{i + 1}</span>
                    {s.name}
                    <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{TYPE_LABEL[s.type] ?? s.type}</span>
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <EvidenceBadge evidence={s.evidence} />
                    <button
                      type="button"
                      onClick={() => {
                        const t = window.prompt(`修改「${s.name}」的职责：`, s.purpose);
                        if (t && t.trim() && t.trim() !== s.purpose) onLocalEdit(`screens.${i}.purpose`, t.trim());
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="修改职责"
                    >
                      <PencilLine className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground/70">职责：</span>{s.purpose}</p>
                  {(s.primaryJourneyStepIds ?? []).length > 0 && (
                    <p><span className="text-foreground/70">承载体验步骤：</span>{s.primaryJourneyStepIds.map(stepLabel).filter(Boolean).join("；")}</p>
                  )}
                  <p><span className="text-foreground/70">关键信息：</span>{s.keyInformation}</p>
                  {(s.primaryActions ?? []).length > 0 && (
                    <p><span className="text-foreground/70">主操作：</span>{s.primaryActions.join(" / ")}</p>
                  )}
                  {(s.states ?? []).length > 0 && (
                    <p><span className="text-foreground/70">必要状态：</span>{s.states.map((st) => STATE_LABEL[st]).join(" · ")}</p>
                  )}
                </div>
                <div className="mt-1.5">
                  <SourceHint source={s.source} />
                </div>
              </div>
            ))}
          </div>

          {/* 页面间的关键跳转 */}
          <SectionTitle icon={<GitBranch className="size-3.5" />} title={`页面间的关键跳转 · ${nav.length} 条`} />
          <div className="space-y-2">
            {nav.map((n, i) => {
              const from = screens.find((s) => s.id === n.fromScreenId);
              const to = screens.find((s) => s.id === n.toScreenId);
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground/90">
                  <span>{from?.name ?? n.fromScreenId}</span>
                  <span className="text-muted-foreground">· 点击「{n.action}」→</span>
                  <span>{to?.name ?? n.toScreenId}</span>
                  {n.condition && <span className="text-xs text-muted-foreground">（{n.condition}）</span>}
                </div>
              );
            })}
          </div>

          {/* 待决定事项 / 当前假设 */}
          <SectionTitle icon={<CircleDashed className="size-3.5" />} title={`待决定事项 · ${decisions.length} 项`} />
          {decisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">当前没有关键选择需要拍板。</p>
          ) : (
            <div className="space-y-2">
              {decisions.map((d) => (
                <div key={d.id} className="rounded-xl border border-border/60 bg-background px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{d.question}</p>
                  {d.impactNote && <p className="mt-0.5 text-xs text-muted-foreground">影响：{d.impactNote}</p>}
                  {d.options && d.options.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.options.map((o) => (
                        <Button key={o} size="sm" variant="outline" onClick={() => onAnswer(d.id, o)} disabled={busy}>
                          {o}
                        </Button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2">
                    <Button size="sm" variant="ghost" onClick={() => onResolve(d.id, "先按假设暂缓，界面落地阶段验证")} disabled={busy}>
                      按假设暂缓
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 页脚动作 */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={onRestore} disabled={!screenMap.previousVersion || busy}>
              <RotateCcw className="size-3.5" /> 恢复上一版
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>返回继续讨论</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={onAccept} disabled={busy || stale}>
              <CheckCircle2 className="size-3.5" /> 接受当前页面结构
            </Button>
            <Button size="sm" variant="secondary" onClick={onContinueAssumptions} disabled={busy || stale}>
              <FlaskConical className="size-3.5" /> 带假设进入下一步
            </Button>
          </div>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon} {title}
    </h3>
  );
}