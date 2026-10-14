/**
 * 模型解析（仅服务端）：按「功能覆盖 → 当前生效」的优先级，
 * 决定某个 AI 功能该用哪个模型。
 *
 * 优先级说明：
 *   1. 功能级覆盖：`ai_model_settings.feature_map[feature]` 指定的模型（若仍存在）；
 *   2. 当前生效：`ai_model_settings.active_model_id` 指定的模型（若仍存在）。
 *   —— 用户未配置任何模型（或指定项已不存在）时返回 null，由调用方给出「未配置模型」错误。
 */

import type { FeatureKey } from "./features";
import { getModelById, getSettings, type ModelFull } from "./config-store";

export interface ResolvedModel {
  id: string;
  name: string;
  provider: string;
  /** 已去尾斜杠 */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** 命中来源（便于排查/展示） */
  source: "feature" | "active";
}

function wrap(m: ModelFull, source: ResolvedModel["source"]): ResolvedModel {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    baseUrl: m.baseUrl.replace(/\/+$/, ""),
    apiKey: m.apiKey,
    model: m.model,
    source,
  };
}

export async function resolveLLM(
  userId: string | null | undefined,
  feature?: FeatureKey,
): Promise<ResolvedModel | null> {
  if (userId) {
    const settings = await getSettings(userId);
    if (feature) {
      const fid = settings.featureMap[feature];
      if (fid) {
        const m = await getModelById(userId, fid);
        if (m) return wrap(m, "feature");
      }
    }
    if (settings.activeModelId) {
      const m = await getModelById(userId, settings.activeModelId);
      if (m) return wrap(m, "active");
    }
  }

  // 未命中任何用户模型 → 无可用模型（不再有内置兜底）
  return null;
}