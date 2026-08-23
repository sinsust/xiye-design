// 服务端：用真实大模型（DeepSeek，OpenAI 兼容）做多轮「产品发现访谈」。
// 只被 app/api/ai/discover 路由引用，绝不进入客户端 bundle。
//
// 与 ai-intent-server 的区别：这里是多轮对话，模型每次返回
// { reply, branches, brief, done }，brief 是逐步生长的产品 PRD 草稿。

import {
  type ProductBrief,
  type Branch,
  type DiscoverMessage,
  type DiscoverResponse,
  emptyBrief,
  asStringArray,
  asModules,
  asPhases,
  asRoles,
  asExtra,
} from "@/lib/ai-discover";
import { interpretIntent } from "@/lib/ai-intent";
import { METHODOLOGY_INJECTION } from "@/lib/ai-methodology";

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const BASE_SYSTEM_PROMPT = `你是一位真正有实战经验的资深产品架构师，正在通过多轮对话，帮助用户把一个模糊的想法丰满成一份有洞察、能落地的产品 PRD。

【反平庸硬约束——必须遵守】
- 严禁放之四海皆准的套话（如「注重用户体验」「快速迭代」「以用户为中心」「数据驱动」）。每一条分析必须是这个产品特有的、非显而易见的。
- 给出洞察时尽量带具体依据：真实行业案例、可量化的取舍、该领域典型的失败/成功模式、反直觉的判断。
- 不要讨好用户，敢于指出想法里的漏洞、伪需求、或过早优化的陷阱。
- 领域参考只作底座，不被它框死：若用户的真实想法与识别类型不符，以用户为准。

【对话推进——按阶段自然决定，不要机械套模板】
- 初期（想法还模糊）：优先给出 2~3 个互斥且有真实差异的方向让用户选，并说清每个方向的代价与适用场景。
- 中期（方向已定）：停止抛方向，改为深挖具体细节、给出可执行建议、指出需要做的取舍。
- 后期（要素基本齐全）：停止提问，把 done 设为 true，branches 给空数组，回复改为「可以进入下一步了」的引导。
- 不要把「每轮必给分支 + 必抛问题」当成固定动作；当前阶段不需要时就不给。

【PRD 草稿（brief）字段】
- 标准字段（均为正向产品定义）：vision / positioning / targetAudience / coreModules / chosenDirections / phases / roles。只产出「要开发什么」，不要输出非目标 / 风险 / 成功指标 / 待澄清这类负向或元信息板块。
- 柔性字段 extra：当本产品有标准字段覆盖不到的关键要点时（例如冷启动策略、合规要点、关键指标定义、定价模式、渠道分发等），放进 extra 对象，key 为字段名（中文），value 为字符串或字符串数组。不要硬把不相关的东西塞进标准字段。
- 只更新/补充与本轮对话相关、且用户已确认或你已合理推断的字段；不要清空已填写的字段。

【输出格式——硬性要求】
你必须且只能输出一个 JSON 对象，这是唯一输出。禁止在 JSON 前后写任何解释、问候、过渡句或分析文字。
- 不要在 JSON 外加任何说明；如果写了分析，也必须放进 JSON 的 reply 字段里。
- 不要使用 markdown 代码块包裹。直接输出 { 开头的 JSON。
- 字段结构与示例保持一致：
{
  "reply": "<面向用户的口语化分析与下一步引导，要有洞察>",
  "branches": [ { "id":"<短id>", "label":"<方向名>", "description":"<一句话差异点+代价>", "preview":"<可选：预期收益/周期>" } ],
  "brief": {
    "vision": "<产品愿景>",
    "positioning": "<定位/差异化>",
    "targetAudience": ["<用户>"],
    "coreModules": [ { "name":"<模块>", "detail":"<要点>" } ],
    "chosenDirections": ["<已确定的方向/分支>"],
    "phases": [ { "name":"<分期名>", "items": ["<要点>"] } ],
    "roles": [ { "role":"<角色>", "scope":"<数据/权限范围>" } ],
    "extra": { "<自定义字段名>": "<字符串 或 字符串数组>" }
  },
  "done": false
}`;

/** 用启发式初判用户想法所属领域，生成一段领域知识底座注入 system，避免 AI 脱离领域空谈 */
function buildDomainContext(text: string): string {
  const rec = interpretIntent(text);
  const t = rec.projectType;
  const n = rec.narrative;
  const moduleHints = rec.blueprint
    .flatMap((p) => p.components.map((c) => c.componentName))
    .slice(0, 8);
  return `\n\n【领域锚点（启发式初判，仅作参考底座）】
- 初步识别类型：「${t.name}」——${t.description}
- 目标用户：${n.targetAudience.join("、") || "待定"}
- 差异化切入点参考：${n.positioning}
- 该类型常见能力/模块参考：${moduleHints.join("、") || "待定"}
- 若用户想法与以上不符，一切以用户实际表述为准。`;
}

export function buildSystemPrompt(domainCtx: string): string {
  return `${BASE_SYSTEM_PROMPT}\n\n${METHODOLOGY_INJECTION}${domainCtx}`;
}

interface RawOutput {
  reply?: string;
  branches?: unknown[];
  brief?: Record<string, unknown>;
  done?: boolean;
}

// DeepSeek 在 response_format=json_object 下，若 assistant 历史过长会确定性返回空白。
// 压缩较长 assistant 历史（方向要点已足够，用户选择会写进后续 user 消息），避免触发该 bug。
const ASSISTANT_HISTORY_MAX = 160;
// user 消息若有超长粘贴（需求文档 / 截图 OCR / 竞品链接等），截断以免输入 token 线性膨胀。
const USER_HISTORY_MAX = 400;
// 多轮访谈：仅保留最近 N 条消息完整（约 6 轮），更早的历史由 currentBrief 承载结构化记忆。
const RECENT_FULL_KEEP = 12;

function trimMessage(m: DiscoverMessage): { role: string; content: string } {
  let c = m.content;
  if (m.role === "assistant" && c.length > ASSISTANT_HISTORY_MAX) {
    c = c.slice(0, ASSISTANT_HISTORY_MAX) + "…（上文已省略）";
  } else if (m.role === "user" && c.length > USER_HISTORY_MAX) {
    c = c.slice(0, USER_HISTORY_MAX) + "…（输入过长已截断）";
  }
  return { role: m.role, content: c };
}

function trimHistory(messages: DiscoverMessage[]): { role: string; content: string }[] {
  return messages.map(trimMessage);
}

/** 压缩历史窗口：保留最近 RECENT_FULL_KEEP 条完整，更早的仅保留 user 侧并截断。
 * currentBrief 已随每轮注入 system（覆盖所有已确认要点），旧 assistant 文本可安全丢弃，
 * 旧 user 文本仅作轻量「用户曾说过什么」的记忆，避免越聊越长的输入膨胀。 */
function buildMessageWindow(
  messages: DiscoverMessage[],
): { role: string; content: string }[] {
  if (messages.length <= RECENT_FULL_KEEP) return trimHistory(messages);
  const recent = messages.slice(-RECENT_FULL_KEEP);
  const older = messages.slice(0, messages.length - RECENT_FULL_KEEP);
  const olderUser = older
    .filter((m) => m.role === "user")
    .map((m) => ({
      role: "user",
      content:
        m.content.length > USER_HISTORY_MAX
          ? m.content.slice(0, USER_HISTORY_MAX) + "…（更早对话已省略）"
          : m.content,
    }));
  return [...olderUser, ...trimHistory(recent)];
}

function toOpenAIMessages(
  messages: DiscoverMessage[],
  currentBrief: ProductBrief,
  domainCtx: string,
): { role: string; content: string }[] {
  const out: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${buildSystemPrompt(domainCtx)}\n\n当前 PRD 草稿（请在此基础上更新，不要清空已填写字段）：\n${JSON.stringify(currentBrief, null, 2)}`,
    },
  ];
  for (const m of buildMessageWindow(messages)) {
    out.push(m);
  }
  return out;
}

/** 轻量 JSON 修复：去掉 BOM 与尾随逗号（最典型的 LLM 瑕疵），其余交给括号平衡截取。 */
function repairJson(s: string): string {
  return s.replace(/^﻿/, "").replace(/,(\s*[}\]])/g, "$1");
}

/** 从模型自由/结构化输出里稳健提取第一个合法 JSON 对象。
 * 覆盖 DeepSeek 在 json_object 模式下常见的偶发格式错误：
 * 尾部解释文字、```json 代码块、字符串内嵌括号、尾随逗号等。 */
function extractJson(content: string): RawOutput {
  const raw = (content ?? "").trim();

  const tryParse = (s: string): RawOutput | null => {
    try {
      const p = JSON.parse(s);
      if (p && typeof p === "object") return p as RawOutput;
    } catch {
      /* ignore */
    }
    return null;
  };

  // 1) 直接就是 JSON
  const direct = tryParse(raw);
  if (direct) return direct;

  // 2) ```json 代码块
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = tryParse(fence[1].trim()) ?? tryParse(repairJson(fence[1].trim()));
    if (f) return f;
  }

  // 3) 括号平衡扫描：从第一个 { 起，追踪字符串/转义，找到深度归零的闭合 }
  //    ——正确处理字符串内嵌的 { }，比 lastIndexOf 稳健得多。
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
      const slice = raw.slice(start, end + 1);
      const parsed = tryParse(slice) ?? tryParse(repairJson(slice));
      if (parsed) return parsed;
    }
  }

  throw new Error("parse:no-json");
}

async function callDeepSeek(
  messages: DiscoverMessage[],
  currentBrief: ProductBrief,
  apiKey: string,
  domainCtx: string,
): Promise<RawOutput> {
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const baseMessages = toOpenAIMessages(messages, currentBrief, domainCtx);

  // 上一轮若因模型返回空白失败（DeepSeek 在长历史下 json_object 模式偶发空白），
  // 下一轮改用自由格式绕过该 bug；否则继续用 json_object 并附纠正提示。
  const CORRECT_HINT =
    "你上一轮的回复不是合法 JSON，无法被程序解析。请严格只输出一个 JSON 对象：不要任何解释文字、不要 markdown 代码块、不要 JSON 外的任何字符，直接以 { 开头、以 } 结尾。";

  let lastEmpty = false;
  let lastErr: unknown;

  // 三次投递：① json 标准 ② json+纠正提示（若①空白则换 free 绕过）③ free+纠正提示（兜底）
  for (let attempt = 0; attempt < 3; attempt++) {
    const useJson = attempt === 0 ? true : attempt === 1 ? !lastEmpty : false;
    const useHint = attempt >= 1;
    const apiMessages = useHint
      ? [...baseMessages, { role: "user", content: CORRECT_HINT }]
      : baseMessages;

    const body = JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.6,
      max_tokens: 6000,
      ...(useJson ? { response_format: { type: "json_object" } } : {}),
      messages: apiMessages,
    });

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(40000),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      console.error("[ai-discover] fetch failed:", reason);
      throw new Error(`network:${reason}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ai-discover] DeepSeek non-ok:", res.status, text.slice(0, 300));
      throw new Error(`http:${res.status}`);
    }

    try {
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        console.error(`[ai-discover] empty content (attempt ${attempt}), retrying`);
        lastEmpty = true;
        lastErr = new Error("parse:empty");
        continue;
      }
      return extractJson(content);
    } catch (e) {
      console.error(
        `[ai-discover] parse failed (attempt ${attempt}, json=${useJson}):`,
        String(e),
      );
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("parse:unknown");
}

// ───────────────────────── 归一化 ─────────────────────────

function sanitizeBranches(raw: unknown): Branch[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x: any) => ({
      id: typeof x?.id === "string" ? x.id : Math.random().toString(36).slice(2, 8),
      label: typeof x?.label === "string" ? x.label.trim() : "方向",
      description: typeof x?.description === "string" ? x.description.trim() : "",
      preview: typeof x?.preview === "string" ? x.preview.trim() : undefined,
    }))
    .filter((b: Branch) => b.label);
}

function sanitizeBrief(raw: Record<string, unknown> | undefined, prev: ProductBrief): ProductBrief {
  if (!raw || typeof raw !== "object") return prev;
  return {
    vision: typeof raw.vision === "string" && raw.vision.trim() ? raw.vision.trim() : prev.vision,
    positioning:
      typeof raw.positioning === "string" && raw.positioning.trim()
        ? raw.positioning.trim()
        : prev.positioning,
    targetAudience: asStringArray(raw.targetAudience).length
      ? asStringArray(raw.targetAudience)
      : prev.targetAudience,
    coreModules: asModules(raw.coreModules).length ? asModules(raw.coreModules) : prev.coreModules,
    chosenDirections: asStringArray(raw.chosenDirections).length
      ? asStringArray(raw.chosenDirections)
      : prev.chosenDirections,
    phases: asPhases(raw.phases).length ? asPhases(raw.phases) : prev.phases,
    roles: asRoles(raw.roles).length ? asRoles(raw.roles) : prev.roles,
    extra: Object.keys(asExtra(raw.extra)).length ? asExtra(raw.extra) : prev.extra,
  };
}

export function sanitizeDiscover(
  raw: RawOutput,
  prevBrief: ProductBrief,
): DiscoverResponse {
  return {
    reply:
      typeof raw.reply === "string" && raw.reply.trim()
        ? raw.reply.trim()
        : "好的，我理解了你的想法，我们继续深入。",
    branches: sanitizeBranches(raw.branches),
    brief: sanitizeBrief(raw.brief as Record<string, unknown> | undefined, prevBrief),
    done: Boolean(raw.done),
  };
}

// ───────────────────────── 离线启发式首轮兜底 ─────────────────────────

/** 无 API key / 网络不可用时，用启发式给出一个有结构的首轮（比单轮表单更丰满） */
export function runDiscoveryHeuristic(text: string): DiscoverResponse {
  const rec = interpretIntent(text);
  const n = rec.narrative;
  const brief: ProductBrief = {
    ...emptyBrief(),
    vision: n.vision,
    positioning: n.positioning,
    targetAudience: n.targetAudience,
    coreModules: n.coreFeatures.map((f) => ({ name: f.name, detail: f.why })),
    chosenDirections: [],
  };
  const branches: Branch[] = [
    {
      id: "mvp",
      label: "轻量 MVP 优先",
      description: "先跑通核心主流程，快速验证价值，再迭代",
      preview: "1~2 周上线核心闭环",
    },
    {
      id: "full",
      label: "完整功能一步到位",
      description: "首版即覆盖主要模块，适合目标明确、资源充足",
      preview: "功能完整但周期更长",
    },
    {
      id: "phased",
      label: "分阶段渐进",
      description: "按优先级分期建设，先基础后增强",
      preview: "降低一次性投入风险",
    },
  ];
  return {
    reply: `我先把你的想法理解成「${rec.projectType.name}」：${rec.summary} 为了把这个产品做丰满，我想确认你的切入方式——你更倾向下面哪种方向？另外也方便的话告诉我团队规模和当前用的工具。`,
    branches,
    brief,
    done: false,
  };
}

// ───────────────────────── 入口 ─────────────────────────

export async function discover(
  messages: DiscoverMessage[],
  brief: ProductBrief | null,
  apiKey: string | undefined,
): Promise<DiscoverResponse> {
  const prev = brief ?? emptyBrief();
  // 无 key：首轮走启发式；非首轮（理论上不会发生，因为无 key 时前端只发首轮）也兜底
  if (!apiKey) {
    const first = messages.find((m) => m.role === "user");
    return runDiscoveryHeuristic(first?.content ?? "");
  }
  // 领域上下文：用首条用户消息启发式初判领域，注入 system，避免 AI 脱离领域空谈
  const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
  const domainCtx = buildDomainContext(firstUser);
  const raw = await callDeepSeek(messages, prev, apiKey, domainCtx);
  return sanitizeDiscover(raw, prev);
}
