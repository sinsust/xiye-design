"use client";

// F1/F2 合并状态条：把「产品创意 PRD 决策」与「产品蓝图」两条合并成**一行**展示，
// 降低首屏高度、减少重复。完整内容分别在两个抽屉里（点图标打开），默认不遮挡对话。
// 图标按钮不带文案（hover title 提示），与全局紧凑风格一致。

import { useState } from "react";
import { FileHeart, FileText, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type ConceptReadiness, type ProductConceptBrief } from "@/lib/flow-concept";
import {
  type BlueprintReadiness,
  type ProductBlueprint,
} from "@/lib/flow-blueprint";
import { ConceptDraftDrawer } from "./concept-brief-panel";
import { BlueprintDrawer } from "./blueprint-panel";

interface ConceptBlueprintBarProps {
  brief: ProductConceptBrief | null;
  readiness: ConceptReadiness;
  onConfirm: (brief: ProductConceptBrief) => void;
  onChanged: (brief: ProductConceptBrief | null) => void;
  blueprint: ProductBlueprint | null;
  blueprintReadiness: BlueprintReadiness;
  bpStale: boolean;
  bpBusy: boolean;
  bpError: string | null;
  onBlueprintLocalEdit: (path: string, value: string) => void;
  onBlueprintResolve: (decisionId: string, hint: string) => void;
  onBlueprintAccept: () => void;
  onBlueprintContinue: () => void;
  onBlueprintRebuild: () => void;
  onBlueprintRestore: () => void;
}

export function ConceptBlueprintBar({
  brief,
  readiness,
  onConfirm,
  onChanged,
  blueprint,
  blueprintReadiness,
  bpStale,
  bpBusy,
  bpError,
  onBlueprintLocalEdit,
  onBlueprintResolve,
  onBlueprintAccept,
  onBlueprintContinue,
  onBlueprintRebuild,
  onBlueprintRestore,
}: ConceptBlueprintBarProps) {
  const [prdOpen, setPrdOpen] = useState(false);
  const [bpOpen, setBpOpen] = useState(false);

  const decisionCount = brief?.decisions?.length ?? 0;
  const hasPlan = Boolean(brief?.planDraft && brief.planDraft.trim());
  const currentTopic = brief?.currentTopic?.trim();
  const bpConsensus = blueprintReadiness.consensusCount;
  const bpUnresolved = blueprintReadiness.unresolvedCount;

  // 合并态文案：创意决策 + 蓝图共识，一行说完
  const statusText =
    `已形成 ${decisionCount} 条关键决策 · 蓝图 ${bpConsensus} 项共识` +
    (bpUnresolved > 0 ? ` · ${bpUnresolved} 项待确认` : "") +
    (currentTopic ? ` · 正在讨论「${currentTopic}」` : "");

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-border/70 bg-card px-3 py-1 shadow-sm">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={statusText}>
          {statusText}
        </p>

        <div className="hidden items-center gap-1.5 sm:flex shrink-0">
          <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${readiness.readiness}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground">{readiness.readiness}%</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {bpStale && !bpBusy && (
            <Button
              size="icon"
              variant="outline"
              className="size-7"
              title="蓝图有更新，重新生成"
              onClick={onBlueprintRebuild}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className="size-7"
            title="查看产品蓝图"
            disabled={!blueprint}
            onClick={() => setBpOpen(true)}
          >
            <FileHeart className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant={hasPlan ? "default" : "outline"}
            className="size-7"
            title="查看 PRD / 产品初稿"
            disabled={!brief}
            onClick={() => setPrdOpen(true)}
          >
            <FileText className="size-3.5" />
          </Button>
        </div>
      </div>

      {prdOpen && brief && (
        <ConceptDraftDrawer
          brief={brief}
          readiness={readiness}
          blueprintPending={!(blueprint && blueprint.version > 0)}
          onClose={() => setPrdOpen(false)}
          onChanged={onChanged}
          onConfirm={onConfirm}
        />
      )}
      {bpOpen && blueprint && (
        <BlueprintDrawer
          blueprint={blueprint}
          readiness={blueprintReadiness}
          stale={bpStale}
          busy={bpBusy}
          error={bpError}
          onClose={() => setBpOpen(false)}
          onLocalEdit={onBlueprintLocalEdit}
          onResolve={onBlueprintResolve}
          onAccept={onBlueprintAccept}
          onContinueAssumptions={onBlueprintContinue}
          onRebuild={onBlueprintRebuild}
          onRestore={onBlueprintRestore}
        />
      )}
    </>
  );
}
