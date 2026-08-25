// 首页（Home）页面骨架数据。
// 首批完整变体：navbar 4 / hero 8 / features 8 / faq 6 / cta 6 / footer 4 = 36 个；
// logos/stats/testimonials/pricing 已注册（占位，后续补充）。
// 视觉贯穿：code 中使用 CSS 变量（--background/--surface/--primary…），与视觉风格 token 对齐。

import type { SkeletonPage } from "./types";

export const HOME_PAGE: SkeletonPage = {
  id: "home",
  name: "首页",
  icon: "Home",
  description: "落地页骨架：从导航到页脚，覆盖转化全链路的标准区块",
  components: [
    {
      id: "navbar",
      name: "导航栏",
      icon: "Menu",
      description: "品牌 + 导航链接 + CTA 按钮，决定第一印象",
      variants: [
        {
          id: "nav_transparent",
          name: "透明悬浮",
          description: "透明背景悬浮于 Hero 之上，首屏沉浸感强",
          tags: ["透明", "沉浸"],
          prompt:
            "Build a transparent navbar floating above the hero: logo left, nav links center/right, CTA button right. Transparent background, no border, becomes solid after scroll (add a scroll listener).",
          code: `export function Navbar() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <div className="hidden gap-8 text-sm md:flex">
          <a href="#features" className="opacity-80 hover:opacity-100">功能</a>
          <a href="#pricing" className="opacity-80 hover:opacity-100">{{nav.pricing}}</a>
          <a href="#faq" className="opacity-80 hover:opacity-100">{{nav.faq}}</a>
        </div>
        <a
          href="#cta"
          className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
        >
          {{cta.primary}}
        </a>
      </nav>
    </header>
  );
}`,
          interaction: "滚动后切换为实色背景（监听 scrollY > 16）",
        },
        {
          id: "nav_floating_island",
          name: "浮空胶囊岛",
          description: "玻璃胶囊脱离顶部悬浮 + 汉堡变形 + 全屏玻璃菜单交错揭示",
          tags: ["毛玻璃", "浮起", "高级"],
          prompt:
            "Build a floating island navbar: a detached frosted-glass pill (mt-6, mx-auto, w-max, rounded-full, backdrop-blur) floating above the hero, brand + links + CTA inside; on mobile a hamburger that morphs into an X and opens a full-screen glass overlay menu with staggered link reveals. Premium agency feel.",
          code: `export function Navbar() {
  const [open, setOpen] = useState(false);
  const links = ["功能", "{{nav.pricing}}", "{{nav.faq}}"];
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-6 pt-6">
      <div className="flex w-max items-center gap-6 rounded-full border px-5 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(16px)", boxShadow: "0 12px 40px -12px color-mix(in srgb, var(--foreground) 14%, transparent)" }}>
        <a href="/" className="text-sm font-bold tracking-tight">{{brand}}</a>
        <nav className="hidden items-center gap-5 text-xs sm:flex" style={{ color: "var(--muted-foreground)" }}>
          {links.map((l) => (
            <a key={l} href={"#" + l} className="transition hover:text-[var(--foreground)]">{l}</a>
          ))}
        </nav>
        <a href="#cta" className="rounded-full px-4 py-1.5 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{{cta.primary}}</a>
        <button
          aria-label="菜单"
          onClick={() => setOpen(!open)}
          className="relative flex size-8 items-center justify-center sm:hidden"
        >
          <span className="absolute h-px w-4" style={{ background: "var(--foreground)", transform: open ? "rotate(45deg)" : "none", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)" }} />
          <span className="absolute h-px w-4" style={{ background: "var(--foreground)", transform: open ? "rotate(-45deg)" : "none", transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)" }} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 -z-10 flex items-center justify-center sm:hidden" style={{ background: "color-mix(in srgb, var(--background) 80%, transparent)", backdropFilter: "blur(24px)" }}>
          <nav className="space-y-2 text-center">
            {links.map((l, i) => (
              <a key={l} href={"#" + l} onClick={() => setOpen(false)} className="block text-2xl font-bold"
                style={{ opacity: 0, transform: "translateY(12px)", animation: "none", transition: "opacity 0.4s ease, transform 0.4s cubic-bezier(0.32,0.72,0,1)", animationFillMode: "forwards" }}>
                {l}
              </a>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}`,
          interaction: "胶囊浮起 + 全屏玻璃菜单交错揭示；汉堡两线变形为 X",
        },
        {
          id: "nav_solid",
          name: "实色固定",
          description: "常驻实色背景 + 底部细线，稳定清晰",
          tags: ["实色", "固定"],
          prompt:
            "Build a fixed solid navbar: brand left, links center, CTA right. Background var(--surface), bottom border var(--border), sticky top-0, subtle shadow.",
          code: `export function Navbar() {
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <div className="hidden gap-8 text-sm md:flex">
          <a href="#features" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">功能</a>
          <a href="#pricing" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{{nav.pricing}}</a>
          <a href="#faq" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{{nav.faq}}</a>
        </div>
        <a
          href="#cta"
          className="rounded-md px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
          style={{ background: "var(--primary)" }}
        >
          {{cta.primary}}
        </a>
      </nav>
    </header>
  );
}`,
          interaction: "sticky 固定顶部，内容滚动时始终可见",
        },
        {
          id: "nav_blur",
          name: "毛玻璃",
          description: "半透明 + backdrop-blur，内容若隐若现",
          tags: ["毛玻璃", "现代"],
          prompt:
            "Build a glassmorphism navbar: background var(--surface) at 70% opacity with backdrop-filter blur(12px), bottom border subtle, sticky top-0.",
          code: `export function Navbar() {
  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{
        background: "color-mix(in srgb, var(--surface) 70%, transparent)",
        borderColor: "var(--border)",
        backdropFilter: "blur(12px)",
      }}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <div className="hidden gap-8 text-sm md:flex">
          <a href="#features" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">功能</a>
          <a href="#pricing" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{{nav.pricing}}</a>
          <a href="#faq" className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">{{nav.faq}}</a>
        </div>
        <a href="#cta" className="rounded-md px-4 py-2 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          {{cta.primary}}
        </a>
      </nav>
    </header>
  );
}`,
          interaction: "backdrop-filter: blur(12px) 需浏览器支持（现代浏览器均支持）",
        },
        {
          id: "nav_dark",
          name: "深色沉浸",
          description: "深色背景 + 浅色文字，突出品牌氛围",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark navbar for brand/creative sites: background #0f172a, light text #f8fafc, CTA uses primary color. Works best with dark hero.",
          code: `export function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-slate-50">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <div className="hidden gap-8 text-sm md:flex">
          <a href="#features" className="opacity-70 hover:opacity-100">功能</a>
          <a href="#pricing" className="opacity-70 hover:opacity-100">{{nav.pricing}}</a>
          <a href="#faq" className="opacity-70 hover:opacity-100">{{nav.faq}}</a>
        </div>
        <a
          href="#cta"
          className="rounded-md px-4 py-2 text-sm font-medium text-[var(--on-primary)]"
          style={{ background: "var(--primary)" }}
        >
          {{cta.primary}}
        </a>
      </nav>
    </header>
  );
}`,
          interaction: "与深色 Hero 搭配时视觉最统一",
        },
        {
          id: "nav_mega",
          name: "巨幕菜单",
          description: "主导航 + 一个带浮层的菜单项，信息密度高而不乱",
          tags: ["巨幕", "菜单"],
          prompt:
            "Build a navbar with a mega-menu: brand left, nav links center, one link (产品) opens a floating panel with a 2x2 grid of feature cards on hover. Thin border, surface background, subtle shadow.",
          code: `export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <div className="hidden items-center gap-7 text-sm md:flex">
          <div className="group relative cursor-pointer py-2">
            <span className="opacity-80">产品 ▾</span>
            <div className="invisible absolute left-0 top-full w-80 rounded-xl border p-4 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
              <div className="grid grid-cols-2 gap-3">
                {["分析", "自动化", "协作", "集成"].map((f) => (
                  <div key={f} className="rounded-lg p-2" style={{ background: "var(--background)" }}>
                    <p className="text-sm font-medium">{f}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <a href="#pricing" className="opacity-80 hover:opacity-100">{{nav.pricing}}</a>
          <a href="#faq" className="opacity-80 hover:opacity-100">{{nav.faq}}</a>
        </div>
        <a href="#cta" className="rounded-md px-4 py-2 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{{cta.primary}}</a>
      </nav>
    </header>
  );
}`,
          interaction: "hover 展开浮层菜单（2×2 功能卡）",
        },
        {
          id: "nav_minimal",
          name: "编辑式极简",
          description: "品牌居中、链接极细、底部一条细线，杂志/作品集风",
          tags: ["极简", "编辑"],
          prompt:
            "Build a minimal editorial navbar: brand centered at top, thin nav links below, a single hairline border at the bottom. Generous spacing, no CTA button. Editorial/portfolio style.",
          code: `export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-3xl px-6 py-4 text-center">
        <a href="/" className="text-base font-semibold tracking-tight">{{brand}}</a>
        <nav className="mt-2 flex justify-center gap-6 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <a href="#features" className="hover:text-[var(--foreground)]">功能</a>
          <a href="#pricing" className="hover:text-[var(--foreground)]">{{nav.pricing}}</a>
          <a href="#faq" className="hover:text-[var(--foreground)]">{{nav.faq}}</a>
        </nav>
      </div>
    </header>
  );
}`,
          interaction: "居中编辑式排版，适合极简高级站点",
        },
      ],
    },
    {
      id: "hero",
      name: "首屏 Hero",
      icon: "PanelsTopLeft",
      description: "第一屏：标题 + 副文案 + 行动按钮，决定 3 秒内的去留",
      variants: [
        {
          id: "hero_center",
          name: "居中大字",
          description: "居中标题 + 双按钮 + 下方产品图，SaaS 最常用",
          tags: ["居中", "SaaS"],
          prompt:
            "Build a centered hero: badge pill on top, large centered heading, subheading, primary + secondary CTA buttons, and a product screenshot below with soft shadow. Background var(--background).",
          code: `export function Hero() {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-20 pt-28 text-center">
      <span className="rounded-full border px-3 py-1 text-xs font-medium" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        ✨ 全新 AI 功能上线
      </span>
      <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-5xl">
        把想法变成产品，快 10 倍
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg" style={{ color: "var(--muted-foreground)" }}>
        无需代码，从骨架到上线，几分钟完成一个可用的产品原型。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a href="#cta" className="rounded-md px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          {{cta.primary}}
        </a>
        <a
          href="#demo"
          className="rounded-md border px-5 py-2.5 text-sm font-medium"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          查看演示
        </a>
      </div>
      <div
        className="mt-12 overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--border)", boxShadow: "0 24px 64px color-mix(in srgb, var(--foreground) 12%, transparent)" }}
      >
        <img src="https://picsum.photos/seed/xiye-hero-product/1200/720" alt="产品截图" className="w-full" />
      </div>
    </section>
  );
}`,
          interaction: "标题可加逐字淡入入场动效",
          motionId: "text-rise",
        },
        {
          id: "hero_left",
          name: "左对齐",
          description: "左文右图，营销站/企业站常见",
          tags: ["左对齐", "企业"],
          prompt:
            "Build a left-aligned hero: text block left (badge, heading, sub, CTAs), image/visual right. Two-column grid on desktop, stacked on mobile.",
          code: `export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
          企业级平台
        </span>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
          让团队协作更高效
        </h1>
        <p className="mt-4 text-lg" style={{ color: "var(--muted-foreground)" }}>
          一体化工作台：项目、任务、{{nav.docs}}、数据看板，全在一个地方。
        </p>
        <div className="mt-8 flex gap-3">
          <a href="#cta" className="rounded-md px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
            {{cta.secondary}}
          </a>
          <a href="#demo" className="rounded-md border px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
            预约演示
          </a>
        </div>
        <p className="mt-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
          已有 2,000+ 团队在使用
        </p>
      </div>
      <div className="rounded-2xl border p-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <img src="https://picsum.photos/seed/xiye-app-ui/1000/700" alt="产品界面" className="w-full rounded-xl" />
      </div>
    </section>
  );
}`,
          interaction: "左侧文字块可做交错上升入场",
        },
        {
          id: "hero_split",
          name: "分屏图文",
          description: "左图右文，展示型/媒体类首页",
          tags: ["分屏", "展示"],
          prompt:
            "Build a split-screen hero: full-height, image or visual fills one half, content on the other half. Strong for portfolio/media sites.",
          code: `export function Hero() {
  return (
    <section className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="flex items-center px-6 py-20 lg:px-16">
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            设计驱动的前沿品牌
          </h1>
          <p className="mt-4 text-lg" style={{ color: "var(--muted-foreground)" }}>
            我们用设计与技术，帮你讲好品牌故事。
          </p>
          <div className="mt-8 flex gap-3">
            <a href="#cta" className="rounded-md px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
              联系我们
            </a>
            <a href="#work" className="rounded-md border px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
              查看作品
            </a>
          </div>
        </div>
      </div>
      <div className="relative min-h-[50vh] lg:min-h-screen">
        <img src="https://picsum.photos/seed/xiye-brand/900/900" alt="品牌视觉" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    </section>
  );
}`,
          interaction: "图片侧可加视差或缓慢缩放",
        },
        {
          id: "hero_glass",
          name: "玻璃卡片",
          description: "渐变背景 + 玻璃内容卡，高级感强",
          tags: ["毛玻璃", "渐变", "高级"],
          prompt:
            "Build a glass hero: gradient background (primary to secondary, subtle), centered content in a glass card (surface at 60% + backdrop blur), CTA buttons inside.",
          code: `export function Hero() {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center px-6"
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--background)), color-mix(in srgb, var(--secondary) 15%, var(--background)))" }}
    >
      <div
        className="max-w-2xl rounded-3xl border p-10 text-center sm:p-14"
        style={{
          background: "color-mix(in srgb, var(--surface) 60%, transparent)",
          borderColor: "var(--border)",
          backdropFilter: "blur(20px)",
        }}
      >
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          轻盈而强大的产品体验
        </h1>
        <p className="mt-4 text-lg" style={{ color: "var(--muted-foreground)" }}>
          玻璃拟态风格，为你的品牌带来通透的现代感。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <a href="#cta" className="rounded-full px-6 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
            开始体验
          </a>
          <a href="#learn" className="rounded-full border px-6 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
            {{cta.secondary}}
          </a>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "玻璃卡片 hover 可轻微上浮",
        },
        {
          id: "hero_gradient",
          name: "渐变背景",
          description: "大色块渐变 + 白字标题，品牌冲击力",
          tags: ["渐变", "品牌"],
          prompt:
            "Build a bold gradient hero: full-width gradient background from primary to secondary, white/light heading, CTA buttons in contrasting style.",
          code: `export function Hero() {
  return (
    <section
      className="px-6 py-28 text-center text-white"
      style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}
    >
      <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
        开启你的数字之旅
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
        从零到一，我们用科技和创意点亮你的品牌。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a href="#cta" className="rounded-md bg-white px-6 py-2.5 text-sm font-medium text-slate-900">
          {{cta.primary}}
        </a>
        <a href="#learn" className="rounded-md border border-white/60 px-6 py-2.5 text-sm font-medium text-white">
          {{cta.secondary}}
        </a>
      </div>
    </section>
  );
}`,
          interaction: "渐变背景可加缓慢流动动画",
          motionId: "fade-up",
        },
        {
          id: "hero_dual_cta",
          name: "双 CTA 焦点",
          description: "主次按钮 + 信任徽章行，转化导向",
          tags: ["转化", "SaaS"],
          prompt:
            "Build a conversion-focused hero: strong heading, subheading, primary CTA + secondary CTA with icon, trust badges row below (logos / ratings / user count).",
          code: `export function Hero() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-28 text-center">
      <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
        你的增长引擎，从这里开始
      </h1>
      <p className="mx-auto mt-4 max-w-lg text-lg" style={{ color: "var(--muted-foreground)" }}>
        加入 50,000+ 团队，用数据驱动每一个决策。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a href="#cta" className="rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          免费注册 →
        </a>
        <a href="#demo" className="rounded-md border px-6 py-3 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          观看演示
        </a>
      </div>
      <div className="mt-10 flex items-center justify-center gap-6 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <span>★★★★★ 4.9/5</span>
        <span>·</span>
        <span>50k+ 用户</span>
        <span>·</span>
        <span>SOC2 认证</span>
      </div>
    </section>
  );
}`,
          interaction: "信任徽章行增强转化可信度",
        },
        {
          id: "hero_video",
          name: "视频背景",
          description: "自动播放视频/动图铺满首屏",
          tags: ["视频", "沉浸"],
          prompt:
            "Build a video-background hero: full-screen autoplay muted loop video or animated GIF behind, dark overlay for readability, centered heading + CTA.",
          code: `export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/hero.mp4"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 max-w-2xl px-6 text-center text-white">
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
          感受真正的身临其境
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-white/80">
          用视频讲述你的产品故事，让访客第一眼就被吸引。
        </p>
        <a href="#cta" className="mt-8 inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-slate-900">
          观看更多
        </a>
      </div>
    </section>
  );
}`,
          interaction: "视频需 autoplay + muted + playsInline；封面图兜底",
        },
        {
          id: "hero_bento",
          name: "极简 Bento",
          description: "左文右 Bento 网格浮窗，编辑式干净，信息密度高而不乱",
          tags: ["bento", "极简", "高级"],
          prompt:
            "Build a minimalist bento hero: left text column (eyebrow, large heading, sub, dual CTA), right a 2x2 bento grid of feature cards (surface bg, thin border, restrained shadow). Generous whitespace, no noise.",
          code: `export function Hero() {
  const bento = [
    { t: "统一收件箱", d: "邮件/消息/任务一处" },
    { t: "AI 摘要", d: "长文一键提炼" },
    { t: "快捷命令", d: "Cmd+K 直达" },
    { t: "实时同步", d: "多端秒级" },
  ];
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
      <div>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
          一体化工作台
        </span>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
          把分散的工具，收进一个清爽的空间
        </h1>
        <p className="mt-4 text-lg" style={{ color: "var(--muted-foreground)" }}>
          邮件、消息、任务、文档——结构化呈现，专注真正重要的事。
        </p>
        <div className="mt-8 flex gap-3">
          <a href="#cta" className="rounded-md px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
            免费开始
          </a>
          <a href="#demo" className="rounded-md border px-5 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
            看演示
          </a>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {bento.map((b) => (
          <div key={b.t} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-sm font-semibold">{b.t}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{b.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "Bento 卡片 hover 轻微上浮 + 高光（复用 Card spotlight）",
          motionId: "fade-up",
        },
        {
          id: "hero_editorial",
          name: "编辑式非对称",
          description: "超大标题 + 右侧细线信息列，杂志感强、克制有力",
          tags: ["编辑", "非对称", "高级"],
          prompt:
            "Build an editorial asymmetric hero: 12-col grid, left 7 spans hold an oversized serif heading + eyebrow, right 5 spans hold a thin-divider info list (service/cycle/clients) + pill CTA. Magazine-grade whitespace.",
          code: `export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-28 md:grid-cols-12">
      <div className="md:col-span-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>
          设计驱动的产品工作室
        </p>
        <h1 className="mt-5 text-5xl font-bold leading-[1.05] sm:text-6xl">
          我们替你把复杂，<br />讲成简单。
        </h1>
      </div>
      <div className="md:col-span-5 md:border-l md:pl-8" style={{ borderColor: "var(--border)" }}>
        <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
          从品牌策略到上线交付，一支团队、一条主线。
        </p>
        <dl className="mt-6 space-y-4 text-sm">
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
            <dt style={{ color: "var(--muted-foreground)" }}>服务</dt><dd className="font-medium">品牌 / 网站 / 产品</dd>
          </div>
          <div className="flex justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
            <dt style={{ color: "var(--muted-foreground)" }}>周期</dt><dd className="font-medium">2–6 周</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-foreground)" }}>客户</dt><dd className="font-medium">120+ 团队</dd>
          </div>
        </dl>
        <a href="#cta" className="mt-8 inline-block rounded-full px-6 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          开启合作
        </a>
      </div>
    </section>
  );
}`,
          interaction: "超大标题做逐字/逐行上升入场（text-rise）",
          motionId: "text-rise",
        },
        {
          id: "hero_morphgradient",
          name: "流动渐变网格",
          description: "克制的大地色雾感渐变流动背景 + 居中极简文字，高级不喧哗",
          tags: ["渐变", "极简", "高级"],
          prompt:
            "Build a calm morphing-gradient hero: layered radial gradients (primary/secondary at low opacity over background) as the canvas, centered minimal heading + sub + pill CTA. Restrained, premium, no loud color.",
          code: `export function Hero() {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6"
      style={{
        background:
          "radial-gradient(40% 50% at 20% 20%, color-mix(in srgb, var(--primary) 22%, transparent), transparent), radial-gradient(45% 55% at 85% 30%, color-mix(in srgb, var(--secondary) 20%, transparent), transparent), radial-gradient(50% 60% at 50% 90%, color-mix(in srgb, var(--accent2, var(--primary)) 16%, transparent), transparent), var(--background)",
      }}
    >
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
          安静，却足够有力
        </h1>
        <p className="mx-auto mt-5 max-w-md text-lg" style={{ color: "var(--muted-foreground)" }}>
          少即是多。我们把克制，做成一种产品力。
        </p>
        <a href="#cta" className="mt-8 inline-block rounded-full px-7 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          了解更多
        </a>
      </div>
    </section>
  );
}`,
          interaction: "渐变背景可做缓慢流动（morphing gradient），文字 reveal-on-scroll",
          motionId: "reveal-on-scroll",
        },
      ],
    },
    {
      id: "features",
      name: "功能特性",
      icon: "LayoutGrid",
      description: "用结构化的方式展示产品核心能力",
      variants: [
        {
          id: "feat_grid3",
          name: "三列网格",
          description: "3 列等宽卡片，SaaS 最常见",
          tags: ["网格", "SaaS"],
          prompt:
            "Build a 3-column feature grid: section heading centered, 3-6 cards each with icon, title, description. Cards use var(--surface) background, border var(--border).",
          code: `export function Features() {
  const items = [
    { icon: "⚡", title: "极速性能", desc: "毫秒级响应，体验丝滑" },
    { icon: "🔒", title: "安全可靠", desc: "端到端加密，SOC2 合规" },
    { icon: "🧩", title: "灵活集成", desc: "50+ 主流工具一键接入" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-3xl font-bold">为什么选择我们</h2>
        <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>
          三个理由，让你毫不犹豫
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {items.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border p-6 transition-shadow hover:shadow-lg"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <div className="flex size-11 items-center justify-center rounded-lg text-xl" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
              {f.icon}
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "卡片 hover 上浮 + 阴影加深",
        },
        {
          id: "feat_staggered",
          name: "交错布局",
          description: "图文交替排布，叙事感强",
          tags: ["交错", "叙事"],
          prompt:
            "Build a staggered feature layout: alternating text/image rows (image left then right), each row a feature with small icon label, title, description, link.",
          code: `export function Features() {
  const rows = [
    { title: "智能分析", desc: "AI 自动洞察数据趋势，输出可执行建议。", img: "https://picsum.photos/seed/xiye-feat-analytics/600/400" },
    { title: "实时协作", desc: "多人同时编辑，变更实时同步。", img: "https://picsum.photos/seed/xiye-feat-collab/600/400" },
  ];
  return (
    <section className="mx-auto max-w-6xl space-y-24 px-6 py-24">
      {rows.map((r, i) => (
        <div key={r.title} className="grid items-center gap-10 md:grid-cols-2">
          <div className={i % 2 ? "md:order-2" : ""}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>
              功能 0{i + 1}
            </span>
            <h3 className="mt-2 text-2xl font-bold">{r.title}</h3>
            <p className="mt-3" style={{ color: "var(--muted-foreground)" }}>{r.desc}</p>
            <a href="#learn" className="mt-4 inline-block text-sm font-medium" style={{ color: "var(--primary)" }}>
              {{cta.secondary}} →
            </a>
          </div>
          <div className={i % 2 ? "md:order-1" : ""}>
            <img src={r.img} alt={r.title} className="w-full rounded-xl border" style={{ borderColor: "var(--border)" }} />
          </div>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "每行进入视口时交错淡入",
        },
        {
          id: "feat_numbered",
          name: "编号列表",
          description: "大字编号 + 说明，步骤/方法论型",
          tags: ["编号", "步骤"],
          prompt:
            "Build a numbered feature list: large outline numbers 01/02/03, title, description per item. Minimal styling, borders between rows.",
          code: `export function Features() {
  const items = [
    { n: "01", title: "连接数据源", desc: "一键接入数据库、CRM、表格。" },
    { n: "02", title: "配置自动化", desc: "拖拽搭建自动化流程。" },
    { n: "03", title: "上线监控", desc: "实时仪表盘与告警。" },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="text-3xl font-bold">三步搞定</h2>
      <div className="mt-10 divide-y" style={{ borderColor: "var(--border)" }}>
        {items.map((f) => (
          <div key={f.n} className="flex gap-6 py-6">
            <span className="text-4xl font-black opacity-20">{f.n}</span>
            <div>
              <h3 className="text-xl font-semibold">{f.title}</h3>
              <p className="mt-1" style={{ color: "var(--muted-foreground)" }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "编号可做成滚动放大效果",
        },
        {
          id: "feat_iconcard",
          name: "图标卡片",
          description: "纯图标 + 标题卡片墙，轻量直观",
          tags: ["图标", "轻量"],
          prompt:
            "Build a lightweight icon-card grid: 4-6 small cards each with icon, title, one-line description. Compact spacing, subtle border.",
          code: `export function Features() {
  const items = [
    { icon: "🚀", title: "快速启动" },
    { icon: "🛠️", title: "灵活配置" },
    { icon: "📊", title: "数据洞察" },
    { icon: "🔔", title: "实时通知" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-center text-2xl font-bold">核心能力</h2>
      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        {items.map((f) => (
          <div key={f.title} className="rounded-xl border p-5 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <div className="text-2xl">{f.icon}</div>
            <p className="mt-3 text-sm font-medium">{f.title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "适合作为特性区的补充呈现",
        },
        {
          id: "feat_timeline",
          name: "时间线",
          description: "纵向时间轴，适合产品演进/路线图",
          tags: ["时间线", "路线图"],
          prompt:
            "Build a vertical timeline: central or left line, alternating dots with title/date/description. Great for roadmap or product evolution.",
          code: `export function Features() {
  const steps = [
    { time: "2024 Q1", title: "版本 1.0", desc: "核心工作流上线" },
    { time: "2024 Q3", title: "版本 2.0", desc: "AI 助手与自动化" },
    { time: "2025 Q1", title: "版本 3.0", desc: "企业级权限与 SSO" },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <h2 className="text-3xl font-bold">产品路线图</h2>
      <div className="relative mt-12 space-y-10 border-l pl-8" style={{ borderColor: "var(--border)" }}>
        {steps.map((s) => (
          <div key={s.title} className="relative">
            <span className="absolute -left-[35px] top-1 size-3.5 rounded-full" style={{ background: "var(--primary)" }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--primary)" }}>{s.time}</p>
            <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "时间线节点可随滚动点亮",
        },
        {
          id: "feat_bento",
          name: "Bento 卡片",
          description: "大小不一的多格拼图，视觉丰富",
          tags: ["Bento", "现代"],
          prompt:
            "Build a bento grid: 5-6 cards of varying sizes (2 large, 3 small) in a 3-column masonry-like grid, some with visuals. Very modern SaaS look.",
          code: `export function Features() {
  const large = [
    { title: "统一工作台", desc: "所有工具集中在一个界面。", span: "col-span-2" },
    { title: "AI 助手", desc: "随时提问，自动生成。", span: "" },
  ];
  const small = [
    { title: "快捷命令", desc: "Cmd+K 一切皆可达" },
    { title: "实时同步", desc: "多端秒级同步" },
    { title: "开放 API", desc: "完整 REST + Webhook" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">一个平台，全部搞定</h2>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {large.map((c) => (
          <div key={c.title} className={"rounded-2xl border p-6 " + c.span} style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="text-xl font-semibold">{c.title}</h3>
            <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>{c.desc}</p>
          </div>
        ))}
        {small.map((c) => (
          <div key={c.title} className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h4 className="font-semibold">{c.title}</h4>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "Bento 卡可加悬停放大高亮",
        },
        {
          id: "feat_image_list",
          name: "大图 + 列表",
          description: "左侧大图右侧能力清单，功能型",
          tags: ["图文", "功能"],
          prompt:
            "Build a feature section with large visual on left and bullet capability list on right: heading, checkmark list, CTA link.",
          code: `export function Features() {
  const points = ["实时数据分析", "团队权限管理", "第三方集成", "企业级安全"];
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
      <img src="https://picsum.photos/seed/xiye-feature/900/640" alt="功能预览" className="w-full rounded-2xl border" style={{ borderColor: "var(--border)" }} />
      <div>
        <h2 className="text-3xl font-bold">一个更聪明的产品</h2>
        <ul className="mt-6 space-y-3">
          {points.map((pt) => (
            <li key={pt} className="flex items-center gap-3">
              <span className="flex size-5 items-center justify-center rounded-full text-xs text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✓</span>
              <span>{pt}</span>
            </li>
          ))}
        </ul>
        <a href="#learn" className="mt-6 inline-block text-sm font-medium" style={{ color: "var(--primary)" }}>
          了解全部功能 →
        </a>
      </div>
    </section>
  );
}`,
          interaction: "清单项可逐条淡入",
        },
        {
          id: "feat_tabs",
          name: "标签页切换",
          description: "顶部胶囊 tab 切换能力组，极简下划线风，信息分层清晰",
          tags: ["tabs", "极简", "高级"],
          prompt:
            "Build a tabbed features section: pill tab bar (active = primary fill) to switch between capability groups, each group a 3-card grid. Minimal, clean dividers.",
          code: `export function Features() {
  const [tab, setTab] = React.useState(0);
  const groups = [
    { name: "核心能力", items: ["极速性能", "安全可靠", "灵活集成"] },
    { name: "协作", items: ["实时同步", "权限管理", "评论"] },
    { name: "安全", items: ["SSO", "审计日志", "合规"] },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="mb-8 flex gap-2">
        {groups.map((g, i) => (
          <button key={g.name} onClick={() => setTab(i)} className="rounded-full px-4 py-2 text-sm font-medium" style={i === tab ? { background: "var(--primary)", color: "var(--on-primary)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>
            {g.name}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {groups[tab].items.map((it) => (
          <div key={it} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-base font-semibold">{it}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "tab 切换内容淡入；卡片 hover 上浮",
          motionId: "fade-up",
        },
        {
          id: "feat_3dtilt",
          name: "3D 倾斜卡",
          description: "卡片随鼠标轻微 3D 倾斜 + 高光，克制不浮夸，高级触感",
          tags: ["3D", "倾斜", "高级"],
          prompt:
            "Build a 3D tilt feature grid: each card rotates slightly toward the cursor (perspective + rotateX/rotateY, max ~8deg), with a soft highlight. Restrained, premium hover feel.",
          code: `export function Features() {
  const Tilt = ({ children }: { children: React.ReactNode }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [t, setT] = React.useState({ rx: 0, ry: 0 });
    return (
      <div
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          setT({ rx: -((e.clientY - r.top) / r.height - 0.5) * 8, ry: ((e.clientX - r.left) / r.width - 0.5) * 8 });
        }}
        onMouseLeave={() => setT({ rx: 0, ry: 0 })}
        className="rounded-2xl border p-6 transition-transform duration-200"
        style={{ borderColor: "var(--border)", background: "var(--surface)", transform: \`perspective(700px) rotateX(\${t.rx}deg) rotateY(\${t.ry}deg)\` }}
      >
        {children}
      </div>
    );
  };
  const items = [
    { icon: "⚡", t: "极速性能", d: "毫秒级响应" },
    { icon: "🔒", t: "安全可靠", d: "SOC2 合规" },
    { icon: "🧩", t: "灵活集成", d: "50+ 工具" },
  ];
  return (
    <section className="mx-auto grid max-w-6xl gap-4 px-6 py-24 sm:grid-cols-3">
      {items.map((f) => (
        <Tilt key={f.t}>
          <div className="flex size-10 items-center justify-center rounded-lg text-lg" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>{f.icon}</div>
          <p className="mt-3 text-base font-semibold">{f.t}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.d}</p>
        </Tilt>
      ))}
    </section>
  );
}`,
          interaction: "卡片随鼠标 3D 倾斜（GSAP 可接 quickTo 平滑）",
          motionId: "reveal-on-scroll",
        },
        {
          id: "feat_bento_animated",
          name: "动效 Bento",
          description: "等宽 Bento 网格 + 悬停联动高光，编辑式干净，信息密度高",
          tags: ["bento", "极简", "高级"],
          prompt:
            "Build an animated bento features grid: uneven cells (one wide), surface cards with thin borders and a hover spotlight that follows the cursor. Generous whitespace.",
          code: `export function Features() {
  const items = [
    { t: "统一工作台", d: "所有工具集中在一个界面。", span: true },
    { t: "AI 助手", d: "随时提问。" },
    { t: "快捷命令", d: "Cmd+K。" },
    { t: "实时同步", d: "多端秒级。" },
    { t: "开放 API", d: "REST + Webhook。" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <h2 className="mb-8 text-center text-3xl font-bold">一个平台，全部搞定</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((b) => (
          <div key={b.t} className={"rounded-2xl border p-6 transition-shadow hover:shadow-lg " + (b.span ? "sm:col-span-2" : "")} style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-base font-semibold">{b.t}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{b.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "卡片 hover 高光跟随（CursorSpotlight）；整组滚动交错淡入",
          motionId: "scroll-fade-up",
        },
      ],
    },
    {
      id: "faq",
      name: "{{nav.faq}} 手风琴",
      icon: "MessageCircleQuestion",
      description: "常见问题折叠，降低决策阻力",
      variants: [
        {
          id: "faq_single",
          name: "单选展开",
          description: "一次只开一个，结构克制",
          tags: ["手风琴", "单开"],
          prompt:
            "Build an accordion {{nav.faq}}: each item has question button and collapsible answer. Only one open at a time (close others on open). Use chevron rotate indicator.",
          code: `export function Faq() {
  const items = [
    { q: "免费版有什么限制？", a: "免费版支持 3 个项目与 1 名成员。" },
    { q: "可以随时升级吗？", a: "可以，升级立即生效，按天计费。" },
    { q: "数据安全吗？", a: "端到端加密，支持 SOC2 报告。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">常见问题</h2>
      <div className="mt-10 divide-y rounded-xl border" style={{ borderColor: "var(--border)" }}>
        {items.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left font-medium"
            >
              {f.q}
              <span className={"transition-transform " + (open === i ? "rotate-180" : "")}>▾</span>
            </button>
            {open === i && (
              <p className="px-5 pb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "单选手风琴：打开一项自动关闭其他项",
          motionId: "spring",
        },
        {
          id: "faq_multi",
          name: "多开手风琴",
          description: "可同时展开多项，信息型站点友好",
          tags: ["手风琴", "多开"],
          prompt:
            "Build a multi-open accordion {{nav.faq}}: each item independent toggle. Good for documentation-style {{nav.faq}} where users compare multiple answers.",
          code: `export function Faq() {
  const items = [
    { q: "支持哪些支付方式？", a: "信用卡、PayPal、支付宝。" },
    { q: "有年度折扣吗？", a: "年度订阅享 8 折。" },
    { q: "如何取消订阅？", a: "设置页一键取消，随时可恢复。" },
  ];
  const [open, setOpen] = useState(new Set());
  const toggle = (i) => {
    const next = new Set(open);
    next.has(i) ? next.delete(i) : next.add(i);
    setOpen(next);
  };
  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">常见问题</h2>
      <div className="mt-10 space-y-3">
        {items.map((f, i) => (
          <div key={f.q} className="rounded-xl border" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => toggle(i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
              {f.q}
              <span className={"transition-transform " + (open.has(i) ? "rotate-180" : "")}>▾</span>
            </button>
            {open.has(i) && (
              <p className="px-5 pb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "多项独立开合，互不干扰",
        },
        {
          id: "faq_twocol",
          name: "双列问答",
          description: "两栏静态 Q&A，简洁无需交互",
          tags: ["双列", "静态"],
          prompt:
            "Build a two-column {{nav.faq}}: heading left, questions+answers listed right in two columns. Static, no accordion. Good for short {{nav.faq}}.",
          code: `export function Faq() {
  const items = [
    { q: "有{{cta.secondary}}吗？", a: "14 天全功能{{cta.secondary}}。" },
    { q: "支持迁移吗？", a: "支持从主流平台一键导入。" },
    { q: "有没有 API？", a: "完整 REST API 与 Webhook。" },
    { q: "多久更新一次？", a: "每月发布新功能。" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="text-3xl font-bold">{{nav.faq}}</h2>
          <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>
            没找到答案？<a href="#contact" style={{ color: "var(--primary)" }}>联系我们</a>
          </p>
        </div>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {items.map((f) => (
            <div key={f.q}>
              <p className="font-medium">{f.q}</p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "静态布局，零交互成本",
        },
        {
          id: "faq_dark",
          name: "深色 {{nav.faq}}",
          description: "深底浅字，与深色主题搭配",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark {{nav.faq}} section: background var(--foreground) or slate-900, light text, accordion items with subtle border.",
          code: `export function Faq() {
  const items = [
    { q: "如何开始？", a: "注册后按引导三步完成初始化。" },
    { q: "支持私有部署吗？", a: "企业版支持私有化部署。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="bg-slate-900 px-6 py-24 text-slate-50">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold">常见问题</h2>
        <div className="mt-10 space-y-3">
          {items.map((f, i) => (
            <div key={f.q} className="rounded-xl border border-white/10">
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
                {f.q}
                <span className={"transition-transform text-slate-400 " + (open === i ? "rotate-180" : "")}>▾</span>
              </button>
              {open === i && (
                <p className="px-5 pb-4 text-sm text-slate-400">{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "与深色 Hero/Footer 视觉闭环",
        },
        {
          id: "faq_search",
          name: "带搜索",
          description: "顶部搜索框过滤问题，内容多的站",
          tags: ["搜索", "内容型"],
          prompt:
            "Build a searchable {{nav.faq}}: search input on top filters questions by keyword (client-side filter), list below.",
          code: `export function Faq() {
  const items = [
    { q: "如何导出数据？", a: "设置页点击导出 CSV。" },
    { q: "如何邀请成员？", a: "成员管理页输入{{auth.email}}邀请。" },
    { q: "如何修改{{auth.password}}？", a: "账户安全页修改。" },
    { q: "如何删除项目？", a: "项目设置页删除并确认。" },
  ];
  const [kw, setKw] = useState("");
  const filtered = items.filter((f) => f.q.includes(kw));
  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">帮助中心</h2>
      <input
        value={kw}
        onChange={(e) => setKw(e.target.value)}
        placeholder="搜索问题…"
        className="mt-8 w-full rounded-xl border px-4 py-3 outline-none focus:border-[var(--primary)]"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      />
      <div className="mt-6 space-y-3">
        {filtered.map((f) => (
          <div key={f.q} className="rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
            <p className="font-medium">{f.q}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "客户端过滤即可，量大可接 Algolia",
        },
        {
          id: "faq_accordion_animated",
          name: "动效手风琴",
          description: "平滑展开 + 当前项暖调高亮，交互有呼吸感",
          tags: ["手风琴", "动效"],
          prompt:
            "Build an animated accordion {{nav.faq}}: smooth height expand (grid-rows 0fr→1fr), active item highlighted with a soft accent background and a rotating chevron. One open at a time.",
          code: `export function Faq() {
  const items = [
    { q: "支持哪些集成？", a: "Slack、GitHub、Figma 等 50+ 原生集成。" },
    { q: "如何计费？", a: "按席位月付，年付享 8 折。" },
    { q: "有 SLA 吗？", a: "企业版提供 99.95% 可用性 SLA。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <h2 className="text-center text-3xl font-bold">常见问题</h2>
      <div className="mt-10 space-y-3">
        {items.map((f, i) => {
          const isOpen = open === i;
          return (
            <div key={f.q} className="overflow-hidden rounded-xl border transition-colors" style={{ borderColor: "var(--border)", background: isOpen ? "color-mix(in srgb, var(--primary) 8%, var(--surface))" : "var(--surface)" }}>
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
                {f.q}
                <span className={"text-sm transition-transform " + (isOpen ? "rotate-180" : "")} style={{ color: "var(--primary)" }}>▾</span>
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}>
                <div className="overflow-hidden"><p className="px-5 pb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}`,
          interaction: "平滑展开 + 当前项暖调高亮",
          motionId: "spring",
        },
        {
          id: "faq_editorial",
          name: "编辑式分栏",
          description: "左侧巨标题 + 右侧单开手风琴，细线分隔，杂志排版",
          tags: ["编辑", "分栏"],
          prompt:
            "Build an editorial {{nav.faq}}: large display heading on the left, a single-open accordion on the right with hairline dividers between items. Magazine layout.",
          code: `export function Faq() {
  const items = [
    { q: "如何开始？", a: "注册后按引导三步完成初始化。" },
    { q: "支持私有部署吗？", a: "企业版支持私有化部署。" },
    { q: "多久更新一次？", a: "每月发布新功能。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="grid gap-10 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">常见问题</h2>
          <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>没找到答案？<a href="#contact" style={{ color: "var(--primary)" }}>联系我们</a></p>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {items.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center justify-between py-5 text-left">
                  <span className="font-medium">{f.q}</span>
                  <span className={"transition-transform " + (isOpen ? "rotate-45" : "")} style={{ color: "var(--primary)" }}>+</span>
                </button>
                {isOpen && <p className="pb-5 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "左标题右手风琴，细线分隔编辑风",
        },
        {
          id: "faq_neon",
          name: "霓虹 FAQ",
          description: "深底霓虹高亮问答",
          tags: ["FAQ", "霓虹", "暗黑"],
          prompt:
            "Build a neon FAQ: on a dark canvas, an accordion where the question glows in a vivid accent and answers are dimmed, hairline separators. Bold agency energy.",
          code: `export function NeonFaq() {
  const rows = [
    { q: "免费版有什么限制？", a: "支持 3 个项目与 1 名成员。" },
    { q: "可以随时升级吗？", a: "升级即时生效，按天计费。" },
    { q: "数据安全吗？", a: "端到端加密，支持 SOC2 报告。" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-2xl font-bold text-[var(--foreground)]">常见问题</h2>
        <div className="mt-8 divide-y" style={{ borderColor: "var(--border)" }}>
          {rows.map((f) => (
            <div key={f.q} className="grid gap-1 py-5">
              <p className="text-base font-semibold" style={{ color: "var(--accent-1)" }}>{f.q}</p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "深底霓虹问题、细分隔",
        },
      ],
    },
    {
      id: "cta",
      name: "CTA 行动号召",
      icon: "Megaphone",
      description: "转化冲刺：把访客推向注册/购买",
      variants: [
        {
          id: "cta_solid",
          name: "实心横幅",
          description: "品牌色横幅 + 白字，简单直接",
          tags: ["横幅", "转化"],
          prompt:
            "Build a solid CTA banner: primary background, centered heading + subheading + white button. Rounded container inside a section.",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="rounded-2xl px-8 py-14 text-center text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
        <h2 className="text-3xl font-bold">准备好开始了吗？</h2>
        <p className="mx-auto mt-2 max-w-md text-white/80">
          免费注册，14 天全功能试用，无需信用卡。
        </p>
        <a href="#signup" className="mt-6 inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-slate-900">
          {{cta.primary}} →
        </a>
      </div>
    </section>
  );
}`,
          interaction: "按钮 hover 轻微缩放",
          motionId: "hover-lift",
        },
        {
          id: "cta_gradient",
          name: "渐变横幅",
          description: "渐变背景 CTA，视觉张力强",
          tags: ["渐变", "品牌"],
          prompt:
            "Build a gradient CTA banner: linear-gradient(primary, secondary) background, white heading, glass or white button.",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div
        className="rounded-2xl px-8 py-14 text-center text-white"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}
      >
        <h2 className="text-3xl font-bold">加入 5 万+ 团队</h2>
        <p className="mx-auto mt-2 max-w-md text-white/80">
          {{cta.secondary}}，10 分钟搭建你的工作流。
        </p>
        <a href="#signup" className="mt-6 inline-block rounded-full bg-white px-7 py-3 text-sm font-medium text-slate-900">
          立即注册
        </a>
      </div>
    </section>
  );
}`,
          interaction: "渐变可缓慢流动增加活力",
        },
        {
          id: "cta_glass",
          name: "玻璃 CTA",
          description: "背景图 + 玻璃卡片，高级质感",
          tags: ["毛玻璃", "高级"],
          prompt:
            "Build a glass CTA: background image with dark overlay, content in glass card (surface 60% + blur), heading + button.",
          code: `export function Cta() {
  return (
    <section className="relative overflow-hidden px-6 py-24">
      <img src="https://picsum.photos/seed/xiye-hero-bg/1600/1000" alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative z-10 mx-auto max-w-xl rounded-3xl border border-white/20 p-10 text-center text-white"
        style={{ background: "color-mix(in srgb, var(--surface) 50%, transparent)", backdropFilter: "blur(16px)" }}
      >
        <h2 className="text-3xl font-bold">别错过你的下一个增长</h2>
        <p className="mt-2 text-white/80">加入我们，一起把想法变成现实。</p>
        <a href="#signup" className="mt-6 inline-block rounded-md px-6 py-3 text-sm font-medium" style={{ background: "var(--primary)" }}>
          开始体验
        </a>
      </div>
    </section>
  );
}`,
          interaction: "背景图可加缓慢缩放视差",
        },
        {
          id: "cta_divider",
          name: "分隔线 CTA",
          description: "与上文同底色、靠分隔线区分",
          tags: ["克制", "简洁"],
          prompt:
            "Build a minimal CTA: no banner, just heading + button centered on the same background, with top border divider. Very restrained.",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-3xl border-t px-6 py-20 text-center" style={{ borderColor: "var(--border)" }}>
      <h2 className="text-2xl font-bold">准备好提升效率了吗？</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
        现在就{{cta.primary}}，随时可以取消。
      </p>
      <a href="#signup" className="mt-6 inline-block rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
        免费注册
      </a>
    </section>
  );
}`,
          interaction: "适合极简/编辑风站点",
        },
        {
          id: "cta_newsletter",
          name: "邮件订阅",
          description: "Email 收集框 + 按钮，增长留资",
          tags: ["订阅", "增长"],
          prompt:
            "Build a newsletter CTA: heading, email input + subscribe button inline, small privacy note below.",
          code: `export function Cta() {
  const [email, setEmail] = useState("");
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h2 className="text-3xl font-bold">订阅产品动态</h2>
      <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
        每周一封，产品更新与行业洞察，随时退订。
      </p>
      <form onSubmit={(e) => e.preventDefault()} className="mx-auto mt-6 flex max-w-md gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <button
          type="submit"
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]"
          style={{ background: "var(--primary)" }}
        >
          订阅
        </button>
      </form>
      <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
        我们重视隐私，绝不发送垃圾邮件。
      </p>
    </section>
  );
}`,
          interaction: "提交后显示成功态 + 防抖限流",
        },
        {
          id: "cta_dualbtn",
          name: "双按钮 CTA",
          description: "主按钮 + 次按钮 + 小字说明",
          tags: ["转化", "SaaS"],
          prompt:
            "Build a two-button CTA: heading, primary CTA + secondary link-style CTA, small note below (no credit card / money-back guarantee).",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h2 className="text-3xl font-bold">今天就开始</h2>
      <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>
        无需信用卡，14 天内随时取消。
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <a href="#signup" className="rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          {{cta.primary}}
        </a>
        <a href="#sales" className="rounded-md border px-6 py-3 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          联系销售
        </a>
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
        ✓ 30 天退款保证 · ✓ 无需信用卡
      </p>
    </section>
  );
}`,
          interaction: "信任小字是转化的临门一脚",
        },
        {
          id: "cta_card_bento",
          name: "Bento 卡 CTA",
          description: "分格卡片：标题 / 按钮分列，编辑式克制，信息层级清晰",
          tags: ["bento", "极简", "高级"],
          prompt:
            "Build a bento CTA card: a bordered surface card with a 3-col grid — left 2 cols hold heading + sub, right col holds the primary CTA aligned to center. Clean, editorial.",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="grid gap-6 rounded-3xl border p-8 sm:grid-cols-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="sm:col-span-2">
          <h2 className="text-3xl font-bold">准备好让团队快起来了？</h2>
          <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>14 天全功能试用，无需信用卡。</p>
        </div>
        <div className="flex items-center justify-end">
          <a href="#signup" className="rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费开始</a>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "按钮 hover 上浮；卡片极淡高光",
          motionId: "fade-up",
        },
        {
          id: "cta_glow",
          name: "发光描边 CTA",
          description: "极淡主色光晕描边，克制发光，高级不刺眼",
          tags: ["发光", "高级", "极简"],
          prompt:
            "Build a glow-border CTA: a surface card with a very subtle primary-color glow (soft outer shadow + faint inner ring), centered heading + sub + CTA. Restrained, premium.",
          code: `export function Cta() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border p-12 text-center" style={{ borderColor: "var(--border)", background: "var(--surface)", boxShadow: "0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent), 0 30px 80px -40px color-mix(in srgb, var(--primary) 45%, transparent)" }}>
        <h2 className="text-3xl font-bold">把下一个增长，交给数据</h2>
        <p className="mx-auto mt-3 max-w-md" style={{ color: "var(--muted-foreground)" }}>加入 5 万+ 团队，今天就开始。</p>
        <a href="#signup" className="mt-8 inline-block rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</a>
      </div>
    </section>
  );
}`,
          interaction: "光晕随 hover 轻微增强；整卡 reveal-on-scroll",
          motionId: "reveal-on-scroll",
        },
        {
          id: "cta_cursor",
          name: "鼠标光斑 CTA",
          description: "容器内光斑跟随指针，极简高级的交互质感",
          tags: ["光标", "光斑", "高级"],
          prompt:
            "Build a cursor-follow CTA: a surface card where a soft radial spotlight follows the pointer (track mouse, radial-gradient at cursor %), heading + sub + CTA on top. Premium interactive feel.",
          code: `export function Cta() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ x: 50, y: 50 });
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <div
        ref={ref}
        onMouseMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          setPos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        className="relative overflow-hidden rounded-3xl border p-12 text-center"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: \`radial-gradient(400px circle at \${pos.x}% \${pos.y}%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 60%)\` }} />
        <div className="relative">
          <h2 className="text-3xl font-bold">让每一次点击，都有回应</h2>
          <p className="mx-auto mt-3 max-w-md" style={{ color: "var(--muted-foreground)" }}>把想法变成产品，几分钟的事。</p>
          <a href="#signup" className="mt-8 inline-block rounded-md px-6 py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费开始</a>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "光斑跟随鼠标（GSAP quickTo 可平滑）；整体 reveal-on-scroll",
          motionId: "reveal-on-scroll",
        },
      ],
    },
    {
      id: "footer",
      name: "页脚",
      icon: "PanelBottom",
      description: "品牌收尾 + 全站导航 + 社交入口",
      variants: [
        {
          id: "footer_multi",
          name: "多列页脚",
          description: "4 列链接组 + 品牌 + 版权行",
          tags: ["多列", "标准"],
          prompt:
            "Build a standard multi-column footer: brand column (logo, tagline, socials) + 3 link columns (产品/资源/公司), bottom bar with copyright.",
          code: `export function Footer() {
  const cols = [
    { title: "产品", links: ["功能", "{{nav.pricing}}", "更新日志"] },
    { title: "资源", links: ["{{nav.docs}}", "教程", "社区"] },
    { title: "公司", links: ["关于", "{{nav.blog}}", "联系"] },
  ];
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <p className="text-lg font-bold">{{brand}}</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
              让每个人都高效工作。
            </p>
            <div className="mt-4 flex gap-3 text-sm" style={{ color: "var(--muted-foreground)" }}>
              <a href="#tw">𝕏</a><a href="#gh">GitHub</a><a href="#li">LinkedIn</a>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="mt-3 space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
                {c.links.map((l) => (
                  <li key={l}><a href={"#" + l} className="hover:text-[var(--foreground)]">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs sm:flex-row" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          <span>© 2025 {{brand}} Inc. 保留所有权利。</span>
          <div className="flex gap-4">
            <a href="#privacy">隐私政策</a>
            <a href="#terms">服务条款</a>
          </div>
        </div>
      </div>
    </footer>
  );
}`,
          interaction: "标准站底，链接多时最佳",
        },
        {
          id: "footer_dark",
          name: "深色页脚",
          description: "深底浅字，与深色主题呼应",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark footer: slate-900 background, light text, link columns, copyright bar with borders white/10.",
          code: `export function Footer() {
  const cols = [
    { title: "产品", links: ["功能", "{{nav.pricing}}", "更新"] },
    { title: "公司", links: ["关于", "{{nav.blog}}", "招聘"] },
  ];
  return (
    <footer className="bg-slate-900 text-slate-50">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <p className="text-lg font-bold">{{brand}}</p>
            <p className="mt-2 text-sm text-slate-400">让每个人都高效工作。</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                {c.links.map((l) => (
                  <li key={l}><a href={"#" + l} className="hover:text-white">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col justify-between gap-2 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row">
          <span>© 2025 {{brand}} Inc.</span>
          <div className="flex gap-4"><a href="#privacy">隐私政策</a><a href="#terms">条款</a></div>
        </div>
      </div>
    </footer>
  );
}`,
          interaction: "与深色 Navbar/{{nav.faq}} 形成完整暗色系",
        },
        {
          id: "footer_simple",
          name: "简洁单行",
          description: "品牌 + 版权一行搞定",
          tags: ["简洁", "极简"],
          prompt:
            "Build a minimal single-row footer: logo left, copyright right, one-line. For minimal/editorial sites.",
          code: `export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-6 text-sm sm:flex-row">
        <span className="font-semibold">{{brand}}</span>
        <span style={{ color: "var(--muted-foreground)" }}>
          © 2025 {{brand}} Inc. All rights reserved.
        </span>
      </div>
    </footer>
  );
}`,
          interaction: "极简风/编辑风的收尾选择",
        },
        {
          id: "footer_cta",
          name: "页脚 + CTA",
          description: "页脚顶部内嵌订阅/行动区",
          tags: ["转化", "组合"],
          prompt:
            "Build a footer with embedded CTA: top area with newsletter input or CTA button, below link columns + copyright.",
          code: `export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col items-center justify-between gap-6 rounded-2xl border p-8 md:flex-row" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-xl font-bold">订阅最新动态</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>产品更新与增长技巧，每周一封。</p>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="flex w-full max-w-sm gap-2">
            <input placeholder="you@example.com" className="flex-1 rounded-lg border px-4 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
            <button type="submit" className="rounded-lg px-5 py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>订阅</button>
          </form>
        </div>
        <div className="mt-10 flex flex-col justify-between gap-2 text-xs sm:flex-row" style={{ color: "var(--muted-foreground)" }}>
          <span>© 2025 {{brand}} Inc.</span>
          <div className="flex gap-4"><a href="#privacy">隐私</a><a href="#terms">条款</a></div>
        </div>
      </div>
    </footer>
  );
}`,
          interaction: "把 CTA 与页脚合一，页面收尾即转化",
        },
        {
          id: "footer_bento",
          name: "分格 Bento",
          description: "品牌块 + 链接列 + 订阅块拼成分格卡，高级且紧凑",
          tags: ["Bento", "组合"],
          prompt:
            "Build a bento footer: a single rounded card split into a brand block (logo + tagline + socials), link columns, and a newsletter block. Surface background, hairline borders, generous padding.",
          code: `export function Footer() {
  const cols = [
    { title: "产品", links: ["功能", "{{nav.pricing}}", "更新日志"] },
    { title: "资源", links: ["{{nav.docs}}", "教程", "社区"] },
  ];
  return (
    <footer className="px-6 py-14">
      <div className="mx-auto max-w-6xl rounded-3xl border p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="grid gap-8 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div>
            <p className="text-lg font-bold">{{brand}}</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>让每个人都高效工作。</p>
            <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>𝕏 · GitHub · LinkedIn</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-sm font-semibold">{c.title}</p>
              <ul className="mt-2 space-y-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
                {c.links.map((l) => <li key={l}><a href={"#"+l} className="hover:text-[var(--foreground)]">{l}</a></li>)}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold">订阅</p>
            <div className="mt-2 flex gap-1.5">
              <input placeholder="you@example.com" className="flex-1 rounded-md border px-3 py-1.5 text-xs outline-none" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
              <button className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>→</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}`,
          interaction: "分格卡拼合，Bento 高级感",
        },
        {
          id: "footer_editorial",
          name: "编辑式巨标",
          description: "巨号品牌字 + 单行链接 + 细线，杂志收尾",
          tags: ["编辑", "巨标"],
          prompt:
            "Build an editorial footer: an oversized brand wordmark, a single row of links, a hairline divider, and small copyright. Lots of whitespace, magazine feel.",
          code: `export function Footer() {
  return (
    <footer className="px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <p className="text-5xl font-bold tracking-tight">{{brand}}</p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <a href="#features" className="hover:text-[var(--foreground)]">功能</a>
          <a href="#pricing" className="hover:text-[var(--foreground)]">{{nav.pricing}}</a>
          <a href="#docs" className="hover:text-[var(--foreground)]">{{nav.docs}}</a>
          <a href="#blog" className="hover:text-[var(--foreground)]">{{nav.blog}}</a>
          <a href="#contact" className="hover:text-[var(--foreground)]">联系</a>
        </div>
        <div className="mt-8 border-t pt-6 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          © 2025 {{brand}} Inc. 保留所有权利。
        </div>
      </div>
    </footer>
  );
}`,
          interaction: "巨号品牌字，编辑式留白收尾",
        },
      ],
    },
    {
      id: "logos",
      name: "品牌徽标墙",
      icon: "Building",
      description: "信任背书：合作/客户 Logo 展示",
      variants: [
        {
          id: "logos_grayrow",
          name: "灰阶徽标行",
          description: "单行灰阶 Logo，克制不抢戏",
          tags: ["灰阶", "信任"],
          prompt:
            "Build a logo wall: small heading 'Trusted by teams at', one row of 5-6 grayscale logos (use text placeholders). Logos are grayscale with opacity, full color on hover.",
          code: `export function Logos() {
  const brands = ["Vercel", "Linear", "Notion", "Figma", "Raycast"];
  return (
    <section className="border-y py-10" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
          Trusted by teams at
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {brands.map((b) => (
            <span key={b} className="text-lg font-bold opacity-40 grayscale transition hover:opacity-100">
              {b}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "hover 时 Logo 恢复彩色并提亮",
        },
        {
          id: "logos_grid",
          name: "彩色徽标网格",
          description: "2 行网格，适合合作方较多的站",
          tags: ["网格", "品牌"],
          prompt:
            "Build a logo grid: heading left + 2-row grid of 6 brand logos with light gray cards. Logos in brand color at 60% opacity.",
          code: `export function Logos() {
  const brands = [
    { name: "{{brand}}", color: "var(--accent-1)" },
    { name: "Nova", color: "var(--accent-2)" },
    { name: "Pulse", color: "var(--accent-3)" },
    { name: "Orbit", color: "var(--accent-4)" },
    { name: "Halo", color: "var(--accent-5)" },
    { name: "Zen", color: "var(--accent-6)" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-bold">值得信赖的合作伙伴</h2>
        <a href="#all" className="text-sm font-medium" style={{ color: "var(--primary)" }}>查看全部 →</a>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
        {brands.map((b) => (
          <div key={b.name} className="flex h-20 items-center justify-center rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-lg font-bold" style={{ color: b.color, opacity: 0.75 }}>{b.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "网格卡片 hover 轻微上浮",
        },
        {
          id: "logos_marquee",
          name: "滚动跑马灯",
          description: "无限滚动徽标带，页面更有动感",
          tags: ["跑马灯", "动感"],
          prompt:
            "Build a marquee logo wall: infinite horizontal scroll of brand logos, duplicated list with CSS animation, masked edges with gradient.",
          code: `export function Logos() {
  const brands = ["Vercel", "Linear", "Notion", "Figma", "Raycast", "Stripe"];
  const doubled = [...brands, ...brands];
  return (
    <section className="overflow-hidden border-y py-8" style={{ borderColor: "var(--border)" }}>
      <div className="flex w-max animate-[marquee_24s_linear_infinite] gap-14 px-6">
        {doubled.map((b, i) => (
          <span key={i} className="text-xl font-bold opacity-50">{b}</span>
        ))}
      </div>
      <style>{'@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }'}</style>
    </section>
  );
}`,
          interaction: "CSS keyframes 无限滚动，两端淡出遮罩",
          motionId: "marquee",
        },
        {
          id: "logos_marquee_double",
          name: "双列垂直跑马灯",
          description: "两列反向无限滚动的彩色品牌块，Awwwards 风",
          tags: ["跑马灯", "双列", "Awwwards"],
          prompt:
            "Build a double-column vertical marquee: two columns of colored brand tiles scrolling in opposite directions, masked top/bottom edges.",
          code: `export function Logos() {
  const tiles = [
    { name: "Vercel", color: "var(--accent-1)" },
    { name: "Linear", color: "var(--accent-2)" },
    { name: "Notion", color: "var(--accent-3)" },
    { name: "Figma", color: "var(--accent-4)" },
    { name: "Raycast", color: "var(--accent-5)" },
    { name: "Stripe", color: "var(--accent-6)" },
  ];
  const col = (dir) => (
    <div className="marquee-col">
      {[...tiles, ...tiles].map((t, i) => (
        <div key={i} className="tile" style={{ background: t.color }}>{t.name}</div>
      ))}
    </div>
  );
  return (
    <section className="overflow-hidden">
      <div className="flex gap-3">{col("up")}{col("down")}</div>
    </section>
  );
}`,
          interaction: "双列反向无限滚动，彩色品牌块",
          motionId: "marquee",
        },
        {
          id: "logos_compact",
          name: "紧凑徽标带",
          description: "夹在 Hero 与 Features 之间的小带",
          tags: ["紧凑", "点缀"],
          prompt:
            "Build a compact logo strip between hero and features: one line, small logos, minimal spacing, no heading.",
          code: `export function Logos() {
  const brands = ["{{brand}}", "Nova", "Pulse", "Orbit", "Halo"];
  return (
    <section className="mx-auto max-w-5xl px-6 pb-4">
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
        {brands.map((b) => (
          <span key={b} className="text-sm font-bold opacity-40">{b}</span>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "零视觉负担的信任点缀",
        },
        {
          id: "logos_bento",
          name: "品牌卡 Bento",
          description: "品牌以细线卡片呈网格，Bento 错落，编辑式高级",
          tags: ["Bento", "卡片"],
          prompt:
            "Build a logo bento: brand names in thin-bordered cards arranged in a bento grid (one larger cell), surface background, hover lifts subtly. Editorial-premium feel.",
          code: `export function Logos() {
  const brands = ["Vercel", "Linear", "Notion", "Figma", "Raycast", "Stripe"];
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h2 className="text-2xl font-bold">信任我们的团队</h2>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {brands.map((b, i) => (
          <div
            key={b}
            className={"flex h-24 items-center justify-center rounded-2xl border text-lg font-bold transition-transform hover:-translate-y-1 " + (i === 0 ? "col-span-2" : "")}
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--foreground)" }}
          >
            {b}
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "Bento 错落网格，hover 轻微上浮",
        },
        {
          id: "logos_editorial",
          name: "编辑式横排",
          description: "小标题 + 品牌名细排一行，留白克制，杂志风",
          tags: ["编辑", "留白"],
          prompt:
            "Build an editorial logo row: small uppercase heading left, brand names in a thin, widely-spaced row. Generous whitespace, magazine style.",
          code: `export function Logos() {
  const brands = ["Vercel", "Linear", "Notion", "Figma", "Raycast"];
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>Trusted by</p>
        <div className="flex flex-1 flex-wrap items-center gap-x-12 gap-y-3">
          {brands.map((b) => (
            <span key={b} className="text-lg font-semibold tracking-tight" style={{ color: "var(--foreground)" }}>{b}</span>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "极简横排，编辑式留白",
        },
        {
          id: "logos_neon",
          name: "霓虹品牌墙",
          description: "深底霓虹色块品牌名",
          tags: ["霓虹", "暗黑", "logo墙"],
          prompt:
            "Build a neon logo wall: on a dark canvas, brand marks rendered as vivid neon-colored word tiles, every mark in a different accent (#22D3EE, #F472B6, #F59E0B, #34D399). Playful agency energy.",
          code: `export function NeonLogos() {
  const brands = [
    { n: "Acme", c: "var(--accent-1)" },
    { n: "Nova", c: "var(--accent-2)" },
    { n: "Pulse", c: "var(--accent-3)" },
    { n: "Halo", c: "var(--accent-4)" },
    { n: "Stellar", c: "var(--accent-5)" },
    { n: "Aurora", c: "var(--accent-6)" },
  ];
  return (
    <section className="py-16" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-4xl px-6">
        <p className="text-center text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>信任我们</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {brands.map((b) => (
            <span key={b.n} className="rounded-xl px-5 py-2.5 text-lg font-bold tracking-tight" style={{ border: "1px solid color-mix(in srgb, " + b.c + " 40%, transparent)", background: "color-mix(in srgb, " + b.c + " 10%, var(--surface))", color: b.c }}>{b.n}</span>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "每品牌独立霓虹色块、hover 提亮",
        },
      ],
    },
    {
      id: "stats",
      name: "统计数字",
      icon: "TrendingUp",
      description: "数据证明：用户/增长/指标",
      variants: [
        {
          id: "stats_grid",
          name: "大数字网格",
          description: "3-4 个大数字 + 标签，简单有力",
          tags: ["网格", "数据"],
          prompt:
            "Build a stats grid: section with 3-4 large numbers with labels, centered or left-aligned. Numbers use bold display style, labels muted.",
          code: `export function Stats() {
  const stats = [
    { n: "50k+", l: "活跃用户" },
    { n: "120+", l: "国家覆盖" },
    { n: "99.9%", l: "可用性" },
    { n: "4.9/5", l: "用户评分" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid grid-cols-2 gap-8 text-center md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l}>
            <p className="text-4xl font-black" style={{ color: "var(--primary)" }}>{s.n}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "数字可做滚动计数（CountUp）",
          motionId: "count-up",
        },
        {
          id: "stats_withdesc",
          name: "数字 + 描述",
          description: "每项带一句说明，更有说服力",
          tags: ["说明", "转化"],
          prompt:
            "Build stats with descriptions: each stat has number, title, one-line description. Card layout or simple list.",
          code: `export function Stats() {
  const stats = [
    { n: "2,000+", t: "企业客户", d: "覆盖 40+ 行业的头部公司" },
    { n: "180M", t: "请求 / 月", d: "为关键业务提供稳定支撑" },
    { n: "98%", t: "客户留存", d: "用口碑驱动持续增长" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.t} className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-3xl font-black" style={{ color: "var(--primary)" }}>{s.n}</p>
            <p className="mt-1 font-semibold">{s.t}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "卡片化呈现，信息更完整",
        },
        {
          id: "stats_dark",
          name: "深色统计条",
          description: "深色横幅 + 白字数字，冲击力强",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark stats band: slate-900 background, white large numbers, muted labels, centered. Great contrast section divider.",
          code: `export function Stats() {
  const stats = [
    { n: "120+", l: "员工" },
    { n: "30+", l: "国家" },
    { n: "10M+", l: "服务用户" },
  ];
  return (
    <section className="bg-slate-900 py-16 text-white">
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 text-center sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.l}>
            <p className="text-4xl font-black">{s.n}</p>
            <p className="mt-1 text-sm text-slate-400">{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "适合作为页面中部的视觉分隔",
        },
        {
          id: "stats_inline",
          name: "内联数字",
          description: "跟在文案后的小型数字行",
          tags: ["内联", "克制"],
          prompt:
            "Build an inline stats row: small numbers inline with text or separated by dividers, minimal styling.",
          code: `export function Stats() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-center divide-x" style={{ borderColor: "var(--border)" }}>
        <div className="px-8 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>50k+</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>用户</p>
        </div>
        <div className="px-8 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>4.9</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>评分</p>
        </div>
        <div className="px-8 text-center">
          <p className="text-2xl font-bold" style={{ color: "var(--primary)" }}>99.9%</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>可用性</p>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "分隔线布局，极简风首选",
        },
        {
          id: "stats_editorial",
          name: "编辑式巨数字",
          description: "巨号展示数字 + 细线分隔 + 标签，杂志级排版",
          tags: ["编辑", "巨数字"],
          prompt:
            "Build an editorial stats row: oversized display numbers, a thin rule between each, muted labels below. Minimal, magazine-grade typography.",
          code: `export function Stats() {
  const stats = [
    { n: "50k+", l: "活跃用户" },
    { n: "120+", l: "国家覆盖" },
    { n: "99.9%", l: "可用性" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0" style={{ borderColor: "var(--border)" }}>
        {stats.map((s) => (
          <div key={s.l} className="px-8 py-6 text-center md:text-left">
            <p className="text-5xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>{s.n}</p>
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "巨号数字，编辑式高级排版",
        },
        {
          id: "stats_countup",
          name: "滚动计数",
          description: "大数字滚动累加 + 下划线装饰，临门一脚更有说服力",
          tags: ["计数", "动效"],
          prompt:
            "Build a count-up stats band: 3 large numbers that animate from 0 to target on view, each underlined with a short accent rule, centered. Use intersection observer or scroll trigger to start.",
          code: `export function Stats() {
  const stats = [
    { n: 50000, suffix: "+", l: "活跃用户" },
    { n: 120, suffix: "+", l: "国家覆盖" },
    { n: 99.9, suffix: "%", l: "可用性" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-16 text-center">
      <div className="grid grid-cols-3 gap-6">
        {stats.map((s) => (
          <div key={s.l}>
            <p className="text-4xl font-black" style={{ color: "var(--primary)" }}>
              <CountUp end={s.n} suffix={s.suffix} />
            </p>
            <div className="mx-auto mt-2 h-px w-10" style={{ background: "var(--primary)" }} />
            <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "数字滚动累加（CountUp），下划线强调",
          motionId: "data-count",
        },
        {
          id: "stats_neon",
          name: "霓虹统计",
          description: "深底霓虹数字 + 发光",
          tags: ["霓虹", "暗黑", "数据"],
          prompt:
            "Build neon stats: on a dark canvas, oversized numbers each tinted with a vivid accent and a soft glow, tiny uppercase labels. Bold agency energy.",
          code: `export function NeonStats() {
  const stats = [
    { n: "50K+", l: "活跃用户", c: "var(--accent-1)" },
    { n: "120+", l: "国家覆盖", c: "var(--accent-2)" },
    { n: "99.9%", l: "可用性", c: "var(--accent-4)" },
    { n: "4.9/5", l: "客户评分", c: "var(--accent-3)" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--background)" }}>
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 text-center sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.l}>
            <p className="text-5xl font-black tracking-tight" style={{ color: s.c, textShadow: "0 0 30px " + s.c }}>{s.n}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "霓虹数字发光、深底 vivid",
        },
      ],
    },
    {
      id: "testimonials",
      name: "客户评价",
      icon: "Quote",
      description: "社会证明：真实用户声音",
      variants: [
        {
          id: "testi_grid",
          name: "三列评价卡",
          description: "3 列引用卡片 + 头像，最常用",
          tags: ["网格", "引用"],
          prompt:
            "Build a testimonial grid: 3-column cards each with quote text, avatar circle (initials), name, role. Cards with surface background, quote icon accent.",
          code: `export function Testimonials() {
  const items = [
    { q: "上手极快，第一周就替换掉了我们三套工具。", n: "张伟", r: "增长负责人 @ {{brand}}" },
    { q: "客户支持是我用过所有产品里最好的。", n: "李娜", r: "CTO @ Nova" },
    { q: "数据看板让我们决策快了不止一倍。", n: "王强", r: "产品总监 @ Pulse" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <h2 className="text-center text-3xl font-bold">他们怎么说</h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((t) => (
          <div key={t.n} className="flex flex-col rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-3xl" style={{ color: "var(--primary)" }}>"</span>
            <p className="mt-2 flex-1 text-sm leading-relaxed">{t.q}</p>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
                {t.n.slice(0, 1)}
              </span>
              <div>
                <p className="text-sm font-semibold">{t.n}</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{t.r}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "卡片 hover 上浮 + 阴影",
          motionId: "fade-up",
        },
        {
          id: "testi_featured",
          name: "重点引用",
          description: "一条大引用 + 多小引用，焦点明确",
          tags: ["焦点", "编辑"],
          prompt:
            "Build a featured testimonial: one large quote centered with avatar, surrounded by smaller quotes below. Editorial feel.",
          code: `export function Testimonials() {
  const featured = { q: "这是我们用过的第一款真正改变工作方式的工具。", n: "陈晨", r: "CEO @ Orbit" };
  const small = [
    { q: "推荐给所有团队。", n: "Mia" },
    { q: "省了我每周 10 小时。", n: "Lucas" },
    { q: "价格良心，功能扎实。", n: "Sofia" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20 text-center">
      <span className="text-4xl" style={{ color: "var(--primary)" }}>"</span>
      <blockquote className="mx-auto mt-2 max-w-2xl text-2xl font-semibold leading-snug">
        {featured.q}
      </blockquote>
      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>陈</span>
        <div className="text-left">
          <p className="text-sm font-semibold">{featured.n}</p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{featured.r}</p>
        </div>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {small.map((t) => (
          <p key={t.n} className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            "{t.q}" <span className="mt-2 block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>— {t.n}</span>
          </p>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "大引用可做滚动淡入",
        },
        {
          id: "testi_dark",
          name: "深色评价区",
          description: "深底浅字，与暗色主题搭配",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark testimonial section: slate-900 background, light quote text, cards with white/10 border.",
          code: `export function Testimonials() {
  const items = [
    { q: "体验丝滑，团队很喜欢。", n: "Alice" },
    { q: "数据洞察非常准确。", n: "Bob" },
  ];
  return (
    <section className="bg-slate-900 px-6 py-20 text-slate-50">
      <h2 className="text-center text-3xl font-bold">用户声音</h2>
      <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
        {items.map((t) => (
          <div key={t.n} className="rounded-xl border border-white/10 p-6">
            <p className="text-sm leading-relaxed text-slate-200">"{t.q}"</p>
            <p className="mt-4 text-sm font-semibold">— {t.n}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "与深色 Hero/Footer 视觉闭环",
        },
        {
          id: "testi_carousel",
          name: "轮播评价",
          description: "单条轮播切换，聚焦一条声音",
          tags: ["轮播", "交互"],
          prompt:
            "Build a testimonial carousel: one quote at a time with prev/next buttons and dot indicators, auto-advance optional.",
          code: `export function Testimonials() {
  const items = [
    { q: "最直观的分析工具。", n: "Emma" },
    { q: "支持响应快得惊人。", n: "James" },
    { q: "值得每一分钱。", n: "Olivia" },
  ];
  const [i, setI] = useState(0);
  return (
    <section className="mx-auto max-w-2xl px-6 py-20 text-center">
      <h2 className="text-3xl font-bold">用户评价</h2>
      <div className="mt-8 rounded-2xl border p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-lg leading-relaxed">"{items[i].q}"</p>
        <p className="mt-4 text-sm font-semibold">— {items[i].n}</p>
      </div>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button onClick={() => setI((i - 1 + items.length) % items.length)} className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: "var(--border)" }}>←</button>
        <div className="flex gap-1.5">
          {items.map((_, idx) => (
            <span key={idx} className={"size-2 rounded-full " + (idx === i ? "" : "opacity-30")} style={{ background: "var(--primary)" }} />
          ))}
        </div>
        <button onClick={() => setI((i + 1) % items.length)} className="rounded-full border px-3 py-1 text-sm" style={{ borderColor: "var(--border)" }}>→</button>
      </div>
    </section>
  );
}`,
          interaction: "支持自动轮播（setInterval + 清除）",
        },
        {
          id: "testi_logo",
          name: "品牌 + 评价",
          description: "评价与客户品牌并排，背书更强",
          tags: ["品牌", "背书"],
          prompt:
            "Build testimonials with brand logos: each quote card shows company logo text on top, quote, name. Stronger social proof.",
          code: `export function Testimonials() {
  const items = [
    { brand: "NOVA", q: "分析能力一流水准。", n: "张敏" },
    { brand: "PULSE", q: "团队协作效率翻倍。", n: "刘洋" },
    { brand: "ORBIT", q: "稳定、快速、省心。", n: "赵磊" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="grid gap-6 md:grid-cols-3">
        {items.map((t) => (
          <div key={t.brand} className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-xs font-black tracking-widest" style={{ color: "var(--muted-foreground)" }}>{t.brand}</p>
            <p className="mt-4 text-sm leading-relaxed">"{t.q}"</p>
            <p className="mt-4 text-sm font-semibold">— {t.n}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "品牌名替代头像，B2B 场景更可信",
        },
        {
          id: "testi_marquee",
          name: "滚动口碑墙",
          description: "横向无缝滚动的评价条，社会证明密度高、不占纵向空间",
          tags: ["marquee", "口碑", "极简"],
          prompt:
            "Build a marquee testimonials row: a horizontally scrolling strip of quote cards (duplicated for seamless loop). Minimal cards, thin borders, no heavy chrome.",
          code: `export function Testimonials() {
  const items = [
    "上手极快，第一周就替换掉了三套工具。",
    "客户支持是最好的，响应快又专业。",
    "数据看板让决策快了一倍。",
    "价格良心，功能却很扎实。",
    "团队协作效率肉眼可见地提升。",
  ];
  return (
    <section className="overflow-hidden py-20">
      <h2 className="mb-10 text-center text-3xl font-bold">他们都在用，且都说好</h2>
      <div className="flex gap-6 overflow-x-auto px-6 [scrollbar-width:none]">
        {items.concat(items).map((q, i) => (
          <figure key={i} className="w-80 shrink-0 rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-base leading-relaxed">"{q}"</p>
            <figcaption className="mt-4 text-sm font-semibold">— 真实用户</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "评价条横向无缝滚动（marquee 动画）",
          motionId: "fade-up",
        },
        {
          id: "testi_3dstack",
          name: "3D 堆叠卡",
          description: "主卡 + 后叠卡景深，杂志式聚焦，克制高级",
          tags: ["3D", "堆叠", "高级"],
          prompt:
            "Build a 3D stacked testimonial: a prominent front card with one or two smaller cards behind it (offset + scaled + lowered opacity) for depth. Clean, editorial focus.",
          code: `export function Testimonials() {
  const cards = [
    { q: "这是我们用过的第一款真正改变工作方式的工具。", n: "陈晨", r: "CEO @ Orbit" },
    { q: "上手极快，第一周就替换掉了三套工具。", n: "张伟", r: "增长负责人" },
    { q: "客户支持是最好的。", n: "李娜", r: "CTO" },
  ];
  return (
    <section className="flex min-h-[60vh] items-center justify-center px-6 py-20 [perspective:1200px]">
      <div className="relative w-full max-w-md">
        {cards.slice(1).reverse().map((c, i) => (
          <div key={c.n} aria-hidden className="absolute inset-x-4 top-4 rounded-3xl border" style={{ borderColor: "var(--border)", background: "var(--surface)", transform: \`translateY(\${(i + 1) * 16}px) scale(\${1 - (i + 1) * 0.04})\`, opacity: 0.5, zIndex: -i }} />
        ))}
        <figure className="relative rounded-3xl border p-8 shadow-[var(--shadow)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-lg font-semibold leading-snug">"{cards[0].q}"</p>
          <figcaption className="mt-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{cards[0].n.slice(0, 1)}</span>
            <span className="text-sm"><span className="font-semibold">{cards[0].n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{cards[0].r}</span></span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}`,
          interaction: "主卡轻微浮动；堆叠卡随滚动视差位移",
          motionId: "reveal-on-scroll",
        },
        {
          id: "testi_split",
          name: "图文交错",
          description: "左侧巨引言 + 右侧竖排小卡，编辑式对比，阅读节奏好",
          tags: ["编辑", "分栏", "高级"],
          prompt:
            "Build a split testimonial: left a large featured quote card, right a column of two smaller quote cards. Editorial contrast, strong reading rhythm.",
          code: `export function Testimonials() {
  const main = { q: "这是我们用过的第一款真正改变工作方式的工具。", n: "陈晨", r: "CEO @ Orbit" };
  const side = [
    { q: "上手极快，第一周就替换掉了三套工具。", n: "张伟" },
    { q: "客户支持是最好的。", n: "李娜" },
  ];
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-20 md:grid-cols-2">
      <figure className="flex flex-col justify-center rounded-3xl border p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-2xl font-semibold leading-snug">"{main.q}"</p>
        <figcaption className="mt-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{main.n.slice(0, 1)}</span>
          <span className="text-sm"><span className="font-semibold">{main.n}</span> · <span style={{ color: "var(--muted-foreground)" }}>{main.r}</span></span>
        </figcaption>
      </figure>
      <div className="grid grid-rows-2 gap-4">
        {side.map((s) => (
          <figure key={s.n} className="flex flex-col justify-center rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="text-sm leading-relaxed">"{s.q}"</p>
            <figcaption className="mt-3 text-xs font-semibold">— {s.n}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "大引言强调；小卡滚动交错淡入",
          motionId: "scroll-fade-up",
        },
      ],
    },
    {
      id: "home-process",
      name: "工作流程",
      icon: "Workflow",
      description: "「如何工作」三步带，解释型转化区块",
      variants: [
        {
          id: "home_process_editorial",
          name: "编辑式流程",
          description: "衬线编号 + 细线三步",
          tags: ["流程", "编辑", "步骤"],
          prompt:
            "Build an editorial how-it-works: three serif-numbered steps in a hairline-separated grid, big step number, title, a short line. Quiet magazine tone.",
          code: `export function EditorialProcess() {
  const steps = [
    { n: "01", t: "描述需求", d: "告诉 AI 你要的页面与风格" },
    { n: "02", t: "选择区块", d: "从组件库挑出想要的骨架" },
    { n: "03", t: "生成代码", d: "一键产出可运行的落地页" },
  ];
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>如何工作</h2>
      <div className="mt-8 divide-y" style={{ borderColor: "var(--border)" }}>
        {steps.map((s) => (
          <div key={s.n} className="grid items-baseline gap-4 py-6 sm:grid-cols-[auto_1fr_1fr]">
            <span className="text-3xl font-black italic" style={{ color: "var(--primary)", fontFamily: "var(--font-heading)" }}>{s.n}</span>
            <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{s.t}</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "衬线大编号、细线分隔三步",
        },
        {
          id: "home_process_neon",
          name: "霓虹流程带",
          description: "深底霓虹步骤 + 发光箭头",
          tags: ["流程", "霓虹", "暗黑"],
          prompt:
            "Build a neon how-it-works: on a dark canvas, three glowing steps tiled, each with a vivid accent and a soft glow. Bold agency energy.",
          code: `export function NeonProcess() {
  const steps = [
    { n: "1", t: "描述", c: "var(--accent-1)" },
    { n: "2", t: "选择", c: "var(--accent-2)" },
    { n: "3", t: "生成", c: "var(--accent-4)" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--background)" }}>
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="flex flex-col items-start rounded-xl p-5" style={{ border: "1px solid color-mix(in srgb, " + s.c + " 45%, transparent)", background: "color-mix(in srgb, " + s.c + " 8%, var(--surface))" }}>
            <span className="text-3xl font-black" style={{ color: s.c, textShadow: "0 0 18px " + s.c }}>{s.n}</span>
            <p className="mt-3 text-lg font-bold text-[var(--foreground)]">{s.t}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>某一步的简短说明</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "霓虹编号发光、深底步骤砖",
        },
      ],
    },
    {
      id: "home-integrations",
      name: "集成生态",
      icon: "Blocks",
      description: "联动工具的品牌墙/清单，增强信任",
      variants: [
        {
          id: "home_int_editorial",
          name: "编辑式集成",
          description: "衬线标题 + 细线集成清单",
          tags: ["集成", "编辑", "生态"],
          prompt:
            "Build an editorial integrations grid: a magazine-like list of integrated tools with serif names and hairline separators, each row a distinct tool. Quiet and trustworthy.",
          code: `export function EditorialIntegrations() {
  const tools = ["Slack", "Figma", "Notion", "GitHub", "Linear", "Vercel"];
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>集成生态</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>与我们已有的工具协同</p>
      <div className="mt-8 border-y" style={{ borderColor: "var(--border)" }}>
        {tools.map((t) => (
          <div key={t} className="flex items-center justify-between border-b py-4 last:border-0" style={{ borderColor: "var(--border)" }}>
            <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{t}</span>
            <span style={{ color: "var(--muted-foreground)" }}>→</span>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "衬线工具名、细线生态清单",
        },
        {
          id: "home_int_neon",
          name: "霓虹集成",
          description: "深底霓虹生态 logo 砖",
          tags: ["集成", "霓虹", "暗黑"],
          prompt:
            "Build a neon integrations grid: on a dark canvas, tool tiles each tinted with a different vivid accent, arranged in a tight grid. Playful agency energy.",
          code: `export function NeonIntegrations() {
  const tools = [
    { n: "Slack", c: "var(--accent-1)" },
    { n: "Figma", c: "var(--accent-2)" },
    { n: "Notion", c: "var(--accent-4)" },
    { n: "GitHub", c: "var(--accent-5)" },
    { n: "Linear", c: "var(--accent-3)" },
    { n: "Vercel", c: "var(--accent-6)" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-xl font-bold text-[var(--foreground)]">集成生态</h2>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tools.map((t) => (
            <div key={t.n} className="rounded-xl px-5 py-4 text-center font-semibold" style={{ border: "1px solid color-mix(in srgb, " + t.c + " 40%, transparent)", background: "color-mix(in srgb, " + t.c + " 8%, var(--surface))", color: t.c }}>{t.n}</div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "每工具独立霓虹砖、紧致网格",
        },
      ],
    },
    {
      id: "home-contact",
      name: "联系表单",
      icon: "Mail",
      description: "线索收集转化组件，编辑式 / 霓虹两种",
      variants: [
        {
          id: "home_ct_editorial",
          name: "编辑式联系",
          description: "衬线标题 + 下划线表单",
          tags: ["联系", "编辑", "表单"],
          prompt:
            "Build an editorial contact: a serif heading, hairline underline inputs with uppercase labels, and a solid primary submit. Quiet, magazine-precise.",
          code: `export function EditorialContact() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>联系我们</p>
      <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>与我们聊聊</h2>
      <div className="mt-8 space-y-5 border-t pt-6" style={{ borderColor: "var(--border)" }}>
        <div>
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>姓名</label>
          <div className="mt-1.5 h-10 border-b" style={{ borderColor: "var(--border)" }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>邮箱</label>
          <div className="mt-1.5 h-10 border-b" style={{ borderColor: "var(--border)" }} />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>留言</label>
          <div className="mt-1.5 h-20 border-b" style={{ borderColor: "var(--border)" }} />
        </div>
        <button className="w-full rounded-md py-3 text-sm font-semibold text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>发送</button>
      </div>
    </section>
  );
}`,
          interaction: "衬线标题、下划线输入、实心提交",
        },
        {
          id: "home_ct_neon",
          name: "霓虹联系",
          description: "深底霓虹玻璃联系卡",
          tags: ["联系", "霓虹", "暗黑"],
          prompt:
            "Build a neon contact card: on a vivid dark gradient, a frosted card with a neon glowing submit. High-end, premium finish.",
          code: `export function NeonContact() {
  const c = "var(--accent-1)";
  return (
    <section className="px-6 py-20" style={{ background: "linear-gradient(135deg,var(--background),var(--background))" }}>
      <div className="mx-auto max-w-md rounded-2xl p-6" style={{ border: "1px solid color-mix(in srgb, " + c + " 35%, transparent)", background: "color-mix(in srgb, var(--surface) 78%, transparent)", backdropFilter: "blur(14px)" }}>
        <h2 className="text-center text-xl font-bold text-[var(--foreground)]">与我们聊聊</h2>
        <div className="mt-5 space-y-3">
          <div className="rounded-lg px-3 py-2.5 text-sm text-slate-500" style={{ background: "var(--surface)" }}>姓名</div>
          <div className="rounded-lg px-3 py-2.5 text-sm text-slate-500" style={{ background: "var(--surface)" }}>you@example.com</div>
          <div className="rounded-lg px-3 py-2.5 text-sm text-slate-500" style={{ background: "var(--surface)" }}>留言…</div>
        </div>
        <button className="mt-4 w-full rounded-lg py-2.5 text-sm font-bold text-white" style={{ background: "linear-gradient(135deg," + c + ",var(--accent-2))", boxShadow: "0 10px 30px -10px " + c }}>发送</button>
      </div>
    </section>
  );
}`,
          interaction: "渐变深底 + 玻璃卡 + 霓虹发光 CTA",
        },
      ],
    },
  ],
};

