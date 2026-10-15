// 文案生成 —— LLM 路径（仅服务端）。
//
// 为什么单独一个文件：generateCopyWithLLM 要写 AI 用量表（lib/llm/usage），
// 而那条链最终会碰到 next/headers。客户端页面只需要纯函数（启发式生成与摘要），
// 混在一起会让 next build 把服务端模块打进浏览器包并直接报错。
// 命名沿用本仓约定：*-server.ts = 仅服务端可用。
import {
  buildCopyContextText,
  generateCopyOverride,
  sanitizeCopy,
  type CopyContext,
} from "@/lib/copy-generator";
import type { ContentOverride } from "@/lib/content-resolver";
import type { ResolvedModel } from "@/lib/llm/resolve";
import { recordUsageFromModel } from "@/lib/llm/usage";

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

/** 用 LLM 生成（OpenAI 兼容），失败则回退启发式 */
export async function generateCopyWithLLM(
  ctx: CopyContext,
  model: ResolvedModel,
): Promise<ContentOverride> {
  const base = generateCopyOverride(ctx);
  const startedAt = Date.now();
  const res = await fetch(`${model.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model.model,
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
  recordUsageFromModel(model, data, startedAt, "copy");
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned) as unknown;
  // LLM 结果覆盖在启发式基础上，保证所有键都有值
  return { ...base, ...sanitizeCopy(parsed) };
}
