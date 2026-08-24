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
  asPages,
  asExtra,
} from "@/lib/ai-discover";
import { interpretIntent, type IntentNarrative } from "@/lib/ai-intent";
import { METHODOLOGY_INJECTION } from "@/lib/ai-methodology";
import { SKILL_ASSEMBLY_INJECTION } from "@/lib/skill-assembly";
import { buildRagContext } from "@/lib/rag";

export const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const BASE_SYSTEM_PROMPT = `你是一位真正有实战经验的资深产品架构师，正在通过多轮对话，帮助用户把一个模糊的想法丰满成一份有洞察、能落地的产品 PRD。

【反平庸硬约束——必须遵守】
- 严禁放之四海皆准的套话（如「注重用户体验」「快速迭代」「以用户为中心」「数据驱动」）。每一条分析必须是这个产品特有的、非显而易见的。
- 给出洞察时尽量带具体依据：真实行业案例、可量化的取舍、该领域典型的失败/成功模式、反直觉的判断。
- 不要讨好用户，敢于指出想法里的漏洞、伪需求、或过早优化的陷阱。
- 领域参考只作底座，不被它框死：若用户的真实想法与识别类型不符，以用户为准。

【回复排版——结构化、扫读友好、突出关键信息】
- reply 必须输出简洁的 Markdown 文本（前端会渲染），不要写成一大段连排的散文，更不要用 ① ② ③ …… 这类内嵌序号硬怼成流水账。
- 推荐结构（按需裁剪，不必每轮都齐全）：
  1) 开头用一句话把「本轮最该记住的结论」加粗：**…**。
  2) 中间是短要点列表，每条用 "- " 开头独立成行、后跟一句说明；要点里的关键名词用 **加粗** 强调。
  3) 结尾给一句明确的下一步引导或单个问题（不要一次抛四五个问题）。
- 关键信息一律用 **加粗** 凸显；不要用『』引号堆关键词，也不要堆 emoji。
- 行与行之间留空行，控制篇幅（通常 80~160 字），保证一眼可扫读。

【每轮聚焦——往核心功能与产品特性深挖，并让用户看到方案在生长】
- 每轮优先深挖 1~2 个「核心功能 / 产品特性」的细节：它为用户解决什么、关键取舍、边界怎么划。不要总停在方向与宏观定位上反复绕。
- 每当本轮的 brief（vue/定位/核心模块/页面/取舍等）相对上一版有新增或修正时，在 reply 里显式地用一句「**本轮更新：**xxx」点明到底变了什么（新增了哪个功能、调了哪个取舍、补了哪个页面）。让用户清楚感知方案在一步步长出来。
- 追问时一次只问那个最关键的缺口；其余信息能从用户已答内容推断的就别再问。

【对话推进——按阶段自然决定，不要机械套模板】
- 初期（想法还模糊）：优先给出 2~3 个互斥且有真实差异的方向让用户选，并说清每个方向的代价与适用场景。
- 中期（方向已定）：停止抛方向，改为深挖具体细节、给出可执行建议、指出需要做的取舍。
- 后期（要素基本齐全）：停止提问，把 done 设为 true，branches 给空数组，回复改为「可以进入下一步了」的引导。
- 不要把「每轮必给分支 + 必抛问题」当成固定动作；当前阶段不需要时就不给。

【PRD 草稿（brief）字段】
- 标准字段（均为正向产品定义）：vision / positioning / targetAudience / coreModules / chosenDirections / phases / roles / pages。只产出「要开发什么」，不要输出非目标 / 风险 / 成功指标 / 待澄清这类负向或元信息板块。
- pages（核心要求）：必须从 coreModules 推导「业务专属页面」——每个核心模块都要对应它落地所需要的页面（区别于首页/认证/仪表盘等通用模板页）。每个页面含 name（页面名）、path（建议路由）、description（一句话功能描述）、relatedFeatures（数组，引用 coreModules 中的模块名）、priority（P0/P1/P2，核心链路页排 P0）。pages 与 coreModules 必须一一对应。
- 柔性字段 extra：当本产品有标准字段覆盖不到的关键要点时（例如冷启动策略、合规要点、关键指标定义、定价模式、渠道分发等），放进 extra 对象，key 为字段名（中文），value 为字符串或字符串数组。不要硬把不相关的东西塞进标准字段。
- 视觉设计系统：当用户明确表达了视觉/设计偏好（风格方向、配色、字体、动效基调）时，把提炼的设计系统写进 extra.visualSpec（多行文本，按「风格方向 / 配色(primary·cta·background·text，可用 #hex) / 字体配对 / 需避免的反模式」组织）；仅在用户表达了明确设计意图时写，没有设计讨论就不要放这个字段。
- 只更新/补充与本轮对话相关、且用户已确认或你已合理推断的字段；不要清空已填写字段。
- 唯一例外：用户明确要求「换方向 / 重来 / 推翻重做」时，允许整体重写 brief（可清空已填写字段、更换 coreModules 与方向），并必须在 reply 开头显式标注「**方案已替换：**」+ 一句新方向概述，让用户感知方向已切换；其余一切情况严格遵守「不清空」。

【输出格式——硬性要求】
你必须且只能输出一个 JSON 对象，这是唯一输出。禁止在 JSON 前后写任何解释、问候、过渡句或分析文字。
- 不要在 JSON 外加任何说明；如果写了分析，也必须放进 JSON 的 reply 字段里。
- 不要使用 markdown 代码块包裹。直接输出 { 开头的 JSON。
- 字段结构与示例保持一致：
{
  "reply": "<面向用户的结构化回复：一句加粗结论 + 简短要点列表 + 单个下一步问题；有更新时前面带「**本轮更新：**」。严格遵循上面「回复排版」要求，注意 Markdown 转义（每个换行用 \\n）>",
  "branches": [ { "id":"<短id>", "label":"<方向名>", "description":"<一句话差异点+代价>", "preview":"<可选：预期收益/周期>" } ],
  "brief": {
    "name": "<给这个产品取一个贴切、有记忆点的名字（短，品牌感优先，如「宠遇 Pety」；结合用户提到的品牌/品类，想不出来可先留空）>",
    "description": "<给这个产品写一句面向用户、能对外展示的描述（一句话，讲清它是谁、为谁解决什么；随访谈丰满持续打磨，作为最终交付的品牌档案摘要）>",
    "vision": "<产品愿景>",
    "positioning": "<定位/差异化>",
    "targetAudience": ["<用户>"],
    "coreModules": [ { "name":"<模块>", "detail":"<要点>" } ],
    "chosenDirections": ["<已确定的方向/分支>"],
    "phases": [ { "name":"<分期名>", "items": ["<要点>"] } ],
    "roles": [ { "role":"<角色>", "scope":"<数据/权限范围>" } ],
    "pages": [ { "name":"<由核心模块推导的业务专属页面名>", "path":"<建议路由>", "description":"<一句话功能描述>", "relatedFeatures":["<关联的 coreModules 模块名>"], "priority":"P0|P1|P2" } ],
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
  return `${BASE_SYSTEM_PROMPT}\n\n${METHODOLOGY_INJECTION}\n\n${SKILL_ASSEMBLY_INJECTION}${domainCtx}`;
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

/** 真正 LLM 摘要：把窗口外更早的对话压缩成一段结构化摘要（跨轮复用缓存）。
 * currentBrief 仍随每轮注入 system 作结构化记忆，摘要补充「用户曾说过什么」的语气/方向脉络。 */
const summaryCache = new Map<string, string>();

async function summarizeOldMessages(
  older: DiscoverMessage[],
  apiKey: string | undefined,
): Promise<string> {
  if (!apiKey || !older.length) return "";
  const first = older.find((m) => m.role === "user");
  const key = `${older.length}|${first?.content.slice(0, 12) ?? ""}`;
  const cached = summaryCache.get(key);
  if (cached) return cached;
  try {
    const text = older
      .map((m) => `${m.role === "user" ? "用户" : "AI"}: ${m.content.slice(0, 220)}`)
      .join("\n");
    const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0.3,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content:
              "把下面这段产品访谈的早期对话压缩成一段结构化摘要（200字内）。必须包含：① 用户想要的产品与所属领域；② 已确认的方向与核心需求；③ 已做出的关键决策/取舍；④ 待澄清的问题。只输出摘要正文，不要标题、不要解释。",
          },
          { role: "user", content: text },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const summary = (data?.choices?.[0]?.message?.content ?? "")
      .trim()
      .slice(0, 800);
    if (summary) summaryCache.set(key, summary);
    if (summaryCache.size > 100) summaryCache.clear();
    return summary;
  } catch {
    return "";
  }
}

/**
 * 压缩历史窗口：保留最近 RECENT_FULL_KEEP 条完整；更早的对话优先用「LLM 摘要」承载
 * （真正摘要，保留需求/方向/决策脉络），摘要不可用时退化为「仅留 user 侧截断」。
 */
async function buildMessageWindow(
  messages: DiscoverMessage[],
  apiKey: string | undefined,
): Promise<{ role: string; content: string }[]> {
  if (messages.length <= RECENT_FULL_KEEP) return trimHistory(messages);
  const recent = messages.slice(-RECENT_FULL_KEEP);
  const older = messages.slice(0, messages.length - RECENT_FULL_KEEP);
  const summary = await summarizeOldMessages(older, apiKey);
  if (summary) {
    return [
      { role: "user", content: `（更早对话摘要）${summary}` },
      ...trimHistory(recent),
    ];
  }
  // 摘要失败兜底：只留 user 侧截断
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

async function toOpenAIMessages(
  messages: DiscoverMessage[],
  currentBrief: ProductBrief,
  domainCtx: string,
  apiKey: string | undefined,
): Promise<{ role: string; content: string }[]> {
  const out: { role: string; content: string }[] = [
    {
      role: "system",
      content: `${buildSystemPrompt(domainCtx)}\n\n当前 PRD 草稿（请在此基础上更新，不要清空已填写字段）：\n${JSON.stringify(currentBrief, null, 2)}`,
    },
  ];
  const window = await buildMessageWindow(messages, apiKey);
  for (const m of window) {
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
export function extractJson(content: string): RawOutput {
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
  const baseMessages = await toOpenAIMessages(
    messages,
    currentBrief,
    domainCtx,
    apiKey,
  );

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

/** 用户最近一条消息是否表达了「换方向 / 推翻重来」意图（防漂移 + 允许整体替换的关键信号） */
const DIRECTION_CHANGE_RE =
  /换(?:个|一个|一下)?(?:方向|思路|方案|做法)|重来|重做|推翻|推倒|全删|重新(?:想|来|规划|定义|做)|不对.{0,6}(?:方向|思路)|另一个方向|换一条路|换个(?:产品|东西)/;

function wantsDirectionChange(messages: DiscoverMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    return DIRECTION_CHANGE_RE.test(messages[i].content);
  }
  return false;
}

function sanitizeBrief(
  raw: Record<string, unknown> | undefined,
  prev: ProductBrief,
  opts?: { resetDirections?: boolean },
): ProductBrief {
  if (!raw || typeof raw !== "object") return prev;
  return {
    name:
      typeof raw.name === "string" && raw.name.trim()
        ? raw.name.trim()
        : prev.name ?? "",
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim()
        : prev.description ?? "",
    vision: typeof raw.vision === "string" && raw.vision.trim() ? raw.vision.trim() : prev.vision,
    positioning:
      typeof raw.positioning === "string" && raw.positioning.trim()
        ? raw.positioning.trim()
        : prev.positioning,
    targetAudience: asStringArray(raw.targetAudience).length
      ? asStringArray(raw.targetAudience)
      : prev.targetAudience,
    coreModules: asModules(raw.coreModules).length ? asModules(raw.coreModules) : prev.coreModules,
    // 换方向（resetDirections）：以模型返回为准，允许清空旧方向；常规则「模型没返回就沿用」，防漂移
    chosenDirections: (() => {
      const dirs = asStringArray(raw.chosenDirections);
      if (opts?.resetDirections) return dirs;
      return dirs.length ? dirs : prev.chosenDirections;
    })(),
    phases: asPhases(raw.phases).length ? asPhases(raw.phases) : prev.phases,
    roles: asRoles(raw.roles).length ? asRoles(raw.roles) : prev.roles,
    pages: asPages(raw.pages).length ? asPages(raw.pages) : prev.pages,
    extra: Object.keys(asExtra(raw.extra)).length ? asExtra(raw.extra) : prev.extra,
  };
}

export function sanitizeDiscover(
  raw: RawOutput,
  prevBrief: ProductBrief,
  opts?: { resetDirections?: boolean },
): DiscoverResponse {
  return {
    reply:
      typeof raw.reply === "string" && raw.reply.trim()
        ? raw.reply.trim()
        : "好的，我理解了你的想法，我们继续深入。",
    branches: sanitizeBranches(raw.branches),
    brief: sanitizeBrief(
      raw.brief as Record<string, unknown> | undefined,
      prevBrief,
      opts,
    ),
    done: Boolean(raw.done),
  };
}

// ───────────────────────── 离线启发式首轮兜底 ─────────────────────────

/** 启发式取名：从用户原句里抠出可能的产品名关键词，否则用类型名兜底（纯规则，不扣 AI） */
function deriveHeuristicName(text: string, typeName: string): string {
  // 常见品牌/产品名模式：引号包裹、或「做一个X」「名叫X叫」等
  const quoted = text.match(/[「」『』“”"'\"]([^「」『』“”"'\"\s，。]{2,20})[「」『』“”"'\"\s，。]/);
  const afterVerb = text.match(/做(?:一?个|一款|一套)["「『“']?([\u4e00-\u9fa5A-Za-z0-9·]{2,16})/);
  const candidate = (quoted?.[1] ?? afterVerb?.[1] ?? "").trim();
  return candidate || `${typeName}工作台`;
}

/** 启发式一句描述：从 input + 叙事里拼一句「为谁解决什么」的话（供对外展示） */
function deriveHeuristicDescription(text: string, n: IntentNarrative): string {
  const trimmed = text.trim().replace(/[。.!！?？]+$/, "");
  if (trimmed && trimmed.length <= 40) return trimmed;
  const aud = n.targetAudience.join("、") || "目标用户";
  const feat = n.coreFeatures[0]?.name || n.vision?.replace(/^致力于|打造一个「|」产品.*$/, "") || "核心能力";
  return `面向${aud}的一款${feat}相关产品。`;
}

/** 无 API key / 网络不可用时，用启发式给出一个有结构的首轮（比单轮表单更丰满） */
export function runDiscoveryHeuristic(text: string): DiscoverResponse {
  const rec = interpretIntent(text);
  const n = rec.narrative;
  const brief: ProductBrief = {
    ...emptyBrief(),
    name: deriveHeuristicName(text, rec.projectType.name),
    description: deriveHeuristicDescription(text, n),
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
  moderatorName?: string,
): Promise<DiscoverResponse> {
  const prev = brief ?? emptyBrief();
  // 无 key：首轮走启发式；非首轮（理论上不会发生，因为无 key 时前端只发首轮）也兜底
  if (!apiKey) {
    const first = messages.find((m) => m.role === "user");
    return runDiscoveryHeuristic(first?.content ?? "");
  }
  // 领域上下文：用首条用户消息启发式初判领域，注入 system，避免 AI 脱离领域空谈；
  // 叠加 RAG 检索命中知识库技能片段，让 AI 能真实借鉴 /library 里沉淀的方法论与案例。
  const firstUser = messages.find((m) => m.role === "user")?.content ?? "";
  const persona = moderatorName
    ? `你当前的对外身份名是「${moderatorName}」，请以这个名字自称，并以一个资深产品架构师的口吻与用户多轮对话。\n\n`
    : "";
  const domainCtx = persona + buildDomainContext(firstUser) + (await buildRagContext(firstUser));
  // 防跑偏 + 替换：用户明确换方向时，传给模型的 prev 清空已定方向（允许重新定），
  // 且 sanitize 允许空方向覆盖旧值；否则方向字段「模型没返回就沿用」，避免漂移。
  const change = wantsDirectionChange(messages);
  const effectivePrev = change ? { ...prev, chosenDirections: [] } : prev;
  const raw = await callDeepSeek(messages, effectivePrev, apiKey, domainCtx);
  return sanitizeDiscover(raw, prev, { resetDirections: change });
}
