// F1-A 最小服务端幂等：同 (userId, projectId, operationId, operationType) 的受控操作只应用一次。
// 重试返回既有结果，不重复新增版本 / 不重复写消息。只服务「做产品」流程，不泛化到全四阶段。
// 同时兼顾 SQLite 与 Postgres（都声明了 flow_op_ledger 的唯一索引）。

import { eq, and } from "drizzle-orm";
import { db, flowOpLedger } from "@/lib/db";

export type FlowOpType =
  | "build_concept_brief"
  | "update_concept_brief"
  | "init_blueprint"
  | "update_blueprint"
  | "confirm_blueprint"
  | "rebuild_blueprint"
  | "restore_blueprint"
  | "init_journey"
  | "update_journey"
  | "confirm_journey"
  | "rebuild_journey"
  | "restore_journey"
  | "init_screen_map"
  | "update_screen_map"
  | "confirm_screen_map"
  | "rebuild_screen_map"
  | "restore_screen_map"
  | "init_screen_spec"
  | "update_screen_spec"
  | "confirm_screen_spec"
  | "rebuild_screen_spec"
  | "restore_screen_spec";

export interface FlowOpKeyInput {
  userId: string;
  projectId: string;
  operationId: string;
  operationType: FlowOpType;
}

/** 幂等台账去重主键（也作为 DB 唯一约束的子集，纯函数便于离线单测） */
export function flowOpKey({ userId, projectId, operationId, operationType }: FlowOpKeyInput): string {
  return [userId, projectId, operationId, operationType].join("|");
}

/** 读取已应用操作的结果（JSON 字符串）；未应用过返回 null */
export async function getFlowOpResult(deps: FlowOpKeyInput): Promise<string | null> {
  try {
    const rows = await db
      .select({ resultJson: flowOpLedger.resultJson })
      .from(flowOpLedger)
      .where(
        and(
          eq(flowOpLedger.userId, deps.userId),
          eq(flowOpLedger.projectId, deps.projectId),
          eq(flowOpLedger.operationId, deps.operationId),
          eq(flowOpLedger.operationType, deps.operationType),
        ),
      )
      .limit(1);
    const r = rows[0];
    return r && typeof r.resultJson === "string" && r.resultJson.trim() ? r.resultJson : null;
  } catch {
    return null;
  }
}

export interface FlowOpApplyResult {
  applied: boolean;
  /** 若因重复而未应用，返回已存在的结果 */
  resultJson: string | null;
}

/**
 * 幂等应用：写一条台账；成功 → { applied:true }；命中唯一冲突（并发重试）→
 * { applied:false, resultJson: 已存在结果 }，调用方应原样返回既有结果。
 */
export async function applyFlowOpOnce(deps: FlowOpKeyInput, resultJson: string): Promise<FlowOpApplyResult> {
  const now = Date.now();
  try {
    await db.insert(flowOpLedger).values({
      id: `${deps.projectId}-${deps.operationId}-${deps.operationType}-${now.toString(36)}`,
      userId: deps.userId,
      projectId: deps.projectId,
      operationId: deps.operationId,
      operationType: deps.operationType,
      resultJson,
      appliedAt: now,
    });
    return { applied: true, resultJson: null };
  } catch {
    // 唯一索引冲突：并发下同操作已落库，返回既有结果
    const existing = await getFlowOpResult(deps);
    return { applied: false, resultJson: existing };
  }
}