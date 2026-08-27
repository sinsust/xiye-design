"use client";

// 把 F3-A 首版页面地图与信息架构的状态同步到 flow-store（初始化 / 局部编辑 / 暂缓与回答 / 接受 / 重建 / 恢复）。
// 与 journey-sync / blueprint-sync 同一套 F0-A 语义：
// - 有保存项目 → 走服务端受控操作，按 userId 幂等；
// - 失败一律保留最近有效 ScreenMap（不清空主流程/蓝图/Journey、不伪装成功），并返回错误供 UI 提示重试；
// - 写入幂等：同一 operationId 重试不产生重复版本。

import type { ExperienceJourney } from "@/lib/flow-journey";
import type { ScreenMap, ScreenMapAcceptance } from "@/lib/flow-screen-map";
import { getScreenMapReadiness } from "@/lib/flow-screen-map";
import { extractFlowError, newRequestId, type FlowAIError } from "@/lib/flow-ai-types";

type ScreenMapOp = "init_screen_map" | "update_screen_map" | "confirm_screen_map" | "rebuild_screen_map";

export interface ScreenMapSyncResult {
  screenMap: ScreenMap | null;
  readiness: ReturnType<typeof getScreenMapReadiness>;
  conflicts?: string[];
  message?: string;
  error?: FlowAIError | null;
  replay?: boolean;
}

async function post(op: ScreenMapOp, projectId: string, screenMap: ScreenMap | null, journey: ExperienceJourney | null | undefined, extra: Record<string, unknown> = {}): Promise<ScreenMapSyncResult> {
  const res = await fetch("/api/ai/screen-map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      operationId: newRequestId("op"),
      operation: op,
      screenMap,
      ...extra,
    }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const err = extractFlowError(data);
  const sm = (data?.data as Record<string, unknown> | undefined)?.screenMap as ScreenMap | undefined;
  const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as ScreenMapSyncResult["readiness"];
  const conflicts = (data?.data as Record<string, unknown> | undefined)?.conflicts as string[] | undefined;
  const message = (data?.data as Record<string, unknown> | undefined)?.message as string | undefined;
  const fallbackSm = sm ?? screenMap;
  if (!res.ok || err) {
    return {
      screenMap: fallbackSm,
      readiness: readiness ?? getScreenMapReadiness(fallbackSm, journey),
      conflicts,
      message,
      error: err ?? undefined,
    };
  }
  return {
    screenMap: fallbackSm,
    readiness: readiness ?? getScreenMapReadiness(fallbackSm, journey),
    conflicts,
    message,
    replay: Boolean((data as Record<string, unknown>).replay),
  };
}

const GET_TIMEOUT = 8000;
export async function fetchScreenMap(projectId: string, journey: ExperienceJourney | null | undefined): Promise<ScreenMapSyncResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GET_TIMEOUT);
  try {
    const res = await fetch(`/api/ai/screen-map?projectId=${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const sm = (d?.screenMap as ScreenMap | undefined) ?? null;
    const readiness = d?.readiness as ScreenMapSyncResult["readiness"];
    return { screenMap: sm, readiness: readiness ?? getScreenMapReadiness(sm, journey) };
  } catch {
    return { screenMap: null, readiness: getScreenMapReadiness(null, journey) };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 初始化首版页面地图（仅当 Blueprint+Journey 均已确认且未过期）；返回是否成功生成/已存在 */
export async function initScreenMapItem(projectId: string, journey: ExperienceJourney | null | undefined): Promise<ScreenMapSyncResult> {
  try {
    return await post("init_screen_map", projectId, null, journey);
  } catch {
    return { screenMap: null, readiness: getScreenMapReadiness(null, journey), error: undefined };
  }
}

/** 局部编辑单个文本路径（记入 guardedPaths） */
export async function updateScreenMapPath(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined, path: string, value: string): Promise<ScreenMapSyncResult> {
  try {
    return await post("update_screen_map", projectId, screenMap, journey, { patch: { path, value } });
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}

/** 把某项待决定标为「按假设选择 / 暂缓」 */
export async function resolveScreenMapItem(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined, decisionId: string, chosenHint: string): Promise<ScreenMapSyncResult> {
  try {
    return await post("update_screen_map", projectId, screenMap, journey, { decisionId, chosenHint });
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}

/** 回答某待决定事项（明确取舍，移出未决） */
export async function answerScreenMapItem(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined, decisionId: string, answer: string): Promise<ScreenMapSyncResult> {
  try {
    return await post("update_screen_map", projectId, screenMap, journey, { decisionId, answer });
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}

/** 接受当前页面结构 / 带假设继续 */
export async function confirmScreenMapItem(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined, acceptance: ScreenMapAcceptance): Promise<ScreenMapSyncResult> {
  try {
    return await post("confirm_screen_map", projectId, screenMap, journey, { acceptance });
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}

/** Blueprint 或 Journey 变化后重建：服务端 reconcile 保留用户局部编辑，冲突进 unresolvedDecisions */
export async function rebuildScreenMapItem(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined): Promise<ScreenMapSyncResult> {
  try {
    return await post("rebuild_screen_map", projectId, screenMap, journey);
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}

/** 恢复最近有效（前一）版本 */
export async function restoreScreenMapItem(projectId: string, screenMap: ScreenMap, journey: ExperienceJourney | null | undefined): Promise<ScreenMapSyncResult> {
  try {
    const res = await fetch("/api/ai/screen-map", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, operationId: newRequestId("op"), screenMap }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const err = extractFlowError(data);
    const sm = (d?.screenMap as ScreenMap | undefined) ?? screenMap;
    const readiness = d?.readiness as ScreenMapSyncResult["readiness"];
    if (!res.ok || err) {
      return { screenMap: sm, readiness: readiness ?? getScreenMapReadiness(sm, journey), error: err ?? undefined, message: d?.message as string | undefined };
    }
    return { screenMap: sm, readiness: readiness ?? getScreenMapReadiness(sm, journey), message: d?.message as string | undefined };
  } catch {
    return { screenMap, readiness: getScreenMapReadiness(screenMap, journey), error: undefined };
  }
}