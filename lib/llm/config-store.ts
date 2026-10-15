/**
 * AI 模型配置存储（仅服务端）：`ai_model_configs`（用户添加的模型）+ `ai_model_settings`
 * （当前生效 + 功能级覆盖）。
 *
 * 安全红线：API Key 经 AES-256-GCM 加密后落库（复用 lib/ima-config 的 encrypt/decrypt），
 * 明文只在服务端解析模型时短暂出现，绝不出现在任何返回给浏览器的结构里（对外只回 hasKey）。
 */

import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, aiModelConfigs, aiModelSettings } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/ima-config";
import { isModelProvider, type ModelProvider } from "./providers";

/** 对外视图：不含明文 Key */
export interface ModelView {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  /** 是否已配置 Key（不返回明文） */
  hasKey: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

/** 内部完整模型（含明文 Key，仅服务端解析/调用用） */
export interface ModelFull {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  sortOrder: number;
}

export interface ModelInput {
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  /** undefined=保持不变（更新时）；null/""=清空；非空=加密存储 */
  apiKey?: string | null;
  sortOrder?: number;
}

export interface ModelSettings {
  activeModelId: string | null;
  /** { featureKey: modelId } */
  featureMap: Record<string, string>;
}

function rowToFull(r: {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  apiKeyEnc: string | null;
  sortOrder: number;
}): ModelFull {
  let apiKey = "";
  if (r.apiKeyEnc) {
    try {
      apiKey = decrypt(r.apiKeyEnc);
    } catch {
      apiKey = "";
    }
  }
  return {
    id: r.id,
    name: r.name,
    provider: r.provider,
    baseUrl: r.baseUrl,
    model: r.model,
    apiKey,
    sortOrder: r.sortOrder,
  };
}

function toView(m: ModelFull, createdAt = 0, updatedAt = 0): ModelView {
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    baseUrl: m.baseUrl,
    model: m.model,
    hasKey: Boolean(m.apiKey),
    sortOrder: m.sortOrder,
    createdAt,
    updatedAt,
  };
}

/** 列出全部用户模型（仅数据库里用户添加的模型），含明文 Key。仅服务端使用。 */
export async function listModelsFull(userId: string): Promise<ModelFull[]> {
  let rows: Array<{
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyEnc: string | null;
    sortOrder: number;
  }> = [];
  try {
    rows = (await db
      .select({
        id: aiModelConfigs.id,
        name: aiModelConfigs.name,
        provider: aiModelConfigs.provider,
        baseUrl: aiModelConfigs.baseUrl,
        model: aiModelConfigs.model,
        apiKeyEnc: aiModelConfigs.apiKeyEnc,
        sortOrder: aiModelConfigs.sortOrder,
      })
      .from(aiModelConfigs)
      .where(eq(aiModelConfigs.userId, userId))
      .orderBy(asc(aiModelConfigs.sortOrder), asc(aiModelConfigs.createdAt))) as typeof rows;
  } catch {
    rows = [];
  }
  return rows.map(rowToFull);
}

/** 列出全部用户模型（对外视图，不含明文 Key） */
export async function listModels(userId: string): Promise<ModelView[]> {
  let rows: Array<{
    id: string;
    name: string;
    provider: string;
    baseUrl: string;
    model: string;
    apiKeyEnc: string | null;
    sortOrder: number;
    createdAt: number;
    updatedAt: number;
  }> = [];
  try {
    rows = (await db
      .select()
      .from(aiModelConfigs)
      .where(eq(aiModelConfigs.userId, userId))
      .orderBy(asc(aiModelConfigs.sortOrder), asc(aiModelConfigs.createdAt))) as typeof rows;
  } catch {
    rows = [];
  }
  return rows.map((r) => toView(rowToFull(r), r.createdAt, r.updatedAt));
}

/** 按 id 取用户模型；不存在返回 null */
export async function getModelById(userId: string, id: string): Promise<ModelFull | null> {
  try {
    const rows = (await db
      .select()
      .from(aiModelConfigs)
      .where(and(eq(aiModelConfigs.id, id), eq(aiModelConfigs.userId, userId)))
      .limit(1)) as Array<{
      id: string;
      name: string;
      provider: string;
      baseUrl: string;
      model: string;
      apiKeyEnc: string | null;
      sortOrder: number;
    }>;
    return rows[0] ? rowToFull(rows[0]) : null;
  } catch {
    return null;
  }
}

/** 新增模型 */
export async function createModel(userId: string, input: ModelInput): Promise<ModelView> {
  const now = Date.now();
  const id = randomUUID().replace(/-/g, "").slice(0, 16);
  const provider: ModelProvider = isModelProvider(input.provider) ? input.provider : "custom";
  const enc = input.apiKey ? encrypt(input.apiKey) : null;
  await db.insert(aiModelConfigs).values({
    id,
    userId,
    name: input.name,
    provider,
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    model: input.model,
    apiKeyEnc: enc,
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  // 首模型自动激活：用户添加第一个模型时期望它直接可用，不必再手动「设为当前」。
  // 否则 activeModelId 为空 → resolveLLM 返回 null → AI 功能报 model_not_configured、不发起任何请求。
  const cur = await getSettings(userId);
  if (!cur.activeModelId) {
    await saveSettings(userId, { activeModelId: id });
  }
  return {
    id,
    name: input.name,
    provider,
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    model: input.model,
    hasKey: Boolean(input.apiKey),
    sortOrder: input.sortOrder ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** 更新模型（仅用户模型，不存在返回 false） */
export async function updateModel(
  userId: string,
  id: string,
  patch: Partial<ModelInput>,
): Promise<boolean> {
  const rows = (await db
    .select()
    .from(aiModelConfigs)
    .where(and(eq(aiModelConfigs.id, id), eq(aiModelConfigs.userId, userId)))
    .limit(1)) as Array<{ id: string }>;
  if (!rows[0]) return false;

  const set: Record<string, unknown> = { updatedAt: Date.now() };
  if (typeof patch.name === "string") set.name = patch.name;
  if (typeof patch.provider === "string")
    set.provider = isModelProvider(patch.provider) ? patch.provider : "custom";
  if (typeof patch.baseUrl === "string") set.baseUrl = patch.baseUrl.replace(/\/+$/, "");
  if (typeof patch.model === "string") set.model = patch.model;
  if (typeof patch.sortOrder === "number") set.sortOrder = patch.sortOrder;
  if (patch.apiKey !== undefined) set.apiKeyEnc = patch.apiKey ? encrypt(patch.apiKey) : null;

  await db
    .update(aiModelConfigs)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set(set as any)
    .where(and(eq(aiModelConfigs.id, id), eq(aiModelConfigs.userId, userId)));
  return true;
}

/** 删除模型（仅用户模型，不存在返回 false） */
export async function deleteModel(userId: string, id: string): Promise<boolean> {
  const rows = (await db
    .select({ id: aiModelConfigs.id })
    .from(aiModelConfigs)
    .where(and(eq(aiModelConfigs.id, id), eq(aiModelConfigs.userId, userId)))
    .limit(1)) as Array<{ id: string }>;
  if (!rows[0]) return false;
  await db
    .delete(aiModelConfigs)
    .where(and(eq(aiModelConfigs.id, id), eq(aiModelConfigs.userId, userId)));
  return true;
}

/** 读取生效策略（无记录时返回空对象，交由解析层判定「未配置」） */
export async function getSettings(userId: string): Promise<ModelSettings> {
  try {
    const rows = (await db
      .select()
      .from(aiModelSettings)
      .where(eq(aiModelSettings.userId, userId))
      .limit(1)) as Array<{ activeModelId: string | null; featureMap: string }>;
    const row = rows[0];
    if (!row) return { activeModelId: null, featureMap: {} };
    let map: Record<string, string> = {};
    try {
      const parsed = JSON.parse(row.featureMap || "{}");
      if (parsed && typeof parsed === "object") map = parsed as Record<string, string>;
    } catch {
      map = {};
    }
    return { activeModelId: row.activeModelId ?? null, featureMap: map };
  } catch {
    return { activeModelId: null, featureMap: {} };
  }
}

/** 保存生效策略（部分字段可选） */
export async function saveSettings(
  userId: string,
  s: { activeModelId?: string | null; featureMap?: Record<string, string> },
): Promise<void> {
  const now = Date.now();
  const cur = await getSettings(userId);
  const activeModelId = s.activeModelId !== undefined ? s.activeModelId : cur.activeModelId;
  const featureMap = s.featureMap !== undefined ? s.featureMap : cur.featureMap;
  await db
    .insert(aiModelSettings)
    .values({ userId, activeModelId, featureMap: JSON.stringify(featureMap), updatedAt: now })
    .onConflictDoUpdate({
      target: aiModelSettings.userId,
      set: { activeModelId, featureMap: JSON.stringify(featureMap), updatedAt: now },
    });
}

/** 该模型是否被当前档案设为「生效中/功能指定」（删除前提示用） */
export async function isModelInUse(userId: string, id: string): Promise<boolean> {
  const s = await getSettings(userId);
  if (s.activeModelId === id) return true;
  return Object.values(s.featureMap).includes(id);
}