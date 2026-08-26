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
  // 每组的折叠状态（默认全展开；点分组标签收起整个组）
  const [groupCollapsed, setGroupCollapsed] = useState<Record<GroupKey, boolean>>({
    all: false,
    category: false,
    numeric: false,
    date: false,
    text: false,
  });

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

  // 按类型分组渲染（支持整组折叠）
  const grouped: Array<{ key: GroupKey; label: string; cols: Col[] }> = useMemo(() => {
    const groups: Record<Exclude<GroupKey, "all">, Col[]> = { category: [], numeric: [], date: [], text: [] };
    for (const col of filtered) {
      if ("distribution" in col) groups.category.push(col);
      else if ("mean" in col) groups.numeric.push(col);
      else if ("minDate" in col) groups.date.push(col);
      else groups.text.push(col);
    }
    const list: Array<{ key: GroupKey; label: string; cols: Col[] }> = [];
    if (group === "all") {
      list.push({ key: "category", label: GROUP_LABELS.category, cols: groups.category });
      list.push({ key: "numeric", label: GROUP_LABELS.numeric, cols: groups.numeric });
      list.push({ key: "date", label: GROUP_LABELS.date, cols: groups.date });
      list.push({ key: "text", label: GROUP_LABELS.text, cols: groups.text });
    } else {
      list.push({ key: group, label: GROUP_LABELS[group], cols: filtered });
    }
    return list;
  }, [filtered, group]);

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

      {/* 按类型分组渲染 */}
      <div className="mt-4 space-y-3">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-xs text-muted-foreground">没有匹配的字段</div>
        )}
        {grouped.map(({ key: gKey, label, cols }) => {
          if (cols.length === 0) return null;
          const collapsed = groupCollapsed[gKey];
          return (
            <div key={gKey}>
              <button
                onClick={() =>
                  setGroupCollapsed((prev) => ({ ...prev, [gKey]: !prev[gKey] }))
                }
                className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground transition hover:text-foreground"
              >
                <ChevronDown
                  className={"size-3 transition-transform " + (collapsed ? "-rotate-90" : "")}
                />
                {label}
                <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                  {cols.length}
                </span>
              </button>
              {!collapsed && (
                <div className="space-y-1">
                  {cols.map((col) => {
                    const isOpen = expanded === col.name;
                    const isSel = selected === col.name;
                    const rels = relOf(col.name);
                    return (
                      <div
                        key={col.name}
                        className={
                          "rounded-lg border transition-all duration-200 " +
                          (isSel
                            ? "border-primary/60 bg-primary/5 shadow-sm"
                            : isOpen
                              ? "border-border bg-white shadow-sm"
                              : "border-border/70 bg-white hover:border-primary/25")
                        }
                      >
                        {/* 概要行（紧凑：高度 ~44px） */}
                        <button
                          onClick={() => {
                            setExpanded(isOpen ? null : col.name);
                            onSelect?.(col.name);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left"
                        >
                          <span className="truncate text-[13px] font-medium text-foreground">{col.name}</span>
                          <span className="shrink-0 rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
                            {TYPE_LABELS[col.type] ?? col.type}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
                            {summaryLine(col)}
                          </span>
                          {rels.length > 0 && (
                            <div className="flex shrink-0 gap-1">
                              {rels.slice(0, 1).map((r, i) => (
                                <span
                                  key={i}
                                  className="flex items-center gap-1 rounded bg-primary/8 px-1.5 py-px text-[10px] text-primary"
                                  title={r.detail}
                                >
                                  <Link2 className="size-2.5" />
                                  {r.columns.find((c) => c !== col.name)}
                                </span>
                              ))}
                            </div>
                          )}
                          {isSel && <Check className="size-3.5 shrink-0 text-primary" />}
                          <ChevronDown
                            className={
                              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 " +
                              (isOpen ? "rotate-180" : "")
                            }
                          />
                        </button>

                        {/* 展开详情（精简） */}
                        {isOpen && <DetailBody col={col} />}
                      </div>
                    );
                  })}
                </div>
              )}
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

/** 该字段可做的分析动作（按类型，引导用户理解"这列能榨出什么"） */
function canAnalyze(col: Col): string[] {
  switch (col.type) {
    case "category":
    case "boolean":
      return ["排名", "分组对比", "占比", "交叉分析"];
    case "integer":
    case "float":
    case "percentage":
    case "currency":
      return ["分布", "趋势", "相关性", "异常值"];
    case "date":
      return ["按月趋势", "环比", "周期分布"];
    case "text":
    case "id":
      return ["明细", "唯一值"];
    case "email":
    case "url":
    case "phone":
      return ["格式统计", "明细"];
    default:
      return [];
  }
}

/** 展开详情（精简：去掉非空率/唯一数等基础数据，只保留可读洞察） */
function DetailBody({ col }: { col: Col }) {
  const actions = canAnalyze(col);
  return (
    <div className="border-t border-border/50 px-3.5 py-3 animate-in fade-in duration-200">
      {/* 可做分析（引导：这列能做什么） */}
      {actions.length > 0 && (
        <div className="mb-2.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-muted-foreground/70">可做：</span>
          {actions.map((a) => (
            <span key={a} className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
              {a}
            </span>
          ))}
        </div>
      )}
      {/* 分类：完整分布 + 层级 */}
      {"distribution" in col && (
        <>
          <div className="space-y-1">
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
            <div className="mt-2 text-[11px] text-primary">层级结构：{col.hierarchyLevels.join(" / ")}</div>
          )}
        </>
      )}

      {/* 数值：关键分位 + 异常值（去掉标准差/偏度等冗余技术字段） */}
      {"mean" in col && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <InfoItem label="中位数 / 均值" value={`${fmtNum(col.median)} / ${fmtNum(col.mean)}`} />
          <InfoItem label="四分位距" value={`${fmtNum(col.quantiles.q25)} ~ ${fmtNum(col.quantiles.q75)}`} />
          <InfoItem label="极值" value={`${fmtNum(col.min)} ~ ${fmtNum(col.max)}`} />
          {col.hasOutliers && (
            <InfoItem label="异常值" value={`${col.outlierCount} 个（最高 ${fmtNum(Math.max(...col.outlierValues))}）`} />
          )}
          <InfoItem label="合计" value={fmtNum(col.sum)} />
          <InfoItem label="零值 / 负值" value={`${col.zeroCount} / ${col.negativeCount}`} />
        </div>
      )}

      {/* 日期：范围/粒度 + 缺失（去掉星期/月分布详情，太冗长） */}
      {"minDate" in col && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <InfoItem label="跨度" value={`${col.dateRange} 天`} />
          <InfoItem label="粒度" value={GRANULARITY_LABELS[col.detectedGranularity] ?? col.detectedGranularity} />
          <InfoItem label="连续性" value={col.isContinuous ? "无缺失" : `${col.missingDates.length} 处缺失`} />
          {col.missingDates.length > 0 && (
            <div>
              <div className="text-muted-foreground/70">缺失日期</div>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {col.missingDates.slice(0, 8).map((m, i) => (
                  <span key={i} className="rounded bg-red-50 px-1.5 py-px text-[10px] text-red-600">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 文本：高频词 + 格式（精简：去掉长度限制/有效格式等技术检测） */}
      {!("distribution" in col) && !("mean" in col) && !("minDate" in col) && (
        <div className="space-y-2 text-[11px]">
          {col.topWords.length > 0 && (
            <div>
              <div className="mb-1 text-muted-foreground/70">高频词</div>
              <div className="flex flex-wrap gap-1">
                {col.topWords.slice(0, 10).map((w) => (
                  <span key={w.word} className="rounded bg-muted px-1.5 py-px text-[10px] text-foreground">
                    {w.word} {w.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          {col.samples.length > 0 && (
            <div>
              <div className="mb-1 text-muted-foreground/70">示例</div>
              <div className="flex flex-wrap gap-1">
                {col.samples.slice(0, 5).map((s, i) => (
                  <span key={i} className="rounded bg-muted/50 px-1.5 py-px text-[10px] text-foreground/80">
                    {String(s).length > 30 ? String(s).slice(0, 30) + "…" : String(s)}
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground/70">{label}</div>
      <div className="mt-0.5 truncate text-foreground">{value}</div>
    </div>
  );
}
