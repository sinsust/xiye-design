// 服务端：用真实大模型做「产品创意 Brief」的构建 / 更新。
// 只被 app/api/ai/concept-brief 引用，绝不进入客户端 bundle。
//
// 边界（F1-A 硬约束）：
// - LLM 只做产品定义层的提取、归纳与下一问题建议；
// - 不生成技术栈 / 数据库 / 框架 / 部署 / 工程包；
// - 不编造目标用户、指标、集成、市场数据——缺失信息一律进 openQuestions；
// - schema 校验失败由路由层转换为统一错误协议并保留旧 Brief。

import {
  type RawConceptOutput,
  type ProductConceptBrief,
  type ConceptBriefInputs,
  applyConceptRound,
  buildConceptHeuristic,
  emptyConceptBrief,
  mergeConceptBrief,
  normalizeConceptOutput,
} from "@/lib/flow-concept";
import { fenceUserInput } from "@/lib/prompt-sanitize";

export const CONCEPT_DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
export const CONCEPT_DEEPSEEK_MODEL =
  process.env.CONCEPT_MODEL || process.env.DEEPSEEK_MODEL || "deepseek-chat";

const CONCEPT_SYSTEM_PROMPT = `你是一位资深产品负责人，正在通过多轮访谈，帮用户把一个想法逐步收敛成一张「产品创意 Brief」与一份可读的「初版产品方案（PRD 初稿）」。

【核心立场】这是一场有判断的产品访谈，不是问卷。
- 每轮要先形成「有判断的初步方案/取舍」，而不是先抛基础问题。
- nextQuestion 必须是高杠杆的产品决策（MVP 做哪几件事、先服务哪类人的一刀、怎么权衡两个方案……），不要为了凑字段而问基础信息。
- 对仍然缺失的信息，写进 openQuestions 与 openCriticalQuestions（会改变首版方向的进后者）。

【允许你做】
- 从「用户原始想法 + 已提交的访谈回答 + 已确认的方向选择 + 最新对话纪要 + 已采纳的专家建议 + 当前已保存 Brief（含上一版初稿）」里提取、归纳产品定义层信息。
- 逐步把 planDraft（可读的初版方案/PRD 初稿）续写得更完整、更有判断：涵盖目标用户、核心场景、要解决的问题、价值主张、MVP 核心能力、核心取舍、关键假设、风险/待确认。以用户确认的事实为准，不胡乱编造。
- 每轮把「本轮新增/修正的关键结论」写进 decisions（数组，每项 title + 一句 detail），本轮没有新决策就返回空数组。
- currentTopic 写「当前正在讨论的议题」一句话。
- nextQuestion 给「本轮唯一最关键的高杠杆决策」；quickOptions 给 2~4 个上下文相关方向。

【硬性禁止】
- 严禁生成技术栈 / 数据库 / 框架 / 部署方案 / 工程包 / API 选择（那是方案落地阶段的事，本阶段一律不提）。
- 严禁编造目标用户、成功指标、市场数据、外部集成——用户没说过、Brief 里也没有的，不写，放进 openQuestions，绝不猜测填充。
- 严禁用「泛泛假设」填满空缺字段；宁可留空并进 openQuestions。
- 不得覆盖 previousBrief 里标为已确认的字段（参考当前已保存 Brief 的 confirmedFields）。

【字段语义】
- coreCapabilities：MVP 阶段必须有的核心能力（数组，每项一句，3 项以内）。
- targetUsers / primaryScenario / problemStatement / valueProposition：一句话精炼。
- nonGoals / successMetrics / assumptions：有明确证据才写；没有就返回空数组。
- openQuestions：仍待用户确认或补足的关键缺口。
- openCriticalQuestions：会改变首版方向的关键问题（会直接影响能否确定首版范围）。

【输出】
只能输出一个 JSON 对象，禁止任何前后解释、markdown 代码块、问候语。
{
  "productName":"（有品牌 / 品名依据时给出，否则空字符串）",
  "oneLiner":"一句话价值",
  "targetUsers":"",
  "primaryScenario":"",
  "problemStatement":"",
  "valueProposition":"",
  "coreCapabilities":[""],
  "nonGoals":[],
  "successMetrics":[],
  "assumptions":[],
  "openQuestions":[""],
  "openCriticalQuestions":[""],
  "decisions":[{ "title":"本轮关键决策标题", "detail":"一句细节" }],
  "currentTopic":"当前正在讨论的议题",
  "planDraft":"可读的初版产品方案 / PRD 初稿（在上一版基础上续写，Markdown，覆盖 目标用户 / 核心场景 / 要解决的问题 / 价值主张 / MVP 核心能力 / 核心取舍 / 关键假设 / 待确认）",
  "nextQuestion":"（本轮唯一最关键的高杠杆决策问题）",
  "quickOptions":["（2~4 个选项）"]
}`;

interface ChatMsg {
  role: "system" | "user";
  content: string;
}

function buildUserContent(inputs: ConceptBriefInputs, prev: ProductConceptBrief | null): string {
  const parts: string[] = [];
  if (inputs.idea?.trim()) parts.push(`【用户原始想法】\n${inputs.idea}`);
  if (inputs.answers?.some((s) => s.trim()))
    parts.push(`【用户已提交的访谈回答】\n${inputs.answers.filter((s) => s.trim()).join("\n")}`);
  if (inputs.directions?.some((s) => s.trim()))
    parts.push(`【已确认的方向选择】\n${inputs.directions.join("、")}`);
  parts.push(
    prev
      ? `【当前已保存 Brief】\n${JSON.stringify(prev, null, 2)}\n（确认字段不可覆盖，缺失字段需补足）`
      : "【当前无 Brief】首次构建。",
  );
  return parts.join("\n\n");
}

/** 轻量 JSON 修复 + 括号平衡截取（与 discover 同策略，足够稳健） */
function extractConceptJson(content: string): RawConceptOutput {
  const raw = (content ?? "").trim();
  const tryParse = (s: string): RawConceptOutput | null => {
    try {
      const p = JSON.parse(s);
      if (p && typeof p === "object") return p as RawConceptOutput;
    } catch {
      /* ignore */
    }
    return null;
  };
  const direct = tryParse(raw);
  if (direct) return direct;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = tryParse(fence[1].trim()) ?? tryParse(fence[1].replace(/,(\s*[}\]])/g, "$1").trim());
    if (f) return f;
  }
  const start = raw.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    let end = -1;
    for (let i = start; i < raw.length; i++) {
      const ch = raw[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            end = i;
            break;
          }
        }
      }
    }
    if (end > start) {
      const slice = raw.slice(start, end + 1).replace(/,(\s*[}\]])/g, "$1");
      const parsed = tryParse(slice);
      if (parsed) return parsed;
    }
  }
  throw new Error("parse:no-json");
}

async function callConceptModel(messages: ChatMsg[], apiKey: string): Promise<RawConceptOutput> {
  const url = `${CONCEPT_DEEPSEEK_BASE_URL}/chat/completions`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const useJson = attempt < 2;
    const body = JSON.stringify({
      model: CONCEPT_DEEPSEEK_MODEL,
      temperature: 0.4,
      max_tokens: 2000,
      ...(useJson ? { response_format: { type: "json_object" } } : {}),
      messages: useJson
        ? messages
        : [...messages, { role: "user" as const, content: "严格只输出一个 JSON 对象，不要任何其他字符。" }],
    });
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body,
        signal: AbortSignal.timeout(40000),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      throw new Error(`network:${reason}`);
    }
    if (!res.ok) throw new Error(`http:${res.status}`);
    try {
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        lastErr = new Error("parse:empty");
        continue;
      }
      return extractConceptJson(content);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("parse:unknown");
}

/**
 * 构建 / 更新产品创意 Brief。
 * @param op "build"(首建，prev 可为空) | "update"(增量更新)
 * @returns 包含归一化后的 Brief + AI 面向用户回复
 */
export async function buildConceptBrief(
  op: "build" | "update",
  inputs: ConceptBriefInputs,
  prev: ProductConceptBrief | null,
  apiKey: string | undefined,
): Promise<{ brief: ProductConceptBrief; reply: string; nextQuestion?: string; quickOptions?: string[] }> {
  const base = prev ?? emptyConceptBrief();
  // 无 key / 非可信环境：走离线启发式 - 只把能确定的落定，其余进 openQuestions（绝不编造）
  if (!apiKey) {
    const heuristic = buildConceptHeuristic(inputs, base);
    const merged = mergeConceptBrief(base, heuristic, inputs);
    const next = ensureOpenQuestions(merged, inputs);
    // 无 key 也按 build 的提升一次（首次/更新都不重复刷版本到离谱：仅首建时 version 归 1）
    const brief = op === "build" && prev === null ? { ...next, version: 1 } : next;
    return {
      brief,
      reply: nextQuestionFallback(next),
      ...(next.openQuestions[0] ? { nextQuestion: next.openQuestions[0], quickOptions: optionFallback(next) } : {}),
    };
  }

  const messages: ChatMsg[] = [
    { role: "system", content: CONCEPT_SYSTEM_PROMPT },
    // inputs/prev 含用户自由输入：隔离后作为「被分析的数据」传入
    { role: "user", content: fenceUserInput("访谈输入", buildUserContent(inputs, prev), 8000) },
  ];
  const raw = await callConceptModel(messages, apiKey);
  const norm = normalizeConceptOutput(raw);
  const merged = mergeConceptBrief(base, norm, inputs);
  // 把 AI 每轮的「决策层」并入 brief：关键决策 / 当前议题 / 初版方案初稿 / 关键未决问题。
  // mergeConceptBrief 只做 field-level，这里必须显式应用，否则这些会在归一化时被丢掉。
  const withRound = applyConceptRound(merged, {
    decisions: norm.decisions,
    currentTopic: norm.currentTopic,
    planDraft: norm.planDraft,
    openCriticalQuestions: norm.openCriticalQuestions,
  });
  const brief = ensureOpenQuestions(withRound, inputs);
  const reply =
    norm.nextQuestion?.trim() || nextQuestionFor(merged, brief);
  return {
    brief,
    reply,
    nextQuestion: brief.openQuestions[0] ?? norm.nextQuestion?.trim(),
    quickOptions: norm.quickOptions?.slice(0, 4) || optionFallback(brief),
  };
}

/** 保证必填缺口一定出现在 openQuestions（LLM 遗漏时规则补齐，维持「不编造」承诺） */
function ensureOpenQuestions(brief: ProductConceptBrief, inputs: ConceptBriefInputs): ProductConceptBrief {
  const existing = new Set(brief.openQuestions.map((q) => q.toLowerCase()));
  const missing: string[] = [];
  if (!brief.targetUsers.trim()) missing.push("目标用户是谁？他们的典型痛点是什么？");
  if (!brief.primaryScenario.trim()) missing.push("核心使用场景是什么？用户在什么时刻、为了什么用它？");
  if (!brief.problemStatement.trim()) missing.push("它到底解决用户的什么问题？当前的替代方案差在哪里？");
  if (!brief.valueProposition.trim()) missing.push("一句话，用户为什么非它不可？");
  if (!brief.coreCapabilities.length) missing.push("MVP 阶段必须有哪 1~3 个核心能力？");
  const toAdd = missing.filter((q) => !existing.has(q.toLowerCase()));
  if (!toAdd.length) return brief;
  return { ...brief, openQuestions: [...brief.openQuestions, ...toAdd] };
}

function nextQuestionFor(brief: ProductConceptBrief, _next?: ProductConceptBrief): string {
  const order = [
    "targetUsers",
    "primaryScenario",
    "problemStatement",
    "valueProposition",
    "coreCapabilities",
  ] as const;
  const firstMissing = order.find((k) => {
    const v = brief[k];
    return Array.isArray(v) ? v.length === 0 : !String(v).trim();
  });
  if (firstMissing === "targetUsers") return "这个产品先服务哪一类用户？";
  if (firstMissing === "primaryScenario") return "用户在什么核心场景下会用它？";
  if (firstMissing === "problemStatement") return "它到底要解决用户什么问题？";
  if (firstMissing === "valueProposition") return "用户为什么非它不可？";
  if (firstMissing === "coreCapabilities") return "MVP 的核心能力是哪几项？";
  return "产品创意已基本落定，还差什么要我再帮你确认吗？";
}

function nextQuestionFallback(brief: ProductConceptBrief): string {
  const h = normalizeConceptOutput(brief);
  void h;
  return nextQuestionFor(brief);
}

function optionFallback(brief: ProductConceptBrief): string[] {
  const opts: string[] = [];
  if (!brief.targetUsers.trim()) opts.push("面向小团队 / 个人效率", "面向大众 C 端用户", "面向垂直行业客户");
  if (!brief.primaryScenario.trim()) opts.push("高频日常场景", "低频但强痛点的场景", "团队协作场景");
  if (!brief.coreCapabilities.length) opts.push("先做 1 个核心能力", "做 2~3 个组成闭环", "连同配套能力一起做");
  return opts.slice(0, 4);
}