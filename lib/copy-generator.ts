// 全站文案自动生成：根据 AI 产品 PRD / 特征，产出贴合真实项目的 ContentOverride，
// 替代统一 demo 占位文案。包含 ① 本地启发式（离线/失败兜底）② LLM 生成（默认走 LLM_MODEL_* / Qwen）③ 白名单清洗。

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

/** 供 LLM 填空的 JSON 骨架（只允许这些键，值均空） */
const COPY_SCHEMA_JSON = `{
  "brand": "", "product": "", "tagline": "",
  "cta": { "primary": "", "secondary": "", "title": "", "subheading": "", "button": "" },
  "nav": { "features": "", "pricing": "", "faq": "", "docs": "", "blog": "" },
  "hero": { "badge": "", "heading": "", "subheading": "" },
  "auth": { "loginTitle": "", "signupTitle": "", "email": "", "password": "", "username": "" },
  "footer": { "tagline": "", "copyright": "" },
  "dashboard": { "title": "" },
  "features": { "title": "", "subtitle": "", "items": [{ "name": "", "desc": "" }] },
  "pricing": { "title": "", "subtitle": "", "plans": [{ "name": "", "price": "", "period": "", "desc": "", "features": [], "cta": "" }] },
  "faq": { "title": "", "subtitle": "", "items": [{ "q": "", "a": "" }] },
  "stats": { "title": "", "items": [{ "label": "", "value": "" }] },
  "testimonials": { "title": "", "subtitle": "", "items": [{ "quote": "", "name": "", "role": "" }] },
  "process": { "title": "", "items": [{ "name": "", "desc": "" }] },
  "logos": [],
  "dashboard": {
    "title": "", "greeting": "", "topbarTitle": "",
    "kpis": [{ "label": "", "value": "", "trend": "" }],
    "chartTitle": "", "tabs": [], "filters": [],
    "tasks": [{ "title": "", "meta": "", "due": "" }],
    "notifications": [{ "text": "", "time": "" }],
    "activity": [{ "text": "", "time": "" }],
    "permissions": [], "transfer": [{ "name": "", "meta": "", "amount": "" }],
    "table": [{ "name": "", "company": "", "status": "" }]
  },
  "blog": { "title": "", "subtitle": "", "tags": [], "posts": [{ "title": "", "excerpt": "", "date": "", "tag": "" }], "postTitle": "", "postBody": "" },
  "portfolio": { "title": "", "subtitle": "", "projects": [{ "title": "", "desc": "", "tag": "" }] },
  "shop": { "title": "", "subtitle": "", "galleryTitle": "", "infoTitle": "", "products": [{ "name": "", "price": "", "desc": "" }] },
  "about": { "title": "", "subtitle": "", "story": "", "values": [{ "label": "", "desc": "" }], "team": [{ "name": "", "role": "" }] },
  "contact": { "title": "", "subtitle": "", "formTitle": "", "formFields": [], "infoItems": [{ "label": "", "value": "" }] },
  "docs": { "title": "", "subtitle": "", "nav": [], "searchTitle": "", "sections": [{ "title": "", "body": "" }] },
  "chat": { "title": "", "placeholder": "", "suggestions": [], "messages": [{ "role": "", "text": "" }] },
  "misc": { "notFound": { "title": "", "subtitle": "", "button": "" }, "coming": { "title": "", "subtitle": "", "button": "", "date": "" } }
}`;

const COPY_SYSTEM_PROMPT = `你是一位资深营销文案 + 产品市场经理。用户会给你产品的背景（名称、类型、定位/愿景、目标用户、核心功能）。
请你为该产品撰写一整套真实、贴合实际的「网站文案」，用于替换那些千篇一律的 demo 占位文案（比如 "Acme / 为现代团队打造的一体化云平台"）。

硬性要求：
1. 只输出一个 JSON 对象，key 必须严格等于下方 schema（不可增删），所有值都是纯字符串/字符串数组，语言为简体中文。
2. 文案要具体、有代入感，抓住该产品的目标用户与核心使用场景，用词贴合行业，避免模板化套话；各字段彼此呼应成统一的品牌语调。
3. 依真实产品填写：brand=品牌名（≤12字），product=产品全名，tagline=一句话价值主张，hero=能撑起落地页说服力的首屏文案；nav/auth/footer 按产品领域自动改写；features/pricing/faq/stats/testimonials/process 等区块按该产品的真实能力、定价思路、常见疑问、数据背书、客户证言与上手流程撰写。
4. **硬性长度约束（必须遵守，防止 UI 按钮/标签溢出或折行）**：
   - 按钮与 tab 标签（cta.primary、cta.secondary、cta.button、nav.*、features.items[].name、pricing.plans[].name、stats.items[].label、process.items[].name）控制在 **2-4 个字**，最多不超过 5 个字。
   - 小标题（features.subtitle、pricing.subtitle、faq.subtitle 等）控制在 **6-12 个字**。
   - 主标题（hero.heading、features.title、pricing.title、faq.title）控制在 **8-16 个字**。
   - 描述/证言/FAQ 答案可稍长，但 hero.subheading 不超过 30 字，cta.subheading 不超过 24 字。
5. 只输出 JSON，不要 markdown 代码块，不要任何解释文字。

Schema（填空）：
${COPY_SCHEMA_JSON}`;

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
function sanitizeCopy(raw: unknown): ContentOverride {
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

/** 用 LLM 生成（OpenAI 兼容，默认 LLM_MODEL_* / Qwen），失败则回退启发式 */
export async function generateCopyWithLLM(
  ctx: CopyContext,
  apiKey = process.env.LLM_MODEL_API_KEY || "",
  baseUrl = (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, ""),
  model = process.env.LLM_MODEL_MODEL_ID || "",
): Promise<ContentOverride> {
  const base = generateCopyOverride(ctx);
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: COPY_SYSTEM_PROMPT },
        { role: "user", content: `产品背景：\n${buildCopyContextText(ctx)}` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`copy_ai_${res.status}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  // LLM 结果覆盖在启发式基础上，保证所有键都有值
  return { ...base, ...sanitizeCopy(parsed) };
}