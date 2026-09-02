// F3-C 界面原型契约操作：init（仅 ScreenSpec 已 confirmed 且未过期、且 Journey/ScreenMap/Blueprint
// 均就绪时）、update（局部编辑 guardedPaths / 记录反馈）、confirm（接受 / 带假设继续）、
// rebuild（来源变化后重建，保留 guardedPaths 并标冲突）、restore（恢复上一版）。
// 严格遵循 F0-A~F3-B 既有接入协议：
// - 幂等：(userId, projectId, operationId) 走 applyFlowOpOnce / getFlowOpResult；
// - 隔离：读写严格按 userId + projectId（服务端验证 projects 归属，不信客户端对象）；
// - 来源未就绪：返回 source_not_ready，不生成不写入；
// - 失败：返回最近有效 PrototypeSpec，绝不因失败清空蓝图/旅程/页面地图/界面规格。
// 本 handler 只消费 ScreenSpec（confirmed && !stale）及其关联 ScreenMap/Journey/Blueprint，
// 不修改任何上游对象；接入合并后的 /api/ai/[[...path]] 分发器。

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
  type FlowAIError,
} from "@/lib/flow-ai-types";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";
import {
  buildPrototype,
} from "@/lib/ai-prototype-server";
import {
  type PrototypeSpec,
  type PrototypeSourceScreenSpec,
  type PrototypeSourceScreenMap,
  type PrototypeSourceJourney,
  type PrototypeSourceBlueprint,
  type PrototypeFeedbackType,
  type PrototypeAcceptance,
  emptyPrototypeSpec,
  updatePrototype,
  addPrototypeFeedback,
  confirmPrototype,
  restorePreviousPrototype,
  reconcilePrototype,
  markPrototypeStaleIfNeeded,
  getPrototypeReadiness,
} from "@/lib/flow-prototype";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

type PrototypeOperation =
  | "init_prototype"
  | "update_prototype"
  | "rebuild_prototype"
  | "confirm_prototype";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function asBoolean(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}
function asNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function asStrList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asMode(v: unknown): PrototypeSpec["prototypeMode"] {
  return v === "mid_fidelity" ? "mid_fidelity" : "wireframe";
}
function asFeedbackType(v: unknown): PrototypeFeedbackType {
  return v === "blocker" ? "blocker" : v === "suggestion" ? "suggestion" : v === "success" ? "success" : "confusion";
}
function asAcceptance(v: unknown): PrototypeAcceptance {
  return v === "continue_with_assumptions" ? "continue_with_assumptions" : "accepted";
}

/** 防御性归一 PrototypeSpec（不信任前端原始对象） */
function asPrototype(v: unknown): PrototypeSpec | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyPrototypeSpec({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: b.status === "reviewing" ? "reviewing" : b.status === "confirmed" ? "confirmed" : "draft",
    acceptance: b.acceptance === "accepted" || b.acceptance === "continue_with_assumptions" ? b.acceptance : undefined,
    stale: asBoolean(b.stale),
    sourceScreenSpecVersion: asNum(b.sourceScreenSpecVersion),
    sourceScreenMapVersion: asNum(b.sourceScreenMapVersion),
    sourceJourneyVersion: asNum(b.sourceJourneyVersion),
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    generatedFromSignature: asString(b.generatedFromSignature),
    prototypeMode: asMode(b.prototypeMode),
    entryScreenId: asString(b.entryScreenId),
    screens: Array.isArray(b.screens) ? (b.screens as PrototypeSpec["screens"]) : [],
    flows: Array.isArray(b.flows) ? (b.flows as PrototypeSpec["flows"]) : [],
    pivotalMoment: b.pivotalMoment && typeof b.pivotalMoment === "object" ? (b.pivotalMoment as PrototypeSpec["pivotalMoment"]) : undefined,
    testScenarios: Array.isArray(b.testScenarios) ? (b.testScenarios as PrototypeSpec["testScenarios"]) : [],
    guardedPaths: asStrList(b.guardedPaths),
    previousVersion: b.previousVersion && typeof b.previousVersion === "object" ? (b.previousVersion as PrototypeSpec["previousVersion"]) : null,
    lastConflicts: asStrList(b.lastConflicts),
    feedback: Array.isArray(b.feedback) ? (b.feedback as PrototypeSpec["feedback"]) : [],
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

// 上游来源（从 projects 快照读出，服务端依据） —— 归一为纯领域层消费子集。
function sourceBlueprint(v: unknown): PrototypeSourceBlueprint | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return { version: asNum(o.version) };
}
function sourceJourney(v: unknown): PrototypeSourceJourney | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const steps = Array.isArray(o.steps)
    ? (o.steps as Array<Record<string, unknown>>).map((s) => ({
        id: asString(s.id),
        order: asNum(s.order),
        userGoal: asErr(s.userGoal),
        userAction: asErr(s.userAction),
        visibleOutcome: asErr(s.visibleOutcome),
      }))
    : [];
  const pm = o.pivotalMoment && typeof o.pivotalMoment === "object" ? (o.pivotalMoment as Record<string, unknown>) : null;
  return {
    version: asNum(o.version),
    status: o.status === "confirmed" ? "confirmed" : o.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(o.stale),
    steps,
    pivotalMoment: pm ? { stepId: asString(pm.stepId), successCriteria: asErr(pm.successCriteria) } : undefined,
  };
}
function sourceScreenMap(v: unknown): PrototypeSourceScreenMap | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    version: asNum(o.version),
    screens: Array.isArray(o.screens)
      ? (o.screens as Array<Record<string, unknown>>).map((s) => ({
          id: asString(s.id),
          name: asErr(s.name),
          type: asString(s.type),
          entryPoints: asStrList(s.entryPoints),
          primaryJourneyStepIds: asStrList(s.primaryJourneyStepIds),
        }))
      : [],
  };
}
function sourceScreenSpec(v: unknown): PrototypeSourceScreenSpec | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return {
    version: asNum(o.version),
    status: o.status === "confirmed" ? "confirmed" : o.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(o.stale),
    screens: Array.isArray(o.screens)
      ? (o.screens as Array<Record<string, unknown>>).map((s) => ({
          screenId: asString(s.screenId),
          name: asString(s.name),
          type: asString(s.type),
          primaryJourneyStepIds: asStrList(s.primaryJourneyStepIds),
          primaryOutcome: asErr(s.primaryOutcome),
          pivotalMomentRole: asErr(s.pivotalMomentRole),
          unresolved: Array.isArray(s.unresolvedDecisions) && s.unresolvedDecisions.length ? ["存在未决设计选择，以假设提示"] : undefined,
          informationHierarchy: Array.isArray(s.informationHierarchy)
            ? (s.informationHierarchy as Array<Record<string, unknown>>).map((h) => ({
                level: asString(h.level),
                title: asErr(h.title),
                purpose: asErr(h.purpose),
                contentItems: asStrList(h.contentItems),
              }))
            : [],
          interactions: Array.isArray(s.interactions)
            ? (s.interactions as Array<Record<string, unknown>>).map((it) => ({
                id: asErr(it.id),
                trigger: asString(it.trigger),
                nextScreenId: asErr(it.nextScreenId),
                successFeedback: asErr(it.successFeedback),
                systemResponse: asErr(it.systemResponse),
              }))
            : [],
          stateDesign: Array.isArray(s.stateDesign)
            ? (s.stateDesign as Array<Record<string, unknown>>).map((st) => ({
                state: asString(st.state),
                userMessage: asErr(st.userMessage),
              }))
            : [],
        }))
      : [],
  };
}
function asErr(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

/** 从 projects.data 解析出可变快照对象（与各路由同策略） */
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
  if (reason === "screen-spec-not-ready") return "source_not_ready" as const;
  return "unknown" as const;
}

/** 就绪判定：ScreenSpec 必须 confirmed && !stale；四层来源齐全才可生成 */
function notReadyReason(
  blueprint: PrototypeSourceBlueprint | null,
  journey: PrototypeSourceJourney | null,
  screenMap: PrototypeSourceScreenMap | null,
  screenSpec: PrototypeSourceScreenSpec | null,
): string {
  if (!screenSpec) return "还没有界面规格——需要先完成界面规格验收。";
  if (screenSpec.status !== "confirmed") return "界面规格尚未确认——请先接受当前界面规格后再生成原型。";
  if (screenSpec.stale) return "界面规格已更新，请先基于最新方案重建界面规格后再生成原型。";
  if (screenSpec.screens.length === 0) return "界面规格中还没有可用界面。";
  if (!journey || journey.status !== "confirmed" || journey.stale) return "核心体验旅程尚未就绪，无法生成可试玩的体验路径。";
  if (!screenMap) return "页面结构尚未就绪。";
  if (!blueprint) return "产品蓝图尚未就绪。";
  return "四层来源尚不满足生成可试玩原型的条件。";
}

function prototypePayload(spec: PrototypeSpec | null, sources: {
  screenSpec: PrototypeSourceScreenSpec | null;
  journey: PrototypeSourceJourney | null;
  screenMap: PrototypeSourceScreenMap | null;
  blueprint: PrototypeSourceBlueprint | null;
}) {
  return {
    prototype: spec,
    readiness: getPrototypeReadiness(spec, sources.screenSpec, sources.screenMap, sources.journey),
    screenSpecReady: Boolean(
      sources.screenSpec && sources.screenSpec.status === "confirmed" && !sources.screenSpec.stale && sources.screenSpec.screens.length > 0,
    ),
    sourceReady: Boolean(
      sources.blueprint &&
      sources.journey &&
      sources.journey.status === "confirmed" &&
      !sources.journey.stale &&
      sources.screenMap &&
      sources.screenSpec &&
      sources.screenSpec.status === "confirmed" &&
      !sources.screenSpec.stale,
    ),
  };
}

interface SnapSources {
  blueprint: PrototypeSourceBlueprint | null;
  journey: PrototypeSourceJourney | null;
  screenMap: PrototypeSourceScreenMap | null;
  screenSpec: PrototypeSourceScreenSpec | null;
  current: PrototypeSpec | null;
}

function readSnap(snap: Record<string, unknown>): SnapSources {
  return {
    blueprint: sourceBlueprint(snap.blueprint),
    journey: sourceJourney(snap.journey),
    screenMap: sourceScreenMap(snap.screenMap),
    screenSpec: sourceScreenSpec(snap.screenSpec),
    current: asPrototype(snap.prototype),
  };
}

function asReadinessResult(sc: SnapSources, stale?: boolean) {
  const spec = sc.current ? { ...sc.current, stale: stale ?? sc.current.stale } : null;
  return prototypePayload(spec, {
    screenSpec: sc.screenSpec,
    journey: sc.journey,
    screenMap: sc.screenMap,
    blueprint: sc.blueprint,
  });
}

function meta(running: ReturnType<typeof flowMetaRunning>, status: "completed" | "failed", err?: unknown) {
  return flowMetaToJSON(
    status === "failed"
      ? flowMetaDone(running, { status, error: typeof err === "string" ? flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId, overrideMessage: err }) : (err as FlowAIError) ?? flowError("unknown", { operation: running.operation, phase: running.phase, requestId: running.requestId }) })
      : flowMetaDone(running, { status: "completed" }),
  );
}

// GET /api/ai/prototype?projectId=xxx —— 当前 PrototypeSpec + 就绪状态（幂等只读）
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const projectId = asString(req.nextUrl.searchParams.get("projectId"));
  const running = flowMetaRunning({ operation: "get_prototype", phase: "prototype" });
  if (!projectId) {
    return NextResponse.json({ error: "invalid_input", data: null, flowMeta: meta(running, "failed", "missing projectId") }, { status: 400 });
  }
  try {
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "forbidden", data: null, flowMeta: meta(running, "failed") }, { status: 404 });
    }
    const snap = parseSnapshot(row.data);
    const sc = readSnap(snap);
    const refreshed = sc.current ? markPrototypeStaleIfNeeded(
      sc.current,
      sc.screenSpec,
      sc.screenMap,
      sc.journey,
      sc.blueprint,
    ) : null;
    const staleFlag = refreshed !== null ? refreshed.stale : undefined;
    return NextResponse.json({ data: asReadinessResult(sc, staleFlag), flowMeta: meta(running, "completed") });
  } catch (err) {
    const reason = safeDetail(err);
    console.error("[api/ai/prototype] get failed:", reason);
    return NextResponse.json({ error: "unknown", data: null, flowMeta: meta(running, "failed", reason) });
  }
}

// POST /api/ai/prototype —— init / update / rebuild / confirm
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationRaw = asString(rawBody?.operation) as PrototypeOperation;
  const isValidOp = ["init_prototype", "update_prototype", "rebuild_prototype", "confirm_prototype"].includes(operationRaw);
  const field = flowMetaRunning({ operation: operationRaw, phase: "prototype", operationId: asString(rawBody?.operationId) || undefined });

  if (!rateLimit(`prototype:${getClientIp(req)}`, 40, 60_000)) {
    return NextResponse.json({ error: "rate_limited", flowMeta: meta(field, "failed") }, { status: 429 });
  }

  const body = (rawBody ?? {}) as Record<string, unknown>;
  const projectId = asString(body.projectId);
  const operationId = asString(body.operationId);
  if (!projectId || !operationId || !isValidOp) {
    return NextResponse.json({ error: "invalid_input", flowMeta: meta(field, "failed") }, { status: 400 });
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
      return NextResponse.json({ error: "forbidden", flowMeta: meta(field, "failed") }, { status: 404 });
    }
    const snap = parseSnapshot(row.data);
    const sc = readSnap(snap);
    const current = sc.current;

    // 幂等：此前已成功应用 → 直接返回既有结果
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta(field, "completed") });
    }

    let next: PrototypeSpec | null = current;
    let conflicts: string[] = [];
    let message = "";

    if (operationRaw === "init_prototype") {
      if (!sc.blueprint || !sc.journey || !sc.screenMap || !sc.screenSpec || sc.screenSpec.status !== "confirmed" || sc.screenSpec.stale) {
        const reason = notReadyReason(sc.blueprint, sc.journey, sc.screenMap, sc.screenSpec);
        return NextResponse.json({
          data: { ...asReadinessResult(sc), conflicts, reasons: [reason, "界面原型", "无法初始化"] },
          error: "source_not_ready",
          flowMeta: meta(field, "failed"),
        }, { status: 400 });
      }
      if (current && current.version > 0) {
        next = current;
        message = "原型已存在，跳过初始化。";
      } else {
        next = buildPrototype(
          sc.screenSpec, sc.screenMap, sc.journey, sc.blueprint,
          { id: projectId, projectId },
        ).proto;
        next.id = projectId;
        message = "已将确认且未过期的界面规格收敛为首版可试玩原型契约。";
      }
    } else if (operationRaw === "update_prototype") {
      const base = current;
      if (!base) throw new Error("schema:no-prototype-to-update");
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : null;
      const path = asString(patch?.path);
      const value = asString(patch?.value);
      const fb = body.feedback && typeof body.feedback === "object" ? (body.feedback as Record<string, unknown>) : null;
      if (fb && typeof fb.type === "string") {
        next = addPrototypeFeedback(base, {
          type: asFeedbackType(fb.type),
          screenId: asErr(fb.screenId),
          interactionId: asErr(fb.interactionId),
          scenarioId: asErr(fb.scenarioId),
          message: asErr(fb.message),
        });
        message = "这一条体验反馈已记录（仅保存在当前原型中，不写入第二大脑）。";
      } else if (path && value !== undefined) {
        next = updatePrototype(base, { path, value });
        message = "已采纳你的局部调整（重建时将保留）。";
      } else {
        throw new Error("schema:no-patch");
      }
    } else if (operationRaw === "confirm_prototype") {
      const base = current;
      if (!base) throw new Error("schema:no-prototype-to-confirm");
      const acceptance = asAcceptance(body.acceptance);
      next = confirmPrototype(base, acceptance);
      message = acceptance === "continue_with_assumptions"
        ? "已带假设确认当前原型，可基于核心路径试玩并记录验收反馈。"
        : "已确认当前原型，可基于核心路径试玩并记录验收反馈。";
    } else if (operationRaw === "rebuild_prototype") {
      const base = current;
      if (!sc.blueprint || !sc.journey || !sc.screenMap || !sc.screenSpec || sc.screenSpec.status !== "confirmed" || sc.screenSpec.stale) {
        const reason = notReadyReason(sc.blueprint, sc.journey, sc.screenMap, sc.screenSpec);
        return NextResponse.json({
          data: { ...asReadinessResult(sc), conflicts, reasons: [reason, "界面原型", "无法重建"] },
          error: "source_not_ready",
          flowMeta: meta(field, "failed"),
        }, { status: 400 });
      }
      const fresh = buildPrototype(
        sc.screenSpec, sc.screenMap, sc.journey, sc.blueprint,
        { id: base?.id || projectId, projectId },
      ).proto;
      const merged = reconcilePrototype(base, fresh);
      next = merged.proto;
      next.id = base?.id || projectId;
      conflicts = merged.conflicts;
      message = conflicts.length
        ? `已按最新界面规格重建原型；你在 ${conflicts.length} 处的调整被保留，冲突已列为待确认。`
        : "已按最新界面规格重建原型。";
    }

    if (!next) throw new Error("schema:no-prototype-result");

    const finalSpec = { ...next, stale: false, updatedAt: Date.now() };
    snap.prototype = finalSpec;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const payload = { data: { ...prototypePayload(finalSpec, sc.screenSpec ? { screenSpec: sc.screenSpec, journey: sc.journey, screenMap: sc.screenMap, blueprint: sc.blueprint } : sc), conflicts, message } };

    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta(field, "completed") });
    }
    return NextResponse.json({ ...payload, flowMeta: meta(field, "completed") });
  } catch (err) {
    // F0-A 错误协议：失败保留最近有效 PrototypeSpec，不清空内容、不落台账
    const reason = safeDetail(err);
    console.error("[api/ai/prototype] failed:", reason);
    const code = mapError(reason);
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    const persisted = row ? parseSnapshot(row.data) : null;
    const sc = persisted ? readSnap(persisted) : { blueprint: null, journey: null, screenMap: null, screenSpec: null, current: asPrototype(body?.prototype) };
    return NextResponse.json({
      data: { ...asReadinessResult(sc), conflicts: [] },
      error: code,
      flowMeta: meta(field, "failed", reason),
    });
  }
}

// PUT /api/ai/prototype —— restore 上一有效版本
export async function PUT(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const body = await req.json().catch(() => null);
  const projectId = asString(body?.projectId);
  const operationId = asString(body?.operationId);
  const field = flowMetaRunning({ operation: "restore_prototype", phase: "prototype", operationId: operationId || undefined });
  if (!rateLimit(`prototype:${getClientIp(req)}`, 40, 60_000)) {
    return NextResponse.json({ error: "rate_limited", flowMeta: meta(field, "failed") }, { status: 429 });
  }
  if (!projectId || !operationId) {
    return NextResponse.json({ error: "invalid_input", flowMeta: meta(field, "failed") }, { status: 400 });
  }
  const deps = { userId: user.sub, projectId, operationId, operationType: "restore_prototype" as FlowOpType };
  try {
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "forbidden", flowMeta: meta(field, "failed") }, { status: 404 });
    }
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta(field, "completed") });
    }
    const snap = parseSnapshot(row.data);
    const sc = readSnap(snap);
    const current = sc.current;
    if (!current) throw new Error("schema:no-prototype-to-restore");
    const restored = restorePreviousPrototype(current);
    if (!restored) {
      return NextResponse.json({
        data: { ...asReadinessResult(sc), conflicts: [], message: "没有更早的有效版本可恢复。" },
        flowMeta: meta(field, "completed"),
      });
    }
    restored.projectId = projectId;
    restored.id = current.id || projectId;
    snap.prototype = restored;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));
    const payload = { data: { ...prototypePayload(restored, sc.screenSpec ? { screenSpec: sc.screenSpec, journey: sc.journey, screenMap: sc.screenMap, blueprint: sc.blueprint } : sc), conflicts: [], message: "已恢复上一有效版本。" } };
    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta(field, "completed") });
    }
    return NextResponse.json({ ...payload, flowMeta: meta(field, "completed") });
  } catch (err) {
    const reason = safeDetail(err);
    console.error("[api/ai/prototype] restore failed:", reason);
    const code = mapError(reason);
    return NextResponse.json({
      data: { ...prototypePayload(asPrototype(body?.prototype), { blueprint: null, journey: null, screenMap: null, screenSpec: null }), conflicts: [] },
      error: code,
      flowMeta: meta(field, "failed", reason),
    });
  }
}