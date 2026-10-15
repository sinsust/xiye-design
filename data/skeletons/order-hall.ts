// 接单大厅（Order Hall）· 业务专属功能页骨架。
//
// 与 home / pricing 这类「通用视觉页」不同，本页承载真实业务语义：
// 供方（师傅/服务者）在此浏览待接订单、按条件筛选、抢单/接单。
// 因此组件 code 里带有 mock 数据流与状态流转，而不是纯装饰性占位，
// 使交付 zip 解压后可直接看到有业务含义的界面。

import type { SkeletonPage } from "./types";

export const ORDER_HALL_PAGE: SkeletonPage = {
  id: "order-hall",
  name: "接单大厅",
  icon: "ClipboardList",
  description: "业务页骨架：待接订单筛选、列表与抢单操作，含状态与数据流",
  components: [
    {
      id: "hall-filter",
      name: "筛选栏",
      icon: "SlidersHorizontal",
      description: "按服务类型/距离/预算/时间筛选待接订单",
      variants: [
        {
          id: "hf_chips",
          name: "标签筛选",
          description: "横向标签 + 排序下拉，轻量紧凑",
          tags: ["标签", "紧凑", "移动友好"],
          prompt:
            "Build an order filter bar: horizontally scrollable chips for service categories (all, cleaning, repair, installation), a distance range, a budget range, and a sort dropdown (newest / nearest / highest pay). Selected chip uses primary tint; keep it one row on mobile with horizontal scroll.",
          code: `"use client";

import { useState } from "react";

const CATEGORIES = [
  { id: "all", label: "全部" },
  { id: "cleaning", label: "保洁" },
  { id: "repair", label: "维修" },
  { id: "install", label: "安装" },
  { id: "moving", label: "搬运" },
];

const SORTS = [
  { id: "newest", label: "最新发布" },
  { id: "nearest", label: "距离最近" },
  { id: "pay", label: "报酬最高" },
];

export default function HallFilter({ onChange }) {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("newest");

  const pick = (id) => {
    setCat(id);
    onChange?.({ category: id, sort });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => pick(c.id)}
            className={[
              "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors",
              cat === c.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/60",
            ].join(" ")}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">排序</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            onChange?.({ category: cat, sort: e.target.value });
          }}
          className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
            {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}`,
          interaction: "点击标签即时筛选；移动端横向滚动不换行",
        },
        {
          id: "hf_panel",
          name: "侧栏筛选面板",
          description: "桌面端多条件并排筛选",
          tags: ["面板", "多条件", "桌面"],
          prompt:
            "Build a sidebar filter panel: grouped checkboxes for service type, radio for distance radius (1km/3km/5km/10km), dual-handle budget slider, and applied-filter chips with a clear-all button.",
          code: `export default function HallFilterPanel() {
  return (
    <aside className="w-60 shrink-0 space-y-5 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">服务类型</p>
        <div className="space-y-1.5">
          {["保洁", "维修", "安装", "搬运"].map((t) => (
            <label key={t} className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" className="size-3.5 rounded border-border" />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">距离</p>
        <div className="space-y-1.5">
          {["1km 内", "3km 内", "5km 内", "10km 内"].map((d, i) => (
            <label key={d} className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="radio" name="dist" defaultChecked={i === 1} className="size-3.5" />
              <span>{d}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-foreground">预算</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>¥0</span>
          <div className="h-1 flex-1 rounded-full bg-muted">
            <div className="h-1 w-1/2 rounded-full bg-primary" />
          </div>
          <span>¥500+</span>
        </div>
      </div>
    </aside>
  );
}`,
          interaction: "多条件叠加；已选条件以 chip 展示可单独移除",
        },
      ],
    },
    {
      id: "hall-list",
      name: "订单卡片列表",
      icon: "ListOrdered",
      description: "待接订单卡片：类型/地址/预算/时间/距离 + 抢单按钮",
      variants: [
        {
          id: "hl_card",
          name: "标准卡片",
          description: "信息分层卡片，主操作在右下",
          tags: ["卡片", "标准", "信息密度中"],
          prompt:
            "Build an order card list for a service marketplace: each card shows service type badge, masked address (e.g. 朝阳区·望京 SOHO), budget, expected time, distance, and a primary '抢单' button bottom-right. Show an urgency tag for orders expiring soon.",
          code: `"use client";

import { useState } from "react";

const ORDERS = [
  { id: "1", type: "深度保洁", area: "朝阳区·望京", budget: 260, time: "今天 18:00", dist: "1.2km", urgent: true },
  { id: "2", type: "空调维修", area: "海淀区·中关村", budget: 180, time: "明天 10:00", dist: "2.8km", urgent: false },
  { id: "3", type: "家具安装", area: "西城区·金融街", budget: 320, time: "明天 14:00", dist: "3.5km", urgent: false },
];

export default function HallList() {
  const [taken, setTaken] = useState([]);

  const isTaken = (id) => taken.includes(id);

  return (
    <div className="space-y-3">
      {ORDERS.map((o) => (
        <div key={o.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">{o.type}</span>
                {o.urgent && (
                  <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">急</span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{o.area} · {o.dist}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-primary">¥{o.budget}</p>
              <p className="text-[11px] text-muted-foreground">{o.time}</p>
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={isTaken(o.id)}
              onClick={() => setTaken((p) => [...p, o.id])}
              className={[
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                isTaken(o.id)
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              ].join(" ")}
            >
              {isTaken(o.id) ? "已接单" : "抢单"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "抢单后按钮变「已接单」并禁用；状态本地即时反馈",
        },
        {
          id: "hl_compact",
          name: "紧凑行列表",
          description: "单行高密度，适合扫选",
          tags: ["行", "高密度", "桌面"],
          prompt:
            "Build a compact order list: one row per order with type, masked area, budget, time, and a small action button aligned right. Use dividers instead of cards, and a subtle hover background.",
          code: `"use client";

import { useState } from "react";

const ROWS = [
  { id: "1", type: "深度保洁", area: "朝阳区·望京", budget: 260, time: "今天 18:00" },
  { id: "2", type: "空调维修", area: "海淀区·中关村", budget: 180, time: "明天 10:00" },
  { id: "3", type: "家具安装", area: "西城区·金融街", budget: 320, time: "明天 14:00" },
];

export default function HallListCompact() {
  const [taken, setTaken] = useState([]);

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {ROWS.map((o) => (
        <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-muted/50">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{o.type}</p>
            <p className="truncate text-[11px] text-muted-foreground">{o.area} · {o.time}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-bold text-primary">¥{o.budget}</span>
            <button
              type="button"
              disabled={taken.includes(o.id)}
              onClick={() => setTaken((p) => [...p, o.id])}
              className={[
                "rounded-lg px-2.5 py-1 text-[11px] font-medium transition",
                taken.includes(o.id)
                  ? "bg-muted text-muted-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90",
              ].join(" ")}
            >
              {taken.includes(o.id) ? "已接" : "抢单"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "hover 整行高亮；右侧操作常驻",
        },
      ],
    },
    {
      id: "hall-empty",
      name: "空状态",
      icon: "Inbox",
      description: "无匹配订单时的引导",
      variants: [
        {
          id: "he_guide",
          name: "引导型空状态",
          description: "说明原因 + 给出下一步动作",
          tags: ["空状态", "引导"],
          prompt:
            "Build a guide-style empty state: an icon, a short headline '附近暂时没有新订单', an explanation that orders appear when customers nearby post requests, and two actions — widen the distance radius and enable new-order notifications.",
          code: `export default function HallEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-lg">📭</span>
      <p className="text-sm font-medium text-foreground">附近暂时没有新订单</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        当有客户在你服务范围内发布需求时，订单会出现在这里。可以先放宽距离，或开启新单提醒。
      </p>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
          放宽到 10km
        </button>
        <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs text-foreground transition hover:bg-muted">
          开启新单提醒
        </button>
      </div>
    </div>
  );
}`,
          interaction: "两个动作按钮均为主路径引导，不使用破坏性样式",
        },
      ],
    },
  ],
};
