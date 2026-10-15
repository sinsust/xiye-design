// 全站文案自动生成：根据 AI 产品 PRD / 特征，产出贴合真实项目的 ContentOverride，
// 替代统一 demo 占位文案。包含 ① 本地启发式（离线/失败兜底）② LLM 生成（走「设置 → AI 模型」里用户配置的模型）③ 白名单清洗。

import { DEMO_CONTENT } from "@/data/skeleton-content";
import type { ContentOverride } from "@/lib/content-resolver";
import type { IntentNarrative } from "@/lib/ai-intent";

export interface CopyContext {
  projectName?: string | null;
  projectType?: string | null;
  narrative?: IntentNarrative | null;
}

function clean(s?: string | null): string {
  return (s ?? "").trim();
}

/**
 * 本地启发式：仅用「项目名 + 产品叙事」派生文案作为兜底，
 * 避免把 DEMO_CONTENT 里的演示品牌（Acme/为现代团队…）漏进真实项目。
 * 段落级区块（features/pricing/faq/…）有叙事源则用之，缺失才回退中性默认。
 */
export function generateCopyOverride(ctx: CopyContext): ContentOverride {
  const name = clean(ctx.projectName) || DEMO_CONTENT.product;
  const brand = name.length > 12 ? name.slice(0, 12) : name;
  const positioning = clean(ctx.narrative?.positioning);
  const vision = clean(ctx.narrative?.vision);
  const tagline = positioning || vision || `${name}，为你的用户而建`;
  const features = ctx.narrative?.coreFeatures ?? [];
  const firstFeature = features[0]?.name;
  const featItems = features.slice(0, 3).map((f) => ({ name: f.name, desc: f.why || "让团队专注交付真正有价值的结果" }));
  const heroHeading = positioning || `${name}：更快地把想法变成产品`;
  const heroSub = featItems.length
    ? `${name}一体化整合${featItems.map((f) => f.name).join("、")}，${featItems[0].desc}。`
    : clean(ctx.narrative?.marketFit) || vision || DEMO_CONTENT.hero.subheading;

  return {
    brand,
    product: name,
    tagline,
    cta: {
      primary: "免费开始",
      secondary: "了解更多",
      title: `准备好开始使用${brand}了吗？`,
      subheading: "免费体验，无需绑定信用卡，随时可取消。",
      button: "免费开始",
    },
    nav: {
      ...DEMO_CONTENT.nav,
      features: firstFeature || DEMO_CONTENT.nav.features,
    },
    hero: { badge: DEMO_CONTENT.hero.badge, heading: heroHeading, subheading: heroSub },
    auth: {
      loginTitle: `登录到 ${brand}`,
      signupTitle: `创建你的 ${brand} 账户`,
      email: DEMO_CONTENT.auth.email,
      password: DEMO_CONTENT.auth.password,
      username: DEMO_CONTENT.auth.username,
    },
    footer: { tagline, copyright: `© ${new Date().getFullYear()} ${brand}，保留所有权利。` },
    dashboard: { title: positioning ? `${name} 控制台` : DEMO_CONTENT.dashboard.title },
    features: {
      title: positioning || `${name} 的核心能力`,
      subtitle: "一个平台，一站式搞定",
      items: featItems.length ? featItems : DEMO_CONTENT.features.items,
    },
  };
}

// ───────────────────────── LLM 生成 + 白名单清洗 ─────────────────────────


export function buildCopyContextText(ctx: CopyContext): string {
  const n = ctx.narrative;
  const features = (n?.coreFeatures ?? []).map((f) => `${f.name}（${f.why}）`).join("；");
  return [
    `项目名：${clean(ctx.projectName) || DEMO_CONTENT.product}`,
    ctx.projectType ? `项目类型：${ctx.projectType}` : "",
    n?.vision ? `愿景：${n.vision}` : "",
    n?.positioning ? `定位：${n.positioning}` : "",
    n?.targetAudience?.length ? `目标用户：${n.targetAudience.join("、")}` : "",
    features ? `核心功能：${features}` : "",
    n?.marketFit ? `市场契合：${n.marketFit}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// —— 结构化白名单：与 COPY_SCHEMA_JSON 一一对应，只放行这些键，杜绝 LLM 塞入未知 key ——
type SpecStr = { t: "s" };
type SpecObj = { t: "o"; children: Record<string, Spec> };
type SpecArr = { t: "a"; item: Spec };
type Spec = SpecStr | SpecObj | SpecArr;

const str: SpecStr = { t: "s" };
const arr = (item: Spec): SpecArr => ({ t: "a", item });

const COPY_SPEC: Spec = {
  t: "o",
  children: {
    brand: str, product: str, tagline: str,
    cta: { t: "o", children: { primary: str, secondary: str, title: str, subheading: str, button: str } },
    nav: { t: "o", children: { features: str, pricing: str, faq: str, docs: str, blog: str } },
    hero: { t: "o", children: { badge: str, heading: str, subheading: str } },
    auth: { t: "o", children: { loginTitle: str, signupTitle: str, email: str, password: str, username: str } },
    footer: { t: "o", children: { tagline: str, copyright: str } },
    features: { t: "o", children: { title: str, subtitle: str, items: arr({ t: "o", children: { name: str, desc: str } }) } },
    pricing: {
      t: "o",
      children: {
        title: str, subtitle: str,
        plans: arr({ t: "o", children: { name: str, price: str, period: str, desc: str, features: arr(str), cta: str } }),
      },
    },
    faq: { t: "o", children: { title: str, subtitle: str, items: arr({ t: "o", children: { q: str, a: str } }) } },
    stats: { t: "o", children: { title: str, items: arr({ t: "o", children: { label: str, value: str } }) } },
    testimonials: {
      t: "o",
      children: { title: str, subtitle: str, items: arr({ t: "o", children: { quote: str, name: str, role: str } }) },
    },
    process: { t: "o", children: { title: str, items: arr({ t: "o", children: { name: str, desc: str } }) } },
    logos: arr(str),
    dashboard: {
      t: "o",
      children: {
        title: str, greeting: str, topbarTitle: str,
        kpis: arr({ t: "o", children: { label: str, value: str, trend: str } }),
        chartTitle: str, tabs: arr(str), filters: arr(str),
        tasks: arr({ t: "o", children: { title: str, meta: str, due: str } }),
        notifications: arr({ t: "o", children: { text: str, time: str } }),
        activity: arr({ t: "o", children: { text: str, time: str } }),
        permissions: arr(str),
        transfer: arr({ t: "o", children: { name: str, meta: str, amount: str } }),
        table: arr({ t: "o", children: { name: str, company: str, status: str } }),
      },
    },
    blog: { t: "o", children: { title: str, subtitle: str, tags: arr(str), posts: arr({ t: "o", children: { title: str, excerpt: str, date: str, tag: str } }), postTitle: str, postBody: str } },
    portfolio: { t: "o", children: { title: str, subtitle: str, projects: arr({ t: "o", children: { title: str, desc: str, tag: str } }) } },
    shop: { t: "o", children: { title: str, subtitle: str, galleryTitle: str, infoTitle: str, products: arr({ t: "o", children: { name: str, price: str, desc: str } }) } },
    about: { t: "o", children: { title: str, subtitle: str, story: str, values: arr({ t: "o", children: { label: str, desc: str } }), team: arr({ t: "o", children: { name: str, role: str } }) } },
    contact: { t: "o", children: { title: str, subtitle: str, formTitle: str, formFields: arr(str), infoItems: arr({ t: "o", children: { label: str, value: str } }) } },
    docs: { t: "o", children: { title: str, subtitle: str, nav: arr(str), searchTitle: str, sections: arr({ t: "o", children: { title: str, body: str } }) } },
    chat: { t: "o", children: { title: str, placeholder: str, suggestions: arr(str), messages: arr({ t: "o", children: { role: str, text: str } }) } },
    misc: {
      t: "o",
      children: {
        notFound: { t: "o", children: { title: str, subtitle: str, button: str } },
        coming: { t: "o", children: { title: str, subtitle: str, button: str, date: str } },
      },
    },
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sanitizeNode(raw: unknown, spec: Spec): unknown {
  if (spec.t === "s") return typeof raw === "string" ? raw : undefined;
  if (spec.t === "a") {
    if (!Array.isArray(raw)) return undefined;
    const items = raw.map((x) => sanitizeNode(x, spec.item)).filter((x) => x !== undefined);
    return items.length ? items : undefined;
  }
  if (!isPlainObject(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, s] of Object.entries(spec.children)) {
    const v = sanitizeNode(raw[k], s);
    if (v !== undefined) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** 只保留白名单内的结构（含段落级区块），空段丢弃，杜绝非法 key 进入覆盖层 */
export function sanitizeCopy(raw: unknown): ContentOverride {
  return (sanitizeNode(raw, COPY_SPEC) ?? {}) as ContentOverride;
}

/** 统计文案覆盖层相对旧内容发生了哪些顶层变化（用于生成后给用户简短反馈）。
 * 只比较字符串/数组的顶层字段，返回变化的字段路径与数量。 */
export function summarizeCopyChanges(
  oldOverride: ContentOverride | undefined,
  newOverride: ContentOverride,
): { count: number; paths: string[] } {
  const paths: string[] = [];
  const walk = (obj: unknown, prefix: string) => {
    if (obj == null) return;
    if (typeof obj === "string") {
      const oldVal = prefix
        .split(".")
        .reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), oldOverride);
      if (oldVal !== obj) paths.push(prefix);
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${prefix}[${i}]`));
      return;
    }
    if (typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  walk(newOverride, "");
  return { count: paths.length, paths: paths.slice(0, 6) };
}
