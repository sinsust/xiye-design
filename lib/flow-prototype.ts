// F3-C 界面原型契约（PrototypeSpec）：确定性构建 + 状态机 + 就绪判定。
// 与 flow-screen-spec 同范式；只被服务端 API 路由与 ai-prototype-server 引用，不进入客户端 bundle。
//
// 设计约定：
// - PrototypeSpec 是「可点击原型」的完整契约（屏 / 交互流 / 测试剧本 / 状态 / 反馈）；
// - version=0 表示尚未初始化；status 三态 draft/reviewing/confirmed；
// - 上游四层来源（蓝图 / 旅程 / 页面结构 / 界面规格）任一版本高于记录版本即标记 stale；
// - 局部编辑记入 guardedPaths，重建时重放，冲突进 lastConflicts；
// - 全部内容证据为 assumption，绝不伪造 confirmed。

// ───────────────────────── 基础类型 ─────────────────────────

export type PrototypeStatus = "draft" | "reviewing" | "confirmed";
export type PrototypeAcceptance = "accepted" | "continue_with_assumptions";
export type PrototypeFeedbackType = "confusion" | "blocker" | "suggestion" | "success";
export type PrototypeMode = "wireframe" | "mid_fidelity";
export type PrototypeBlockRole =
  | "header"
  | "context"
  | "primary_content"
  | "secondary_content"
  | "action_area"
  | "feedback"
  | "navigation";

export interface PrototypeLayoutBlock {
  id: string;
  role: PrototypeBlockRole;
  /** 展示优先级（越小越靠上）；action_area 用大值压到底部 */
  priority: number;
  title?: string;
  purpose: string;
}

export interface PrototypeScreenState {
  state: string;
  visibleMessage: string;
  preservesInput?: boolean;
  recoveryAction?: string;
}

export interface PrototypeInteraction {
  id: string;
  screenId: string;
  triggerLabel: string;
  targetScreenId?: string;
  targetState?: string;
  expectedOutcome?: string;
  preservesDraft?: boolean;
}

export interface PrototypeFlow {
  id: string;
  name: string;
  interactions: PrototypeInteraction[];
}

export interface PrototypeTestScenario {
  id: string;
  title: string;
  successCriteria: string[];
}

export interface PrototypeFeedback {
  id: string;
  type: PrototypeFeedbackType;
  screenId?: string;
  interactionId?: string;
  scenarioId?: string;
  message?: string;
  createdAt: number;
}

export interface PrototypePivotalMoment {
  screenId: string;
  label?: string;
  description?: string;
}

export interface PrototypeScreen {
  screenId: string;
  name: string;
  layoutBlocks: PrototypeLayoutBlock[];
  prototypeStates: PrototypeScreenState[];
}

export interface PrototypeSpec {
  id: string;
  projectId: string;
  version: number;
  status: PrototypeStatus;
  acceptance?: PrototypeAcceptance;
  stale: boolean;
  sourceScreenSpecVersion: number;
  sourceScreenMapVersion: number;
  sourceJourneyVersion: number;
  sourceBlueprintVersion: number;
  generatedFromSignature: string;
  prototypeMode: PrototypeMode;
  entryScreenId: string;
  screens: PrototypeScreen[];
  flows: PrototypeFlow[];
  pivotalMoment?: PrototypePivotalMoment;
  testScenarios: PrototypeTestScenario[];
  /** 局部编辑路径（重建时重放） */
  guardedPaths: string[];
  previousVersion: PrototypeSpec | null;
  lastConflicts: string[];
  feedback: PrototypeFeedback[];
  createdAt: number;
  updatedAt: number;
}

export interface PrototypeReadiness {
  hasUsablePrototype: boolean;
  reason: string;
}

// ── 来源子集（服务端从快照归一，供确定性构建消费；与 flow-ai-types 的 source* 局部函数对齐） ──

export interface PrototypeSourceBlueprint {
  version: number;
}

export interface PrototypeSourceJourneyStep {
  id: string;
  order: number;
  userGoal?: string;
  userAction?: string;
  visibleOutcome?: string;
}

export interface PrototypeSourceJourney {
  version: number;
  status: PrototypeStatus;
  stale: boolean;
  steps: PrototypeSourceJourneyStep[];
  pivotalMoment?: { stepId: string; successCriteria?: string };
}

export interface PrototypeSourceScreenMapScreen {
  id: string;
  name?: string;
  type: string;
  entryPoints: string[];
  primaryJourneyStepIds: string[];
}

export interface PrototypeSourceScreenMap {
  version: number;
  screens: PrototypeSourceScreenMapScreen[];
}

export interface PrototypeSourceScreenSpecScreenInteraction {
  id?: string;
  trigger: string;
  nextScreenId?: string;
  successFeedback?: string;
  systemResponse?: string;
}

export interface PrototypeSourceScreenSpecScreenInfo {
  level: string;
  title?: string;
  purpose?: string;
  contentItems: string[];
}

export interface PrototypeSourceScreenSpecScreen {
  screenId: string;
  name: string;
  type: string;
  primaryOutcome?: string;
  pivotalMomentRole?: string;
  unresolved?: string[];
  informationHierarchy: PrototypeSourceScreenSpecScreenInfo[];
  interactions: PrototypeSourceScreenSpecScreenInteraction[];
  stateDesign: { state: string; userMessage?: string }[];
  primaryJourneyStepIds: string[];
}

export interface PrototypeSourceScreenSpec {
  version: number;
  status: PrototypeStatus;
  stale: boolean;
  screens: PrototypeSourceScreenSpecScreen[];
}

// ───────────────────────── 工具函数（与 flow-screen-spec 同范式） ─────────────────────────

export function isBlank(s: string | null | undefined): boolean {
  return s === null || s === undefined || s.trim() === "";
}

export function stableId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return;
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function clonePrototypeSpec(spec: PrototypeSpec): PrototypeSpec {
  return JSON.parse(JSON.stringify(spec)) as PrototypeSpec;
}

// ───────────────────────── 空骨架 ─────────────────────────

export function emptyPrototypeSpec(opts: { id?: string; projectId?: string } = {}): PrototypeSpec {
  const now = Date.now();
  return {
    id: opts.id ?? "",
    projectId: opts.projectId ?? "",
    version: 0,
    status: "draft",
    stale: false,
    sourceScreenSpecVersion: 0,
    sourceScreenMapVersion: 0,
    sourceJourneyVersion: 0,
    sourceBlueprintVersion: 0,
    generatedFromSignature: "",
    prototypeMode: "wireframe",
    entryScreenId: "",
    screens: [],
    flows: [],
    testScenarios: [],
    guardedPaths: [],
    previousVersion: null,
    lastConflicts: [],
    feedback: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ───────────────────────── 就绪判定 ─────────────────────────

export function getPrototypeReadiness(
  spec: PrototypeSpec | null,
  screenSpec?: PrototypeSourceScreenSpec | null,
  screenMap?: PrototypeSourceScreenMap | null,
  journey?: PrototypeSourceJourney | null,
): PrototypeReadiness {
  if (!spec || spec.version <= 0) {
    if (!screenSpec) return { hasUsablePrototype: false, reason: "还没有界面规格——需要先完成界面规格验收。" };
    if (screenSpec.status !== "confirmed") return { hasUsablePrototype: false, reason: "界面规格尚未确认——请先接受当前界面规格后再生成原型。" };
    if (screenSpec.stale) return { hasUsablePrototype: false, reason: "界面规格已更新，请先基于最新方案重建界面规格后再生成原型。" };
    if (screenSpec.screens.length === 0) return { hasUsablePrototype: false, reason: "界面规格中还没有可用界面。" };
    if (!journey || journey.status !== "confirmed" || journey.stale) return { hasUsablePrototype: false, reason: "核心体验旅程尚未就绪，无法生成可试玩的体验路径。" };
    if (!screenMap) return { hasUsablePrototype: false, reason: "页面结构尚未就绪。" };
    return { hasUsablePrototype: false, reason: "界面规格确认且四层来源就绪后可生成可试玩原型。" };
  }
  if (spec.stale) return { hasUsablePrototype: false, reason: "原型已过期，需要基于最新界面规格重建。" };
  const usable = spec.screens.length > 0 && spec.flows.length > 0;
  return {
    hasUsablePrototype: usable,
    reason: usable
      ? `原型 v${spec.version} 可基于 ${spec.screens.length} 屏 / ${spec.flows.length} 路径试玩。`
      : "原型还不够完整（缺少屏或路径），确认后可基于核心路径试玩。",
  };
}

// ───────────────────────── 确定性构建 ─────────────────────────

/** 从已确认且未过期的 ScreenSpec + ScreenMap + Journey + Blueprint 确定性生成首版 PrototypeSpec。 */
export function prototypeFromSources(
  screenSpec: PrototypeSourceScreenSpec,
  screenMap: PrototypeSourceScreenMap,
  journey: PrototypeSourceJourney,
  blueprint: PrototypeSourceBlueprint,
  opts: { id?: string; projectId?: string } = {},
): PrototypeSpec {
  const now = Date.now();

  const pivotalScreen = journey.pivotalMoment
    ? screenSpec.screens.find((sc) => sc.primaryJourneyStepIds.includes(journey.pivotalMoment!.stepId))
    : undefined;
  const entryScreenId = pivotalScreen?.screenId ?? screenSpec.screens[0]?.screenId ?? screenMap.screens[0]?.id ?? "";

  const screens: PrototypeScreen[] = screenSpec.screens.map((s) => ({
    screenId: s.screenId,
    name: s.name,
    layoutBlocks: [
      { id: `${s.screenId}-header`, role: "header", priority: 1, title: s.name, purpose: "标题区" },
      ...s.informationHierarchy.map((h, i) => ({
        id: `${s.screenId}-blk-${i}`,
        role: (h.level === "primary"
          ? "primary_content"
          : h.level === "secondary"
            ? "secondary_content"
            : "context") as PrototypeBlockRole,
        priority: i + 2,
        title: h.title,
        purpose: h.purpose ?? "",
      })),
      ...(s.interactions.length
        ? [{ id: `${s.screenId}-action`, role: "action_area" as PrototypeBlockRole, priority: 99, purpose: "操作区" }]
        : []),
    ],
    prototypeStates: s.stateDesign.map((st) => ({
      state: st.state,
      visibleMessage: st.userMessage ?? st.state,
    })),
  }));

  const interactions: PrototypeInteraction[] = screenSpec.screens.flatMap((s) =>
    s.interactions.map((it, i) => ({
      id: it.id ?? `${s.screenId}-it-${i}`,
      screenId: s.screenId,
      triggerLabel: it.trigger,
      targetScreenId: it.nextScreenId,
      expectedOutcome: it.successFeedback,
    })),
  );

  const flows: PrototypeFlow[] = journey.steps.map((step) => ({
    id: step.id,
    name: step.userGoal ?? `步骤 ${step.order}`,
    interactions: interactions.filter((it) =>
      screenSpec.screens.some((sc) => sc.screenId === it.screenId && sc.primaryJourneyStepIds.includes(step.id)),
    ),
  }));

  const pivotalMoment: PrototypePivotalMoment | undefined = pivotalScreen
    ? { screenId: pivotalScreen.screenId }
    : undefined;

  const testScenarios: PrototypeTestScenario[] = journey.pivotalMoment
    ? [
        {
          id: stableId(`sc-pivot-${journey.pivotalMoment.stepId}`),
          title: "关键时刻走查",
          successCriteria: journey.pivotalMoment.successCriteria ? [journey.pivotalMoment.successCriteria] : ["完成核心步骤"],
        },
      ]
    : [];

  const signature = JSON.stringify({
    ss: screenSpec.version,
    sm: screenMap.version,
    j: journey.version,
    bp: blueprint.version,
    n: screenSpec.screens.length,
  });

  return {
    ...emptyPrototypeSpec(opts),
    version: 1,
    status: "draft",
    sourceScreenSpecVersion: screenSpec.version,
    sourceScreenMapVersion: screenMap.version,
    sourceJourneyVersion: journey.version,
    sourceBlueprintVersion: blueprint.version,
    generatedFromSignature: signature,
    prototypeMode: "wireframe",
    entryScreenId,
    screens,
    flows,
    pivotalMoment,
    testScenarios,
    createdAt: now,
    updatedAt: now,
  };
}

// ───────────────────────── 状态机 / 编辑操作 ─────────────────────────

/** 局部编辑单个文本路径（记入 guardedPaths，重建保留） */
export function updatePrototype(spec: PrototypeSpec, patch: { path: string; value: string }): PrototypeSpec {
  const next = clonePrototypeSpec(spec);
  setPath(next as unknown as Record<string, unknown>, patch.path, patch.value);
  const guarded = next.guardedPaths.includes(patch.path) ? next.guardedPaths : [...next.guardedPaths, patch.path];
  return { ...next, guardedPaths: guarded, version: spec.version, updatedAt: Date.now() };
}

/** 记录一条原型验收反馈（不改版本与状态；仅保存在当前原型中） */
export function addPrototypeFeedback(
  spec: PrototypeSpec,
  fb: {
    type: PrototypeFeedbackType;
    screenId?: string;
    interactionId?: string;
    scenarioId?: string;
    message?: string;
  },
): PrototypeSpec {
  const entry: PrototypeFeedback = {
    id: stableId(`fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    type: fb.type,
    screenId: fb.screenId,
    interactionId: fb.interactionId,
    scenarioId: fb.scenarioId,
    message: fb.message,
    createdAt: Date.now(),
  };
  return { ...spec, feedback: [...spec.feedback, entry], updatedAt: Date.now() };
}

/** 接受当前原型 / 带假设继续 */
export function confirmPrototype(spec: PrototypeSpec, acceptance: PrototypeAcceptance): PrototypeSpec {
  return { ...spec, status: "confirmed", acceptance, updatedAt: Date.now() };
}

/** 恢复最近有效（前一）版本 */
export function restorePreviousPrototype(spec: PrototypeSpec): PrototypeSpec | null {
  return spec.previousVersion ?? null;
}

/**
 * 任一来源（蓝图/旅程/页面结构/界面规格）变化后重建：服务端保留 guardedPaths，冲突进 lastConflicts。
 * 返回合并后的原型与冲突路径列表。
 */
export function reconcilePrototype(
  base: PrototypeSpec | null,
  fresh: PrototypeSpec,
): { proto: PrototypeSpec; conflicts: string[] } {
  if (!base) return { proto: fresh, conflicts: [] };
  const proto = clonePrototypeSpec(fresh);
  const conflicts: string[] = [];
  for (const p of base.guardedPaths) {
    const prev = getPath(base as unknown as Record<string, unknown>, p);
    if (prev === undefined) continue;
    const exists = getPath(proto as unknown as Record<string, unknown>, p) !== undefined;
    if (exists) setPath(proto as unknown as Record<string, unknown>, p, prev);
    else conflicts.push(p);
  }
  return { proto: { ...proto, updatedAt: Date.now() }, conflicts };
}

/**
 * 标记过期：任一来源版本高于原型记录版本即 stale。
 * 返回新对象（仅在状态变化时）。
 */
export function markPrototypeStaleIfNeeded(
  spec: PrototypeSpec,
  screenSpec?: PrototypeSourceScreenSpec | null,
  screenMap?: PrototypeSourceScreenMap | null,
  journey?: PrototypeSourceJourney | null,
  blueprint?: PrototypeSourceBlueprint | null,
): PrototypeSpec {
  const stale =
    (screenSpec?.version ?? 0) > spec.sourceScreenSpecVersion ||
    (screenMap?.version ?? 0) > spec.sourceScreenMapVersion ||
    (journey?.version ?? 0) > spec.sourceJourneyVersion ||
    (blueprint?.version ?? 0) > spec.sourceBlueprintVersion;
  if (stale === spec.stale) return spec;
  return { ...spec, stale };
}
