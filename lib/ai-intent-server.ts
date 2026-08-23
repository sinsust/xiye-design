// 服务端：用真实大模型（DeepSeek，OpenAI 兼容）解构用户意图。
// 只被 app/api/ai/intent 路由引用，绝不进入客户端 bundle（避免泄漏目录与密钥逻辑）。
//
// 真实 AI 只负责「从目录里挑 id 组合」，最终仍要经过服务端白名单校验
// （字段必须落在真实数据里，否则回退到启发式，保证下游永不拿到脏 id）。

import { PROJECT_TYPES } from "@/data/project-types";
import { AI_CAPABILITIES } from "@/data/ai-capabilities";
import { TECH_STACKS } from "@/data/tech-stacks";
import { UI_LIBRARIES } from "@/data/ui-libraries";
import { VISUAL_STYLE_MAP } from "@/data/visual-styles";
import { SKELETON_PAGE_MAP } from "@/data/skeletons";
import {
  interpretIntent,
  type IntentRecommendation,
  type IntentNarrative,
  type IntentRecPage,
  type IntentRecComponent,
} from "@/lib/ai-intent";
import { METHODOLOGY_INJECTION } from "@/lib/ai-methodology";

// AI 对话理解（意图解构）固定使用 DeepSeek。
// LLM_MODEL_*（Qwen）预留给其它场景，稍后由调用方按需接入，不在此处抢优先级。
//
// OpenAI 兼容：仅被 app/api/ai/intent 路由引用，绝不进入客户端 bundle。

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// ───────────────────────── 目录（喂给 LLM 的真实可选项） ─────────────────────────

function buildCatalog(): string {
  const lines: string[] = [];
  lines.push("【项目类型】");
  lines.push(PROJECT_TYPES.map((t) => `${t.id}「${t.name}」`).join("、"));
  lines.push("【AI能力】");
  lines.push(AI_CAPABILITIES.map((c) => `${c.id}「${c.name}」`).join("、"));
  lines.push("【技术栈】");
  lines.push(TECH_STACKS.map((s) => `${s.id}「${s.name}」`).join("、"));
  lines.push("【UI主库(olny role=main)】");
  lines.push(
    UI_LIBRARIES.filter((l) => l.role === "main")
      .map((l) => `${l.id}「${l.name}」`)
      .join("、"),
  );
  lines.push("【视觉风格】");
  lines.push(
    Object.values(VISUAL_STYLE_MAP)
      .map((s) => `${s.id}「${s.name}」`)
      .join("、"),
  );
  lines.push("【可编排的页面与区块组(页面id「页面名」: 组件id(组件名)[变体id/...]】");
  for (const p of Object.values(SKELETON_PAGE_MAP)) {
    const comps = p.components
      .map((c) => {
        const vs = c.variants.map((v) => v.id).join("/");
        return `${c.id}(${c.name})[${vs || "-"}]`;
      })
      .join("; ");
    lines.push(`- ${p.id}「${p.name}」: ${comps}`);
  }
  return lines.join("\n");
}

const SYSTEM_PROMPT = `你是一位资深产品架构师。用户会告诉你一句想做的产品/工作台，请你把它解构为「项目类型 + AI能力 + 技术栈 + 视觉风格 + UI主库 + 页面蓝图」的最佳组合。

硬性约束：
1. 所有 id 必须从下方目录中挑选，严禁自造 id。
2. aiCapabilities 最多 3 个；techStack / visualStyle / uiLibrary 各选且只选 1 个。
3. blueprint 覆盖该项目类型合理需要的 2~5 个页面；每页放 2~8 个最能代表「这类产品」的区块组件。面向公众的类型应包含必要的官网基础站结构（首页/关于/联系/博客等）。
4. blueprint 里的 pageSlug、componentId、variantId 都必须真实存在于该页组件目录中；variantId 拿不准就给 null。
5. narrative 必填，覆盖完整的产品叙事（愿景/定位/目标用户/核心功能/市场契合），聚焦正向产品定义，不要输出非目标/风险/成功指标/待澄清这类负向或元信息板块。
6. 用户的想法可能只有一句话甚至几个词。请结合你对当前行业与市场主流产品形态、主流视觉趋势的了解，把它合理扩展为一个可落地、完整、具体的产品构想；尤其要说明「为什么这套视觉风格与信息架构符合当下市场主流审美」。不要因为输入简短就产出单薄的结果。
7. 【方法论框架强制套用】叙事与 PRD 必须应用以下顶级产品设计方法论（来源：Amplitude builder-skills，已引入 xiye 知识库「技能」类 amp-*，可在 /library 浏览/复制深做），让产出专业且完整、而非通用套话。具体规则见下方「产品方法论」段：核心功能必须是最被深挖的部分（每个模块带 JTBD 动机与验收标准），并用 JTBD / RICE / craft-spec / PR-FAQ 框架组织。
8. 只输出一个 JSON 对象，不要 markdown 代码块，不要任何多余文字。

输出 JSON 结构：
{
  "projectType": "<项目类型id>",
  "aiCapabilities": ["<AI能力id>", "<AI能力id>", "<AI能力id>"],
  "techStack": "<技术栈id>",
  "visualStyle": "<视觉风格id>",
  "uiLibrary": "<UI主库id>",
  "blueprint": [
    { "pageSlug": "<页面id>", "components": [ { "componentId": "<组件id>", "variantId": "<变体id>|null" } ] }
  ],
  "summary": "<用一句中文说明你为用户做的组合决策>",
  "narrative": {
    "vision": "<产品愿景一句话，用 PR/FAQ 客户视角新闻稿式表达：先痛点后方案>",
    "positioning": "<定位/与同类产品的差异，含 why now>",
    "targetAudience": ["<JTBD：功能性任务>", "<JTBD：社交性任务>", "<JTBD：情感性任务>"],
    "coreFeatures": [ { "name": "<核心功能，按 RICE 轻重排序>", "why": "<解决什么 JTBD 任务 / 当前痛点，附一句验收标准>" } ],
    "marketFit": "<所选视觉契约/页面结构为何符合当前市场主流审美与产品形态>"
  }
}

${METHODOLOGY_INJECTION}

以下是可选目录：
`;

// ───────────────────────── 调用 DeepSeek ─────────────────────────

interface RawOutput {
  projectType?: string;
  aiCapabilities?: string[];
  techStack?: string;
  visualStyle?: string;
  uiLibrary?: string;
  blueprint?: unknown[];
  summary?: string;
  narrative?: Partial<IntentNarrative>;
}

async function callDeepSeek(text: string, apiKey: string): Promise<RawOutput> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT + buildCatalog() },
        { role: "user", content: `用户想法：${text}` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(cleaned) as RawOutput;
  return parsed && typeof parsed === "object" ? parsed : {};
}

// ───────────────────────── 白名单校验 + 归一化 ─────────────────────────

function sanitizeBlueprint(raw: unknown[] | undefined, fallback: IntentRecPage[]): IntentRecPage[] {
  const seen = new Set<string>();
  const pages: IntentRecPage[] = [];
  for (const rp of Array.isArray(raw) ? raw : []) {
    const o = rp as { pageSlug?: string; components?: unknown[] };
    const slug = o?.pageSlug;
    if (!slug) continue;
    const page = SKELETON_PAGE_MAP[slug];
    if (!page || seen.has(slug)) continue;
    seen.add(slug);

    const comps: IntentRecComponent[] = [];
    for (const rc of Array.isArray(o?.components) ? o.components : []) {
      const c = rc as { componentId?: string; variantId?: string | null };
      const compId = c?.componentId;
      if (!compId) continue;
      const comp = page.components.find((x) => x.id === compId);
      if (!comp) continue;
      const v = c?.variantId
        ? comp.variants.find((vv) => vv.id === c.variantId) ??
          comp.variants.find((vv) => vv.name === c.variantId)
        : undefined;
      const picked = v ?? comp.variants[0];
      comps.push({
        componentId: comp.id,
        componentName: comp.name.replace(/\{\{[^}]*\}\}/g, "").trim(),
        variantId: picked?.id ?? null,
        variantName: picked?.name ?? "默认",
      });
    }
    if (comps.length) {
      pages.push({ pageSlug: slug, pageName: page.name, components: comps });
    }
  }
  return pages.length ? pages : fallback;
}

function sanitize(raw: RawOutput, text: string): IntentRecommendation {
  // 启发式给出兜底基线，只有 LLM 明确的字段才覆盖它
  const fb = interpretIntent(text);

  const type = PROJECT_TYPES.find((t) => t.id === raw?.projectType) ?? fb.projectType;

  const capIds = new Set(
    (raw?.aiCapabilities ?? []).filter(
      (id) => AI_CAPABILITIES.some((c) => c.id === id) || AI_CAPABILITIES.some((c) => c.name === id),
    ),
  );
  const aiCapByName = (id: string) =>
    AI_CAPABILITIES.find((c) => c.id === id) ??
    AI_CAPABILITIES.find((c) => c.name === id);
  const pickedCaps: { id: string; name: string }[] = [];
  for (const c of fb.aiCapabilities) if (capIds.has(c.id)) pickedCaps.push(c);
  for (const id of capIds) {
    if (pickedCaps.length >= 3) break;
    const c = aiCapByName(id);
    if (c && !pickedCaps.some((p) => p.id === c.id)) {
      pickedCaps.push({ id: c.id, name: c.name });
    }
  }

  const preferStack = TECH_STACKS.find((t) => t.id === raw?.techStack) ?? fb.techStack;
  const visualStyle = VISUAL_STYLE_MAP[raw?.visualStyle ?? ""] ?? fb.visualStyle;
  const uiLib = UI_LIBRARIES.find((l) => l.id === raw?.uiLibrary) ?? fb.uiLibrary;

  const blueprint = sanitizeBlueprint(raw?.blueprint, fb.blueprint);
  const componentsCount = blueprint.reduce((n, p) => n + p.components.length, 0);
  const summary =
    (raw?.summary?.trim() ? raw.summary.trim() : "" ) ||
    `识别到你想做「${type.name}」：为你选了 ${preferStack?.name ?? "默认"} 技术栈、套用「${visualStyle?.name ?? "默认"}」视觉风格，并在 ${blueprint.length} 个页面里放好 ${componentsCount} 个区块组件。`;

  // 产品叙事：LLM 明确的字段覆盖,其余回退启发式兜底
  const rn = raw?.narrative;
  const narrative: IntentNarrative = {
    vision: (rn?.vision?.trim() || fb.narrative.vision),
    positioning: (rn?.positioning?.trim() || fb.narrative.positioning),
    targetAudience:
      (rn?.targetAudience?.length ? rn.targetAudience.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.targetAudience,
    coreFeatures:
      (rn?.coreFeatures?.length ? rn.coreFeatures.map((f) => ({ name: String(f.name ?? ""), why: String(f.why ?? "") })).filter((f) => f.name) : []) ||
      fb.narrative.coreFeatures,
    nonGoals:
      (rn?.nonGoals?.length ? rn.nonGoals.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.nonGoals,
    successMetrics:
      (rn?.successMetrics?.length ? rn.successMetrics.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.successMetrics,
    marketFit: (rn?.marketFit?.trim() || fb.narrative.marketFit),
  };

  return {
    text,
    matched: type.id !== "saas" || fb.matched,
    projectType: { id: type.id, name: type.name, description: type.description },
    aiCapabilities: pickedCaps,
    techStack: preferStack ? { id: preferStack.id, name: preferStack.name } : null,
    visualStyle: visualStyle ? { id: visualStyle.id, name: visualStyle.name } : null,
    uiLibrary: uiLib ? ("id" in uiLib ? { main: uiLib.id } : uiLib) : null,
    blueprint,
    pagesCount: blueprint.length,
    componentsCount,
    summary,
    narrative,
  };
}

// ───────────────────────── 入口 ─────────────────────────

export async function interpretIntentOnline(
  text: string,
  apiKey: string,
): Promise<IntentRecommendation> {
  const raw = await callDeepSeek(text, apiKey);
  return sanitize(raw, text);
}