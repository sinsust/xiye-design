// 保存模型配置时校验「这个模型名在你的账号下真的能用」。
//
// 为什么要主动验：厂商的模型名会下架/改名（例如 kimi-k2-0905-preview 已不存在），
// 而配置存下来之后，真正调用的时机在很后面，且失败会被各 handler 的启发式兜底吞掉，
// 用户只看到「AI 服务暂时不可用」，完全不知道是名字写错 —— 这一层把问题挡在填表当场。
//
// 只用 GET /models：不产生任何推理费用，也不替用户烧 token。
// 拿不到清单（自建端点没实现 /models、网络失败、鉴权方式不同）时一律放行：
// 校验是为了帮人，不是为了把不认识的端点堵死。
import type { ResolvedModel } from "./resolve";

export type ModelCheck =
  | { ok: true; skipped?: string }
  | { ok: false; message: string };

/**
 * 向厂商要「这个端点/这个 key 实际能用的模型名」。
 *
 * 为什么以它为准：模型名会下架改名（kimi-k2-0905-preview 已经 404），
 * 写在 providers.ts 里的候选只是方便手输，不能当真相。
 * 只用 GET /models，不产生推理费用。
 */
export async function listProviderModels(input: {
  baseUrl: string;
  apiKey: string;
}): Promise<{ models: string[]; skipped?: string }> {
  const base = input.baseUrl.replace(/\/+$/, "");
  if (!base) return { models: [], skipped: "no_base_url" };

  let res: Response;
  try {
    res = await fetch(`${base}/models`, {
      headers: input.apiKey ? { Authorization: `Bearer ${input.apiKey}` } : {},
      signal: AbortSignal.timeout(12000),
    });
  } catch (e) {
    return { models: [], skipped: e instanceof Error ? e.message : String(e) };
  }
  if (!res.ok) {
    return { models: [], skipped: `HTTP ${res.status}` };
  }

  let ids: string[];
  try {
    const data = (await res.json()) as {
      data?: Array<{ id?: unknown }>;
      models?: Array<{ id?: unknown }>;
    };
    const list = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : [];
    ids = list.map((m) => String(m?.id ?? "")).filter(Boolean);
  } catch {
    return { models: [], skipped: "响应不是 JSON" };
  }
  if (ids.length === 0) return { models: [], skipped: "清单为空" };
  return { models: ids.sort() };
}

export async function checkModelAvailable(
  input: Pick<ResolvedModel, "baseUrl" | "apiKey" | "model">,
): Promise<ModelCheck> {
  const { models, skipped } = await listProviderModels(input);
  // 拿不到清单就放行：校验是为了帮人，不是为了把没实现 /models 的自建端点堵死
  if (models.length === 0) return { ok: true, skipped };
  if (models.includes(input.model)) return { ok: true };

  const sample = models.slice(0, 8).join("、");
  return {
    ok: false,
    message: `该账号下没有模型「${input.model}」。可用：${sample}${models.length > 8 ? ` 等 ${models.length} 个` : ""}`,
  };
}
