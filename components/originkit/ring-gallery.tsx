"use client";

import { useEffect, useMemo, useRef } from "react";

// 环形旋转图廊 · 完整参数版（Originkit Ingestion：Image Group Circle）
// 由 app/builder/previews.tsx → RingPreviewImpl 抽取为可复用组件。
// rAF 仅动 transform；尊重 prefers-reduced-motion。

export type RingDir = "cw" | "ccw" | "alternate";

export interface RingConfig {
  rings: number;
  innerRadius: number;
  ringGap: number;
  cardWidth: number;
  cardHeight: number;
  direction: RingDir;
  speed: number;
  rounded: number;
  tilt: number;
  fit: "cover" | "contain";
  count: number;
}

const RING_DEFAULTS: RingConfig = {
  rings: 3,
  innerRadius: 110,
  ringGap: 120,
  cardWidth: 72,
  cardHeight: 92,
  direction: "cw",
  speed: 7,
  rounded: 6,
  tilt: 6,
  fit: "cover",
  count: 12,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function RingGallery(props: Partial<RingConfig>) {
  const {
    rings = RING_DEFAULTS.rings,
    innerRadius = RING_DEFAULTS.innerRadius,
    ringGap = RING_DEFAULTS.ringGap,
    cardWidth = RING_DEFAULTS.cardWidth,
    cardHeight = RING_DEFAULTS.cardHeight,
    direction = RING_DEFAULTS.direction,
    speed = RING_DEFAULTS.speed,
    rounded = RING_DEFAULTS.rounded,
    tilt = RING_DEFAULTS.tilt,
    fit = RING_DEFAULTS.fit,
    count = RING_DEFAULTS.count,
  } = props;

  const photos = useMemo(
    () =>
      Array.from(
        { length: count },
        (_, i) => "https://picsum.photos/seed/xiye-ring-" + (i + 1) + "/400/300",
      ),
    [count],
  );

  const cards = useMemo(() => {
    const ringN = Math.max(1, Math.round(rings));
    const rnd = mulberry32(0x9e3779b1);
    const radii = Array.from(
      { length: ringN },
      (_, r) => Math.max(1, innerRadius + r * ringGap),
    );
    const totalCirc = radii.reduce((s, rad) => s + 2 * Math.PI * rad, 0);
    const out: {
      angle: number;
      radius: number;
      dir: number;
      tilt: number;
      img: string;
    }[] = [];
    radii.forEach((rad, r) => {
      const per = Math.max(2, Math.round((count * (2 * Math.PI * rad)) / totalCirc));
      for (let j = 0; j < per; j++) {
        out.push({
          angle: (j / per) * Math.PI * 2 + r * 0.6,
          radius: rad,
          dir: direction === "ccw" ? -1 : direction === "alternate" ? (r % 2 === 0 ? 1 : -1) : 1,
          tilt: (rnd() * 2 - 1) * tilt,
          img: photos[out.length % photos.length],
        });
      }
    });
    return out;
  }, [rings, innerRadius, ringGap, count, direction, tilt, photos]);

  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const angles = cards.map((c) => c.angle);
    let raf = 0;
    let last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.7;
      last = now;
      for (let i = 0; i < cards.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        angles[i] += speed * 0.0008 * cards[i].dir * (dt / 16.7);
        el.style.transform =
          "translate(" +
          (Math.cos(angles[i]) * cards[i].radius).toFixed(2) +
          "px, " +
          (Math.sin(angles[i]) * cards[i].radius).toFixed(2) +
          "px) rotate(" +
          cards[i].tilt.toFixed(2) +
          "deg";
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cards, speed]);

  const size = (innerRadius + ringGap * (Math.max(1, rings) - 1)) * 2 + cardHeight + 40;

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden" style={{ height: size }}>
      {cards.map((c, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="absolute overflow-hidden"
          style={{
            left: "50%",
            top: "50%",
            width: cardWidth,
            height: cardHeight,
            marginLeft: -cardWidth / 2,
            marginTop: -cardHeight / 2,
            borderRadius: rounded,
            boxShadow: "0 18px 40px rgba(0,0,0,0.16)",
            transform:
              "translate(" +
              (Math.cos(c.angle) * c.radius).toFixed(2) +
              "px, " +
              (Math.sin(c.angle) * c.radius).toFixed(2) +
              "px) rotate(" +
              c.tilt.toFixed(2) +
              "deg)",
            willChange: "transform",
            pointerEvents: "none",
          }}
        >
          <img
            src={c.img}
            alt=""
            draggable={false}
            className="h-full w-full"
            style={{ objectFit: fit }}
          />
        </div>
      ))}
    </div>
  );
}