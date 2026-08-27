// F0-A 流程 AI 操作统一协议：操作状态、可读错误、元信息与错误映射（纯函数，client/server 共用）。
// 只为「做产品」工作流服务；不携带任何 Provider 名称 / Token / Prompt / 堆栈 / 原始响应等敏感信息。

/** 统一操作状态机：一次 Flow AI 操作（discover / panel / intent / name / copy）的生命周期 */
export type FlowOperationState =
  | "idle"
  | "queued"
  | "running"
  | "completed"
  | "needs_input"
  | "failed"
  | "cancelled";

/** 统一错误码（REST/模型层分类，前端据 retryable 决定是否展示重试） */
export type FlowErrorCode =
  | "unauthorized"
  | "timeout"
  | "provider_unavailable"
  | "invalid_response"
  | "schema_validation_failed"
  | "rate_limited"
  | "aborted"
  | "unknown";

/** 面向用户的、安全的 Flow AI 错误（不含技术细节） */
export interface FlowAIError {
  code: FlowErrorCode;
  /** 安全、可读的中文文案（拒绝裸漏 Provider/堆栈） */
  message: string;
  retryable: boolean;
  /** 服务端生成的请求追踪号 */
  requestId: string;
  operation: string;
  phase?: string;
}

/** 一次 Flow AI 操作的元信息（主链路观测点） */
export interface FlowAIMeta {
  /** 服务端请求追踪号 */
  requestId: string;
  /** 客户端操作 id（同一操作重试复用，用于幂等与关联） */
  operationId?: string;
  operation: string;
  phase?: string;
  status: FlowOperationState;
  startedAt: number;
  completedAt?: number;
  latencyMs?: number;
  /** 是否命中降级兜底（启发式 / 历史建议） */
  fallbackUsed?: boolean;
  error?: FlowAIError | null;
}

/** 后端/相应用统一结构：status + data（可选）+ error（可选）+ meta */
export interface FlowAIResult<T> {
  status: FlowOperationState;
  data?: T;
  error?: FlowAIError | null;
  meta: FlowAIMeta;
}

/** 受控诊断入口：仅开发环境可视化 requestId。此开关离用户呈现最近的一层，可随时回收。 */
export function isFlowDiagnosticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("flowDiag=1");
}

/** 操作名常量（与各 API 的 phase 对齐） */
export const FLOW_OPERATION = {
  discover: "discover",
  panel: "panel",
  intent: "intent",
  brandName: "brand_name",
  siteCopy: "site_copy",
} as const;
export type FlowOperation = (typeof FLOW_OPERATION)[keyof typeof FLOW_OPERATION];

/** 生成 requestId（服务端/浏览器均可用） */
export function newRequestId(prefix = "flow"): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID().slice(0, 16)}`;
    }
  } catch {
    /* ignore */
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 错误码 → 安全用户文案 + 是否可重试。唯一权威映射点，各 API 不得各自造中文文案。 */
const CODE_VIEW: Record<FlowErrorCode, { message: string; retryable: boolean }> = {
  unauthorized: { message: "登录状态已失效，请刷新后重试。", retryable: false },
  timeout: { message: "专家思考超时了，你的内容已安全保留，可以重试。", retryable: true },
  provider_unavailable: { message: "AI 服务暂时不可用，你的内容已安全保留，请稍后重试。", retryable: true },
  invalid_response: { message: "AI 返回的内容无法解析，请重试，或继续手动补充。", retryable: true },
  schema_validation_failed: { message: "AI 产出的结构不完整，请重试，或继续手动补充。", retryable: false },
  rate_limited: { message: "操作过于频繁，请稍候片刻再试。", retryable: true },
  aborted: { message: "本次操作已取消。", retryable: false },
  unknown: { message: "出现了点小问题，你的内容已安全保留，可以重试。", retryable: true },
};

/** 从 code 生成安全可读错误对象 */
export function flowError(
  code: FlowErrorCode,
  opts?: { operation?: string; phase?: string; requestId?: string; overrideMessage?: string },
): FlowAIError {
  const view = CODE_VIEW[code] ?? CODE_VIEW.unknown;
  return {
    code,
    message: opts?.overrideMessage ?? view.message,
    retryable: view.retryable,
    requestId: opts?.requestId ?? newRequestId(),
    operation: opts?.operation ?? "flow",
    phase: opts?.phase,
  };
}

/** 开始一次操作：记录起始时间（客户端在发请求前调用可拿到可靠 startedAt） */
export function flowMetaRunning(opts: {
  operation: string;
  phase?: string;
  operationId?: string;
  startedAt?: number;
}): FlowAIMeta {
  return {
    requestId: newRequestId(),
    operationId: opts.operationId,
    operation: opts.operation,
    phase: opts.phase,
    status: "running",
    startedAt: opts.startedAt ?? Date.now(),
  };
}

/** 收尾：成功或失败时补全 completedAt / latencyMs / status / error */
export function flowMetaDone(
  running: FlowAIMeta,
  patch: {
    status: FlowOperationState;
    fallbackUsed?: boolean;
    error?: FlowAIError | null;
    requestId?: string;
  },
): FlowAIMeta {
  const completedAt = Date.now();
  return {
    ...running,
    requestId: patch.requestId ?? running.requestId,
    status: patch.status,
    completedAt,
    latencyMs: completedAt - running.startedAt,
    fallbackUsed: patch.fallbackUsed ?? false,
    error: patch.error ?? running.error ?? null,
  };
}

/** 把一个已跑完的 meta 序列化成「附在响应体顶层的 flowMeta 字段」 */
export function flowMetaToJSON(meta: FlowAIMeta): FlowAIMeta {
  // 禁止把错误对象里的敏感额外字段带出去（FlowAIError 本身已做白名单，这里仅防御性结构化）
  const error = meta.error
    ? { code: meta.error.code, message: meta.error.message, retryable: meta.error.retryable, requestId: meta.error.requestId, operation: meta.error.operation, phase: meta.error.phase }
    : null;
  return { ...meta, error };
}

/** 从任意响应体里稳健提取 FlowAIError（兼容统一 flowMeta 与旧版顶层 error / 字符串错误码） */
export function extractFlowError(json: unknown): FlowAIError | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const meta = j.flowMeta as Record<string, unknown> | undefined;
  const err = meta?.error ?? (typeof j.error === "string" ? j.error : j.error);
  if (!err) return null;

  // 旧版字符串错误码 → 用统一映射补齐可读文案
  if (typeof err === "string") {
    const code = err as FlowErrorCode;
    if (!(code in CODE_VIEW)) return null;
    return flowError(code, {
      operation: typeof meta?.operation === "string" ? meta.operation : undefined,
      phase: typeof meta?.phase === "string" ? meta.phase : undefined,
      requestId: typeof meta?.requestId === "string" ? meta.requestId : undefined,
    });
  }
  if (typeof err !== "object") return null;
  const e = err as Record<string, unknown>;
  const code = typeof e.code === "string" ? (e.code as FlowErrorCode) : "unknown";
  const view = CODE_VIEW[code] ?? CODE_VIEW.unknown;
  return {
    code,
    message: typeof e.message === "string" && e.message.trim() ? e.message : view.message,
    retryable: typeof e.retryable === "boolean" ? e.retryable : view.retryable,
    requestId: typeof e.requestId === "string" ? e.requestId : (typeof meta?.requestId === "string" ? meta.requestId : ""),
    operation: typeof e.operation === "string" ? e.operation : (typeof meta?.operation === "string" ? meta.operation : ""),
    phase: typeof e.phase === "string" ? e.phase : undefined,
  };
}

/** 前端直接从 FlowAIError 取用户可读文案（若为空给默认兜底） */
export function flowErrorUserMessage(err: FlowAIError | null | undefined, fallback = "出现了一点问题，请重试。"): string {
  if (!err) return fallback;
  return err.message || CODE_VIEW[err.code]?.message || fallback;
}

/** 判断某状态是否仍处于「主操作进行中」（供下一步按钮 / 专家面板联动） */
export function isFlowInFlight(state: FlowOperationState | undefined): boolean {
  return state === "running" || state === "queued";
}