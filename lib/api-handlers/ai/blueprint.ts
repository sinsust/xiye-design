import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { db, projects } from "@/lib/db";
import {
  FLOW_OPERATION,
  flowError,
  flowMetaDone,
  flowMetaRunning,
  flowMetaToJSON,
} from "@/lib/flow-ai-types";
import { getConceptReadiness, emptyConceptBrief, type ProductConceptBrief } from "@/lib/flow-concept";
import {
  emptyBlueprint,
  applyBlueprintLocalEdit,
  resolveBlueprintDecision,
  confirmBlueprint,
  reconcileBlueprint,
  restorePreviousBlueprint,
  getBlueprintReadiness,
  type ProductBlueprint,
} from "@/lib/flow-blueprint";
import { buildBlueprint } from "@/lib/ai-blueprint-server";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";

export const runtime = "nodejs";

// F2-A Blueprint 操作：init（初始化首版，仅 F1-A 可继续时）、update（局部编辑/暂缓）、
// confirm（接受 / 带假设继续）、rebuild（F1-A 决策变化后重建，保留用户局部编辑并标冲突）。
// 全部按 (userId, projectId, operationId) 幂等；读写严格按 userId + projectId 隔离；
// 出错时返回最近有效 Blueprint，绝不因 AI/网络失败而清空当前方案。

type BlueprintOperation =
  | "init_blueprint"
  | "update_blueprint"
  | "confirm_blueprint"
  | "rebuild_blueprint";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asBoolean(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

/** 防御性归一：把任意输入整理成合法 ProductBlueprint（不信任前端原始对象） */
function asBlueprint(v: unknown): ProductBlueprint | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyBlueprint({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: typeof b.version === "number" ? Math.max(b.version, 0) : 0,
    status: b.status === "confirmed" ? "confirmed" : b.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(b.stale),
    guardedPaths: Array.isArray(b.guardedPaths) ? b.guardedPaths.filter((x) => typeof x === "string") : [],
    productPositioning:
      b.productPositioning && typeof b.productPositioning === "object"
        ? asPositioned(b.productPositioning)
        : empty.productPositioning,
    targetUsers: Array.isArray(b.targetUsers) ? b.targetUsers : [],
    primaryJob:
      b.primaryJob && typeof b.primaryJob === "object" ? asPrimaryJob(b.primaryJob) : empty.primaryJob,
    mvpScope:
      b.mvpScope && typeof b.mvpScope === "object"
        ? {
            mustHave: Array.isArray((b.mvpScope as Record<string, unknown>).mustHave)
              ? ((b.mvpScope as Record<string, unknown>).mustHave as ProductBlueprint["mvpScope"]["mustHave"])
              : [],
            shouldHave: Array.isArray((b.mvpScope as Record<string, unknown>).shouldHave)
              ? ((b.mvpScope as Record<string, unknown>).shouldHave as ProductBlueprint["mvpScope"]["shouldHave"])
              : [],
            explicitlyOutOfScope: Array.isArray((b.mvpScope as Record<string, unknown>).explicitlyOutOfScope)
              ? ((b.mvpScope as Record<string, unknown>).explicitlyOutOfScope as ProductBlueprint["mvpScope"]["explicitlyOutOfScope"])
              : [],
          }
        : empty.mvpScope,
    coreLoop: Array.isArray(b.coreLoop) ? b.coreLoop : [],
    assumptions: Array.isArray(b.assumptions) ? b.assumptions : [],
    successSignals: Array.isArray(b.successSignals) ? b.successSignals : [],
    unresolvedDecisions: Array.isArray(b.unresolvedDecisions) ? b.unresolvedDecisions : [],
    sourceDecisionIds: Array.isArray(b.sourceDecisionIds) ? b.sourceDecisionIds : [],
    createdAt: typeof b.createdAt === "number" ? b.createdAt : empty.createdAt,
    updatedAt: typeof b.updatedAt === "number" ? b.updatedAt : empty.updatedAt,
    previousVersion: b.previousVersion && typeof b.previousVersion === "object" ? (b.previousVersion as ProductBlueprint["previousVersion"]) : null,
    generatedFromConceptVersion: typeof b.generatedFromConceptVersion === "number" ? b.generatedFromConceptVersion : undefined,
    lastConceptSignature: asString(b.lastConceptSignature) || undefined,
    lastConflicts: Array.isArray(b.lastConflicts) ? b.lastConflicts.filter((x) => typeof x === "string") : undefined,
  };
}
function asPositioned(v: unknown): ProductBlueprint["productPositioning"] {
  const o = v as Record<string, unknown>;
  return {
    text: asString(o.text),
    evidence: o.evidence === "confirmed" ? "confirmed" : o.evidence === "assumption" ? "assumption" : "unresolved",
    source: typeof o.source === "object" && o.source ? (o.source as ProductBlueprint["productPositioning"]["source"]) : { decisionIds: [] },
  };
}
function asPrimaryJob(v: unknown): ProductBlueprint["primaryJob"] {
  const o = v as Record<string, unknown>;
  return {
    statement: asString(o.statement),
    successMoment: asString(o.successMoment),
    evidence: o.evidence === "confirmed" ? "confirmed" : o.evidence === "assumption" ? "assumption" : "unresolved",
    source: typeof o.source === "object" && o.source ? (o.source as ProductBlueprint["primaryJob"]["source"]) : { decisionIds: [] },
  };
}

function asConceptBrief(v: unknown): ProductConceptBrief | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyConceptBrief();
  return {
    ...empty,
    ...b,
    id: asString(b.id),
    projectId: asString(b.projectId),
    version: typeof b.version === "number" ? b.version : 0,
    status: b.status === "confirmed" ? "confirmed" : "draft",
    productName: asString(b.productName),
    oneLiner: asString(b.oneLiner),
    targetUsers: asString(b.targetUsers),
    primaryScenario: asString(b.primaryScenario),
    problemStatement: asString(b.problemStatement),
    valueProposition: asString(b.valueProposition),
    coreCapabilities: asStringArray(b.coreCapabilities),
    nonGoals: asStringArray(b.nonGoals),
    successMetrics: asStringArray(b.successMetrics),
    assumptions: asStringArray(b.assumptions),
    openQuestions: asStringArray(b.openQuestions),
    openCriticalQuestions: asStringArray(b.openCriticalQuestions),
    decisions: Array.isArray(b.decisions)
      ? b.decisions
          .filter((d): d is { id: string; title: string; detail: string; at: number } => Boolean(d && typeof d === "object"))
          .map((d) => ({
            id: asString((d as Record<string, unknown>).id),
            title: asString((d as Record<string, unknown>).title),
            detail: asString((d as Record<string, unknown>).detail),
            at: typeof (d as Record<string, unknown>).at === "number" ? (d as Record<string, unknown>).at as number : Date.now(),
          }))
      : [],
    currentTopic: asString(b.currentTopic),
    planDraft: asString(b.planDraft),
    acceptance:
      b.acceptance === "accepted"
        ? "accepted"
        : b.acceptance === "continue_with_assumptions"
          ? "continue_with_assumptions"
          : "pending",
    confirmedFields: asStringArray(b.confirmedFields) as ProductConceptBrief["confirmedFields"],
    evidenceRefs: b.evidenceRefs && typeof b.evidenceRefs === "object" ? (b.evidenceRefs as ProductConceptBrief["evidenceRefs"]) : {},
    createdAt: typeof b.createdAt === "number" ? b.createdAt : empty.createdAt,
    updatedAt: typeof b.updatedAt === "number" ? b.updatedAt : empty.updatedAt,
  };
}
function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
}

/** 从 projects.data 解析出可变快照对象（与 concept-brief 路由同策略） */
function parseSnapshot(data: string): Record<string, unknown> {
  let src: unknown = data;
  try {
    src = JSON.parse(data);
  } catch {
    src = { flow: {} };
  }
  if (src && typeof src === "object") {
    const asObj = src as Record<string, unknown>;
    if (asObj.flow && typeof asObj.flow === "object" && !asObj.skeleton) {
      return asObj.flow as Record<string, unknown>;
    }
    return asObj;
  }
  return {};
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    const p = JSON.parse(s);
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapError(reason: string) {
  if (reason.startsWith("network:") || reason.startsWith("http:")) return "provider_unavailable" as const;
  if (reason.startsWith("parse:") || reason.startsWith("schema:")) return "invalid_response" as const;
  if (reason === "f1a-not-ready") return "invalid_response" as const;
  return "unknown" as const;
}

// GET /api/ai/blueprint?projectId=xxx —— 获取当前版本（幂等只读）
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const projectId = asString(req.nextUrl.searchParams.get("projectId"));
  const meta = flowMetaRunning({ operation: "get_blueprint", phase: "blueprint" });
  if (!projectId) {
    return NextResponse.json(
      { error: "invalid_input", data: { blueprint: null, readiness: getBlueprintReadiness(null) }, flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unknown", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
      { status: 400 },
    );
  }
  const [row] = await db
    .select({ data: projects.data })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
    .limit(1);
  if (!row) {
    return NextResponse.json(
      { error: "forbidden", data: { blueprint: null, readiness: getBlueprintReadiness(null) }, flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unauthorized", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
      { status: 404 },
    );
  }
  const snap = parseSnapshot(row.data);
  const blueprint = asBlueprint(snap.blueprint);
  const concept = asConceptBrief(snap.conceptBrief);
  // staleness 仅基于持久化概念版本，供前端重建提示
  const stale = Boolean(blueprint && concept && blueprint.generatedFromConceptVersion !== undefined && concept.version !== blueprint.generatedFromConceptVersion);
  const bp = blueprint ? { ...blueprint, stale } : null;
  return NextResponse.json({
    data: { blueprint: bp, readiness: getBlueprintReadiness(bp), stale },
    flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "completed" })),
  });
}

// POST /api/ai/blueprint —— 初始化 / 局部更新 / 接受 / 重建
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationRaw = asString(rawBody?.operation) as BlueprintOperation;
  const isValidOp = ["init_blueprint", "update_blueprint", "confirm_blueprint", "rebuild_blueprint"].includes(operationRaw);
  const running = flowMetaRunning({ operation: operationRaw, phase: "blueprint", operationId: asString(rawBody?.operationId) || undefined });

  if (!rateLimit(`blueprint:${getClientIp(req)}`, 40, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const projectId = asString(body.projectId);
  const operationId = asString(body.operationId);
  if (!projectId || !operationId || !isValidOp) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }

  const operationType: FlowOpType = operationRaw as FlowOpType;
  const deps = { userId: user.sub, projectId, operationId, operationType };

  try {
    // 归属 + 读取：严格按 userId 隔离，只取本人项目
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    if (!row) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unauthorized", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "forbidden", flowMeta: meta }, { status: 404 });
    }
    const snap = parseSnapshot(row.data);
    const concept = asConceptBrief(snap.conceptBrief);
    const current = asBlueprint(snap.blueprint);
    const prev = asBlueprint(body.blueprint) ?? current;

    // 幂等：此前已成功应用 → 直接返回既有结果
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }

    let next: ProductBlueprint | null = current;
    let conflicts: string[] = [];
    let message = "";

    if (operationRaw === "init_blueprint") {
      // F1-A 未形成可用方案 / 未表态 → 不可初始化（invalid_input，保留旧值）
      if (!concept || !getConceptReadiness(concept).canProceed) {
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { blueprint: current, readiness: getBlueprintReadiness(current), reasons: ["需要先有可用初版方案并表态，才能生成产品蓝图。" + reasonForConcept(concept), "蓝图", "无法初始化"] },
          error: "f1a_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      // 已存在蓝图：重试初始化视为幂等成功（不重复生成）
      if (current && current.version > 0) {
        next = current;
        message = "蓝图已存在，跳过初始化。";
      } else {
        next = buildBlueprint(concept);
        next.projectId = projectId;
        next.id = projectId;
      }
    } else if (operationRaw === "update_blueprint") {
      // 局部编辑（文本）或暂缓/标为假设（decisionId + chosenHint）
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-blueprint-to-update");
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : null;
      const path = asString(patch?.path);
      const value = asString(patch?.value);
      const decisionId = asString(body.decisionId);
      const chosenHint = asString(body.chosenHint);
      if (decisionId) {
        const found = base.unresolvedDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = resolveBlueprintDecision(base, decisionId, chosenHint);
        message = "该选择已按假设落地，可在方案落地阶段复核。";
      } else if (path) {
        next = applyBlueprintLocalEdit(base, { path, value });
        message = "已采纳你的局部修改。";
      } else {
        throw new Error("schema:no-patch");
      }
    } else if (operationRaw === "confirm_blueprint") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-blueprint-to-confirm");
      const acceptance = asString(body.acceptance) === "continue_with_assumptions" ? "continue_with_assumptions" : "accepted";
      next = confirmBlueprint(base, acceptance);
      message = acceptance === "continue_with_assumptions" ? "已带假设接受当前蓝图。" : "已接受当前蓝图。";
    } else if (operationRaw === "rebuild_blueprint") {
      if (!concept || !getConceptReadiness(concept).canProceed) {
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { blueprint: current, readiness: getBlueprintReadiness(current), reasons: ["F1-A 尚未形成可重建的可用方案。"], conflicts: [] },
          error: "f1a_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      const fresh = buildBlueprint(concept);
      fresh.projectId = projectId;
      fresh.id = prev?.id || projectId;
      // 保留用户手动编辑（guardedPaths 上的路径不被静默覆盖），冲突进 unresolvedDecisions
      const merged = reconcileBlueprint(prev, fresh);
      next = merged.blueprint;
      conflicts = merged.conflicts;
      message = conflicts.length
        ? `已按最新决策重建蓝图；你在 ${conflicts.length} 处的修改被保留，冲突已列入待确认。`
        : "已按最新决策重建蓝图。";
    }

    // 写回项目快照（向后兼容存进 flow 对象）
    const finalBlueprint = next ? { ...next, stale: false, updatedAt: Date.now() } : null;
    snap.blueprint = finalBlueprint;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const readiness = getBlueprintReadiness(finalBlueprint);
    const payload = {
      data: { blueprint: finalBlueprint, readiness, conflicts, message },
    };

    // 幂等记账：并发重试命中唯一索引 → 用已存结果
    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
    return NextResponse.json({ ...payload, flowMeta: meta });
  } catch (err) {
    // F0-A 错误协议：失败保留最近有效 Blueprint（current），不落幂等台账，不清空用户内容
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[api/ai/blueprint] failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    // 尝试回读最近的持久化蓝图作为「最近有效版本」
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    const fallbackBp = row ? asBlueprint(parseSnapshot(row.data).blueprint) : null;
    return NextResponse.json({
      data: { blueprint: fallbackBp, readiness: getBlueprintReadiness(fallbackBp), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

export async function PUT(req: NextRequest) {
  return handleRestore(req, "restore_blueprint");
}

// 恢复最近有效（前一）版本：独立路由，幂等
async function handleRestore(req: NextRequest, _opLabel: string) {
  const { user, res } = await requireUser();
  if (res) return res;
  const body = await req.json().catch(() => null);
  const projectId = asString(body?.projectId);
  const operationId = asString(body?.operationId);
  const running = flowMetaRunning({ operation: "restore_blueprint", phase: "blueprint", operationId: operationId || undefined });
  if (!rateLimit(`blueprint:${getClientIp(req)}`, 40, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  if (!projectId || !operationId) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }
  const deps = { userId: user.sub, projectId, operationId, operationType: "restore_blueprint" as FlowOpType };
  try {
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    if (!row) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("unauthorized", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
      return NextResponse.json({ error: "forbidden", flowMeta: meta }, { status: 404 });
    }
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const snap = parseSnapshot(row.data);
    const current = asBlueprint(snap.blueprint);
    if (!current) throw new Error("schema:no-blueprint-to-restore");
    const restored = restorePreviousBlueprint(current);
    if (!restored) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", error: null }));
      return NextResponse.json({
        data: { blueprint: current, readiness: getBlueprintReadiness(current), conflicts: [], message: "没有更早的有效版本可恢复。" },
        flowMeta: meta,
      });
    }
    restored.projectId = projectId;
    restored.id = current.id || projectId;
    snap.blueprint = restored;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));
    const readiness = getBlueprintReadiness(restored);
    const payload = { data: { blueprint: restored, readiness, conflicts: [], message: "已恢复上一有效版本。" } };
    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
    return NextResponse.json({ ...payload, flowMeta: meta });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[api/ai/blueprint] restore failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    const fallbackBp = asBlueprint(body?.blueprint) ?? null;
    return NextResponse.json({
      data: { blueprint: fallbackBp, readiness: getBlueprintReadiness(fallbackBp), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

function reasonForConcept(concept: ProductConceptBrief | null): string {
  if (!concept) return "还没有产品创意 Brief。";
  if (!concept.planDraft?.trim()) return "初版方案还没有长出来。";
  if (concept.acceptance === "pending") return "你还没对初版方案表态。";
  return "当前方案未满足生成蓝图条件。";
}