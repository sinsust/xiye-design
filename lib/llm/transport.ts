/**
 * 统一 LLM 传输出口（单一 fetch 落点）
 *
 * 背景：早期 AI 调用散落在 12+ 个 server 文件里各自 fetch model.baseUrl，
 * 既重复又让「用量统计 / 超时 / 错误处理」无法统一。这里收敛为唯一出口，
 * 所有 AI 调用（chatWithModel、table、各 *-server）都经由此函数，
 * 埋点（recordUsage）只在成功后记一次。
 *
 * 铁律：
 * - 只记**成功**调用（拿到非空 content）；失败/空返回不计数、不花钱记录。
 * - recordUsage 本身 fire-and-forget，绝不阻断主流程。
 * - userId 缺省兜底 "local"（单机应用恒为本地档案，隔离无意义）。
 */

import type { ResolvedModel } from "./resolve";
import type { FeatureKey } from "./features";
import { recordUsage } from "./usage";

export interface LlmChatOpts {
  system: string;
  user: string;
  /** 要求 JSON 响应（OpenAI response_format） */
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
  userId?: string | null;
  feature?: FeatureKey | string;
  /** 5xx / 网络抖动重试次数（默认 0）；每次重试前不重复记 usage */
  retries?: number;
}

/** 统一发起一次 chat/completions 请求，成功返回 content 文本 */
export async function llmChat(model: ResolvedModel, opts: LlmChatOpts): Promise<string> {
  const startedAt = Date.now();
  const attempts = 1 + Math.max(0, opts.retries ?? 0);
  let lastErr: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${model.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: model.model,
          temperature: opts.temperature ?? 0.4,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 40000),
      });

      if (!res.ok) {
        // 5xx 可重试；4xx（401/429/400）直接失败
        if (res.status >= 500 && i < attempts - 1) {
          lastErr = new Error(`LLM 服务暂不可用（${res.status}），重试中`);
          continue;
        }
        throw new Error(`LLM 请求失败: HTTP ${res.status}`);
      }

      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content ?? "";
      if (!content) {
        throw new Error("LLM 返回空内容");
      }

      // 只读用量流水（只记成功调用）。fire-and-forget，绝不阻断。
      recordUsage({
        userId: opts.userId || "local",
        feature: (opts.feature as string) || "unknown",
        modelId: model.id,
        modelName: model.name,
        provider: model.provider,
        model: model.model,
        tokensIn: Number(data?.usage?.prompt_tokens) || 0,
        tokensOut: Number(data?.usage?.completion_tokens) || 0,
        latencyMs: Date.now() - startedAt,
      });

      return content;
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) continue;
      throw e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("LLM 调用失败");
}
