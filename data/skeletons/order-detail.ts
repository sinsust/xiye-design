// 订单详情（Order Detail）· 业务专属功能页骨架。
//
// 本页是服务撮合业务的「单据中心」：状态机时间轴 + 客户信息 + 服务项 +
// 按当前状态可用的操作。code 里带可运行的 mock 数据与状态流转，
// 使交付工程解压即可看到完整的业务单据界面。

import type { SkeletonPage } from "./types";

export const ORDER_DETAIL_PAGE: SkeletonPage = {
  id: "order-detail",
  name: "订单详情",
  icon: "FileText",
  description: "业务页骨架：订单状态机、客户信息、服务项与操作区，含状态流转",
  components: [
    {
      id: "detail-timeline",
      name: "状态时间轴",
      icon: "GitCommitVertical",
      description: "订单状态机：待接单 → 已接单 → 服务中 → 已完成 → 已评价",
      variants: [
        {
          id: "dt_vertical",
          name: "纵向时间轴",
          description: "左侧圆点 + 连接线，当前节点高亮",
          tags: ["时间轴", "状态机", "标准"],
          prompt:
            "Build a vertical order status timeline: five steps (待接单, 已接单, 服务中, 已完成, 已评价), each with a circle marker and connecting line. Completed steps filled with primary, current step ring-highlighted, pending steps muted. Show a timestamp under each completed step.",
          code: `"use client";

const STEPS = ["待接单", "已接单", "服务中", "已完成", "已评价"];
const TIMES = ["", "今天 14:02", "今天 15:30", "", ""];

export default function OrderTimeline({ current = 2 }) {
  return (
    <ol className="space-y-0">
      {STEPS.map((s, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={[
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition",
                  done ? "bg-primary text-primary-foreground" : "",
                  now ? "border-2 border-primary text-primary" : "",
                  !done && !now ? "border border-border text-muted-foreground" : "",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className={["w-px flex-1", done ? "bg-primary" : "bg-border"].join(" ")} />
              )}
            </div>
            <div className={["pb-5", i === STEPS.length - 1 ? "" : ""].join(" ")}>
              <p
                className={[
                  "text-xs font-medium",
                  done || now ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {s}
              </p>
              {TIMES[i] && <p className="text-[10px] text-muted-foreground">{TIMES[i]}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}`,
          interaction: "已完成节点主色填充；当前节点描边强调；未达节点弱化",
        },
        {
          id: "dt_stepper",
          name: "横向步骤条",
          description: "顶部横向进度，适合窄屏概览",
          tags: ["步骤条", "横向", "移动友好"],
          prompt:
            "Build a horizontal order stepper: five steps with connecting progress bar, completed in primary, upcoming in muted grey, current step bold with a pulsing ring. Labels stay legible on a 375px screen.",
          code: `export default function OrderStepper({ current = 2 }) {
  const steps = ["待接单", "已接单", "服务中", "已完成", "已评价"];
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <span
              className={[
                "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                i < current ? "bg-primary text-primary-foreground" : "",
                i === current ? "border-2 border-primary text-primary" : "",
                i > current ? "border border-border text-muted-foreground" : "",
              ].join(" ")}
            >
              {i < current ? "✓" : i + 1}
            </span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{s}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={["mx-1 h-px flex-1", i < current ? "bg-primary" : "bg-border"].join(" ")} />
          )}
        </div>
      ))}
    </div>
  );
}`,
          interaction: "进度条随状态推进；当前节点脉冲提示",
        },
      ],
    },
    {
      id: "detail-customer",
      name: "客户信息卡",
      icon: "User",
      description: "脱敏展示客户信息，接单后才可查看完整联系方式",
      variants: [
        {
          id: "dc_masked",
          name: "脱敏卡片",
          description: "默认脱敏，接单后解锁",
          tags: ["脱敏", "隐私", "业务"],
          prompt:
            "Build a masked customer card: avatar, nickname '李**', masked address '朝阳区·望京 SOHO T1 · 12层', and a locked contact row showing '接单后可见'. Include an unlock button that reveals the phone once the order is accepted.",
          code: `"use client";

import { useState } from "react";

export default function CustomerCard({ accepted = false }) {
  const [revealed, setRevealed] = useState(false);
  const show = accepted && revealed;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">李</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">李**</p>
          <p className="truncate text-[11px] text-muted-foreground">朝阳区·望京 SOHO T1 · 12层</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
        <span className="text-xs text-muted-foreground">
          {show ? "138****8000" : accepted ? "点击查看联系方式" : "接单后可见"}
        </span>
        <button
          type="button"
          disabled={!accepted}
          onClick={() => setRevealed(true)}
          className={[
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
            accepted ? "bg-primary text-primary-foreground hover:opacity-90" : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {show ? "已显示" : "查看"}
        </button>
      </div>
    </div>
  );
}`,
          interaction: "未接单时禁用；接单后点击才揭示，符合最小可见原则",
        },
      ],
    },
    {
      id: "detail-items",
      name: "服务项清单",
      icon: "Package",
      description: "服务项 / 数量 / 单价 / 小计与合计",
      variants: [
        {
          id: "di_table",
          name: "清单表格",
          description: "结构化明细 + 合计",
          tags: ["明细", "金额", "业务"],
          prompt:
            "Build a service item list for an order: rows with item name, spec, unit price, quantity and subtotal; a summary block showing service fee, travel fee, discount and total payable. Use tabular numbers and right-align amounts.",
          code: `"use client";

const ITEMS = [
  { name: "深度保洁", spec: "3室2厅 · 120㎡", price: 180, qty: 1 },
  { name: "擦玻璃", spec: "双面 · 8扇", price: 60, qty: 1 },
  { name: "油烟机清洗", spec: "拆洗", price: 120, qty: 1 },
];

export default function ServiceItems() {
  const subtotal = ITEMS.reduce((s, i) => s + i.price * i.qty, 0);
  const travel = 20;
  const discount = 30;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="divide-y divide-border">
        {ITEMS.map((i) => (
          <div key={i.name} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{i.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{i.spec}</p>
            </div>
            <div className="shrink-0 text-right text-xs text-muted-foreground">
              ¥{i.price} × {i.qty}
            </div>
            <div className="w-16 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
              ¥{i.price * i.qty}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5 border-t border-border bg-muted/30 px-4 py-3 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>服务费</span>
          <span className="tabular-nums">¥{subtotal}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>上门费</span>
          <span className="tabular-nums">¥{travel}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>优惠</span>
          <span className="tabular-nums">−¥{discount}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-1.5 text-sm font-semibold text-foreground">
          <span>应付</span>
          <span className="tabular-nums text-primary">¥{subtotal + travel - discount}</span>
        </div>
      </div>
    </div>
  );
}`,
          interaction: "金额右对齐等宽数字；合计独立区块强调",
        },
      ],
    },
    {
      id: "detail-actions",
      name: "操作区",
      icon: "MousePointerClick",
      description: "按订单状态给出可执行动作（抢单/开始服务/完成/取消）",
      variants: [
        {
          id: "da_sticky",
          name: "底部固定操作条",
          description: "移动端常驻底部，主副操作分离",
          tags: ["固定", "移动友好", "业务"],
          prompt:
            "Build a sticky bottom action bar for an order detail page: secondary '取消订单' outlined on the left, primary '抢单' filled on the right. When the order is in service, primary becomes '完成服务'. Keep it safe-area aware on iOS.",
          code: `"use client";

import { useState } from "react";

export default function OrderActions({ status = "pending", onChange }) {
  const [busy, setBusy] = useState(false);

  const primary =
    status === "pending" ? "抢单" : status === "accepted" ? "开始服务" : status === "serving" ? "完成服务" : "已完成";

  const run = async () => {
    setBusy(true);
    await onChange?.(status);
    setBusy(false);
  };

  return (
    <div className="sticky bottom-0 flex items-center gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
    <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-xs text-foreground transition hover:bg-muted"
        >
        取消订单
      </button>
      <button
        type="button"
        disabled={busy || status === "done"}
        onClick={run}
        className="ml-auto rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "处理中…" : primary}
      </button>
    </div>
  );
}`,
          interaction: "主操作随状态变化；取消为次级操作不抢焦点",
        },
      ],
    },
  ],
};
