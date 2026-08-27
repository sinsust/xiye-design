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
  type ProductBlueprint,
} from "@/lib/flow-blueprint";
import {
  type ExperienceJourney,
  emptyJourney,
  hasUsableJourney,
} from "@/lib/flow-journey";
import {
  emptyScreenMap,
  applyScreenMapLocalEdit,
  resolveScreenMapDecision,
  answerScreenMapDecision,
  confirmScreenMap,
  reconcileScreenMap,
  restorePreviousScreenMap,
  getScreenMapReadiness,
  screenMapChangedSince,
  canInitScreenMap,
  type ScreenMap,
  type ScreenMapStatus,
  type ScreenType,
  type ScreenState,
  type ScreenMapEvidence,
} from "@/lib/flow-screen-map";
import { buildScreenMap } from "@/lib/ai-screen-map-server";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";

export const runtime = "nodejs";

// F3-A 页面地图与信息架构操作：init（仅 Blueprint+Journey 均已确认且未过期时）、
// update（局部编辑/暂缓/回答未决）、confirm（接受 / 带假设继续）、rebuild（蓝图或旅程变化后重建，
// 保留用户局部编辑并标冲突）、restore（恢复上一版）。
// 全部按 (userId, projectId, operationId) 幂等；读写严格按 userId + projectId 隔离；
// 出错时返回最近有效 ScreenMap，绝不因失败清空主流程 / Journey / Blueprint。

type ScreenMapOperation =
  | "init_screen_map"
  | "update_screen_map"
  | "confirm_screen_map"
  | "rebuild_screen_map";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asBoolean(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}
function asNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asEvidence(v: unknown): ScreenMapEvidence {
  return v === "confirmed" ? "confirmed" : v === "unresolved" ? "unresolved" : "assumption";
}
function asStatus(v: unknown): ScreenMapStatus {
  return v === "reviewing" ? "reviewing" : v === "confirmed" ? "confirmed" : "draft";
}
function asType(v: unknown): ScreenType {
  return v === "modal" ? "modal" : v === "drawer" ? "drawer" : v === "embedded_state" ? "embedded_state" : "page";
}
function asStateArray(v: unknown): ScreenState[] {
  const allowed: ScreenState[] = ["default", "first_use", "empty", "loading", "error", "success", "permission_required"];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is ScreenState => typeof x === "string" && (allowed as string[]).includes(x));
}
function asSource(v: unknown): ScreenMap["screens"][number]["source"] {
  if (!v || typeof v !== "object") return {};
  const s = v as Record<string, unknown>;
  return {
    journeyStepIds: Array.isArray(s.journeyStepIds) ? s.journeyStepIds.filter((x) => typeof x === "string") : undefined,
    blueprintPaths: Array.isArray(s.blueprintPaths) ? s.blueprintPaths.filter((x) => typeof x === "string") : undefined,
    decisionIds: Array.isArray(s.decisionIds) ? s.decisionIds.filter((x) => typeof x === "string") : undefined,
    note: asString(s.note) || undefined,
  };
}
function asScreen(v: unknown): ScreenMap["screens"][number] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    name: asString(o.name),
    type: asType(o.type),
    purpose: asString(o.purpose),
    entryPoints: Array.isArray(o.entryPoints) ? o.entryPoints.filter((x) => typeof x === "string") : [],
    exitPaths: Array.isArray(o.exitPaths) ? o.exitPaths.filter((x) => typeof x === "string") : [],
    primaryJourneyStepIds: Array.isArray(o.primaryJourneyStepIds) ? o.primaryJourneyStepIds.filter((x) => typeof x === "string") : [],
    keyInformation: asString(o.keyInformation),
    primaryActions: Array.isArray(o.primaryActions) ? o.primaryActions.filter((x) => typeof x === "string") : [],
    states: asStateArray(o.states),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asNav(v: unknown): ScreenMap["navigation"][number] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    fromScreenId: asString(o.fromScreenId),
    action: asString(o.action),
    toScreenId: asString(o.toScreenId),
    condition: asString(o.condition) || undefined,
  };
}

/** 防御性归一：把任意输入整理成合法 ScreenMap（不信任前端原始对象） */
function asScreenMap(v: unknown): ScreenMap | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyScreenMap({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: asStatus(b.status),
    stale: asBoolean(b.stale),
    acceptance: b.acceptance === "continue_with_assumptions" ? "continue_with_assumptions" : b.acceptance === "accepted" ? "accepted" : undefined,
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    sourceJourneyVersion: asNum(b.sourceJourneyVersion),
    generatedFromSignature: asString(b.generatedFromSignature) || undefined,
    guardedPaths: Array.isArray(b.guardedPaths) ? b.guardedPaths.filter((x) => typeof x === "string") : [],
    previousVersion:
      b.previousVersion && typeof b.previousVersion === "object"
        ? (b.previousVersion as ScreenMap["previousVersion"])
        : null,
    lastConflicts: Array.isArray(b.lastConflicts) ? b.lastConflicts.filter((x) => typeof x === "string") : undefined,
    screens: Array.isArray(b.screens) ? b.screens.map(asScreen) : [],
    navigation: Array.isArray(b.navigation) ? b.navigation.map(asNav) : [],
    unresolvedDecisions: Array.isArray(b.unresolvedDecisions) ? b.unresolvedDecisions : [],
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

/** 防御性归一 Blueprint（与 journey 路由同策略） */
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

/** 从 projects.data 解析出可变快照对象（与 concept/blueprint/journey 路由同策略） */
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
  if (reason === "blueprint-journey-not-ready") return "invalid_response" as const;
  return "unknown" as const;
}

function screenMapPayload(screenMap: ScreenMap | null, journey: ExperienceJourney | null | undefined) {
  return { screenMap, readiness: getScreenMapReadiness(screenMap, journey) };
}

// GET /api/ai/screen-map?projectId=xxx —— 获取当前 ScreenMap（幂等只读）
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const projectId = asString(req.nextUrl.searchParams.get("projectId"));
  const meta = flowMetaRunning({ operation: "get_screen_map", phase: "screen-map" });
  if (!projectId) {
    return NextResponse.json(
      { error: "invalid_input", data: screenMapPayload(null, null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unknown", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
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
      { error: "forbidden", data: screenMapPayload(null, null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unauthorized", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
      { status: 404 },
    );
  }
  const snap = parseSnapshot(row.data);
  const blueprint = asBlueprint(snap.blueprint);
  const journey = asJourney(snap.journey);
  const sm = asScreenMap(snap.screenMap);
  const stale = Boolean(sm) && screenMapChangedSince(blueprint, journey, sm);
  const s = sm ? { ...sm, stale } : null;
  return NextResponse.json({
    data: {
      ...screenMapPayload(s, journey),
      blueprintReady: Boolean(blueprint && blueprint.status === "confirmed" && !blueprint.stale),
      journeyReady: Boolean(journey && journey.status === "confirmed" && !journey.stale && hasUsableJourney(journey)),
    },
    flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "completed" })),
  });
}

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
    status: b.status === "confirmed" ? "confirmed" : b.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(b.stale),
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    guardedPaths: Array.isArray(b.guardedPaths) ? b.guardedPaths.filter((x) => typeof x === "string") : [],
    primaryScenario:
      b.primaryScenario && typeof b.primaryScenario === "object" ? (b.primaryScenario as ExperienceJourney["primaryScenario"]) : empty.primaryScenario,
    steps: Array.isArray(b.steps) ? b.steps : [],
    pivotalMoment: b.pivotalMoment && typeof b.pivotalMoment === "object" ? (b.pivotalMoment as ExperienceJourney["pivotalMoment"]) : null,
    edgeCases: Array.isArray(b.edgeCases) ? b.edgeCases : [],
    openDecisions: Array.isArray(b.openDecisions) ? b.openDecisions : [],
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

// POST /api/ai/screen-map —— 初始化 / 局部更新 / 接受 / 重建
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationRaw = asString(rawBody?.operation) as ScreenMapOperation;
  const isValidOp = ["init_screen_map", "update_screen_map", "confirm_screen_map", "rebuild_screen_map"].includes(operationRaw);
  const running = flowMetaRunning({ operation: operationRaw, phase: "screen-map", operationId: asString(rawBody?.operationId) || undefined });

  if (!rateLimit(`screen-map:${getClientIp(req)}`, 40, 60_000)) {
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
    const journey = asJourney(snap.journey);
    const current = asScreenMap(snap.screenMap);
    const prev = asScreenMap(body.screenMap) ?? current;

    // 幂等：此前已成功应用 → 直接返回既有结果
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }

    let next: ScreenMap | null = current;
    let conflicts: string[] = [];
    let message = "";
    let notReadyReason: string | null = null;

    if (operationRaw === "init_screen_map") {
      if (!blueprint || !journey || !canInitScreenMap(blueprint, journey)) {
        notReadyReason = reasonForNotReady(blueprint, journey);
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { ...screenMapPayload(current, journey), conflicts, reasons: [notReadyReason, "页面结构", "无法初始化"] },
          error: "blueprint_journey_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      if (current && current.version > 0) {
        next = current;
        message = "页面结构已存在，跳过初始化。";
      } else {
        next = buildScreenMap(blueprint, journey, { id: projectId, projectId });
        next.id = projectId;
        message = "已将已确认的核心体验收敛为首版页面结构。";
      }
    } else if (operationRaw === "update_screen_map") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-screen-map-to-update");
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : null;
      const path = asString(patch?.path);
      const value = asString(patch?.value);
      const decisionId = asString(body.decisionId);
      const chosenHint = asString(body.chosenHint);
      const answer = asString(body.answer);
      if (answer) {
        const found = base.unresolvedDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = answerScreenMapDecision(base, decisionId, answer);
        message = "这一关键选择已采纳你给出的取舍。";
      } else if (decisionId) {
        const found = base.unresolvedDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = resolveScreenMapDecision(base, decisionId, chosenHint);
        message = "这一选择已按假设暂缓，界面落地阶段需复核。";
      } else if (path) {
        next = applyScreenMapLocalEdit(base, { path, value });
        message = "已采纳你的局部修改。";
      } else {
        throw new Error("schema:no-patch");
      }
    } else if (operationRaw === "confirm_screen_map") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-screen-map-to-confirm");
      const acceptance = asString(body.acceptance) === "continue_with_assumptions" ? "continue_with_assumptions" : "accepted";
      next = confirmScreenMap(base, acceptance);
      message = acceptance === "continue_with_assumptions" ? "已带假设接受当前页面结构，可进入下一步。" : "已接受当前页面结构，可进入界面落地。";
    } else if (operationRaw === "rebuild_screen_map") {
      if (!blueprint || !journey || !canInitScreenMap(blueprint, journey)) {
        notReadyReason = reasonForNotReady(blueprint, journey);
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        return NextResponse.json({
          data: { ...screenMapPayload(current, journey), conflicts, reasons: [notReadyReason, "页面结构", "无法重建"] },
          error: "blueprint_journey_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      const fresh = buildScreenMap(blueprint, journey, { id: prev?.id || projectId, projectId });
      const merged = reconcileScreenMap(prev, fresh);
      next = merged.screenMap;
      next.id = prev?.id || projectId;
      conflicts = merged.conflicts;
      message = conflicts.length
        ? `已按最新方案重建页面结构；你在 ${conflicts.length} 处的修改被保留，冲突已列入待确认。`
        : "已按最新方案重建页面结构。";
    }

    if (!next) throw new Error("schema:no-screen-map-result");

    const finalSm = { ...next, stale: false, updatedAt: Date.now() };
    snap.screenMap = finalSm;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const payload = {
      data: { ...screenMapPayload(finalSm, journey), conflicts, message },
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
    // F0-A 错误协议：失败保留最近有效 ScreenMap（current 或 last persisted），不落台账，不清空内容
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[api/ai/screen-map] failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    const persisted = row ? parseSnapshot(row.data) : null;
    const journey = persisted ? asJourney(persisted.journey) : null;
    const fallback = persisted ? asScreenMap(persisted.screenMap) : asScreenMap(body?.screenMap);
    return NextResponse.json({
      data: { ...screenMapPayload(fallback, journey), conflicts: [] },
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
  const running = flowMetaRunning({ operation: "restore_screen_map", phase: "screen-map", operationId: operationId || undefined });
  if (!rateLimit(`screen-map:${getClientIp(req)}`, 40, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  if (!projectId || !operationId) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }
  const deps = { userId: user.sub, projectId, operationId, operationType: "restore_screen_map" as FlowOpType };
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
    const journey = asJourney(snap.journey);
    const current = asScreenMap(snap.screenMap);
    if (!current) throw new Error("schema:no-screen-map-to-restore");
    const restored = restorePreviousScreenMap(current);
    if (!restored) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", error: null }));
      return NextResponse.json({
        data: { ...screenMapPayload(current, journey), conflicts: [], message: "没有更早的有效版本可恢复。" },
        flowMeta: meta,
      });
    }
    restored.projectId = projectId;
    restored.id = current.id || projectId;
    snap.screenMap = restored;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));
    const payload = { data: { ...screenMapPayload(restored, journey), conflicts: [], message: "已恢复上一有效版本。" } };
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
    console.error("[api/ai/screen-map] restore failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    return NextResponse.json({
      data: { ...screenMapPayload(asScreenMap(body?.screenMap), null), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

function reasonForNotReady(blueprint: ProductBlueprint | null, journey: ExperienceJourney | null): string {
  if (!blueprint) return "还没有产品蓝图——需要先完成创意与方案结构化。";
  if (blueprint.status !== "confirmed") return "蓝图尚未确认——请先接受当前蓝图后再生成页面结构。";
  if (blueprint.stale) return "蓝图已更新，请先基于最新方案重建蓝图后再生成页面结构。";
  if (!journey) return "还没有核心体验旅程——需要先完成体验旅程收敛。";
  if (journey.status !== "confirmed") return "体验旅程尚未确认——请先接受当前核心体验后再生成页面结构。";
  if (journey.stale) return "核心体验已更新，请先重建体验旅程后再生成页面结构。";
  return "蓝图与体验尚不满足生成页面结构的条件。";
}