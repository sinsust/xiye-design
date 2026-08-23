// 定价页（Pricing）页面骨架数据。

import type { SkeletonPage } from "./types";

export const PRICING_PAGE: SkeletonPage = {
  id: "pricing",
  name: "定价页",
  icon: "Tags",
  description: "商业化核心页：定价卡片、对比表、FAQ，把访客推向付费",
  components: [
    {
      id: "pricing-tiers",
      name: "定价卡片",
      icon: "Tags",
      description: "多档套餐卡片，中间档高亮引导",
      variants: [
        {
          id: "ptiers_highlight",
          name: "三档 + 高亮",
          description: "免费/专业/企业，专业档高亮放大",
          tags: ["三档", "SaaS"],
          prompt:
            "Build a complete 3-tier pricing section: Free/Pro/Enterprise. Pro card is highlighted (primary border, scale-105, 'Most popular' badge). Each card: name, price, period, description, feature list with checkmarks, CTA. Section heading + subtext centered.",
          code: `export function PricingTiers() {
  const tiers = [
    { name: "免费版", price: "$0", period: "永久免费", desc: "个人试用与学习", features: ["3 个项目", "1 名成员", "500 次 API 调用/月", "社区支持"], cta: "{{cta.primary}}", popular: false },
    { name: "专业版", price: "$29", period: "每用户/月", desc: "成长型团队标配", features: ["无限项目", "10 名成员", "无限 API 调用", "优先工单支持", "高级分析"], cta: "立即升级", popular: true },
    { name: "企业版", price: "定制", period: "按需报价", desc: "大型组织与合规", features: ["SSO / SAML", "私有部署", "专属客户经理", "SLA 保障"], cta: "联系销售", popular: false },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold">{{nav.pricing}}简单透明</h2>
        <p className="mt-2" style={{ color: "var(--muted-foreground)" }}>按量计费，随时升级或降级，无需合同。</p>
      </div>
      <div className="mt-12 grid items-center gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className={["relative flex flex-col rounded-2xl border p-7", t.popular ? "scale-[1.03] shadow-2xl" : ""].join(" ")} style={{ borderColor: t.popular ? "var(--primary)" : "var(--border)", background: "var(--surface)" }}>
            {t.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3.5 py-1 text-xs font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
                最受欢迎
              </span>
            )}
            <p className="font-semibold">{t.name}</p>
            <p className="mt-3 text-4xl font-black">{t.price}</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{t.period} · {t.desc}</p>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--success)]">✓</span>{f}
                </li>
              ))}
            </ul>
            <a href="#signup" className={["mt-7 rounded-lg py-2.5 text-center text-sm font-medium transition", t.popular ? "text-[var(--on-primary)]" : "border hover:bg-[var(--surface)]"].join(" ")} style={t.popular ? { background: "var(--primary)" } : { borderColor: "var(--border)" }}>
              {t.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "热门档 scale-105 更突出；卡片 hover 上浮",
        },
        {
          id: "ptiers_billing",
          name: "月付/年付切换",
          description: "Toggle 切换价格，年付省 20%",
          tags: ["切换", "转化"],
          prompt:
            "Build pricing with monthly/yearly toggle: switch pill, prices animate on change, 'Save 20%' green badge on yearly. 3 tiers with different monthly/yearly prices.",
          code: `export function PricingTiers() {
  const [yearly, setYearly] = useState(true);
  const tiers = [
    { name: "基础版", m: 19, y: 15, features: ["5 个项目", "3 名成员"] },
    { name: "专业版", m: 49, y: 39, features: ["无限项目", "10 名成员", "优先支持"] },
    { name: "旗舰版", m: 99, y: 79, features: ["SSO", "专属经理", "SLA"] },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={!yearly ? "font-semibold" : ""} style={{ color: yearly ? "var(--muted-foreground)" : "var(--foreground)" }}>月付</span>
        <button onClick={() => setYearly(!yearly)} aria-pressed={yearly} className="relative h-6 w-11 rounded-full transition" style={{ background: "var(--primary)" }}>
          <span className={["absolute top-0.5 size-5 rounded-full bg-[var(--surface)] transition-all", yearly ? "left-[22px]" : "left-0.5"].join(" ")} />
        </button>
        <span className={yearly ? "font-semibold" : ""} style={{ color: !yearly ? "var(--muted-foreground)" : "var(--foreground)" }}>
          年付 <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--success) 14%, transparent)", color: "var(--success)" }}>省 20%</span>
        </span>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <p className="font-semibold">{t.name}</p>
            <p className="mt-2 text-3xl font-black">\${yearly ? t.y : t.m}<span className="text-sm font-normal" style={{ color: "var(--muted-foreground)" }}>/月</span></p>
            <ul className="mt-4 space-y-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2"><span className="text-[var(--success)]">✓</span>{f}</li>
              ))}
            </ul>
            <a href="#signup" className="mt-5 block rounded-lg py-2.5 text-center text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>选择 {t.name}</a>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "价格切换加过渡动画；按钮 aria-pressed 语义",
          motionId: "spring",
        },
        {
          id: "ptiers_single",
          name: "单档定价",
          description: "一个价格全部功能，工具型产品",
          tags: ["单档", "简洁"],
          prompt:
            "Build a single flat-price card: big price, feature list, strong CTA, guarantee note. Ideal for tools with one plan.",
          code: `export function PricingTiers() {
  return (
    <section className="mx-auto max-w-md px-6 py-20">
      <h2 className="text-center text-3xl font-bold">一个价格，全部功能</h2>
      <div className="mt-8 rounded-2xl border-2 p-8 text-center" style={{ borderColor: "var(--primary)", background: "var(--surface)" }}>
        <p className="text-5xl font-black">$19<span className="text-base font-normal" style={{ color: "var(--muted-foreground)" }}>/月</span></p>
        <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>包括所有功能，无隐藏费用，随时取消。</p>
        <a href="#signup" className="mt-6 block rounded-lg py-3 text-sm font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>{{cta.primary}}</a>
        <ul className="mt-6 space-y-2 text-left text-sm">
          {["无限项目", "所有集成", "优先支持", "7×24 监控"].map((f) => (
            <li key={f} className="flex items-center gap-2"><span className="text-[var(--success)]">✓</span>{f}</li>
          ))}
        </ul>
        <p className="mt-5 border-t pt-4 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>✓ 30 天退款保证</p>
      </div>
    </section>
  );
}`,
          interaction: "决策路径最短，适合极简{{nav.pricing}}",
        },
        {
          id: "ptiers_enterprise",
          name: "企业定制卡",
          description: "免费/专业 + 企业定制卡并排",
          tags: ["企业", "混合"],
          prompt:
            "Build 3 cards where the third is an enterprise card with different style (dark or bordered-dashed): 'Contact sales' CTA, custom features, no price.",
          code: `export function PricingTiers() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid items-stretch gap-6 md:grid-cols-3">
        <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="font-semibold">免费版</p>
          <p className="mt-2 text-3xl font-black">$0</p>
          <ul className="mt-4 space-y-2 text-sm">
            {["3 个项目", "1 名成员", "社区支持"].map((f) => (
              <li key={f} className="flex items-center gap-2"><span className="text-[var(--success)]">✓</span>{f}</li>
            ))}
          </ul>
          <a href="#signup" className="mt-5 block rounded-lg border py-2.5 text-center text-sm font-medium" style={{ borderColor: "var(--border)" }}>{{cta.primary}}</a>
        </div>
        <div className="rounded-2xl p-6 text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
          <p className="font-semibold">专业版</p>
          <p className="mt-2 text-3xl font-black">$29<span className="text-sm font-normal text-[var(--on-primary)]">/月</span></p>
          <ul className="mt-4 space-y-2 text-sm text-[var(--on-primary)]">
            {["无限项目", "10 名成员", "优先支持", "高级分析"].map((f) => (
              <li key={f} className="flex items-center gap-2"><span>✓</span>{f}</li>
            ))}
          </ul>
          <a href="#signup" className="mt-5 block rounded-lg bg-[var(--surface)] py-2.5 text-center text-sm font-medium text-[var(--foreground)]">立即升级</a>
        </div>
        <div className="flex flex-col rounded-2xl border border-dashed p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="font-semibold">企业版</p>
          <p className="mt-2 text-3xl font-black">定制</p>
          <ul className="mt-4 space-y-2 text-sm">
            {["SSO / SAML", "私有部署", "专属经理", "SLA 保障"].map((f) => (
              <li key={f} className="flex items-center gap-2"><span className="text-[var(--success)]">✓</span>{f}</li>
            ))}
          </ul>
          <a href="#sales" className="mt-5 block rounded-lg border py-2.5 text-center text-sm font-medium" style={{ borderColor: "var(--border)" }}>联系销售</a>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "专业版用主色实底卡，视觉焦点明确",
        },
      ],
    },
    {
      id: "pricing-compare",
      name: "功能对比表",
      icon: "Table",
      description: "完整横向对比，覆盖复杂套餐",
      variants: [
        {
          id: "pcomp_standard",
          name: "标准对比表",
          description: "功能行 × 套餐列，勾叉标记",
          tags: ["对比", "表格"],
          prompt:
            "Build a full pricing comparison table: rows are features grouped by category, columns are plans. Check/cross/dash marks, sticky first column on mobile scroll.",
          code: `export function PricingCompare() {
  const plans = ["免费版", "专业版", "企业版"];
  const groups = [
    { g: "基础", rows: [{ f: "项目数", v: ["3", "无限", "无限"] }, { f: "存储", v: ["1GB", "100GB", "1TB"] }] },
    { g: "协作", rows: [{ f: "成员数", v: ["1", "10", "不限"] }, { f: "实时协作", v: [false, true, true] }] },
    { g: "企业", rows: [{ f: "SSO", v: [false, false, true] }, { f: "私有部署", v: [false, false, true] }] },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <h2 className="text-center text-3xl font-bold">功能对比</h2>
      <div className="mt-8 overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <th className="p-4 text-left font-semibold">功能</th>
              {plans.map((p) => <th key={p} className="p-4 text-center font-semibold">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) => [
              <tr key={g.g} className="border-b" style={{ borderColor: "var(--border)" }}>
                <td colSpan={4} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]" style={{ background: "color-mix(in srgb, var(--surface) 40%, transparent)" }}>{g.g}</td>
              </tr>,
              ...g.rows.map((r) => (
                <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                  <td className="p-4">{r.f}</td>
                  {r.v.map((v, i) => (
                    <td key={i} className="p-4 text-center">{v === true ? "✓" : v === false ? "—" : v}</td>
                  ))}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
    </section>
  );
}`,
          interaction: "功能分组行增强可读性；移动端横向滚动",
        },
        {
          id: "pcomp_highlight",
          name: "高亮列对比",
          description: "推荐套餐列加高亮底色",
          tags: ["对比", "推荐"],
          prompt:
            "Build a comparison table with one highlighted column (Pro): primary-tinted background column, 'Most popular' badge in header.",
          code: `export function PricingCompare() {
  const plans = ["免费版", "专业版", "企业版"];
  const rows = [
    { f: "项目数", v: ["3", "无限", "无限"] },
    { f: "成员", v: ["1", "10", "不限"] },
    { f: "高级分析", v: [false, true, true] },
    { f: "SSO", v: [false, false, true] },
  ];
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className="p-4 text-left font-semibold">功能</th>
              {plans.map((p, i) => (
                <th key={p} className={"p-4 text-center font-semibold " + (i === 1 ? "bg-primary/10" : "")}>
                  {p}
                  {i === 1 && <span className="mt-1 block rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-[var(--on-primary)]">最受欢迎</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-4">{r.f}</td>
                {r.v.map((v, i) => (
                  <td key={i} className={"p-4 text-center " + (i === 1 ? "bg-primary/10" : "")}>{v === true ? "✓" : v === false ? "—" : v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}`,
          interaction: "高亮列引导视线到推荐套餐",
        },
        {
          id: "pcomp_dark",
          name: "深色对比表",
          description: "深底对比，B2B 企业站风格",
          tags: ["深色", "企业"],
          prompt:
            "Build a dark comparison table: slate-900 background, white text, white/10 borders, checkmarks in green-400.",
          code: `export function PricingCompare() {
  const plans = ["Starter", "Growth", "Scale"];
  const rows = [
    { f: "Seats", v: ["3", "10", "Unlimited"] },
    { f: "Analytics", v: [false, true, true] },
    { f: "SSO", v: [false, false, true] },
  ];
  return (
    <section className="bg-[var(--background)] px-6 py-20 text-[var(--foreground)]">
      <div className="mx-auto max-w-4xl overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="p-4 text-left font-semibold">Features</th>
              {plans.map((p) => <th key={p} className="p-4 text-center font-semibold">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f} className="border-b border-[var(--border)] last:border-0">
                <td className="p-4 text-[var(--muted-foreground)]">{r.f}</td>
                {r.v.map((v, i) => (
                  <td key={i} className="p-4 text-center">{v === true ? <span className="text-[var(--success)]">✓</span> : v === false ? <span className="text-[var(--muted-foreground)]">—</span> : v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}`,
          interaction: "与深色 Hero/Footer 搭配成完整暗色系",
        },
        {
          id: "pcomp_editorial",
          name: "编辑式对比",
          description: "衬线标题 + 细线行式对比",
          tags: ["编辑", "对比", "刊物"],
          prompt:
            "Build an editorial comparison: not a boxed table but hairline-divided rows with a serif headline plan row and uppercase feature label. Quiet, magazine-like index.",
          code: `export function EditorialCompare() {
  const plans = ["免费版", "专业版", "企业版"];
  const rows = [
    { f: "项目数", v: ["3", "无限", "无限"] },
    { f: "成员", v: ["1", "10", "不限"] },
    { f: "高级分析", v: [false, true, true] },
    { f: "SSO", v: [false, false, true] },
  ];
  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <div className="flex items-baseline justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}>
        <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>功能</span>
        <div className="flex gap-10">{plans.map((p, i) => <span key={p} className="w-16 text-center text-lg font-semibold" style={{ fontFamily: "var(--font-heading)", color: i === 1 ? "var(--primary)" : "var(--foreground)" }}>{p}</span>)}</div>
      </div>
      {rows.map((r) => (
        <div key={r.f} className="flex items-center justify-between border-b py-4" style={{ borderColor: "var(--border)" }}>
          <span className="text-sm font-medium">{r.f}</span>
          <div className="flex gap-10">{r.v.map((v, i) => <span key={i} className="w-16 text-center" style={{ fontFamily: "var(--font-heading)", color: i === 1 ? "var(--primary)" : "var(--foreground)" }}>{v === true ? "✓" : v === false ? "—" : v}</span>)}</div>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "衬线计划行、细线串联、无表格边框",
        },
        {
          id: "pcomp_bento",
          name: "Bento 卡片矩阵",
          description: "每套餐一张勾选功能卡",
          tags: ["Bento", "对比", "卡片"],
          prompt:
            "Build a bento plan comparison: instead of a table, each plan is a card with its own checklist of included features, the recommended one with a primary ring. Playful, editorial.",
          code: `export function BentoCompare() {
  const plans = [
    { p: "免费版", price: "¥0", f: ["3 个项目", "1GB 存储", "基础支持"], hot: false },
    { p: "专业版", price: "¥39", f: ["无限项目", "100GB 存储", "高级分析", "优先支持"], hot: true },
    { p: "企业版", price: "定制", f: ["SSO", "私有部署", "专属顾问"], hot: false },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((x) => (
          <div key={x.p} className={"rounded-2xl p-5 " + (x.hot ? "ring-2" : "border")} style={x.hot ? { background: "color-mix(in srgb, var(--primary) 8%, var(--surface))", boxShadow: "0 0 0 2px var(--primary)" } : { borderColor: "var(--border)", background: "var(--surface)" }}>
            {x.hot && <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-medium text-[var(--on-primary)]">最受欢迎</span>}
            <h3 className="mt-2 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{x.p}</h3>
            <p className="mt-1 text-2xl font-bold">{x.price}<span className="text-sm font-normal text-muted-foreground">/月</span></p>
            <ul className="mt-4 space-y-1.5 text-sm">{x.f.map((n) => <li key={n} className="flex items-center gap-2"><span style={{ color: "var(--primary)" }}>✓</span>{n}</li>)}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "卡片自含清单、推荐卡主色描边",
        },
        {
          id: "pcomp_neon",
          name: "霓虹对比",
          description: "深底霓虹高亮列，创意感",
          tags: ["霓虹", "暗黑", "对比"],
          prompt:
            "Build a neon comparison on a dark canvas: near-black table with a cyan-highlighted plan column, diamond glyphs for included, muted dots for absent. Playful agency energy.",
          code: `export function NeonCompare() {
  const plans = ["基础", "创意", "无限"];
  const rows = [
    { f: "项目数", v: ["3", "无限", "无限"] },
    { f: "模板库", v: [false, true, true] },
    { f: "动效库", v: [false, true, true] },
  ];
  return (
    <section className="px-6 py-20 text-[var(--foreground)]" style={{ background: "var(--background)" }}>
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: "var(--border)" }}>
              <th className="p-4 text-left font-semibold text-[var(--muted-foreground)]">功能</th>
              {plans.map((p, i) => <th key={p} className="p-4 text-center font-semibold" style={{ color: i === 1 ? "var(--primary)" : "inherit" }}>{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.f} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
                <td className="p-4 text-[var(--muted-foreground)]">{r.f}</td>
                {r.v.map((v, i) => <td key={i} className="p-4 text-center" style={{ color: i === 1 ? "var(--primary)" : "inherit" }}>{v === true ? "◆" : v === false ? "·" : v}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}`,
          interaction: "深底霓虹列、◆ 激活 / · 缺失",
        },
      ],
    },
    {
      id: "pricing-faq",
      name: "定价 FAQ",
      icon: "MessageCircleQuestion",
      description: "解答计费/退款疑问，降低决策阻力",
      variants: [
        {
          id: "pfaq_single",
          name: "单选展开",
          description: "一次开一条，克制清晰",
          tags: ["手风琴", "计费"],
          prompt:
            "Build pricing {{nav.faq}} with accordion: questions about billing, refunds, upgrades. Single-open behavior.",
          code: `export function PricingFaq() {
  const items = [
    { q: "可以随时升级吗？", a: "可以，升级立即生效，按天差额计费。" },
    { q: "有退款保证吗？", a: "专业版提供 30 天无理由退款。" },
    { q: "发票怎么开？", a: "支持增值税发票，设置页一键申请。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <h2 className="text-center text-3xl font-bold">计费相关</h2>
      <div className="mt-8 divide-y rounded-xl border" style={{ borderColor: "var(--border)" }}>
        {items.map((f, i) => (
          <div key={f.q}>
            <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
              {f.q}
              <span className={"transition-transform " + (open === i ? "rotate-180" : "")}>▾</span>
            </button>
            {open === i && <p className="px-5 pb-4 text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        还有问题？<a href="#contact" style={{ color: "var(--primary)" }}>联系我们</a>
      </p>
    </section>
  );
}`,
          interaction: "单开手风琴 + 底部联系引导",
        },
        {
          id: "pfaq_twocol",
          name: "双列静态",
          description: "两栏 Q&A，无需交互",
          tags: ["双列", "简洁"],
          prompt:
            "Build a two-column static pricing {{nav.faq}}: heading left, questions right in two columns, no accordion.",
          code: `export function PricingFaq() {
  const items = [
    { q: "支持哪些支付方式？", a: "信用卡、PayPal、支付宝与对公转账。" },
    { q: "有年度折扣吗？", a: "年付享 8 折，按年一次性扣款。" },
    { q: "如何取消？", a: "设置页一键取消，订阅到期后不再扣费。" },
    { q: "支持多币种吗？", a: "支持 USD / EUR / CNY 结算。" },
  ];
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <div className="grid gap-10 md:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="text-3xl font-bold">计费 {{nav.faq}}</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>常见计费问题快速解答</p>
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
          interaction: "静态布局，信息一目了然",
        },
        {
          id: "pfaq_dark",
          name: "深色 {{nav.faq}}",
          description: "深底浅字，配合深色{{nav.pricing}}区",
          tags: ["深色", "品牌"],
          prompt:
            "Build a dark pricing {{nav.faq}}: slate-900 background, light accordion items with white/10 borders.",
          code: `export function PricingFaq() {
  const items = [
    { q: "升级后何时生效？", a: "立即生效，老套餐剩余价值自动抵扣。" },
    { q: "支持对公付款吗？", a: "支持，联系销售开具企业合同。" },
  ];
  const [open, setOpen] = useState(0);
  return (
    <section className="bg-[var(--background)] px-6 py-20 text-[var(--foreground)]">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-center text-3xl font-bold">常见计费问题</h2>
        <div className="mt-8 space-y-3">
          {items.map((f, i) => (
            <div key={f.q} className="rounded-xl border border-[var(--border)]">
              <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between px-5 py-4 text-left font-medium">
                {f.q}
                <span className={"transition-transform text-[var(--muted-foreground)] " + (open === i ? "rotate-180" : "")}>▾</span>
              </button>
              {open === i && <p className="px-5 pb-4 text-sm text-[var(--muted-foreground)]">{f.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "与深色对比表/CTA 视觉闭环",
        },
        {
          id: "pfaq_editorial",
          name: "编辑式定价 FAQ",
          description: "衬线标题 + 左问右答细线成对",
          tags: ["FAQ", "编辑", "衬线"],
          prompt:
            "Build an editorial pricing FAQ: a serif heading, then a hairline-divided list where each question sits on the left and its answer on the right. Quiet magazine tone.",
          code: `export function EditorialFaq() {
  const rows = [
    { q: "免费版有什么限制？", a: "支持 3 个项目与 1 名成员。" },
    { q: "可以随时升级吗？", a: "升级即时生效，按天计费。" },
    { q: "数据安全吗？", a: "端到端加密，支持 SOC2 报告。" },
  ];
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>定价 FAQ</p>
      <h2 className="mt-2 text-3xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>常见问题</h2>
      <div className="mt-8 border-t" style={{ borderColor: "var(--border)" }}>
        {rows.map((f) => (
          <div key={f.q} className="grid gap-2 border-b py-5 sm:grid-cols-[1fr_1.2fr]" style={{ borderColor: "var(--border)" }}>
            <p className="text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{f.q}</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{f.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}`,
          interaction: "衬线标题、问与答细线左右成对",
        },
        {
          id: "pfaq_neon",
          name: "霓虹定价 FAQ",
          description: "深底霓虹高亮问答",
          tags: ["FAQ", "霓虹", "暗黑"],
          prompt:
            "Build a neon pricing FAQ: on a dark canvas, question rows with a cyan accent on the question and a dimmed answer, hairline separators. Bold agency energy.",
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
              <p className="text-base font-semibold" style={{ color: "var(--primary)" }}>{f.q}</p>
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
  ],
};
