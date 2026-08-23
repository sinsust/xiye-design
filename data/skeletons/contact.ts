// 联系页（Contact）页面骨架数据。

import type { SkeletonPage } from "./types";

export const CONTACT_PAGE: SkeletonPage = {
  id: "contact",
  name: "联系我们",
  icon: "Mail",
  description: "转化收口页：联系表单、信息卡、常见问题",
  components: [
    {
      id: "contact-form",
      name: "联系表单",
      icon: "MessageSquare",
      description: "线索收集表单",
      variants: [
        {
          id: "cform_standard",
          name: "标准表单",
          description: "姓名/邮箱/消息 + 提交",
          tags: ["表单", "标准"],
          prompt:
            "Build a contact form: name + email in a 2-col row, message textarea, submit button (primary), helper text and success note. Labels above inputs, error text below. Card container on surface background.",
          code: `export function ContactForm() {
  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">姓名</label>
          <input placeholder="张三" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">邮箱</label>
          <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">主题</label>
        <select className="rounded-lg border px-3 py-2.5 text-sm outline-none" style={{ borderColor: "var(--border)", background: "var(--background)" }}>
          <option>商务合作</option><option>产品咨询</option><option>技术支持</option><option>其他</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">留言</label>
        <textarea rows={4} placeholder="简单描述你的需求…" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--background)" }} />
      </div>
      <button type="submit" className="rounded-lg px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90" style={{ background: "var(--primary)" }}>发送留言</button>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>我们会在 1 个工作日内回复。</p>
    </form>
  );
}`,
          interaction: "标签置顶；提交防抖 + 成功提示",
        },
        {
          id: "cform_split",
          name: "左信息右表单",
          description: "左列联系方式 + 右列表单",
          tags: ["分栏", "完整"],
          prompt:
            "Build a split contact section: left column has heading, short intro, email/phone/address lines, social icons; right column has the form (name, email, message, submit). Asymmetric 2:3 grid, no cards.",
          code: `export function ContactSplit() {
  const infos = [
    { k: "邮箱", v: "hello@example.com" },
    { k: "电话", v: "+86 138-0000-0000" },
    { k: "地址", v: "上海市 · 徐汇区" },
  ];
  return (
    <section className="grid gap-12 px-6 py-20 lg:grid-cols-[2fr_3fr]">
      <div>
        <p className="text-xs uppercase tracking-[0.25em]" style={{ color: "var(--muted-foreground)" }}>联系我们</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>聊聊你的想法</h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>无论是一个新项目，还是一次合作，我们都很乐意倾听。</p>
        <div className="mt-8 space-y-4">
          {infos.map((i) => (
            <div key={i.k}>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{i.k}</p>
              <p className="mt-0.5 font-medium">{i.v}</p>
            </div>
          ))}
        </div>
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">姓名</label>
            <input placeholder="张三" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">邮箱</label>
            <input type="email" placeholder="you@example.com" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">留言</label>
          <textarea rows={5} placeholder="简单描述你的需求…" className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface)" }} />
        </div>
        <button type="submit" className="rounded-lg px-6 py-2.5 text-sm font-medium text-white" style={{ background: "var(--primary)" }}>发送</button>
      </form>
    </section>
  );
}`,
          interaction: "左信息右表单；左列衬线标题",
        },
      ],
    },
    {
      id: "contact-info",
      name: "信息卡",
      icon: "MapPin",
      description: "联系方式与地址展示",
      variants: [
        {
          id: "cinfo_cards",
          name: "三信息卡",
          description: "邮箱/电话/地址三卡",
          tags: ["卡片", "标准"],
          prompt:
            "Build contact info cards: 3 cards (Email / Phone / Office) each with an icon, title, and value + sub-text. Bordered cards in a row, hover lift.",
          code: `export function ContactInfo() {
  const cards = [
    { icon: "✉", t: "邮箱", v: "hello@example.com", d: "商务与合作" },
    { icon: "☎", t: "电话", v: "+86 138-0000-0000", d: "周一至周五 9:00-18:00" },
    { icon: "⌖", t: "办公室", v: "上海市徐汇区", d: "预约来访" },
  ];
  return (
    <section className="grid gap-5 px-6 py-14 md:grid-cols-3">
      {cards.map((c) => (
        <div key={c.t} className="group rounded-xl border p-6 text-center transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="mx-auto flex size-10 items-center justify-center rounded-full text-base" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{c.icon}</span>
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>{c.t}</p>
          <p className="mt-1 font-semibold">{c.v}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{c.d}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "图标圆 + hover 上浮",
        },
        {
          id: "cinfo_editorial",
          name: "编辑式信息行",
          description: "细线分隔信息行，克制高级",
          tags: ["编辑式", "极简"],
          prompt:
            "Build an editorial contact list: hairline-separated rows of label (small caps) and value (larger), arrow icon on the right. No cards, pure typography.",
          code: `export function ContactInfo() {
  const rows = [
    { k: "Email", v: "hello@example.com" },
    { k: "Phone", v: "+86 138-0000-0000" },
    { k: "Studio", v: "上海市徐汇区 · 3F" },
  ];
  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-2xl">
        {rows.map((r) => (
          <a key={r.k} href="#contact" className="group flex items-center justify-between border-b py-5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-baseline gap-6">
              <span className="w-16 text-xs uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{r.k}</span>
              <span className="text-lg font-medium transition group-hover:text-[var(--primary)]">{r.v}</span>
            </div>
            <span className="text-sm opacity-0 transition group-hover:opacity-100">→</span>
          </a>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "细线行 + hover 箭头浮现",
        },
      ],
    },
    {
      id: "contact-faq",
      name: "常见问题",
      icon: "MessageCircleQuestion",
      description: "FAQ 手风琴，答疑转化",
      variants: [
        {
          id: "cfaq_simple",
          name: "简单手风琴",
          description: "细线分隔问答，单开折叠",
          tags: ["FAQ", "折叠"],
          prompt:
            "Build an FAQ accordion: hairline-separated rows, each with a question and a plus/minus icon that rotates; only one open at a time. Answers in muted text. Left heading + right list on desktop.",
          code: `export function FaqList() {
  const [open, setOpen] = useState(0);
  const faqs = [
    { q: "多久能收到回复？", a: "通常 1 个工作日内回复，紧急问题请直接来电。" },
    { q: "支持远程合作吗？", a: "支持。我们 60% 的客户来自异地或海外。" },
    { q: "是否可以先做小范围试点？", a: "可以。我们提供 2 周的小规模试点合作。" },
  ];
  return (
    <section className="grid gap-10 px-6 py-16 lg:grid-cols-[1fr_2fr]">
      <div>
        <h2 className="text-3xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>常见问题</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>没有找到答案？直接联系我们。</p>
      </div>
      <div>
        {faqs.map((f, i) => (
          <div key={f.q} className="border-b" style={{ borderColor: "var(--border)" }}>
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between py-4 text-left">
              <span className="font-medium">{f.q}</span>
              <span className={"text-lg transition-transform " + (open === i ? "rotate-45" : "")} style={{ color: "var(--primary)" }}>+</span>
            </button>
            {open === i && <p className="pb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "单开折叠 + 加号旋转 45°",
        },
      ],
    },
  ],
};
