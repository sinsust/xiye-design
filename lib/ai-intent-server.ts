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
  deriveFeaturePages,
  type IntentRecommendation,
  type IntentNarrative,
  type IntentRecPage,
  type IntentRecComponent,
} from "@/lib/ai-intent";
import { METHODOLOGY_INJECTION } from "@/lib/ai-methodology";
import { fenceUserInput } from "@/lib/prompt-sanitize";
import { SKILL_ASSEMBLY_INJECTION } from "@/lib/skill-assembly";

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
9. 【视觉风格必须贴合业务/情绪，禁止乱选】visualStyle 这一项要真正读懂用户业务与想传达的情绪，从目录里挑「最契合受众与调性」的那个，绝不能用「既然用户没说就随便给个深色/玻璃/紫色」：
   - 母婴/亲子/教育/温馨 → 选暖奶油、暖米、淡雅温暖系（如 editorial-luxury / minimalist-editorial / nature-green），禁止深色/纯黑/霓虹紫。
   - 儿童/玩具/亲子娱乐 → 活泼多彩（truus-aurora）。
   - 宠物/健康/自然 → 生机暖色或清新自然系（nature-green / warm-orange）。
   - 高端/奢侈/送礼 → 奢华衬线（luxury / editorial-luxury）。
   - 纯白优雅/展示型品牌/化妆时尚 → 极简编辑暖白（minimalist-editorial / soft-structuralism）。
   - 食品/餐饮/零售/电商 → 有食欲的暖橙（warm-orange / nature-green）。
   - 技术与后台 → 企业蓝/理性灰（tech-blue / slate-gray / shadcn-newyork）。
   判断依据写进 summary 里的「为什么这套视觉符合目标受众与业务调性」。宁可贴合业务，也不要落入「默认深色/玻璃/紫色」。

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
    "marketFit": "<所选视觉契约/页面结构为何符合当前市场主流审美与产品形态>",
    "pages": [
      {
        "name": "<由核心功能推导出的业务专属页面名，如「简历上传与解析页」「岗位匹配结果页」>",
        "path": "<建议路由，如 /resume/parse>",
        "description": "<这个页面做什么、为谁解决什么问题，一句话>",
        "relatedFeatures": ["<关联的核心功能名，来自上方 coreFeatures>"],
        "priority": "P0 | P1 | P2"
      }
    ]
  }
}

要求：pages 必须与 coreFeatures 一一对应——每个核心功能都要推导出它落地所需要的「业务专属页面」（区别于首页/认证/仪表盘等通用模板页）。pages 里的 relatedFeatures 必须引用 coreFeatures 中的功能名。优先排 P0 的核心链路页面，辅助能力排 P1/P2。

${METHODOLOGY_INJECTION}

${SKILL_ASSEMBLY_INJECTION}

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
  narrative?: Partial<IntentNarrative> & {
    pages?: Array<{
      name?: string;
      path?: string;
      description?: string;
      relatedFeatures?: string[];
      priority?: string;
    }>;
  };
}

async function callDeepSeek(text: string, apiKey: string): Promise<RawOutput> {
  let lastErr: unknown;
  // 单次 5xx/网络抖动重试一次；解析截断则降级为空对象（走启发式兜底，不抛 502）
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
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
            { role: "user", content: fenceUserInput("用户想法", text) },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!res.ok) {
        // 5xx 重试用一次；4xx（含 401/429）直接失败
        if (res.status >= 500 && attempt < 1) {
          lastErr = new Error(`AI 服务暂不可用（${res.status}），重试中`);
          continue;
        }
        console.error("DeepSeek intent request failed, status:", res.status);
        throw new Error("AI 服务暂不可用，请稍后重试");
      }
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      const cleaned = content
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned) as RawOutput;
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        // 模型输出被截断/非法 JSON → 降级为空对象，sanitize 走本地启发式兜底
        console.warn("DeepSeek intent JSON 解析失败，回退启发式");
        return {};
      }
    } catch (e) {
      lastErr = e;
      if (attempt < 1) continue;
      throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("AI 服务暂不可用，请稍后重试");
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
  let pagesFor: IntentNarrative["pages"] | undefined;
  const narrative: IntentNarrative = {
    vision: (rn?.vision?.trim() || fb.narrative.vision),
    positioning: (rn?.positioning?.trim() || fb.narrative.positioning),
    targetAudience:
      (rn?.targetAudience?.length ? rn.targetAudience.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.targetAudience,
    coreFeatures: (() => {
      const cf = rn?.coreFeatures?.length
        ? rn.coreFeatures.map((f) => ({ name: String(f.name ?? ""), why: String(f.why ?? "") })).filter((f) => f.name)
        : fb.narrative.coreFeatures;
      pagesFor = deriveFeaturePages(cf);
      return cf;
    })(),
    nonGoals:
      (rn?.nonGoals?.length ? rn.nonGoals.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.nonGoals,
    successMetrics:
      (rn?.successMetrics?.length ? rn.successMetrics.map((x) => x.trim()).filter(Boolean) : []) ||
      fb.narrative.successMetrics,
    marketFit: (rn?.marketFit?.trim() || fb.narrative.marketFit),
    pages:
      (rn?.pages?.length
        ? rn.pages
            .map((p) => ({
              name: String(p?.name ?? ""),
              path: p?.path ? String(p.path) : undefined,
              description: String(p?.description ?? ""),
              relatedFeatures: Array.isArray(p?.relatedFeatures)
                ? p.relatedFeatures.map((x) => String(x))
                : [],
              priority: (["P0", "P1", "P2"].includes(p?.priority) ? p.priority : "P1") as
                | "P0"
                | "P1"
                | "P2",
            }))
            .filter((p) => p.name)
        : []) || pagesFor,
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