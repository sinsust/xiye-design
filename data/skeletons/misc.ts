// 辅助页（Misc）页面骨架数据：404 错误页 + Coming Soon 预告页。

import type { SkeletonPage } from "./types";

export const MISC_PAGE: SkeletonPage = {
  id: "misc",
  name: "辅助页",
  icon: "ShieldAlert",
  description: "404 错误页与 Coming Soon 预告页，品牌体验的收尾",
  components: [
    {
      id: "misc-404",
      name: "404 错误页",
      icon: "SearchX",
      description: "找不到页面的引导",
      variants: [
        {
          id: "e404_minimal",
          name: "极简 404",
          description: "超大 404 + 返回主页",
          tags: ["极简", "错误"],
          prompt:
            "Build a minimal 404 page: giant '404' in display type, one-line message, a single 'Back home' button (primary). Centered, generous whitespace, no illustrations.",
          code: `export function NotFound() {
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <p className="text-8xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>404</p>
      <p className="mt-4 text-lg font-medium">页面走丢了</p>
      <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>你访问的页面不存在或已被移动。</p>
      <a href="/" className="mt-7 rounded-lg px-6 py-2.5 text-sm font-medium text-white" style={{ background: "var(--primary)" }}>返回首页</a>
    </section>
  );
}`,
          interaction: "衬线巨号 404 + 单 CTA",
        },
        {
          id: "e404_creative",
          name: "创意 404",
          description: "大标题 + 搜索框 + 快捷链接",
          tags: ["创意", "引导"],
          prompt:
            "Build a creative 404 page: an editorial headline like 'Nothing here yet', a search input, and quick links (Home / Blog / Contact) as small pills. Warm, human tone, no stock illustration.",
          code: `export function NotFound() {
  const links = ["首页", "博客", "联系"];
  return (
    <section className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>404 · Page not found</p>
      <h1 className="mt-4 max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
        这里还没有任何东西
      </h1>
      <p className="mt-3 max-w-sm text-sm" style={{ color: "var(--muted-foreground)" }}>也许换个关键词，或者从下面这些地方重新开始。</p>
      <div className="mt-6 flex w-full max-w-sm items-center gap-2 rounded-full border px-4 py-2" style={{ borderColor: "var(--border)" }}>
        <span style={{ color: "var(--muted-foreground)" }}>⌕</span>
        <input placeholder="搜索…" className="w-full bg-transparent text-sm outline-none" />
      </div>
      <div className="mt-5 flex gap-2">
        {links.map((l) => (
          <a key={l} href="#go" className="rounded-full border px-4 py-1.5 text-sm transition hover:bg-muted" style={{ borderColor: "var(--border)" }}>{l}</a>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "搜索框 + 快捷药丸导航",
        },
      ],
    },
    {
      id: "misc-coming",
      name: "Coming Soon",
      icon: "Hourglass",
      description: "上线预告页，收邮箱",
      variants: [
        {
          id: "coming_email",
          name: "预告订阅",
          description: "大标题 + 邮箱订阅，上线通知",
          tags: ["预告", "订阅"],
          prompt:
            "Build a coming soon page: brand mark, big headline with a serif italic accent word, one-line subtext, email input + notify button in a pill, small social icons below. Dark or light per theme, centered.",
          code: `export function ComingSoon() {
  return (
    <section className="flex min-h-[85vh] flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <span className="flex size-11 items-center justify-center rounded-xl text-lg font-black text-white" style={{ background: "var(--primary)" }}>✦</span>
      <p className="mt-6 text-xs uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>Coming Soon</p>
      <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-6xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
        即将上线<span style={{ fontStyle: "italic", color: "var(--primary)" }}>。</span>
      </h1>
      <p className="mt-4 max-w-sm text-base" style={{ color: "var(--muted-foreground)" }}>留下邮箱，第一时间获取上线通知与早期体验资格。</p>
      <form onSubmit={(e) => e.preventDefault()} className="mt-8 flex w-full max-w-sm items-center gap-2 rounded-full border p-1.5 pl-4" style={{ borderColor: "var(--border)" }}>
        <input type="email" placeholder="you@example.com" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <button type="submit" className="shrink-0 rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: "var(--primary)" }}>通知我</button>
      </form>
    </section>
  );
}`,
          interaction: "胶囊订阅条 + 衬线标题斜体强调",
        },
        {
          id: "coming_timer",
          name: "倒计时预告",
          description: "倒计时 + 订阅，紧迫感",
          tags: ["倒计时", "预告"],
          prompt:
            "Build a coming soon page with countdown: 4 time boxes (days/hours/minutes/seconds) with monospace numbers, headline, email subscribe row, and a progress hint like '首批 1,200 个名额'. Dark canvas.",
          code: `export function ComingSoon() {
  const t = [
    { v: "12", l: "天" },
    { v: "08", l: "小时" },
    { v: "36", l: "分钟" },
    { v: "12", l: "秒" },
  ];
  return (
    <section className="flex min-h-[85vh] flex-col items-center justify-center px-6 text-center" style={{ background: "var(--background)" }}>
      <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>{{brand}} · 2.0 即将到来</p>
      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">全新版本正在路上</h1>
      <div className="mt-8 flex gap-3">
        {t.map((x) => (
          <div key={x.l} className="w-16 rounded-xl border py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="font-mono text-2xl font-bold">{x.v}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="mt-8 flex w-full max-w-sm items-center gap-2 rounded-full border p-1.5 pl-4" style={{ borderColor: "var(--border)" }}>
        <input type="email" placeholder="you@example.com" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        <button type="submit" className="shrink-0 rounded-full px-5 py-2 text-sm font-medium text-white" style={{ background: "var(--primary)" }}>获取名额</button>
      </form>
      <p className="mt-4 text-xs" style={{ color: "var(--muted-foreground)" }}>首批仅开放 1,200 个体验名额</p>
    </section>
  );
}`,
          interaction: "倒计时等宽数字 + 名额稀缺感",
        },
      ],
    },
  ],
};
