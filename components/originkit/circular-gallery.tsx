// 圆形画廊 · 滚动驱动环形图廊（Originkit Circular Gallery）
// 卡片沿圆环均匀排布，滚动推进环转（入场缩放抬升 + 首帧淡入），
// 指针悬停卡片外翻、放大并沿径向推出，视差轻微倾斜。
// rAF 仅动 transform；纯 React 零依赖；默认图走项目占位图库（A 层精图）。
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { premiumImage } from "@/lib/placeholder-images";

type ImageInput = string | { src?: string } | null | undefined;

export interface CircularGalleryCard {
  width?: number;
  height?: number;
  radius?: number;
}

export interface CircularGalleryProps {
  images?: ImageInput[];
  background?: string;
  count?: number;
  ringRadius?: number;
  card?: CircularGalleryCard;
  zoom?: number;
  zoomOffset?: number;
  scrollSensitivity?: number;
  smoothing?: number;
  style?: CSSProperties;
}

const DEFAULT_CARD: Required<CircularGalleryCard> = {
  width: 40,
  height: 45,
  radius: 4,
};

const DEFAULT_SCROLL_SENSITIVITY = 5;
const DEFAULT_SMOOTHING = 10;
const DEFAULT_BACKGROUND = "#000000";
const DEFAULT_COUNT = 25;
const DEFAULT_RING_RADIUS = 224;
const DEFAULT_ZOOM = 5;
const DEFAULT_ZOOM_OFFSET = 0;

const TAU = Math.PI * 2;
const FOCUS_ANGLE = (Math.PI * 3) / 2;
const CARD_PERSPECTIVE = 1000;
const STAGE_PERSPECTIVE = 2000;
const HOVER_LERP = 0.15;
const HOVER_REACH = 5;
const HOVER_STRENGTH = 5;
const HOVER_PARALLAX = 5;
const ENTRY_CARDS = 2;
const TOUCH_GAIN = 2.2;
const WHEEL_CLAMP = 400;
const PLACEHOLDER_COUNT = 12;

const DEFAULT_IMAGES = Array.from({ length: 10 }, (_, i) =>
  premiumImage(i + 1, { w: 800 }),
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

function resolveSrc(item: ImageInput): string | null {
  if (!item) return null;
  if (typeof item === "string") return item || null;
  const src = item.src;
  return typeof src === "string" && src ? src : null;
}

function placeholderFill(index: number): string {
  const hue = (index * 47 + 210) % 360;
  return `linear-gradient(150deg, hsl(${hue} 38% 30%), hsl(${
    (hue + 45) % 360
  } 52% 8%))`;
}

interface CardState {
  angle: number;
  currentRotation: number;
  targetRotation: number;
  currentX: number;
  targetX: number;
  currentY: number;
  targetY: number;
  currentScale: number;
  targetScale: number;
}

interface Scene {
  cards: CardState[];
  parallax: {
    currentX: number;
    targetX: number;
    currentY: number;
    targetY: number;
    currentZ: number;
    targetZ: number;
  };
  ring: { x: number; y: number; rotation: number; scale: number };
  progressTarget: number;
  progressCurrent: number;
  entry: number;
}

function cardAngle(index: number, count: number): number {
  return (index / Math.max(1, count)) * TAU + FOCUS_ANGLE;
}

function makeCard(index: number, count: number): CardState {
  return {
    angle: cardAngle(index, count),
    currentRotation: 0,
    targetRotation: 0,
    currentX: 0,
    targetX: 0,
    currentY: 0,
    targetY: 0,
    currentScale: 1,
    targetScale: 1,
  };
}

function syncCards(scene: Scene, count: number): void {
  if (scene.cards.length === count) return;
  const next: CardState[] = [];
  for (let i = 0; i < count; i += 1) {
    const previous = scene.cards[i];
    if (previous) {
      previous.angle = cardAngle(i, count);
      next.push(previous);
    } else {
      next.push(makeCard(i, count));
    }
  }
  scene.cards = next;
}

interface Frame {
  count: number;
  ringRadius: number;
  baseScale: number;
  hover: boolean;
  hoverRadius: number;
  falloff: number;
  push: number;
  grow: number;
  tilt: number;
  twist: number;
  scrollLerp: number;
  scrollTotalPx: number;
  entryFraction: number;
  lapProgress: number;
  spanDeg: number;
  zoomScale: number;
  lift: number;
}

export default function CircularGallery({
  images = DEFAULT_IMAGES,
  background = DEFAULT_BACKGROUND,
  count = DEFAULT_COUNT,
  ringRadius = DEFAULT_RING_RADIUS,
  card,
  zoom = DEFAULT_ZOOM,
  zoomOffset = DEFAULT_ZOOM_OFFSET,
  scrollSensitivity = DEFAULT_SCROLL_SENSITIVITY,
  smoothing = DEFAULT_SMOOTHING,
  style,
}: CircularGalleryProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pointerFine, setPointerFine] = useState(false);
  const cardOpts = { ...DEFAULT_CARD, ...card };
  const source = useMemo<(string | null)[]>(() => {
    const resolved = (images ?? []).map(resolveSrc).filter(Boolean);
    return resolved.length
      ? (resolved as string[])
      : Array.from({ length: PLACEHOLDER_COUNT }, () => null);
  }, [images]);
  const cardCount = Math.max(1, Math.round(count));
  const totalCards = Math.max(1, ENTRY_CARDS + (cardCount - 1));
  const entryFraction = ENTRY_CARDS / totalCards;
  const spanDeg = ((cardCount - 1) * 360) / cardCount;
  const lapProgress =
    (1 - entryFraction) * (cardCount / Math.max(1, cardCount - 1));
  const span = 2 * ringRadius + Math.hypot(cardOpts.width, cardOpts.height);
  const baseScale =
    size.width > 0 && size.height > 0 && span > 0
      ? Math.max(0.01, Math.min(1, Math.min(size.width, size.height) / span))
      : 1;
  const scrollLerp = clamp(0.16 - clamp(smoothing, 0, 10) * 0.012, 0.03, 0.16);
  const scrollPerCard = 400 - clamp(scrollSensitivity, 0, 10) * 32;
  const scrollTotalPx = Math.max(1, scrollPerCard * totalCards);
  const hoverRadius = (100 + HOVER_REACH * 80) * baseScale;
  const zoomScale = clamp(zoom, 0.5, 20) * baseScale;
  const lift = ringRadius * zoomScale + zoomOffset;
  const scene = useRef<Scene>({
    cards: [],
    parallax: {
      currentX: 0,
      targetX: 0,
      currentY: 0,
      targetY: 0,
      currentZ: 0,
      targetZ: 0,
    },
    ring: { x: 0, y: 0, rotation: 0, scale: 1 },
    progressTarget: 0,
    progressCurrent: 0,
    entry: 0,
  });
  const frame = useRef<Frame>({
    count: cardCount,
    ringRadius,
    baseScale,
    hover: false,
    hoverRadius,
    falloff: 1,
    push: 0,
    grow: 0,
    tilt: 0,
    twist: 0,
    scrollLerp,
    scrollTotalPx,
    entryFraction,
    lapProgress,
    spanDeg,
    zoomScale,
    lift,
  });
  frame.current = {
    count: cardCount,
    ringRadius,
    baseScale,
    hover: pointerFine,
    hoverRadius,
    falloff: Math.max(1, hoverRadius / 2),
    push: HOVER_STRENGTH * 10,
    grow: HOVER_STRENGTH * 0.06,
    tilt: HOVER_PARALLAX * 3,
    twist: HOVER_PARALLAX,
    scrollLerp,
    scrollTotalPx,
    entryFraction,
    lapProgress,
    spanDeg,
    zoomScale,
    lift,
  };

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setPointerFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const paint = () => {
      const config = frame.current;
      const state = scene.current;
      const weight = 1 - state.entry;
      const stage = stageRef.current;
      if (stage) {
        const { currentX, currentY, currentZ } = state.parallax;
        stage.style.transform = `rotate(${currentZ * weight}deg) rotateX(${
          currentX * weight
        }deg) rotateY(${currentY * weight}deg)`;
      }
      const ringNode = ringRef.current;
      if (ringNode) {
        const { x, y, rotation, scale } = state.ring;
        ringNode.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rotation}deg) scale(${scale})`;
      }
      for (let i = 0; i < state.cards.length; i += 1) {
        const node = cardRefs.current[i];
        if (!node) continue;
        const item = state.cards[i];
        const x =
          config.ringRadius * Math.cos(item.angle) +
          item.currentX * weight;
        const y =
          config.ringRadius * Math.sin(item.angle) +
          item.currentY * weight;
        const spin = (item.angle * 180) / Math.PI + 90;
        const twistY = item.currentRotation * weight;
        const scale = 1 + (item.currentScale - 1) * weight;
        node.style.transform = `perspective(${CARD_PERSPECTIVE}px) translate3d(${x}px, ${y}px, 0) rotate(${spin}deg) rotateY(${twistY}deg) scale(${scale})`;
      }
    };
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.064, (now - last) / 1000) : 1 / 60;
      last = now;
      const config = frame.current;
      const state = scene.current;
      syncCards(state, config.count);
      const sk = 1 - Math.pow(1 - config.scrollLerp, dt * 60);
      state.progressCurrent +=
        (state.progressTarget - state.progressCurrent) * sk;
      const lapEnd = config.entryFraction + config.lapProgress;
      if (state.progressCurrent >= lapEnd) {
        state.progressCurrent -= config.lapProgress;
        state.progressTarget -= config.lapProgress;
      }
      const progress = state.progressCurrent;
      const entry = smoothstep(
        clamp(progress / config.entryFraction, 0, 1),
      );
      const ride =
        config.entryFraction < 1
          ? Math.max(
              0,
              (progress - config.entryFraction) /
                (1 - config.entryFraction),
            )
          : 0;
      state.entry = entry;
      const k = 1 - Math.pow(1 - HOVER_LERP, dt * 60);
      const p = state.parallax;
      p.currentX += (p.targetX - p.currentX) * k;
      p.currentY += (p.targetY - p.currentY) * k;
      p.currentZ += (p.targetZ - p.currentZ) * k;
      for (const item of state.cards) {
        item.currentRotation +=
          (item.targetRotation - item.currentRotation) * k;
        item.currentScale += (item.targetScale - item.currentScale) * k;
        item.currentX += (item.targetX - item.currentX) * k;
        item.currentY += (item.targetY - item.currentY) * k;
      }
      state.ring.x = 0;
      state.ring.scale =
        config.baseScale + (config.zoomScale - config.baseScale) * entry;
      state.ring.y = config.lift * entry;
      state.ring.rotation = -ride * config.spanDeg;
      paint();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const state = scene.current;
    const advance = (deltaPx: number) => {
      state.progressTarget = Math.max(
        0,
        state.progressTarget + deltaPx / frame.current.scrollTotalPx,
      );
    };
    const spent = (delta: number) => delta < 0 && state.progressTarget <= 0;
    const onWheel = (event: WheelEvent) => {
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      else if (event.deltaMode === 2) delta *= node.clientHeight || 800;
      delta = clamp(delta, -WHEEL_CLAMP, WHEEL_CLAMP);
      if (spent(delta)) return;
      event.preventDefault();
      advance(delta);
    };
    let touchY: number | null = null;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (y == null || touchY == null) return;
      const delta = clamp(
        (touchY - y) * TOUCH_GAIN,
        -WHEEL_CLAMP,
        WHEEL_CLAMP,
      );
      touchY = y;
      if (spent(delta)) return;
      if (event.cancelable) event.preventDefault();
      advance(delta);
    };
    const onTouchEnd = () => {
      touchY = null;
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const handleMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const config = frame.current;
    const state = scene.current;
    if (!config.hover) return;
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const centreX = rect.width / 2;
    const centreY = rect.height / 2;
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const percentX = centreX ? (pointerX - centreX) / centreX : 0;
    const percentY = centreY ? (pointerY - centreY) / centreY : 0;
    state.parallax.targetY = percentX * config.tilt;
    state.parallax.targetX = -percentY * config.tilt;
    state.parallax.targetZ = (percentX + percentY) * config.twist;
    for (const item of state.cards) {
      const cardX =
        centreX +
        config.baseScale *
          (config.ringRadius * Math.cos(item.angle) + item.currentX);
      const cardY =
        centreY +
        config.baseScale *
          (config.ringRadius * Math.sin(item.angle) + item.currentY);
      const distance = Math.hypot(pointerX - cardX, pointerY - cardY);
      if (distance < config.hoverRadius) {
        const force = Math.max(0, 1 - distance / config.falloff);
        const move = config.push * force;
        item.targetRotation = 180 * force;
        item.targetScale = 1 + config.grow * force;
        item.targetX = move * Math.cos(item.angle);
        item.targetY = move * Math.sin(item.angle);
      } else {
        item.targetRotation = 0;
        item.targetScale = 1;
        item.targetX = 0;
        item.targetY = 0;
      }
    }
  };

  const handleLeave = () => {
    const state = scene.current;
    for (const item of state.cards) {
      item.targetRotation = 0;
      item.targetScale = 1;
      item.targetX = 0;
      item.targetY = 0;
    }
    state.parallax.targetX = 0;
    state.parallax.targetY = 0;
    state.parallax.targetZ = 0;
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background,
        touchAction: "manipulation",
        ...style,
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transformStyle: "preserve-3d",
          perspective: `${STAGE_PERSPECTIVE}px`,
          willChange: "transform",
        }}
      >
        <div
          ref={ringRef}
          style={{
            position: "relative",
            width: 0,
            height: 0,
            transformOrigin: "center",
            willChange: "transform",
          }}
        >
          {Array.from({ length: cardCount }, (_, index) => {
            const src = source[index % source.length];
            return (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  marginLeft: -cardOpts.width / 2,
                  marginTop: -cardOpts.height / 2,
                  width: cardOpts.width,
                  height: cardOpts.height,
                  borderRadius: cardOpts.radius,
                  overflow: "hidden",
                  transformOrigin: "center center",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "visible",
                  willChange: "transform",
                }}
              >
                {src ? (
                  <img
                    src={src}
                    alt=""
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                      userSelect: "none",
                      backfaceVisibility: "hidden",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background: placeholderFill(index),
                      backfaceVisibility: "hidden",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
