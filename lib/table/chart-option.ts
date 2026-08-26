/**
 * 表格处理 —— 图表配置生成（纯函数，供 AnalysisResultView 使用）
 * 按 AnalysisExecutionResult.chartType 生成 ECharts option（品牌色系）。
 */

import type { AnalysisExecutionResult } from "@/lib/table/types";

/** 品牌色板（Teal/emerald 渐变系 + 辅助色） */
const PALETTE = ["#14b8a6", "#0ea5a4", "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function buildChartOption(r: AnalysisExecutionResult): {
  option: Record<string, unknown>;
  chartType: string;
} {
  switch (r.chartType) {
    case "line":
      return { chartType: "line", option: lineOption(r) };
    case "bar":
      return { chartType: "bar", option: barOption(r) };
    case "pie":
      return { chartType: "pie", option: pieOption(r) };
    case "scatter":
      return { chartType: "scatter", option: scatterOption(r) };
    case "histogram":
      return { chartType: "histogram", option: histogramOption(r) };
    case "boxplot":
      return { chartType: "boxplot", option: boxplotOption(r) };
    case "heatmap":
      return { chartType: "heatmap", option: heatmapOption(r) };
    case "table":
    default:
      return { chartType: "table", option: {} };
  }
}

const baseText = {
  color: "var(--muted-foreground)",
  fontSize: 11,
};

function axisStyle() {
  return {
    axisLine: { lineStyle: { color: "rgba(148,163,184,0.35)" } },
    axisLabel: { color: "var(--muted-foreground)", fontSize: 10 },
    splitLine: { lineStyle: { color: "rgba(148,163,184,0.15)" } },
  };
}

function lineOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const data = (r.data ?? []) as Array<{ x: string; y: number; count: number }>;
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => d.x), boundaryGap: false, ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: [
      {
        type: "line",
        smooth: true,
        symbolSize: 4,
        data: data.map((d) => d.y),
        lineStyle: { width: 2, color: "#14b8a6" },
        itemStyle: { color: "#14b8a6" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(20,184,166,0.28)" },
              { offset: 1, color: "rgba(20,184,166,0.02)" },
            ],
          },
        },
      },
    ],
  };
}

function barOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const data = r.data as unknown;
  // 多 series 形态（分组多维对比 execGroupBar：{categories, series}）
  if (
    data !== null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "categories" in data &&
    "series" in data
  ) {
    const m = data as { categories: string[]; series: Array<{ name: string; data: number[] }> };
    return {
      tooltip: { trigger: "axis" },
      legend: { top: 0, textStyle: baseText, type: "scroll" },
      grid: { left: 44, right: 16, top: 32, bottom: 28 },
      xAxis: { type: "category", data: m.categories, ...axisStyle() },
      yAxis: { type: "value", ...axisStyle() },
      series: m.series.map((s, i) => ({
        name: s.name,
        type: "bar",
        data: s.data,
        barWidth: "26%",
        itemStyle: { borderRadius: [3, 3, 0, 0], color: PALETTE[i % PALETTE.length] },
      })),
    };
  }
  // 单 series 形态（分组聚合 / TopN 排名）
  const items = (r.data ?? []) as Array<{ name: string; value: number }>;
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: items.map((d) => d.name), ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: [
      {
        type: "bar",
        data: items.map((d) => d.value),
        barWidth: "55%",
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(20,184,166,0.9)" },
              { offset: 1, color: "rgba(20,184,166,0.45)" },
            ],
          },
        },
      },
    ],
  };
}

function pieOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const data = (r.data ?? []) as Array<{ name: string; value: number }>;
  return {
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: baseText, type: "scroll" },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        center: ["50%", "46%"],
        itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
        label: { color: "var(--muted-foreground)", fontSize: 10 },
        data: data.map((d, i) => ({ name: d.name, value: d.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };
}

function scatterOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const data = (r.data ?? []) as Array<{ x: number; y: number }>;
  return {
    tooltip: { trigger: "item" },
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "value", ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: [
      {
        type: "scatter",
        data: data.map((d) => [d.x, d.y]),
        symbolSize: 7,
        itemStyle: { color: "rgba(20,184,166,0.65)" },
      },
    ],
  };
}

function histogramOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const data = (r.data ?? []) as Array<{ start: number; end: number; count: number }>;
  return {
    tooltip: {
      trigger: "axis",
      formatter: (params: unknown) => {
        const p = (params as Array<{ dataIndex: number }>)[0];
        const bin = data[p?.dataIndex ?? 0];
        return bin ? `${fmt(bin.start)} ~ ${fmt(bin.end)}：${bin.count} 条` : "";
      },
    },
    grid: { left: 44, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: data.map((d) => `${fmt(d.start)}~`), ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.count),
        barWidth: "92%",
        itemStyle: {
          color: {
            type: "linear", x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(20,184,166,0.85)" },
              { offset: 1, color: "rgba(20,184,166,0.35)" },
            ],
          },
        },
      },
    ],
  };
}

function boxplotOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const d = (r.data ?? {}) as { min: number; q1: number; median: number; q3: number; max: number; count: number };
  const values = [d.min, d.q1, d.median, d.q3, d.max];
  return {
    tooltip: { trigger: "item" },
    grid: { left: 48, right: 16, top: 24, bottom: 28 },
    xAxis: { type: "category", data: [r.name], ...axisStyle() },
    yAxis: { type: "value", ...axisStyle() },
    series: [
      {
        type: "boxplot",
        data: [values],
        itemStyle: { color: "rgba(20,184,166,0.4)", borderColor: "#0ea5a4", borderWidth: 1.5 },
      },
    ],
  };
}

function heatmapOption(r: AnalysisExecutionResult): Record<string, unknown> {
  const d = (r.data ?? {}) as { x: string[]; y: string[]; values: number[][] };
  const rows: Array<[number, number, number]> = [];
  d.values.forEach((row, i) => {
    row.forEach((v, j) => rows.push([j, i, v]));
  });
  return {
    tooltip: {
      position: "top",
      formatter: (p: unknown) => {
        const pp = p as { value: [number, number, number] };
        return `${d.y[pp.value[1]]} × ${d.x[pp.value[0]]}：${pp.value[2]}`;
      },
    },
    grid: { left: 56, right: 16, top: 16, bottom: 56 },
    xAxis: { type: "category", data: d.x, ...axisStyle(), splitArea: { show: true } },
    yAxis: { type: "category", data: d.y, ...axisStyle(), splitArea: { show: true } },
    visualMap: {
      min: 0,
      max: Math.max(1, ...rows.map((r) => r[2])),
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#f0fdfa", "#5eead4", "#0d9488"] },
      textStyle: { color: "var(--muted-foreground)", fontSize: 10 },
    },
    series: [{ type: "heatmap", data: rows, label: { show: true, fontSize: 9 } }],
  };
}

function fmt(n: number): string {
  if (Math.abs(n) >= 10000) return n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}
