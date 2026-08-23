// 知识库手工新增条目的「AI 完善」：根据 分类 / 名称 / 正文 / 地址，
// 用 LLM_MODEL_*（Qwen，OpenAI 兼容）自动产出 summary / useCase / tags / stack。
// 未配置或调用失败时回退到本地启发式，保证新增一定能保存。

import { KNOWLEDGE_TYPE_META, type KnowledgeType } from "./knowledge-types";

export interface KnowledgeMeta {
  summary: string;
  useCase: string;
  tags: string[];
  stack: string[];
}

const FALLBACK_SUMMARY: Record<KnowledgeType, string> = {
  skill: "一份可复用的技能：让 AI 按既定流程产出稳定、可预期的结果。",
  service: "一个可用服务：说明能力与调用方式，便于运行时集成。",
  repository: "一个代码仓库：含仓库地址与用途说明，可随时贴给 AI 工具。",
  prompt: "一条提示词：完整原文可随时一键复制使用。",
  pattern: "一种架构范式：描述推荐做法、适用边界与取舍。",
  design: "一条设计参考：记录风格、配色、版式要点供复用。",
  reference: "一份官方资料：记录官网 / 文档地址，便于溯源查阅。",
};

const FALLBACK_USE_CASE: Record<KnowledgeType, string> = {
  skill: "按名称调用即可复用；需要稳定、可复现的输出时使用。",
  service: "在对应流程中按说明调用该服务。",
  repository: "需要代码示例或直接复用该仓库时使用。",
  prompt: "把「提示词正文」整段复制给 AI 工具即可使用。",
  pattern: "设计该领域方案时优先参考此范式。",
  design: "做界面/风格设计时参考其中的要点。",
  reference: "需要查询权威来源时查阅这份资料。",
};

function heuristic(type: KnowledgeType, name: string): KnowledgeMeta {
  return {
    summary: `${FALLBACK_SUMMARY[type]}（${name || "新建条目"}）`,
    useCase: FALLBACK_USE_CASE[type],
    tags: [],
    stack: [],
  };
}

function parseRaw(content: string): KnowledgeMeta {
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const raw = JSON.parse(cleaned) as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  return {
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    useCase: typeof raw.useCase === "string" ? raw.useCase.trim() : "",
    tags: arr(raw.tags),
    stack: arr(raw.stack),
  };
}

async function callQwen(
  meta: KnowledgeMeta,
  apiKey: string,
  baseUrl: string,
  model: string,
  type: KnowledgeType,
  name: string,
  body: string,
  repoUrl?: string,
  source?: string,
  localPath?: string,
): Promise<KnowledgeMeta> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是知识库策展助手。根据给定的「分类 / 名称 / 正文 / 地址」，输出严格 JSON，键为：" +
            "summary（一句话，≤100 字，说明这条资产的作用与价值）、useCase（适用场景 / 何时使用）、" +
            "tags（3–5 个主题标签字符串数组）、stack（相关技术栈，可为空数组）。只输出 JSON，不要多余内容。",
        },
        {
          role: "user",
          content: JSON.stringify({
            type,
            name,
            body,
            repoUrl,
            source,
            localPath,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`knowledge_ai_${res.status}`);
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("knowledge_ai_empty");
  const parsed = parseRaw(content);
  // 缺失字段用启发式兜底，保证字段非空且与分类关联
  return {
    summary: parsed.summary || meta.summary,
    useCase: parsed.useCase || meta.useCase,
    tags: parsed.tags.length || meta.tags.length ? (parsed.tags.length ? parsed.tags : meta.tags) : [],
    stack: parsed.stack,
  };
}

export interface KnowledgeGenerateInput {
  type: KnowledgeType;
  name: string;
  body?: string;
  repoUrl?: string;
  source?: string;
  localPath?: string;
}

/** 优先 Qwen，失败/未配置回退启发式。仅在服务端调用（依赖 LLM_MODEL_* 环境变量）。 */
export async function generateKnowledgeMeta(
  input: KnowledgeGenerateInput,
  apiKey = process.env.LLM_MODEL_API_KEY || "",
  baseUrl = process.env.LLM_MODEL_BASE_URL || "",
  model = process.env.LLM_MODEL_MODEL_ID || "",
): Promise<KnowledgeMeta> {
  const base = heuristic(input.type, input.name);
  if (apiKey && baseUrl && model && KNOWLEDGE_TYPE_META.some((m) => m.id === input.type)) {
    try {
      return await callQwen(
        base,
        apiKey,
        baseUrl,
        model,
        input.type,
        input.name,
        input.body ?? "",
        input.repoUrl,
        input.source,
        input.localPath,
      );
    } catch {
      // Qwen 失败 → 用启发式结果
    }
  }
  return base;
}