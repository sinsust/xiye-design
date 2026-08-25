"use client";

/**
 * 表格分析 —— 字段画像面板（Step 7）
 *
 * 信息克制：默认一行概要（名称 + 类型徽标 + 1-2 关键指标 + 迷你分布），点击展开详情；
 * 跨列关联直接长在字段卡上；选中高亮为 Step 8 选分析维度铺垫。
 * 分布条/直方图全部 CSS 实现（不引入 ECharts）。
 */

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Link2, Search } from "lucide-react";
import type { TableProfileResult } from "@/lib/table/types";

type GroupKey = "all" | "category" | "numeric" | "date" | "text";

const GROUP_LABELS: Record<GroupKey, string> = {
  all: "全部",
  category: "分类",
  numeric: "数值",
  date: "日期",
  text: "文本",
};

const TYPE_LABELS: Record<string, string> = {
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

/** 列画像联合类型判别辅助 */
type Col = TableProfileResult["columns"][number];

export function ColumnProfilePanel({
  profile,
  onSelect,
  selected,
}: {
  profile: TableProfileResult;
  onSelect?: (name: string) => void;
  selected?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupKey>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // 分组统计
  const counts = useMemo(() => {
    const c: Record<GroupKey, number> = { all: profile.columns.length, category: 0, numeric: 0, date: 0, text: 0 };
    for (const col of profile.columns) {
      if ("distribution" in col) c.category++;
      else if ("mean" in col) c.numeric++;
      else if ("minDate" in col) c.date++;
      else c.text++;
    }
    return c;
  }, [profile.columns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profile.columns.filter((col) => {
      if (group !== "all" && !matchesGroup(col, group)) return false;
      if (q && !col.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [profile.columns, query, group]);

  const relOf = (colName: string) =>
    profile.relations.filter((r) => r.columns.includes(colName));

  return (
    <div className="flex flex-col px-5 py-4">
      {/* 顶部：搜索 + 分组切换 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索字段…"
            className="w-full rounded-lg border border-border/70 bg-muted/30 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-primary/50 focus:bg-white"
          />
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-muted/40 p-0.5">
          {(Object.keys(GROUP_LABELS) as GroupKey[]).map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={
                "rounded-md px-2 py-1 text-[11px] font-medium transition " +
                (group === g ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")
              }
            >
              {GROUP_LABELS[g]}
              <span className="ml-0.5 text-[10px] text-muted-foreground/60">{counts[g]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 字段卡片列表 */}
      <div className="mt-4 space-y-1.5">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">没有匹配的字段</div>
        )}
        {filtered.map((col) => {
          const isOpen = expanded === col.name;
          const isSel = selected === col.name;
          const rels = relOf(col.name);
          return (
            <div
              key={col.name}
              className={
                "rounded-xl border transition-all duration-200 " +
                (isSel
                  ? "border-primary/60 bg-primary/5 shadow-sm"
                  : isOpen
                    ? "border-border bg-white shadow-sm"
                    : "border-border/70 bg-white hover:border-primary/25 hover:bg-muted/20")
              }
            >
              {/* 概要行 */}
              <button
                onClick={() => {
                  setExpanded(isOpen ? null : col.name);
                  onSelect?.(col.name);
                }}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-foreground">{col.name}</span>
                    <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                      {TYPE_LABELS[col.type] ?? col.type}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {summaryLine(col)}
                  </div>
                </div>

                {/* 关联徽标 */}
                {rels.length > 0 && (
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {rels.slice(0, 2).map((r, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded bg-primary/8 px-1.5 py-px text-[10px] text-primary"
                        title={r.detail}
                      >
                        <Link2 className="size-2.5" />
                        {r.columns.find((c) => c !== col.name)} · {r.strength.toFixed(2)}
                      </span>
                    ))}
                  </div>
                )}

                {isSel && <Check className="size-3.5 shrink-0 text-primary" />}
                <ChevronDown
                  className={"size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 " + (isOpen ? "rotate-180" : "")}
                />
              </button>

              {/* 迷你可视化（概要行下方，仅当有数据且未展开时） */}
              {!isOpen && <MiniViz col={col} />}

              {/* 展开详情 */}
              {isOpen && <DetailBody col={col} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────── 辅助 ─────────────── */

function matchesGroup(col: Col, g: GroupKey): boolean {
  if ("distribution" in col) return g === "category";
  if ("mean" in col) return g === "numeric";
  if ("minDate" in col) return g === "date";
  return g === "text";
}

/** 概要行文字（每类一行关键指标） */
function summaryLine(col: Col): string {
  if ("distribution" in col) {
    return `${col.totalCategories} 个类别 · ${col.isBalanced ? "均衡" : "偏态"} · Top ${col.topCategory ?? "-"} ${
      col.topCategoryPercentage > 0 ? Math.round(col.topCategoryPercentage * 100) : 0
    }%`;
  }
  if ("mean" in col) {
    const base = `均值 ${fmtNum(col.mean)} · 中位数 ${fmtNum(col.median)} · 范围 ${fmtNum(col.min)}~${fmtNum(col.max)}`;
    return col.hasOutliers ? base + ` · ${col.outlierCount} 个异常值` : base;
  }
  if ("minDate" in col) {
    return `${col.minDate} ~ ${col.maxDate} · ${GRANULARITY_LABELS[col.detectedGranularity] ?? col.detectedGranularity}粒度 · ${
      col.isContinuous ? "连续" : `${col.missingDates.length} 处缺失`
    }`;
  }
  return `${col.uniqueCount} 个唯一值 · 非空率 ${Math.round(col.nonNullRate * 100)}% · ${
    col.avgLength > 0 ? `平均长度 ${col.avgLength.toFixed(1)}` : ""
  }`;
}

const GRANULARITY_LABELS: Record<string, string> = {
  year: "年",
  quarter: "季",
  month: "月",
  week: "周",
  day: "日",
  hour: "时",
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 10000) return n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/** 概要行下的迷你可视化（CSS 实现） */
function MiniViz({ col }: { col: Col }) {
  if ("distribution" in col) {
    // 分类：Top5 细分布条
    const top = col.distribution.slice(0, 5);
    if (top.length === 0) return null;
    return (
      <div className="px-3.5 pb-2.5">
        <div className="space-y-1">
          {top.map((d) => (
            <div key={d.value} className="flex items-center gap-2">
              <span className="w-14 shrink-0 truncate text-right text-[10px] text-muted-foreground">{d.value}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary/40 transition-all duration-300"
                  style={{ width: `${Math.max(2, Math.round(d.percentage * 100))}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {Math.round(d.percentage * 100)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if ("mean" in col) {
    // 数值：迷你直方图（20 桶压成 24 个细条）
    if (col.histogram.length === 0) return null;
    const max = Math.max(...col.histogram.map((h) => h.count), 1);
    return (
      <div className="px-3.5 pb-2.5">
        <div className="flex h-10 items-end gap-[2px]">
          {col.histogram.map((h, i) => (
            <div
              key={i}
              className={
                "flex-1 rounded-t-[2px] transition-all duration-300 " +
                (col.hasOutliers && i >= col.histogram.length - 2 ? "bg-red-400/70" : "bg-primary/35")
              }
              style={{ height: `${Math.max(8, Math.round((h.count / max) * 100))}%` }}
              title={`${fmtNum(h.start)}~${fmtNum(h.end)}: ${h.count}`}
            />
          ))}
        </div>
        {col.hasOutliers && (
          <div className="mt-1 flex items-center gap-1 text-[10px] text-red-600/80">
            <AlertTriangle className="size-2.5" />
            检测到 {col.outlierCount} 个异常值
          </div>
        )}
      </div>
    );
  }
  return null;
}

/** 展开详情 */
function DetailBody({ col }: { col: Col }) {
  return (
    <div className="border-t border-border/50 px-3.5 py-3 animate-in fade-in duration-200">
      {/* 完整性 / 唯一性（公共） */}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <InfoItem label="非空" value={`${col.nonNullCount.toLocaleString()} · ${Math.round(col.nonNullRate * 100)}%`} />
        <InfoItem label="唯一" value={col.isUnique ? "全部唯一" : `${col.uniqueCount.toLocaleString()} 个`} />
        <InfoItem label="空值" value={`${col.nullCount.toLocaleString()} 个`} />
      </div>

      {"distribution" in col && (
        <>
          <div className="mt-3 space-y-1">
            {col.distribution.slice(0, 12).map((d) => (
              <div key={d.value} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-[11px] text-foreground">{d.value}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50"
                    style={{ width: `${Math.max(2, Math.round(d.percentage * 100))}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                  {d.count.toLocaleString()} · {Math.round(d.percentage * 100)}%
                </span>
              </div>
            ))}
            {col.distribution.length > 12 && (
              <div className="pt-0.5 text-center text-[10px] text-muted-foreground/60">
                还有 {col.distribution.length - 12} 个类别未显示
              </div>
            )}
          </div>
          {col.hasHierarchy && (
            <div className="mt-2 text-[11px] text-primary">检测到层级结构：{col.hierarchyLevels.join(" / ")}</div>
          )}
        </>
      )}

      {"mean" in col && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <InfoItem label="标准差" value={fmtNum(col.stdDev)} />
          <InfoItem label="偏度" value={`${fmtNum(col.skewness)}${col.isNormalDistribution ? "（近正态）" : "（偏态）"}`} />
          <InfoItem label="分位 q25/q75" value={`${fmtNum(col.quantiles.q25)} / ${fmtNum(col.quantiles.q75)}`} />
          <InfoItem label="q90/q95/q99" value={`${fmtNum(col.quantiles.q90)} / ${fmtNum(col.quantiles.q95)} / ${fmtNum(col.quantiles.q99)}`} />
          <InfoItem label="合计" value={fmtNum(col.sum)} />
          <InfoItem label="零值/负值" value={`${col.zeroCount} / ${col.negativeCount}`} />
        </div>
      )}

      {"minDate" in col && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <InfoItem label="跨度" value={`${col.dateRange} 天`} />
          <InfoItem label="粒度" value={GRANULARITY_LABELS[col.detectedGranularity] ?? col.detectedGranularity} />
          <div>
            <div className="text-muted-foreground/70">星期分布</div>
            <div className="mt-0.5 flex flex-wrap gap-1">
              {col.dayOfWeekDistribution.map((d) => (
                <span key={d.day} className="rounded bg-muted px-1.5 py-px text-[10px] text-foreground">
                  {d.label} {d.count}
                </span>
              ))}
            </div>
          </div>
          {col.missingDates.length > 0 && (
            <div>
              <div className="text-muted-foreground/70">缺失日期</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {col.missingDates.map((m, i) => (
                  <span key={i} className="rounded bg-red-50 px-1.5 py-px text-[10px] text-red-600">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!("distribution" in col) && !("mean" in col) && !("minDate" in col) && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <InfoItem label="长度" value={`${col.minLength} ~ ${col.maxLength}`} />
          <InfoItem label="格式" value={formatHits(col)} />
          {col.idPattern && <InfoItem label="ID 模式" value={col.idPattern} />}
          {col.topWords.length > 0 && (
            <div>
              <div className="text-muted-foreground/70">高频词</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {col.topWords.slice(0, 8).map((w) => (
                  <span key={w.word} className="rounded bg-muted px-1.5 py-px text-[10px] text-foreground">
                    {w.word} {w.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatHits(col: Col & { containsChinese?: boolean; containsEnglish?: boolean; containsNumbers?: boolean }): string {
  const parts: string[] = [];
  if (col.containsChinese) parts.push("中文");
  if (col.containsEnglish) parts.push("英文");
  if (col.containsNumbers) parts.push("数字");
  return parts.join("+") || "—";
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground/70">{label}</div>
      <div className="mt-0.5 truncate text-foreground">{value}</div>
    </div>
  );
}
