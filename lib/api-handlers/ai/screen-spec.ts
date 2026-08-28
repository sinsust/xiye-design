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
  type ProductBlueprint,
  emptyBlueprint,
} from "@/lib/flow-blueprint";
import {
  type ExperienceJourney,
  emptyJourney,
  hasUsableJourney,
} from "@/lib/flow-journey";
import {
  type ScreenMap,
  emptyScreenMap,
  type ScreenInfo,
  type ScreenState,
  type ScreenType,
  hasUsableScreenMap,
} from "@/lib/flow-screen-map";
import {
  type ScreenSpec,
  type ScreenSpecStatus,
  type ScreenSpecEvidence,
  type InfoLevel,
  type DataSensitivity,
  type DataSourceKind,
  emptyScreenSpec,
  updateScreenSpec,
  deferScreenSpecDecision,
  answerScreenSpecDecision,
  confirmScreenSpec,
  reconcileScreenSpec,
  restorePreviousScreenSpec,
  getScreenSpecReadiness,
  screenSpecChangedSince,
  canInitScreenSpec,
  type InformationHierarchy,
  type Interaction,
  type StateDesign,
  type DataNeed,
  type ScreenSpecInfo,
  type ScreenSpecDecision,
} from "@/lib/flow-screen-spec";
import { buildScreenSpec } from "@/lib/ai-screen-spec-server";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";

export const runtime = "nodejs";

// F3-B 界面规格契约操作：init（仅 Blueprint+Journey+ScreenMap 均已确认且未过期时）、
// update（局部编辑/暂缓/回答未决）、confirm（接受 / 带假设继续）、rebuild（来源变化后重建，
// 保留用户局部编辑并标冲突）、restore（恢复上一版）。
// 全部按 (userId, projectId, operationId) 幂等；读写严格按 userId + projectId 隔离；
// 出错时返回最近有效 ScreenSpec，绝不因失败清空主流程 / 蓝图 / 旅程 / 页面地图。

type ScreenSpecOperation =
  | "init_screen_spec"
  | "update_screen_spec"
  | "confirm_screen_spec"
  | "rebuild_screen_spec";

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
function asEvidence(v: unknown): ScreenSpecEvidence {
  return v === "confirmed" ? "confirmed" : v === "unresolved" ? "unresolved" : "assumption";
}
function asStatus(v: unknown): ScreenSpecStatus {
  return v === "reviewing" ? "reviewing" : v === "confirmed" ? "confirmed" : "draft";
}
function asLevel(v: unknown): InfoLevel {
  return v === "primary" ? "primary" : v === "secondary" ? "secondary" : "supporting";
}
function asSensitivity(v: unknown): DataSensitivity {
  return v === "public" ? "public" : v === "sensitive" ? "sensitive" : "private";
}
function asDataSource(v: unknown): DataSourceKind {
  return v === "user_input" || v === "system_generated" || v === "integration" ? v : v === "derived" ? "derived" : "system_generated";
}
function asType(v: unknown): ScreenType {
  return v === "modal" ? "modal" : v === "drawer" ? "drawer" : v === "embedded_state" ? "embedded_state" : "page";
}
function asErr(v: unknown) {
  return typeof v === "string" ? v : undefined;
}

function asSource(v: unknown): ScreenSpecInfo["informationHierarchy"][number]["source"] {
  if (!v || typeof v !== "object") return {};
  const s = v as Record<string, unknown>;
  return {
    screenMapPath: asErr(s.screenMapPath),
    journeyStepId: asErr(s.journeyStepId),
    blueprintPath: asErr(s.blueprintPath),
    decisionId: asErr(s.decisionId),
    note: asErr(s.note),
  };
}
function asHierarchy(v: unknown): InformationHierarchy {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    level: asLevel(o.level),
    title: asString(o.title),
    purpose: asString(o.purpose),
    contentItems: asStrList(o.contentItems),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asInteraction(v: unknown): Interaction {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    trigger: asString(o.trigger),
    userIntent: asString(o.userIntent),
    systemResponse: asString(o.systemResponse),
    successFeedback: asString(o.successFeedback),
    nextScreenId: asErr(o.nextScreenId),
    preservesDraft: asBoolean(o.preservesDraft),
    requiresConfirmation: asBoolean(o.requiresConfirmation),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asStateDesign(v: unknown): StateDesign {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const allowed: ScreenState[] = ["default", "first_use", "empty", "loading", "error", "success", "permission_required"];
  const state: ScreenState = (allowed as string[]).includes(asString(o.state)) ? (o.state as ScreenState) : "default";
  return {
    state,
    userMessage: asString(o.userMessage),
    primaryAction: asErr(o.primaryAction),
    recoveryPath: asErr(o.recoveryPath),
    preservesUserInput: asBoolean(o.preservesUserInput),
    evidence: asEvidence(o.evidence),
    source: asSource(o.source),
  };
}
function asDataNeed(v: unknown): DataNeed {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    label: asString(o.label),
    purpose: asString(o.purpose),
    sensitivity: asSensitivity(o.sensitivity),
    source: asDataSource(o.source),
    requiredForFirstRelease: asBoolean(o.requiredForFirstRelease),
    evidence: asEvidence(o.evidence),
    sourceRef: asString(o.sourceRef),
  };
}
function asOpenQuestion(v: unknown): ScreenSpecInfo["openQuestions"][number] {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    question: asString(o.question),
    impact: asString(o.impact),
    options: asStrList(o.options).length ? asStrList(o.options) : undefined,
  };
}
function asScreenSpecInfo(v: unknown): ScreenSpecInfo {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    screenId: asString(o.screenId),
    name: asString(o.name),
    type: asType(o.type),
    primaryOutcome: asString(o.primaryOutcome),
    pivotalMomentRole: asErr(o.pivotalMomentRole),
    informationHierarchy: Array.isArray(o.informationHierarchy) ? o.informationHierarchy.map(asHierarchy) : [],
    interactions: Array.isArray(o.interactions) ? o.interactions.map(asInteraction) : [],
    stateDesign: Array.isArray(o.stateDesign) ? o.stateDesign.map(asStateDesign) : [],
    dataNeeds: Array.isArray(o.dataNeeds) ? o.dataNeeds.map(asDataNeed) : [],
    openQuestions: Array.isArray(o.openQuestions) ? o.openQuestions.map(asOpenQuestion) : [],
  };
}
function asDecision(v: unknown): ScreenSpecDecision {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    id: asString(o.id),
    question: asString(o.question),
    options: asStrList(o.options).length ? asStrList(o.options) : undefined,
    chosenHint: asErr(o.chosenHint),
    impactNote: asErr(o.impactNote),
  };
}

/** 防御性归一：把任意输入整理成合法 ScreenSpec（不信任前端原始对象） */
function asScreenSpec(v: unknown): ScreenSpec | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyScreenSpec({ id: asString(b.id), projectId: asString(b.projectId) });
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: asStatus(b.status),
    stale: asBoolean(b.stale),
    acceptance: b.acceptance === "continue_with_assumptions" ? "continue_with_assumptions" : b.acceptance === "accepted" ? "accepted" : undefined,
    sourceScreenMapVersion: asNum(b.sourceScreenMapVersion),
    sourceJourneyVersion: asNum(b.sourceJourneyVersion),
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    generatedFromSignature: asErr(b.generatedFromSignature),
    guardedPaths: asStrList(b.guardedPaths),
    previousVersion:
      b.previousVersion && typeof b.previousVersion === "object"
        ? (b.previousVersion as ScreenSpec["previousVersion"])
        : null,
    lastConflicts: asStrList(b.lastConflicts),
    screens: Array.isArray(b.screens) ? b.screens.map(asScreenSpecInfo) : [],
    unresolvedDecisions: Array.isArray(b.unresolvedDecisions) ? b.unresolvedDecisions.map(asDecision) : [],
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

/** 防御性归一 ScreenMap（与 screen-map 路由同策略，供 compact 判定与重建输入） */
function asScreenMap(v: unknown): ScreenMap | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const empty = emptyScreenMap({ id: asString(b.id), projectId: asString(b.projectId) });
  const sc = (x: unknown): ScreenInfo => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return {
      id: asString(o.id),
      name: asString(o.name),
      type: asType(o.type),
      purpose: asString(o.purpose),
      entryPoints: asStrList(o.entryPoints),
      exitPaths: asStrList(o.exitPaths),
      primaryJourneyStepIds: asStrList(o.primaryJourneyStepIds),
      keyInformation: asString(o.keyInformation),
      primaryActions: asStrList(o.primaryActions),
      states: (asStrList(o.states) as ScreenState[]).filter((s): s is ScreenState =>
        ["default", "first_use", "empty", "loading", "error", "success", "permission_required"].includes(s)),
      evidence: asEvidence(o.evidence) as ScreenInfo["evidence"],
      source: asSource(o.source),
    };
  };
  return {
    ...empty,
    ...b,
    id: asString(b.id) || empty.id,
    projectId: asString(b.projectId) || empty.projectId,
    version: asNum(b.version),
    status: b.status === "confirmed" ? "confirmed" : b.status === "reviewing" ? "reviewing" : "draft",
    stale: asBoolean(b.stale),
    sourceBlueprintVersion: asNum(b.sourceBlueprintVersion),
    sourceJourneyVersion: asNum(b.sourceJourneyVersion),
    generatedFromSignature: asErr(b.generatedFromSignature),
    guardedPaths: asStrList(b.guardedPaths),
    previousVersion: b.previousVersion && typeof b.previousVersion === "object" ? (b.previousVersion as ScreenMap["previousVersion"]) : null,
    lastConflicts: asStrList(b.lastConflicts),
    screens: Array.isArray(b.screens) ? b.screens.map(sc) : [],
    navigation: Array.isArray(b.navigation) ? (b.navigation as ScreenMap["navigation"]) : [],
    unresolvedDecisions: Array.isArray(b.unresolvedDecisions) ? (b.unresolvedDecisions as ScreenMap["unresolvedDecisions"]) : [],
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
    guardedPaths: asStrList(b.guardedPaths),
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
    sourceDecisionIds: asStrList(b.sourceDecisionIds),
    createdAt: asNum(b.createdAt, empty.createdAt),
    updatedAt: asNum(b.updatedAt, empty.updatedAt),
  };
}

/** 防御性归一 Journey */
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
    guardedPaths: asStrList(b.guardedPaths),
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
  if (reason === "blueprint-journey-screenmap-not-ready" || reason === "source-not-ready") return "invalid_response" as const;
  return "unknown" as const;
}

function screenSpecPayload(spec: ScreenSpec | null, screenMap: ScreenMap | null | undefined) {
  return { screenSpec: spec, readiness: getScreenSpecReadiness(spec, screenMap) };
}

// GET /api/ai/screen-spec?projectId=xxx —— 获取当前 ScreenSpec（幂等只读）
export async function GET(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const projectId = asString(req.nextUrl.searchParams.get("projectId"));
  const meta = flowMetaRunning({ operation: "get_screen_spec", phase: "screen-spec" });
  if (!projectId) {
    return NextResponse.json(
      { error: "invalid_input", data: screenSpecPayload(null, null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unknown", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
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
      { error: "forbidden", data: screenSpecPayload(null, null), flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "failed", error: flowError("unauthorized", { operation: meta.operation, phase: meta.phase, requestId: meta.requestId }) })) },
      { status: 404 },
    );
  }
  const snap = parseSnapshot(row.data);
  const blueprint = asBlueprint(snap.blueprint);
  const journey = asJourney(snap.journey);
  const screenMap = asScreenMap(snap.screenMap);
  const spec = asScreenSpec(snap.screenSpec);
  const stale = Boolean(spec) && screenSpecChangedSince(blueprint, journey, screenMap, spec);
  const s = spec ? { ...spec, stale } : null;
  return NextResponse.json({
    data: {
      ...screenSpecPayload(s, screenMap),
      blueprintReady: Boolean(blueprint && blueprint.status === "confirmed" && !blueprint.stale),
      journeyReady: Boolean(journey && journey.status === "confirmed" && !journey.stale && hasUsableJourney(journey)),
      screenMapReady: Boolean(screenMap && screenMap.status === "confirmed" && !screenMap.stale && hasUsableScreenMap(screenMap, journey)),
    },
    flowMeta: flowMetaToJSON(flowMetaDone(meta, { status: "completed" })),
  });
}

// POST /api/ai/screen-spec —— 初始化 / 局部更新 / 接受 / 重建
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationRaw = asString(rawBody?.operation) as ScreenSpecOperation;
  const isValidOp = ["init_screen_spec", "update_screen_spec", "confirm_screen_spec", "rebuild_screen_spec"].includes(operationRaw);
  const running = flowMetaRunning({ operation: operationRaw, phase: "screen-spec", operationId: asString(rawBody?.operationId) || undefined });

  if (!rateLimit(`screen-spec:${getClientIp(req)}`, 40, 60_000)) {
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
    const screenMap = asScreenMap(snap.screenMap);
    const current = asScreenSpec(snap.screenSpec);
    const prev = asScreenSpec(body.screenSpec) ?? current;

    // 幂等：此前已成功应用 → 直接返回既有结果
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }

    let next: ScreenSpec | null = current;
    let conflicts: string[] = [];
    let message = "";

    if (operationRaw === "init_screen_spec") {
      if (!blueprint || !journey || !screenMap || !canInitScreenSpec(blueprint, journey, screenMap)) {
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        const reason = reasonForNotReady(blueprint, journey, screenMap);
        return NextResponse.json({
          data: { ...screenSpecPayload(current, screenMap), conflicts, reasons: [reason, "界面规格", "无法初始化"] },
          error: "source_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      if (current && current.version > 0) {
        next = current;
        message = "界面规格已存在，跳过初始化。";
      } else {
        next = buildScreenSpec(screenMap, journey, blueprint, { id: projectId, projectId });
        next.id = projectId;
        message = "已将确认的页面结构收敛为首版界面规格契约。";
      }
    } else if (operationRaw === "update_screen_spec") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-screen-spec-to-update");
      const patch = body.patch && typeof body.patch === "object" ? (body.patch as Record<string, unknown>) : null;
      const path = asString(patch?.path);
      const value = asString(patch?.value);
      const decisionId = asString(body.decisionId);
      const chosenHint = asString(body.chosenHint);
      const answer = asString(body.answer);
      if (answer) {
        const found = base.unresolvedDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = answerScreenSpecDecision(base, decisionId, answer);
        message = "这一关键选择已采纳你给出的取舍。";
      } else if (decisionId) {
        const found = base.unresolvedDecisions.some((d) => d.id === decisionId);
        if (!found) throw new Error("schema:unknown-decision");
        next = deferScreenSpecDecision(base, decisionId, chosenHint);
        message = "这一选择已按假设暂缓，界面原型阶段需复核。";
      } else if (path) {
        next = updateScreenSpec(base, { path, value });
        message = "已采纳你的局部修改。";
      } else {
        throw new Error("schema:no-patch");
      }
    } else if (operationRaw === "confirm_screen_spec") {
      const base = current ?? prev;
      if (!base) throw new Error("schema:no-screen-spec-to-confirm");
      const acceptance = asString(body.acceptance) === "continue_with_assumptions" ? "continue_with_assumptions" : "accepted";
      next = confirmScreenSpec(base, acceptance);
      message = acceptance === "continue_with_assumptions" ? "已带假设接受当前界面规格，可为原型与实现提供输入。" : "已接受当前界面规格，可为界面原型与实现提供稳定输入。";
    } else if (operationRaw === "rebuild_screen_spec") {
      if (!blueprint || !journey || !screenMap || !canInitScreenSpec(blueprint, journey, screenMap)) {
        const err = flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId });
        const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: err, requestId: err.requestId }));
        const reason = reasonForNotReady(blueprint, journey, screenMap);
        return NextResponse.json({
          data: { ...screenSpecPayload(current, screenMap), conflicts, reasons: [reason, "界面规格", "无法重建"] },
          error: "source_not_ready",
          flowMeta: meta,
        }, { status: 400 });
      }
      const fresh = buildScreenSpec(screenMap, journey, blueprint, { id: prev?.id || projectId, projectId });
      const merged = reconcileScreenSpec(prev, fresh);
      next = merged.screenSpec;
      next.id = prev?.id || projectId;
      conflicts = merged.conflicts;
      message = conflicts.length
        ? `已按最新方案重建界面规格；你在 ${conflicts.length} 处的修改被保留，冲突已列入待确认。`
        : "已按最新方案重建界面规格。";
    }

    if (!next) throw new Error("schema:no-screen-spec-result");

    const finalSpec = { ...next, stale: false, updatedAt: Date.now() };
    snap.screenSpec = finalSpec;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const payload = {
      data: { ...screenSpecPayload(finalSpec, screenMap), conflicts, message },
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
    // F0-A 错误协议：失败保留最近有效 ScreenSpec（current 或 last persisted），不落台账，不清空内容
    const reason = err instanceof Error ? err.message : "unknown";
    console.error("[api/ai/screen-spec] failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    const [row] = await db
      .select({ data: projects.data })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)))
      .limit(1);
    const persisted = row ? parseSnapshot(row.data) : null;
    const screenMap = persisted ? asScreenMap(persisted.screenMap) : null;
    const fallback = persisted ? asScreenSpec(persisted.screenSpec) : asScreenSpec(body?.screenSpec);
    return NextResponse.json({
      data: { ...screenSpecPayload(fallback, screenMap), conflicts: [] },
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
  const running = flowMetaRunning({ operation: "restore_screen_spec", phase: "screen-spec", operationId: operationId || undefined });
  if (!rateLimit(`screen-spec:${getClientIp(req)}`, 40, 60_000)) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  if (!projectId || !operationId) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }
  const deps = { userId: user.sub, projectId, operationId, operationType: "restore_screen_spec" as FlowOpType };
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
    const screenMap = asScreenMap(snap.screenMap);
    const current = asScreenSpec(snap.screenSpec);
    if (!current) throw new Error("schema:no-screen-spec-to-restore");
    const restored = restorePreviousScreenSpec(current);
    if (!restored) {
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", error: null }));
      return NextResponse.json({
        data: { ...screenSpecPayload(current, screenMap), conflicts: [], message: "没有更早的有效版本可恢复。" },
        flowMeta: meta,
      });
    }
    restored.projectId = projectId;
    restored.id = current.id || projectId;
    snap.screenSpec = restored;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snap), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));
    const payload = { data: { ...screenSpecPayload(restored, screenMap), conflicts: [], message: "已恢复上一有效版本。" } };
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
    console.error("[api/ai/screen-spec] restore failed:", reason);
    const code = mapError(reason);
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj }));
    return NextResponse.json({
      data: { ...screenSpecPayload(asScreenSpec(body?.screenSpec), null), conflicts: [] },
      error: code,
      flowMeta: meta,
    });
  }
}

function reasonForNotReady(blueprint: ProductBlueprint | null, journey: ExperienceJourney | null, screenMap: ScreenMap | null): string {
  if (!blueprint) return "还没有产品蓝图——需要先完成创意与方案结构化。";
  if (blueprint.status !== "confirmed") return "蓝图尚未确认——请先接受当前蓝图后再生成界面规格。";
  if (blueprint.stale) return "蓝图已更新，请先基于最新方案重建蓝图后再生成界面规格。";
  if (!journey) return "还没有核心体验旅程——需要先完成体验旅程收敛。";
  if (journey.status !== "confirmed") return "体验旅程尚未确认——请先接受当前核心体验后再生成界面规格。";
  if (journey.stale) return "核心体验已更新，请先重建体验旅程后再生成界面规格。";
  if (!screenMap) return "还没有页面结构——需要先完成页面地图与信息架构。";
  if (screenMap.status !== "confirmed") return "页面结构尚未确认——请先接受当前页面结构后再生成界面规格。";
  if (screenMap.stale) return "页面结构已更新，请先重建页面结构后再生成界面规格。";
  return "蓝图、体验与页面结构尚不满足生成界面规格的条件。";
}