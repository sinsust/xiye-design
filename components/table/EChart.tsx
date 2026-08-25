"use client";

/**
 * ECharts 轻封装（echarts 原生 + React ref，不依赖年久失修的 echarts-for-react）
 * 主题跟随 CSS：读根节点 --primary 等变量生成主色，明暗自适应。
 */

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

/** 从 CSS 变量取主色（品牌 Teal 系），暗色主题自动匹配 */
export function useThemeColors(): { primary: string; text: string; muted: string; grid: string } {
  if (typeof window === "undefined") {
    return { primary: "#14b8a6", text: "#64748b", muted: "#94a3b8", grid: "rgba(148,163,184,0.25)" };
  }
  const styles = getComputedStyle(document.documentElement);
  const primary = styles.getPropertyValue("--primary").trim() || "#14b8a6";
  const text = styles.getPropertyValue("--muted-foreground").trim() || "#64748b";
  const grid = "rgba(148,163,184,0.22)";
  return { primary, text, muted: text, grid };
}

export function EChart({ option, height = 280 }: { option: echarts.EChartsOption; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = echarts.init(containerRef.current);
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option as never, true);
  }, [option]);

  return <div ref={containerRef} style={{ height }} className="w-full" />;
}
