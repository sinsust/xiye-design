"use client";

// 把 F3-C 界面原型契约（PrototypeSpec）的状态同步到 flow-store（初始化 / 局部编辑 / 记录反馈 /
// 接受 / 重建 / 恢复）。与 screen-spec-sync 同一套 F0-A 语义：
// - 有保存项目 → 走服务端受控操作，按 userId 幂等；
// - 失败一律保留最近有效 PrototypeSpec（不清空主流程/蓝图/旅程/页面地图/界面规格、不伪装成功），并返回错误供 UI 提示重试；
// - 写入幂等：同一 operationId 重试不产生重复版本。
// 通过合并后的 /api/ai/prototype 分发器访问（F3-C 作为 [[...path]] 的一个分支，零新增 Serverless 函数）。

import type { PrototypeSpec, PrototypeAcceptance, PrototypeFeedbackType } from "@/lib/flow-prototype";
import { getPrototypeReadiness } from "@/lib/flow-prototype";
import { extractFlowError, newRequestId, type FlowAIError } from "@/lib/flow-ai-types";

type PrototypeOp = "init_prototype" | "update_prototype" | "rebuild_prototype" | "confirm_prototype";

export interface PrototypeSyncResult {
  prototype: PrototypeSpec | null;
  readiness?: ReturnType<typeof getPrototypeReadiness> | null;
  conflicts?: string[];
  message?: string;
  error?: FlowAIError | null;
  replay?: boolean;
}

async function post(
  op: PrototypeOp,
  projectId: string,
  prototype: PrototypeSpec | null,
  extra: Record<string, unknown> = {},
): Promise<PrototypeSyncResult> {
  const res = await fetch("/api/ai/prototype", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      operationId: newRequestId("op"),
      operation: op,
      prototype,
      ...extra,
    }),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const d = data?.data as Record<string, unknown> | undefined;
  const err = extractFlowError(data);
  const proto = (d?.prototype as PrototypeSpec | undefined) ?? prototype;
  const readiness = d?.readiness as ReturnType<typeof getPrototypeReadiness> | undefined;
  const conflicts = d?.conflicts as string[] | undefined;
  const message = d?.message as string | undefined;
  if (!res.ok || err) {
    return {
      prototype: proto,
      readiness: readiness ?? getPrototypeReadiness(proto, undefined, undefined, undefined),
      conflicts,
      message,
      error: err ?? undefined,
    };
  }
  return {
    prototype: proto,
    readiness: readiness ?? getPrototypeReadiness(proto, undefined, undefined, undefined),
    conflicts,
    message,
    replay: Boolean((data as Record<string, unknown>).replay),
  };
}

const GET_TIMEOUT = 8000;
/** 拉取当前 PrototypeSpec + 就绪状态（只读；服务端会归一 stale）。 */
export async function fetchPrototype(projectId: string): Promise<PrototypeSyncResult> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GET_TIMEOUT);
  try {
    const res = await fetch(`/api/ai/prototype?projectId=${encodeURIComponent(projectId)}`, {
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const proto = (d?.prototype as PrototypeSpec | undefined) ?? null;
    const readiness = d?.readiness as ReturnType<typeof getPrototypeReadiness> | undefined;
    return { prototype: proto, readiness: readiness ?? getPrototypeReadiness(proto, undefined, undefined, undefined) };
  } catch {
    return { prototype: null, readiness: null, error: undefined };
  } finally {
    window.clearTimeout(timer);
  }
}

/** 初始化首版原型（仅 ScreenSpec 已 confirmed && 未过期、且四层来源均就绪）；返回是否成功生成/已存在 */
export async function initPrototypeItem(projectId: string, prototype: PrototypeSpec | null): Promise<PrototypeSyncResult> {
  try {
    return await post("init_prototype", projectId, prototype);
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}

/** 局部编辑单个文本路径（记入 guardedPaths，重建保留） */
export async function updatePrototypePath(
  projectId: string,
  prototype: PrototypeSpec,
  path: string,
  value: string,
): Promise<PrototypeSyncResult> {
  try {
    return await post("update_prototype", projectId, prototype, { patch: { path, value } });
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}

/** 记录一条原型验收反馈（不改版本与状态；仅保存在当前原型中） */
export async function addPrototypeFeedbackItem(
  projectId: string,
  prototype: PrototypeSpec,
  feedback: {
    type: PrototypeFeedbackType;
    screenId?: string;
    interactionId?: string;
    scenarioId?: string;
    message?: string;
  },
): Promise<PrototypeSyncResult> {
  try {
    return await post("update_prototype", projectId, prototype, { feedback });
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}

/** 接受当前原型 / 带假设继续 */
export async function confirmPrototypeItem(
  projectId: string,
  prototype: PrototypeSpec,
  acceptance: PrototypeAcceptance,
): Promise<PrototypeSyncResult> {
  try {
    return await post("confirm_prototype", projectId, prototype, { acceptance });
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}

/** 任一来源（蓝图/旅程/页面结构/界面规格）变化后重建：服务端保留 guardedPaths，冲突进 lastConflicts */
export async function rebuildPrototypeItem(projectId: string, prototype: PrototypeSpec): Promise<PrototypeSyncResult> {
  try {
    return await post("rebuild_prototype", projectId, prototype);
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}

/** 恢复最近有效（前一）版本 */
export async function restorePrototypeItem(projectId: string, prototype: PrototypeSpec): Promise<PrototypeSyncResult> {
  try {
    const res = await fetch("/api/ai/prototype", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, operationId: newRequestId("op"), prototype }),
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const d = data?.data as Record<string, unknown> | undefined;
    const err = extractFlowError(data);
    const proto = (d?.prototype as PrototypeSpec | undefined) ?? prototype;
    const readiness = d?.readiness as ReturnType<typeof getPrototypeReadiness> | undefined;
    const message = d?.message as string | undefined;
    if (!res.ok || err) {
      return {
        prototype: proto,
        readiness: readiness ?? getPrototypeReadiness(proto, undefined, undefined, undefined),
        message,
        error: err ?? undefined,
      };
    }
    return {
      prototype: proto,
      readiness: readiness ?? getPrototypeReadiness(proto, undefined, undefined, undefined),
      message,
      replay: Boolean((data as Record<string, unknown>).replay),
    };
  } catch {
    return { prototype, readiness: getPrototypeReadiness(prototype, undefined, undefined, undefined), error: undefined };
  }
}