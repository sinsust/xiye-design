"use client";

/**
 * 表格分析 —— T1-D3 数据质量前台化面板
 *
 * 把引擎层 QualityIssue（EMPTY_ROWS_SKIPPABLE / GHOST_COLUMNS_PRESENT /
 * MIXED_DATE_FORMAT / MIXED_CURRENCY / DUPLICATE_ROWS / HIGH_NULL_RATIO）翻译成
 * 三段式人话展示：
 *  - 已自动处理：空行 / 幽灵列等结构性问题，系统已裁剪，仅陈述「已处理」，不要求确认、不阻断；
 *  - 需要你留意：混合日期 / 金额币种，系统识别但不改写原值，提示影响；
 *  - 供你判断：重复行 / 高缺失率，提示风险，不自动去重 / 补全。
 *
 * 约束（T1-D3）：不暴露 EffectiveDataset / confidence / Jaccard 等工程术语；
 * 所有「处理」均为只读陈述，不提供任何自动改写按钮（去重 / 补值 / 改写由后续阶段负责）。
 */

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { groupQualityIssues, qualityMeta, type QualityGroup } from "@/lib/table/column-confirmation";
import type { QualityIssue } from "@/lib/table/types";

const GROUP_ORDER: QualityGroup[] = ["auto_handled", "attention", "advisory"];

const GROUP_HEADER: Record<QualityGroup, { label: string; desc: string; icon: typeof CheckCircle2; tone: string }> = {
  auto_handled: {
    label: "系统已自动处理",
    desc: "这些结构性问题不影响分析，你无需操作",
    icon: CheckCircle2,
    tone: "text-emerald-600",
  },
  attention: {
    label: "需要你留意",
    desc: "系统识别但未改写原值，可能影响相关维度结论",
    icon: AlertTriangle,
    tone: "text-amber-600",
  },
  advisory: {
    label: "供你判断",
    desc: "存在风险点，是否处理由你结合业务决定",
    icon: Info,
    tone: "text-sky-600",
  },
};

function scopeText(it: QualityIssue): string | null {
  if (it.affectedRows && it.affectedRows > 0) return `影响约 ${it.affectedRows} 行`;
  if (it.affectedColumns && it.affectedColumns > 0) return `影响 ${it.affectedColumns} 列`;
  return null;
}

export function DataQualityReview({
  issues,
  headers,
  className = "",
}: {
  issues: QualityIssue[];
  /** 当前有效表头（覆盖后可能已排除部分列）；用于隐藏已排除列关联的质量项 */
  headers?: string[];
  className?: string;
}) {
  // 隐藏「指向已排除列」的质量项（列名不在当前表头中）
  const visible = headers
    ? issues.filter((it) => !it.columnName || headers.includes(it.columnName))
    : issues;

  const grouped = groupQualityIssues(visible);
  const total = visible.length;

  if (total === 0) {
    return (
      <div className={`rounded-lg border border-border/70 bg-white px-4 py-3 text-xs text-muted-foreground ${className}`}>
        未检测到明显的数据质量问题。
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {GROUP_ORDER.map((g) => {
        const list = grouped[g];
        if (list.length === 0) return null;
        const meta = GROUP_HEADER[g];
        const Icon = meta.icon;
        return (
          <div key={g}>
            <div className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-medium ${meta.tone}`}>
              <Icon className="size-3.5" />
              {meta.label}
              <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">{list.length}</span>
            </div>
            <div className="mb-2 text-[11px] text-muted-foreground/70">{meta.desc}</div>
            <div className="space-y-1.5">
              {list.map((it, i) => {
                const m = qualityMeta(it);
                const scope = scopeText(it);
                return (
                  <div
                    key={`${it.code}-${i}`}
                    className="rounded-lg border border-border/70 bg-white px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-px truncate text-[13px] font-medium text-foreground">{m.title}</span>
                      {g === "auto_handled" && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-px text-[10px] text-emerald-600">
                          已处理
                        </span>
                      )}
                      {scope && (
                        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                          {scope}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-muted-foreground">
                      <p>
                        <span className="text-muted-foreground/60">当前处理：</span>
                        {m.currentHandling}
                      </p>
                      <p>
                        <span className="text-muted-foreground/60">对分析的影响：</span>
                        {m.analysisImpact}
                      </p>
                      {m.actionLabel && (
                        <p className="flex items-start gap-1">
                          <span className="text-muted-foreground/60">建议：</span>
                          <span>{m.actionLabel}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
