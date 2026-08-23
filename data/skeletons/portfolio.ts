// 作品集页（Portfolio）页面骨架数据。
// 调性：极简高级（编辑式/大图/克制），图片用 picsum.photos 免费 seed（同 seed 固定）。

import type { SkeletonPage } from "./types";

export const PORTFOLIO_PAGE: SkeletonPage = {
  id: "portfolio",
  name: "作品集",
  icon: "Palette",
  description: "作品集/工作室页：作品网格、案例研究、关于荣誉，视觉产品的门面",
  components: [
    {
      id: "portfolio-grid",
      name: "作品网格",
      icon: "LayoutGrid",
      description: "作品展示的多种排布",
      variants: [
        {
          id: "pgrid_masonry",
          name: "瀑布流网格",
          description: "错落高度图卡网格，hover 标题浮现",
          tags: ["瀑布流", "图卡"],
          prompt:
            "Build a masonry portfolio grid: CSS columns or grid with varied image heights, cards with real images, on hover a title overlay fades in at bottom. Filter pills on top (All / Branding / Web / Motion). Minimal chrome.",
          code: `export function WorkGrid() {
  const works = [
    { t: "Nova 品牌重塑", c: "Branding", img: "https://picsum.photos/seed/xiye-work-1/600/800" },
    { t: "Aurora 官网", c: "Web", img: "https://picsum.photos/seed/xiye-work-2/600/400" },
    { t: "Harbor 动态设计", c: "Motion", img: "https://picsum.photos/seed/xiye-work-3/600/900" },
    { t: "Field 包装", c: "Branding", img: "https://picsum.photos/seed/xiye-work-4/600/500" },
    { t: "Cobalt 应用", c: "Web", img: "https://picsum.photos/seed/xiye-work-5/600/700" },
    { t: "Meridian 影像", c: "Motion", img: "https://picsum.photos/seed/xiye-work-6/600/450" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">精选作品</h2>
          <div className="flex gap-2 text-xs">
            {["全部", "Branding", "Web", "Motion"].map((f, i) => (
              <span key={f} className={"rounded-full px-3 py-1.5 " + (i === 0 ? "text-white" : "border")} style={i === 0 ? { background: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}>{f}</span>
            ))}
          </div>
        </div>
        <div className="mt-8 columns-1 gap-5 sm:columns-2 lg:columns-3">
          {works.map((w) => (
            <a key={w.t} href="#work" className="group relative mb-5 block overflow-hidden rounded-xl">
              <img src={w.img} alt={w.t} loading="lazy" className="w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/60 to-transparent p-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                <span className="block text-sm font-semibold text-white">{w.t}</span>
                <span className="text-xs text-white/70">{w.c}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "hover 标题渐变浮现；筛选胶囊可切分类",
        },
        {
          id: "pgrid_split",
          name: "编辑式分栏",
          description: "左大图案例 + 右细排小卡，杂志排版",
          tags: ["编辑式", "非对称"],
          prompt:
            "Build an editorial portfolio layout: left column has ONE large featured work with serif title + meta, right column has a compact vertical list of smaller works separated by hairlines. Asymmetric, magazine-like.",
          code: `export function WorkGrid() {
  return (
    <section className="grid gap-10 px-6 py-20 lg:grid-cols-2" style={{ background: "var(--background)" }}>
      <a href="#featured" className="group block">
        <div className="overflow-hidden rounded-2xl">
          <img src="https://picsum.photos/seed/xiye-work-hero/900/1100" alt="精选作品" className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
        <p className="mt-5 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>Featured · 2025</p>
        <h3 className="mt-2 text-3xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>Nova 品牌重塑</h3>
      </a>
      <div className="flex flex-col justify-center">
        {[
          { t: "Aurora 官网", m: "Web · 2025" },
          { t: "Harbor 动态设计", m: "Motion · 2024" },
          { t: "Field 包装系统", m: "Branding · 2024" },
          { t: "Cobalt 应用", m: "Product · 2023" },
        ].map((w) => (
          <a key={w.t} href="#work" className="group flex items-center justify-between border-b py-5" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="text-lg font-medium transition group-hover:text-[var(--primary)]">{w.t}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{w.m}</p>
            </div>
            <span className="text-sm opacity-0 transition group-hover:opacity-100">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "大图 hover 微缩放；行列表箭头浮现",
        },
        {
          id: "pgrid_hscroll",
          name: "横向滚动带",
          description: "横向滚动作品带，编号 + 图卡",
          tags: ["横向", "沉浸"],
          prompt:
            "Build a horizontal-scrolling portfolio strip: an overflow-x-auto track with large image cards, each with a big index number and title below. Snap scroll, drag-friendly. Immersive and editorial.",
          code: `export function WorkGrid() {
  const track = useRef<HTMLDivElement>(null);
  const works = [
    { n: "01", t: "Nova 品牌", img: "https://picsum.photos/seed/xiye-work-1/700/500" },
    { n: "02", t: "Aurora 官网", img: "https://picsum.photos/seed/xiye-work-2/700/500" },
    { n: "03", t: "Harbor 动效", img: "https://picsum.photos/seed/xiye-work-3/700/500" },
    { n: "04", t: "Field 包装", img: "https://picsum.photos/seed/xiye-work-4/700/500" },
    { n: "05", t: "Cobalt 应用", img: "https://picsum.photos/seed/xiye-work-5/700/500" },
    { n: "06", t: "Meridian 影像", img: "https://picsum.photos/seed/xiye-work-6/700/500" },
  ];
  const step = () => track.current?.clientWidth ?? 380;
  return (
    <section className="px-6 py-16">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Selected Works</h2>
        <div className="flex gap-2">
          <button aria-label="上一个" onClick={() => track.current?.scrollBy({ left: -step(), behavior: "smooth" })} className="flex size-9 items-center justify-center rounded-full border transition hover:bg-muted" style={{ borderColor: "var(--border)" }}>‹</button>
          <button aria-label="下一个" onClick={() => track.current?.scrollBy({ left: step(), behavior: "smooth" })} className="flex size-9 items-center justify-center rounded-full border transition hover:bg-muted" style={{ borderColor: "var(--border)" }}>›</button>
        </div>
      </div>
      <div ref={track} className="mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        {works.map((w) => (
          <a key={w.n} href="#work" className="group w-[300px] shrink-0 snap-start sm:w-[380px]">
            <div className="overflow-hidden rounded-xl">
              <img src={w.img} alt={w.t} loading="lazy" className="aspect-[7/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
            </div>
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>{w.n} / 06</p>
            <p className="text-lg font-semibold">{w.t}</p>
          </a>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "横向 snap 滚动；hover 图缩放",
        },
      ],
    },
    {
      id: "portfolio-case",
      name: "案例研究",
      icon: "FileText",
      description: "单项目深度展示页骨架",
      variants: [
        {
          id: "pcase_hero",
          name: "案例首屏",
          description: "大图 + 标题 + 指标条，开门见山",
          tags: ["首屏", "数据"],
          prompt:
            "Build a case study hero: full-width image, project title in serif, one-line description, and a 3-metric strip (timeline / role / result). Clean, editorial, no card boxes.",
          code: `export function CaseHero() {
  const meta = [
    { l: "时间", v: "8 周" },
    { l: "角色", v: "品牌 + 开发" },
    { l: "成果", v: "+212% 转化" },
  ];
  return (
    <section className="px-6 pt-12" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>Case Study · 2025</p>
        <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>Nova 品牌重塑</h1>
        <p className="mt-4 max-w-xl text-base" style={{ color: "var(--muted-foreground)" }}>为一家快速成长的 SaaS 完成从品牌到官网的全链路重塑。</p>
        <div className="mt-8 flex flex-wrap gap-10 border-y py-5" style={{ borderColor: "var(--border)" }}>
          {meta.map((m) => (
            <div key={m.l}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.l}</p>
              <p className="mt-0.5 text-lg font-bold">{m.v}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 overflow-hidden rounded-2xl">
          <img src="https://picsum.photos/seed/xiye-case-hero/1200/720" alt="项目主图" className="w-full object-cover" />
        </div>
      </div>
    </section>
  );
}`,
          interaction: "衬线巨标 + 指标条分隔线",
        },
        {
          id: "pcase_process",
          name: "过程时间线",
          description: "阶段式过程：时间线 + 图 + 文字",
          tags: ["时间线", "叙事"],
          prompt:
            "Build a case study process section: vertical timeline with 4 phases (Discovery / Design / Build / Launch), each phase has a title, short paragraph, and small image. Hairline connectors, generous spacing.",
          code: `export function CaseProcess() {
  const phases = [
    { n: "01", t: "发现", d: "访谈 12 位用户，梳理核心痛点与品牌心智。", img: "https://picsum.photos/seed/xiye-case-1/600/400" },
    { n: "02", t: "设计", d: "视觉语言、组件系统与 40+ 页面逐一落地。", img: "https://picsum.photos/seed/xiye-case-2/600/400" },
    { n: "03", t: "构建", d: "React + Tailwind 工程化实现，动效体系统一。", img: "https://picsum.photos/seed/xiye-case-3/600/400" },
    { n: "04", t: "上线", d: "A/B 验证与迭代，转化率持续爬升。", img: "https://picsum.photos/seed/xiye-case-4/600/400" },
  ];
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold tracking-tight">过程</h2>
        <div className="mt-8 space-y-10">
          {phases.map((p) => (
            <div key={p.n} className="grid items-center gap-6 sm:grid-cols-[64px_1fr_180px]">
              <span className="text-2xl font-black" style={{ color: "var(--primary)" }}>{p.n}</span>
              <div>
                <p className="text-lg font-semibold">{p.t}</p>
                <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{p.d}</p>
              </div>
              <img src={p.img} alt="过程图" loading="lazy" className="hidden aspect-video w-full rounded-lg object-cover sm:block" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "编号强调 + 网格对齐阶段",
        },
        {
          id: "pcase_result",
          name: "成果数据卡",
          description: "大数字成果 + 客户引文",
          tags: ["数据", "成果"],
          prompt:
            "Build a case study results section: 3 large numbers (metrics) with labels, then a big quote from the client. Numbers in display size, quote in serif italic. No cards, just whitespace and hairlines.",
          code: `function CountUp({ value, className = "", style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = value.match(/^([-\\d,.]+)(.*)$/);
    if (!m) { el.textContent = value; return; }
    const suffix = m[2];
    const targetNum = parseFloat(m[1].replace(/,/g, ""));
    let raf = 0;
    const start = performance.now();
    const dur = 1000;
    const decimals = value.includes(".") ? 1 : 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (decimals ? (targetNum * eased).toFixed(1) : Math.round(targetNum * eased).toLocaleString()) + suffix;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { raf = requestAnimationFrame(tick); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [value]);
  return <span ref={ref} className={className} style={style}>{value}</span>;
}

export function CaseResults() {
  const metrics = [
    { v: "212%", l: "转化率提升" },
    { v: "-38%", l: "跳出率下降" },
    { v: "4.6x", l: "询盘增长" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--surface)" }}>
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-10 border-y py-10 sm:grid-cols-3" style={{ borderColor: "var(--border)" }}>
          {metrics.map((m) => (
            <div key={m.l}>
              <CountUp value={m.v} className="text-5xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }} />
              <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{m.l}</p>
            </div>
          ))}
        </div>
        <blockquote className="mx-auto mt-14 max-w-2xl text-center text-2xl font-medium leading-relaxed" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
          "重新上线第一周，销售团队就收到了一波高质量的询盘。"
        </blockquote>
        <p className="mt-3 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>张伟 · Nova 创始人</p>
      </div>
    </section>
  );
}`,
          interaction: "大数字衬线 CountUp + 引文居中",
        },
      ],
    },
    {
      id: "portfolio-about",
      name: "关于荣誉",
      icon: "Sparkles",
      description: "工作室介绍、数字与里程碑",
      variants: [
        {
          id: "pabout_manifesto",
          name: "宣言大字",
          description: "整屏宣言 + 细线分隔服务",
          tags: ["宣言", "编辑式"],
          prompt:
            "Build a studio manifesto: an oversized statement in serif filling the section, followed by a hairline-separated 3-column services strip (Brand / Web / Motion). Pure typography, no images, max whitespace.",
          code: `export function AboutManifesto() {
  const services = ["品牌策略", "界面设计", "动效开发"];
  return (
    <section className="px-6 py-28" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>About</p>
        <h2 className="mt-6 text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
          我们相信，好的设计<br />是让复杂变得轻盈。
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          成立于 2018 年的独立工作室，为全球 40+ 品牌提供从策略到落地的全链路设计服务。
        </p>
        <div className="mt-14 flex flex-wrap gap-x-14 gap-y-4 border-t pt-6" style={{ borderColor: "var(--border)" }}>
          {services.map((s) => (
            <span key={s} className="text-sm font-medium">{s}</span>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "巨标宣言 + 底部服务细线分隔",
        },
        {
          id: "pabout_stats",
          name: "荣誉数字墙",
          description: "年份/项目/奖项大数字",
          tags: ["数字", "荣誉"],
          prompt:
            "Build an awards/stats band: 4 large numbers (years / projects / awards / clients) with labels in a row, separated by hairlines. Numbers in display serif. For studio credibility.",
          code: `function CountUp({ value, className = "", style }: { value: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const m = value.match(/^([\\d,.]+)(.*)$/);
    if (!m) { el.textContent = value; return; }
    const suffix = m[2];
    const targetNum = parseFloat(m[1].replace(/,/g, ""));
    let raf = 0;
    const start = performance.now();
    const dur = 1000;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(targetNum * eased).toLocaleString() + suffix;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { raf = requestAnimationFrame(tick); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => { cancelAnimationFrame(raf); io.disconnect(); };
  }, [value]);
  return <span ref={ref} className={className} style={style}>{value}</span>;
}

export function AboutStats() {
  const stats = [
    { v: "8", l: "年经验" },
    { v: "120+", l: "交付项目" },
    { v: "23", l: "行业奖项" },
    { v: "40+", l: "长期客户" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-y-10 border-y py-10 sm:grid-cols-4" style={{ borderColor: "var(--border)" }}>
        {stats.map((s) => (
          <div key={s.l} className="text-center sm:text-left">
            <CountUp value={s.v} className="text-5xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }} />
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "大数字衬线 CountUp 滚动，分隔线分组",
        },
        {
          id: "pabout_timeline",
          name: "里程碑时间线",
          description: "竖向年份时间线，大事记",
          tags: ["时间线", "叙事"],
          prompt:
            "Build a studio timeline: vertical list of milestones with year on the left (display size) and description on the right, separated by hairlines. From founding to present.",
          code: `export function AboutTimeline() {
  const milestones = [
    { y: "2018", t: "工作室成立", d: "三位创始人从一间公寓起步。" },
    { y: "2020", t: "首个国际客户", d: "服务横跨亚太与北美。" },
    { y: "2022", t: "动效团队加入", d: "补全从静态到动态的全链路。" },
    { y: "2025", t: "40+ 品牌同行", d: "持续为相信设计的团队工作。" },
  ];
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">大事记</h2>
        <div className="mt-8">
          {milestones.map((m) => (
            <div key={m.y} className="grid gap-2 border-b py-6 sm:grid-cols-[90px_1fr]" style={{ borderColor: "var(--border)" }}>
              <span className="text-2xl font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{m.y}</span>
              <div>
                <p className="font-semibold">{m.t}</p>
                <p className="mt-0.5 text-sm" style={{ color: "var(--muted-foreground)" }}>{m.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "年份大号衬线 + 细线行",
        },
      ],
    },
    {
      id: "portfolio-ring",
      name: "环形图廊",
      icon: "Orbit",
      description: "图片沿同心圆环持续旋转的展示装置（完整参数版 · 摄取自 Originkit Image Group Circle）",
      variants: [
        {
          id: "pring_circle",
          name: "圆环旋转",
          description: "多环图片同向旋转，品牌/作品展示；全参数可调（环数/半径/间距/尺寸/方向/速度/圆角/倾斜/填充/图源）",
          tags: ["环形", "旋转", "沉浸", "参数化"],
          prompt:
            "Build a circular rotating gallery: photos distributed along concentric rings, each ring spins continuously via requestAnimationFrame on transform only. Seeded random tilt per card for organic feel, honors prefers-reduced-motion. Cards with soft shadow, configurable rings/radius/gap/size/direction/speed/rounded/tilt/fit.",
          code: `"use client";
import { useEffect, useMemo, useRef } from "react";

// 环形旋转图廊 · 完整参数版（Originkit Image Group Circle 摄取）
// 免费 picsum 图源（同 seed 固定）；rAF 仅动 transform；尊重 reduced-motion
interface RingConfig {
  rings: number; innerRadius: number; ringGap: number;
  cardWidth: number; cardHeight: number;
  direction: "cw" | "ccw" | "alternate"; speed: number;
  rounded: number; tilt: number; fit: "cover" | "contain"; count: number;
}
const RING_DEFAULTS: RingConfig = {
  rings: 3, innerRadius: 110, ringGap: 120,
  cardWidth: 72, cardHeight: 92,
  direction: "cw", speed: 7,
  rounded: 6, tilt: 6, fit: "cover", count: 12,
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
    rings = RING_DEFAULTS.rings, innerRadius = RING_DEFAULTS.innerRadius, ringGap = RING_DEFAULTS.ringGap,
    cardWidth = RING_DEFAULTS.cardWidth, cardHeight = RING_DEFAULTS.cardHeight,
    direction = RING_DEFAULTS.direction, speed = RING_DEFAULTS.speed,
    rounded = RING_DEFAULTS.rounded, tilt = RING_DEFAULTS.tilt, fit = RING_DEFAULTS.fit, count = RING_DEFAULTS.count,
  } = props;
  const photos = useMemo(() => Array.from({ length: count }, (_, i) => "https://picsum.photos/seed/xiye-ring-" + (i + 1) + "/400/300"), [count]);
  const cards = useMemo(() => {
    const ringN = Math.max(1, Math.round(rings));
    const rnd = mulberry32(0x9e3779b1);
    const radii = Array.from({ length: ringN }, (_, r) => Math.max(1, innerRadius + r * ringGap));
    const totalCirc = radii.reduce((s, rad) => s + 2 * Math.PI * rad, 0);
    const out: { angle: number; radius: number; dir: number; tilt: number; img: string }[] = [];
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
    let raf = 0, last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.7; last = now;
      for (let i = 0; i < cards.length; i++) {
        const el = refs.current[i]; if (!el) continue;
        angles[i] += speed * 0.0008 * cards[i].dir * (dt / 16.7);
        el.style.transform = "translate(" + (Math.cos(angles[i]) * cards[i].radius).toFixed(2) + "px, " + (Math.sin(angles[i]) * cards[i].radius).toFixed(2) + "px) rotate(" + cards[i].tilt.toFixed(2) + "deg)";
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
        <div key={i} ref={(el) => { refs.current[i] = el; }} className="absolute overflow-hidden" style={{ left: "50%", top: "50%", width: cardWidth, height: cardHeight, marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2, borderRadius: rounded, boxShadow: "0 18px 40px color-mix(in srgb, var(--foreground) 12%, transparent)", transform: "translate(" + (Math.cos(c.angle) * c.radius).toFixed(2) + "px, " + (Math.sin(c.angle) * c.radius).toFixed(2) + "px) rotate(" + c.tilt.toFixed(2) + "deg)", willChange: "transform", pointerEvents: "none" }}>
          <img src={c.img} alt="" draggable={false} className="h-full w-full" style={{ objectFit: fit }} />
        </div>
      ))}
    </div>
  );
}`,
          interaction: "多环同向旋转；rAF 仅动 transform；尊重 reduced-motion；全参数可调",
        },
        {
          id: "pring_alt",
          name: "双环交替",
          description: "两环方向相反旋转，节奏感强；全参数可调（环数/半径/间距/尺寸/方向/速度/圆角/倾斜/填充/图源）",
          tags: ["环形", "交替", "参数化"],
          prompt:
            "Same circular rotating gallery but with 2 rings rotating in alternating directions (ring 0 clockwise, ring 1 counter-clockwise) for a dynamic counter-rotation rhythm. Configurable rings/radius/gap/size/direction/speed/rounded/tilt/fit.",
          code: `"use client";
import { useEffect, useMemo, useRef } from "react";

// 双环交替图廊 · 完整参数版（Originkit preset 摄取：rings 2 / alternate）
// 免费 picsum 图源（同 seed 固定）；rAF 仅动 transform；尊重 reduced-motion
interface RingConfig {
  rings: number; innerRadius: number; ringGap: number;
  cardWidth: number; cardHeight: number;
  direction: "cw" | "ccw" | "alternate"; speed: number;
  rounded: number; tilt: number; fit: "cover" | "contain"; count: number;
}
const RING_DEFAULTS: RingConfig = {
  rings: 2, innerRadius: 100, ringGap: 140,
  cardWidth: 80, cardHeight: 100,
  direction: "alternate", speed: 6,
  rounded: 6, tilt: 5, fit: "cover", count: 12,
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
    rings = RING_DEFAULTS.rings, innerRadius = RING_DEFAULTS.innerRadius, ringGap = RING_DEFAULTS.ringGap,
    cardWidth = RING_DEFAULTS.cardWidth, cardHeight = RING_DEFAULTS.cardHeight,
    direction = RING_DEFAULTS.direction, speed = RING_DEFAULTS.speed,
    rounded = RING_DEFAULTS.rounded, tilt = RING_DEFAULTS.tilt, fit = RING_DEFAULTS.fit, count = RING_DEFAULTS.count,
  } = props;
  const photos = useMemo(() => Array.from({ length: count }, (_, i) => "https://picsum.photos/seed/xiye-ring-" + (i + 1) + "/400/300"), [count]);
  const cards = useMemo(() => {
    const ringN = Math.max(1, Math.round(rings));
    const rnd = mulberry32(0x9e3779b1);
    const radii = Array.from({ length: ringN }, (_, r) => Math.max(1, innerRadius + r * ringGap));
    const totalCirc = radii.reduce((s, rad) => s + 2 * Math.PI * rad, 0);
    const out: { angle: number; radius: number; dir: number; tilt: number; img: string }[] = [];
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
    let raf = 0, last = 0;
    const frame = (now: number) => {
      const dt = last ? Math.min(64, now - last) : 16.7; last = now;
      for (let i = 0; i < cards.length; i++) {
        const el = refs.current[i]; if (!el) continue;
        angles[i] += speed * 0.0008 * cards[i].dir * (dt / 16.7);
        el.style.transform = "translate(" + (Math.cos(angles[i]) * cards[i].radius).toFixed(2) + "px, " + (Math.sin(angles[i]) * cards[i].radius).toFixed(2) + "px) rotate(" + cards[i].tilt.toFixed(2) + "deg)";
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
        <div key={i} ref={(el) => { refs.current[i] = el; }} className="absolute overflow-hidden" style={{ left: "50%", top: "50%", width: cardWidth, height: cardHeight, marginLeft: -cardWidth / 2, marginTop: -cardHeight / 2, borderRadius: rounded, boxShadow: "0 18px 40px color-mix(in srgb, var(--foreground) 12%, transparent)", transform: "translate(" + (Math.cos(c.angle) * c.radius).toFixed(2) + "px, " + (Math.sin(c.angle) * c.radius).toFixed(2) + "px) rotate(" + c.tilt.toFixed(2) + "deg)", willChange: "transform", pointerEvents: "none" }}>
          <img src={c.img} alt="" draggable={false} className="h-full w-full" style={{ objectFit: fit }} />
        </div>
      ))}
    </div>
  );
}`,
          interaction: "内外环反向旋转；reduced-motion 静止；全参数可调",
        },
      ],
    },
  ],
};
