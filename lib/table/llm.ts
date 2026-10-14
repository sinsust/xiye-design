/**
 * 表格处理 —— LLM 客户端
 *
 * 模型由统一 LLM 层解析（resolveLLM），不再在此直接读取环境变量。
 * 仅供服务端调用；支持 JSON 模式。
 */

import { resolveLLM } from "@/lib/llm/resolve";
import { chatWithModel, ModelNotConfiguredError } from "@/lib/llm/chat";

/** LLM 调用选项 */
export interface ChatLLMOptions {
  /** 要求模型输出合法 JSON（OpenAI-compatible response_format） */
  json?: boolean;
  /** 超时毫秒（默认 40s；长输出任务如批量解读请显式传更长） */
  timeoutMs?: number;
  /** 温度（默认 0.4） */
  temperature?: number;
  /** 当前档案：决定用哪个模型（未配置任何模型时抛 ModelNotConfiguredError） */
  userId?: string | null;
  /** @deprecated 已废弃：路由改由模型配置决定，此字段接受但被忽略（仅为兼容旧请求契约保留） */
  forceRoute?: "qwen" | "deepseek";
}

/** 实际使用的模型标识（沿用旧类型名，语义为「实际使用的模型名」） */
export type LLMRouteId = string;

/**
 * 调用配置的 LLM（OpenAI-compatible chat completions）
 * @param system 系统提示词
 * @param user 用户内容
 * @returns 模型回复文本
 * @throws 请求失败时抛明确错误
 */
export async function chatLLM(system: string, user: string, opts: ChatLLMOptions = {}): Promise<string> {
  const model = await resolveLLM(opts.userId, "table-analysis");
  if (!model) throw new ModelNotConfiguredError();
  return chatWithModel(model, {
    system,
    user,
    json: opts.json,
    temperature: opts.temperature,
    timeoutMs: opts.timeoutMs,
    meta: { userId: opts.userId, feature: "table-analysis" },
  });
}

/**
 * 调用 LLM 并要求返回 JSON（自动去 markdown 代码块包裹）
 * @returns 解析后的对象
 */
export async function chatLLMJson<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: ChatLLMOptions = {},
): Promise<T> {
  const raw = await chatLLM(system, user, { ...opts, json: true });
  return parseJsonResponse<T>(raw);
}

/**
 * 调用 LLM 并要求返回 JSON，同时返回实际使用的模型名。
 * @returns 解析结果 + 实际使用的模型名
 */
export async function chatLLMJsonRouted<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: ChatLLMOptions = {},
): Promise<{ data: T; route: LLMRouteId }> {
  const model = await resolveLLM(opts.userId, "table-analysis");
  if (!model) throw new ModelNotConfiguredError();
  const raw = await chatWithModel(model, {
    system,
    user,
    json: true,
    temperature: opts.temperature,
    timeoutMs: opts.timeoutMs,
    meta: { userId: opts.userId, feature: "table-analysis" },
  });
  return { data: parseJsonResponse<T>(raw), route: model.name };
}

/** 解析模型输出：容忍 ```json 代码块包裹与前后杂文本 */
export function parseJsonResponse<T>(raw: string): T {
  let s = raw.trim();
  // 去掉 markdown 代码块围栏
  const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  // 截取第一个 { 或 [ 到最后一个 } 或 ]
  const start = s.search(/[[{]/);
  const end = Math.max(s.lastIndexOf("]"), s.lastIndexOf("}"));
  if (start === -1 || end <= start) {
    throw new Error(`LLM 输出无法解析为 JSON: ${s.slice(0, 120)}`);
  }
  s = s.slice(start, end + 1);
  return JSON.parse(s) as T;
}