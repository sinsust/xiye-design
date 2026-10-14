/**
 * AI 调用用量（只读统计，不做配额/拦截）
 *
 * 背景（形态 C + BYOK）：Supabase Auth 已下线、模型 Key 由用户自带，
 * 费用归用户自己。所以这里**不设上限、不拦截**，只回答三个问题：
 *   1. 这个月一共调了多少次？
 *   2. token 花了多少（进/出）？
 *   3. 花在哪个功能、哪个模型上？
 *
 * 铁律：
 * - recordUsage 只记**成功**调用；写入 fire-and-forget，任何失败都静默吞掉，
 *   绝不让统计成为主流程的故障点（与 lib/audit-log 同款策略）。
 * - tokens 取响应的 usage；端点不返回时记 0，不阻塞、不猜。
 */

import { randomUUID } from "node:crypto";
import { and, eq, gte, lt } from "drizzle-orm";
import { db, aiUsage } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { FEATURES } from "./features";

export interface UsageRecordInput {
  userId?: string | null;
  feature: string;
  modelId?: string | null;
  modelName?: string | null;
  provider?: string | null;
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
}

/** 记一次成功调用（fire-and-forget；失败静默） */
export function recordUsage(u: UsageRecordInput): void {
  void (async () => {
    try {
      // 解析归属档案：
      // 1) 调用方显式传了 userId（llmChat 的 meta.userId）→ 直接用；
      // 2) 否则从当前请求会话解析 —— public 模式即 HMAC 签名 cookie 里的档案 id，
      //    local 模式即本地档案。getSessionUser 走 React.cache，一次请求内零额外开销；
      // 3) 脱离请求上下文（后台任务等）解析失败 → 兜底 "local"。
      let uid = u.userId;
      if (!uid) {
        try {
          const sessionUser = await getSessionUser();
          uid = sessionUser?.sub ?? null;
        } catch {
          uid = null;
        }
      }
      await db.insert(aiUsage).values({
        id: randomUUID().replace(/-/g, "").slice(0, 16),
        userId: uid || "local",
        feature: u.feature || "unknown",
        modelId: u.modelId ?? null,
        modelName: u.modelName ?? null,
        provider: u.provider ?? null,
        model: u.model ?? null,
        tokensIn: Math.max(0, Math.floor(u.tokensIn ?? 0)),
        tokensOut: Math.max(0, Math.floor(u.tokensOut ?? 0)),
        latencyMs: Math.max(0, Math.floor(u.latencyMs ?? 0)),
        createdAt: Date.now(),
      });
    } catch {
      // 统计失败绝不阻断主流程
    }
  })();
}

export interface UsageGroupRow {
  key: string;
  /** 中文标签（功能 label 或模型名） */
  label: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

export interface UsageSummary {
  /** 统计窗起止（毫秒时间戳，左闭右开） */
  from: number;
  to: number;
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  /** 平均延迟（毫秒，仅成功调用） */
  avgLatencyMs: number;
  byFeature: UsageGroupRow[];
  byModel: UsageGroupRow[];
}

const FEATURE_LABEL: Record<string, string> = Object.fromEntries(
  FEATURES.map((f) => [f.key, f.label]),
);

/**
 * 汇总某档案在 [from, to) 时间窗内的用量。
 * 数据量可控（单机应用月几百~几千行），直接拉窗内行在内存聚合，
 * 避免 SQLite / PG 两套方言的 groupBy 差异。
 */
export async function getUsageSummary(
  userId: string,
  from: number,
  to: number,
): Promise<UsageSummary> {
  let rows: Array<{
    feature: string;
    modelId: string | null;
    modelName: string | null;
    provider: string | null;
    model: string | null;
    tokensIn: number;
    tokensOut: number;
    latencyMs: number;
  }> = [];
  try {
    rows = (await db
      .select({
        feature: aiUsage.feature,
        modelId: aiUsage.modelId,
        modelName: aiUsage.modelName,
        provider: aiUsage.provider,
        model: aiUsage.model,
        tokensIn: aiUsage.tokensIn,
        tokensOut: aiUsage.tokensOut,
        latencyMs: aiUsage.latencyMs,
      })
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, from), lt(aiUsage.createdAt, to)))
      // 防御性上限：单机场景月量远小于此，防止异常数据把内存打爆
      .limit(50000)) as typeof rows;
  } catch {
    rows = [];
  }

  let totalCalls = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalLatency = 0;
  const feat = new Map<string, UsageGroupRow>();
  const mod = new Map<string, UsageGroupRow>();

  for (const r of rows) {
    totalCalls += 1;
    totalTokensIn += r.tokensIn || 0;
    totalTokensOut += r.tokensOut || 0;
    totalLatency += r.latencyMs || 0;

    const fk = r.feature || "unknown";
    const f = feat.get(fk) ?? {
      key: fk,
      label: FEATURE_LABEL[fk] ?? fk,
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    f.calls += 1;
    f.tokensIn += r.tokensIn || 0;
    f.tokensOut += r.tokensOut || 0;
    feat.set(fk, f);

    const mk = r.modelName || r.model || "unknown";
    const m = mod.get(mk) ?? {
      key: mk,
      label: mk,
      calls: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    m.calls += 1;
    m.tokensIn += r.tokensIn || 0;
    m.tokensOut += r.tokensOut || 0;
    mod.set(mk, m);
  }

  const byCallsDesc = (a: UsageGroupRow, b: UsageGroupRow) => b.calls - a.calls;

  return {
    from,
    to,
    totalCalls,
    totalTokensIn,
    totalTokensOut,
    avgLatencyMs: totalCalls ? Math.round(totalLatency / totalCalls) : 0,
    byFeature: [...feat.values()].sort(byCallsDesc),
    byModel: [...mod.values()].sort(byCallsDesc),
  };
}

/** 自然月窗口（本地时区）：month 形如 "2026-10"；非法则回退当月 */
export function monthRange(month?: string | null): { from: number; to: number; month: string } {
  const now = new Date();
  const fallback = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? (month as string) : fallback;
  const [y, mo] = m.split("-").map(Number);
  if (mo < 1 || mo > 12) return monthRange(fallback);
  const from = new Date(y, mo - 1, 1, 0, 0, 0, 0).getTime();
  const to = new Date(y, mo, 1, 0, 0, 0, 0).getTime();
  return { from, to, month: m };
}

/** 便捷封装：从一次模型调用结果里记用量（供未走 llmChat 的独立 fetch 出口复用） */
export function recordUsageFromModel(
  model: { id?: string | null; name?: string | null; provider?: string | null; model?: string | null },
  data: { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null | undefined,
  startedAt: number,
  feature: string,
): void {
  recordUsage({
    userId: null, // 不显式指定 → recordUsage 自动从当前请求会话解析归属档案
    feature,
    modelId: model.id ?? null,
    modelName: model.name ?? null,
    provider: model.provider ?? null,
    model: model.model ?? null,
    tokensIn: Number(data?.usage?.prompt_tokens) || 0,
    tokensOut: Number(data?.usage?.completion_tokens) || 0,
    latencyMs: Math.max(0, Date.now() - startedAt),
  });
}
