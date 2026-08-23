// 辅助页（Auxiliary）页面骨架数据：「加载反馈」一个组件，7 种加载效果作为变体。
// 用户要求：加载反馈不是独立分类，而是辅助页里一个组件，7 个不同效果用变体承载。
// 所有加载态仅沿用当前视觉契约的 token（surface / accent / text），不新增色板。

import type { SkeletonPage } from "./types";

export const FEEDBACK_PAGE: SkeletonPage = {
  id: "feedback",
  name: "辅助",
  icon: "Loader2",
  description: "辅助工具与反馈组件，提升等待体验与系统反馈",
  components: [
    {
      id: "loader-feedback",
      name: "加载反馈",
      icon: "Loader2",
      description: "Spinner / 进度条 / 骨架屏 / 按钮加载等 7 种加载状态",
      variants: [
        {
          id: "fb_spinner_ring",
          name: "环形 Spinner",
          description: "accent 高亮圆环匀速旋转",
          tags: ["加载", "反馈"],
          prompt:
            "Build an indeterminate loading spinner: a ring using the accent color as the leading arc and the surface color as the track (borderTopColor: var(--primary), borderColor: var(--surface)), rotating infinitely with CSS (animate-spin / 0.8s linear infinite). Centered on a neutral canvas, 3 size steps (16/24/32).",
          code: `export function LoaderSpinner() {
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <span className="size-8 animate-spin rounded-full border-[3px]" style={{ borderColor: "var(--surface)", borderTopColor: "var(--primary)" }} />
    </div>
  );
}`,
          interaction: "0.8s 线性无限旋转，accent 高亮 / surface 轨道",
        },
        {
          id: "fb_progress_linear",
          name: "线性进度条",
          description: "4px accent 填充 + 百分比文案",
          tags: ["加载", "进度"],
          prompt:
            "Build a determinate linear progress bar: a ~4px track in the surface color with an accent-colored fill of the current percentage, plus a small muted percentage caption below. Used for uploads / downloads / multi-step forms.",
          code: `export function LoaderProgress() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-4 px-10" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-xs overflow-hidden rounded-full" style={{ height: 4, background: "var(--surface)" }}>
        <div className="h-full rounded-full" style={{ width: "62%", background: "var(--primary)" }} />
      </div>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>正在上传 · 62%</p>
    </div>
  );
}`,
          interaction: "4px 轨道，accent 填充，完成收敛到成功态",
        },
        {
          id: "fb_circular_ring",
          name: "圆环进度",
          description: "conic-gradient 弧形 + 居中百分比",
          tags: ["加载", "进度"],
          prompt:
            "Build a circular determinate progress indicator: a conic-gradient ring (accent for completed arc, surface for remainder) with the percentage centered inside. Compact (12/20/40px), suitable for tight spaces and in-button/avatar contexts.",
          code: `export function LoaderCircular() {
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="relative size-16 rounded-full" style={{ background: "conic-gradient(var(--primary) 0 75%, var(--surface) 75% 100%)" }}>
        <div className="absolute inset-1.5 flex items-center justify-center rounded-full text-sm font-semibold" style={{ background: "var(--background)" }}>
          75%
        </div>
      </div>
    </div>
  );
}`,
          interaction: "弧形剩余量 + 居中文本，12/20/40 三档",
        },
        {
          id: "fb_skeleton_lines",
          name: "行 + 卡片骨架",
          description: "surface 占位块还原标题与内容结构",
          tags: ["加载", "占位"],
          prompt:
            "Build a skeleton screen that mirrors the real content layout: muted surface-colored blocks (lines for headings/text, a tall block for a media/hero area), fixed structure so the page does not shift when real content loads. Uses var(--surface) only.",
          code: `export function LoaderSkeleton() {
  return (
    <div className="flex h-40 flex-col justify-center gap-3 px-10" style={{ background: "var(--background)" }}>
      <div className="h-3 w-2/3 rounded" style={{ background: "var(--surface)" }} />
      <div className="h-3 w-1/3 rounded" style={{ background: "var(--surface)" }} />
      <div className="mt-2 h-20 rounded-xl" style={{ background: "var(--surface)" }} />
    </div>
  );
}`,
          interaction: "surface 占位块，结构稳定不位移",
        },
        {
          id: "fb_shimmer_sweep",
          name: "流光骨架",
          description: "accent 低透明流光斜扫过占位块",
          tags: ["加载", "微光"],
          prompt:
            "Build a shimmer sweep over skeleton placeholders: a diagonal moving highlight (accent at ~8% opacity, or a white gradient) translated across the surface-colored blocks via a keyframe animation (~1.4s loop). Use only for shallow content layers, avoid strong flicker.",
          code: `export function LoaderShimmer() {
  const k = "fb-sweep";
  return (
    <>
      <style>{'@keyframes ' + k + '{0%{background-position:120% 0}100%{background-position:-120% 0}}'}</style>
      <div className="flex h-40 flex-col justify-center gap-3 px-10" style={{ background: "var(--background)" }}>
        {[12, 10, 72].map((h, i) => (
          <div key={i} className="rounded" style={{ height: h, backgroundImage: "linear-gradient(100deg,var(--surface) 35%,color-mix(in srgb, var(--primary) 8%, transparent) 50%,var(--surface) 65%)", backgroundSize: "200% 100%", animation: k + " 1.4s linear infinite" }} />
        ))}
      </div>
    </>
  );
}`,
          interaction: "浅表层斜向流光 1.4s 循环，accent 8% 低亮",
        },
        {
          id: "fb_button_spin",
          name: "按钮内加载",
          description: "图标转圈 + 文案置灰，禁用防重复",
          tags: ["加载", "按钮"],
          prompt:
            "Build a button in loading state: an inline spinning ring replaces/joins the label (e.g. '提交中…'), the button is disabled to prevent double submission, and it keeps readable contrast (text on the primary fill).",
          code: `export function LoaderButton() {
  return (
    <div className="flex h-40 items-center justify-center" style={{ background: "var(--background)" }}>
      <button className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white opacity-80" style={{ background: "var(--primary)" }} disabled>
        <span className="size-4 animate-spin rounded-full border-2" style={{ borderColor: "var(--on-primary)", borderTopColor: "transparent" }} />
        提交中…
      </button>
    </div>
  );
}`,
          interaction: "图标转圈 + 禁用，保持与背景对比度",
        },
        {
          id: "fb_page_center",
          name: "居中页级加载",
          description: "居中 Spinner + 文案，避免白屏",
          tags: ["加载", "页面"],
          prompt:
            "Build a full-page loader for initial open or before core content: a centered spinner (accent arc on surface track) with a short muted caption. If the wait may exceed ~2s, show progress or a message instead of a blank screen.",
          code: `export function LoaderPage() {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3" style={{ background: "var(--background)" }}>
      <span className="size-9 animate-spin rounded-full border-[3px]" style={{ borderColor: "var(--surface)", borderTopColor: "var(--primary)" }} />
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>正在加载…</p>
    </div>
  );
}`,
          interaction: "居中 Spinner + 文案；超 2s 给进度/文案防白屏",
        },
      ],
    },
  ],
};