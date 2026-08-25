/**
 * 表格处理 —— LLM 客户端
 *
 * 复用第二大脑统一的 LLM_MODEL_* 环境变量（与 brain-organizer 同一套配置）。
 * 仅供服务端调用；支持 JSON 模式。
 */

/** LLM 调用选项 */
export interface ChatLLMOptions {
  /** 要求模型输出合法 JSON（OpenAI-compatible response_format） */
  json?: boolean;
  /** 超时毫秒（默认 25s） */
  timeoutMs?: number;
  /** 温度（默认 0.4） */
  temperature?: number;
}

/**
 * 调用配置的 LLM（OpenAI-compatible chat completions）
 * @param system 系统提示词
 * @param user 用户内容
 * @returns 模型回复文本
 * @throws 未配置 LLM 或请求失败时抛明确错误
 */
export async function chatLLM(system: string, user: string, opts: ChatLLMOptions = {}): Promise<string> {
  const baseUrl = (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.LLM_MODEL_API_KEY;
  const model = process.env.LLM_MODEL_MODEL_ID;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM 未配置（LLM_MODEL_BASE_URL / LLM_MODEL_API_KEY / LLM_MODEL_MODEL_ID）");
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 25000),
  });

  if (!res.ok) {
    throw new Error(`LLM 请求失败: HTTP ${res.status}`);
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  if (!content) {
    throw new Error("LLM 返回空内容");
  }
  return content;
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
