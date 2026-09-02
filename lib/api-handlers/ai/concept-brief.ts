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
import { buildConceptBrief } from "@/lib/ai-concept-server";
import { getConceptReadiness, emptyConceptBrief, type ConceptBriefInputs, type ProductConceptBrief } from "@/lib/flow-concept";
import { applyFlowOpOnce, getFlowOpResult, type FlowOpType } from "@/lib/flow-op";
import { safeDetail } from "@/lib/api-error";

export const runtime = "nodejs";

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean);
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
    confirmedFields: asStringArray(b.confirmedFields) as ProductConceptBrief["confirmedFields"],
    evidenceRefs: b.evidenceRefs && typeof b.evidenceRefs === "object" ? (b.evidenceRefs as ProductConceptBrief["evidenceRefs"]) : {},
    previousBrief: b.previousBrief && typeof b.previousBrief === "object" ? (b.previousBrief as ProductConceptBrief["previousBrief"]) : null,
    frozenVersion: typeof b.frozenVersion === "number" ? b.frozenVersion : undefined,
    createdAt: typeof b.createdAt === "number" ? b.createdAt : empty.createdAt,
    updatedAt: typeof b.updatedAt === "number" ? b.updatedAt : empty.updatedAt,
  };
}

interface ConceptBody {
  projectId: string;
  operationId: string;
  operation: "build_concept_brief" | "update_concept_brief";
  brief?: unknown;
  inputs?: { idea?: string; answers?: string[]; directions?: string[] };
}

// POST /api/ai/concept-brief
// body: { projectId, operationId, operation: build|update, brief?, inputs:{idea?, answers?, directions?} }
// 200 → { data: ConceptBriefOpResult + readiness + flowMeta }
// 幂等：同 (userId, projectId, operationId, operationType) 只应用一次；重试返回已存结果。
export async function POST(req: NextRequest) {
  const { user, res } = await requireUser();
  if (res) return res;
  const rawBody = req.body ? await req.json().catch(() => null) : null;
  const operationTypeRaw = asString(rawBody?.operation);
  const isBuild = operationTypeRaw === FLOW_OPERATION.buildConceptBrief;
  const operationType: FlowOpType = isBuild
    ? FLOW_OPERATION.buildConceptBrief
    : FLOW_OPERATION.updateConceptBrief;
  const running = flowMetaRunning({
    operation: operationType,
    phase: "concept",
    operationId: asString(rawBody?.operationId) || undefined,
  });
  if (!rateLimit(`concept:${getClientIp(req)}`, 20, 60_000)) {
    const meta = flowMetaToJSON(
      flowMetaDone(running, {
        status: "failed",
        error: flowError("rate_limited", { operation: running.operation, phase: running.phase, requestId: running.requestId }),
      }),
    );
    return NextResponse.json({ error: "rate_limited", flowMeta: meta }, { status: 429 });
  }
  const body = (rawBody ?? {}) as ConceptBody;
  const projectId = asString(body.projectId);
  const operationId = asString(body.operationId);
  const briefRaw = asConceptBrief(body.brief);
  const inputs: ConceptBriefInputs = {
    idea: asString((body.inputs as { idea?: unknown } | undefined)?.idea),
    answers: asStringArray((body.inputs as { answers?: unknown } | undefined)?.answers),
    directions: asStringArray((body.inputs as { directions?: unknown } | undefined)?.directions),
  };

  const invalidFlag =
    !projectId ||
    !operationId ||
    (operationTypeRaw !== FLOW_OPERATION.buildConceptBrief && operationTypeRaw !== FLOW_OPERATION.updateConceptBrief);
  if (invalidFlag) {
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: flowError("invalid_response", { operation: running.operation, phase: running.phase, requestId: running.requestId }) }));
    return NextResponse.json({ error: "invalid_input", flowMeta: meta }, { status: 400 });
  }

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
    const snapSrc = parseSnapshot(row.data);
    const prev = asConceptBrief(snapSrc.conceptBrief ?? briefRaw) ?? null;

    // 幂等：此前已成功应用过该操作 → 直接返回已存结果，不再重复新增版本/写入
    const prior = await getFlowOpResult(deps);
    if (prior) {
      const stored = safeParse(prior);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }

    // 无 key 时 buildConceptBrief 内部走离线启发式（不编造、只落能定的）
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const out = await buildConceptBrief(isBuild ? "build" : "update", inputs, prev, apiKey);
    const nextBrief = {
      ...out.brief,
      projectId,
      id: prev?.id || out.brief.id || projectId,
      version: prev ? prev.version + 1 : (out.brief.version || 1),
    };

    // 写回项目快照（向后兼容：存进 flow 对象；老式顶层结构也能写）
    snapSrc.conceptBrief = nextBrief;
    await db
      .update(projects)
      .set({ data: JSON.stringify(snapSrc), updatedAt: Date.now() })
      .where(and(eq(projects.id, projectId), eq(projects.userId, user.sub)));

    const readiness = getConceptReadiness(nextBrief);
    const payload = {
      data: { brief: nextBrief, reply: out.reply, nextQuestion: out.nextQuestion, quickOptions: out.quickOptions, readiness },
    };

    // 幂等记账：并发重试命中唯一索引 → 用已存结果
    const applied = await applyFlowOpOnce(deps, JSON.stringify(payload));
    if (!applied.applied && applied.resultJson) {
      const stored = safeParse(applied.resultJson);
      const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed" }));
      return NextResponse.json({ ...(stored ?? {}), replay: true, flowMeta: meta });
    }
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "completed", fallbackUsed: !apiKey }));
    return NextResponse.json({ ...payload, flowMeta: meta });
  } catch (err) {
    // F0-A 错误协议：失败保留旧 Brief，不落幂等台账，不清空用户内容
    const reason = safeDetail(err);
    console.error("[api/ai/concept-brief] failed:", reason);
    const code =
      reason.startsWith("network:") || reason.startsWith("http:")
        ? "provider_unavailable"
        : reason.startsWith("parse:") || reason.startsWith("schema:")
          ? "invalid_response"
          : "unknown";
    const errObj = flowError(code, { operation: running.operation, phase: running.phase, requestId: running.requestId });
    const meta = flowMetaToJSON(flowMetaDone(running, { status: "failed", error: errObj, fallbackUsed: true }));
    return NextResponse.json({
      data: { brief: briefRaw, reply: errObj.message, readability: getConceptReadiness(briefRaw) },
      error: code,
      flowMeta: meta,
    });
  }
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    const p = JSON.parse(s);
    return p && typeof p === "object" ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** 从 projects.data 解析出可变快照对象（返回浅拷贝，供就地写入 conceptBrief） */
function parseSnapshot(data: string): Record<string, unknown> {
  let src: unknown = data;
  try {
    src = JSON.parse(data);
  } catch {
    src = { flow: {} };
  }
  if (src && typeof src === "object") {
    const asObj = src as Record<string, unknown>;
    // 新式：{ flow: Record, skeleton: Record }；老式：直接是 flow 字段散落
    if (asObj.flow && typeof asObj.flow === "object" && !asObj.skeleton) {
      return asObj.flow as Record<string, unknown>;
    }
    return asObj;
  }
  return {};
}