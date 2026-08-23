// 博客页（Blog）页面骨架数据。
// 调性：编辑式阅读体验，图片用 picsum.photos 免费 seed。

import type { SkeletonPage } from "./types";

export const BLOG_PAGE: SkeletonPage = {
  id: "blog",
  name: "博客",
  icon: "Newspaper",
  description: "内容站：文章列表、正文排版、标签分类，内容营销的门面",
  components: [
    {
      id: "blog-list",
      name: "文章列表",
      icon: "List",
      description: "文章索引的多种排布",
      variants: [
        {
          id: "blist_card",
          name: "卡片网格",
          description: "图卡 + 分类 + 标题 + 日期",
          tags: ["卡片", "网格"],
          prompt:
            "Build a blog card grid: 3-column responsive grid, each card with image, category chip, title, excerpt, date and read-time. Hover lifts the card with a subtle shadow. Section heading + subscription prompt.",
          code: `export function BlogGrid() {
  const posts = [
    { t: "用设计系统加速团队交付", c: "设计", d: "2025-06-12", r: "6 分钟", img: "https://picsum.photos/seed/xiye-blog-1/600/380" },
    { t: "动效的克制之美", c: "动效", d: "2025-06-04", r: "4 分钟", img: "https://picsum.photos/seed/xiye-blog-2/600/380" },
    { t: "AI 时代的界面叙事", c: "趋势", d: "2025-05-28", r: "8 分钟", img: "https://picsum.photos/seed/xiye-blog-3/600/380" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>Journal</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight">最新文章</h2>
          </div>
          <a href="#all" className="text-sm" style={{ color: "var(--primary)" }}>查看全部 →</a>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {posts.map((p) => (
            <a key={p.t} href="#post" className="group rounded-xl border p-3 transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="overflow-hidden rounded-lg">
                <img src={p.img} alt={p.t} loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </div>
              <div className="p-1.5 pt-3">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{p.c}</span>
                <h3 className="mt-2 font-semibold leading-snug group-hover:text-[var(--primary)]">{p.t}</h3>
                <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{p.d} · {p.r}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "hover 图上浮 + 标题变色",
        },
        {
          id: "blist_row",
          name: "编辑式行列表",
          description: "序号 + 细线分隔行，杂志排版",
          tags: ["编辑式", "细线"],
          prompt:
            "Build an editorial blog index: each post is a full-width row with a large index number, title (serif), category and date on the right, separated by hairlines. No images, pure typographic rhythm.",
          code: `export function BlogIndex() {
  const posts = [
    { n: "01", t: "用设计系统加速团队交付", c: "设计", d: "2025-06-12" },
    { n: "02", t: "动效的克制之美", c: "动效", d: "2025-06-04" },
    { n: "03", t: "AI 时代的界面叙事", c: "趋势", d: "2025-05-28" },
    { n: "04", t: "从草图到像素的旅程", c: "流程", d: "2025-05-16" },
  ];
  return (
    <section className="px-6 py-20" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>Journal</p>
        <h2 className="mt-3 text-4xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>最新文章</h2>
        <div className="mt-10">
          {posts.map((p) => (
            <a key={p.n} href="#post" className="group flex items-baseline justify-between gap-6 border-b py-6" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-baseline gap-5">
                <span className="text-sm" style={{ color: "var(--primary)" }}>{p.n}</span>
                <h3 className="text-xl font-medium transition group-hover:text-[var(--primary)] sm:text-2xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{p.t}</h3>
              </div>
              <div className="hidden text-right text-xs sm:block" style={{ color: "var(--muted-foreground)" }}>
                <p>{p.c}</p>
                <p className="mt-0.5">{p.d}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "衬线标题 + 细线行，hover 变色",
        },
        {
          id: "blist_feature",
          name: "精选大卡 + 列表",
          description: "首篇横跨大卡，其余细排",
          tags: ["精选", "组合"],
          prompt:
            "Build a featured blog layout: one large featured post (full-width, big image + title) followed by a compact list of older posts in a sidebar-style column. Strong hierarchy between featured and rest.",
          code: `export function BlogFeatured() {
  const rest = [
    { t: "动效的克制之美", d: "2025-06-04" },
    { t: "AI 时代的界面叙事", d: "2025-05-28" },
    { t: "从草图到像素", d: "2025-05-16" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.6fr_1fr]">
        <a href="#post" className="group block">
          <div className="overflow-hidden rounded-2xl">
            <img src="https://picsum.photos/seed/xiye-blog-feat/1000/600" alt="精选文章" className="aspect-[5/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
          </div>
          <span className="mt-4 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>设计</span>
          <h2 className="mt-2 text-2xl font-bold leading-snug group-hover:text-[var(--primary)] sm:text-3xl">用设计系统加速团队交付</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>2025-06-12 · 6 分钟阅读</p>
        </a>
        <div className="flex flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>More</p>
          <div className="mt-3">
            {rest.map((p) => (
              <a key={p.t} href="#post" className="block border-b py-4 last:border-0" style={{ borderColor: "var(--border)" }}>
                <p className="font-medium transition group-hover:text-[var(--primary)]">{p.t}</p>
                <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{p.d}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "精选大图 + 侧栏细排，主次分明",
        },
      ],
    },
    {
      id: "blog-post",
      name: "正文排版",
      icon: "FileText",
      description: "文章正文的排版骨架",
      variants: [
        {
          id: "bpost_article",
          name: "标准正文",
          description: "标题/引文/代码块/图，完整排版",
          tags: ["正文", "完整"],
          prompt:
            "Build a blog article layout: title + meta, then article body with a blockquote, a code block, and an image with caption. Body text max-width 65ch, relaxed leading. Clean typographic hierarchy.",
          code: `export function BlogPost() {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>设计 · 2025-06-12</p>
      <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">用设计系统加速团队交付</h1>
      <p className="mt-4 text-sm" style={{ color: "var(--muted-foreground)" }}>作者 张三 · 6 分钟阅读</p>
      <div className="mt-10 space-y-6 text-base leading-relaxed">
        <p>设计系统不是样式库，而是一套关于「如何一致地做决定」的约定。它让团队从重复造轮子中解放出来，把精力留给真正的问题。</p>
        <blockquote className="border-l-2 pl-5 italic" style={{ borderColor: "var(--primary)", color: "var(--muted-foreground)" }}>
          "一致性的价值，在于它让用户不用每次重新学习。"
        </blockquote>
        <p>落地时，我们从 token 开始：颜色、圆角、间距、字体全部变量化，再逐层构建组件与区块。</p>
        <pre className="overflow-x-auto rounded-lg p-4 text-xs" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
{\`export const tokens = {
  radius: "12px",
  accent: "--primary",
};\`}
        </pre>
        <img src="https://picsum.photos/seed/xiye-blog-post/900/520" alt="配图" className="w-full rounded-xl" />
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>图：设计 token 落地示意</p>
        <p>最终，团队的新人上手时间从两周缩短到两天，跨项目的视觉一致性也大幅提升。</p>
      </div>
    </article>
  );
}`,
          interaction: "引文/代码块/图注排版完整",
        },
        {
          id: "bpost_sidebar",
          name: "正文 + 目录",
          description: "正文 + 右侧目录/作者卡",
          tags: ["目录", "侧栏"],
          prompt:
            "Build a blog layout with sidebar: article content (max 65ch) on the left, sticky TOC + author card on the right. TOC links anchor to headings. For longer-form writing.",
          code: `export function BlogPost() {
  const toc = ["引言", "为什么", "怎么做", "总结"];
  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 lg:grid-cols-[1fr_220px]">
      <article className="min-w-0">
        <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>趋势 · 2025-05-28</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight">AI 时代的界面叙事</h1>
        <div className="mt-8 space-y-6 text-base leading-relaxed">
          <h2 className="text-xl font-bold">引言</h2>
          <p>当生成式 AI 开始参与界面设计，叙事的重心从「如何排布」转向「如何让 AI 理解意图」。</p>
          <h2 className="text-xl font-bold">为什么</h2>
          <p>提示词就是新的设计稿。清晰的上下文、克制的约束、明确的层级，决定了产出的下限。</p>
          <h2 className="text-xl font-bold">怎么做</h2>
          <p>把设计决策写成可执行的规范，让 AI 在规范内发挥，而不是自由发挥。</p>
          <img src="https://picsum.photos/seed/xiye-blog-ai/900/500" alt="AI 叙事" className="w-full rounded-xl" />
          <h2 className="text-xl font-bold">总结</h2>
          <p>AI 不会取代设计师，但会用 AI 的设计师会取代不会用 AI 的。</p>
        </div>
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>目录</p>
            <ul className="mt-3 space-y-2 text-sm">
              {toc.map((t) => (
                <li key={t}><a href={"#" + t} className="hover:text-[var(--primary)]" style={{ color: "var(--muted-foreground)" }}>{t}</a></li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)" }}>
            <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
            <p className="mt-2 text-sm font-semibold">张三</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>独立设计师 · 写关于设计系统与 AI</p>
          </div>
        </div>
      </aside>
    </div>
  );
}`,
          interaction: "目录吸顶 + 作者卡",
        },
        {
          id: "bpost_minimal",
          name: "纯阅读窄栏",
          description: "居中窄栏衬线正文，沉浸阅读",
          tags: ["极简", "阅读"],
          prompt:
            "Build a minimal reading layout: centered narrow column (max-w-xl), serif body text, generous line-height, small caps meta, no images or cards. Pure typography for long-form reading.",
          code: `export function BlogPost() {
  return (
    <article className="mx-auto max-w-xl px-6 py-24 text-center" style={{ background: "var(--background)" }}>
      <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>设计</p>
      <h1 className="mt-5 text-3xl font-black leading-tight tracking-tight sm:text-4xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>动效的克制之美</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>张三 · 4 分钟</p>
      <div className="mt-12 space-y-7 text-left text-[17px] leading-[1.9]" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
        <p>最好的动效是看不见的。它不炫耀存在，只在需要时出现，帮用户理解「发生了什么」。</p>
        <p>入场、过渡、反馈，每个动画都应该回答一个问题：它为什么在这里？如果答不上来，就删掉它。</p>
        <p>克制不是不做，而是知道什么时候不做。一个安静的产品，往往比一个喧闹的产品更可信。</p>
      </div>
    </article>
  );
}`,
          interaction: "窄栏衬线正文，纯排版沉浸",
        },
      ],
    },
    {
      id: "blog-tags",
      name: "标签分类",
      icon: "Tags",
      description: "标签/分类的展示方式",
      variants: [
        {
          id: "btags_pills",
          name: "药丸标签墙",
          description: "标签药丸 + 计数，可筛文章",
          tags: ["标签", "药丸"],
          prompt:
            "Build a tag cloud: wrapping row of pill tags with counts (e.g. Design 12), one active state with primary fill. Below, the filtered article list is implied. Simple and functional.",
          code: `export function TagCloud() {
  const tags = [
    { t: "设计", n: 12, active: true },
    { t: "动效", n: 8 },
    { t: "趋势", n: 6 },
    { t: "流程", n: 5 },
    { t: "AI", n: 4 },
    { t: "案例", n: 3 },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-bold tracking-tight">按主题浏览</h2>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {tags.map((t) => (
            <a key={t.t} href="#tag" className={["rounded-full px-4 py-2 text-sm transition", t.active ? "text-white" : "border hover:bg-muted"].join(" ")} style={t.active ? { background: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
              {t.t} <span className="opacity-70">{t.n}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "药丸计数 + 激活态",
        },
        {
          id: "btags_cat",
          name: "分类网格卡",
          description: "大分类卡 + 计数 + 简介",
          tags: ["分类", "网格"],
          prompt:
            "Build a category grid: 3 cards, each with an icon, category name, short description, and article count. Bordered cards, hover lifts. For content sites with distinct sections.",
          code: `export function CategoryGrid() {
  const cats = [
    { t: "设计", d: "设计系统、方法论与案例", n: 12, icon: "◈" },
    { t: "动效", d: "GSAP、Motion 与叙事动画", n: 8, icon: "✦" },
    { t: "趋势", d: "AI 与界面设计的未来", n: 6, icon: "◎" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-3">
        {cats.map((c) => (
          <a key={c.t} href="#cat" className="group rounded-xl border p-6 transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <span className="text-xl" style={{ color: "var(--primary)" }}>{c.icon}</span>
            <h3 className="mt-3 text-lg font-semibold">{c.t}</h3>
            <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{c.d}</p>
            <p className="mt-4 text-xs font-medium" style={{ color: "var(--primary)" }}>{c.n} 篇文章 →</p>
          </a>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "分类卡 hover 上浮",
        },
        {
          id: "btags_sidebar",
          name: "侧栏分类列表",
          description: "分类列表 + 计数 + 活跃高亮",
          tags: ["侧栏", "列表"],
          prompt:
            "Build a sidebar category list: vertical list of categories with counts on the right, active category highlighted with primary text + left border. For blog archive pages.",
          code: `export function CategorySidebar() {
  const cats = [
    { t: "全部文章", n: 38, active: true },
    { t: "设计", n: 12 },
    { t: "动效", n: 8 },
    { t: "趋势", n: 6 },
    { t: "AI", n: 4 },
  ];
  return (
    <aside className="w-56 border-r p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="px-2 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>分类</p>
      <nav className="mt-3 space-y-1">
        {cats.map((c) => (
          <a key={c.t} href="#cat" className={["flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition", c.active ? "font-medium" : "hover:bg-muted"].join(" ")} style={c.active ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" } : { color: "var(--muted-foreground)" }}>
            {c.t}<span className="text-xs opacity-70">{c.n}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}`,
          interaction: "激活分类主色底 + 计数右对齐",
        },
      ],
    },
  ],
};
