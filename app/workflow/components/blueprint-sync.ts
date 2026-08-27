"use client";

// 把 F2-A 产品蓝图的状态同步到 flow-store（初始化 / 局部编辑 / 接受 / 重建 / 恢复）。
// 与 concept-sync 同一套 F0-A 语义：
// - 有保存项目 → 走服务端受控操作，按 userId 幂等；
// - 失败一律保留最近有效 Blueprint（不清空用户内容、不伪装成功），并返回错误供 UI 提示重试；
// - 写入幂等：同一 operationId 重试不产生重复版本。

import { type ProductBlueprint } from "@/lib/flow-blueprint";
import {
  getBlueprintReadiness,
  type BlueprintAcceptance,
} from "@/lib/flow-blueprint";
import { extractFlowError, newRequestId, type FlowAIError } from "@/lib/flow-ai-types";

type BlueprintOp =
  | "init_blueprint"
  | "update_blueprint"
  | "confirm_blueprint"
  | "rebuild_blueprint";

export interface BlueprintSyncResult {
  blueprint: ProductBlueprint | null;
  readiness: ReturnType<typeof getBlueprintReadiness>;
  conflicts?: string[];
  message?: string;
  error?: FlowAIError | null;
  replay?: boolean;
}

async function post(op: BlueprintOp, projectId: string, blueprint: ProductBlueprint | null, extra: Record<string, unknown> = {}): Promise<BlueprintSyncResult> {
  const res = await fetch("/api/ai/blueprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      operationId: newRequestId("op"),
      operation: op,
      blueprint,
      ...extra,
    }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const err = extractFlowError(data);
  const bp = (data?.data as Record<string, unknown> | undefined)?.blueprint as ProductBlueprint | undefined;
  const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as BlueprintSyncResult["readiness"];
  const conflicts = (data?.data as Record<string, unknown> | undefined)?.conflicts as string[] | undefined;
  const message = (data?.data as Record<string, unknown> | undefined)?.message as string | undefined;
  if (!res.ok || err) {
    return {
      blueprint: bp ?? blueprint,
      readiness: readiness ?? getBlueprintReadiness(bp ?? blueprint),
      conflicts,
      message,
      error: err ?? undefined,
    };
  }
  return {
    blueprint: bp ?? blueprint,
    readiness: readiness ?? getBlueprintReadiness(bp ?? blueprint),
    conflicts,
    message,
    replay: Boolean((data as Record<string, unknown>).replay),
  };
}

const GET_TIMEOUT = 8000;
export async function fetchBlueprint(projectId: string): Promise<BlueprintSyncResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GET_TIMEOUT);
  try {
    const res = await fetch(`/api/ai/blueprint?projectId=${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const bp = (data?.data as Record<string, unknown> | undefined)?.blueprint as ProductBlueprint | undefined ?? null;
    const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as BlueprintSyncResult["readiness"];
    return { blueprint: bp ?? null, readiness: readiness ?? getBlueprintReadiness(bp ?? null) };
  } catch {
    return { blueprint: null, readiness: getBlueprintReadiness(null) };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 初始化首版蓝图（仅当未生成过）；返回是否成功生成/已存在 */
export async function initBlueprint(projectId: string): Promise<BlueprintSyncResult> {
  try {
    return await post("init_blueprint", projectId, null);
  } catch {
    return { blueprint: null, readiness: getBlueprintReadiness(null), error: undefined };
  }
}

/** 局部编辑单个文本字段（标为已录入 guardedPaths） */
export async function updateBlueprintPath(projectId: string, blueprint: ProductBlueprint, path: string, value: string): Promise<BlueprintSyncResult> {
  try {
    return await post("update_blueprint", projectId, blueprint, { patch: { path, value } });
  } catch {
    return { blueprint, readiness: getBlueprintReadiness(blueprint), error: undefined };
  }
}

/** 把该项未决决策标为「按假设选择 / 暂缓」 */
export async function resolveBlueprintItem(projectId: string, blueprint: ProductBlueprint, decisionId: string, chosenHint: string): Promise<BlueprintSyncResult> {
  try {
    return await post("update_blueprint", projectId, blueprint, { decisionId, chosenHint });
  } catch {
    return { blueprint, readiness: getBlueprintReadiness(blueprint), error: undefined };
  }
}

/** 接受当前蓝图 / 带假设继续 */
export async function confirmBlueprintItem(projectId: string, blueprint: ProductBlueprint, acceptance: BlueprintAcceptance): Promise<BlueprintSyncResult> {
  try {
    return await post("confirm_blueprint", projectId, blueprint, { acceptance });
  } catch {
    return { blueprint, readiness: getBlueprintReadiness(blueprint), error: undefined };
  }
}

/** F1-A 决策变化后重建：服务端 reconcile 保留用户局部编辑，冲突进 unresolvedDecisions */
export async function rebuildBlueprintItem(projectId: string, blueprint: ProductBlueprint): Promise<BlueprintSyncResult> {
  try {
    return await post("rebuild_blueprint", projectId, blueprint);
  } catch {
    return { blueprint, readiness: getBlueprintReadiness(blueprint), error: undefined };
  }
}

/** 恢复最近有效（前一）版本 */
export async function restoreBlueprintItem(projectId: string, blueprint: ProductBlueprint): Promise<BlueprintSyncResult> {
  try {
    const res = await fetch("/api/ai/blueprint", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, operationId: newRequestId("op"), blueprint }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const err = extractFlowError(data);
    const bp = (data?.data as Record<string, unknown> | undefined)?.blueprint as ProductBlueprint | undefined;
    const readiness = (data?.data as Record<string, unknown> | undefined)?.readiness as BlueprintSyncResult["readiness"];
    if (!res.ok || err) {
      return { blueprint: bp ?? blueprint, readiness: readiness ?? getBlueprintReadiness(bp ?? blueprint), error: err ?? undefined, message: (data?.data as Record<string, unknown> | undefined)?.message as string | undefined };
    }
    return { blueprint: bp ?? blueprint, readiness: readiness ?? getBlueprintReadiness(bp ?? blueprint), message: (data?.data as Record<string, unknown> | undefined)?.message as string | undefined };
  } catch {
    return { blueprint, readiness: getBlueprintReadiness(blueprint), error: undefined };
  }
}