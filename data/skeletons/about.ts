// 关于页（About）页面骨架数据。
// 调性：极简高级（宣言/团队/价值观）。

import type { SkeletonPage } from "./types";

export const ABOUT_PAGE: SkeletonPage = {
  id: "about",
  name: "关于我们",
  icon: "Building2",
  description: "公司/品牌介绍页：品牌故事、团队、价值观与里程碑",
  components: [
    {
      id: "about-story",
      name: "品牌故事",
      icon: "BookOpen",
      description: "品牌叙事与宣言",
      variants: [
        {
          id: "astory_manifesto",
          name: "宣言大字",
          description: "整屏宣言 + 细线分隔数据",
          tags: ["宣言", "编辑式"],
          prompt:
            "Build a brand manifesto: oversized serif statement centered, one supporting paragraph below (max 65ch), then a hairline-separated stats strip (founded / team / countries). Pure typography, max whitespace.",
          code: `export function BrandStory() {
  const stats = [
    { v: "2016", l: "成立" },
    { v: "120", l: "团队成员" },
    { v: "30+", l: "服务国家" },
  ];
  return (
    <section className="px-6 py-28 text-center" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-black leading-[1.12] tracking-tight sm:text-5xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
          我们相信，<br />好产品源于好问题。
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          从一个小团队出发，{{brand}} 用十年时间陪伴 120 位伙伴，为 30 多个国家的用户打造可靠的产品。
        </p>
        <div className="mx-auto mt-14 flex max-w-xl justify-between border-t pt-6" style={{ borderColor: "var(--border)" }}>
          {stats.map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-2xl font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{s.v}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "衬线宣言 + 数据条细线分隔",
        },
        {
          id: "astory_split",
          name: "图文分栏",
          description: "左文右图，叙事感强",
          tags: ["分栏", "叙事"],
          prompt:
            "Build a story split section: left column has an eyebrow, serif heading, two paragraphs of story text and a signature; right column has a large image with a small caption. Asymmetric 1:1 split.",
          code: `export function BrandStory() {
  return (
    <section className="grid items-center gap-12 px-6 py-20 lg:grid-cols-2">
      <div className="max-w-lg">
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>我们的故事</p>
        <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight sm:text-4xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
          始于一张草图，<br />成于无数次迭代。
        </h2>
        <p className="mt-5 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          2016 年，三位工程师在车库写下第一行代码。今天，{{brand}} 服务着全球 30 多个国家的用户。
        </p>
        <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
          我们仍然保持着小团队的速度与好奇心：快速试错，认真打磨。
        </p>
        <p className="mt-6 text-sm font-medium">— 创始人团队</p>
      </div>
      <div>
        <img src="https://picsum.photos/seed/xiye-about-story/800/1000" alt="工作室" className="w-full rounded-2xl object-cover" />
        <p className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>图：2016 年的第一间办公室</p>
      </div>
    </section>
  );
}`,
          interaction: "图文分栏叙事，签名收尾",
        },
        {
          id: "astory_quote",
          name: "引文聚焦",
          description: "创始人引文 + 头衔，克制有力",
          tags: ["引文", "极简"],
          prompt:
            "Build a founder quote section: a large serif quote (max 3 lines) centered, founder name + role below, a thin hairline above and below. No images, pure typography, generous padding.",
          code: `export function BrandStory() {
  return (
    <section className="px-6 py-28 text-center" style={{ background: "var(--surface)" }}>
      <div className="mx-auto max-w-2xl">
        <span className="text-3xl" style={{ color: "var(--primary)" }}>"</span>
        <p className="text-2xl font-medium leading-relaxed sm:text-3xl" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>
          我们做的不是软件，而是帮用户省下的每一分钟。
        </p>
        <p className="mt-6 text-sm font-semibold">李娜 · {{brand}} 创始人兼 CEO</p>
        <div className="mx-auto mt-10 h-px w-24" style={{ background: "var(--border)" }} />
      </div>
    </section>
  );
}`,
          interaction: "衬线引文 + 细线分隔",
        },
      ],
    },
    {
      id: "about-team",
      name: "团队",
      icon: "Users",
      description: "团队成员展示",
      variants: [
        {
          id: "ateam_grid",
          name: "头像网格",
          description: "头像 + 姓名 + 职位，hover 上浮",
          tags: ["网格", "团队"],
          prompt:
            "Build a team grid: responsive grid of member cards, each with a real portrait photo, name, role, and short bio. Hover lifts the card. Section heading + description. Use picsum seed portraits.",
          code: `export function TeamGrid() {
  const team = [
    { n: "李娜", r: "创始人 / CEO", img: "https://picsum.photos/seed/xiye-team-1/400/500" },
    { n: "王强", r: "设计总监", img: "https://picsum.photos/seed/xiye-team-2/400/500" },
    { n: "张敏", r: "技术负责人", img: "https://picsum.photos/seed/xiye-team-3/400/500" },
    { n: "陈晨", r: "增长负责人", img: "https://picsum.photos/seed/xiye-team-4/400/500" },
  ];
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>团队</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">背后的 120 人</h2>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-4">
          {team.map((m) => (
            <div key={m.n} className="group text-center">
              <img src={m.img} alt={m.n} loading="lazy" className="aspect-[4/5] w-full rounded-xl object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
              <p className="mt-3 font-semibold">{m.n}</p>
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{m.r}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "头像 hover 微缩放",
        },
        {
          id: "ateam_list",
          name: "行列表团队",
          description: "细线行列表 + 头像，编辑式",
          tags: ["列表", "编辑式"],
          prompt:
            "Build an editorial team list: each member is a hairline-separated row with small portrait, name, role on the left, and a social/email icon on the right. No cards.",
          code: `export function TeamList() {
  const team = [
    { n: "李娜", r: "创始人 / CEO", img: "https://picsum.photos/seed/xiye-team-1/200/200" },
    { n: "王强", r: "设计总监", img: "https://picsum.photos/seed/xiye-team-2/200/200" },
    { n: "张敏", r: "技术负责人", img: "https://picsum.photos/seed/xiye-team-3/200/200" },
    { n: "陈晨", r: "增长负责人", img: "https://picsum.photos/seed/xiye-team-4/200/200" },
  ];
  return (
    <section className="px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">团队</h2>
        <div className="mt-6">
          {team.map((m) => (
            <div key={m.n} className="flex items-center gap-4 border-b py-4" style={{ borderColor: "var(--border)" }}>
              <img src={m.img} alt={m.n} loading="lazy" className="size-11 rounded-full object-cover" />
              <div className="flex-1">
                <p className="font-medium">{m.n}</p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{m.r}</p>
              </div>
              <span style={{ color: "var(--muted-foreground)" }}>↗</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "细线行 + 头像圆",
        },
      ],
    },
    {
      id: "about-values",
      name: "价值观里程碑",
      icon: "Milestone",
      description: "价值观卡与里程碑时间线",
      variants: [
        {
          id: "avalue_grid",
          name: "价值观卡",
          description: "编号 + 标题 + 描述卡",
          tags: ["价值观", "网格"],
          prompt:
            "Build a values grid: 3 numbered cards (01/02/03) each with a title, description, and small icon. Bordered cards with generous padding, hover lift. No AI-purple gradients, use the accent sparingly.",
          code: `export function ValuesGrid() {
  const values = [
    { n: "01", t: "用户第一", d: "每个决策都回到用户真实问题，不堆砌功能。", icon: "◎" },
    { n: "02", t: "长期主义", d: "做十年后依然正确的选择，而不是最快的捷径。", icon: "◇" },
    { n: "03", t: "保持开放", d: "透明沟通、共享上下文，让每个声音被听见。", icon: "○" },
  ];
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>价值观</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">我们如何工作</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {values.map((v) => (
            <div key={v.n} className="group rounded-xl border p-6 transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center justify-between">
                <span className="text-xl" style={{ color: "var(--primary)" }}>{v.icon}</span>
                <span className="text-sm font-black" style={{ color: "var(--muted-foreground)" }}>{v.n}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{v.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{v.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "编号 + 图标 + hover 上浮",
        },
        {
          id: "avalue_timeline",
          name: "里程碑时间线",
          description: "竖向年份时间线 + 大事记",
          tags: ["时间线", "叙事"],
          prompt:
            "Build a company timeline: vertical line with year dots, each milestone has a year (display size), title and description. Alternate left/right on desktop, single column on mobile.",
          code: `export function MilestoneTimeline() {
  const items = [
    { y: "2016", t: "成立", d: "三位工程师从车库出发。" },
    { y: "2018", t: "种子轮", d: "获得第一轮机构投资。" },
    { y: "2021", t: "出海", d: "服务扩展至 15 个国家。" },
    { y: "2025", t: "120 人", d: "团队成长，使命不变。" },
  ];
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight">大事记</h2>
        <div className="relative mt-8 space-y-8 border-l pl-8" style={{ borderColor: "var(--border)" }}>
          {items.map((m) => (
            <div key={m.y} className="relative">
              <span className="absolute -left-[35px] top-1.5 size-3 rounded-full border-2" style={{ background: "var(--background)", borderColor: "var(--primary)" }} />
              <p className="text-2xl font-black" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{m.y}</p>
              <p className="mt-1 font-semibold">{m.t}</p>
              <p className="mt-0.5 text-sm" style={{ color: "var(--muted-foreground)" }}>{m.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "时间线圆点 + 年份大号",
        },
      ],
    },
  ],
};
