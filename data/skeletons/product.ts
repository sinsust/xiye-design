// 电商页（Product）页面骨架数据。
// 图片用 picsum.photos 免费 seed（商品图/生活图）。

import type { SkeletonPage } from "./types";

export const PRODUCT_PAGE: SkeletonPage = {
  id: "product",
  name: "电商",
  icon: "ShoppingBag",
  description: "电商站：商品画廊、商品信息、商品卡、购物车，转化的关键路径",
  components: [
    {
      id: "product-gallery",
      name: "商品画廊",
      icon: "Image",
      description: "商品大图与缩略图展示",
      variants: [
        {
          id: "pgallery_main",
          name: "大图 + 缩略图",
          description: "主图 + 下方缩略图行，标准电商",
          tags: ["画廊", "标准"],
          prompt:
            "Build a product gallery: one large main image with a small zoom icon, a row of 4 thumbnails below (first one active with primary border), and a 'New' badge on the main image. Clean surface background.",
          code: `export function ProductGallery() {
  const [active, setActive] = useState(0);
  const thumbs = [
    "https://picsum.photos/seed/xiye-prod-1/400/500",
    "https://picsum.photos/seed/xiye-prod-2/400/500",
    "https://picsum.photos/seed/xiye-prod-3/400/500",
    "https://picsum.photos/seed/xiye-prod-4/400/500",
  ];
  return (
    <div className="relative">
      <span className="absolute left-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-medium text-white" style={{ background: "var(--primary)" }}>新品</span>
      <div className="group overflow-hidden rounded-2xl">
        <img
          key={active}
          src={thumbs[active]}
          alt="商品主图"
          className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          style={{ animation: "galleryIn 0.35s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-3">
        {thumbs.map((t, i) => (
          <button
            key={t}
            type="button"
            onClick={() => setActive(i)}
            aria-label={"查看第 " + (i + 1) + " 张图"}
            className={"overflow-hidden rounded-lg transition " + (i === active ? "ring-2 ring-[var(--primary)]" : "opacity-60 hover:opacity-100")}
          >
            <img src={t} alt={"缩略图 " + (i + 1)} className="aspect-square w-full object-cover transition-transform duration-300 hover:scale-110" />
          </button>
        ))}
      </div>
      <style>{\`@keyframes galleryIn { from { opacity: 0.4; transform: scale(1.03); } to { opacity: 1; transform: scale(1); } }\`}</style>
    </div>
  );
}`,
          interaction: "缩略图切换主图；新品角标",
        },
        {
          id: "pgallery_split",
          name: "分栏双图",
          description: "左右两张大图错落，高级感",
          tags: ["分栏", "高级"],
          prompt:
            "Build an editorial product gallery: two large images in an asymmetric split (left tall 3:4, right two stacked), generous whitespace, no borders. Premium fashion/design brand feel.",
          code: `export function ProductGallery() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1.1fr_1fr]">
      <img src="https://picsum.photos/seed/xiye-prod-a/700/900" alt="商品图 A" className="aspect-[3/4] w-full rounded-2xl object-cover" />
      <div className="grid gap-4">
        <img src="https://picsum.photos/seed/xiye-prod-b/700/500" alt="商品图 B" className="w-full rounded-2xl object-cover" />
        <img src="https://picsum.photos/seed/xiye-prod-c/700/500" alt="商品图 C" className="w-full rounded-2xl object-cover" />
      </div>
    </div>
  );
}`,
          interaction: "错落分栏大图，留白呼吸",
        },
      ],
    },
    {
      id: "product-info",
      name: "商品信息",
      icon: "Info",
      description: "标题/价格/规格/购买区",
      variants: [
        {
          id: "pinfo_standard",
          name: "标准购买区",
          description: "标题 + 价格 + 规格 + 数量 + 加购",
          tags: ["标准", "转化"],
          prompt:
            "Build a product info panel: breadcrumb, brand, title, price + compare price, rating row, color swatches (4 circles, one active), size pills, quantity stepper, Add to Cart (primary) + Buy Now (outline) buttons, accordion for description/shipping.",
          code: `export function ProductInfo() {
  const colors = ["var(--primary)", "var(--warning)", "var(--foreground)", "var(--border)"];
  const sizes = ["S", "M", "L", "XL"];
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>首页 / 服饰 / 外套</p>
      <p className="mt-3 text-xs font-medium uppercase tracking-widest" style={{ color: "var(--primary)" }}>{{brand}}</p>
      <h1 className="mt-1.5 text-2xl font-bold">轻量机能夹克</h1>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-xl font-black">¥699</p>
        <p className="text-sm line-through" style={{ color: "var(--muted-foreground)" }}>¥899</p>
      </div>
      <p className="mt-3 text-sm" style={{ color: "var(--muted-foreground)" }}>三防面料 · 透气内衬 · 四季可穿</p>
      <div className="mt-5">
        <p className="text-sm font-medium">颜色</p>
        <div className="mt-2 flex gap-2">
          {colors.map((c, i) => (
            <button key={c} aria-label={"颜色 " + (i + 1)} className={"size-7 rounded-full border-2 " + (i === 0 ? "" : "opacity-70")} style={{ background: c, borderColor: i === 0 ? "var(--primary)" : "transparent" }} />
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium">尺码</p>
        <div className="mt-2 flex gap-2">
          {sizes.map((s, i) => (
            <button key={s} className={["rounded-md border px-3 py-1.5 text-sm transition", i === 1 ? "text-white" : "hover:bg-muted"].join(" ")} style={i === 1 ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}>{s}</button>
          ))}
        </div>
      </div>
      <div className="mt-6 flex gap-3">
        <a href="#cart" className="flex-1 rounded-lg py-3 text-center text-sm font-medium text-white transition hover:opacity-90" style={{ background: "var(--primary)" }}>加入购物车</a>
        <a href="#buy" className="flex-1 rounded-lg border py-3 text-center text-sm font-medium transition hover:bg-muted" style={{ borderColor: "var(--border)" }}>立即购买</a>
      </div>
    </div>
  );
}`,
          interaction: "颜色/尺码选中态；双 CTA 转化",
        },
        {
          id: "pinfo_editorial",
          name: "编辑式详情",
          description: "衬线标题 + 细线分隔规格，高端感",
          tags: ["编辑式", "高级"],
          prompt:
            "Build an editorial product info: serif title, minimal price, hairline-separated spec rows (材质/产地/工艺), small add-to-cart as a full-width pill. Luxury brand restraint.",
          code: `export function ProductInfo() {
  const specs = [
    { k: "材质", v: "再生尼龙 78% · 棉 22%" },
    { k: "产地", v: "葡萄牙" },
    { k: "工艺", v: "无缝压胶 · 3 年质保" },
  ];
  return (
    <div className="px-2">
      <p className="text-[11px] uppercase tracking-[0.3em]" style={{ color: "var(--muted-foreground)" }}>{{brand}} · 2025 秋冬</p>
      <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>轻量机能夹克</h1>
      <p className="mt-2 text-lg font-medium">¥699</p>
      <div className="mt-6 border-t" style={{ borderColor: "var(--border)" }}>
        {specs.map((s) => (
          <div key={s.k} className="flex justify-between border-b py-3 text-sm" style={{ borderColor: "var(--border)" }}>
            <span style={{ color: "var(--muted-foreground)" }}>{s.k}</span>
            <span className="text-right font-medium">{s.v}</span>
          </div>
        ))}
      </div>
      <a href="#cart" className="mt-6 block rounded-full py-3 text-center text-sm font-medium text-white" style={{ background: "var(--primary)" }}>加入购物车</a>
    </div>
  );
}`,
          interaction: "衬线标题 + 细线规格行",
        },
      ],
    },
    {
      id: "product-grid",
      name: "商品卡",
      icon: "LayoutGrid",
      description: "商品陈列网格",
      variants: [
        {
          id: "pgrid_card",
          name: "图卡网格",
          description: "图 + 名称 + 价格，hover 上浮",
          tags: ["网格", "标准"],
          prompt:
            "Build a product card grid: responsive 4-col grid, each card with image (aspect 4/5), product name, price, hover lift + image zoom. Optional quick-add button appearing on hover. Section heading + sort dropdown.",
          code: `export function ProductGrid() {
  const prods = [
    { t: "轻量机能夹克", p: "¥699", img: "https://picsum.photos/seed/xiye-prod-1/600/750" },
    { t: "羊毛混纺大衣", p: "¥1,299", img: "https://picsum.photos/seed/xiye-prod-2/600/750" },
    { t: "工装斜纹裤", p: "¥459", img: "https://picsum.photos/seed/xiye-prod-3/600/750" },
    { t: "帆布托特包", p: "¥329", img: "https://picsum.photos/seed/xiye-prod-4/600/750" },
  ];
  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">新品上架</h2>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>按新品排序 ▾</span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-5 lg:grid-cols-4">
          {prods.map((p) => (
            <a key={p.t} href="#prod" className="group">
              <div className="overflow-hidden rounded-xl">
                <img src={p.img} alt={p.t} loading="lazy" className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
              </div>
              <p className="mt-2.5 text-sm font-medium">{p.t}</p>
              <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>{p.p}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "hover 图缩放 + 标题上浮",
        },
        {
          id: "pgrid_hlist",
          name: "横排商品条",
          description: "大图横条 + 文字说明，编辑式",
          tags: ["横条", "编辑式"],
          prompt:
            "Build an editorial product list: each product is a horizontal row with a medium image on the left, name + description + price on the right, separated by hairlines. Magazine-like, for premium catalogs.",
          code: `export function ProductList() {
  const prods = [
    { t: "轻量机能夹克", d: "三防面料 · 四季可穿", p: "¥699", img: "https://picsum.photos/seed/xiye-prod-1/400/300" },
    { t: "羊毛混纺大衣", d: "意大利羊毛 · 手工缝制", p: "¥1,299", img: "https://picsum.photos/seed/xiye-prod-2/400/300" },
    { t: "帆布托特包", d: "加密帆布 · 加厚提手", p: "¥329", img: "https://picsum.photos/seed/xiye-prod-4/400/300" },
  ];
  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-2xl font-black tracking-tight" style={{ fontFamily: "'PP Editorial New', 'Newsreader', Georgia, serif" }}>本季精选</h2>
        <div className="mt-6">
          {prods.map((p) => (
            <a key={p.t} href="#prod" className="group flex items-center gap-6 border-b py-5" style={{ borderColor: "var(--border)" }}>
              <img src={p.img} alt={p.t} loading="lazy" className="h-24 w-32 rounded-lg object-cover" />
              <div className="flex-1">
                <p className="text-lg font-medium transition group-hover:text-[var(--primary)]">{p.t}</p>
                <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>{p.d}</p>
              </div>
              <p className="text-base font-semibold">{p.p}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}`,
          interaction: "横条图 + 细线分隔",
        },
      ],
    },
    {
      id: "product-cart",
      name: "购物车",
      icon: "ShoppingCart",
      description: "购物车行与结算汇总",
      variants: [
        {
          id: "pcart_list",
          name: "购物车列表",
          description: "行项目 + 数量 + 删除",
          tags: ["购物车", "标准"],
          prompt:
            "Build a cart list: rows with product image, name, unit price, quantity stepper, line total, remove button. Column headers (商品/单价/数量/小计), bottom row shows subtotal. Bordered table feel.",
          code: `export function CartList() {
  const items = [
    { t: "轻量机能夹克", p: 699, q: 1, img: "https://picsum.photos/seed/xiye-prod-1/200/250" },
    { t: "帆布托特包", p: 329, q: 2, img: "https://picsum.photos/seed/xiye-prod-4/200/250" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="hidden grid-cols-[1fr_80px_80px_60px] gap-4 border-b px-5 py-3 text-xs sm:grid" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
        <span>商品</span><span>单价</span><span>数量</span><span className="text-right">小计</span>
      </div>
      {items.map((it) => (
        <div key={it.t} className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-5 py-4 last:border-0 sm:grid-cols-[1fr_80px_80px_60px]" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <img src={it.img} alt={it.t} className="h-14 w-12 rounded-lg object-cover" />
            <span className="text-sm font-medium">{it.t}</span>
          </div>
          <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>¥{it.p}</span>
          <div className="flex items-center gap-2">
            <button className="size-6 rounded border" style={{ borderColor: "var(--border)" }}>−</button>
            <span className="w-5 text-center text-sm">{it.q}</span>
            <button className="size-6 rounded border" style={{ borderColor: "var(--border)" }}>+</button>
          </div>
          <span className="text-right text-sm font-semibold">¥{it.p * it.q}</span>
        </div>
      ))}
      <div className="flex items-center justify-between px-5 py-4">
        <span className="text-sm" style={{ color: "var(--muted-foreground)" }}>运费：满 ¥399 免运费</span>
        <span className="text-sm">小计 <b>¥{699 + 329 * 2}</b></span>
      </div>
    </div>
  );
}`,
          interaction: "数量步进器；免邮提示",
        },
        {
          id: "pcart_summary",
          name: "结算汇总卡",
          description: "金额明细 + 优惠码 + 结算按钮",
          tags: ["结算", "转化"],
          prompt:
            "Build an order summary card: subtotal, shipping, discount (with promo code input), total highlighted, Checkout button (primary), and a trust row (secure payment icons or guarantee text). For cart sidebars.",
          code: `export function CartSummary() {
  const rows = [
    { k: "小计", v: "¥1,357" },
    { k: "运费", v: "免运费" },
    { k: "优惠码 WELCOME10", v: "-¥135" },
  ];
  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <p className="text-base font-bold">订单摘要</p>
      <div className="mt-4 space-y-2.5 text-sm">
        {rows.map((r) => (
          <div key={r.k} className="flex justify-between">
            <span style={{ color: "var(--muted-foreground)" }}>{r.k}</span>
            <span className={r.v.startsWith("-") ? "font-medium text-green-600" : "font-medium"}>{r.v}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-3 text-base" style={{ borderColor: "var(--border)" }}>
          <span className="font-bold">合计</span>
          <span className="font-black">¥1,222</span>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input placeholder="优惠码" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: "var(--border)" }} />
        <button className="rounded-lg border px-3 text-sm font-medium" style={{ borderColor: "var(--border)" }}>应用</button>
      </div>
      <a href="#checkout" className="mt-4 block rounded-lg py-3 text-center text-sm font-medium text-white" style={{ background: "var(--primary)" }}>去结算</a>
      <p className="mt-3 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>🔒 安全加密支付 · 7 天无理由退换</p>
    </div>
  );
}`,
          interaction: "优惠码输入；合计高亮",
        },
      ],
    },
  ],
};
