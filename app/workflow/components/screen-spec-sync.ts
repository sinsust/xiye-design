"use client";

// 把 F3-B 界面规格契约的状态同步到 flow-store（初始化 / 局部编辑 / 暂缓与回答 / 接受 / 重建 / 恢复）。
// 与 screen-map-sync / journey-sync / blueprint-sync 同一套 F0-A 语义：
// - 有保存项目 → 走服务端受控操作，按 userId 幂等；
// - 失败一律保留最近有效 ScreenSpec（不清空主流程/蓝图/旅程/页面地图、不伪装成功），并返回错误供 UI 提示重试；
// - 写入幂等：同一 operationId 重试不产生重复版本。

import type { ScreenMap } from "@/lib/flow-screen-map";
import type { ScreenSpec, ScreenSpecAcceptance } from "@/lib/flow-screen-spec";
import { getScreenSpecReadiness } from "@/lib/flow-screen-spec";
import { extractFlowError, newRequestId, type FlowAIError } from "@/lib/flow-ai-types";

type ScreenSpecOp = "init_screen_spec" | "update_screen_spec" | "confirm_screen_spec" | "rebuild_screen_spec";

export interface ScreenSpecSyncResult {
  screenSpec: ScreenSpec | null;
  readiness: ReturnType<typeof getScreenSpecReadiness>;
  conflicts?: string[];
  message?: string;
  error?: FlowAIError | null;
  replay?: boolean;
}

async function post(op: ScreenSpecOp, projectId: string, screenSpec: ScreenSpec | null, screenMap: ScreenMap | null | undefined, extra: Record<string, unknown> = {}): Promise<ScreenSpecSyncResult> {
  const res = await fetch("/api/ai/screen-spec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      operationId: newRequestId("op"),
      operation: op,
      screenSpec,
      ...extra,
    }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const err = extractFlowError(data);
  const spec = (data?.data as Record<string, unknown> | undefined)?.screenSpec as ScreenSpec | undefined;
  const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as ScreenSpecSyncResult["readiness"];
  const conflicts = (data?.data as Record<string, unknown> | undefined)?.conflicts as string[] | undefined;
  const message = (data?.data as Record<string, unknown> | undefined)?.message as string | undefined;
  const fallbackSpec = spec ?? screenSpec;
  if (!res.ok || err) {
    return {
      screenSpec: fallbackSpec,
      readiness: readiness ?? getScreenSpecReadiness(fallbackSpec, screenMap),
      conflicts,
      message,
      error: err ?? undefined,
    };
  }
  return {
    screenSpec: fallbackSpec,
    readiness: readiness ?? getScreenSpecReadiness(fallbackSpec, screenMap),
    conflicts,
    message,
    replay: Boolean((data as Record<string, unknown>).replay),
  };
}

const GET_TIMEOUT = 8000;
export async function fetchScreenSpec(projectId: string, screenMap: ScreenMap | null | undefined): Promise<ScreenSpecSyncResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GET_TIMEOUT);
  try {
    const res = await fetch(`/api/ai/screen-spec?projectId=${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const spec = (d?.screenSpec as ScreenSpec | undefined) ?? null;
    const readiness = d?.readiness as ScreenSpecSyncResult["readiness"];
    return { screenSpec: spec, readiness: readiness ?? getScreenSpecReadiness(spec, screenMap) };
  } catch {
    return { screenSpec: null, readiness: getScreenSpecReadiness(null, screenMap) };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 初始化首版界面规格（仅当 Blueprint+Journey+ScreenMap 均已确认且未过期）；返回是否成功生成/已存在 */
export async function initScreenSpecItem(projectId: string, screenMap: ScreenMap | null | undefined): Promise<ScreenSpecSyncResult> {
  try {
    return await post("init_screen_spec", projectId, null, screenMap);
  } catch {
    return { screenSpec: null, readiness: getScreenSpecReadiness(null, screenMap), error: undefined };
  }
}

/** 局部编辑单个文本路径（记入 guardedPaths） */
export async function updateScreenSpecPath(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined, path: string, value: string): Promise<ScreenSpecSyncResult> {
  try {
    return await post("update_screen_spec", projectId, screenSpec, screenMap, { patch: { path, value } });
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}

/** 把某项待决定标为「按假设选择 / 暂缓」 */
export async function deferScreenSpecItem(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined, decisionId: string, chosenHint: string): Promise<ScreenSpecSyncResult> {
  try {
    return await post("update_screen_spec", projectId, screenSpec, screenMap, { decisionId, chosenHint });
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}

/** 回答某待决定事项（明确取舍，移出未决） */
export async function answerScreenSpecItem(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined, decisionId: string, answer: string): Promise<ScreenSpecSyncResult> {
  try {
    return await post("update_screen_spec", projectId, screenSpec, screenMap, { decisionId, answer });
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}

/** 接受当前界面规格 / 带假设继续 */
export async function confirmScreenSpecItem(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined, acceptance: ScreenSpecAcceptance): Promise<ScreenSpecSyncResult> {
  try {
    return await post("confirm_screen_spec", projectId, screenSpec, screenMap, { acceptance });
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}

/** 任一来源（页面结构/体验/蓝图）变化后重建：服务端 reconcile 保留用户局部编辑，冲突进 unresolvedDecisions */
export async function rebuildScreenSpecItem(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined): Promise<ScreenSpecSyncResult> {
  try {
    return await post("rebuild_screen_spec", projectId, screenSpec, screenMap);
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}

/** 恢复最近有效（前一）版本 */
export async function restoreScreenSpecItem(projectId: string, screenSpec: ScreenSpec, screenMap: ScreenMap | null | undefined): Promise<ScreenSpecSyncResult> {
  try {
    const res = await fetch("/api/ai/screen-spec", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, operationId: newRequestId("op"), screenSpec }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const err = extractFlowError(data);
    const spec = (d?.screenSpec as ScreenSpec | undefined) ?? screenSpec;
    const readiness = d?.readiness as ScreenSpecSyncResult["readiness"];
    if (!res.ok || err) {
      return { screenSpec: spec, readiness: readiness ?? getScreenSpecReadiness(spec, screenMap), error: err ?? undefined, message: d?.message as string | undefined };
    }
    return { screenSpec: spec, readiness: readiness ?? getScreenSpecReadiness(spec, screenMap), message: d?.message as string | undefined };
  } catch {
    return { screenSpec, readiness: getScreenSpecReadiness(screenSpec, screenMap), error: undefined };
  }
}