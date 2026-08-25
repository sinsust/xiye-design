"use client";

// 可点选元素包装：无交互时原样渲染（不包层、不动布局），有交互时挂普通 div + GSAP 播放动效。
// id 优先用语义化（scope:componentId:variantId:slot，刷新稳定、持久化不丢）；
// 无 context（如抽屉缩略图）时回退 useId。
//
// 动画引擎：GSAP（全插件免费）。挂载即播放 / 拖拽类由 lib/interaction-motion 的
// applyInteractions 处理；hover / 磁吸 / 光标气泡等事件驱动交互在此内联处理。

import { useId, useState, useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { useSkeletonStore } from "@/lib/skeleton-store";
import { applyInteractions } from "@/lib/interaction-motion";
import { useBuilderElementId } from "@/lib/builder-element-context";

export function Selectable({
  label,
  display = "block",
  children,
}: {
  label: string;
  display?: "block" | "inline-flex";
  children: ReactNode;
}) {
  const ctx = useBuilderElementId();
  // 语义化 id（同一组件+变体下稳定，刷新不丢）；无 context 时回退 useId
  const fallbackId = useId();
  const id = ctx
    ? `${ctx.scope}:${ctx.componentId}:${ctx.variantId}:${ctx.nextSlot()}`
    : fallbackId;
  const interactions = useSkeletonStore((s) => s.elementInteractions[id]) ?? [];

  const ref = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<{ x: number; y: number } | null>(null);

  const hasMagnetic = interactions.includes("magnetic-follow");
  const hasCursor = interactions.includes("cursor-bubble");
  const hasCluster = interactions.includes("cluster-hover");
  const hasDrag = interactions.includes("inertia-drag");
  const hasAny = interactions.length > 0;

  // —— 挂载即播放 / 拖拽类交互（GSAP，随 useGSAP 自动清理）——
  useGSAP(
    () => {
      if (!ref.current || !hasAny) return;
      applyInteractions(ref.current, interactions);
    },
    { scope: ref, dependencies: [interactions.join(",")] },
  );

  // —— 磁吸跟随：quickTo 在 GSAP context 内创建，随 useGSAP 自动清理 ——
  const xTo = useRef<((v: number) => void) | null>(null);
  const yTo = useRef<((v: number) => void) | null>(null);
  useGSAP(
    () => {
      if (!ref.current || !hasMagnetic) return;
      xTo.current = gsap.quickTo(ref.current, "x", { duration: 0.4, ease: "power3.out" });
      yTo.current = gsap.quickTo(ref.current, "y", { duration: 0.4, ease: "power3.out" });
    },
    { scope: ref, dependencies: [hasMagnetic] },
  );

  // —— 无交互：原样渲染（不包层、不动布局）——
  if (!hasAny) return <>{children}</>;

  const onMove = (e: React.MouseEvent) => {
    if (hasMagnetic && xTo.current && yTo.current) {
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      xTo.current((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo.current((e.clientY - (r.top + r.height / 2)) * 0.25);
    }
    if (hasCursor) setBubble({ x: e.clientX, y: e.clientY });
  };
  const onEnter = () => {
    if (hasCursor) setBubble({ x: 0, y: 0 });
    if (hasCluster && ref.current)
      gsap.to(ref.current, {
        scale: 1.05,
        y: -8,
        boxShadow: "0 18px 40px -12px rgba(0,0,0,0.25)",
        duration: 0.3,
        ease: "power2.out",
      });
  };
  const onLeave = () => {
    if (hasMagnetic && xTo.current && yTo.current) {
      xTo.current(0);
      yTo.current(0);
    }
    if (hasCursor) setBubble(null);
    if (hasCluster && ref.current)
      gsap.to(ref.current, {
        scale: 1,
        y: 0,
        boxShadow: "0 0px 0px rgba(0,0,0,0)",
        duration: 0.3,
        ease: "power2.out",
      });
  };

  return (
    <div
      ref={ref}
      data-element-id={id}
      style={{ display, cursor: hasDrag ? "grab" : undefined }}
      onMouseMove={hasMagnetic || hasCursor ? onMove : undefined}
      onMouseEnter={hasCursor || hasCluster ? onEnter : undefined}
      onMouseLeave={hasCursor || hasCluster || hasMagnetic ? onLeave : undefined}
    >
      {children}
      {hasCursor && bubble ? (
        <div
          className="pointer-events-none fixed z-[9999] rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-medium text-primary-foreground"
          style={{ left: bubble.x + 14, top: bubble.y - 10, transform: "translate(-50%, -50%)" }}
        >
          click
        </div>
      ) : null}
    </div>
  );
}
