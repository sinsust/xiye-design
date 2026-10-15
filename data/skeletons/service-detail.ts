// 服务详情（Service Detail）· 业务专属功能页骨架。
//
// 本页是服务撮合的「商品详情页」：服务介绍 + 规格档位 + 真实评价 +
// 预约下单表单（含校验）。code 里带可运行的 mock 数据与交互状态，
// 使交付工程解压即可看到完整的服务详情与下单流程。

import type { SkeletonPage } from "./types";

export const SERVICE_DETAIL_PAGE: SkeletonPage = {
  id: "service-detail",
  name: "服务详情",
  icon: "Store",
  description: "业务页骨架：服务介绍、规格档位、评价与预约下单，含表单校验",
  components: [
    {
      id: "svc-hero",
      name: "服务介绍",
      icon: "Sparkles",
      description: "服务名 / 评分 / 销量 / 标签 / 头图区",
      variants: [
        {
          id: "sh_split",
          name: "左右分栏",
          description: "左图右信息，桌面优先",
          tags: ["分栏", "桌面", "标准"],
          prompt:
            "Build a service hero section with split layout: left is a rounded image placeholder with a service-type badge, right shows service title, rating with stars, monthly sales, price from, and a row of feature tags.",
          code: `export default function ServiceHero() {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">🧽</div>
        <span className="absolute left-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          保洁
        </span>
      </div>
      <div className="space-y-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">全屋深度保洁</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-warning">★★★★★</span>
          <span>4.9</span>
          <span>·</span>
          <span>月售 1,204</span>
        </div>
        <p className="text-xl font-bold text-primary">¥180 <span className="text-xs font-normal text-muted-foreground">起</span></p>
        <div className="flex flex-wrap gap-1.5">
          {["持证上岗", "工具自带", "不满意重做", "准时上门"].map((t) => (
            <span key={t} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}`,
          interaction: "评星与标签静态展示；头图支持替换真实图片",
        },
        {
          id: "sh_stack",
          name: "上下堆叠",
          description: "图在上信息在下，移动优先",
          tags: ["堆叠", "移动友好"],
          prompt:
            "Build a stacked service hero: full-width rounded image placeholder on top, then title, rating, sales, price and tag row below. Optimize for a 375px viewport with comfortable spacing.",
          code: `export default function ServiceHeroStacked() {
  return (
    <div className="space-y-4">
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-40">🧽</div>
        <span className="absolute left-3 top-3 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          保洁
        </span>
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-foreground">全屋深度保洁</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-warning">★★★★★</span>
          <span>4.9 · 月售 1,204</span>
        </div>
        <p className="text-lg font-bold text-primary">¥180 起</p>
        <div className="flex flex-wrap gap-1.5">
          {["持证上岗", "工具自带", "不满意重做"].map((t) => (
            <span key={t} className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}`,
          interaction: "单列布局，手机上无需横向滚动",
        },
      ],
    },
    {
      id: "svc-tiers",
      name: "规格档位",
      icon: "Layers",
      description: "基础 / 标准 / 尊享 三档可选规格与价格",
      variants: [
        {
          id: "st_cards",
          name: "三档卡片",
          description: "并排卡片，推荐档位高亮",
          tags: ["规格", "价格", "业务"],
          prompt:
            "Build three service tier cards (基础 / 标准 / 尊享): each with name, price, a short list of inclusions, and a select button. Highlight the recommended middle tier with a primary border and a '推荐' ribbon.",
          code: `"use client";

import { useState } from "react";

const TIERS = [
  { id: "basic", name: "基础", price: 180, perks: ["全屋清扫", "地面拖洗", "垃圾清理"], recommended: false },
  { id: "standard", name: "标准", price: 260, perks: ["含基础项", "厨房去油", "卫浴除垢"], recommended: true },
  { id: "premium", name: "尊享", price: 380, perks: ["含标准项", "擦玻璃", "家电表面养护"], recommended: false },
];

export default function ServiceTiers() {
  const [picked, setPicked] = useState("standard");

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {TIERS.map((t) => (
        <div
          key={t.id}
          className={[
            "rounded-xl border bg-card p-4 transition",
            picked === t.id ? "border-primary" : "border-border",
            t.recommended ? "ring-1 ring-primary/30" : "",
          ].join(" ")}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t.name}</p>
            {t.recommended && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">推荐</span>
            )}
          </div>
          <p className="mt-1 text-xl font-bold text-primary">¥{t.price}</p>
          <ul className="mt-2 space-y-1">
            {t.perks.map((p) => (
              <li key={p} className="text-[11px] text-muted-foreground">
                · {p}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPicked(t.id)}
            className={[
              "mt-3 w-full rounded-lg px-3 py-1.5 text-xs font-medium transition",
              picked === t.id
                ? "bg-primary text-primary-foreground"
                : "border border-border text-foreground hover:bg-muted",
            ].join(" ")}
          >
            {picked === t.id ? "已选" : "选择"}
          </button>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "点击切换选中档位；推荐档默认选中并带光环",
        },
      ],
    },
    {
      id: "svc-reviews",
      name: "用户评价",
      icon: "MessageSquareQuote",
      description: "评分摘要 + 评价列表（含标签与图片位）",
      variants: [
        {
          id: "sr_list",
          name: "标准评价列表",
          description: "评分分布 + 卡片式评价",
          tags: ["评价", "业务", "标准"],
          prompt:
            "Build a review section: left summary with average score, star distribution bars and total count; right a list of review cards with avatar, masked nickname, rating, date, content, service spec tag and thumbnail placeholders.",
          code: `export default function ServiceReviews() {
  const dist = [
    { star: 5, pct: 82 },
    { star: 4, pct: 12 },
    { star: 3, pct: 4 },
    { star: 2, pct: 1 },
    { star: 1, pct: 1 },
  ];
  const reviews = [
    { id: "1", who: "王**", rating: 5, date: "2026-10-08", spec: "标准", text: "师傅很准时，厨房油污处理得很干净，会再约。" },
    { id: "2", who: "陈**", rating: 4, date: "2026-10-05", spec: "基础", text: "整体满意，阳台角落希望下次更仔细些。" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-[220px_1fr]">
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-3xl font-bold text-foreground">4.9</p>
        <p className="mt-1 text-xs text-muted-foreground">共 1,204 条评价</p>
        <div className="mt-3 space-y-1.5">
          {dist.map((d) => (
            <div key={d.star} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="w-6">{d.star}星</span>
              <div className="h-1 flex-1 rounded-full bg-muted">
                <div className="h-1 rounded-full bg-warning" style={{ width: d.pct + "%" }} />
              </div>
              <span className="w-7 text-right">{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {r.who.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{r.who}</p>
                <p className="text-[10px] text-muted-foreground">{r.date} · {r.spec}</p>
              </div>
              <span className="text-xs text-warning">{"★".repeat(r.rating)}</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}`,
          interaction: "评分分布可视；评价内容脱敏展示",
        },
      ],
    },
    {
      id: "svc-booking",
      name: "预约下单",
      icon: "CalendarCheck",
      description: "规格 + 数量 + 期望时间 + 备注，含必填校验与提交反馈",
      variants: [
        {
          id: "sb_form",
          name: "表单下单",
          description: "必填校验 + 提交态反馈",
        tags: ["表单", "校验", "业务"],
          prompt:
            "Build a booking form: spec selector (from service tiers), quantity stepper, date-time picker for expected visit, remark textarea, and a submit button. Validate required fields inline, disable submit while submitting, and show a success confirmation panel after submit.",
          code: `"use client";

import { useState } from "react";

const SPECS = [
  { id: "basic", label: "基础", price: 180 },
  { id: "standard", label: "标准", price: 260 },
  { id: "premium", label: "尊享", price: 380 },
];

export default function ServiceBooking() {
  const [spec, setSpec] = useState("standard");
  const [qty, setQty] = useState(1);
  const [when, setWhen] = useState("");
  const [remark, setRemark] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const price = SPECS.find((s) => s.id === spec)?.price ?? 0;
  const total = price * qty;

  const submit = async () => {
    if (!when) {
      setErr("请选择期望上门时间");
      return;
    }
    setErr("");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600));
    setBusy(false);
    setDone(true);
  };

  if (done) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-5 text-center">
        <p className="text-sm font-semibold text-success">预约已提交</p>
        <p className="mt-1 text-xs text-muted-foreground">服务商将在 30 分钟内确认，请留意通知。</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">规格</p>
        <div className="flex flex-wrap gap-1.5">
          {SPECS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSpec(s.id)}
              className={[
                "rounded-full border px-3 py-1 text-[11px] transition",
                spec === s.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/60",
              ].join(" ")}
            >
              {s.label} ¥{s.price}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">数量</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="flex size-7 items-center justify-center rounded-md border border-border text-sm text-foreground transition hover:bg-muted"
          >
            −
          </button>
          <span className="w-6 text-center text-sm text-foreground tabular-nums">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="flex size-7 items-center justify-center rounded-md border border-border text-sm text-foreground transition hover:bg-muted"
          >
            +
          </button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">期望上门时间</p>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-primary"
        />
        {err && <p className="mt-1 text-[11px] text-destructive">{err}</p>}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-foreground">备注</p>
        <textarea
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          rows={3}
          placeholder="例如：家中有宠物，请自带鞋套…"
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground outline-none transition focus:border-primary"
        />
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">
          合计 <span className="text-base font-bold text-primary tabular-nums">¥{total}</span>
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "提交中…" : "立即预约"}
        </button>
      </div>
    </div>
  );
}`,
          interaction: "必填校验内联提示；提交后切换为确认面板",
        },
      ],
    },
  ],
};
