// 多 Agent 会诊后端（Phase 2）：给定产品 brief，4 个专家角色各自独立调用大模型，
// 并行产出结构化状态（status / progress / summary），前端据此更新专家卡。
//
// 复用 ai-discover-server 的 DeepSeek 封装（extractJson + DEEPSEEK 常量 + 重试/降级模式），
// 但每个角色使用独立 system prompt，上下文为「已生长的产品 brief 文本」。

import { type ProductBrief, synthesizeBriefToText } from "@/lib/ai-discover";
import {
  extractJson,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODEL,
} from "@/lib/ai-discover-server";
import {
  buildGuardNormDetails,
  guardSummary,
} from "@/lib/guard-norms";
import { getStyle, type AgentStyleId } from "@/lib/agent-styles";

export type PanelAgentId = "moderator" | "pm" | "architect" | "designer" | "guard";
export type PanelStatus = "done" | "thinking" | "producing";

export interface PanelAgentResult {
  id: PanelAgentId;
  status: PanelStatus;
  progress: number;
  summary: string;
  details: string[];
}

const AGENT_SYSTEM_BASE: Record<PanelAgentId, string> = {
  moderator: `你是多 Agent 协同工作台里的「__TITLE__」，负责统筹__FRAMING__会诊。
基于下方产品定义，给出：当前最该优先确认的关键问题、需要用户补充的约束、以及下一步建议。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话给用户的协调结论>", "details": ["<关键要点1>", "<关键要点2>", "..."] }`,
  pm: `你是多 Agent 协同工作台里的「产品经理」，负责把想法结构化为 PRD，并**直接产出设计方案**（而非只审查缺什么）。
基于下方产品定义，以产品经理身份主动给出你的设计草案：
1) 页面清单：直接列出买家端 / 卖家端 / 鉴定师端 / 管理后台的核心页面（如发布页、鉴定预约页、报告展示页、担保交易页、纠纷处理页），并标注优先级；
2) 关键交易流程：发布 → 鉴定预约 → 报告 → 担保交易 → 纠纷处理 的页面流转；
3) 功能规则：对「同城匹配」（地图展示 / 列表筛选 / 推送通知）、「信用担保·先行赔付」（赔付条件 / 额度 / 流程）、「鉴定报告」（模板 / 关键指标 / 可视化）给出你的设计要点；
4) 冷启动：校园地推 / 社区合作等运营活动与种子用户获取渠道；
5) 关键指标：定义与计算口径（如鉴定报告覆盖率、担保交易转化率）。
若信息仍不完整，也要基于已有素材先给方案草稿，并用「待确认：…」标注真正需要用户拍板的点；不要通篇只写「缺少…」。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话产品侧结论，例如已设计出的核心页面/能力>", "details": ["<设计要点1，例如：买家端页面：首页/商品详情/下单/订单跟踪（高优先级）>", "<设计要点2，例如：先行赔付草案：满足条件X可获赔，额度上限Y，流程为…>", "..."] }`,
  architect: `你是多 Agent 协同工作台里的「系统架构师」，负责技术选型与风险。
基于下方产品定义，给出：推荐前后端技术栈、关键架构取舍、主要技术风险与应对。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话技术侧结论>", "details": ["<前端/后端选型与理由1>", "<架构取舍2>", "<主要风险与应对3>", "..."] }`,
  designer: `你是多 Agent 协同工作台里的「UI/UX 设计师」，负责视觉与交互基调。
基于下方产品定义，给出：推荐的视觉风格方向、组件基调、关键交互建议。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话设计侧结论>", "details": ["<视觉风格方向1>", "<组件/交互建议2>", "..."] }`,
  guard: `你是多 Agent 协同工作台里的「规范守门员」，负责定义未来 AI 编程时不漂移的边界规范。
基于下方产品定义，输出一套「开发边界规范」，覆盖四类：
1) 视觉边界：设计 token 唯一真值（以 globals.css :root 为准）、禁止硬编码颜色/圆角、单一 accent、动效只动 transform/opacity、尊重 prefers-reduced-motion；
2) 代码边界：目录分层（app/src/backend/lib）、无 TODO/FIXME 遗留、无密钥泄漏（.env 不进库）、类型检查通过、可脚本化验收（verify.mjs）；
3) 反 AI 味：无 em-dash、无纯黑纯白直出、克制动效、避免模板化排版；
4) 安全边界：敏感接口必须鉴权、AI 与登录/注册接口限流防刷、密钥只走服务端环境变量（不进前端/不进库/不入 zip）、CSRF 防护、错误信息不泄露内部细节、数据库变更走迁移。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话规范侧结论>", "details": ["<边界规范1>", "<边界规范2>", "..."] }`,
};

/** 按风格解析各角色 system prompt（仅 moderator 含风格头衔/框架词，其余角色中立） */
export function buildAgentSystem(styleId?: string | null): Record<PanelAgentId, string> {
  const style = getStyle(styleId);
  const moderator = AGENT_SYSTEM_BASE.moderator
    .replace("__TITLE__", style.moderatorTitle)
    .replace("__FRAMING__", style.framing);
  return { ...AGENT_SYSTEM_BASE, moderator };
}

const CORRECT_HINT =
  "你上一轮的回复不是合法 JSON，无法被程序解析。请严格只输出一个 JSON 对象：不要任何解释文字、不要 markdown 代码块、不要 JSON 外的任何字符，直接以 { 开头、以 } 结尾。";

interface RawPanel {
  status?: string;
  progress?: number;
  summary?: string;
  details?: unknown;
}

/** 计算产品定义的完整度（0-1），用于约束模型返回的 progress 不会脱离实际 */
function briefCompleteness(brief: ProductBrief | null): number {
  if (!brief) return 0;
  const checks: [unknown, number][] = [
    [brief.vision, 1],
    [brief.positioning, 1],
    [brief.description, 0.8],
    [brief.targetAudience?.length, 0.8],
    [brief.coreModules?.length, 0.8],
    [brief.pages?.length, 0.7],
    [brief.chosenDirections?.length, 0.5],
    [brief.phases?.length, 0.5],
    [brief.roles?.length, 0.5],
    [brief.extra && Object.keys(brief.extra).length, 0.5],
  ];
  let score = 0;
  let total = 0;
  for (const [val, weight] of checks) {
    total += weight;
    const ok = Array.isArray(val) ? val.length > 0 : Boolean(val);
    if (ok) score += weight;
  }
  return Math.min(1, score / total);
}

/** 根据完整度给 progress 封顶，防止模型在信息极少时给出离谱的高进度 */
function capProgressByCompleteness(progress: number, completeness: number): number {
  if (completeness < 0.15) return Math.min(progress, 12);
  if (completeness < 0.35) return Math.min(progress, 30);
  if (completeness < 0.6) return Math.min(progress, 55);
  if (completeness < 0.85) return Math.min(progress, 82);
  return progress;
}

function normalize(id: PanelAgentId, raw: RawPanel, completeness: number): PanelAgentResult {
  const statusMap: Record<string, PanelStatus> = {
    done: "done",
    thinking: "thinking",
    producing: "producing",
  };
  const statusRaw = (raw.status ?? "").toLowerCase();
  const details = Array.isArray(raw.details)
    ? raw.details
        .filter((d) => typeof d === "string" && d.trim())
        .map((d) => d.trim())
        .slice(0, 12)
    : [];
  const hasDetails = details.length > 0;
  // 规范师产出的「开发边界规范」是可复用知识，不随产品定义完整度打折：
  // 只要会诊返回了要点，即便访谈期 brief 不全也直接算已产出（done），且进度不被压到 thinking。
  const isGuard = id === "guard";
  const status: PanelStatus = isGuard && hasDetails
    ? statusMap[statusRaw] === "thinking" || statusMap[statusRaw] === "producing"
      ? "done"
      : statusMap[statusRaw] ?? "done"
    : statusMap[statusRaw] ?? (hasDetails ? "done" : "producing");
  const rawProgress =
    typeof raw.progress === "number" && raw.progress >= 0 && raw.progress <= 100
      ? Math.round(raw.progress)
      : isGuard ? 60 : 20;
  const progress = isGuard ? Math.min(100, Math.max(hasDetails ? 60 : 0, rawProgress)) : capProgressByCompleteness(rawProgress, completeness);
  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : "已给出专业意见。";
  return { id, status, progress, summary, details };
}

/** 无 key / 调用失败时的启发式兜底，基于完整度给出合理低进度，保证 UI 永远有响应 */
function heuristicPanel(id: PanelAgentId, completeness: number): PanelAgentResult {
  const baseMap: Record<PanelAgentId, number> = {
    moderator: completeness < 0.15 ? 5 : completeness < 0.35 ? 20 : completeness < 0.6 ? 40 : 65,
    pm: completeness < 0.15 ? 3 : completeness < 0.35 ? 15 : completeness < 0.6 ? 35 : 60,
    architect: completeness < 0.15 ? 0 : completeness < 0.35 ? 10 : completeness < 0.6 ? 25 : 50,
    designer: completeness < 0.15 ? 0 : completeness < 0.35 ? 8 : completeness < 0.6 ? 22 : 45,
    guard: completeness < 0.15 ? 0 : completeness < 0.35 ? 8 : completeness < 0.6 ? 22 : 45,
  };
  const progress = capProgressByCompleteness(baseMap[id] ?? 10, completeness);
  const status: PanelStatus = progress >= 95 ? "done" : progress >= 30 ? "producing" : "thinking";
  const summaries: Record<PanelAgentId, string> = {
    moderator:
      completeness < 0.15
        ? "先聊清楚需求，我再调度专家。"
        : "已梳理部分信息，继续深入可提升准确度。",
    pm:
      completeness < 0.15
        ? "产品定义素材不足，等待更多对话。"
        : "产品轮廓初现，继续完善定位与功能。",
    architect:
      completeness < 0.15
        ? "技术需求尚不明确。"
        : "根据已有信息初步思考技术方案。",
    designer:
      completeness < 0.15
        ? "缺少风格方向输入。"
        : "从描述中捕捉视觉倾向。",
    guard:
      completeness < 0.15
        ? "规范边界需先明确产品与方案。"
        : "从描述中梳理开发边界与验收规则。",
  };
  const detailsMap: Record<PanelAgentId, string[]> = {
    moderator: ["待确认：目标用户与核心场景", "待补充：明确的交付范围"],
    pm: ["将设计：定位 / 目标用户 / 核心功能", "将产出：页面清单与优先级"],
    architect: ["待明确：前端与后端技术栈", "待评估：主要技术风险与应对"],
    designer: ["待明确：行业气质与情绪基调", "待产出：组件基调与关键交互"],
    guard: ["待明确：设计 token 唯一真值与硬编码边界", "待产出：代码验收与反 AI 味规则"],
  };
  return { id, status, progress, summary: summaries[id], details: detailsMap[id] };
}

async function callPanelAgent(
  system: string,
  context: string,
  apiKey: string,
): Promise<RawPanel> {
  const url = `${DEEPSEEK_BASE_URL}/chat/completions`;
  const baseMessages = [
    { role: "system", content: system },
    { role: "user", content: context },
  ];

  let lastEmpty = false;
  let lastErr: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    const useJson = attempt === 0 ? true : attempt === 1 ? !lastEmpty : false;
    const useHint = attempt >= 1;
    const apiMessages = useHint
      ? [...baseMessages, { role: "user", content: CORRECT_HINT }]
      : baseMessages;

    const body = JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.6,
      max_tokens: 2000,
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
      throw new Error(`network:${reason}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[ai-panel] DeepSeek non-ok:", res.status, text.slice(0, 300));
      throw new Error(`http:${res.status}`);
    }

    try {
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        lastEmpty = true;
        lastErr = new Error("parse:empty");
        continue;
      }
      return extractJson(content) as RawPanel;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("parse:unknown");
}

/** 规范师：直接取预置规范库，不走 LLM（通用规则不消耗 token）。对外表现一次会诊，实为本地拼装。 */
function guardPanelResult(completeness: number): PanelAgentResult {
  const details = buildGuardNormDetails();
  return {
    id: "guard",
    status: "done",
    progress: 100,
    summary: guardSummary(),
    details,
  };
}

export async function consultAgents(
  brief: ProductBrief | null,
  apiKey: string | undefined,
  messages?: { role: string; content: string }[],
  persona?: { role: string; name: string }[],
  styleId?: string | null,
): Promise<PanelAgentResult[]> {
  const completeness = briefCompleteness(brief);
  const ids = Object.keys(AGENT_SYSTEM_BASE) as PanelAgentId[];
  const style = getStyle(styleId);

  // 用户自定义人设：把对应角色的对外姓名注入 system prompt（影响 AI 自称/被称呼）
  const personaMap = new Map((persona ?? []).map((p) => [p.role, p.name.trim()]));
  const systemMap = buildAgentSystem(styleId);
  const systemPrompt = (id: PanelAgentId): string => {
    const base = systemMap[id];
    const name = personaMap.get(id);
    if (!name) return base;
    return `你的对外人设姓名是「${name}」，请以这个名字自称，并在与用户沟通 / 输出要点时使用这个名字。\n${base}`;
  };

  const context = brief
    ? `${synthesizeBriefToText(brief)}\n\n【系统提示】当前产品定义完整度约 ${Math.round(
        completeness * 100,
      )}%，请据此给出合理的进度百分比。如果定义尚不完整，progress 应偏低（<30），状态应为 thinking 或 producing，不要直接 done。`
    : "（目前用户只给了一句话/初步想法，产品定义几乎为空。请给出启动建议，并把 progress 设为 5-15，状态为 thinking。）";

  // 追加最近对话片段：brief 尚空时也能让会诊基于真实上下文产出
  const convo = (messages ?? [])
    .filter((m) => m && typeof m.content === "string" && m.content.trim())
    .slice(-12)
    .map((m) => `${m.role === "user" ? "用户" : style.moderatorTitle}：${m.content.trim()}`)
    .join("\n");
  const fullContext = convo ? `${context}\n\n【最近对话】\n${convo}` : context;

  return Promise.all(
    ids.map(async (id) => {
      // 规范师是通用知识，直接取预置规范库，不消耗模型 token
      if (id === "guard") {
        return {
          ...guardPanelResult(completeness),
          // 尚无产品定义时仍给完整规范集，只是不额外强调与项目的贴合度
        };
      }
      if (!apiKey) return heuristicPanel(id, completeness);
      try {
        const raw = await callPanelAgent(systemPrompt(id), fullContext, apiKey);
        return normalize(id, raw, completeness);
      } catch (err) {
        console.error(`[ai-panel] ${id} failed:`, err instanceof Error ? err.message : err);
        return heuristicPanel(id, completeness);
      }
    }),
  );
}
