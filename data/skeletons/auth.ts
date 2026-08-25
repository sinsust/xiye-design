// 认证页（Auth）页面骨架数据。

import type { SkeletonPage } from "./types";

export const AUTH_PAGE: SkeletonPage = {
  id: "auth",
  name: "认证页",
  icon: "UserRound",
  description: "登录/注册：表单、社交登录、分屏布局，转化漏斗的关键页",
  components: [
    {
      id: "auth-login",
      name: "登录表单",
      icon: "LogIn",
      description: "{{auth.email}} + {{auth.password}}登录，行业标准模式",
      variants: [
        {
          id: "alogin_center",
          name: "居中登录卡",
          description: "居中卡片 + 品牌标识，最通用",
          tags: ["居中", "标准"],
          prompt:
            "Build a centered login card: brand logo top, 'Welcome back' heading, email + password inputs with labels, remember-me + forgot-password row, submit button, divider 'or', social buttons below, signup link at bottom. Card on background.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-2xl border p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl text-lg font-black text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>A</div>
          <h1 className="mt-4 text-xl font-bold">欢迎回来</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.password}}</label>
            <input type="password" placeholder="••••••••" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-1.5"><input type="checkbox" className="accent-[var(--primary)]" /> 记住我</label>
            <a href="#forgot" style={{ color: "var(--primary)" }}>忘记{{auth.password}}？</a>
          </div>
          <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="h-px flex-1" style={{ background: "var(--border)" }} />或<span className="h-px flex-1" style={{ background: "var(--border)" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button className="rounded-lg border py-2 text-sm font-medium" style={{ borderColor: "var(--border)" }}>Google</button>
          <button className="rounded-lg border py-2 text-sm font-medium" style={{ borderColor: "var(--border)" }}>GitHub</button>
        </div>
        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          还没有账号？<a href="#signup" style={{ color: "var(--primary)" }}>免费注册</a>
        </p>
      </div>
    </div>
  );
}`,
          interaction: "表单提交防抖 + 错误提示行；按钮 loading 态",
        },
        {
          id: "alogin_left",
          name: "左对齐紧凑",
          description: "左对齐 + 顶部品牌，应用内登录",
          tags: ["左对齐", "应用内"],
          prompt:
            "Build a compact left-aligned login: brand top-left, form left-aligned with full width inputs, no card (on surface background). For in-app login pages.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen px-6 py-12" style={{ background: "var(--surface)" }}>
      <div className="mx-auto w-full max-w-sm">
        <a href="/" className="text-lg font-bold">{{brand}}</a>
        <h1 className="mt-10 text-2xl font-bold">登录</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>访问你的工作空间</p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{{auth.password}}</label>
              <a href="#forgot" className="text-xs" style={{ color: "var(--primary)" }}>忘记{{auth.password}}？</a>
            </div>
            <input type="password" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
          </div>
          <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
        </form>
        <button className="mt-4 w-full rounded-lg border py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>使用 Google 登录</button>
        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          还没有账号？<a href="#signup" style={{ color: "var(--primary)" }}>注册</a>
        </p>
      </div>
    </div>
  );
}`,
          interaction: "应用内登录常用；回车提交",
        },
        {
          id: "alogin_dark",
          name: "深色登录",
          description: "深色主题登录页",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark login page: slate-900 background, dark card (white/10 border), light text, primary CTA.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-800/60 p-8">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">欢迎回来</h1>
          <p className="mt-1 text-sm text-slate-400">登录继续使用 {{brand}}</p>
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-200">{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--primary)]" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-200">{{auth.password}}</label>
            <input type="password" className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--primary)]" />
          </div>
          <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          还没有账号？<a href="#signup" style={{ color: "var(--primary)" }}>注册</a>
        </p>
      </div>
    </div>
  );
}`,
          interaction: "与暗色产品风格统一",
        },
        {
          id: "alogin_minimal",
          name: "极简线框",
          description: "无线框、纯分隔线表单",
          tags: ["极简", "编辑"],
          prompt:
            "Build a minimal login: no card, underline-only inputs, small centered heading. Editorial/minimal style.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-xs">
        <h1 className="text-center text-2xl font-bold tracking-tight">登录</h1>
        <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-6">
          <div className="border-b pb-1" style={{ borderColor: "var(--border)" }}>
            <input type="email" placeholder="{{auth.email}}" className="w-full bg-transparent py-1.5 text-sm outline-none" />
          </div>
          <div className="border-b pb-1" style={{ borderColor: "var(--border)" }}>
            <input type="password" placeholder="{{auth.password}}" className="w-full bg-transparent py-1.5 text-sm outline-none" />
          </div>
          <button type="submit" className="w-full rounded-full py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
        </form>
        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          <a href="#signup" style={{ color: "var(--primary)" }}>注册新账号</a>
        </p>
      </div>
    </div>
  );
}`,
          interaction: "极简风站点的登录选择",
        },
        {
          id: "alogin_glass",
          name: "毛玻璃登录卡",
          description: "半透磨砂卡 + 渐变底 + 柔光投影",
          tags: ["毛玻璃", "柔光", "高级"],
          prompt:
            "Build a frosted-glass login: gradient background with subtle primary/secondary tint, a translucent card with backdrop-blur and soft glow border, brand mark, email/password fields, primary CTA. Premium SaaS feel.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)), var(--background) 55%, color-mix(in srgb, var(--secondary) 10%, var(--background)))" }}>
      <div className="w-full max-w-sm rounded-3xl border p-8" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
        <div className="text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl text-lg font-black text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 10px 24px color-mix(in srgb, var(--primary) 35%, transparent)" }}>A</span>
          <h1 className="mt-4 text-xl font-bold">欢迎回来</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
        </div>
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 55%, transparent)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.password}}</label>
            <input type="password" placeholder="••••••••" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 55%, transparent)" }} />
          </div>
          <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent)" }}>登录</button>
        </form>
      </div>
    </div>
  );
}`,
          interaction: "毛玻璃卡浮于渐变底，柔光投影增强质感",
        },
        {
          id: "alogin_editorial",
          name: "编辑式登录",
          description: "衬线巨标 + 下划线输入框，杂志排版",
          tags: ["编辑式", "衬线", "极简高级"],
          prompt:
            "Build an editorial login: tiny letterspaced brand eyebrow, oversized serif heading, underline-only inputs, full-width pill CTA. Magazine-like luxury typography.",
          code: `export function LoginForm() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>{{brand}}</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>欢迎回来</h1>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>登录你的账号继续</p>
        <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-5">
          <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
            <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="w-full bg-transparent py-1 text-base outline-none" />
          </div>
          <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
            <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{{auth.password}}</label>
            <input type="password" className="w-full bg-transparent py-1 text-base outline-none" />
          </div>
          <button type="submit" className="w-full rounded-full py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
        </form>
        <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
          还没有账号？<a href="#signup" style={{ color: "var(--primary)" }}>注册</a>
        </p>
      </div>
    </div>
  );
}`,
          interaction: "下划线输入 + 衬线巨标，编辑感十足",
        },
        {
          id: "alogin_terminal",
          name: "暗黑终端登录",
          description: "深底等宽表单 + 命令式按钮",
          tags: ["终端", "暗黑", "开发者"],
          prompt:
            "Build a dark developer login: near-black canvas, monospace fields labeled like prompts (email:/password:), a $ command-style submit button, status text. Terminal-inspired.",
          code: `export function TerminalLogin() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-lg border p-6 font-mono" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-xs" style={{ color: "var(--accent-1)" }}>~/sign-in</p>
        <p className="mt-4 text-xs text-slate-400">email:</p>
        <span className="mt-1 block border px-2 py-1.5 text-xs text-slate-200" style={{ borderColor: "var(--border)" }}>you@example.com</span>
        <p className="mt-3 text-xs text-slate-400">password:</p>
        <span className="mt-1 block border px-2 py-1.5 text-xs text-slate-200" style={{ borderColor: "var(--border)" }}>••••••••</span>
        <span className="mt-4 block rounded border py-2 text-center text-xs font-semibold" style={{ borderColor: "var(--accent-1)", color: "var(--accent-1)" }}>$ ./sign-in --email you@example.com</span>
      </div>
    </div>
  );
}`,
          interaction: "终端提示符、命令式按钮、等宽字体",
        },
      ],
    },
    {
      id: "auth-social",
      name: "社交登录",
      icon: "Share2",
      description: "第三方登录入口的多种排布",
      variants: [
        {
          id: "asocial_divider",
          name: "分隔线 + 按钮",
          description: "表单与社交按钮用分隔线隔开",
          tags: ["分隔", "标准"],
          prompt:
            "Build social login buttons below a divider: 'or continue with' text, Google/GitHub/Apple buttons in a row (or column). Standard auth page pattern.",
          code: `export function SocialLogin() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span className="h-px flex-1" style={{ background: "var(--border)" }} />或继续使用<span className="h-px flex-1" style={{ background: "var(--border)" }} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <button className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden>G</span> Google
        </button>
        <button className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden>GH</span> GitHub
        </button>
        <button className="flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden></span> Apple
        </button>
      </div>
    </div>
  );
}`,
          interaction: "社交按钮可随 OAuth 配置动态增减",
        },
        {
          id: "asocial_iconrow",
          name: "图标按钮行",
          description: "纯图标按钮，节省空间",
          tags: ["图标", "紧凑"],
          prompt:
            "Build icon-only social login buttons: row of circular icon buttons (Google/GitHub/Apple), aria-labels for a11y.",
          code: `export function SocialLogin() {
  return (
    <div className="flex items-center justify-center gap-3">
      {["G", "GH", ""].map((s, i) => (
        <button
          key={i}
          aria-label={["Google", "GitHub", "Apple"][i]}
          className="flex size-11 items-center justify-center rounded-full border text-sm font-semibold transition hover:bg-muted"
          style={{ borderColor: "var(--border)" }}
        >
          {s === "" ? "" : s}
        </button>
      ))}
    </div>
  );
}`,
          interaction: "纯图标节省纵向空间；必须有 aria-label",
        },
        {
          id: "asocial_stacked",
          name: "纵排按钮",
          description: "整宽纵向排列，移动友好",
          tags: ["纵排", "移动"],
          prompt:
            "Build full-width stacked social buttons: each button full width with icon + text, vertical stack below the form.",
          code: `export function SocialLogin() {
  const items = [
    { icon: "G", label: "使用 Google 登录" },
    { icon: "GH", label: "使用 GitHub 登录" },
    { icon: "M", label: "使用 Microsoft 登录" },
  ];
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <button key={s.label} className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition hover:bg-muted" style={{ borderColor: "var(--border)" }}>
          <span aria-hidden>{s.icon}</span>{s.label}
        </button>
      ))}
    </div>
  );
}`,
          interaction: "整宽按钮对移动端友好；点击后 OAuth 重定向",
        },
        {
          id: "asocial_glass",
          name: "毛玻璃按钮组",
          description: "半透磨砂按钮 + 柔光描边",
          tags: ["毛玻璃", "高级"],
          prompt:
            "Build frosted-glass social buttons: row of translucent pill buttons with backdrop-blur and soft glow borders, brand glyph + label. Premium look.",
          code: `export function SocialLogin() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { g: "G", l: "Google" },
        { g: "GH", l: "GitHub" },
        { g: "", l: "Apple" },
      ].map((s) => (
        <button key={s.l} className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition hover:opacity-85" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 55%, transparent)", backdropFilter: "blur(12px)" }}>
          <span aria-hidden>{s.g}</span> {s.l}
        </button>
      ))}
    </div>
  );
}`,
          interaction: "毛玻璃按钮浮于渐变底，克制且高级",
        },
        {
          id: "asocial_pill",
          name: "胶囊渐变按钮",
          description: "整宽胶囊 + 渐变描边",
          tags: ["胶囊", "渐变", "转化"],
          prompt:
            "Build pill-shaped social buttons: full-width rounded-full buttons with a gradient border (primary→secondary) and subtle inner glow on hover. Conversion-focused.",
          code: `export function SocialLogin() {
  const items = [
    { g: "G", l: "使用 Google 登录" },
    { g: "GH", l: "使用 GitHub 登录" },
    { g: "M", l: "使用 Microsoft 登录" },
  ];
  return (
    <div className="space-y-3">
      {items.map((s) => (
        <button key={s.l} className="flex w-full items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-medium transition hover:shadow-md" style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))", background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--surface)), color-mix(in srgb, var(--secondary) 6%, var(--surface)))" }}>
          <span aria-hidden>{s.g}</span>{s.l}
        </button>
      ))}
    </div>
  );
}`,
          interaction: "渐变描边胶囊按钮，转化按钮感强",
        },
      ],
    },
    {
      id: "auth-split",
      name: "分屏布局",
      icon: "Columns2",
      description: "品牌侧 + 表单侧，企业级视觉",
      variants: [
        {
          id: "asplit_brand",
          name: "左品牌右表单",
          description: "左侧品牌墙，右侧表单",
          tags: ["分屏", "企业"],
          prompt:
            "Build a split auth layout: left half brand panel (gradient/primary background, logo, value prop, testimonial), right half login form. Responsive: brand hidden on mobile.",
          code: `export function SplitAuth() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-[var(--on-primary)] lg:flex" style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}>
        <div>
          <p className="text-lg font-bold">{{brand}}</p>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-tight">让每个团队都高效工作</h2>
          <p className="mt-3 max-w-sm" style={{ color: "color-mix(in srgb, var(--on-primary) 80%, transparent)" }}>一站式工作台，从项目到数据全链路打通。</p>
          <p className="mt-8 text-sm" style={{ color: "color-mix(in srgb, var(--on-primary) 80%, transparent)" }}>"使用一周就替代了我们三套工具。"</p>
          <p className="mt-1 text-xs" style={{ color: "color-mix(in srgb, var(--on-primary) 60%, transparent)" }}>— 张伟，{{brand}} 增长负责人</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12" style={{ background: "var(--background)" }}>
        <div className="w-full max-w-sm">
          <p className="text-lg font-bold lg:hidden">{{brand}}</p>
          <h1 className="mt-6 text-2xl font-bold">欢迎回来</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>登录你的账号</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{{auth.email}}</label>
              <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{{auth.password}}</label>
              <input type="password" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
            </div>
            <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "移动端隐藏品牌侧；桌面端品牌侧固定",
          motionId: "page-transition",
        },
        {
          id: "asplit_image",
          name: "左图右表单",
          description: "图片 + 文案，营销感强",
          tags: ["图片", "营销"],
          prompt:
            "Build a split auth with image: left half full-bleed image with dark overlay + quote, right half login form.",
          code: `export function SplitAuth() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src="https://picsum.photos/seed/xiye-auth-bg/1600/1200" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 flex h-full flex-col justify-end p-12 text-white">
          <p className="text-2xl font-semibold leading-snug">"最好的决策工具，没有之一。"</p>
          <p className="mt-3 text-sm text-white/80">— 李娜，Nova 产品总监</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold">欢迎回来</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>登录继续你的旅程</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
            <input type="email" placeholder="{{auth.email}}" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
            <input type="password" placeholder="{{auth.password}}" className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
            <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "图片可做缓慢 Ken Burns 缩放",
        },
        {
          id: "asplit_dark",
          name: "深色分屏",
          description: "双深色区块，高端品牌感",
          tags: ["深色", "高级"],
          prompt:
            "Build a dark split auth: both halves dark (slate-900), brand side with subtle gradient glow, form side with card.",
          code: `export function SplitAuth() {
  return (
    <div className="grid min-h-screen bg-slate-950 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-slate-900 p-12 lg:flex">
        <p className="text-lg font-bold text-white">{{brand}}</p>
        <div>
          <h2 className="text-3xl font-bold leading-tight text-white">为高绩效团队而生</h2>
          <p className="mt-3 max-w-sm text-slate-400">从想法到落地的每一步，都在这里。</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-8">
          <h1 className="text-xl font-bold text-white">欢迎回来</h1>
          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
            <input type="email" placeholder="{{auth.email}}" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--primary)]" />
            <input type="password" placeholder="{{auth.password}}" className="w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-[var(--primary)]" />
            <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "深色高端感，适合创意/金融品牌",
        },
        {
          id: "asplit_glass",
          name: "毛玻璃分屏",
          description: "渐变品牌侧 + 磨砂表单卡",
          tags: ["毛玻璃", "高级"],
          prompt:
            "Build a frosted-glass split auth: left brand panel with soft primary→secondary gradient and huge serif statement, right form card with backdrop-blur and glow border. Luxury SaaS feel.",
          code: `export function SplitAuth() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-12 text-[var(--on-primary)] lg:flex" style={{ background: "linear-gradient(150deg, var(--primary), color-mix(in srgb, var(--secondary) 70%, var(--primary)))" }}>
        <p className="text-lg font-bold">{{brand}}</p>
        <div>
          <h2 className="text-4xl font-black leading-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>让每个团队<br />都高效工作</h2>
          <p className="mt-4 max-w-sm text-sm" style={{ color: "color-mix(in srgb, var(--on-primary) 80%, transparent)" }}>一站式工作台，从项目到数据全链路打通。</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12" style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 6%, var(--background)), var(--background) 60%)" }}>
        <div className="w-full max-w-sm rounded-3xl border p-8" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
          <h1 className="text-2xl font-bold">欢迎回来</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>登录你的账号</p>
          <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
            <input type="email" placeholder="{{auth.email}}" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 50%, transparent)" }} />
            <input type="password" placeholder="{{auth.password}}" className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 50%, transparent)" }} />
            <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent)" }}>登录</button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "品牌侧衬线巨标 + 表单侧磨砂卡，双质感叠加",
        },
        {
          id: "asplit_editorial",
          name: "编辑式分屏",
          description: "衬线宣言 + 细线分隔表单",
          tags: ["编辑式", "衬线", "极简高级"],
          prompt:
            "Build an editorial split auth: left panel with a giant serif manifesto statement on a flat background, hairline divider, right side a minimal underline-form login. Magazine typography.",
          code: `export function SplitAuth() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between p-14 lg:flex" style={{ background: "var(--background)", borderRight: "1px solid var(--border)" }}>
        <p className="text-sm font-bold tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{{brand}}</p>
        <div>
          <h2 className="text-5xl font-black leading-[1.05] tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>少即是多，<br />多即是繁。</h2>
          <p className="mt-5 max-w-xs text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>为追求极致效率的团队而生的工作空间。</p>
        </div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>© 2025 {{brand}}</p>
      </div>
      <div className="flex items-center justify-center px-6 py-12" style={{ background: "var(--surface)" }}>
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>欢迎回来</h1>
          <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-5">
            <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
              <input type="email" placeholder="{{auth.email}}" className="w-full bg-transparent py-1 text-sm outline-none" />
            </div>
            <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
              <input type="password" placeholder="{{auth.password}}" className="w-full bg-transparent py-1 text-sm outline-none" />
            </div>
            <button type="submit" className="w-full rounded-full py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>登录</button>
          </form>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "衬线宣言定调 + 细线输入框，编辑感十足",
        },
      ],
    },
    {
      id: "auth-signup",
      name: "注册表单",
      icon: "UserPlus",
      description: "新用户转化入口",
      variants: [
        {
          id: "asignup_standard",
          name: "标准注册",
          description: "姓名/{{auth.email}}/{{auth.password}}三件套",
          tags: ["标准", "转化"],
          prompt:
            "Build a standard signup form: name, email, password fields, terms checkbox, submit button, social login option, login link. Conversion-optimized.",
          code: `export function SignupForm() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-bold">创建账号</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>14 天{{cta.secondary}}，无需信用卡。</p>
      <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">姓名</label>
          <input placeholder="张三" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{{auth.email}}</label>
          <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{{auth.password}}</label>
          <input type="password" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <label className="flex items-start gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <input type="checkbox" className="mt-0.5 accent-[var(--primary)]" /> 我已阅读并同意<a href="#tos" style={{ color: "var(--primary)" }}>服务条款</a>与<a href="#privacy" style={{ color: "var(--primary)" }}>隐私政策</a>
        </label>
        <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</button>
      </form>
      <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        已有账号？<a href="#login" style={{ color: "var(--primary)" }}>登录</a>
      </p>
    </div>
  );
}`,
          interaction: "{{auth.password}}强度提示可选；注册成功跳转引导",
        },
        {
          id: "asignup_company",
          name: "带公司字段",
          description: "B2B 注册：公司名 + 团队规模",
          tags: ["B2B", "企业"],
          prompt:
            "Build a B2B signup: company name, work email, team size select, password. Enterprise-ready signup flow.",
          code: `export function SignupForm() {
  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-bold">创建企业账号</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>面向团队的注册流程</p>
      <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">公司名</label>
            <input placeholder="{{brand}} Inc." className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">团队规模</label>
            <select className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <option>1-10 人</option><option>11-50 人</option><option>50+ 人</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">工作{{auth.email}}</label>
          <input type="email" placeholder="you@company.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{{auth.password}}</label>
          <input type="password" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>创建账号</button>
      </form>
    </div>
  );
}`,
          interaction: "工作{{auth.email}}校验 + 团队规模引导计费档",
        },
        {
          id: "asignup_steps",
          name: "分步注册",
          description: "两步向导：账号 → 偏好",
          tags: ["分步", "引导"],
          prompt:
            "Build a 2-step signup wizard: step indicator, step 1 account info, step 2 preferences (role select + product interest), progress bar.",
          code: `export function SignupForm() {
  const [step, setStep] = useState(1);
  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl font-bold">创建账号</h1>
      <div className="mt-4 flex gap-1.5">
        {[1, 2].map((s) => (
          <span key={s} className={"h-1 flex-1 rounded-full " + (s <= step ? "" : "opacity-20")} style={{ background: "var(--primary)" }} />
        ))}
      </div>
      <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>第 {step} 步，共 2 步</p>
      {step === 1 ? (
        <form onSubmit={(e) => { e.preventDefault(); setStep(2); }} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">姓名</label>
            <input placeholder="张三" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">{{auth.email}}</label>
            <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          </div>
          <button type="submit" className="w-full rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>下一步</button>
        </form>
      ) : (
        <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">你的角色</label>
            <select className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <option>创始人/老板</option><option>产品经理</option><option>开发者</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">最想解决的问题</label>
            <select className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <option>提高团队效率</option><option>数据驱动决策</option><option>自动化流程</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 rounded-lg border py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)" }}>上一步</button>
            <button type="submit" className="flex-1 rounded-lg py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>完成注册</button>
          </div>
        </form>
      )}
    </div>
  );
}`,
          interaction: "分步降低注册心理门槛；偏好数据驱动 onboarding",
        },
        {
          id: "asignup_glass",
          name: "毛玻璃注册卡",
          description: "磨砂卡 + 渐变底，与登录呼应",
          tags: ["毛玻璃", "高级"],
          prompt:
            "Build a frosted-glass signup: gradient background, translucent card with backdrop-blur and glow border, name/email/password fields, terms row, primary CTA. Matches the glass login variant.",
          code: `export function SignupForm() {
  return (
    <div className="mx-auto w-full max-w-sm rounded-3xl border p-8" style={{ borderColor: "color-mix(in srgb, var(--border) 55%, transparent)", background: "color-mix(in srgb, var(--surface) 60%, transparent)", backdropFilter: "blur(20px)", boxShadow: "0 24px 60px -24px color-mix(in srgb, var(--foreground) 12%, transparent)" }}>
      <h1 className="text-xl font-bold">创建账号</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>14 天{{cta.secondary}}，无需信用卡。</p>
      <form onSubmit={(e) => e.preventDefault()} className="mt-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">姓名</label>
          <input placeholder="张三" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 50%, transparent)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{{auth.email}}</label>
          <input type="email" placeholder="you@example.com" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 50%, transparent)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">{{auth.password}}</label>
          <input type="password" className="rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--background) 50%, transparent)" }} />
        </div>
        <label className="flex items-start gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <input type="checkbox" className="mt-0.5 accent-[var(--primary)]" /> 我已阅读并同意<a href="#tos" style={{ color: "var(--primary)" }}>服务条款</a>
        </label>
        <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)", boxShadow: "0 12px 28px color-mix(in srgb, var(--primary) 30%, transparent)" }}>免费注册</button>
      </form>
    </div>
  );
}`,
          interaction: "磨砂卡 + 柔光 CTA，与 alogin_glass 成套",
        },
        {
          id: "asignup_editorial",
          name: "编辑式注册",
          description: "衬线巨标 + 细线分隔字段",
          tags: ["编辑式", "衬线", "极简高级"],
          prompt:
            "Build an editorial signup: oversized serif heading, fields separated by hairlines only, terms as a footnote, full-width pill CTA. Magazine-like luxury.",
          code: `export function SignupForm() {
  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="text-4xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>创建账号</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>14 天{{cta.secondary}}，无需信用卡。</p>
      <form onSubmit={(e) => e.preventDefault()} className="mt-8 space-y-5">
        <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
          <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>姓名</label>
          <input placeholder="张三" className="w-full bg-transparent py-1 text-base outline-none" />
        </div>
        <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
          <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{{auth.email}}</label>
          <input type="email" placeholder="you@example.com" className="w-full bg-transparent py-1 text-base outline-none" />
        </div>
        <div className="border-b pb-1.5" style={{ borderColor: "var(--border)" }}>
          <label className="block text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{{auth.password}}</label>
          <input type="password" className="w-full bg-transparent py-1 text-base outline-none" />
        </div>
        <button type="submit" className="w-full rounded-full py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>免费注册</button>
      </form>
      <p className="mt-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
        已有账号？<a href="#login" style={{ color: "var(--primary)" }}>登录</a>
      </p>
    </div>
  );
}`,
          interaction: "衬线巨标 + 细线字段，编辑感定调",
        },
        {
          id: "asignup_gradient",
          name: "渐变玻璃注册",
          description: "渐变底 + 白透玻璃卡 + 渐变 CTA",
          tags: ["毛玻璃", "渐变", "注册", "高质感"],
          prompt:
            "Build a gradient glass signup: a vivid diagonal gradient background, a translucent white glass card with frost, a gradient primary submit button. Premium 'high-end visual design' finish.",
          code: `export function GlassSignup() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ background: "linear-gradient(135deg, var(--accent-5), var(--accent-1) 50%, var(--accent-2))" }}>
      <div className="w-full max-w-md rounded-2xl border p-6" style={{ border: "1px solid color-mix(in srgb, var(--foreground) 20%, transparent)", background: "color-mix(in srgb, var(--surface) 75%, transparent)", backdropFilter: "blur(24px)" }}>
        <h3 className="text-xl font-bold text-slate-900">创建账号</h3>
        <div className="mt-4 space-y-3">
          <span className="block rounded-lg px-3 py-2 text-sm text-slate-500" style={{ background: "var(--surface)" }}>you@example.com</span>
          <span className="block rounded-lg px-3 py-2 text-sm text-slate-500" style={{ background: "var(--surface)" }}>••••••••</span>
        </div>
        <span className="mt-4 block rounded-lg py-2.5 text-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, var(--accent-5), var(--accent-2))" }}>注册</span>
      </div>
    </div>
  );
}`,
          interaction: "渐变底 + 白透玻璃卡 + 渐变 CTA",
        },
      ],
    },
  ],
};
