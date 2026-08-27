// F2-B 核心用户旅程：**不占据主工作区的状态条 + 完整体验旅程右侧抽屉**。
//
// 原则（保持多轮访谈节奏，不回退为表单驱动 / 流程图编辑器）：
// - 主工作区上方只放一条极简状态：「核心体验已形成 N 个步骤 · 仍有 M 项关键选择」+ stale + 「查看体验旅程」入口。
// - 完整 Journey 全部收进右侧抽屉，默认不遮挡「老鸭子对话」。
// - 抽屉按「故事顺序」组织：首要场景 → 用户旅程 4–7 步 → 关键时刻 → 边界与恢复 → 待决定事项。
//   每步带证据徽标（已确认 / 假设 / 待确认）与来源；支持局部「修改」与「按假设暂缓」。
// - 底部页脚：接受当前体验 / 带假设进入下一步 / 返回继续讨论（沿用 F0-A 保存与失败恢复）。

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Flag,
  FlaskConical,
  Footprints,
  PencilLine,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  ExperienceJourney,
  JourneyReadiness,
  JourneyEvidence,
} from "@/lib/flow-journey";

interface JourneyPanelProps {
  journey: ExperienceJourney | null;
  readiness: JourneyReadiness;
  /** Blueprint 变化导致 journey stale（需重建） */
  stale: boolean;
  busy?: boolean;
  error?: string | null;
  onLocalEdit: (path: string, value: string) => void;
  onResolve: (decisionId: string, chosenHint: string) => void;
  onAnswer: (decisionId: string, answer: string) => void;
  onAccept: () => void;
  onContinueAssumptions: () => void;
  onRebuild: () => void;
  onRestore: () => void;
}

export function JourneyPanel({
  journey,
  readiness,
  stale,
  busy,
  error,
  onLocalEdit,
  onResolve,
  onAnswer,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
}: JourneyPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasJourney = Boolean(journey && journey.version > 0);
  const stepCount = journey?.steps?.length ?? 0;
  const unresolved = journey?.openDecisions?.length ?? 0;
  const headline = !hasJourney
    ? "体验将在产品蓝图确认后自动生成"
    : stale
      ? "产品蓝图已更新，请基于最新方案重建体验旅程。"
      : `核心体验已形成 ${stepCount} 个步骤 · 仍有 ${unresolved} 项关键选择`;

  return (
    <>
      <Card className="shrink-0 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <Footprints className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  核心体验旅程
                  {journey?.status === "confirmed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                      <ShieldCheck className="size-3" /> v{journey.version} 已确认
                    </span>
                  )}
                  {stale && !busy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                      <AlertTriangle className="size-3" /> 蓝图已更新待重建
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
                  <RotateCcw className="size-3.5" /> 重建体验
                </Button>
              )}
              <Button
                size="sm"
                variant={hasJourney ? "default" : "outline"}
                className="gap-1.5"
                disabled={!hasJourney}
                onClick={() => setDrawerOpen(true)}
              >
                <Footprints className="size-3.5" />
                查看体验旅程
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {drawerOpen && journey && (
        <JourneyDrawer
          journey={journey}
          readiness={readiness}
          stale={stale}
          busy={busy}
          error={error}
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

function EvidenceBadge({ evidence }: { evidence: JourneyEvidence }) {
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

function SourceHint({ source }: { source: { blueprintPath?: string; decisionIds?: string[]; note?: string } }) {
  const text = source?.note || (source?.blueprintPath ? `源自蓝图 ${source.blueprintPath}` : source?.decisionIds?.length ? `来自 ${source.decisionIds.length} 条决策` : "来源待定");
  if (!text) return null;
  return <p className="text-[10px] text-muted-foreground/60">{text}</p>;
}

/* ------------------------------------------------------------------ */
/* 局部编辑行（接受已是默认；提供「修改」入口）                         */

function EditableRow({
  value,
  evidence,
  source,
  path,
  onLocalEdit,
}: {
  value: string;
  evidence: JourneyEvidence;
  source: { blueprintPath?: string; decisionIds?: string[]; note?: string };
  path: string;
  onLocalEdit: (path: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-3 min-w-0 flex-1 text-sm text-foreground/90">{value || "（空）"}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <EvidenceBadge evidence={evidence} />
          <button type="button" onClick={() => { setDraft(value); setEditing(true); }} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="修改">
            <PencilLine className="size-3.5" />
          </button>
        </div>
      </div>
      <SourceHint source={source} />
      {editing && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={!draft.trim() || draft === value}
              onClick={() => {
                onLocalEdit(path, draft.trim());
                setEditing(false);
              }}
            >
              保存修改
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 完整体验旅程抽屉                                                     */

function JourneyDrawer({
  journey,
  readiness,
  stale,
  busy,
  error,
  onClose,
  onLocalEdit,
  onResolve,
  onAnswer,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
}: {
  journey: ExperienceJourney;
  readiness: JourneyReadiness;
  stale: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onLocalEdit: (path: string, value: string) => void;
  onResolve: (decisionId: string, chosenHint: string) => void;
  onAnswer: (decisionId: string, answer: string) => void;
  onAccept: () => void;
  onContinueAssumptions: () => void;
  onRebuild: () => void;
  onRestore: () => void;
}) {
  const confirmed = journey.status === "confirmed";
  const sc = journey.primaryScenario;
  const steps = journey.steps ?? [];
  const pivot = journey.pivotalMoment;
  const edges = journey.edgeCases ?? [];
  const decisions = journey.openDecisions ?? [];

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(620px,100vw)] flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              核心体验旅程 ExperienceJourney
              {confirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="size-3" /> v{journey.version} 已确认
                </span>
              ) : journey.status === "reviewing" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  <ScrollText className="size-3" /> 审阅中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  v{journey.version} 草稿
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              由蓝图 v{journey.sourceBlueprintVersion} 收敛 · 共 {steps.length} 步 · 仍有 {decisions.length} 项关键选择
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
                <p className="text-sm font-medium text-amber-700">产品蓝图已更新</p>
                <p className="mt-0.5 text-xs text-amber-600/80">你的手动修改会被保留，冲突将标为待确认。建议基于最新方案重建体验旅程。</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={onRebuild} disabled={busy}>
                  <RotateCcw className="size-3.5" /> 基于最新蓝图重建
                </Button>
              </div>
            </div>
          )}

          {/* 首要场景 */}
          <SectionTitle icon={<Flag className="size-3.5" />} title="首要场景" />
          <div className="space-y-2">
            <EditableRow path="primaryScenario.title" value={sc.title} evidence={sc.evidence} source={sc.source} onLocalEdit={onLocalEdit} />
            <Row label="谁会触发" text={sc.user} />
            <Row label="触发动机" text={sc.trigger} />
            <Row label="期待的结果" text={sc.desiredOutcome} />
          </div>

          {/* 用户旅程步骤 */}
          <SectionTitle icon={<Footprints className="size-3.5" />} title={`用户旅程 · ${steps.length} 步`} />
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.id} className="rounded-xl border border-border/60 bg-card px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 inline-grid size-4 place-items-center rounded-full bg-indigo-500/15 text-[10px] text-indigo-600">{s.order}</span>
                    {s.userGoal}
                    {s.frictionOrRisk && <span className="ml-1.5 text-xs text-amber-600">· 卡点：{s.frictionOrRisk}</span>}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <EvidenceBadge evidence={s.evidence} />
                    <button
                      type="button"
                      onClick={() => {
                        const t = window.prompt("修改这一步的用户目标：", s.userGoal);
                        if (t && t.trim() && t.trim() !== s.userGoal) onLocalEdit(`steps.${s.order - 1}.userGoal`, t.trim());
                      }}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="修改这一步目标"
                    >
                      <PencilLine className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground/70">动作：</span>{s.userAction}</p>
                  <p><span className="text-foreground/70">系统行为：</span>{s.systemBehavior}</p>
                  <p><span className="text-foreground/70">用户看到：</span>{s.visibleOutcome}</p>
                </div>
                <div className="mt-1.5">
                  <SourceHint source={s.source} />
                </div>
              </div>
            ))}
          </div>

          {/* 关键时刻 */}
          <SectionTitle icon={<Flag className="size-3.5" />} title="关键时刻" />
          {pivot && pivot.stepId ? (
            <div className="space-y-2">
              <Row label="落在哪一步" text={steps.find((s) => s.id === pivot.stepId)?.userGoal ?? "（对应步骤已调整）"} />
              <Row label="为什么关键" text={pivot.rationale} />
              <Row label="成功标准" text={pivot.successCriteria} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">关键时刻尚未确立。</p>
          )}

          {/* 边界与恢复 */}
          <SectionTitle icon={<FlaskConical className="size-3.5" />} title={`边界与恢复 · ${edges.length} 项`} />
          <div className="space-y-2">
            {edges.map((e) => (
              <div key={e.id} className="rounded-xl border border-border/60 bg-card px-3 py-2">
                <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {e.trigger}
                  <span className={`rounded px-1 text-[10px] ${e.priority === "high" ? "bg-red-500/10 text-red-600" : e.priority === "low" ? "bg-muted text-muted-foreground" : "bg-amber-500/10 text-amber-600"}`}>
                    {e.priority === "high" ? "高" : e.priority === "low" ? "低" : "中"}
                  </span>
                </p>
                <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                  <p><span className="text-foreground/70">系统响应：</span>{e.systemResponse}</p>
                  <p><span className="text-foreground/70">用户如何恢复：</span>{e.userRecovery}</p>
                </div>
                <SourceHint source={e.source} />
              </div>
            ))}
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
                    <Button size="sm" variant="ghost" onClick={() => onResolve(d.id, "先按假设暂缓，方案落地阶段验证")} disabled={busy}>
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
            <Button size="sm" variant="outline" onClick={onRestore} disabled={!journey.previousVersion || busy}>
              <RotateCcw className="size-3.5" /> 恢复上一版
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>返回继续讨论</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={onAccept} disabled={busy || stale}>
              <CheckCircle2 className="size-3.5" /> 接受当前体验
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

function Row({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="mt-0.5 text-sm text-foreground/90">{text || "（空）"}</p>
    </div>
  );
}