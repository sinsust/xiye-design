// 螺旋图廊 · Canvas 螺旋图片流（Originkit Spiral Images）
// 图片沿螺旋轨迹盘旋流动，远端随衰减缩小、两端按比例淡入淡出，圆角/间距/圈数可调。
// 纯 Canvas 2D + rAF，零第三方依赖；默认图走项目占位图库（A 层精图）。
"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { premiumImages } from "@/lib/placeholder-images";

const TWO_PI = Math.PI * 2;

interface SpiralImage {
  src?: string;
}

interface SpiralImagesProps {
  images?: SpiralImage[];
  turns?: number;
  speed?: number;
  spacing?: number;
  spread?: number;
  sizeAttenuation?: number;
  imageSize?: number;
  fadeIn?: number;
  fadeOut?: number;
  cornerRadius?: number;
  style?: CSSProperties;
}

const DEFAULT_IMAGES: SpiralImage[] = premiumImages(14, { w: 800 }).map(
  (src) => ({ src }),
);

export default function SpiralImages(props: SpiralImagesProps) {
  const {
    images = DEFAULT_IMAGES,
    turns = 3.5,
    speed = 2,
    spacing = 5,
    spread = 6,
    sizeAttenuation = 2,
    imageSize = 200,
    fadeIn = 20,
    fadeOut = 0,
    cornerRadius = 5,
    style,
  } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const progressRef = useRef(0);
  const lastRef = useRef(0);
  const imgsRef = useRef<(HTMLImageElement | null)[]>([]);
  const items: SpiralImage[] = images.length > 0 ? images : DEFAULT_IMAGES;
  const srcKey = items.map((im) => im?.src || "").join("|");

  useEffect(() => {
    imgsRef.current = items.map((im) => {
      if (!im?.src) return null;
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.src = im.src;
      return el;
    });
  }, [srcKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(
      2,
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
    );
    let w = 0;
    let h = 0;
    const resize = () => {
      w = container.clientWidth || 600;
      h = container.clientHeight || 600;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const spiral = (n: number, R: number) => {
      const ang = n * turns * TWO_PI;
      const rad = R * (1 - n);
      return { x: rad * Math.cos(ang), y: -rad * Math.sin(ang) };
    };
    const M = 2000;
    const cum = new Float32Array(M + 1);
    let prev = spiral(0, 1);
    for (let k = 1; k <= M; k++) {
      const pt = spiral(k / M, 1);
      const dx = pt.x - prev.x;
      const dy = pt.y - prev.y;
      cum[k] = cum[k - 1] + Math.sqrt(dx * dx + dy * dy);
      prev = pt;
    }
    const total = cum[M] || 1;
    const K = 1024;
    const nForArc = new Float32Array(K + 1);
    let j = 0;
    for (let a = 0; a <= K; a++) {
      const target = (a / K) * total;
      while (j < M && cum[j + 1] < target) j++;
      const seg = cum[j + 1] - cum[j];
      const f2 = seg > 0 ? (target - cum[j]) / seg : 0;
      nForArc[a] = (j + f2) / M;
    }
    const arcToN = (s: number) => {
      const x = Math.max(0, Math.min(K, s * K));
      const i = Math.floor(x);
      const a = nForArc[i];
      const b = nForArc[Math.min(i + 1, K)];
      return a + (b - a) * (x - i);
    };
    const roundRect = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      rw: number,
      rh: number,
      r: number,
    ) => {
      const rr = Math.min(r, rw / 2, rh / 2);
      c.beginPath();
      c.moveTo(x + rr, y);
      c.arcTo(x + rw, y, x + rw, y + rh, rr);
      c.arcTo(x + rw, y + rh, x, y + rh, rr);
      c.arcTo(x, y + rh, x, y, rr);
      c.arcTo(x, y, x + rw, y, rr);
      c.closePath();
    };
    const draw = (now: number) => {
      const dt = lastRef.current ? (now - lastRef.current) / 1000 : 0;
      lastRef.current = now;
      const f = Math.min(dt, 0.1);
      progressRef.current = (progressRef.current + speed * f) % 100;
      const L = progressRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = 0.48 * Math.min(w, h) * (1 + (spread - 1) * 0.18);
      const els = imgsRef.current;
      const nImgs = els.length || 1;
      const stepFrac = Math.max(0.005, (spacing * 0.5) / 100);
      const slots = Math.min(400, Math.ceil(1 / stepFrac) + 2);
      const base = L / 100;
      const cards: { tt: number; n: number; img: number }[] = [];
      for (let i = 0; i < slots; i++) {
        const s = (((base + i * stepFrac) % 1) + 1) % 1;
        const n = arcToN(s);
        cards.push({ tt: s * 100, n, img: i % nImgs });
      }
      cards.sort((a, b) => a.n - b.n);
      for (let k = 0; k < cards.length; k++) {
        const { tt, n, img: imgIdx } = cards[k];
        const p = spiral(n, R);
        const dist = Math.sqrt(p.x * p.x + p.y * p.y);
        let opacity = 1;
        if (tt < fadeIn) opacity = tt / fadeIn;
        else if (tt > 100 - fadeOut) opacity = (100 - tt) / fadeOut;
        if (opacity < 0.01) continue;
        const scale =
          sizeAttenuation > 0
            ? Math.pow(Math.min(dist / R, 1), sizeAttenuation * 0.5)
            : 1;
        const p2 = spiral(Math.min(n + 0.001, 1), R);
        const angle = Math.atan2(p2.y - p.y, p2.x - p.x);
        const el = els[imgIdx];
        const ready = el && el.complete && el.naturalWidth > 0;
        const aspect = ready ? el!.naturalWidth / el!.naturalHeight : 1;
        let cw = imageSize * scale;
        let ch = cw / aspect;
        if (aspect < 1) {
          ch = imageSize * scale;
          cw = ch * aspect;
        }
        const x = cx + p.x;
        const y = cy + p.y;
        const rad = (cornerRadius / 20) * (Math.min(cw, ch) / 2);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = opacity;
        roundRect(ctx, -cw / 2, -ch / 2, cw, ch, rad);
        ctx.clip();
        if (ready) {
          ctx.drawImage(el!, -cw / 2, -ch / 2, cw, ch);
        } else {
          ctx.fillStyle = `hsl(${(imgIdx * 360) / nImgs}, 65%, 55%)`;
          ctx.fillRect(-cw / 2, -ch / 2, cw, ch);
        }
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [
    srcKey,
    turns,
    speed,
    spacing,
    spread,
    sizeAttenuation,
    imageSize,
    fadeIn,
    fadeOut,
    cornerRadius,
  ]);

  return (
    <div
      ref={containerRef}
      style={{
        ...style,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

SpiralImages.displayName = "Spiral Images";
