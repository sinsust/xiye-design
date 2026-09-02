"use client";

/**
 * 数据引擎 —— T1-D3 字段确认面板（一屏式）
 *
 * 进入分析前的「最后一道确认」：用户清楚看到系统识别的关键字段、需要留意的字段、
 * 数据质量处理情况，并只需对少数有风险的字段做最小化确认（改展示名 / 改类型 / 是否纳入）。
 *
 * 约束（T1-D3）：
 *  - 不提供整屏变量表单；「查看并调整」仅就地展开本地字段设置；
 *  - 主按钮仅在「未确认的低置信关键字段」存在时禁用，其余警告不阻断；
 *  - 保存调用 /api/brain/table/confirm-columns，服务端基于现有有效集重画像并返回新 profile；
 *  - 不编辑单元格、不去重、不修改原值、不自动改写任何业务数据。
 */

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  ALLOWED_OVERRIDE_TYPES,
  evaluateBlocking,
  listLowConfidenceFields,
} from "@/lib/table/column-confirmation";
import { DataQualityReview } from "./DataQualityReview";
import type { ColumnProfile, ColumnOverride, FieldType, QualityIssue, TableProfileResult } from "@/lib/table/types";

const TYPE_LABELS: Record<FieldType, string> = {
  boolean: "布尔",
  category: "分类",
  integer: "整数",
  float: "小数",
  percentage: "百分比",
  currency: "金额",
  date: "日期",
  text: "文本",
  id: "ID",
  email: "邮箱",
  url: "链接",
  phone: "电话",
};

type SaveState = "idle" | "saving" | "success" | "error";

/** 字段「关键度」评分（用于挑选一屏展示的关键字段） */
function keyScore(c: ColumnProfile): number {
  let s = 0;
  if (c.isUnique) s += 3;
  s += c.nonNullRate;
  if (["id", "date", "currency", "category", "email"].includes(c.type)) s += 1;
  return s;
}

export function ColumnConfirmationPanel({
  tableId,
  sheetName,
  profile,
  headers,
  columnTypes,
  confirmedHeaderRow,
  qualityIssues,
  onConfirmed,
  onBack,
}: {
  tableId: string;
  sheetName: string;
  profile: TableProfileResult;
  headers: string[];
  columnTypes: FieldType[];
  confirmedHeaderRow?: number;
  qualityIssues: QualityIssue[];
  /** 保存成功（服务端已重画像）后回调，由父组件更新状态并进入分析建议阶段 */
  onConfirmed: (res: {
    headers: string[];
    rows: unknown[][];
    columnTypes: FieldType[];
    profile: TableProfileResult;
    confirmation: unknown;
  }) => void;
  /** 返回上一步（更换 Sheet / 修改表头） */
  onBack?: () => void;
}) {
  const [overrides, setOverrides] = useState<Record<number, ColumnOverride>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  // 低置信字段：展开查看真实样本（单行 + 抽屉式详情）
  const [expandedLow, setExpandedLow] = useState<Set<number>>(new Set());

  // 关键字段（Top 8）
  const keyFields = useMemo(
    () => [...profile.columns].sort((a, b) => keyScore(b as ColumnProfile) - keyScore(a as ColumnProfile)).slice(0, 8),
    [profile.columns],
  );

  // 低置信字段（需确认）
  const lowConf = useMemo(() => listLowConfidenceFields(profile), [profile]);

  // 阻断判定（仅未确认的低置信关键字段会阻断）
  const blocking = useMemo(
    () => evaluateBlocking(profile, qualityIssues, overrides),
    [profile, qualityIssues, overrides],
  );

  const setType = (index: number, type: FieldType | "") => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (type === "") {
        delete next[index];
      } else {
        next[index] = { ...(next[index] ?? {}), type };
      }
      return next;
    });
  };

  const setDisplayName = (index: number, value: string) => {
    setOverrides((prev) => {
      const next = { ...prev };
      const trimmed = value.trim();
      const ov: ColumnOverride = next[index] ? { ...next[index]! } : {};
      if (trimmed === "" || trimmed === headers[index]) {
        delete ov.displayName;
      } else {
        ov.displayName = trimmed;
      }
      if (Object.keys(ov).length === 0) delete next[index];
      else next[index] = ov;
      return next;
    });
  };

  const toggleExclude = (index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (blocking.blocked) return;
    setSaveState("saving");
    setSaveError(null);

    // confirmedColumns：全部纳入则不传（undefined）；否则传剩余下标
    const confirmedColumns =
      excluded.size === 0 ? undefined : profile.columns.map((c) => c.index).filter((i) => !excluded.has(i));

    const body: Record<string, unknown> = { tableId, columnOverrides: overrides };
    if (confirmedColumns !== undefined) body.confirmedColumns = confirmedColumns;

    try {
      const resp = await fetch("/api/brain/table/confirm-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setSaveState("error");
        setSaveError(data?.message ?? "字段确认失败，请重试");
        return;
      }
      setSaveState("success");
      onConfirmed({
        headers: data.headers,
        rows: data.rows,
        columnTypes: data.columnTypes,
        profile: data.profile,
        confirmation: data.confirmation,
      });
    } catch (err) {
      setSaveState("error");
      setSaveError((err as Error).message ?? "网络错误，请重试");
    }
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      {/* 当前分析对象概要 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span>
          正在分析：<span className="font-medium text-foreground">{sheetName}</span>
        </span>
        {confirmedHeaderRow !== undefined && (
          <span>
            表头行：<span className="font-medium text-foreground">第 {confirmedHeaderRow + 1} 行</span>
          </span>
        )}
        <span>
          共 <span className="font-medium text-foreground">{profile.columns.length}</span> 列 /{" "}
          <span className="font-medium text-foreground">{profile.rowCount}</span> 行
        </span>
      </div>

      {/* 1) 已识别关键字段 */}
      <Section title="系统已识别的关键字段" hint="这些字段将作为主要分析对象">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
          {keyFields.map((c) => {
            const col = c as ColumnProfile;
            const ov = overrides[col.index];
            const displayType = ov?.type ?? col.type;
            return (
              <div key={col.index} className="rounded-lg border border-border/70 bg-white px-2.5 py-2">
                <div className="truncate text-[12px] font-medium text-foreground">
                  {ov?.displayName ?? col.name}
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                    {TYPE_LABELS[displayType]}
                  </span>
                  {col.isUnique && (
                    <span className="rounded bg-primary/8 px-1.5 py-px text-[10px] text-primary">唯一</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* 2) 需要你确认的字段（低置信） */}
      {lowConf.length > 0 && (
        <Section title="需要你确认的字段" hint="系统暂无法确定其类型，请选择最贴切的一种" tone="warn">
          <div className="space-y-1.5">
            {lowConf.map((c) => {
              const col = c as ColumnProfile;
              const ov = overrides[col.index];
              const displayType = ov?.type ?? col.type;
              const open = expandedLow.has(col.index);
              return (
                <div key={col.index} className="rounded-lg border border-amber-200 bg-amber-50/40">
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedLow((prev) => {
                          const next = new Set(prev);
                          if (next.has(col.index)) next.delete(col.index);
                          else next.add(col.index);
                          return next;
                        })
                      }
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      aria-expanded={open}
                    >
                      <ChevronRight
                        className={"size-3.5 shrink-0 text-amber-600 transition-transform " + (open ? "rotate-90" : "")}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">{col.name}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                        系统暂按「{TYPE_LABELS.text}」处理
                      </span>
                    </button>
                    <select
                      value={displayType}
                      onChange={(e) => setType(col.index, e.target.value as FieldType)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-md border border-border/70 bg-white px-2 py-1 text-[11px] outline-none focus:border-primary/50"
                    >
                      {ALLOWED_OVERRIDE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>
                  {open && (
                    <div className="border-t border-amber-200/70 px-3 py-2">
                      {col.samples && col.samples.length > 0 && (
                        <div className="mb-1.5">
                          <div className="mb-1 text-[11px] text-muted-foreground/70">示例（真实数据样本）</div>
                          <div className="flex flex-wrap gap-1">
                            {col.samples.slice(0, 5).map((s, i) => (
                              <span
                                key={i}
                                className="rounded bg-muted/50 px-1.5 py-px text-[10px] text-foreground/80"
                              >
                                {String(s).length > 30 ? String(s).slice(0, 30) + "…" : String(s)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        若选错类型，该字段在分析时可能被误读（如金额被当作文本、日期无法按时间排序）。
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 3) 数据质量 */}
      <Section title="数据质量" hint="系统已自动处理的问题无需你操作，需留意项已标注影响">
        <DataQualityReview issues={qualityIssues} headers={headers} />
      </Section>

      {/* 4) 查看并调整（就地展开，非整屏表单） */}
      <div className="rounded-lg border border-border/70 bg-white">
        <button
          onClick={() => setSettingsOpen((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-medium text-foreground transition hover:bg-muted/30"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          查看并调整全部字段
          <span className="text-[11px] font-normal text-muted-foreground">（展示名 / 类型 / 是否纳入分析）</span>
        </button>
        {settingsOpen && (
          <div className="border-t border-border/50 px-3 py-3">
            <div className="max-h-80 space-y-1.5 overflow-auto pr-1">
              {profile.columns.map((c) => {
                const col = c as ColumnProfile;
                const ov = overrides[col.index];
                const displayType = ov?.type ?? col.type;
                const isExcluded = excluded.has(col.index);
                return (
                  <div key={col.index} className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
                    <input
                      value={ov?.displayName ?? col.name}
                      onChange={(e) => setDisplayName(col.index, e.target.value)}
                      className="w-36 rounded border border-border/70 bg-white px-2 py-1 text-[11px] outline-none focus:border-primary/50"
                    />
                    <select
                      value={displayType}
                      onChange={(e) => setType(col.index, e.target.value as FieldType)}
                      className="rounded border border-border/70 bg-white px-2 py-1 text-[11px] outline-none focus:border-primary/50"
                    >
                      {ALLOWED_OVERRIDE_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </option>
                      ))}
                    </select>
                    <label className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={!isExcluded}
                        onChange={() => toggleExclude(col.index)}
                        className="size-3.5 accent-primary"
                      />
                      纳入分析
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 底部：状态 + 主按钮 */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg border border-border/70 bg-white px-3 py-2 text-[12px] font-medium text-muted-foreground transition hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            更换表头
          </button>
        )}

        <div className="min-w-0 flex-1">
          {saveState === "error" && (
            <div className="flex items-center gap-1 text-[11px] text-red-600">
              <AlertTriangle className="size-3" />
              {saveError}
            </div>
          )}
          {blocking.blocked && saveState !== "error" && (
            <div className="flex items-center gap-1 text-[11px] text-amber-600">
              <AlertTriangle className="size-3" />
              {blocking.reasons[0]}
            </div>
          )}
          {saveState === "success" && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-600">
              <CheckCircle2 className="size-3" />
              已确认，正在进入分析建议…
            </div>
          )}
        </div>

        <button
          onClick={handleConfirm}
          disabled={blocking.blocked || saveState === "saving"}
          className={
            "flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium transition " +
            (blocking.blocked || saveState === "saving"
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90")
          }
        >
          {saveState === "saving" && <Loader2 className="size-3.5 animate-spin" />}
          {saveState === "saving" ? "保存中…" : "确认并开始分析"}
        </button>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  tone = "default",
  children,
}: {
  title: string;
  hint?: string;
  tone?: "default" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline gap-2">
        <h4
          className={
            "text-[12px] font-semibold " + (tone === "warn" ? "text-amber-700" : "text-foreground")
          }
        >
          {title}
        </h4>
        {hint && <span className="text-[11px] text-muted-foreground/70">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
