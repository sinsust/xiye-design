/**
 * 统一 LLM 调用（OpenAI 兼容 chat/completions）——服务端唯一 fetch 落点。
 *
 * 所有 AI 功能都应经此调用：先按功能解析出模型（resolveLLM），再发起请求。
 * 这样「换模型 / 功能级分配」才能对全线功能生效。
 */

import type { FeatureKey } from "./features";
import { resolveLLM, type ResolvedModel } from "./resolve";
import { llmChat } from "./transport";

/** 「尚未配置 AI 模型」错误：用户需先到「设置 → AI 模型」添加并设为生效。 */
export const MODEL_NOT_CONFIGURED_MESSAGE = "尚未配置 AI 模型，请到「设置 → AI 模型」添加并设为生效。";

export class ModelNotConfiguredError extends Error {
  constructor(message: string = MODEL_NOT_CONFIGURED_MESSAGE) {
    super(message);
    this.name = "ModelNotConfiguredError";
  }
}

export interface ChatParams {
  /** 系统提示词 */
  system: string;
  /** 用户内容 */
  user: string;
  /** 要求返回合法 JSON（OpenAI-compatible response_format） */
  json?: boolean;
  /** 温度（默认 0.4） */
  temperature?: number;
  /** 超时毫秒（默认 40s） */
  timeoutMs?: number;
  /** 用量统计归属（可选）：缺省则不记流水 */
  meta?: { userId?: string | null; feature?: FeatureKey };
}

export interface ChatArgs extends ChatParams {
  /** 当前档案：决定用哪个模型（未配置任何模型时抛 ModelNotConfiguredError） */
  userId?: string | null;
  /** 该次调用所属功能：用于功能级模型分配 */
  feature?: FeatureKey;
}

/** 用指定模型发起一次请求，返回回复文本（统一经 llmChat，埋点在出口记一次） */
export async function chatWithModel(model: ResolvedModel, p: ChatParams): Promise<string> {
  return llmChat(model, {
    system: p.system,
    user: p.user,
    json: p.json,
    temperature: p.temperature,
    timeoutMs: p.timeoutMs,
    userId: p.meta?.userId,
    feature: p.meta?.feature,
  });
}

/** 解析模型 + 调用，返回回复文本 */
export async function chatComplete(args: ChatArgs): Promise<string> {
  const model = await resolveLLM(args.userId, args.feature);
  if (!model) throw new ModelNotConfiguredError();
  return chatWithModel(model, {
    ...args,
    // 自动带用量归属（调用方显式传了 meta 则以调用方为准）
    meta: args.meta ?? { userId: args.userId, feature: args.feature },
  });
}

/** 解析模型 + 调用，并解析为 JSON 对象 */
export async function chatJson<T = Record<string, unknown>>(args: ChatArgs): Promise<T> {
  const raw = await chatComplete({ ...args, json: true });
  return parseJsonResponse<T>(raw);
}

/** 解析模型输出：容忍 ```json 代码块包裹与前后杂文本 */
export function parseJsonResponse<T>(raw: string): T {
  let s = raw.trim();
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (start === -1 || end <= start) {
    throw new Error(`LLM 输出无法解析为 JSON: ${s.slice(0, 120)}`);
  }
  s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}