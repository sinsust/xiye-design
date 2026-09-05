import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireUser } from "@/lib/auth-guard";
import { db, projects } from "@/lib/db";
import {
  flowError,
  flowMetaDone,
  flowMetaRunning,
  flowMetaToJSON,
} from "@/lib/flow-ai-types";
import {
  emptyBlueprint,
  getBlueprintReadiness,
  type ProductBlueprint,
} from "@/lib/flow-blueprint";
import {
  emptyJourney,
  applyJourneyLocalEdit,
  resolveJourneyDecision,
  answerJourneyDecision,
  confirmJourney,
  reconcileJourney,
  restorePreviousJourney,
  getJourneyReadiness,
  blueprintChangedSinceJourney,
  canInitJourney,
  type ExperienceJourney,
  type JourneyStatus,
} from "@/lib/flow-journey";
import { buildJourney } from "@/lib/ai-journey-server";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

// F2-B 核心用户旅程操作：init（仅 Blueprint 已确认且未过期时）、update（局部编辑/暂缓/回答未决）、
// confirm（接受 / 带假设继续）、rebuild（蓝图变化后重建，保留用户局部编辑并标冲突）、restore（恢复上一版）。
// 全部按 (userId, projectId, operationId) 幂等；读写严格按 userId + projectId 隔离；
// 出错时返回最近有效 Journey，绝不因失败清空主流程或 Blueprint。

type JourneyOperation =
  | "init_journey"
  | "update_journey"
  | "confirm_journey"
  | "rebuild_journey";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asBoolean(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}
function asNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asEvidence(v: unknown): "confirmed" | "assumption" | "unresolved" {
  return v === "confirmed" ? "confirmed" : v === "unresolved" ? "unresolved" : "assumption";
}
function asStatus(v: unknown): JourneyStatus {
  return v === "reviewing" ? "reviewing" : v === "confirmed" ? "confirmed" : "draft";
}
function asSource(v: unknown): ExperienceJourney["primaryScenario"]["source"] {
  if (!v || typeof v !== "object") return {};
  const s = v as Record<string, unknown>;
  return {
    decisionIds: Array.isArray(s.decisionIds) ? s.decisionIds.filter((x) => typeof x === "string") : undefined,
    blueprintPath: asString(s.blueprintPath) || undefined,
    note: asString(s.note) || undefined,
  };
}
function asScenario(v: unknown): ExperienceJourney["primaryScenario"] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    title: asString(o.title),
    user: asString(o.user),
    trigger: asString(o.trigger),
    desiredOutcome: asString(o.desiredOutcome),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asPivot(v: unknown): ExperienceJourney["pivotalMoment"] {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    stepId: asString(o.stepId),
    rationale: asString(o.rationale),
    successCriteria: asString(o.successCriteria),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}

/** 防御性归一：把任意输入整理成合法 ExperienceJourney（不信任前端原始对象） */
function asJourney(v: unknown): ExperienceJourney | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyJourney({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: asStatus(b.status),
    stale: asBoolean(b.stale),
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    generatedFromBlueprintSignature: asString(b.generatedFromBlueprintSignature) || undefined,
    guardedPaths: Array.isArray(b.guardedPaths) ? b.guardedPaths.filter((x) => typeof x === "string") : [],
    previousVersion:
      b.previousVersion && typeof b.previousVersion === "object"
        ? (b.previousVersion as ExperienceJourney["previousVersion"])
        : null,
    primaryScenario: asScenario(b.primaryScenario),
    steps: Array.isArray(b.steps) ? b.steps.map(asStep) : [],
    pivotalMoment: asPivot(b.pivotalMoment),
    edgeCases: Array.isArray(b.edgeCases) ? b.edgeCases.map(asEdge) : [],
    openDecisions: Array.isArray(b.openDecisions) ? b.openDecisions : [],
    lastConflicts: Array.isArray(b.lastConflicts) ? b.lastConflicts.filter((x) => typeof x === "string") : undefined,
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
    acceptance: b.acceptance === "continue_with_assumptions" ? "continue_with_assumptions" : b.acceptance === "accepted" ? "accepted" : undefined,
  };
}
function asStep(v: unknown): ExperienceJourney["steps"][number] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    order: asNum(o.order),
    userGoal: asString(o.userGoal),
    userAction: asString(o.userAction),
    systemBehavior: asString(o.systemBehavior),
    visibleOutcome: asString(o.visibleOutcome),
    frictionOrRisk: asString(o.frictionOrRisk) || undefined,
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asEdge(v: unknown): ExperienceJourney["edgeCases"][number] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    trigger: asString(o.trigger),
    systemResponse: asString(o.systemResponse),
    userRecovery: asString(o.userRecovery),
    priority: o.priority === "high" ? "high" : o.priority === "low" ? "low" : "medium",
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}

function asBlueprint(v: unknown): ProductBlueprint | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyBlueprint({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: b.status === "confirmed" ? "confirmed" : b.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(b.stale),
    guardedPaths: Array.isArray(b.guardedPaths) ? b.guardedPaths.filter((x) => typeof x === "string") : [],
    productPositioning:
      b.productPositioning && typeof b.productPositioning === "object"
        ? (b.productPositioning as ProductBlueprint["productPositioning"])
        : empty.productPositioning,
    targetUsers: Array.isArray(b.targetUsers) ? b.targetUsers : [],
    primaryJob: b.primaryJob && typeof b.primaryJob === "object" ? (b.primaryJob as ProductBlueprint["primaryJob"]) : empty.primaryJob,
    mvpScope:
      b.mvpScope && typeof b.mvpScope === "object"
        ? {
            mustHave: Array.isArray((b.mvpScope as Record<string, unknown>).mustHave) ? ((b.mvpScope as Record<string, unknown>).mustHave as ProductBlueprint["mvpScope"]["mustHave"]) : [],
            shouldHave: Array.isArray((b.mvpScope as Record<string, unknown>).shouldHave) ? ((b.mvpScope as Record<string, unknown>).shouldHave as ProductBlueprint["mvpScope"]["shouldHave"]) : [],
            explicitlyOutOfScope: Array.isArray((b.mvpScope as Record<string, unknown>).explicitlyOutOfScope) ? ((b.mvpScope as Record<string, unknown>).explicitlyOutOfScope as ProductBlueprint["mvpScope"]["explicitlyOutOfScope"]) : [],
          }
        : empty.mvpScope,
    coreLoop: Array.isArray(b.coreLoop) ? b.coreLoop : [],
    assumptions: Array.isArray(b.assumptions) ? b.assumptions : [],
    successSignals: Array.isArray(b.successSignals) ? b.successSignals : [],
    unresolvedDecisions: Array.isArray(b.unresolvedDecisions) ? b.unresolvedDecisions : [],
    sourceDecisionIds: Array.isArray(b.sourceDecisionIds) ? b.sourceDecisionIds : [],
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

/** 从 projects.data 解析出可变快照对象（与 concept/blueprint 路由同策略） */
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
  if (reason === "blueprint-not-ready") return "invalid_response" as const;
  return "unknown" as const;
}

function journeyPayload(journey: ExperienceJourney | null) {
  return { journey, readiness: getJourneyReadiness(journey) };
}

// GET /api/ai/journey?projectId=xxx —— 获取当前 Journey（幂等只读）
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const projectId = asString(req.nextUrl.searchParams.get("projectId"));
  const meta = flowMetaRunning({ operation: "get_journey", phase: "journey" });
  if (!projectId) {
    return NextResponse.json(
      { error: "invalid_input", data: journeyPayload(null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unknown", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
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
      { error: "forbidden", data: journeyPayload(null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unauthorized", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
      { status: 404 },
    );
  }
  const snap = parseSnapshot(row.data);
  const blueprint = asBlueprint(snap.blueprint);
  const journey = asJourney(snap.journey);
  // staleness 基于 Blueprint 版本 / 签名变化（蓝图更新后应重建）
  const stale =
    Boolean(journey) && blueprintChangedSinceJourney(blueprint, journey);
  const j = journey ? { ...journey, stale } : null;
  return NextResponse.json({
    data: { ...journeyPayload(j), blueprintReady: Boolean(blueprint && getBlueprintReadiness(blueprint).canProceed) },
    flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "completed" })),
  });
}

// POST /api/ai/journey —— 初始化 / 局部更新 / 接受 / 重建
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationRaw = asString(rawBody?.operation) as JourneyOperation;
  const isValidOp = ["init_journey", "update_journey", "confirm_journey", "rebuild_journey"].includes(operationRaw);
  const running = flowMetaRunning({ operation: operationRaw, phase: "journey", operationId: asString(rawBody?.operationId) || undefined });

  if (!await rateLimit(`journey:${getClientIp(req)}`, 40, 60_000)) {
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
    const blueprint = asBlueprint(snap.blueprint);
    const current = asJourney(snap.journey);
    const prev = asJourney(body.journey) ?? current;

    // 幂等：此前已成功应用 → 直接返回既有结果
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }

    let next: ExperienceJourney | null = current;
    let conflicts: string[] = [];
    let message = "";
    let notReadyReason: string | null = null;

    if (operationRaw === "init_journey") {
      // 只允许在 Blueprint 已确认且未过期时初始化
      if (!blueprint || !canInitJourney(blueprint)) {
        notReadyReason = reasonForBlueprintNotReady(blueprint);
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { ...journeyPayload(current), conflicts, reasons: [notReadyReason, "体验旅程", "无法初始化"] },
          error: "blueprint_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      if (current && current.version > 0) {
        next = current;
        message = "体验旅程已存在，跳过初始化。";
      } else {
        next = buildJourney(blueprint, { id: projectId, projectId });
        next.id = projectId;
        message = "已将产品蓝图收敛为首条核心体验旅程。";
      }
    } else if (operationRaw === "update_journey") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-journey-to-update");
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : null;
      const path = asString(patch?.path);
      const value = asString(patch?.value);
      const decisionId = asString(body.decisionId);
      const chosenHint = asString(body.chosenHint);
      const answer = asString(body.answer);
      if (answer) {
        // 回答 openDecision（明确取舍）：移出未决
        const found = base.openDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = answerJourneyDecision(base, decisionId, answer);
        message = "这一关键选择已采纳你给出的取舍。";
      } else if (decisionId) {
        // 暂缓 / 按假设选择
        const found = base.openDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = resolveJourneyDecision(base, decisionId, chosenHint);
        message = "这一选择已按假设暂缓，方案落地阶段需复核。";
      } else if (path) {
        next = applyJourneyLocalEdit(base, { path, value });
        message = "已采纳你的局部修改。";
      } else {
        throw new Error("schema:no-patch");
      }
    } else if (operationRaw === "confirm_journey") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-journey-to-confirm");
      const acceptance = asString(body.acceptance) === "continue_with_assumptions" ? "continue_with_assumptions" : "accepted";
      next = confirmJourney(base, acceptance);
      message = acceptance === "continue_with_assumptions" ? "已带假设接受当前体验，可进入下一步。" : "已接受当前体验旅程，可进入方案落地。";
    } else if (operationRaw === "rebuild_journey") {
      if (!blueprint || !canInitJourney(blueprint)) {
        notReadyReason = reasonForBlueprintNotReady(blueprint);
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { ...journeyPayload(current), conflicts, reasons: [notReadyReason, "体验旅程", "无法重建"] },
          error: "blueprint_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      const fresh = buildJourney(blueprint, { id: prev?.id || projectId, projectId });
      // 保留用户手动编辑（guardedPaths 上的路径不被静默覆盖），冲突进 openDecisions+lastConflicts
      const merged = reconcileJourney(prev, fresh);
      next = merged.journey;
      next.id = prev?.id || projectId;
      conflicts = merged.conflicts;
      message = conflicts.length
        ? `已按最新蓝图重建体验旅程；你在 ${conflicts.length} 处的修改被保留，冲突已列入待确认。`
        : "已按最新蓝图重建体验旅程。";
    }

    if (!next) throw new Error("schema:no-journey-result");

    // 写回项目快照（与 blueprint 同承载方式，存进 flow 对象）
    const finalJourney = { ...next, stale: false, updatedAt: Date.now() };
    snap.journey = finalJourney;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const payload = {
      data: { ...journeyPayload(finalJourney), conflicts, message },
    };

    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
    return NextResponse.json({ ...payload, flowMeta: meta });
  } catch (err) {
    // F0-A 错误协议：失败保留最近有效 Journey（current 或 last persisted），不落台账，不清空内容
    const reason = safeDetail(err);
    console.error("[api/ai/journey] failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    const fallback = row ? asJourney(parseSnapshot(row.data).journey) : null;
    return NextResponse.json({
      data: { ...journeyPayload(fallback), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

export async function PUT(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const body = await req.json().catch(() => null);
  const projectId = asString(body?.projectId);
  const operationId = asString(body?.operationId);
  const running = flowMetaRunning({ operation: "restore_journey", phase: "journey", operationId: operationId || undefined });
  if (!await rateLimit(`journey:${getClientIp(req)}`, 40, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  if (!projectId || !operationId) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }
  const deps = { userId: user.sub, projectId, operationId, operationType: "restore_journey" as FlowOpType };
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
    const current = asJourney(snap.journey);
    if (!current) throw new Error("schema:no-journey-to-restore");
    const restored = restorePreviousJourney(current);
    if (!restored) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", error: null }));
      return NextResponse.json({
        data: { ...journeyPayload(current), conflicts: [], message: "没有更早的有效版本可恢复。" },
        flowMeta: meta,
      });
    }
    restored.projectId = projectId;
    restored.id = current.id || projectId;
    snap.journey = restored;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));
    const payload = { data: { ...journeyPayload(restored), conflicts: [], message: "已恢复上一有效版本。" } };
    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
    return NextResponse.json({ ...payload, flowMeta: meta });
  } catch (err) {
    const reason = safeDetail(err);
    console.error("[api/ai/journey] restore failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    return NextResponse.json({
      data: { ...journeyPayload(body?.journey ?? null), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

function reasonForBlueprintNotReady(blueprint: ProductBlueprint | null): string {
  if (!blueprint) return "还没有产品蓝图——需要先完成创意与方案结构化。";
  const hasContent = blueprint.productPositioning.text.trim() || blueprint.targetUsers.length > 0 || blueprint.coreLoop.length > 0;
  if (!hasContent) return "蓝图还缺少可收敛的定位与用户信息。";
  if (blueprint.status !== "confirmed") return "蓝图尚未确认——请先接受当前蓝图后再生成体验旅程。";
  if (blueprint.stale) return "蓝图已更新，请先基于最新方案重建蓝图后再生成体验旅程。";
  return "蓝图尚不满足生成体验旅程的条件。";
}