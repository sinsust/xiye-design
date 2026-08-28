"use client";

// F3-C 界面原型契约面板：展示就绪状态与操作（重建 / 接受 / 带假设继续 / 恢复），
// 并在可用时内嵌「可点击原型模拟器」供走查核心 Journey 与记录验收反馈。
// 视觉与其他流程面板一致：纯白卡片 + 状态条 + 操作按钮。

import {
  AlertTriangle,
  CheckCircle2,
  ListChecks,
  LoaderCircle,
  MousePointerClick,
  RotateCcw,
  Sparkles,
  Undo2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type PrototypeSpec, type PrototypeReadiness, type PrototypeFeedbackType } from "@/lib/flow-prototype";
import { PrototypePlayer } from "./prototype-player";

export interface PrototypeFeedbackInput {
  type: PrototypeFeedbackType;
  screenId?: string;
  interactionId?: string;
  scenarioId?: string;
  message?: string;
}

export interface PrototypePanelProps {
  prototype: PrototypeSpec | null;
  readiness: PrototypeReadiness;
  stale: boolean;
  busy: boolean;
  error: string | null;
  onLocalEdit?: (path: string, value: string) => void;
  onAccept?: () => void;
  onContinueAssumptions?: () => void;
  onRebuild?: () => void;
  onRestore?: () => void;
  onFeedback?: (fb: PrototypeFeedbackInput | PrototypeFeedbackInput[]) => void;
}

function StatusBadge({ status, stale }: { status: PrototypeSpec["status"]; stale: boolean }) {
  const label =
    status === "confirmed"
      ? "已确认"
      : status === "reviewing"
        ? "审阅中"
        : "草稿";
  const tone =
    status === "confirmed"
      ? "bg-emerald-500/15 text-emerald-600"
      : status === "reviewing"
        ? "bg-amber-500/15 text-amber-600"
        : "bg-muted text-muted-foreground";
  return (
    <span className="flex items-center gap-1.5 text-[11px]">
      <span className={`rounded-full px-2 py-0.5 font-medium ${tone}`}>
        {stale ? `${label}（已过期）` : label}
      </span>
    </span>
  );
}

export function PrototypePanel({
  prototype,
  readiness,
  stale,
  busy,
  error,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
  onFeedback,
}: PrototypePanelProps) {
  const hasSpec = Boolean(prototype && prototype.version > 0);
  const usable = readiness.hasUsablePrototype;
  const confirmed = prototype?.status === "confirmed";

  return (
    <Card className="rounded-2xl border-border/70 p-0 shadow-sm">
      <CardContent className="flex flex-col gap-2 px-3 py-2">
        {/* 状态条 */}
        <div className="flex flex-wrap items-center gap-2">
          <MousePointerClick className="size-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">可点击原型</span>
          {hasSpec && prototype && <StatusBadge status={prototype.status} stale={stale} />}
          {hasSpec && prototype && (
            <span className="hidden text-[11px] text-muted-foreground sm:block">
              v{prototype.version} · {prototype.screens.length} 屏 · {prototype.flows.length} 路径·
              {prototype.testScenarios.length} 剧本
            </span>
          )}
          {busy && <LoaderCircle className="size-4 animate-spin text-primary" />}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {hasSpec && stale && onRebuild && (
              <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={onRebuild} disabled={busy}>
                <RotateCcw className="size-3" /> 重建
              </Button>
            )}
            {hasSpec && prototype?.previousVersion && onRestore && (
              <Button size="sm" variant="ghost" className="h-6 gap-1 px-2 text-[11px]" onClick={onRestore} disabled={busy}>
                <Undo2 className="size-3" /> 恢复上一版
              </Button>
            )}
            {hasSpec && !confirmed && onAccept && (
              <Button size="sm" className="h-6 gap-1 px-2 text-[11px]" onClick={onAccept} disabled={busy}>
                <CheckCircle2 className="size-3" /> 接受原型
              </Button>
            )}
            {hasSpec && !confirmed && onContinueAssumptions && (
              <Button size="sm" variant="outline" className="h-6 gap-1 px-2 text-[11px]" onClick={onContinueAssumptions} disabled={busy}>
                <Sparkles className="size-3" /> 带假设继续
              </Button>
            )}
          </div>
        </div>

        {/* 说明 / 错误 */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <ListChecks className="size-3.5" />
          <span className="max-w-[42rem] leading-snug">{readiness.reason}</span>
        </div>
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-card px-3 py-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-destructive">原型操作暂未完成</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{error} 可稍后重试；你最近的有效原型已被保留。</p>
            </div>
          </div>
        )}
        {hasSpec && prototype?.lastConflicts && prototype.lastConflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-card px-3 py-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-[11px] leading-snug text-amber-700">
              重建时保留了你在 {prototype.lastConflicts.length} 处的调整，但这些与最新界面规格冲突，已列为待确认。
            </p>
          </div>
        )}

        {/* 可点击模拟器 */}
        {hasSpec && usable && prototype ? (
          <div className="rounded-xl border border-border/40 bg-background p-1">
            <PrototypePlayer
              prototype={prototype}
              busy={busy}
              onFeedback={onFeedback ? (single) => onFeedback(single) : undefined}
            />
          </div>
        ) : hasSpec && prototype ? (
          <div className="rounded-xl border border-dashed border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
            原型还不够完整（{readiness.reason}）。确认后可基于核心路径试玩。
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
            界面规格确认且四层来源（蓝图/旅程/页面结构/界面规格）未过期的原型将在此自动生成并进行可点击走查。
          </div>
        )}
      </CardContent>
    </Card>
  );
}