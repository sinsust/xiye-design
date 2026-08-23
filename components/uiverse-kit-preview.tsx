"use client";

// Uiverse 精选微组件 · 主题化实时预览渲染器。
// 让内置的每一款 kit 用当前设计 token（var(--primary)/var(--surface)/var(--radius)…）现场渲染，
// 与主画布同步明/暗与视觉风格，做到「就地换件即所见即所得」。

import { useState } from "react";
import type { UiverseKitItem } from "@/data/uiverse-kit";

export function UiverseKitPreview({ item }: { item: UiverseKitItem }) {
  return (
    <div
      className="flex w-full flex-col items-center justify-center gap-4 py-6"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <Node id={item.id} />
      <p className="max-w-md text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
        {item.name} · {item.source}
      </p>
    </div>
  );
}

/** 一大批 kit 的迷你卡片预览（面板网格里缩小展示） */
export function UiverseKitThumb({ item }: { item: UiverseKitItem }) {
  return (
    <div
      className="flex min-h-28 w-full items-center justify-center rounded-lg border p-3"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <Scoped item={item} />
    </div>
  );
}

/** 小尺寸内联渲染（供缩略图复用，避免与代码里 fontSize 冲突） */
function Scoped({ item }: { item: UiverseKitItem }) {
  return <TinyNode id={item.id} />;
}

function Node({ id }: { id: string }) {
  switch (id) {
    case "hero-kicker":
      return (
        <div
          className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))" }}
        >
          <span className="size-1.5 rounded-full" style={{ background: "var(--primary)" }} />
          <span>新上线</span>
          <span style={{ color: "var(--muted-foreground)" }}>· 已服务 100+ 团队</span>
        </div>
      );
    case "btn-glow":
      return (
        <button
          type="button"
          className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground transition-transform duration-300 hover:-translate-y-0.5"
          style={{ background: "var(--primary)" }}
        >
          <span
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{ background: "radial-gradient(120px circle at center, color-mix(in srgb, white 25%, transparent), transparent 70%)" }}
          />
          <span className="relative">立即开始</span>
          <span className="relative transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </button>
      );
    case "btn-outline-line":
      return (
        <button type="button" className="group relative text-sm font-medium">
          <span
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100"
            style={{ background: "var(--primary)" }}
          />
          了解更多
        </button>
      );
    case "btn-soft-shadow":
      return (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5"
          style={{ background: "var(--surface)", color: "var(--foreground)", boxShadow: "var(--shadow)" }}
        >
          保存
        </button>
      );
    case "badge-status":
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--surface))", color: "var(--primary)" }}
        >
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--primary)" }} />
            <span className="relative inline-flex size-1.5 rounded-full" style={{ background: "var(--primary)" }} />
          </span>
          运行中
        </span>
      );
    case "card-spotlight":
      return (
        <div
          className="group w-full max-w-xs rounded-[var(--radius)] border p-6"
          style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))", background: "var(--surface)", boxShadow: "var(--shadow)" }}
        >
          <div className="mb-4 size-9 rounded-[var(--radius)]" style={{ background: "color-mix(in srgb, var(--primary) 15%, var(--surface))" }} />
          <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>标题一</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>一句能说明价值的话。</p>
        </div>
      );
    case "card-border-grow":
      return (
        <div className="relative w-full max-w-xs rounded-[var(--radius)] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="absolute inset-x-4 top-0 h-0.5 origin-center scale-x-0 rounded-full transition-transform duration-300" style={{ background: "var(--primary)" }} />
          <p className="text-sm font-medium">单项说明</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>次要说明文字。</p>
        </div>
      );
    case "input-underline-search":
      return (
        <label className="block w-full max-w-xs">
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>搜索</span>
          <input
            type="search"
            placeholder="输入关键词…"
            className="mt-1 w-full bg-transparent pb-1 text-sm outline-none transition-colors focus:border-[color:var(--primary)]"
            style={{
              color: "var(--foreground)",
              borderBottom: "2px solid color-mix(in srgb, var(--primary) 35%, var(--border))",
            }}
          />
        </label>
      );
    case "toggle-pill":
      return <PillToggle />;
    case "loader-dual-ring":
      return (
        <span className="relative inline-flex size-8">
          <span className="absolute inset-0 animate-spin rounded-full border-2" style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", borderTopColor: "var(--primary)" }} />
          <span className="absolute inset-1 animate-spin rounded-full border-2 [animation-direction:reverse]" style={{ borderColor: "color-mix(in srgb, var(--accent2) 30%, transparent)", borderTopColor: "var(--accent2)" }} />
        </span>
      );
    case "loader-progress":
      return (
        <div className="w-full max-w-xs">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" }}>
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: "40%", background: "linear-gradient(90deg, var(--primary), var(--accent2))", animation: "ukit-indeterminate 1.4s ease-in-out infinite" }}
            />
          </div>
          <style>{`@keyframes ukit-indeterminate { 0% { transform: translateX(-110%); } 100% { transform: translateX(360%); } }`}</style>
        </div>
      );
    default:
      return null;
  }
}

function PillToggle() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        className="relative h-5 w-9 rounded-full transition-colors"
        style={{ background: on ? "var(--primary)" : "var(--muted-foreground)" }}
      >
        <span className="absolute top-0.5 size-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
      </button>
      <span className="text-sm">{on ? "已开启" : "已关闭"}</span>
    </div>
  );
}

/** 缩略态：复用 Node 但裁小字号（面板网格里防溢出） */
function TinyNode({ id }: { id: string }) {
  return (
    <div className="flex w-full items-center justify-center [&_*]:!text-[11px] [&_button]:!scale-90">
      <div className="scale-[0.85]">
        <Node id={id} />
      </div>
    </div>
  );
}