// 仪表盘（Dashboard）页面骨架数据。

import type { SkeletonPage } from "./types";

export const DASHBOARD_PAGE: SkeletonPage = {
  id: "dashboard",
  name: "仪表盘",
  icon: "LayoutDashboard",
  description: "产品内页骨架：侧边栏、指标卡、图表与数据列表",
  components: [
    {
      id: "dash-sidebar",
      name: "侧边栏",
      icon: "PanelLeft",
      description: "应用导航骨架，决定信息架构",
      variants: [
        {
          id: "dsb_standard",
          name: "标准侧栏",
          description: "图标 + 文字导航 + 底部用户区",
          tags: ["标准", "应用"],
          prompt:
            "Build a standard dashboard sidebar: logo top, nav items with icons (Dashboard, Projects, Analytics, Settings), active item highlighted with primary tint, user card at bottom with avatar + name + logout.",
          code: `export function Sidebar() {
  const items = [
    { icon: "▦", label: "仪表盘", active: true },
    { icon: "▤", label: "项目" },
    { icon: "📊", label: "分析" },
    { icon: "⚙", label: "设置" },
  ];
  return (
    <aside className="flex h-screen w-60 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: "var(--primary)" }}>A</span>
        <span className="font-bold">{{brand}}</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((i) => (
          <a key={i.label} href="#" className={["flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition", i.active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"].join(" ")} style={i.active ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)" } : {}}>
            <span aria-hidden>{i.icon}</span>{i.label}
          </a>
        ))}
      </nav>
      <div className="border-t p-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
          <div className="flex-1">
            <p className="text-sm font-medium">张三</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>zhang@acme.com</p>
          </div>
          <span aria-hidden>⋯</span>
        </div>
      </div>
    </aside>
  );
}`,
          interaction: "激活项主色浅底 + 主色文字",
        },
        {
          id: "dsb_icon",
          name: "图标窄栏",
          description: "只留图标，节省空间",
          tags: ["图标", "紧凑"],
          prompt:
            "Build an icon-only sidebar: narrow (64px) column with circular icon buttons, tooltips on hover, active state with primary background.",
          code: `export function Sidebar() {
  const items = ["▦", "▤", "📊", "⚙", "🔔"];
  return (
    <aside className="flex h-screen w-16 flex-col items-center border-r py-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="flex size-9 items-center justify-center rounded-xl text-sm font-black text-white" style={{ background: "var(--primary)" }}>A</span>
      <nav className="mt-6 flex flex-1 flex-col items-center gap-2">
        {items.map((ic, i) => (
          <a key={i} href="#" title={"导航 " + (i + 1)} className={["flex size-10 items-center justify-center rounded-xl text-base transition", i === 0 ? "text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"].join(" ")} style={i === 0 ? { background: "var(--primary)" } : {}}>
            {ic}
          </a>
        ))}
      </nav>
      <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
    </aside>
  );
}`,
          interaction: "hover 显示 tooltip；折叠态增强内容区",
        },
        {
          id: "dsb_dark",
          name: "深色侧栏",
          description: "深色侧栏 + 浅色内容区对比",
          tags: ["深色", "企业"],
          prompt:
            "Build a dark sidebar: slate-900 background, light nav text, active item with primary background. Content area stays light for contrast.",
          code: `export function Sidebar() {
  const items = [
    { icon: "▦", label: "仪表盘", active: true },
    { icon: "▤", label: "项目", active: false },
    { icon: "📊", label: "分析", active: false },
  ];
  return (
    <aside className="flex h-screen w-60 flex-col bg-slate-900 text-slate-100">
      <div className="flex items-center gap-2 px-5 py-4">
        <span className="flex size-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: "var(--primary)" }}>A</span>
        <span className="font-bold">{{brand}}</span>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-2">
        {items.map((i) => (
          <a key={i.label} href="#" className={["flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium", i.active ? "text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"].join(" ")} style={i.active ? { background: "var(--primary)" } : {}}>
            <span aria-hidden>{i.icon}</span>{i.label}
          </a>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-slate-600 text-xs font-bold">张</span>
          <p className="text-sm font-medium">张三</p>
        </div>
      </div>
    </aside>
  );
}`,
          interaction: "深色侧栏聚焦内容；激活项实色主底",
        },
        {
          id: "dsb_glass",
          name: "毛玻璃浮栏",
          description: "半透磨砂 + 柔光描边，浮于内容上",
          tags: ["毛玻璃", "浮起", "高级"],
          prompt:
            "Build a frosted-glass sidebar: translucent surface with backdrop-blur, soft glow border, logo top, nav items with active item carrying a soft primary-tinted shadow, user card at bottom. Floats above content.",
          code: `export function Sidebar() {
  const items = [
    { icon: "▦", label: "仪表盘", active: true },
    { icon: "▤", label: "项目" },
    { icon: "📊", label: "分析" },
    { icon: "⚙", label: "设置" },
  ];
  return (
    <aside className="flex h-screen w-60 flex-col border-r p-3" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 70%, transparent)", backdropFilter: "blur(16px)" }}>
      <div className="flex items-center gap-2 px-2 py-3">
        <span className="flex size-8 items-center justify-center rounded-lg text-sm font-black text-white" style={{ background: "var(--primary)" }}>A</span>
        <span className="font-bold">{{brand}}</span>
      </div>
      <nav className="flex-1 space-y-1">
        {items.map((i) => (
          <a key={i.label} href="#" className={["flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", i.active ? "text-primary" : "text-muted-foreground hover:text-foreground"].join(" ")} style={i.active ? { background: "color-mix(in srgb, var(--primary) 14%, transparent)", boxShadow: "0 8px 24px color-mix(in srgb, var(--primary) 18%, transparent)" } : {}}>
            <span aria-hidden>{i.icon}</span>{i.label}
          </a>
        ))}
      </nav>
      <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex size-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
          <div className="flex-1">
            <p className="text-sm font-medium">张三</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>zhang@acme.com</p>
          </div>
        </div>
      </div>
    </aside>
  );
}`,
          interaction: "激活项带柔光阴影，浮起感强",
        },
        {
          id: "dsb_editorial",
          name: "编辑式线栏",
          description: "无填充、巨字品牌 + 细线分隔导航",
          tags: ["编辑式", "线性", "极简高级"],
          prompt:
            "Build an editorial sidebar: no card fill, oversized serif wordmark at top, nav items separated only by hairline rules (border-bottom), minimal and luxurious. Light background.",
          code: `export function Sidebar() {
  const items = [
    { label: "仪表盘", active: true },
    { label: "项目" },
    { label: "分析" },
    { label: "设置" },
  ];
  return (
    <aside className="flex h-screen w-56 flex-col px-6 py-10" style={{ background: "var(--background)" }}>
      <span className="font-bold tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif", fontSize: "1.5rem" }}>{{brand}}</span>
      <nav className="mt-12 space-y-0">
        {items.map((i) => (
          <a key={i.label} href="#" className={["block border-b py-4 text-lg transition", i.active ? "font-semibold" : "text-muted-foreground hover:text-foreground"].join(" ")} style={i.active ? { color: "var(--primary)", borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)" } : { borderColor: "var(--border)" }}>
            {i.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}`,
          interaction: "细线分隔导航，巨标品牌定调高级感",
        },
        {
          id: "dsb_ops_console",
          name: "运营工作台侧栏",
          description: "命令中心入口 + 徽标计数导航 + 用户区（源：agent-workstudio）",
          tags: ["工作台", "B2B", "运营"],
          prompt:
            "Build an operations console sidebar: brand + Ctrl+K hint, a dashed command-center button with ⌘ icon, nav items (工作台/订单/任务/数据/配置) with primary-tinted active state and count badges, operator user card at the bottom.",
          code: `export function Sidebar() {
  const items = [
    { label: "工作台", active: true, badge: "" },
    { label: "订单", badge: "12" },
    { label: "任务", badge: "4" },
    { label: "数据", badge: "" },
    { label: "配置", badge: "" },
  ];
  return (
    <aside className="flex h-screen w-60 flex-col border-r" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm font-black">{{brand}}</span>
        <span className="rounded-md border px-1.5 py-0.5 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌘K</span>
      </div>
      <button type="button" className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--primary) 40%, transparent)", color: "var(--muted-foreground)" }}>
        <span aria-hidden>⌘</span> 命令中心…
      </button>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((i) => (
          <a key={i.label} href="#" className={["flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition", i.active ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"].join(" ")} style={i.active ? { background: "color-mix(in srgb, var(--primary) 10%, transparent)" } : {}}>
            <span>{i.label}</span>
            {i.badge && <span className="rounded-full px-1.5 text-[10px] font-semibold text-white" style={{ background: "var(--primary)" }}>{i.badge}</span>}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t p-4" style={{ borderColor: "var(--border)" }}>
        <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>运</span>
        <div className="flex-1">
          <p className="text-sm font-medium">{{user.name}}</p>
          <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>运营负责人</p>
        </div>
      </div>
    </aside>
  );
}`,
          interaction: "命令中心按钮主色虚线、激活项计数徽标",
        },
      ],
    },
    {
      id: "dash-kpi",
      name: "指标卡",
      icon: "Gauge",
      description: "KPI 数字 + 趋势，数据仪表核心",
      variants: [
        {
          id: "dkpi_grid",
          name: "四卡网格",
          description: "4 个指标卡 + 增减趋势",
          tags: ["网格", "KPI"],
          prompt:
            "Build a KPI card grid: 4 cards each with label, big number, delta badge (up green / down red), small sparkline or icon. Surface background, subtle border.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "总营收", v: "$128,400", d: "+12.5%", up: true },
    { l: "活跃用户", v: "48,210", d: "+8.2%", up: true },
    { l: "转化率", v: "3.8%", d: "-0.4%", up: false },
    { l: "客单价", v: "$89", d: "+2.1%", up: true },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.l} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
          <p className="mt-2 text-2xl font-black">{k.v}</p>
          <p className="mt-1.5 text-xs font-medium" style={{ color: k.up ? "var(--success)" : "var(--danger)" }}>
            {k.up ? "▲" : "▼"} {k.d} <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>较上周</span>
          </p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "涨绿跌红按需；数字可加 CountUp",
        },
        {
          id: "dkpi_spark",
          name: "带迷你图",
          description: "指标卡 + sparkline 趋势线",
          tags: ["迷你图", "趋势"],
          prompt:
            "Build KPI cards with sparklines: label, number, delta, and an inline SVG sparkline showing the trend shape.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "访问量", v: "1.2M", d: "+15%", up: true, pts: "0,28 12,24 24,26 36,18 48,20 60,10 72,12" },
    { l: "注册数", v: "8,940", d: "+6%", up: true, pts: "0,30 12,28 24,22 36,24 48,16 60,14 72,8" },
    { l: "跳出率", v: "32%", d: "-3%", up: true, pts: "0,10 12,14 24,12 36,20 48,22 60,28 72,30" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpis.map((k) => (
        <div key={k.l} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">{k.d}</span>
          </div>
          <p className="mt-2 text-2xl font-black">{k.v}</p>
          <svg viewBox="0 0 72 32" className="mt-3 h-10 w-full" preserveAspectRatio="none">
            <polyline points={k.pts} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "SVG sparkline 零依赖；数据实时刷新",
        },
        {
          id: "dkpi_dark",
          name: "深色指标",
          description: "深色卡 + 彩色增量",
          tags: ["深色", "监控"],
          prompt:
            "Build dark KPI cards: slate-900 card, light number, green/red delta chips, subtle border white/10. Monitoring dashboard style.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "CPU", v: "42%", d: "+5%", up: false },
    { l: "内存", v: "61%", d: "+2%", up: false },
    { l: "延迟 P95", v: "86ms", d: "-12ms", up: true },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpis.map((k) => (
        <div key={k.l} className="rounded-xl border border-white/10 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">{k.l}</p>
          <p className="mt-2 text-2xl font-black text-white">{k.v}</p>
          <p className="mt-1.5 text-xs font-medium" style={{ color: k.up ? "var(--success)" : "var(--danger)" }}>{k.d}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "适合运维/监控仪表盘",
        },
        {
          id: "dkpi_horizontal",
          name: "横排指标条",
          description: "顶部单行指标，极简",
          tags: ["横排", "极简"],
          prompt:
            "Build a horizontal KPI strip: one row of label+value pairs separated by dividers, minimal card-less style.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "今日订单", v: "1,204" },
    { l: "GMV", v: "¥86,320" },
    { l: "客单价", v: "¥71.7" },
    { l: "退款率", v: "1.2%" },
  ];
  return (
    <section className="flex flex-wrap items-center gap-x-10 gap-y-4 rounded-xl border px-6 py-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {kpis.map((k) => (
        <div key={k.l}>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
          <p className="mt-0.5 text-lg font-bold">{k.v}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "电商/运营后台顶部常用",
        },
        {
          id: "dkpi_bento",
          name: "Bento 错落指标",
          description: "主卡突出 + 副卡小号拼贴",
          tags: ["Bento", "错落", "重点突出"],
          prompt:
            "Build a Bento KPI block: one large hero card (primary background, big number) spanning full width, then 3 smaller cards below in a grid. Strong visual hierarchy.",
          code: `export function KpiCards() {
  const main = { l: "总营收", v: "$128,400", d: "+12.5%", up: true };
  const subs = [
    { l: "活跃用户", v: "48,210", d: "+8.2%" },
    { l: "转化率", v: "3.8%", d: "-0.4%" },
    { l: "客单价", v: "$89", d: "+2.1%" },
  ];
  return (
    <section className="grid grid-cols-2 gap-4">
      <div className="col-span-2 rounded-2xl p-6" style={{ background: "var(--primary)", color: "var(--on-primary)" }}>
        <p className="text-sm opacity-80">{main.l}</p>
        <p className="mt-2 text-4xl font-black">{main.v}</p>
        <p className="mt-1 text-sm opacity-90">{main.d} 较上周</p>
      </div>
      {subs.map((k) => (
        <div key={k.l} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
          <p className="mt-1.5 text-xl font-bold">{k.v}</p>
          <p className="mt-0.5 text-xs" style={{ color: k.d.startsWith("-") ? "var(--danger)" : "var(--success)" }}>{k.d}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "主卡实色强调，副卡细边框对比",
        },
        {
          id: "dkpi_editorial",
          name: "杂志式指标",
          description: "巨号衬线数字 + 细线分隔",
          tags: ["编辑式", "衬线", "极简高级"],
          prompt:
            "Build editorial KPI rows: each metric is a hairline-separated row with a giant serif number on the left and the delta on the right. Magazine-like luxury typography.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "总营收", v: "$128,400", d: "+12.5%" },
    { l: "活跃用户", v: "48,210", d: "+8.2%" },
    { l: "转化率", v: "3.8%", d: "-0.4%" },
  ];
  return (
    <section className="space-y-8">
      {kpis.map((k) => (
        <div key={k.l} className="flex items-end justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
            <p className="mt-1 text-5xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>{k.v}</p>
          </div>
          <span className="pb-2 text-sm font-medium" style={{ color: k.d.startsWith("-") ? "var(--danger)" : "var(--accent-4)" }}>{k.d}</span>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "衬线巨号数字，细线分隔排版高级",
        },
        {
          id: "dkpi_ops_metrics",
          name: "运营指标卡",
          description: "今日订单/待处理/催发货/待审核 + 状态点（源：agent-workstudio）",
          tags: ["运营", "指标", "B2B"],
          prompt:
            "Build operations metric cards: 今日订单/待处理任务/催发货/待审核 with big numbers, delta badges (red for increase needing attention, green for good), and a small status dot per card.",
          code: `export function KpiCards() {
  const kpis = [
    { l: "今日订单", v: "286", d: "+12", up: true, dot: "var(--success)" },
    { l: "待处理任务", v: "17", d: "-5", up: true, dot: "var(--warning)" },
    { l: "催发货", v: "9", d: "+3", up: false, dot: "var(--danger)" },
    { l: "待审核", v: "23", d: "+8", up: false, dot: "var(--primary)" },
  ];
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((k) => (
        <div key={k.l} className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{k.l}</p>
            <span className="size-2 rounded-full" style={{ background: k.dot }} />
          </div>
          <p className="mt-2 text-2xl font-black">{k.v}</p>
          <p className="mt-1.5 text-xs font-medium" style={{ color: k.up ? "var(--success)" : "var(--danger)" }}>
            {k.up ? "▲" : "▼"} {k.d} <span className="font-normal" style={{ color: "var(--muted-foreground)" }}>较昨日</span>
          </p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "状态点标识品类、增减色区分需关注项",
        },
      ],
    },
    {
      id: "dash-chart",
      name: "图表容器",
      icon: "ChartColumn",
      description: "图表区骨架（数据接入前先定结构）",
      variants: [
        {
          id: "dchart_bars",
          name: "柱状图容器",
          description: "标题 + 图例 + 柱状示意",
          tags: ["柱状", "分析"],
          prompt:
            "Build a bar chart container: card with title + subtitle, legend, bar chart area (use divs with heights as placeholder bars), no external chart lib needed for skeleton.",
          code: `export function BarChart() {
  const bars = [42, 68, 55, 80, 62, 90, 74, 58, 84, 66, 92, 70];
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold">月度营收</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>2025 年各月表现</p>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="size-2.5 rounded-sm" style={{ background: "var(--primary)" }} /> 营收
        </div>
      </div>
      <div className="mt-6 flex h-48 items-end gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-t-md transition-all hover:opacity-80" style={{ height: b + "%", background: i === bars.length - 1 ? "var(--secondary)" : "var(--primary)", opacity: 0.85 }} />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        <span>1月</span><span>6月</span><span>12月</span>
      </div>
    </div>
  );
}`,
          interaction: "占位柱可直接替换为 Recharts/ECharts",
          motionId: "fade-up",
        },
        {
          id: "dchart_line",
          name: "折线图容器",
          description: "SVG 折线 + 渐变填充",
          tags: ["折线", "趋势"],
          prompt:
            "Build a line chart container: card with title, SVG polyline with gradient area fill, axis labels. Pure SVG, chart-lib free.",
          code: `export function LineChart() {
  const pts = "0,120 30,100 60,110 90,70 120,80 150,50 180,60 210,30 240,45 270,20";
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="font-semibold">用户增长趋势</p>
      <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>过去 10 周新注册</p>
      <svg viewBox="0 0 270 130" className="mt-4 w-full">
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={pts} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points={"0,130 " + pts + " 270,130"} fill="url(#lineFill)" />
      </svg>
    </div>
  );
}`,
          interaction: "渐变面积增强趋势感知",
        },
        {
          id: "dchart_donut",
          name: "环形图容器",
          description: "SVG 环形 + 图例",
          tags: ["环形", "占比"],
          prompt:
            "Build a donut chart container: SVG circle segments with center label, legend list with color dots and percentages.",
          code: `export function DonutChart() {
  const segs = [
    { l: "订阅", p: 58, c: "var(--primary)" },
    { l: "广告", p: 24, c: "var(--secondary)" },
    { l: "其他", p: 18, c: "var(--border)" },
  ];
  const r = 60, cx = 70, cy = 70, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="font-semibold">收入结构</p>
      <div className="mt-4 flex items-center gap-6">
        <svg viewBox="0 0 140 140" className="size-36">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="18" />
          {segs.map((s) => {
            const el = (
              <circle key={s.l} cx={cx} cy={cy} r={r} fill="none" stroke={s.c} strokeWidth="18"
                strokeDasharray={C * s.p / 100 + " " + C}
                strokeDashoffset={-offset} transform={"rotate(-90 " + cx + " " + cy + ")"} />
            );
            offset += C * s.p / 100;
            return el;
          })}
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="700">100%</text>
        </svg>
        <ul className="space-y-2 text-sm">
          {segs.map((s) => (
            <li key={s.l} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: s.c }} />
              {s.l} <span style={{ color: "var(--muted-foreground)" }}>{s.p}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}`,
          interaction: "中心数值可切换为总额",
        },
        {
          id: "dchart_empty",
          name: "空状态图表",
          description: "无数据时的引导占位",
          tags: ["空状态", "引导"],
          prompt:
            "Build an empty chart state: dashed border box, icon, 'No data yet' text, and a CTA button to add data. Important UX pattern.",
          code: `export function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center" style={{ borderColor: "var(--border)" }}>
      <span className="text-3xl">📊</span>
      <p className="mt-3 font-semibold">还没有数据</p>
      <p className="mt-1 max-w-xs text-sm" style={{ color: "var(--muted-foreground)" }}>
        接入数据源后，这里会展示你的分析图表。
      </p>
      <button className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
        接入数据源
      </button>
    </div>
  );
}`,
          interaction: "空状态必须给行动入口，否则用户迷路",
        },
        {
          id: "dchart_glass",
          name: "毛玻璃图表",
          description: "半透磨砂图表容器 + 柔光",
          tags: ["毛玻璃", "柔光", "高级"],
          prompt:
            "Build a frosted-glass chart container: translucent surface with backdrop-blur and soft glow border, title + bar chart area. Premium feel without a chart lib.",
          code: `export function BarChart() {
  const bars = [42, 68, 55, 80, 62, 90, 74, 58];
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: "color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 65%, transparent)", backdropFilter: "blur(14px)" }}>
      <div className="flex items-center justify-between">
        <p className="font-semibold">月度营收</p>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>■ 营收</span>
      </div>
      <div className="mt-6 flex h-40 items-end gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 rounded-t-md" style={{ height: b + "%", background: i === bars.length - 1 ? "var(--secondary)" : "var(--primary)", opacity: 0.85 }} />
        ))}
      </div>
    </div>
  );
}`,
          interaction: "毛玻璃容器 + 柱图；占位柱可换 Recharts",
        },
        {
          id: "dchart_bento",
          name: "Bento 多图拼贴",
          description: "趋势柱 + 占比环同框拼贴",
          tags: ["Bento", "拼贴", "组合"],
          prompt:
            "Build a Bento chart block: a wide bar chart card (col-span-2) next to a donut card, both in a 3-col grid with hairline borders. Combines trends + share.",
          code: `export function DashboardCharts() {
  const bars = [42, 68, 55, 80, 62, 90, 74, 58];
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="col-span-2 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="font-semibold">月度营收</p>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {bars.map((b, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ height: b + "%", background: "var(--primary)", opacity: i === 7 ? 1 : 0.6 }} />
          ))}
        </div>
      </div>
      <div className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="font-semibold">收入结构</p>
        <div className="mt-4 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="size-24">
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="14" />
            <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="14" strokeDasharray="150 251" transform="rotate(-90 50 50)" />
          </svg>
        </div>
      </div>
    </section>
  );
}`,
          interaction: "趋势+占比组合，Bento 拼贴一体",
        },
        {
          id: "dchart_loading",
          name: "加载骨架",
          description: "图表加载态：shimmer 骨架占位",
          tags: ["加载", "骨架"],
          prompt:
            "Build a chart loading skeleton: card with title line, a legend chip, and shimmering placeholder bars (rounded divs with an animated gradient sweep). No data yet - communicates the chart is loading.",
          code: `export function ChartLoading() {
  const bars = [60, 80, 55, 90, 70, 95, 65, 85];
  return (
    <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 rounded-md" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
        <div className="h-3 w-10 rounded-full" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
      </div>
      <div className="mt-6 flex h-40 items-end gap-2">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 overflow-hidden rounded-t-md" style={{ background: "color-mix(in srgb, var(--muted-foreground) 14%, transparent)", height: b + "%" }}>
            <div className="h-full w-full shimmer-sweep" />
          </div>
        ))}
      </div>
      <style>{'@keyframes shimmerSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }'}</style>
      <style>{'.shimmer-sweep { background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--surface) 70%, transparent), transparent); animation: shimmerSweep 1.4s linear infinite; }'}</style>
    </div>
  );
}`,
          interaction: "柱状 shimmer 扫光；数据到达后替换为真实图表",
        },
      ],
    },
    {
      id: "dash-list",
      name: "数据列表",
      icon: "List",
      description: "表格/列表容器（表格头、状态徽章）",
      variants: [
        {
          id: "dlist_table",
          name: "表格列表",
          description: "表头 + 行 + 状态徽章",
          tags: ["表格", "标准"],
          prompt:
            "Build a data table container: header row (name/status/date/action), rows with avatar+name, status badges (active green / paused amber), action menu icon.",
          code: `export function DataTable() {
  const rows = [
    { n: "{{brand}} 官网", s: "运行中", c: "var(--success)", d: "2025-03-12" },
    { n: "Nova 商城", s: "已暂停", c: "var(--warning)", d: "2025-03-10" },
    { n: "Pulse 后台", s: "运行中", c: "var(--success)", d: "2025-03-08" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wider" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            <th className="p-4 font-medium">项目</th>
            <th className="p-4 font-medium">状态</th>
            <th className="hidden p-4 font-medium sm:table-cell">更新时间</th>
            <th className="p-4 text-right font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className="border-b last:border-0" style={{ borderColor: "var(--border)" }}>
              <td className="p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: "var(--primary)" }}>{r.n.slice(0, 1)}</span>
                  <span className="font-medium">{r.n}</span>
                </div>
              </td>
              <td className="p-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium" style={{ color: r.c }}>
                  <span className="size-1.5 rounded-full" style={{ background: r.c }} />{r.s}
                </span>
              </td>
              <td className="hidden p-4 sm:table-cell" style={{ color: "var(--muted-foreground)" }}>{r.d}</td>
              <td className="p-4 text-right">
                <button className="rounded-md px-2 py-1 text-sm hover:bg-muted" aria-label="更多操作">⋯</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`,
          interaction: "状态徽章颜色语义化；操作列 hover 菜单",
        },
        {
          id: "dlist_cards",
          name: "卡片列表",
          description: "卡片式列表，适合展示型数据",
          tags: ["卡片", "展示"],
          prompt:
            "Build a card list: grid of cards each with icon, title, description, status chip, and footer meta. Good for project/asset listings.",
          code: `export function DataList() {
  const items = [
    { t: "市场分析报告", d: "2025 Q1 竞品与市场趋势", s: "已完成", tag: "报告" },
    { t: "用户访谈纪要", d: "12 位种子用户深度访谈", s: "进行中", tag: "研究" },
    { t: "{{nav.pricing}}策略{{nav.docs}}", d: "三档{{nav.pricing}}与折扣方案", s: "草稿", tag: "策略" },
  ];
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((i) => (
        <div key={i.t} className="rounded-xl border p-5 transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-start justify-between">
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{i.tag}</span>
            <span className="text-xs font-medium" style={{ color: "var(--success)" }}>{i.s}</span>
          </div>
          <p className="mt-3 font-semibold">{i.t}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>{i.d}</p>
          <p className="mt-3 text-xs" style={{ color: "var(--muted-foreground)" }}>更新于 2 小时前</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "卡片 hover 上浮；适合内容型后台",
        },
        {
          id: "dlist_inbox",
          name: "消息列表",
          description: "头像 + 摘要行，通知/收件箱",
          tags: ["消息", "收件箱"],
          prompt:
            "Build an inbox-style list: rows with avatar, title, preview text, time, unread indicator dot. Standard notification/inbox pattern.",
          code: `export function InboxList() {
  const msgs = [
    { n: "李娜", t: "审批了你的项目方案", time: "5 分钟前", unread: true },
    { n: "系统", t: "新版本 v2.3 已发布", time: "1 小时前", unread: true },
    { n: "王强", t: "邀请你加入「增长实验」", time: "昨天", unread: false },
  ];
  return (
    <div className="divide-y rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {msgs.map((m) => (
        <div key={m.t} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-muted/50">
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>
            {m.n.slice(0, 1)}
            {m.unread && <span className="absolute right-0 top-0 size-2.5 rounded-full border-2 border-card" style={{ background: "var(--primary)" }} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm"><span className="font-semibold">{m.n}</span> · {m.t}</p>
          </div>
          <span className="shrink-0 text-xs" style={{ color: "var(--muted-foreground)" }}>{m.time}</span>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "未读红点 + hover 底色；点击进入详情",
        },
        {
          id: "dlist_editorial",
          name: "编辑式行列表",
          description: "巨标题 + 细线分隔行，强排版",
          tags: ["编辑式", "细线", "强排版"],
          prompt:
            "Build an editorial list: a large serif heading, then rows separated only by hairline rules with name + meta on the left and status on the right. Strong typographic rhythm.",
          code: `export function DataTable() {
  const rows = [
    { n: "{{brand}} 官网", s: "运行中", d: "2025-03-12" },
    { n: "Nova 商城", s: "已暂停", d: "2025-03-10" },
    { n: "Pulse 后台", s: "运行中", d: "2025-03-08" },
  ];
  return (
    <div className="rounded-xl">
      <h3 className="mb-4 text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>项目</h3>
      <ul>
        {rows.map((r) => (
          <li key={r.n} className="flex items-center justify-between border-b py-4" style={{ borderColor: "var(--border)" }}>
            <div>
              <p className="font-medium">{r.n}</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>更新于 {r.d}</p>
            </div>
            <span className="text-sm font-medium" style={{ color: r.s === "运行中" ? "var(--accent-4)" : "var(--warning)" }}>{r.s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}`,
          interaction: "细线分隔行，衬线巨标定调高级",
        },
        {
          id: "dlist_bento",
          name: "分析分格",
          description: "指标块 + 迷你列表拼贴",
          tags: ["Bento", "指标", "列表"],
          prompt:
            "Build an analytics Bento: a highlighted metric block (primary tint) beside a bordered card listing recent activities with status. Combines KPI + list.",
          code: `export function DataList() {
  return (
    <section className="grid grid-cols-3 gap-4">
      <div className="rounded-2xl p-5" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>今日新增</p>
        <p className="mt-2 text-3xl font-black">+1,204</p>
      </div>
      <div className="col-span-2 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="font-semibold">最近动态</p>
        <ul className="mt-3 space-y-3 text-sm">
          <li className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}><span>市场分析报告</span><span style={{ color: "var(--accent-4)" }}>已完成</span></li>
          <li className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--border)" }}><span>用户访谈纪要</span><span style={{ color: "var(--warning)" }}>进行中</span></li>
          <li className="flex items-center justify-between"><span>{{nav.pricing}}策略</span><span style={{ color: "var(--muted-foreground)" }}>草稿</span></li>
        </ul>
      </div>
    </section>
  );
}`,
          interaction: "指标块 + 动态列表 Bento 拼贴",
        },
        {
          id: "dlist_loading",
          name: "列表加载骨架",
          description: "行级 shimmer 骨架，加载态",
          tags: ["加载", "骨架"],
          prompt:
            "Build a list loading skeleton: header row with a title chip, then 4 rows each with a small avatar circle, two text lines, and a status chip - all shimmering placeholders. Communicates a loading table.",
          code: `export function ListLoading() {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="h-4 w-28 rounded-md" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
        <div className="h-3 w-12 rounded-full" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b px-4 py-3.5 last:border-0" style={{ borderColor: "var(--border)" }}>
          <div className="size-8 shrink-0 rounded-full shimmer-sweep" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 rounded shimmer-sweep" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
            <div className="h-2.5 w-1/2 rounded shimmer-sweep" style={{ background: "color-mix(in srgb, var(--muted-foreground) 8%, transparent)" }} />
          </div>
          <div className="h-5 w-14 rounded-full shimmer-sweep" style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }} />
        </div>
      ))}
      <style>{'.shimmer-sweep { position: relative; overflow: hidden; } .shimmer-sweep::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--surface) 70%, transparent), transparent); animation: shimmerSweep 1.4s linear infinite; } @keyframes shimmerSweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }'}</style>
    </div>
  );
}`,
          interaction: "行级 shimmer；数据到达后替换为真实列表",
        },
      ],
    },
    {
      id: "dash-topbar",
      name: "顶栏",
      icon: "Search",
      description: "工作台顶部条：全局搜索 + 通知 + 用户区",
      variants: [
        {
          id: "dtop_workbench",
          name: "工作台顶栏",
          description: "全局搜索、通知铃、用户菜单",
          tags: ["顶栏", "导航", "应用"],
          prompt:
            "Build a workbench topbar: left global search box, divider, notification bell with unread badge, avatar + name on the right. Flat surface with a bottom hairline border.",
          code: `export function Topbar() {
  return (
    <header className="flex items-center gap-4 border-b px-5 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <span aria-hidden>⌕</span> 搜索项目、成员或文档…
      </div>
      <div className="flex items-center gap-3">
        <span className="relative cursor-pointer" title="通知">
          <span aria-hidden>🔔</span>
          <span className="absolute -right-1 -top-1 size-2 rounded-full" style={{ background: "var(--primary)" }} />
        </span>
        <span className="h-5 w-px" style={{ background: "var(--border)" }} />
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
          <span className="hidden text-sm font-medium sm:inline">张三</span>
        </div>
      </div>
    </header>
  );
}`,
          interaction: "搜索聚焦高亮、通知红点提示",
        },
        {
          id: "dtop_terminal",
          name: "暗黑终端顶栏",
          description: "近黑底 + 等宽命令搜索，开发者风",
          tags: ["暗黑", "终端", "开发者"],
          prompt:
            "Build a dark developer topbar: near-black surface, monospace font, a command-palette style search (Ctrl+K), status dots, minimal icons. Terminal-inspired.",
          code: `export function Topbar() {
  return (
    <header className="flex items-center gap-3 border-b px-5 py-3" style={{ background: "var(--background)", borderColor: "var(--border)" }}>
      <span className="font-mono text-sm" style={{ color: "var(--accent-1)" }}>~/app</span>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "var(--surface)" }}>
        <span aria-hidden>❯</span> 搜索 <span style={{ color: "var(--accent-1)" }}>Ctrl K</span>
      </div>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: "var(--accent-1)" }} />
        <span className="size-2 rounded-full" style={{ background: "var(--accent-6)" }} />
        <span className="size-2 rounded-full" style={{ background: "var(--warning)" }} />
      </span>
    </header>
  );
}`,
          interaction: "命令面板风、终端暗底",
        },
        {
          id: "dtop_glass",
          name: "毛玻璃顶栏",
          description: "半透模糊 + 柔光环边",
          tags: ["毛玻璃", "柔光", "高级"],
          prompt:
            "Build a frosted-glass topbar: translucent blurred surface with a soft glow border, a pill search, bell, and avatar. Premium, restrained.",
          code: `export function Topbar() {
  return (
    <header className="flex items-center gap-3 rounded-2xl px-5 py-3" style={{ border: "1px solid color-mix(in srgb, var(--border) 60%, transparent)", background: "color-mix(in srgb, var(--surface) 55%, transparent)", backdropFilter: "blur(16px)", boxShadow: "0 8px 40px -12px color-mix(in srgb, var(--primary) 25%, transparent)" }}>
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted/60 px-3.5 py-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
        <span aria-hidden>⌕</span> 搜索
      </div>
      <span className="relative">
        <span aria-hidden>🔔</span>
        <span className="absolute -right-1 -top-1 size-2 rounded-full" style={{ background: "var(--secondary)" }} />
      </span>
      <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>张</span>
    </header>
  );
}`,
          interaction: "毛玻璃容器、柔光投影",
        },
        {
          id: "dtop_ops_modebar",
          name: "工作台模式切换条",
          description: "运营/议价/订单/任务/审核/数据/配置 + 命令中心（源：agent-workstudio）",
          tags: ["工作台", "模式", "B2B"],
          prompt:
            "Build an operations mode bar topbar: horizontal mode tabs (运营/议价/订单/任务/审核/数据/配置) with a primary underline on the active mode, right side has a ⌘K command-center pill, a primary + 新建 button, and an operator avatar.",
          code: `export function Topbar() {
  const modes = ["运营", "议价", "订单", "任务", "审核", "数据", "配置"];
  return (
    <header className="flex items-center gap-3 border-b px-5 py-2.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
        {modes.map((m, i) => (
          <a key={m} href="#" className={["whitespace-nowrap px-3 py-2 text-sm font-medium transition", i === 0 ? "text-primary" : "text-muted-foreground hover:text-foreground"].join(" ")} style={i === 0 ? { boxShadow: "inset 0 -2px 0 0 var(--primary)" } : {}}>
            {m}
          </a>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <span className="rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>⌘K 命令中心</span>
        <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--primary)" }}>+ 新建</span>
        <span className="flex size-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>运</span>
      </div>
    </header>
  );
}`,
          interaction: "激活模式主色下划线、命令中心 ⌘K 快捷键提示",
        },
      ],
    },
    {
      id: "dash-table",
      name: "数据表格",
      icon: "Table",
      description: "行列表格：列头 + 状态徽章 + 进度",
      variants: [
        {
          id: "dtbl_standard",
          name: "标准表格",
          description: "表头 + 状态徽章 + 进度条",
          tags: ["表格", "数据"],
          prompt:
            "Build a data table: a thead with 4 columns (Name / Status / Owner / Progress), 3 rows with primary-tinted status badges and a thin progress bar. Divide rows by hairlines.",
          code: `export function DataTable() {
  const rows = [
    { n: "官网改版", s: "进行中", o: "李娜", p: 68 },
    { n: "套餐定价", s: "待评审", o: "王强", p: 32 },
    { n: "Q3 增长", s: "已完成", o: "赵敏", p: 100 },
  ];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-xs" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
            <th className="px-4 py-3 font-medium">项目</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-4 py-3 font-medium">负责人</th>
            <th className="px-4 py-3 font-medium">进度</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className="border-b" style={{ borderColor: "var(--border)" }}>
              <td className="px-4 py-3 font-medium">{r.n}</td>
              <td className="px-4 py-3">
                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{r.s}</span>
              </td>
              <td className="px-4 py-3" style={{ color: "var(--muted-foreground)" }}>{r.o}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full" style={{ background: "var(--muted)" }}>
                    <div className="h-full rounded-full" style={{ width: r.p + "%", background: "var(--primary)" }} />
                  </div>
                  <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.p}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`,
          interaction: "行 hover 高亮、状态彩底徽章",
        },
        {
          id: "dtbl_editorial",
          name: "编辑式行表",
          description: "衬线巨标题 + 细线分隔，刊物感",
          tags: ["编辑", "衬线", "刊物"],
          prompt:
            "Build an editorial table list: not a boxed grid but a set of rows separated by hairlines, with a large serif headline row, mixed two-column info, and a small index number. Feels like a magazine index.",
          code: `export function EditorialTable() {
  const rows = [
    { n: "官网改版", s: "进行中", meta: "设计 / 前端", i: "01" },
    { n: "套餐定价", s: "待评审", meta: "增长 / 分析", i: "02" },
    { n: "Q3 增长", s: "已完成", meta: "策略 / 内容", i: "03" },
  ];
  return (
    <section className="border-y" style={{ borderColor: "var(--border)" }}>
      {rows.map((r) => (
        <div key={r.i} className="flex items-baseline justify-between gap-4 border-b py-5 last:border-0" style={{ borderColor: "var(--border)" }}>
          <span className="font-mono text-xs" style={{ color: "var(--muted-foreground)" }}>{r.i}</span>
          <h3 className="flex-1 truncate text-2xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>{r.n}</h3>
          <p className="hidden text-xs sm:block" style={{ color: "var(--muted-foreground)" }}>{r.meta}</p>
          <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{r.s}</span>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "衬线巨标题、细线分组、编号页码",
        },
        {
          id: "dtbl_dense",
          name: "密铺数据",
          description: "高密度小字信息网格",
          tags: ["数据", "密铺", "运营"],
          prompt:
            "Build a dense data grid: many compact rows with small mono numbers, micro labels, and inline status chips. Think trading terminal / ops console density.",
          code: `export function DenseTable() {
  const rows = [
    { k: "req/min", v: "12,480", s: "稳定", t: "up" },
    { k: "p50 / ms", v: "84", s: "正常", t: "flat" },
    { k: "error%", v: "0.12", s: "关注", t: "down" },
    { k: "qps", v: "428", s: "稳定", t: "up" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border sm:grid-cols-4" style={{ borderColor: "var(--border)", background: "var(--border)" }}>
      {rows.map((r) => (
        <div key={r.k} className="py-3 pl-3 pr-2" style={{ background: "var(--surface)" }}>
          <p className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>{r.k}</p>
          <p className="mt-0.5 font-mono text-base font-semibold">{r.v}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: r.t === "up" ? "var(--success)" : r.t === "down" ? "var(--danger)" : "var(--muted-foreground)" }}>
            <span className="size-1.5 rounded-full" style={{ background: r.t === "up" ? "var(--success)" : r.t === "down" ? "var(--danger)" : "var(--muted)" }} />{r.s}
          </p>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "等宽数字、状态语义色、缝隙网格",
        },
      ],
    },
    {
      id: "dash-tasks",
      name: "任务看板",
      icon: "ListChecks",
      description: "待办 / 进行中 / 已完成 三列看板",
      variants: [
        {
          id: "dtask_board",
          name: "三列看板",
          description: "状态列 + 任务卡片 + 标签色点",
          tags: ["看板", "任务", "协作"],
          prompt:
            "Build a kanban board with 3 columns (To do / In progress / Done). Each column has a title with item count and task cards with colored tag dots. Follows app tokens.",
          code: `export function TaskBoard() {
  const cols = [
    { t: "待办", items: [{ n: "梳理用户旅程", tag: "var(--primary)" }, { n: "竞品调研", tag: "var(--secondary)" }] },
    { t: "进行中", items: [{ n: "设计定价页", tag: "var(--secondary)" }] },
    { t: "已完成", items: [{ n: "搭建导航骨架", tag: "var(--primary)" }] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cols.map((c) => (
        <div key={c.t} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 60%, transparent)" }}>
          <p className="mb-2 px-1 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>{c.t} · {c.items.length}</p>
          <div className="space-y-2">
            {c.items.map((i) => (
              <div key={i.n} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="flex items-center justify-between">
                  <span className="size-2 rounded-full" style={{ background: i.tag }} />
                  <span className="text-xs">⋯</span>
                </div>
                <p className="mt-2 font-medium">{i.n}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "卡片可拖动、列头计数",
        },
        {
          id: "dtask_neon",
          name: "霓虹看板",
          description: "深底霓虹色卡，创意机构风",
          tags: ["霓虹", "暗黑", "活泼"],
          prompt:
            "Build a neon kanban on a dark canvas: 3 columns with vivid neon cards (var(--primary) / var(--accent-3) / var(--accent-1) tones), glowing accents, bold tags. Playful agency vibe, not generic SaaS.",
          code: `export function NeonBoard() {
  const cols = [
    { t: "待办", c: "var(--primary)", items: [{ n: "品牌发布", tag: "var(--primary)" }, { n: "设计 Sprint", tag: "var(--accent-2)" }] },
    { t: "进行中", c: "var(--accent-3)", items: [{ n: "落地页", tag: "var(--accent-3)" }] },
    { t: "已完成", c: "var(--accent-1)", items: [{ n: "视觉系统", tag: "var(--accent-1)" }] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3" style={{ background: "var(--background)" }}>
      {cols.map((c) => (
        <div key={c.t} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-xs font-semibold" style={{ color: c.c }}><span className="size-2 rounded-full" style={{ background: c.c }} />{c.t}</p>
          <div className="space-y-2">
            {c.items.map((i) => (
              <div key={i.n} className="rounded-lg p-3 text-sm" style={{ border: "1px solid color-mix(in srgb, " + i.tag + " 45%, transparent)", background: "color-mix(in srgb, " + i.tag + " 12%, var(--surface))" }}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: i.tag }}>● ____</span>
                  <span style={{ color: "var(--muted-foreground)" }}>⋯</span>
                </div>
                <p className="mt-2 font-semibold text-white">{i.n}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "霓虹描边卡、列挑染色头",
        },
        {
          id: "dtask_wave",
          name: "时间线瀑布",
          description: "按截止时间纵向排布任务",
          tags: ["时间线", "日历", "冲刺"],
          prompt:
            "Build a sprint waterfall timeline: tasks vertically stacked by due time, each with a duration bar, milestone dots, and a day rail on the left. Feels like a schedule/calendar, not a board.",
          code: `export function SprintTimeline() {
  const days = [
    { d: "一", items: ["拆解需求", "低保真图"], mark: 1 },
    { d: "二", items: ["视觉稿"], mark: 0 },
    { d: "三", items: ["联调", "评审", "提测"], mark: 1 },
  ];
  return (
    <div className="space-y-3">
      {days.map((day) => (
        <div key={day.d} className="flex gap-3">
          <div className="w-8 shrink-0 pt-1 text-center">
            <span className="mx-auto flex size-6 items-center justify-center rounded-full text-xs font-bold" style={day.mark ? { background: "var(--primary)", color: "var(--on-primary)" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}>{day.d}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {day.items.map((t) => (
              <span key={t} className="rounded-lg border px-3 py-1.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>{t}</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "当日圆点主色、任务胶囊标签",
        },
      ],
    },
    {
      id: "dash-notifications",
      name: "通知中心",
      icon: "Bell",
      description: "系统 / 协作消息流",
      variants: [
        {
          id: "dnot_list",
          name: "通知列表",
          description: "图标圆底 + 标题 + 时间 + 未读点",
          tags: ["通知", "消息"],
          prompt:
            "Build a notification center list: each row has a themed circular icon, bold title, meta text, and an unread dot. Scannable in-app notification feed.",
          code: `export function Notifications() {
  const items = [
    { i: "✓", t: "审批通过", d: "「官网改版」已通过评审", time: "10 分钟前", unread: true },
    { i: "@", t: "有人@你", d: "王强 在「定价页」中提到了你", time: "2 小时前", unread: true },
    { i: "▣", t: "新版本", d: "v2.4 已发布到生产环境", time: "昨天", unread: false },
  ];
  return (
    <div className="divide-y rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {items.map((m) => (
        <div key={m.t} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-muted/50">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{m.i}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm"><span className="font-semibold">{m.t}</span> · {m.d}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{m.time}</p>
          </div>
          {m.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: "var(--primary)" }} />}
        </div>
      ))}
    </div>
  );
}`,
          interaction: "未读点主色、hover 底色",
        },
        {
          id: "dnot_bento",
          name: "Bento 消息卡",
          description: "异尺寸网格消息，编辑杂志感",
          tags: ["Bento", "编辑", "消息"],
          prompt:
            "Build a bento notifications feed: not a plain list but an asymmetric grid of message cards with varying spans, a priority highlight on one card, serif headings where fitting. Editorial, magazine-like.",
          code: `export function BentoFeed() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border p-4 sm:col-span-2" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--primary) 8%, var(--surface))" }}>
        <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--primary)" }}>置顶</p>
        <h3 className="mt-1 text-xl font-semibold" style={{ fontFamily: "var(--font-heading)" }}>「官网改版」已进入开发</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>李娜 更新了 8 个任务 · 10 分钟前</p>
      </div>
      {["有人@你 · 定价页", "新版本 v2.4 上线", "成员邀请已接受"].map((t) => (
        <div key={t} className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="text-sm font-medium">{t}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>2 小时前</p>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "异尺寸网格、置顶高亮、衬线标题",
        },
        {
          id: "dnot_terminal",
          name: "终端日志流",
          description: "暗底等宽日志，开发者风",
          tags: ["终端", "日志", "暗黑"],
          prompt:
            "Build a terminal log feed: near-black panel, monospace rows with severity-colored prefixes, timestamps, progress lines. Reads like a deploy/CI log viewer.",
          code: `export function LogFeed() {
  const rows = [
    { t: "[12:01:03]", l: "INFO", m: "build started", c: "var(--accent-1)" },
    { t: "[12:01:05]", l: "OK", m: "compiled 214 modules", c: "var(--success)" },
    { t: "[12:01:08]", l: "WARN", m: "legacy shim in use", c: "var(--warning)" },
    { t: "[12:01:12]", l: "DONE", m: "deploy to production", c: "var(--accent-6)" },
  ];
  return (
    <div className="rounded-lg p-4 font-mono text-xs" style={{ background: "var(--background)", border: "1px solid var(--border)" }}>
      <p className="mb-2 flex gap-1.5">
        <span className="size-2 rounded-full bg-[var(--accent-6)]" /><span className="size-2 rounded-full bg-[var(--warning)]" /><span className="size-2 rounded-full bg-[var(--success)]" />
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <p key={r.m} className="truncate"><span style={{ color: "var(--muted-foreground)" }}>{r.t}</span> <span style={{ color: r.c }}>{r.l}</span> <span style={{ color: "var(--foreground)" }}>{r.m}</span></p>
        ))}
      </div>
    </div>
  );
}`,
          interaction: "暗色日志面板、严重级前缀色",
        },
      ],
    },
    {
      id: "dash-tabs",
      name: "面板页签",
      icon: "LayoutGrid",
      description: "分段页签切换不同面板",
      variants: [
        {
          id: "dtabs_seg",
          name: "分段页签",
          description: "主色激活页签 + 面板保持",
          tags: ["页签", "面板"],
          prompt:
            "Build segmented panel tabs: a pill-style tab row whose active tab has a primary background, below a placeholder content panel. Common analytics shell.",
          code: `export function PanelTabs() {
  const tabs = ["概览", "趋势", "明细"];
  const active = "概览";
  return (
    <div className="rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex gap-1 border-b p-3" style={{ borderColor: "var(--border)" }}>
        {tabs.map((t) => (
          <span key={t} className={"cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium " + (t === active ? "text-white" : "")} style={t === active ? { background: "var(--primary)" } : { color: "var(--muted-foreground)" }}>{t}</span>
        ))}
      </div>
      <div className="p-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        面板内容区 · 接入图表或表格
      </div>
    </div>
  );
}`,
          interaction: "页签切换过渡、面板懒加载",
        },
        {
          id: "dtabs_underline",
          name: "下划线页签",
          description: "衬线大 tab + 主色下划线",
          tags: ["页签", "编辑", "字重"],
          prompt:
            "Build underline tabs: no pill boxes — large serif tab labels with a primary underline on the active one, generous letter-spacing, editorial and quiet.",
          code: `export function UnderlineTabs() {
  const tabs = ["概览", "趋势", "明细"];
  return (
    <div className="border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex gap-8 px-1">
        {tabs.map((t, i) => (
          <span key={t} className={"cursor-pointer pb-2 text-lg font-semibold " + (i === 0 ? "" : "")} style={i === 0 ? { color: "var(--foreground)", borderBottom: "2px solid var(--primary)", fontFamily: "var(--font-heading)" } : { color: "var(--muted-foreground)" }}>{t}</span>
        ))}
      </div>
    </div>
  );
}`,
          interaction: "衬线大字、主色下划线、宽松间距",
        },
        {
          id: "dtabs_glass",
          name: "玻璃页签",
          description: "半透胶囊页签 + 柔光",
          tags: ["毛玻璃", "页签", "高质感"],
          prompt:
            "Build glass tabs: a translucent pill container with an active pill that has a soft glow border and backdrop blur. Premium 'high-end visual design' finish.",
          code: `export function GlassTabs() {
  const tabs = ["概览", "趋势", "明细"];
  return (
    <div className="inline-flex gap-1 rounded-full p-1" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 50%, transparent)", backdropFilter: "blur(12px)" }}>
      {tabs.map((t, i) => (
        <span key={t} className={"cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium " + (i === 0 ? "text-white" : "")} style={i === 0 ? { background: "var(--primary)", boxShadow: "0 4px 20px -6px var(--primary)" } : { color: "var(--muted-foreground)" }}>{t}</span>
      ))}
    </div>
  );
}`,
          interaction: "冻结胶囊容器、激活发光",
        },
      ],
    },
    {
      id: "dash-filters",
      name: "筛选工具栏",
      icon: "SlidersHorizontal",
      description: "条件筛选 chip + 重置",
      variants: [
        {
          id: "dfil_bar",
          name: "筛选栏",
          description: "多条件 chip，主色激活",
          tags: ["筛选", "工具栏"],
          prompt:
            "Build a filter toolbar: a row of filter chips (e.g. All / In progress / Review / Done) where the active chip is primary-filled, plus a Reset text button. Compact and scannable.",
          code: `export function FilterBar() {
  const chips = ["全部", "进行中", "待评审", "已完成"];
  const active = "进行中";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c} className={"cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition " + (c === active ? "text-white" : "")} style={c === active ? { background: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{c}</span>
      ))}
      <button className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>重置</button>
    </div>
  );
}`,
          interaction: "激活 chip 主色实心",
        },
        {
          id: "dfil_combo",
          name: "搜索 + 筛选",
          description: "搜索框 + 多选 chips 组合",
          tags: ["筛选", "搜索", "工具栏"],
          prompt:
            "Build a combined filter bar: a filled search input on the left, then state chips, then a leading 'Reset' — layered but legible. Feels like a real analytics query bar.",
          code: `export function FilterCombo() {
  const chips = ["进行中", "待评审", "已完成"];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <span aria-hidden>⌕</span> 搜索项目、成员…
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <span key={c} className={"cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium " + (i === 0 ? "text-white" : "")} style={i === 0 ? { background: "var(--primary)" } : { border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>{c}</span>
        ))}
        <button className="px-1 text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>重置</button>
      </div>
    </div>
  );
}`,
          interaction: "搜索输入 + 激活 chip",
        },
        {
          id: "dfil_range",
          name: "数值区间",
          description: "区间滑杆 + 极小/极大输入",
          tags: ["筛选", "区间", "数据"],
          prompt:
            "Build a numeric range filter: a single range slider track with a filled primary span, numeric min/max inputs at both ends, and a readout. Data-ops focused.",
          code: `export function RangeFilter() {
  const min = 0, max = 100, lo = 24, hi = 78;
  const pct = (x: number) => (x / (max - min)) * 100;
  return (
    <div className="space-y-2.5">
      <div className="relative h-1.5 rounded-full bg-muted">
        <div className="absolute h-full rounded-full" style={{ left: pct(lo) + "%", width: pct(hi - lo) + "%", background: "var(--primary)" }} />
        <span className="absolute -top-1 size-3.5 rounded-full border-2" style={{ left: pct(lo) + "%", background: "var(--surface)", borderColor: "var(--primary)" }} />
        <span className="absolute -top-1 size-3.5 rounded-full border-2" style={{ left: pct(hi) + "%", background: "var(--surface)", borderColor: "var(--primary)" }} />
      </div>
      <div className="flex items-center justify-between text-xs" style={{ color: "var(--muted-foreground)" }}>
        <span>¥{lo}K</span><span>{lo}% – {hi}%</span><span>¥{hi}K</span>
      </div>
    </div>
  );
}`,
          interaction: "区间填充主色、双端点掣",
        },
      ],
    },
    {
      id: "dash-statstrip",
      name: "数据概览条",
      icon: "Gauge",
      description: "横排 KPI 快照：数值 + 环比",
      variants: [
        {
          id: "dstrip_stack",
          name: "堆叠统计条",
          description: "多指标并排，主语义色增量",
          tags: ["数据", "KPI", "概览"],
          prompt:
            "Build a horizontal stat strip: 4 equal metrics (Today / This Week / This Month / Total), each with a value and a delta chip. Use hairline separators between cells and semantic colors for deltas.",
          code: `export function StatStrip() {
  const stats = [
    { l: "今日活跃", v: "1,204", d: "+12.4%" },
    { l: "本周新增", v: "8,731", d: "+8.1%" },
    { l: "本月营收", v: "$86,200", d: "+21.9%" },
    { l: "累计用户", v: "48,210", d: "+4.3%" },
  ];
  return (
    <div className="grid grid-cols-2 divide-y sm:grid-cols-4 sm:divide-x sm:divide-y-0" style={{ borderColor: "var(--border)" }}>
      {stats.map((s) => (
        <div key={s.l} className="p-4">
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{s.v}</p>
          <p className="mt-1 text-xs font-medium" style={{ color: "var(--success)" }}>{s.d}</p>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "环比增量语义色、细线分隔",
        },
        {
          id: "dstrip_editorial",
          name: "编辑式巨数字",
          description: "衬线超大数字 + 极简标签",
          tags: ["编辑", "巨数字", "数字艺术"],
          prompt:
            "Build an editorial stat strip: four oversized serif numbers, hairline separators, tiny uppercase labels, no boxes or badges. Static, confident, magazine-like.",
          code: `export function EditorialStats() {
  const s = [
    { l: "今日活跃", v: "1204" },
    { l: "本周新增", v: "8731" },
    { l: "本月营收", v: "$86K" },
    { l: "累计用户", v: "48210" },
  ];
  return (
    <section className="grid grid-cols-2 divide-x divide-y-0 border-y sm:grid-cols-4" style={{ borderColor: "var(--border)" }}>
      {s.map((x) => (
        <div key={x.l} className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
          <p className="mt-2 text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>{x.v}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "衬线大数字、首字母间距标签",
        },
        {
          id: "dstrip_gradient",
          name: "渐变玻璃条",
          description: "半透渐变卡片 + 柔光",
          tags: ["毛玻璃", "渐变", "高质感"],
          prompt:
            "Build a gradient glass stat strip: four translucent gradient cards with soft inner shadows and rounded corners, accent-tinted values. Premium 'high-end visual design' feel.",
          code: `export function GlassStats() {
  const s = [
    { l: "今日活跃", v: "1,204", d: "+12.4%", g: ["var(--accent-5)", "var(--primary)"] },
    { l: "本周新增", v: "8,731", d: "+8.1%", g: ["var(--accent-1)", "var(--primary)"] },
    { l: "本月营收", v: "$86.2K", d: "+21.9%", g: ["var(--accent-2)", "var(--accent-5)"] },
    { l: "累计用户", v: "48.2K", d: "+4.3%", g: ["var(--success)", "var(--accent-1)"] },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {s.map((x) => (
        <div key={x.l} className="rounded-2xl border p-4" style={{ border: "1px solid color-mix(in srgb, var(--foreground) 13%, transparent)", background: "linear-gradient(135deg, color-mix(in srgb, " + x.g[0] + " 18%, transparent), color-mix(in srgb, " + x.g[1] + " 10%, transparent))", boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--foreground) 13%, transparent)" }}>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{x.v}</p>
          <p className="mt-1 text-xs font-semibold" style={{ color: x.g[0] }}>{x.d}</p>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "渐变玻璃卡、内侧高光",
        },
      ],
    },
    {
      id: "dash-permissions",
      name: "权限表格",
      icon: "UserPlus",
      description: "成员角色与权限清单",
      variants: [
        {
          id: "dperm_list",
          name: "成员权限表",
          description: "头像 + 角色徽章 + 权限开关",
          tags: ["权限", "成员", "管理"],
          prompt:
            "Build a member permissions table: rows of avatar + name + a role badge (primary tint) + two permission toggles (edit / delete). Badge and toggle colors reflect permission level.",
          code: `export function PermissionTable() {
  const rows = [
    { n: "李娜", r: "管理员", e: true, d: true },
    { n: "王强", r: "编辑", e: true, d: false },
    { n: "赵敏", r: "只读", e: false, d: false },
  ];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <p className="text-sm font-semibold">成员与权限</p>
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>共 {rows.length} 人</span>
      </div>
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {rows.map((r) => (
          <li key={r.n} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>{r.n.slice(0, 1)}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.n}</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>{r.r}</span>
            <span className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span className="font-medium" style={{ color: r.e ? "var(--success)" : "var(--muted-foreground)" }}>编辑</span>
              <span className="font-medium" style={{ color: r.d ? "var(--success)" : "var(--muted-foreground)" }}>删除</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}`,
          interaction: "角色徽章主色、已授权权限高亮",
        },
        {
          id: "dperm_tree",
          name: "权限树",
          description: "层级勾选树：读/写/删",
          tags: ["权限", "树", "RBAC"],
          prompt:
            "Build a hierarchical permission tree: a module tree with collapsed groups, per-node rows of read/write/delete checkboxes, checked states in primary. Feels like a real RBAC editor.",
          code: `export function PermissionTree() {
  const nodes = [
    { m: "项目 · 官网改版", items: [["读取", true], ["编辑", true], ["删除", false]] },
    { m: "数据面板", items: [["读取", true], ["编辑", false], ["删除", false]] },
    { m: "成员管理", items: [["读取", true], ["编辑", false], ["删除", false]] },
  ];
  return (
    <div className="divide-y rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {nodes.map((n) => (
        <div key={n.m} className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{n.m}</p>
          <div className="flex gap-4">
            {n.items.map(([label, on]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs" style={{ color: on ? "var(--primary)" : "var(--muted-foreground)" }}>
                <span className="flex size-4 items-center justify-center rounded border text-[9px]" style={{ borderColor: on ? "var(--primary)" : "var(--border)", background: on ? "var(--primary)" : "transparent", color: on ? "var(--on-primary)" : "transparent" }}>✓</span>
                {label}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "勾选框主色实心、层级可折叠",
        },
        {
          id: "dperm_matrix",
          name: "角色矩阵",
          description: "角色 × 能力矩阵卡",
          tags: ["权限", "矩阵", "角色"],
          prompt:
            "Build a role × capability matrix: three role columns (Admin / Editor / Viewer) with a standardized capability grid, filled/unfilled dots, and a header row. Analytical, at-a-glance comparison.",
          code: `export function RoleMatrix() {
  const caps = ["创建项目", "编辑内容", "删除记录", "导出数据"];
  const roles = [
    { r: "Admin", v: [1, 1, 1, 1] },
    { r: "Editor", v: [1, 1, 0, 1] },
    { r: "Viewer", v: [0, 0, 0, 1] },
  ];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="grid grid-cols-4 border-b text-center text-xs font-semibold" style={{ borderColor: "var(--border)" }}>
        <span className="px-3 py-2.5 text-left">能力</span>
        {roles.map((r) => <span key={r.r} className="px-3 py-2.5" style={{ color: "var(--primary)" }}>{r.r}</span>)}
      </div>
      {caps.map((c, i) => (
        <div key={c} className="grid grid-cols-4 items-center border-b text-center text-xs last:border-0" style={{ borderColor: "var(--border)" }}>
          <span className="px-3 py-2.5 text-left" style={{ color: "var(--muted-foreground)" }}>{c}</span>
          {roles.map((r) => (
            <span key={r.r} className="px-3 py-2.5">
              <span className="mx-auto block size-2 rounded-full" style={{ background: r.v[i] ? "var(--primary)" : "var(--muted)" }} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}`,
          interaction: "能力点实心/空心、角色列挑染",
        },
      ],
    },
    {
      id: "dash-gauges",
      name: "仪表集群",
      icon: "ChartColumn",
      description: "环形资源占用仪表盘集",
      variants: [
        {
          id: "dgauge_dials",
          name: "环形仪表簇",
          description: "SVG 半环 + 中心百分比",
          tags: ["仪表", "资源", "SVG"],
          prompt:
            "Build a gauge cluster: 3 circular/SVG ring dials (CPU / Memory / Disk), each with a primary-stroked progress ring, a centered percentage, and a label. Pure SVG, no chart lib.",
          code: `export function GaugeCluster() {
  const g = [
    { l: "CPU 使用率", p: 72 },
    { l: "内存占用", p: 46 },
    { l: "磁盘使用", p: 88 },
  ];
  const C = 2 * Math.PI * 34;
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {g.map((x) => (
        <div key={x.l} className="flex flex-col items-center rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <svg viewBox="0 0 96 96" className="size-24">
            <circle cx="48" cy="48" r="34" fill="none" stroke="var(--muted)" strokeWidth="8" opacity="0.4" />
            <circle cx="48" cy="48" r="34" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - x.p / 100)} transform="rotate(-90 48 48)" />
            <text x="48" y="53" textAnchor="middle" fontSize="16" fontWeight="700">{x.p}%</text>
          </svg>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
        </div>
      ))}
    </section>
  );
}`,
          interaction: "环形进度主色描边、数值居中",
        },
        {
          id: "dgauge_linear",
          name: "线性仪表",
          description: "横向进度条集合，编辑排版",
          tags: ["仪表", "线性", "编辑"],
          prompt:
            "Build linear gauges: a set of horizontal progress bars under mono numeric labels, minimal hairlines, value at the right. Quiet, editorial, data-dense.",
          code: `export function LinearGauges() {
  const g = [
    { l: "队列负载", v: 62 },
    { l: "缓存命中", v: 91 },
    { l: "错误率", v: 12 },
  ];
  return (
    <div className="space-y-4">
      {g.map((x) => (
        <div key={x.l} className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{x.l}</p>
            <p className="font-mono text-xs font-semibold">{x.v}<span className="text-muted-foreground">%</span></p>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: x.v + "%", background: x.v > 80 ? "var(--danger)" : x.v < 30 ? "var(--warning)" : "var(--primary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "阈值语义进度条、等宽数值",
        },
        {
          id: "dgauge_neon",
          name: "霓虹仪表",
          description: "深底发光半环，创意感",
          tags: ["霓虹", "暗黑", "发光"],
          prompt:
            "Build neon gauges: on a dark canvas, semi-ring dials with glowing stroke in vivid colors, bold center value, tiny label. Playful agency energy.",
          code: `export function NeonGauges() {
  const g = [
    { l: "CPU", p: 72, c: "var(--accent-1)" },
    { l: "内存", p: 46, c: "var(--accent-2)" },
    { l: "磁盘", p: 88, c: "var(--warning)" },
  ];
  return (
    <div className="grid grid-cols-3 gap-3" style={{ background: "var(--background)" }}>
      {g.map((x) => (
        <div key={x.l} className="flex flex-col items-center rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="relative size-16">
            <span className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(" + x.c + " " + x.p * 1.8 + "deg, var(--surface) 0deg)" }} />
            <span className="absolute inset-[6px] flex items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: "var(--surface)" }}>{x.p}</span>
          </div>
          <p className="mt-2 text-xs font-medium" style={{ color: x.c }}>{x.l}</p>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "conic 发光环、深底霓虹",
        },
        {
          id: "dgauge_pointer",
          name: "指针表盘",
          description: "半圆刻度盘 + 指针，速度表风",
          tags: ["仪表", "指针", "汽车表盘"],
          prompt:
            "Build a speedometer-style gauge: a 180° arc with tick marks, a needle from the pivot, primary arc showing the value, and a big readout. Instrument-cluster feel.",
          code: `export function SpeedGauge() {
  const v = 68;
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-56">
      <path d="M10 64 A50 50 0 0 1 110 64" fill="none" stroke="var(--muted)" strokeWidth="8" strokeLinecap="round" opacity="0.35" />
      <path d="M10 64 A50 50 0 0 1 78 17.8" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" />
      {Array.from({ length: 11 }).map((_, i) => {
        const a = Math.PI * (1 - i / 10);
        return <line key={i} x1={60 + 44 * Math.cos(a)} y1={62 - 44 * Math.sin(a)} x2={60 + 50 * Math.cos(a)} y2={62 - 50 * Math.sin(a)} stroke="var(--border)" strokeWidth="1" />;
      })}
      <line x1="60" y1="62" x2={60 + 40 * Math.cos(Math.PI * (1 - v / 100))} y2={62 - 40 * Math.sin(Math.PI * (1 - v / 100))} stroke="var(--foreground)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="60" cy="62" r="3" fill="var(--primary)" />
      <text x="60" y="42" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)">{v}<tspan fontSize="8">%</tspan></text>
    </svg>
  );
}`,
          interaction: "半圆弧刻度、主色指针",
        },
      ],
    },
    {
      id: "dash-activity",
      name: "活动时间线",
      icon: "Activity",
      description: "纵向事件流：圆点 + 细线贯穿",
      variants: [
        {
          id: "dact_timeline",
          name: "活动时间线",
          description: "语义色节点 + 细线 + 时间戳",
          tags: ["时间线", "动态", "审计"],
          prompt:
            "Build an activity timeline: vertical list where each event has a colored dot node, a connecting hairline, a short description, and a relative timestamp. Semantic node colors by event type.",
          code: `export function ActivityTimeline() {
  const items = [
    { t: "你创建了项目「官网改版」", time: "10 分钟前", c: "var(--primary)" },
    { t: "李娜 上传了 3 张设计稿", time: "1 小时前", c: "var(--primary)" },
    { t: "王强 评论了「定价页」", time: "昨天", c: "var(--secondary)" },
  ];
  return (
    <ol className="space-y-0">
      {items.map((i, idx) => (
        <li key={idx} className="relative flex gap-3 pb-6 last:pb-0">
          {idx < items.length - 1 && <span className="absolute left-[4px] top-3 h-full w-px" style={{ background: "var(--border)" }} />}
          <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: i.c }} />
          <div className="min-w-0">
            <p className="text-sm leading-snug">{i.t}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{i.time}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}`,
          interaction: "节点语义色、细线贯穿、hover 高亮",
        },
        {
          id: "dact_cards",
          name: "卡片活动流",
          description: "事件卡片网格，非竖线",
          tags: ["活动", "卡片", "动态"],
          prompt:
            "Build a card activity feed: instead of a vertical line, each event is a bordered card with an icon chip, a title, a snippet, and a timestamp. Scannable like a changelog.",
          code: `export function ActivityCards() {
  const items = [
    { i: "＋", t: "创建了项目", d: "「官网改版」", time: "10 分钟前" },
    { i: "⇪", t: "上传了 3 张图", d: "设计稿 · 首页", time: "1 小时前" },
    { i: "💬", t: "发表了评论", d: "「定价页」定价逻辑", time: "昨天" },
  ];
  return (
    <div className="space-y-2">
      {items.map((e) => (
        <div key={e.t} className="flex items-center gap-3 rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>{e.i}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm"><span className="font-semibold">{e.t}</span> {e.d}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{e.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "图标圆底 + 卡片分割",
        },
        {
          id: "dact_commits",
          name: "提交日志",
          description: "等宽提交流，git 风格",
          tags: ["日志", "git", "暗黑"],
          prompt:
            "Build a git-style commit log: monospace rows with a short hash, the commit subject, a branch chip and an operator string, on a dark seamless feed. Developer-scoped.",
          code: `export function CommitLog() {
  const rows = [
    { h: "a1f2e3", m: "feat: 视觉风格画廊", b: "main", a: "李娜" },
    { h: "9c0b8a", m: "fix: 表格空态", b: "main", a: "王强" },
    { h: "b7d6c5", m: "refactor: 抽取 MoreTools", b: "flow", a: "张三" },
  ];
  return (
    <div className="space-y-1.5 font-mono text-xs">
      {rows.map((r) => (
        <p key={r.h} className="truncate">
          <span style={{ color: "var(--accent, var(--primary))" }}>{r.h}</span>
          <span style={{ color: "var(--muted-foreground)" }}> </span>
          <span>{r.m}</span> <span style={{ color: "var(--muted-foreground)" }}>·</span> <span style={{ color: "var(--muted-foreground)" }}>{r.b}</span> <span style={{ color: "var(--muted-foreground)" }}>·</span> <span style={{ color: "var(--muted-foreground)" }}>{r.a}</span>
        </p>
      ))}
    </div>
  );
}`,
          interaction: "等宽块、分支 chip、作者追加",
        },
        {
          id: "dact_bento",
          name: "聚合 Bento",
          description: "异尺寸卡片聚合，编辑感",
          tags: ["Bento", "编辑", "活动"],
          prompt:
            "Build an analytics bento activity: asymmetric cards of varying span (a headline event, a count, a sparkline of commits), magazine editorial tone.",
          code: `export function BentoActivity() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--primary) 8%, var(--surface))" }}>
        <p className="text-[11px] uppercase tracking-[0.15em]" style={{ color: "var(--primary)" }}>本周高光</p>
        <p className="mt-1 text-lg font-semibold" style={{ fontFamily: "var(--font-heading)" }}>24 次提交 · 3 个里程碑</p>
      </div>
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>128</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>活跃成员</p>
      </div>
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <div className="flex h-10 items-end gap-0.5">{Array.from({ length: 10 }).map((_, i) => <span key={i} className="w-full rounded-t" style={{ height: Math.min(40, 10 + (i % 5) * 6) + "px", background: i === 7 ? "var(--primary)" : "var(--muted)" }} />)}</div>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>趋势</p>
      </div>
    </div>
  );
}`,
          interaction: "异尺寸汇总卡、趋势 mini 柱",
        },
      ],
    },
    {
      id: "dash-transfer",
      name: "导入导出工具栏",
      icon: "Download",
      description: "数据导入 / 导出操作条",
      variants: [
        {
          id: "dtrans_toolbar",
          name: "导入导出栏",
          description: "标题 + 主/次操作按钮",
          tags: ["导入", "导出", "工具栏"],
          prompt:
            "Build an import/export toolbar: a bordered card with a title + supported formats on the left, and action buttons on the right — one primary filled (Import CSV) and two outlined (Export Excel / Sync).",
          code: `export function TransferBar() {
  const actions = [
    { n: "导入 CSV", i: "⇪", primary: true },
    { n: "导出 Excel", i: "⇩", primary: false },
    { n: "定时同步", i: "↻", primary: false },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div>
        <p className="text-sm font-semibold">数据导入 / 导出</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>支持 CSV · Excel · JSON</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a.n} className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium" style={a.primary ? { background: "var(--primary)", color: "var(--on-primary)" } : { border: "1px solid var(--border)", color: "var(--foreground)" }}>
            <span aria-hidden>{a.i}</span>{a.n}
          </button>
        ))}
      </div>
    </div>
  );
}`,
          interaction: "主操作实心、次要描边",
        },
        {
          id: "dtrans_drop",
          name: "拖放导入区",
          description: "虚线圈 + 拖放入口",
          tags: ["导入", "拖放", "上传"],
          prompt:
            "Build a drag-and-drop import zone: a dashed rounded area with an upload glyph, a hint line, and a small file-type note. Clear affordance for dropping files.",
          code: `export function DropZone() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center" style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--surface) 50%, transparent)" }}>
      <span className="flex size-11 items-center justify-center rounded-full text-lg" style={{ background: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>⇪</span>
      <p className="text-sm font-medium">拖拽文件到这里</p>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>或点击选择 · 支持 CSV / Excel / JSON · 单个不超过 10MB</p>
    </div>
  );
}`,
          interaction: "虚线圈拖放区、主色图标",
        },
        {
          id: "dtrans_jobs",
          name: "进度任务",
          description: "导入/导出任务进度列表",
          tags: ["导入", "进度", "任务"],
          prompt:
            "Build a transfer jobs list: each row is a running job with a filename, a progress bar, percentage, and a status. Looks like an active transfer queue.",
          code: `export function TransferJobs() {
  const jobs = [
    { f: "users_2026.csv", p: 72, s: "importing" },
    { f: "orders_export.xlsx", p: 100, s: "done" },
    { f: "backup_2026_08.json", p: 34, s: "importing" },
  ];
  return (
    <div className="space-y-3">
      {jobs.map((j) => (
        <div key={j.f} className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 flex-1 truncate font-mono text-sm">{j.f}</p>
            <span className="text-xs" style={{ color: j.s === "done" ? "var(--success)" : "var(--primary)" }}>{j.s === "done" ? "完成" : j.p + "%"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: j.p + "%", background: j.s === "done" ? "var(--success)" : "var(--primary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "任务进度条、完成/进行语义色",
        },
        {
          id: "dtrans_editorial",
          name: "编辑式导出",
          description: "衬线标题 + 细分导出项",
          tags: ["编辑", "导出", "刊物"],
          prompt:
            "Build an editorial export sheet: a hairline-divided list where each export format is a tappable row with a serif format name, a tiny description and a chevron. Quiet, magazine-like.",
          code: `export function EditorialExport() {
  const rows = [
    { f: "CSV", d: "原始行数据 · 可再入读" },
    { f: "Excel", d: "带样式的表格 · 适合报表" },
    { f: "JSON", d: "结构化完整对象 · 适合 API" },
  ];
  return (
    <div className="border-y" style={{ borderColor: "var(--border)" }}>
      {rows.map((r) => (
        <div key={r.f} className="flex items-center justify-between gap-4 border-b py-4 last:border-0" style={{ borderColor: "var(--border)" }}>
          <div>
            <p className="text-lg font-semibold font-heading" style={{ fontFamily: "var(--font-heading)" }}>{r.f}</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{r.d}</p>
          </div>
          <span aria-hidden style={{ color: "var(--muted-foreground)" }}>→</span>
        </div>
      ))}
    </div>
  );
}`,
          interaction: "衬线格式名、细线串联导出项",
        },
      ],
    },
  ],
};
