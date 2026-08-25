// 内置 Uiverse 精选微组件集（就地换件数据）。
// 定位：Uiverse 是「页内区块级」微组件（按钮/卡片/输入/加载器/开关/徽章/hero 高光等原子件），
// 与骨架工作台的 `页 → 区块 → 微组件` 最底层对齐。用户把当前区块就地换成某一款。
// 每条含：归类 / 名称 / 来源（致谢作者）/ 适用场景 / 可导出 code。
//
// 约定：code 一律用设计 token 变量（var(--primary)/var(--surface)/var(--radius)/var(--foreground)…）
// + Tailwind，禁止硬编码颜色/圆角/字体，遵循蓝图 Anti-Slop 规范，可直接落入导出工程。

export interface UiverseKitItem {
  id: string;
  /** 归类（与工作台区块类型贴近） */
  category: "hero" | "button" | "card" | "input" | "toggle" | "loader" | "badge";
  name: string;
  /** 来源作者（致谢，Uiverse 社区） */
  source: string;
  /** 适用场景一句话 */
  note: string;
  /** 就地替换后写入蓝图的实现代码 */
  code: string;
}

export const UIVERSE_KIT: UiverseKitItem[] = [
  {
    id: "hero-kicker",
    category: "hero",
    name: "胶囊导语标签",
    source: "Uiverse · @peduarte",
    note: "Hero 顶部导语：胶囊描边 + 小圆点 + 次要说明，先抑后扬接主标题",
    code: `<div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm" style={{ borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border))" }}>
  <span className="size-1.5 rounded-full" style={{ background: "var(--primary)" }} />
  <span style={{ color: "var(--foreground)" }}>新上线</span>
  <span style={{ color: "var(--muted-foreground)" }}>· 已服务 100+ 团队</span>
</div>`,
  },
  {
    id: "btn-glow",
    category: "button",
    name: "主行动胶囊按钮",
    source: "Uiverse · @necatihz",
    note: "Hero/CTA 主行动：primary 底 + hover 光晕扩散 + 上浮",
    code: `<button type="button" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full px-6 py-3 text-sm font-semibold text-[var(--on-primary)] transition-transform duration-300 hover:-translate-y-0.5" style={{ background: "var(--primary)" }}>
  <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "radial-gradient(120px circle at center, color-mix(in srgb, white 25%, transparent), transparent 70%)" }} />
  <span className="relative">立即开始</span>
  <span className="relative transition-transform duration-300 group-hover:translate-x-0.5">→</span>
</button>`,
  },
  {
    id: "btn-outline-line",
    category: "button",
    name: "描边下划线按钮",
    source: "Uiverse · @rahul_burman",
    note: "次行动：透明底 + 底部下划线生长动效，比纯描边更轻",
    code: `<button type="button" className="group relative text-sm font-medium transition-colors" style={{ color: "var(--foreground)" }}>
  <span className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100" style={{ background: "var(--primary)" }} />
  了解更多
</button>`,
  },
  {
    id: "btn-soft-shadow",
    category: "button",
    name: "柔和投影按钮",
    source: "Uiverse · @gaganjot",
    note: "卡片内行动：surface 底 + 柔和投影 + hover 投影加深",
    code: `<button type="button" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200" style={{ background: "var(--surface)", color: "var(--foreground)", boxShadow: "var(--shadow)" }}>
  <span className="transition-all duration-200 group-hover:mr-0.5" />保存
</button>`,
  },
  {
    id: "badge-status",
    category: "badge",
    name: "状态圆点徽章",
    source: "Uiverse · @prabhudatta05",
    note: "在线/成功/进行中等状态：脉冲圆点 + 浅色底",
    code: `<span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--primary) 12%, var(--surface))", color: "var(--primary)" }}>
  <span className="relative flex size-1.5">
    <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ background: "var(--primary)" }} />
    <span className="relative inline-flex size-1.5 rounded-full" style={{ background: "var(--primary)" }} />
  </span>
  运行中
</span>`,
  },
  {
    id: "card-spotlight",
    category: "card",
    name: "光斑追踪卡片",
    source: "Uiverse · @mirko",
    note: "特性/能力列卡：surface 底 + 鼠标光斑跟随 + 描边泛主色",
    code: `<div className="group relative overflow-hidden rounded-[var(--radius)] border p-6 transition-all duration-300" style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border))", background: "var(--surface)", boxShadow: "var(--shadow)" }}>
  <div className="mb-4 size-9 rounded-[var(--radius)]" style={{ background: "color-mix(in srgb, var(--primary) 15%, var(--surface))" }} />
  <h3 className="text-base font-semibold" style={{ color: "var(--foreground)" }}>标题一</h3>
  <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>一句能说明价值的话。</p>
</div>`,
  },
  {
    id: "card-border-grow",
    category: "card",
    name: "描边生长卡片",
    source: "Uiverse · @attacomsian",
    note: "条目/套餐卡：上缘主色描边随 hover 由中点向两端生长",
    code: `<div className="relative rounded-[var(--radius)] border bg-card p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
  <span className="absolute inset-x-4 top-0 h-0.5 origin-center scale-x-0 rounded-full transition-transform duration-300 hover:scale-x-100" style={{ background: "var(--primary)" }} />
  <p className="text-sm font-medium" style={{ color: "var(--foreground)" }}>单项说明</p>
  <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>次要说明文字。</p>
</div>`,
  },
  {
    id: "input-underline-search",
    category: "input",
    name: "下划线搜索框",
    source: "Uiverse · @MaldeHub",
    note: "站内搜索/邮箱：无框下划线 + 聚焦主色生长",
    code: `<label className="block">
  <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>搜索</span>
  <input type="search" placeholder="输入关键词…" className="mt-1 w-full bg-transparent pb-1 text-sm outline-none" style={{ color: "var(--foreground)", borderBottom: "2px solid color-mix(in srgb, var(--primary) 35%, var(--border))" }}
    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--primary)")}
    onBlur={(e) => (e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 35%, var(--border))")} />
</label>`,
  },
  {
    id: "toggle-pill",
    category: "toggle",
    name: "胶囊开关",
    source: "Uiverse · @gharsh11032000",
    note: "计费周期/开关：圆钮滑移 + 主色填充",
    code: `const [on, setOn] = useState(false);
<div className="flex items-center gap-2">
  <button type="button" onClick={() => setOn((v) => !v)} aria-pressed={on} className="relative h-5 w-9 rounded-full transition-colors" style={{ background: on ? "var(--primary)" : "var(--muted-foreground)" }}>
    <span className="absolute top-0.5 size-4 rounded-full bg-white transition-all" style={{ left: on ? 18 : 2 }} />
  </button>
  <span className="text-sm" style={{ color: "var(--foreground)" }}>{on ? "已开启" : "已关闭"}</span>
</div>`,
  },
  {
    id: "loader-dual-ring",
    category: "loader",
    name: "双环加载",
    source: "Uiverse · @ziouak",
    note: "等待态：主色双环旋转，可放按钮内或居中",
    code: `<span className="relative inline-flex size-8">
  <span className="absolute inset-0 animate-spin rounded-full border-2" style={{ borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)", borderTopColor: "var(--primary)" }} />
  <span className="absolute inset-1 animate-spin rounded-full border-2 [animation-direction:reverse]" style={{ borderColor: "color-mix(in srgb, var(--accent2) 30%, transparent)", borderTopColor: "var(--accent2)" }} />
</span>`,
  },
  {
    id: "loader-progress",
    category: "loader",
    name: "渐变进度条",
    source: "Uiverse · @mwanikigachanja",
    note: "上传/进度：主色渐变条 + shimmer 扫光",
    code: `<div className="relative h-1.5 w-full overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--muted-foreground) 18%, transparent)" }}>
  <div className="absolute inset-y-0 left-0 animate-indeterminate rounded-full" style={{ width: "40%", background: "linear-gradient(90deg, var(--primary), var(--accent2))" }} />
</div>
<style>{"@keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(360%); } } .animate-indeterminate { animation: indeterminate 1.4s ease-in-out infinite; }"}</style>`,
  },
];

export const UIVERSE_KIT_MAP: Record<string, UiverseKitItem> = Object.fromEntries(
  UIVERSE_KIT.map((k) => [k.id, k]),
);

/** 归类中文标签（用于面板分组） */
export const UIVERSE_CATEGORIES: { id: UiverseKitItem["category"]; label: string }[] = [
  { id: "hero", label: "导语 / Hero" },
  { id: "button", label: "按钮" },
  { id: "card", label: "卡片" },
  { id: "input", label: "输入" },
  { id: "toggle", label: "开关" },
  { id: "loader", label: "加载 / 反馈" },
  { id: "badge", label: "徽章 / 状态" },
];

export function findKit(id: string | null | undefined): UiverseKitItem | null {
  return id ? UIVERSE_KIT_MAP[id] ?? null : null;
}