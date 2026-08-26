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
  /** 超时毫秒（默认 40s；长输出任务如批量解读请显式传更长） */
  timeoutMs?: number;
  /** 温度（默认 0.4） */
  temperature?: number;
  /** 手动强制线路（默认自动：线路1 失败自动切线路2）；"qwen"|"deepseek" */
  forceRoute?: "qwen" | "deepseek";
}

/** 双线路标识 */
export type LLMRouteId = "qwen" | "deepseek";

/** 一条线路的配置（读取对应 env） */
interface LLMRoute {
  id: LLMRouteId;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/** 读取全部已配置线路（未配置完整三件套的线路跳过） */
export function listLLMRoutes(): LLMRoute[] {
  const routes: LLMRoute[] = [
    {
      id: "qwen",
      name: "Qwen",
      baseUrl: (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, ""),
      apiKey: process.env.LLM_MODEL_API_KEY || "",
      model: process.env.LLM_MODEL_MODEL_ID || "",
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      baseUrl: (process.env.DEEPSEEK_BASE_URL || "").replace(/\/+$/, ""),
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      model: process.env.DEEPSEEK_MODEL || "",
    },
  ];
  return routes.filter((r) => r.baseUrl && r.apiKey && r.model);
}

/** 指定线路调用 LLM（OpenAI-compatible chat completions），返回回复文本 */
async function chatLLMWithRoute(
  route: LLMRoute,
  system: string,
  user: string,
  opts: ChatLLMOptions = {},
): Promise<string> {
  const res = await fetch(`${route.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${route.apiKey}`,
    },
    body: JSON.stringify({
      model: route.model,
      temperature: opts.temperature ?? 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 40000),
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
 * 调用配置的 LLM（OpenAI-compatible chat completions）
 * 兼容旧接口：只走线路1（Qwen）；新代码请用 chatLLMRouted / chatLLMJsonRouted。
 * @param system 系统提示词
 * @param user 用户内容
 * @returns 模型回复文本
 * @throws 未配置 LLM 或请求失败时抛明确错误
 */
export async function chatLLM(system: string, user: string, opts: ChatLLMOptions = {}): Promise<string> {
  const routes = listLLMRoutes();
  if (routes.length === 0) {
    throw new Error("LLM 未配置（LLM_MODEL_BASE_URL / LLM_MODEL_API_KEY / LLM_MODEL_MODEL_ID）");
  }
  return chatLLMWithRoute(routes[0], system, user, opts);
}

/**
 * 调用 LLM 并要求返回 JSON（自动去 markdown 代码块包裹）
 * 兼容旧接口：只走线路1；新代码请用 chatLLMJsonRouted。
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
 * 双线路路由调用：多条线路**并行**发出（先成功者胜），避免串行 N×超时撞平台函数时限。
 * 支持 forceRoute 手动强制某条线路（跳过另一条）。
 * @returns 解析结果 + 实际使用的线路
 */
export async function chatLLMJsonRouted<T = Record<string, unknown>>(
  system: string,
  user: string,
  opts: ChatLLMOptions = {},
): Promise<{ data: T; route: LLMRouteId }> {
  const routes = listLLMRoutes();
  if (routes.length === 0) {
    throw new Error("LLM 未配置（需要 LLM_MODEL_* 或 DEEPSEEK_* 至少一组）");
  }
  // 强制线路：只用该条；自动：全部线路并行
  const order = opts.forceRoute
    ? routes.filter((r) => r.id === opts.forceRoute)
    : routes;

  if (order.length === 1) {
    // 单线路：直接调用（强制线路 / 只配了一条）
    const raw = await chatLLMWithRoute(order[0], system, user, { ...opts, json: true });
    return { data: parseJsonResponse<T>(raw), route: order[0].id };
  }

  // 多线路并行：先成功者胜；全败取最后一次错误
  const results = await Promise.allSettled(
    order.map(async (route) => {
      const raw = await chatLLMWithRoute(route, system, user, { ...opts, json: true });
      return { data: parseJsonResponse<T>(raw), route: route.id };
    }),
  );
  let lastErr: unknown = null;
  for (const r of results) {
    if (r.status === "fulfilled") return r.value;
    lastErr = r.reason;
  }
  throw lastErr instanceof Error ? lastErr : new Error("两条线路均调用失败");
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
