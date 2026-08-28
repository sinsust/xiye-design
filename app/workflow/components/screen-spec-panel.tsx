// F3-B 逐界面信息架构与交互契约：**不占据主工作区的状态条 + 界面规格右侧抽屉**。
//
// 原则（保持访谈节奏，不回退为技术规格表 / 设计画布 / 高保真页面）：
// - 主工作区上方只放一条极简状态：「界面体验已明确 N 个关键界面 · 仍有 M 项关键选择」+ stale + 「查看界面规格」。
// - 完整 ScreenSpec 全部收进右侧抽屉，默认不遮挡「老鸭子对话」。
// - 抽屉按用户可读的「设计叙事」组织，每个界面讲清楚：
//   这一界面要帮用户完成什么 → 首屏优先呈现什么 → 主要操作 → 系统如何回应 → 成功反馈与下一步 →
//   空 / 加载 / 出错 / 授权等必要状态 → 当前假设与待决定问题。
// - 每个可编辑项允许「接受 / 修改 / 暂缓为假设」，并记录 guardedPaths；不显示 JSON、内部 id、
//   类型名、schema、组件树、数据库、接口或任何工程术语。
// - stale / 页脚沿用 F0-A 语义（接受 / 带假设 / 返回继续讨论 / 有上一版则恢复）。
// - 用户无需填字段；每轮至多一个影响核心交互、页面职责或关键时刻的高杠杆问题。

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  LayoutGrid,
  Monitor,
  MousePointerClick,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Layers,
  Inbox,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  ScreenSpec,
  ScreenSpecEvidence,
  InfoLevel,
  DataSensitivity,
} from "@/lib/flow-screen-spec";
import type { ScreenType, ScreenState } from "@/lib/flow-screen-map";

interface ScreenSpecPanelProps {
  screenSpec: ScreenSpec | null;
  /** 页面结构/体验/蓝图任一变化导致 screenSpec stale（需重建） */
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
const LEVEL_LABEL: Record<InfoLevel, string> = {
  primary: "首屏重点",
  secondary: "核心内容",
  supporting: "辅助信息",
};
const SENSITIVITY_LABEL: Record<DataSensitivity, string> = {
  public: "公开",
  private: "私有",
  sensitive: "敏感",
};

export function ScreenSpecPanel({
  screenSpec,
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
}: ScreenSpecPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const hasSpec = Boolean(screenSpec && screenSpec.version > 0);
  const screenCount = screenSpec?.screens?.length ?? 0;
  const unresolved = screenSpec?.unresolvedDecisions?.length ?? 0;
  const headline = !hasSpec
    ? "界面规格将在页面结构确认后自动生成"
    : stale
      ? "页面结构或核心体验已更新，请基于最新方案重建设计规格。"
      : `界面体验已明确 ${screenCount} 个关键界面 · 仍有 ${unresolved} 项关键选择`;

  return (
    <>
      <Card className="shrink-0 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <LayoutGrid className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  界面规格
                  {screenSpec?.status === "confirmed" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                      <ShieldCheck className="size-3" /> v{screenSpec.version} 已确认
                    </span>
                  )}
                  {stale && !busy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                      <AlertTriangle className="size-3" /> 页面结构或体验已更新待重建
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
                  <RotateCcw className="size-3.5" /> 重建设计规格
                </Button>
              )}
              <Button
                size="sm"
                variant={hasSpec ? "default" : "outline"}
                className="gap-1.5"
                disabled={!hasSpec}
                onClick={() => setDrawerOpen(true)}
              >
                <LayoutGrid className="size-3.5" />
                查看界面规格
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {drawerOpen && screenSpec && (
        <ScreenSpecDrawer
          screenSpec={screenSpec}
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
/* 证据徽标与来源（用户可读措辞，不暴露路径/id）                          */
/* ------------------------------------------------------------------ */

function EvidenceBadge({ evidence }: { evidence: ScreenSpecEvidence }) {
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

function SourceHint({ source }: { source: { note?: string; blueprintPath?: string; journeyStepId?: string; screenMapPath?: string; decisionId?: string } }) {
  const text = source?.note || "依据已确认的页面结构 / 核心体验 / 方案推断";
  return <p className="text-[10px] text-muted-foreground/60">{text}</p>;
}

/* ------------------------------------------------------------------ */
/* 主抽屉                                                               */
/* ------------------------------------------------------------------ */

function ScreenSpecDrawer({
  screenSpec,
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
  screenSpec: ScreenSpec;
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
  const confirmed = screenSpec.status === "confirmed";
  const screens = screenSpec.screens ?? [];
  const decisions = screenSpec.unresolvedDecisions ?? [];

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(640px,100vw)] flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              界面规格契约
              {confirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="size-3" /> v{screenSpec.version} 已确认
                </span>
              ) : screenSpec.status === "reviewing" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                  <Sparkles className="size-3" /> 审阅中
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  v{screenSpec.version} 草稿
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              由已确认的页面结构 v{screenSpec.sourceScreenMapVersion} 展开 · 共 {screens.length} 个界面 · 仍有 {decisions.length} 项关键选择
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
                <p className="text-sm font-medium text-amber-700">页面结构或核心体验已更新</p>
                <p className="mt-0.5 text-xs text-amber-600/80">你的手动修改会被保留，冲突将标为待确认。建议基于最新方案重建设计规格。</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={onRebuild} disabled={busy}>
                  <RotateCcw className="size-3.5" /> 基于最新方案重建设计规格
                </Button>
              </div>
            </div>
          )}

          {/* 规格摘要 */}
          <SectionTitle icon={<Layers className="size-3.5" />} title="设计规格摘要" />
          <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
            <p className="text-sm text-foreground/90">
              为 <span className="font-semibold text-foreground">{screens.length}</span> 个界面写清「要帮用户完成什么、首屏呈现什么、怎么操作、系统如何回应」，并标注空/加载/出错/授权等必要状态，作为后续原型与实现的稳定输入。
            </p>
          </div>

          {/* 每个界面的设计叙事 */}
          <SectionTitle icon={<Monitor className="size-3.5" />} title={`逐个界面的体验契约 · ${screens.length} 个`} />
          <div className="space-y-3">
            {screens.map((s, i) => (
              <ScreenCard key={s.screenId} screen={s} index={i} onLocalEdit={onLocalEdit} />
            ))}
          </div>

          {/* 待决定事项 / 当前假设 */}
          <SectionTitle icon={<CircleDashed className="size-3.5" />} title={`关键选择 · ${decisions.length} 项`} />
          {decisions.length === 0 ? (
            <p className="text-xs text-muted-foreground">当前没有需要拍板的关键选择。</p>
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
                    <Button size="sm" variant="ghost" onClick={() => onResolve(d.id, "先按假设暂缓，原型阶段验证")} disabled={busy}>
                      暂缓为假设
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
            <Button size="sm" variant="outline" onClick={onRestore} disabled={!screenSpec.previousVersion || busy}>
              <RotateCcw className="size-3.5" /> 恢复上一版
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>返回继续讨论</Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={onAccept} disabled={busy || stale}>
              <CheckCircle2 className="size-3.5" /> 接受当前界面规格
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

/* ------------------------------------------------------------------ */
/* 单个界面的体验契约卡片（设计叙事，不暴露工程术语）                      */
/* ------------------------------------------------------------------ */

function ScreenCard({
  screen,
  index,
  onLocalEdit,
}: {
  screen: ScreenSpec["screens"][number];
  index: number;
  onLocalEdit: (path: string, value: string) => void;
}) {
  const base = `screens.${index}`;
  return (
    <div className="rounded-xl border border-border/60 bg-card px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          <span className="mr-1.5 inline-grid size-4 place-items-center rounded bg-indigo-500/10 text-[10px] text-indigo-600">{index + 1}</span>
          {screen.name}
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{TYPE_LABEL[screen.type] ?? screen.type}</span>
        </p>
        <button
          type="button"
          onClick={() => {
            const t = window.prompt(`修改「${screen.name}」要帮用户完成什么：`, screen.primaryOutcome);
            if (t && t.trim() && t.trim() !== screen.primaryOutcome) onLocalEdit(`${base}.primaryOutcome`, t.trim());
          }}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="修改主结果"
        >
          <PencilLine className="size-3.5" />
        </button>
      </div>

      {screen.pivotalMomentRole && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-indigo-600">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" />
          <span>{screen.pivotalMomentRole}</span>
        </p>
      )}

      <div className="mt-2 space-y-2 text-xs">
        <p><span className="font-medium text-foreground/80">要帮用户完成：</span><span className="text-muted-foreground">{screen.primaryOutcome || "（待补充）"}</span></p>

        {/* 信息层级 */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Layers className="size-3" /> 首屏优先呈现
          </p>
          <div className="space-y-1.5">
            {(screen.informationHierarchy ?? []).map((h) => (
              <div key={h.id} className="rounded-lg border border-border/50 bg-background px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-foreground/80">
                    {h.title} <span className="ml-1 rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{LEVEL_LABEL[h.level]}</span>
                  </p>
                  <EvidenceBadge evidence={h.evidence} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{h.purpose}</p>
                <p className="mt-0.5 text-[11px] text-foreground/70">呈现：{h.contentItems.filter(Boolean).join(" · ") || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 交互 */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <MousePointerClick className="size-3" /> 主要操作与系统回应
          </p>
          <div className="space-y-1.5">
            {(screen.interactions ?? []).map((it) => (
              <div key={it.id} className="rounded-lg border border-border/50 bg-background px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium text-foreground/80">「{it.trigger}」</p>
                  <EvidenceBadge evidence={it.evidence} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">系统回应：{it.systemResponse}</p>
                <p className="mt-0.5 text-[11px] text-foreground/70">成功时：{it.successFeedback}</p>
              </div>
            ))}
            {(screen.interactions ?? []).length === 0 && <p className="text-[11px] text-muted-foreground">—</p>}
          </div>
        </div>

        {/* 必要状态 */}
        <div>
          <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Inbox className="size-3" /> 必要状态
          </p>
          <div className="space-y-1">
            {(screen.stateDesign ?? []).map((st) => (
              <p key={st.state} className="rounded-md bg-background px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground/80">{STATE_LABEL[st.state]}：</span>
                {st.userMessage}
                {st.primaryAction ? `（主要动作：${st.primaryAction}）` : ""}
                {st.recoveryPath ? ` · 恢复：${st.recoveryPath}` : ""}
              </p>
            ))}
          </div>
        </div>

        {/* 数据感知（用户可读） */}
        {(screen.dataNeeds ?? []).length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground/80">需要哪些信息：</span>
            {screen.dataNeeds.map((d) => `${d.label}（${SENSITIVITY_LABEL[d.sensitivity]}）`).join(" · ")}
          </p>
        )}

        <SourceHint source={(screen.informationHierarchy?.[0]?.source as ScreenSpec["screens"][number]["informationHierarchy"][number]["source"]) ?? {}} />
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon} {title}
    </h3>
  );
}