"use client";

// 把 F2-B 核心用户旅程的状态同步到 flow-store（初始化 / 局部编辑 / 暂缓与回答 / 接受 / 重建 / 恢复）。
// 与 blueprint-sync 同一套 F0-A 语义：
// - 有保存项目 → 走服务端受控操作，按 userId 幂等；
// - 失败一律保留最近有效 Journey（不清空主流程/蓝图、不伪装成功），并返回错误供 UI 提示重试；
// - 写入幂等：同一 operationId 重试不产生重复版本。

import type { ExperienceJourney, JourneyAcceptance } from "@/lib/flow-journey";
import { getJourneyReadiness } from "@/lib/flow-journey";
import { extractFlowError, newRequestId, type FlowAIError } from "@/lib/flow-ai-types";

type JourneyOp = "init_journey" | "update_journey" | "confirm_journey" | "rebuild_journey";

export interface JourneySyncResult {
  journey: ExperienceJourney | null;
  readiness: ReturnType<typeof getJourneyReadiness>;
  conflicts?: string[];
  message?: string;
  error?: FlowAIError | null;
  replay?: boolean;
}

async function post(op: JourneyOp, projectId: string, journey: ExperienceJourney | null, extra: Record<string, unknown> = {}): Promise<JourneySyncResult> {
  const res = await fetch("/api/ai/journey", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      operationId: newRequestId("op"),
      operation: op,
      journey,
      ...extra,
    }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const err = extractFlowError(data);
  const j = (data?.data as Record<string, unknown> | undefined)?.journey as ExperienceJourney | undefined;
  const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as JourneySyncResult["readiness"];
  const conflicts = (data?.data as Record<string, unknown> | undefined)?.conflicts as string[] | undefined;
  const message = (data?.data as Record<string, unknown> | undefined)?.message as string | undefined;
  if (!res.ok || err) {
    return {
      journey: j ?? journey,
      readiness: readiness ?? getJourneyReadiness(j ?? journey),
      conflicts,
      message,
      error: err ?? undefined,
    };
  }
  return {
    journey: j ?? journey,
    readiness: readiness ?? getJourneyReadiness(j ?? journey),
    conflicts,
    message,
    replay: Boolean((data as Record<string, unknown>).replay),
  };
}

const GET_TIMEOUT = 8000;
export async function fetchJourney(projectId: string): Promise<JourneySyncResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GET_TIMEOUT);
  try {
    const res = await fetch(`/api/ai/journey?projectId=${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const j = (d?.journey as ExperienceJourney | undefined) ?? null;
    const readiness = d?.readiness as JourneySyncResult["readiness"];
    return { journey: j, readiness: readiness ?? getJourneyReadiness(j) };
  } catch {
    return { journey: null, readiness: getJourneyReadiness(null) };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 初始化首版体验旅程（仅当 Blueprint 已确认且未过期）；返回是否成功生成/已存在 */
export async function initJourneyItem(projectId: string): Promise<JourneySyncResult> {
  try {
    return await post("init_journey", projectId, null);
  } catch {
    return { journey: null, readiness: getJourneyReadiness(null), error: undefined };
  }
}

/** 局部编辑单个文本路径（记入 guardedPaths） */
export async function updateJourneyPath(projectId: string, journey: ExperienceJourney, path: string, value: string): Promise<JourneySyncResult> {
  try {
    return await post("update_journey", projectId, journey, { patch: { path, value } });
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}

/** 把某项待决定标为「按假设选择 / 暂缓」 */
export async function resolveJourneyItem(projectId: string, journey: ExperienceJourney, decisionId: string, chosenHint: string): Promise<JourneySyncResult> {
  try {
    return await post("update_journey", projectId, journey, { decisionId, chosenHint });
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}

/** 回答某待决定事项（明确取舍，移出未决） */
export async function answerJourneyItem(projectId: string, journey: ExperienceJourney, decisionId: string, answer: string): Promise<JourneySyncResult> {
  try {
    return await post("update_journey", projectId, journey, { decisionId, answer });
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}

/** 接受当前体验旅程 / 带假设继续 */
export async function confirmJourneyItem(projectId: string, journey: ExperienceJourney, acceptance: JourneyAcceptance): Promise<JourneySyncResult> {
  try {
    return await post("confirm_journey", projectId, journey, { acceptance });
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}

/** Blueprint 变化后重建：服务端 reconcile 保留用户局部编辑，冲突进 openDecisions */
export async function rebuildJourneyItem(projectId: string, journey: ExperienceJourney): Promise<JourneySyncResult> {
  try {
    return await post("rebuild_journey", projectId, journey);
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}

/** 恢复最近有效（前一）版本 */
export async function restoreJourneyItem(projectId: string, journey: ExperienceJourney): Promise<JourneySyncResult> {
  try {
    const res = await fetch("/api/ai/journey", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, operationId: newRequestId("op"), journey }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const err = extractFlowError(data);
    const j = (d?.journey as ExperienceJourney | undefined) ?? journey;
    const readiness = d?.readiness as JourneySyncResult["readiness"];
    if (!res.ok || err) {
      return { journey: j, readiness: readiness ?? getJourneyReadiness(j), error: err ?? undefined, message: d?.message as string | undefined };
    }
    return { journey: j, readiness: readiness ?? getJourneyReadiness(j), message: d?.message as string | undefined };
  } catch {
    return { journey, readiness: getJourneyReadiness(journey), error: undefined };
  }
}