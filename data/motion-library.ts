// 动效库（类C「动效」的数据层）。
// 模型：按「应用场景」分场景，每场景下有多个「变体」——正如按钮/圆角那样，
// 同一场景选一个变体即可。每个变体携带：可复制的真实代码片段、提示词、
// 框架类型（gsap/lenis/framer/css）、预览类型 demo、来源 source。
//
// 数据来源：
//  - 本地 D:\workspace\gsap-snippets 的 11 个独立可运行片段（已提取真实代码）
//  - 既有 6 个基础预设
//  - 开源仓库 zentry（React+Tailwind+GSAP Awwwards 克隆）、Truus.co（Awwwards 站点）

export type MotionFramework = "gsap" | "lenis" | "framer" | "css";

export type MotionDemo =
  | "none"
  | "text-chars"
  | "text-words"
  | "text-rotate"
  | "text-rise"
  | "fade-up"
  | "clip-reveal"
  | "circle-reveal"
  | "horizontal"
  | "magnetic"
  | "tilt"
  | "hover-lift"
  | "spring"
  | "count-up"
  | "marquee"
  | "parallax-hero"
  | "parallax-layers"
  | "page-transition"
  | "smooth";

export interface MotionVariant {
  id: string;
  name: string;
  description: string;
  framework: MotionFramework;
  /** 真实可运行代码片段（复制到 React/GSAP 项目即可用） */
  code: string;
  /** 可复制提示词 */
  prompt: string;
  /** 预览类型（Step 4 用 CSS 关键帧做示意预览） */
  demo: MotionDemo;
  /** 来源：本地片段路径 / 开源仓库名 */
  source?: string;
}

export interface MotionScenario {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide 图标名
  variants: MotionVariant[];
}

export const MOTION_SCENARIOS: MotionScenario[] = [
  // ════════ 场景1：文字入场 ════════
  {
    id: "text",
    name: "文字入场",
    description: "标题/标语/关键词的入场揭示",
    icon: "Type",
    variants: [
      {
        id: "text-chars",
        name: "逐字遮罩入场",
        description: "标题逐字从下方遮罩滑入，滚动触发",
        framework: "gsap",
        demo: "text-chars",
        source: "gsap-snippets/01-text-reveal.html",
        prompt:
          "Reveal the heading character-by-character with a masked upward slide, triggered on scroll (GSAP SplitText + ScrollTrigger).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export function TextReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useGSAP(() => {
    const split = new SplitText(ref.current!, { type: "chars" });
    gsap.from(split.chars, {
      yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.035,
      ease: "power4.out",
      scrollTrigger: { trigger: ref.current, start: "top 80%" },
    });
  }, { scope: ref });
  return <h1 ref={ref} className={className}>{text}</h1>;
}`,
      },
      {
        id: "text-words",
        name: "逐词遮罩入场",
        description: "按词拆分，依次交错滑入",
        framework: "gsap",
        demo: "text-words",
        source: "gsap-snippets/01-text-reveal.html",
        prompt:
          "Reveal text word-by-word with a staggered masked slide (GSAP SplitText words).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export function WordReveal({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useGSAP(() => {
    const split = new SplitText(ref.current!, { type: "words" });
    gsap.from(split.words, {
      yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.06,
      ease: "power4.out",
      scrollTrigger: { trigger: ref.current, start: "top 80%" },
    });
  }, { scope: ref });
  return <p ref={ref} className={className}>{text}</p>;
}`,
      },
      {
        id: "text-rotate",
        name: "旋转轮播词",
        description: "关键词原地轮换，旧词上移淡出、新词滑入",
        framework: "gsap",
        demo: "text-rotate",
        source: "gsap-snippets/10-rotating-words.html",
        prompt:
          "Cycle through keywords in place: outgoing word slides up & fades, incoming slides in from below (GSAP loop).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function RotatingWords({ words, className = "" }: { words: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const els = gsap.utils.toArray<HTMLElement>(".rw-word", ref.current!);
    let i = 0;
    const tick = () => {
      const cur = els[i], next = els[(i + 1) % els.length];
      gsap.to(cur, { yPercent: -100, opacity: 0, duration: 0.6, ease: "power3.in" });
      gsap.fromTo(next, { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.25 });
      i = (i + 1) % els.length;
      gsap.delayedCall(2.2, tick);
    };
    tick();
  }, { scope: ref });
  return (
    <span ref={ref} className={"relative inline-block overflow-hidden align-bottom " + className}>
      {words.map((w, idx) => (
        <span key={idx} className="rw-word absolute left-0 top-0"
          style={{ position: idx === 0 ? "relative" : "absolute", opacity: idx === 0 ? 1 : 0 }}>
          {w}
        </span>
      ))}
    </span>
  );
}`,
      },
      {
        id: "text-rise",
        name: "上行揭示（GSAP）",
        description: "整行文字由下而上淡入，GSAP 实现",
        framework: "gsap",
        demo: "text-rise",
        prompt:
          "Animate a line of text rising up and fading in with GSAP (ScrollTrigger on enter).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function RiseText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, {
      opacity: 0, y: 24, duration: 0.6, ease: "power2.out",
      scrollTrigger: { trigger: ref.current, start: "top 85%" },
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "text-mask-reveal",
        name: "遮罩上滑揭示",
        description: "整块文字从下方遮罩裁切揭示（clip-path 上滑），GSAP 实现",
        framework: "gsap",
        demo: "clip-reveal",
        prompt: "Reveal a block of text with a bottom-to-top clip-path wipe (GSAP ScrollTrigger).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function MaskReveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current,
      { clipPath: "inset(0 0 100% 0)", opacity: 0 },
      { clipPath: "inset(0 0 0% 0)", opacity: 1, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%" } });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
    ],
  },

  // ════════ 场景2：滚动揭示 ════════
  {
    id: "scroll-reveal",
    name: "滚动揭示",
    description: "元素进入视口时的揭示/入场",
    icon: "Image",
    variants: [
      {
        id: "scroll-fade-up",
        name: "渐显上浮交错",
        description: "网格元素依次上浮渐显",
        framework: "gsap",
        demo: "fade-up",
        source: "gsap-snippets/02-scroll-fade-up.html",
        prompt:
          "Stagger-fade a grid of cards upward as they enter the viewport (GSAP ScrollTrigger).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function FadeUpGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(".fug-item", {
      opacity: 0, y: 48, duration: 0.9, stagger: 0.12, ease: "power3.out",
      scrollTrigger: { trigger: ref.current, start: "top 85%" },
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "scroll-clip",
        name: "图片 clip 揭示",
        description: "图片自下而上被遮罩揭开，内部轻微放大",
        framework: "gsap",
        demo: "clip-reveal",
        source: "gsap-snippets/08-image-clip-reveal.html",
        prompt:
          "Reveal images with a bottom-up clip-path mask while slightly scaling the image in (GSAP).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ClipImage({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const shell = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  useGSAP(() => {
    gsap.timeline({ scrollTrigger: { trigger: shell.current, start: "top 85%" } })
      .to(shell.current, { clipPath: "inset(0 0 0% 0)", duration: 1, ease: "power4.inOut" })
      .to(img.current, { scale: 1, duration: 1.2, ease: "power3.out" }, 0);
  }, { scope: shell });
  return (
    <div ref={shell} className={"overflow-hidden [clip-path:inset(0_0_100%_0)] " + className}>
      <img ref={img} src={src} alt={alt} className="w-full h-full object-cover scale-110" />
    </div>
  );
}`,
      },
      {
        id: "scroll-circle",
        name: "圆形扩散揭示",
        description: "图片以圆形从中心扩散揭开（clip 变体）",
        framework: "gsap",
        demo: "circle-reveal",
        source: "gsap-snippets/08-image-clip-reveal.html",
        prompt:
          "Reveal an image with a circular clip-path expanding from center (GSAP variant of clip reveal).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function CircleReveal({ src, alt = "", className = "" }: { src: string; alt?: string; className?: string }) {
  const shell = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(shell.current,
      { clipPath: "circle(0% at 50% 50%)" },
      { clipPath: "circle(75% at 50% 50%)", duration: 1.1, ease: "power3.inOut",
        scrollTrigger: { trigger: shell.current, start: "top 85%" } });
  }, { scope: shell });
  return (
    <div ref={shell} className={"overflow-hidden " + className}>
      <img src={src} alt={alt} className="w-full h-full object-cover" />
    </div>
  );
}`,
      },
      {
        id: "scroll-horizontal",
        name: "横向滚动吸顶",
        description: "竖向滚动 → 区块吸顶，内部横向平移",
        framework: "gsap",
        demo: "horizontal",
        source: "gsap-snippets/03-horizontal-scroll.html",
        prompt:
          "Pin a section and translate its track horizontally as the user scrolls vertically (GSAP ScrollTrigger pin + scrub).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function HorizontalScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const amount = () => track.current!.scrollWidth - window.innerWidth;
    gsap.to(track.current, {
      x: () => -amount(), ease: "none",
      scrollTrigger: {
        trigger: wrap.current, start: "top top",
        end: () => "+=" + amount(), pin: true, scrub: 1, invalidateOnRefresh: true,
      },
    });
  }, { scope: wrap });
  return (
    <section ref={wrap} className={"h-screen overflow-hidden flex items-center " + className}>
      <div ref={track} className="flex gap-8 px-[6vw]">{children}</div>
    </section>
  );
}`,
      },
      {
        id: "reveal-on-scroll",
        name: "滚动进入揭示",
        description: "元素进入视口时淡入上滑（滚动触发一次），GSAP 实现",
        framework: "gsap",
        demo: "fade-up",
        prompt: "Reveal an element with a fade-up when it scrolls into view (GSAP ScrollTrigger).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function RevealOnScroll({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, {
      opacity: 0, y: 40, duration: 0.7, ease: "power2.out",
      scrollTrigger: { trigger: ref.current, start: "top 90%" },
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "zentry-image",
        name: "图片遮罩 + 滚动钉住",
        description: "zentry 风格：图片 clip 揭示后钉住滚动叙事",
        framework: "gsap",
        demo: "clip-reveal",
        source: "zentry (github.com/33Krishna/zentry)",
        prompt:
          "zentry-style: reveal image with clip mask, then pin the section while subsequent content scrolls for a scroll-narrative (GSAP pin + scrub).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

// zentry 风格：图片揭示后钉住，形成滚动叙事
export function ZentryReveal({ src, className = "" }: { src: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: wrap.current, start: "top top", end: "+=120%", pin: true, scrub: 1 },
    });
    tl.fromTo(".zr-img", { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 1 })
      .to(".zr-img", { scale: 1.1, duration: 1 }, 0);
  }, { scope: wrap });
  return (
    <section ref={wrap} className={"h-screen overflow-hidden flex items-center justify-center " + className}>
      <img src={src} className="zr-img h-[80vh] w-auto object-cover [clip-path:inset(0_0_100%_0)]" />
    </section>
  );
}`,
      },
      {
        id: "sticky-stack",
        name: "贴卡堆叠",
        description: "多卡依次吸顶钉住、前卡缩放让位，滚动叙事（taste-skill 规范骨架）",
        framework: "gsap",
        demo: "fade-up",
        source: "taste-skill (skills/taste-skill SKILL.md §5.A)",
        prompt:
          "Sticky-stack cards: each card except the last pins at viewport top (start:'top top', pinSpacing:false); the previous card scales down / fades as the NEXT card arrives (trigger: next, start:'top bottom', end:'top top', scrub).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

// 贴卡堆叠：每张卡（除最后一张）钉在视口顶，前卡被下一张推开时缩小让位
export function StickyStack({ cards, className = "" }: { cards: React.ReactNode[]; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const cardEls = gsap.utils.toArray<HTMLElement>(".stack-card", wrap.current!);
    if (cardEls.length < 2) return;
    cardEls.forEach((card, i) => {
      if (i === cardEls.length - 1) return;
      ScrollTrigger.create({
        trigger: card,
        start: "top top",
        endTrigger: cardEls[cardEls.length - 1],
        end: "top top",
        pin: true,
        pinSpacing: false,
      });
      gsap.to(card, {
        scale: 0.92, opacity: 0.55, ease: "none",
        scrollTrigger: {
          trigger: cardEls[i + 1],
          start: "top bottom", end: "top top", scrub: true,
        },
      });
    });
  }, { scope: wrap });
  return (
    <div ref={wrap} className={"relative " + className}>
      {cards.map((c, i) => (
        <div key={i} className="stack-card sticky top-0 flex min-h-[100dvh] items-center justify-center">{c}</div>
      ))}
    </div>
  );
}`,
      },
    ],
  },

  // ════════ 场景3：交互反馈 ════════
  {
    id: "interaction",
    name: "交互反馈",
    description: "指针/点击驱动的微交互",
    icon: "MousePointerClick",
    variants: [
      {
        id: "ix-magnetic",
        name: "磁吸按钮",
        description: "鼠标靠近按钮被吸向光标，移开弹回",
        framework: "gsap",
        demo: "magnetic",
        source: "gsap-snippets/05-magnetic-button.html",
        prompt:
          "Make the button magnetic: it follows the cursor with a layered offset on hover, springs back on leave (GSAP quickTo).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function MagneticButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const xTo = gsap.quickTo(wrap.current, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(wrap.current, "y", { duration: 0.4, ease: "power3.out" });
    const xT = gsap.quickTo(label.current, "x", { duration: 0.3, ease: "power3.out" });
    const yT = gsap.quickTo(label.current, "y", { duration: 0.3, ease: "power3.out" });
    const el = wrap.current!;
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const rx = e.clientX - (r.left + r.width / 2);
      const ry = e.clientY - (r.top + r.height / 2);
      xTo(rx * 0.4); yTo(ry * 0.4); xT(rx * 0.15); yT(ry * 0.15);
    });
    el.addEventListener("mouseleave", () => { xTo(0); yTo(0); xT(0); yT(0); });
  }, { scope: wrap });
  return (
    <div ref={wrap} className="inline-block will-change-transform">
      <button className={"rounded-full px-6 py-3 font-semibold " + className}>
        <span ref={label} className="inline-block will-change-transform">{children}</span>
      </button>
    </div>
  );
}`,
      },
      {
        id: "ix-tilt",
        name: "3D 卡片倾斜",
        description: "卡片随鼠标做 3D 倾斜，移开回正",
        framework: "gsap",
        demo: "tilt",
        source: "gsap-snippets/06-3d-card-tilt.html",
        prompt:
          "Tilt a card in 3D following the cursor (rotateX/rotateY) with perspective, smoothly returning on leave (GSAP quickTo).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const card = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = card.current!;
    const rotX = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
    const rotY = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
    const stage = el.parentElement!;
    stage.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      rotY(nx * 18); rotX(-ny * 18);
    });
    stage.addEventListener("mouseleave", () => { rotX(0); rotY(0); });
  }, { scope: card });
  return (
    <div className="[perspective:900px]">
      <div ref={card} className={"will-change-transform [transform-style:preserve-3d] " + className}>{children}</div>
    </div>
  );
}`,
      },
      {
        id: "ix-hover-lift",
        name: "悬停上浮",
        description: "hover 轻微上浮 + 阴影（GSAP）",
        framework: "gsap",
        demo: "hover-lift",
        source: "gsap-snippets (基础预设)",
        prompt: "Lift cards 4px on hover with a soft shadow (GSAP).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function HoverLift({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = ref.current!;
    el.addEventListener("mouseenter", () =>
      gsap.to(el, { y: -4, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", duration: 0.2, ease: "power2.out" }));
    el.addEventListener("mouseleave", () =>
      gsap.to(el, { y: 0, boxShadow: "0 0px 0px rgba(0,0,0,0)", duration: 0.2, ease: "power2.out" }));
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "ix-spring",
        name: "弹性 Spring",
        description: "弹性物理回弹（GSAP）",
        framework: "gsap",
        demo: "spring",
        prompt: "Use a spring/elastic transition for bouncy motion (GSAP ease).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function SpringBox({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = ref.current!;
    el.addEventListener("mouseenter", () =>
      gsap.to(el, { scale: 1.05, duration: 0.4, ease: "elastic.out(1, 0.5)" }));
    el.addEventListener("mouseleave", () =>
      gsap.to(el, { scale: 1, duration: 0.4, ease: "power2.out" }));
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "truus-hover",
        name: "图片悬停揭示 + 光标跟随",
        description: "Truus.co 风格：图片悬停放大揭示，跟随光标的高亮",
        framework: "gsap",
        demo: "tilt",
        source: "Truus.co (Awwwards)",
        prompt:
          "Truus.co-style: on hover, scale & reveal an image while a cursor-following spotlight highlights it (GSAP quickTo).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function TruusHover({ src, className = "" }: { src: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const el = wrap.current!;
    const xT = gsap.quickTo(spot.current, "x", { duration: 0.4, ease: "power3.out" });
    const yT = gsap.quickTo(spot.current, "y", { duration: 0.4, ease: "power3.out" });
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      xT(e.clientX - r.left); yT(e.clientY - r.top);
    });
    el.addEventListener("mouseenter", () => gsap.to(img.current, { scale: 1.08, duration: 0.5, ease: "power3.out" }));
    el.addEventListener("mouseleave", () => gsap.to(img.current, { scale: 1, duration: 0.5 }));
  }, { scope: wrap });
  return (
    <div ref={wrap} className={"relative overflow-hidden " + className}>
      <img ref={img} src={src} className="w-full h-full object-cover" />
      <div ref={spot} className="pointer-events-none absolute -left-10 -top-10 h-20 w-20 rounded-full bg-white/30 blur-xl" />
    </div>
  );
}`,
      },
    ],
  },

  // ════════ 场景4：数据 / 品牌 ════════
  {
    id: "data",
    name: "数据 / 品牌",
    description: "数字滚动与品牌条循环",
    icon: "BarChart3",
    variants: [
      {
        id: "data-count",
        name: "数字滚动计数",
        description: "进入视口时数字从 0 滚到目标值",
        framework: "gsap",
        demo: "count-up",
        source: "gsap-snippets/07-count-up.html",
        prompt:
          "Animate a number counting up from 0 to its target when scrolled into view (GSAP onUpdate).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function CountUp({ target, decimals = 0, suffix = "", className = "" }: { target: number; decimals?: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: target, duration: 2, ease: "power2.out",
      onUpdate: () => { if (ref.current) ref.current.textContent = proxy.v.toFixed(decimals) + suffix; },
      scrollTrigger: { trigger: ref.current, start: "top 85%" },
    });
  }, { scope: ref });
  return <span ref={ref} className={className}>0</span>;
}`,
      },
      {
        id: "data-marquee",
        name: "无限跑马灯",
        description: "内容无缝向左循环滚动",
        framework: "gsap",
        demo: "marquee",
        source: "gsap-snippets/04-marquee.html",
        prompt:
          "Build a seamless infinite marquee by duplicating content and looping the track with GSAP.",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const group = track.current!.querySelector(".mq-group") as HTMLElement;
    gsap.to(track.current, {
      x: () => -group.offsetWidth, duration: 14, ease: "none", repeat: -1,
      onRepeat: () => gsap.set(track.current, { x: 0 }),
    });
  }, { scope: track });
  return (
    <div className={"overflow-hidden " + className}>
      <div ref={track} className="flex w-max">
        {[0, 1].map((k) => (
          <div key={k} className="mq-group flex items-center gap-12 pr-12" aria-hidden={k === 1}>
            {items.map((t, i) => <span key={i} className="text-2xl font-extrabold whitespace-nowrap">{t}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}`,
      },
    ],
  },

  // ════════ 场景5：视差 / 转场 ════════
  {
    id: "parallax",
    name: "视差 / 转场",
    description: "滚动纵深与页面切换",
    icon: "Move",
    variants: [
      {
        id: "parallax-hero",
        name: "视差 Hero",
        description: "背景与文字以不同速度滚动",
        framework: "gsap",
        demo: "parallax-hero",
        source: "gsap-snippets/09-parallax-hero.html",
        prompt:
          "Parallax hero: background moves slower than foreground text as you scroll (GSAP ScrollTrigger scrub).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ParallaxHero({ title, subtitle, bg }: { title: string; subtitle: string; bg: string }) {
  const hero = useRef<HTMLDivElement>(null);
  const bgEl = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.to(bgEl.current, { yPercent: 30, scale: 1.15, ease: "none",
      scrollTrigger: { trigger: hero.current, start: "top top", end: "bottom top", scrub: true } });
    gsap.to(content.current, { yPercent: -40, opacity: 0, ease: "none",
      scrollTrigger: { trigger: hero.current, start: "top top", end: "bottom top", scrub: true } });
  }, { scope: hero });
  return (
    <section ref={hero} className="relative h-screen overflow-hidden flex items-center justify-center">
      <div ref={bgEl} className="absolute inset-[-12%_0_0_0] h-[124%] bg-cover bg-center scale-110" style={{ backgroundImage: "url(" + bg + ")" }} />
      <div ref={content} className="relative z-10 text-center text-white">
        <h1 className="text-6xl font-black">{title}</h1>
        <p className="mt-4 text-xl">{subtitle}</p>
      </div>
    </section>
  );
}`,
      },
      {
        id: "parallax-layers",
        name: "多层视差",
        description: "不同图层以不同速度位移",
        framework: "gsap",
        demo: "parallax-layers",
        source: "gsap-snippets/11-smooth-scroll.html",
        prompt:
          "Stack layers that move at different speeds on scroll for depth (GSAP ScrollTrigger, data-speed).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ParallaxLayers({ layers, className = "" }: { layers: { text: string; speed: number; className?: string }[]; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.utils.toArray<HTMLElement>(".pl-layer", wrap.current!).forEach((l) => {
      const s = parseFloat(l.dataset.speed || "0.2");
      gsap.to(l, { yPercent: s * 100, ease: "none",
        scrollTrigger: { trigger: wrap.current, start: "top bottom", end: "bottom top", scrub: true } });
    });
  }, { scope: wrap });
  return (
    <section ref={wrap} className={"relative h-screen overflow-hidden flex items-center justify-center " + className}>
      {layers.map((l, i) => (
        <div key={i} data-speed={l.speed} className={"pl-layer absolute " + (l.className ?? "")}>{l.text}</div>
      ))}
    </section>
  );
}`,
      },
      {
        id: "parallax-page",
        name: "页面转场",
        description: "路由切换淡入 + 位移（GSAP）",
        framework: "gsap",
        demo: "page-transition",
        prompt:
          "Animate route changes with a cross-fade and horizontal slide using GSAP (mount transition).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function PageTransition({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, { opacity: 0, x: 16, duration: 0.3, ease: "power2.out" });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "parallax-smooth",
        name: "Lenis 平滑滚动",
        description: "整页惯性平滑滚动 + 视差",
        framework: "lenis",
        demo: "smooth",
        source: "gsap-snippets/11-smooth-scroll.html",
        prompt:
          "Enable site-wide inertial smooth scrolling with Lenis, bridged to GSAP ScrollTrigger, plus parallax layers.",
        code: `import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

export function useSmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    return () => { lenis.destroy(); gsap.ticker.remove((t) => lenis.raf(t * 1000)); };
  }, []);
}`,
      },
      {
        id: "scroll-scrub",
        name: "滚动绑定位移",
        description: "动画进度绑定滚动位置（scrub），跟手联动（GSAP ScrollTrigger）",
        framework: "gsap",
        demo: "parallax-layers",
        prompt: "Bind animation progress to scroll position (GSAP ScrollTrigger scrub).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(ScrollTrigger, useGSAP);

export function ScrollScrub({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current, { x: -60 }, {
      x: 60, ease: "none",
      scrollTrigger: { trigger: ref.current, start: "top bottom", end: "bottom top", scrub: true },
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "motion-path",
        name: "沿路径运动",
        description: "元素沿 SVG 路径运动（GSAP MotionPathPlugin）",
        framework: "gsap",
        demo: "horizontal",
        prompt: "Move an element along an SVG path using GSAP MotionPathPlugin.",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(MotionPathPlugin, useGSAP);

export function PathMover({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.to(ref.current, {
      duration: 3, repeat: -1, ease: "none",
      motionPath: {
        path: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 100 }, { x: 300, y: 100 }],
        autoRotate: true,
      },
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
    ],
  },

  // ════════ 场景6：无动效 ════════
  // ════════ 场景：通用入场曲线 ════════
  {
    id: "entrance",
    name: "入场曲线",
    description: "落地回弹 / 弹性振荡 / 摆动等特色入场缓动（framer 实现，免费复刻 GSAP CustomEase/EasePack）",
    icon: "Sparkles",
    variants: [
      {
        id: "spring-bounce",
        name: "落地回弹",
        description: "元素从上方落下并回弹到位（GSAP）",
        framework: "gsap",
        demo: "spring",
        prompt: "Drop-in with a bounce settle (GSAP ease back.out).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function BounceIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, {
      opacity: 0, y: -32, scale: 0.96, duration: 1.6, ease: "back.out(2)",
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "spring-elastic",
        name: "弹性振荡",
        description: "入场时轻微过冲振荡后归位（GSAP）",
        framework: "gsap",
        demo: "spring",
        prompt: "Entrance with an elastic overshoot settle (GSAP ease elastic.out).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function ElasticIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, {
      opacity: 0, scale: 0.6, duration: 1.8, ease: "elastic.out(1, 0.4)",
    });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
      {
        id: "wobble",
        name: "摆动入场",
        description: "入场时左右轻微摆动后归正（GSAP）",
        framework: "gsap",
        demo: "hover-lift",
        prompt: "Entrance with a gentle wobble that settles upright (GSAP timeline).",
        code: `import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
gsap.registerPlugin(useGSAP);

export function WobbleIn({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(ref.current, { rotation: -4, duration: 0.32, ease: "power1.inOut" })
      .to(ref.current, { rotation: 3, duration: 0.24 })
      .to(ref.current, { rotation: -2, duration: 0.24 })
      .to(ref.current, { rotation: 1.5, duration: 0.24 })
      .to(ref.current, { rotation: 0, duration: 0.24 });
  }, { scope: ref });
  return <div ref={ref} className={className}>{children}</div>;
}`,
      },
    ],
  },
  {
    id: "none",
    name: "无动效",
    description: "静态、零过渡，性能优先",
    icon: "Ban",
    variants: [
      {
        id: "motion-none",
        name: "无动效",
        description: "不使用任何过渡与动画",
        framework: "css",
        demo: "none",
        prompt: "Disable all transitions and animations; render everything instantly for maximum performance.",
        code: `/* 不使用任何过渡与动画 */`,
      },
    ],
  },
];

export const MOTION_SCENARIO_MAP: Record<string, MotionScenario> = Object.fromEntries(
  MOTION_SCENARIOS.map((s) => [s.id, s]),
);

/** 收集所有变体为扁平 map，便于按 id 查名/查代码 */
export const MOTION_VARIANT_MAP: Record<string, MotionVariant> = Object.fromEntries(
  MOTION_SCENARIOS.flatMap((s) => s.variants.map((v) => [v.id, v])),
);

