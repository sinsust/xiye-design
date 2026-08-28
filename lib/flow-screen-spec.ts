// F3-B 逐界面信息架构与交互契约（ScreenSpec）：基于已确认且未过期的 ScreenMap，
// 结合 ExperienceJourney 与 ProductBlueprint，确定性生成每个界面的产品规格。
// 与 F2-A/F2-B/F3-A 一致：这一层只含领域类型与纯函数（client / server / 离线验证脚本共用），
// 不触碰三栏视觉、不引入服务端依赖、不做数据库改动。
//
// 设计红线（对应 F3-B 需求）：
// - ScreenSpec 是「后台可审阅、可追溯」的产品规格契约，不是表单、画布、高保真视觉稿、React 页面或代码；
// - 证据三分类继续严格使用：confirmed / assumption / unresolved，绝不伪造用户已确认事实；
// - 非空自动推导内容默认 assumption；没有来源不能被标为 confirmed；
// - 所有条目必须可追溯至：ScreenMap path / Journey step id / Blueprint path / F1·F2 decision id / 明确 note；
// - ScreenMap / Journey / Blueprint 任一来源版本或签名变化 → ScreenSpec stale；
// - 重建 reconcileScreenSpec 保留 guardedPaths、冲突进 unresolvedDecisions+lastConflicts，不静默覆盖；
// - 状态机 draft → reviewing → confirmed（confirmed 含「接受」与「带假设继续」两种落点）；
// - readiness：hasUsableScreenSpec（每个界面都有 spec + 每 spec 有 primaryOutcome/层级/交互/状态），
//   canProceed = !stale && hasUsableScreenSpec && status===confirmed；未决只影响完成度，「带假设继续」放行。

import type { ProductBlueprint } from "./flow-blueprint";
import {
  type ExperienceJourney,
  blueprintJourneySignature,
  hasUsableJourney,
} from "./flow-journey";
import {
  type ScreenMap,
  type ScreenInfo,
  type ScreenState,
  type ScreenType,
  hasUsableScreenMap,
} from "./flow-screen-map";

export type ScreenSpecStatus = "draft" | "reviewing" | "confirmed";
export type ScreenSpecEvidence = "confirmed" | "assumption" | "unresolved";
export type ScreenSpecAcceptance = "accepted" | "continue_with_assumptions";
export type InfoLevel = "primary" | "secondary" | "supporting";
/** 数据敏感度：public 公开 / private 私有 / sensitive 敏感 */
export type DataSensitivity = "public" | "private" | "sensitive";
/** 数据来源：用户输入 / 系统生成 / 集成 / 推导 */
export type DataSourceKind = "user_input" | "system_generated" | "integration" | "derived";

/** 每项内容的来源：可回指 ScreenMap path / Journey step id / Blueprint path / F1·F2 decision id */
export interface ScreenSpecSource {
  screenMapPath?: string;
  journeyStepId?: string;
  blueprintPath?: string;
  decisionId?: string;
  note?: string;
}

/** 信息层级区块：这一屏在某个层级上要呈现什么、为谁服务 */
export interface InformationHierarchy {
  id: string;
  level: InfoLevel;
  title: string;
  purpose: string;
  contentItems: string[];
  evidence: ScreenSpecEvidence;
  source: ScreenSpecSource;
}

/** 一次交互契约：用户触发什么 → 意图 → 系统如何回应 → 成功反馈 →（可选）去往哪个界面 */
export interface Interaction {
  id: string;
  trigger: string;
  userIntent: string;
  systemResponse: string;
  successFeedback: string;
  nextScreenId?: string;
  /** 该交互是否保留用户草稿 / 输入（不因跳转或失败丢失） */
  preservesDraft: boolean;
  /** 该交互是否需要用户二次确认 */
  requiresConfirmation: boolean;
  evidence: ScreenSpecEvidence;
  source: ScreenSpecSource;
}

/** 某个必要状态的设计：用户看到的文案 / 主要动作 / 恢复方式 / 是否保留输入 */
export interface StateDesign {
  state: ScreenState;
  userMessage: string;
  primaryAction?: string;
  recoveryPath?: string;
  preservesUserInput: boolean;
  evidence: ScreenSpecEvidence;
  source: ScreenSpecSource;
}

/** 首版必要的数据需求：只为第一版服务，不虚构集成能力 */
export interface DataNeed {
  label: string;
  purpose: string;
  sensitivity: DataSensitivity;
  source: DataSourceKind;
  requiredForFirstRelease: boolean;
  evidence: ScreenSpecEvidence;
  sourceRef: string;
}

/** 该界面内待定的开放问题（一般不硬凑，优先收敛为 spec 级高杠杆决策） */
export interface ScreenOpenQuestion {
  id: string;
  question: string;
  impact: string;
  options?: string[];
}

/** 单个界面的产品规格契约 */
export interface ScreenSpecInfo {
  screenId: string;
  name: string;
  type: ScreenType;
  /** 这一界面要帮助用户完成什么（唯一主结果） */
  primaryOutcome: string;
  /** 若该界面承载 Journey 的 pivotal moment，说明其角色与成功标准 */
  pivotalMomentRole?: string;
  informationHierarchy: InformationHierarchy[];
  interactions: Interaction[];
  stateDesign: StateDesign[];
  dataNeeds: DataNeed[];
  openQuestions: ScreenOpenQuestion[];
}

/** 高杠杆跨界待决定项（规格：最多一个；回答后移出或标为按假设选择） */
export interface ScreenSpecDecision {
  id: string;
  question: string;
  options?: string[];
  chosenHint?: string;
  impactNote?: string;
}

/** 仅保留可审计的前一版本最小集，避免快照膨胀 */
export interface FlattenedPreviousScreenSpec {
  version: number;
  status: ScreenSpecStatus;
  stale: boolean;
  screens: ScreenSpecInfo[];
  unresolvedDecisions: ScreenSpecDecision[];
  updatedAt: number;
}

/** 完整界面规格契约 */
export interface ScreenSpec {
  id: string;
  projectId: string;
  version: number;
  status: ScreenSpecStatus;
  stale: boolean;
  acceptance?: ScreenSpecAcceptance;
  /** 来源页面地图的版本号（用于 stale 判断） */
  sourceScreenMapVersion: number;
  sourceJourneyVersion: number;
  sourceBlueprintVersion: number;
  /** 生成时 ScreenMap+Journey+Blueprint 关键字段签名（用于 stale 判断） */
  generatedFromSignature?: string;
  /** 用户绕过重建做手动编辑的路径（重建不静默覆盖） */
  guardedPaths: string[];
  previousVersion?: FlattenedPreviousScreenSpec | null;
  lastConflicts?: string[];

  screens: ScreenSpecInfo[];
  unresolvedDecisions: ScreenSpecDecision[];

  createdAt: number;
  updatedAt: number;
}

export interface ScreenSpecReadiness {
  status: ScreenSpecStatus;
  screenCount: number;
  consensusCount: number;
  unresolvedCount: number;
  hasUsableScreenSpec: boolean;
  canProceed: boolean;
  acceptance?: ScreenSpecAcceptance;
  reasons: string[];
}

// ───────────────────────── 工具 ─────────────────────────

function now(): number {
  return Date.now();
}

export function isBlank(s: string | null | undefined): boolean {
  return !s || !s.trim();
}

/** 稳定 id：按内容生成短指纹 */
export function stableId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "ss" + (h >>> 0).toString(36);
}

/** 点路径读写（支持数组下标：screens.0.primaryOutcome） */
export function getPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    const nxt = cur[p];
    if (nxt == null || typeof nxt !== "object") cur[p] = {};
    cur = cur[p] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function cloneScreenSpec(spec: ScreenSpec): ScreenSpec {
  return JSON.parse(JSON.stringify(spec)) as ScreenSpec;
}

// ───────────────────────── 空界面规格 ─────────────────────────

export function emptyScreenSpec(opts: { id?: string; projectId?: string } = {}): ScreenSpec {
  const t = now();
  return {
    id: opts.id || "",
    projectId: opts.projectId || "",
    version: 0,
    status: "draft",
    stale: false,
    sourceScreenMapVersion: 0,
    sourceJourneyVersion: 0,
    sourceBlueprintVersion: 0,
    guardedPaths: [],
    previousVersion: null,
    screens: [],
    unresolvedDecisions: [],
    createdAt: t,
    updatedAt: t,
  };
}

// ───────────────────────── 完成度（纯函数） ─────────────────────────

/** 统计各 section 里 confirmed / assumption / unresolved 的条目数 */
export function countScreenSpecEvidence(
  spec: ScreenSpec | null | undefined,
): { confirmed: number; assumption: number; unresolved: number } {
  if (!spec) return { confirmed: 0, assumption: 0, unresolved: 0 };
  let confirmed = 0;
  let assumption = 0;
  let unresolved = 0;
  const add = (e: ScreenSpecEvidence) => {
    if (e === "confirmed") confirmed++;
    else if (e === "assumption") assumption++;
    else unresolved++;
  };
  for (const info of spec.screens) {
    for (const h of info.informationHierarchy) add(h.evidence);
    for (const it of info.interactions) add(it.evidence);
    for (const st of info.stateDesign) add(st.evidence);
    for (const d of info.dataNeeds) add(d.evidence);
  }
  return { confirmed, assumption, unresolved };
}

/**
 * 是否已有一份「可用」的界面规格契约：
 * - 每个 ScreenMap screen 都有对应 spec；
 * - 每个 spec 有 primaryOutcome，且至少一个层级 / 一个交互 / 一个状态。
 * 未决问题只影响完成度，不在此做禁止字段齐全门禁。
 */
export function hasUsableScreenSpec(
  spec: ScreenSpec | null | undefined,
  screenMap: ScreenMap | null | undefined,
): boolean {
  if (!spec) return false;
  if (spec.version <= 0) return false;
  if (!screenMap || screenMap.screens.length === 0) return false;
  const specByScreen = new Map(spec.screens.map((s) => [s.screenId, s]));
  // 每个 ScreenMap 界面都有规格
  if (!screenMap.screens.every((sc) => specByScreen.has(sc.id))) return false;
  // 每个规格具备主结果 + 至少一个层级 / 交互 / 状态
  for (const info of spec.screens) {
    if (!info.primaryOutcome || !info.primaryOutcome.trim()) return false;
    if (info.informationHierarchy.length < 1) return false;
    if (info.interactions.length < 1) return false;
    if (info.stateDesign.length < 1) return false;
  }
  return true;
}

export function getScreenSpecReadiness(
  spec: ScreenSpec | null | undefined,
  screenMap: ScreenMap | null | undefined,
): ScreenSpecReadiness {
  if (!spec) {
    return {
      status: "draft", screenCount: 0, consensusCount: 0, unresolvedCount: 0,
      hasUsableScreenSpec: false, canProceed: false, reasons: ["尚无界面规格——在页面结构确认后自动生成。"],
    };
  }
  const { confirmed } = countScreenSpecEvidence(spec);
  const unresolvedCount = spec.unresolvedDecisions.length;
  const usable = hasUsableScreenSpec(spec, screenMap);
  const confirmedState = spec.status === "confirmed";
  // 规格：canProceed = !stale && hasUsableScreenSpec && status===confirmed
  const canProceed = !spec.stale && usable && confirmedState;
  const reasons: string[] = [];
  if (spec.stale) reasons.push("页面结构或核心体验已更新，请基于最新方案重建设计规格。（你的手动修改会被保留，冲突将标为待确认。）");
  if (confirmedState) {
    reasons.push(
      spec.acceptance === "continue_with_assumptions"
        ? `界面规格已带假设确认（仍有 ${unresolvedCount} 项关键选择按假设处理）。`
        : "界面规格已确认，可为界面原型与实现提供稳定输入。",
    );
  } else {
    reasons.push(`界面体验已明确 ${spec.screens.length} 个关键界面 · 仍有 ${unresolvedCount} 项关键选择`);
    if (spec.status === "reviewing") reasons.push("你仍在对界面规格做局部确认或修改，完成后可接受当前规格。");
    if (!usable) reasons.push("界面规格还不够完整——可继续通过访谈补充，或直接带假设推进。");
    if (usable && !confirmedState) reasons.push("已具备可用界面规格，可接受或带假设进入下一步。");
  }
  return {
    status: spec.status,
    screenCount: spec.screens.length,
    consensusCount: confirmed,
    unresolvedCount,
    hasUsableScreenSpec: usable,
    canProceed,
    acceptance: spec.acceptance,
    reasons,
  };
}

// ───────────────────────── 从 ScreenMap+Journey+Blueprint 生成首版 ScreenSpec ─────────────────────────

/**
 * ScreenMap+Journey+Blueprint 关键字段签名：任一来源被引用字段变化 → 签名变化 → ScreenSpec stale。
 * 头部压入三份版本号，使「版本变化」与「内容变化」都能被侦测；blueprint 沿用 journey 的既有签名。
 */
export function screenSpecSignature(
  blueprint: ProductBlueprint | null | undefined,
  journey: ExperienceJourney | null | undefined,
  screenMap: ScreenMap | null | undefined,
): string {
  const bpPart = blueprint ? blueprintJourneySignature(blueprint) : "";
  const stepPart = (journey?.steps ?? [])
    .map((s) => `${s.order}:${s.userGoal}|${s.userAction}|${s.systemBehavior}|${s.visibleOutcome}`)
    .join("\n");
  const smPart =
    (screenMap?.screens ?? [])
      .map((s) => `${s.id}:${s.name}|${s.type}|${s.purpose}|${(s.primaryActions ?? []).join("/")}|${(s.states ?? []).join(",")}`)
      .join("\n") +
    "\n#nav\n" +
    (screenMap?.navigation ?? []).map((n) => `${n.fromScreenId}->${n.toScreenId}:${n.action}`).join("\n");
  return `${blueprint ? blueprint.version : 0}|${journey ? journey.version : 0}|${screenMap ? screenMap.version : 0}|${bpPart}|${stepPart}|${smPart}`;
}

/** 任一来源对象（ScreenMap / Journey / Blueprint）变化 → ScreenSpec stale */
export function screenSpecChangedSince(
  blueprint: ProductBlueprint | null | undefined,
  journey: ExperienceJourney | null | undefined,
  screenMap: ScreenMap | null | undefined,
  spec: ScreenSpec | null | undefined,
): boolean {
  if (!spec || !blueprint || !journey || !screenMap) return false;
  if (blueprint.version !== spec.sourceBlueprintVersion) return true;
  if (journey.version !== spec.sourceJourneyVersion) return true;
  if (screenMap.version !== spec.sourceScreenMapVersion) return true;
  const cur = screenSpecSignature(blueprint, journey, screenMap);
  if (spec.generatedFromSignature && cur !== spec.generatedFromSignature) return true;
  return false;
}

/** 是否允许初始化 ScreenSpec：ScreenMap / Journey / Blueprint 均已 confirmed、未 stale、且可用 */
export function canInitScreenSpec(
  blueprint: ProductBlueprint | null | undefined,
  journey: ExperienceJourney | null | undefined,
  screenMap: ScreenMap | null | undefined,
): boolean {
  return Boolean(
    blueprint &&
      journey &&
      screenMap &&
      blueprint.status === "confirmed" &&
      !blueprint.stale &&
      journey.status === "confirmed" &&
      !journey.stale &&
      hasUsableJourney(journey) &&
      screenMap.status === "confirmed" &&
      !screenMap.stale &&
      hasUsableScreenMap(screenMap, journey),
  );
}

/** 拼接单个屏幕规格的每一块来源 */
function src(
  screenMapPath?: string,
  journeyStepId?: string,
  blueprintPath?: string,
  decisionId?: string,
  note?: string,
): ScreenSpecSource {
  return {
    screenMapPath: screenMapPath ? screenMapPath : undefined,
    journeyStepId: journeyStepId ? journeyStepId : undefined,
    blueprintPath: blueprintPath ? blueprintPath : undefined,
    decisionId: decisionId ? decisionId : undefined,
    note: note ? note : undefined,
  };
}

const DEFAULT_SUCCESS =
  "操作完成，界面明确提示结果并给出下一次动作；关键结果不会因跳转或失败丢失。";

/** 信息层级：固定 3 个区块（落在 2–4），分别对应首屏主线索 / 内容与进展 / 上下文与去向 */
function buildHierarchy(sc: ScreenInfo, i: number): InformationHierarchy[] {
  const actions = sc.primaryActions ?? [];
  const exits = sc.exitPaths ?? [];
  return [
    {
      id: stableId(`${sc.id}_h_primary`),
      level: "primary",
      title: "主任务线索",
      purpose: "让用户一进入就知道此刻要完成什么、从哪一步开始",
      contentItems: [sc.keyInformation || sc.purpose, ...actions.slice(0, 2)].filter(Boolean),
      evidence: "assumption",
      source: src(`screens.${i}.purpose`, undefined, undefined, undefined, "首屏主线索由该界面的职责与主操作归纳（AI）"),
    },
    {
      id: stableId(`${sc.id}_h_content`),
      level: "secondary",
      title: "当前内容与进展",
      purpose: "呈现这一屏的核心内容与进行状态，让用户判断是否继续动作",
      contentItems: [sc.keyInformation || "当前录入 / 生成的内容", "可继续操作的人口"].filter(Boolean),
      evidence: "assumption",
      source: src(`screens.${i}.keyInformation`, undefined, undefined, undefined, "由页面地图关键信息展开（AI）"),
    },
    {
      id: stableId(`${sc.id}_h_context`),
      level: "supporting",
      title: "上下文与去向",
      purpose: "提供辅助信息与离开方向，让用户始终知道可以回到哪里",
      contentItems: exits,
      evidence: "assumption",
      source: src(`screens.${i}.exitPaths`, undefined, undefined, undefined, "由退往的界面展开（AI）"),
    },
  ];
}

/** 交互：从 ScreenMap 主操作展开主交互；再补上该界面的跨屏跳转（导航语义不被改写） */
function buildInteractions(
  sc: ScreenInfo,
  i: number,
  sm: ScreenMap,
  carriesPivot: boolean,
  pivotStepId: string,
): Interaction[] {
  const out: Interaction[] = [];
  const actions = sc.primaryActions ?? [];
  const navFrom = sm.navigation.filter((n) => n.fromScreenId === sc.id);
  for (const a of actions) {
    const nav = navFrom.find((n) => n.action === a);
    out.push({
      id: stableId(`${sc.id}_act_${a}`),
      trigger: a,
      userIntent: `通过「${a}」推进本界面的主任务`,
      systemResponse: "承接操作并即时给出可感知的结果反馈",
      successFeedback: carriesPivot ? "用户在此刻感到「问题被真正解决」，得到一条可采纳 / 落定的下一步" : DEFAULT_SUCCESS,
      nextScreenId: nav?.toScreenId,
      preservesDraft: true,
      requiresConfirmation: false,
      evidence: "assumption",
      source: src(
        `screens.${i}.primaryActions`,
        carriesPivot ? pivotStepId : undefined,
        undefined,
        undefined,
        "由页面地图主操作展开；成功反馈在承载关键触点的界面上尤其重要（AI）",
      ),
    });
  }
  const nameOf = (id: string) => sm.screens.find((s) => s.id === id)?.name ?? id;
  for (const n of navFrom) {
    if (actions.includes(n.action)) continue;
    out.push({
      id: stableId(`${sc.id}_nav_${n.action}`),
      trigger: n.action,
      userIntent: `前往「${nameOf(n.toScreenId)}」`,
      systemResponse: "切换到目标界面，保留当前进度",
      successFeedback: "已到达目标界面，用户可继续",
      nextScreenId: n.toScreenId,
      preservesDraft: true,
      requiresConfirmation: false,
      evidence: "assumption",
      source: src("navigation", undefined, undefined, undefined, `来自页面地图的跨屏跳转：${sc.name} → ${nameOf(n.toScreenId)}`),
    });
  }
  return out;
}

/** 为 ScreenMap 已声明的每个状态补充可见文案 / 主要动作 / 恢复方式 */
function buildStateDesign(sc: ScreenInfo, i: number): StateDesign[] {
  return (sc.states ?? []).map((state) => {
    const first = (sc.primaryActions ?? [])[0];
    switch (state) {
      case "first_use":
        return { state, userMessage: "首次进入的引导提示：说明这一屏要帮你完成什么、从哪里开始", primaryAction: first, recoveryPath: "从引导回到主界面", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "首次使用状态的引导（AI）") };
      case "empty":
        return { state, userMessage: "这里还没有内容，可以从录入 / 导入开始", primaryAction: first, recoveryPath: "回到可继续录入的状态", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "空状态与起步引导（AI）") };
      case "loading":
        return { state, userMessage: "处理中……请稍候，不会丢失你已录入的内容", primaryAction: undefined, recoveryPath: "完成后自动回到当前状态", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "加载中的反馈（AI）") };
      case "error":
        return { state, userMessage: "操作遇到问题，已保留你的输入", primaryAction: "重试", recoveryPath: "重试本操作，或返回继续编辑", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "出错与恢复（AI）") };
      case "success":
        return { state, userMessage: "操作已成功完成", primaryAction: "继续下一步", recoveryPath: "按结果给出的方向继续", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "成功反馈（AI）") };
      case "permission_required":
        return { state, userMessage: "需要授权才能继续这一步", primaryAction: "前往授权", recoveryPath: "授权完成后回到原位继续", preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "授权拦截（AI）") };
      default:
        return { state, userMessage: "默认：正常展示主任务与内容", primaryAction: first, recoveryPath: undefined, preservesUserInput: true, evidence: "assumption", source: src(`screens.${i}.states`, undefined, undefined, undefined, "默认态（AI）") };
    }
  });
}

/** 仅生成首版必要的数据需求；不虚构集成能力（只使用 user_input / system_generated / derived） */
function buildDataNeeds(sc: ScreenInfo, i: number): DataNeed[] {
  const needs: DataNeed[] = [];
  const name = sc.name;
  const isEntry = sc.type === "page" && (!sc.entryPoints || sc.entryPoints.length === 0);
  if (isEntry || /起步|入口|首页/.test(name)) {
    needs.push({
      label: "当前场景与最近进度",
      purpose: "让再次进入的用户不丢失位置，能继续上次的整理",
      sensitivity: "private",
      source: "system_generated",
      requiredForFirstRelease: true,
      evidence: "assumption",
      sourceRef: `screens.${i}`,
    });
  }
  if (/记录|整理|录入/.test(name)) {
    needs.push({
      label: "录入的内容",
      purpose: "主任务的核心输入，驱动自动归纳",
      sensitivity: "private",
      source: "user_input",
      requiredForFirstRelease: true,
      evidence: "assumption",
      sourceRef: `screens.${i}`,
    });
  }
  if (/建议|落定|决策/.test(name)) {
    needs.push({
      label: "自动归纳的建议",
      purpose: "让结论有依据可采纳、可导出下一步",
      sensitivity: "private",
      source: "derived",
      requiredForFirstRelease: true,
      evidence: "assumption",
      sourceRef: `screens.${i}`,
    });
  }
  if (/取舍|抽屉|改写/.test(name)) {
    needs.push({
      label: "用户对建议的取舍",
      purpose: "记录并保留用户的覆写，不因重建丢失",
      sensitivity: "private",
      source: "user_input",
      requiredForFirstRelease: true,
      evidence: "assumption",
      sourceRef: `screens.${i}`,
    });
  }
  if (needs.length === 0) {
    needs.push({
      label: `${sc.name}的关键信息`,
      purpose: "支撑这一屏的核心内容展示",
      sensitivity: "private",
      source: "system_generated",
      requiredForFirstRelease: true,
      evidence: "assumption",
      sourceRef: `screens.${i}`,
    });
  }
  return needs.slice(0, 2);
}

/** 单个 ScreenMap screen → 完整 ScreenSpecInfo（保持 id/name/type/导航语义一致；唯一 primaryOutcome） */
function screenSpecInfoFor(sc: ScreenInfo, i: number, sm: ScreenMap, journey: ExperienceJourney): ScreenSpecInfo {
  const pivot = journey.pivotalMoment;
  const pivotStepId = pivot?.stepId ?? "";
  const carriesPivot = (sc.primaryJourneyStepIds ?? []).includes(pivotStepId);
  const info: ScreenSpecInfo = {
    screenId: sc.id,
    name: sc.name,
    type: sc.type,
    primaryOutcome: sc.purpose.trim() || `完成「${sc.name}」的核心任务`,
    informationHierarchy: buildHierarchy(sc, i),
    interactions: buildInteractions(sc, i, sm, carriesPivot, pivotStepId),
    stateDesign: buildStateDesign(sc, i),
    dataNeeds: buildDataNeeds(sc, i),
    openQuestions: [],
  };
  if (carriesPivot) {
    info.pivotalMomentRole =
      `承载${journey.primaryScenario.title || "核心"}的关键触达点` +
      (pivot ? ` · 成功标准：${pivot.successCriteria}` : "");
  }
  return info;
}

/**
 * 从已确认 ScreenMap + ExperienceJourney + ProductBlueprint 确定性生成首版 ScreenSpec。
 * - 为 ScreenMap 内每一个 screen 全量生成对应规格，保持 id/name/type/导航语义一致；
 * - 每个 screen 有唯一 primaryOutcome；生成 2–4 个信息层级区块；
 * - 交互与 ScreenMap primaryActions/exitPaths 对齐；为每个已声明状态补充文案/动作/恢复；
 * - 只生成首版必要数据需求，不虚构集成能力；
 * - Journey pivotalMoment 映射到承载该 step 的 screen，并写入可感知的 successFeedback；
 * - 最多一个跨界面的高杠杆 unresolved decision；
 * - 全部内容证据为 assumption，带可追溯来源，绝不伪造 confirmed。
 * 这是无 LLM / 离线时的确定性兜底，也是后续 LLM 版输出的结构化基准。
 */
export function screenSpecFromScreenMapJourneyBlueprint(
  blueprint: ProductBlueprint,
  journey: ExperienceJourney,
  screenMap: ScreenMap,
  opts: { id?: string; projectId?: string } = {},
): ScreenSpec {
  const spec = emptyScreenSpec(opts);
  spec.sourceBlueprintVersion = blueprint.version;
  spec.sourceJourneyVersion = journey.version;
  spec.sourceScreenMapVersion = screenMap.version;
  spec.generatedFromSignature = screenSpecSignature(blueprint, journey, screenMap);

  spec.screens = screenMap.screens.map((sc, i) => screenSpecInfoFor(sc, i, screenMap, journey));

  const highLeverage = pickScreenSpecDecision(blueprint, journey, screenMap);
  if (highLeverage) spec.unresolvedDecisions = [highLeverage];

  spec.version = 1;
  spec.createdAt = now();
  spec.updatedAt = now();
  return spec;
}

/** 针对界面规格生成最多一个跨界面的高杠杆待决定项；无明确缺口返回 null（不硬凑） */
function pickScreenSpecDecision(
  blueprint: ProductBlueprint,
  journey: ExperienceJourney,
  screenMap: ScreenMap,
): ScreenSpecDecision | null {
  const allScope = [
    ...(blueprint.mvpScope.mustHave ?? []),
    ...(blueprint.mvpScope.shouldHave ?? []),
    ...(blueprint.mvpScope.explicitlyOutOfScope ?? []),
  ].map((x) => x.text).join(" ");
  // 涉及登录/账号/权限 → 高杠杆「首次进入是否登录」决定每个界面的授权状态与主交互
  if (/登录|账号|权限|注册|协作|多用户|降权/i.test(allScope)) {
    return {
      id: stableId("ss_login"),
      question: "首次进入是否需要登录？这决定各界面的授权状态与主交互入口。",
      options: ["先体验再看功能（匿名起步）", "进入即登录", "登录入口放到记录之后"],
      impactNote: "影响多个界面的 permission_required 状态与主交互契约",
    };
  }
  // 否则：把 pivotal moment 的呈现方式作为高杠杆跨界面选择
  const pivot = journey.pivotalMoment;
  if (pivot && pivot.stepId) {
    return {
      id: stableId("ss_pivot"),
      question: `关键时刻应由哪个界面承接、用什么反馈方式让用户感知成功？（成功标准：${pivot.successCriteria}）`,
      options: ["在当前界面内给出明确的成功提示", "跳到专用结果界面", "用轻提示 + 继续引导"],
      impactNote: "决定关键交互与 pivotal moment 的呈现，直接影响核心体验成败",
    };
  }
  const entry = screenMap.screens.find((sc) => sc.type === "page" && (!sc.entryPoints || sc.entryPoints.length === 0));
  if (entry) {
    return {
      id: stableId("ss_entry_view"),
      question: `入口界面「${entry.name}」的第一视角：直接开始，还是先引导选方向？`,
      options: ["直接开始（少一步）", "先引导选择方向（更稳但多一步）"],
      impactNote: "决定入口界面的主交互与首屏信息层级",
    };
  }
  return null;
}

// ───────────────────────── 状态机 / 更新 ─────────────────────────

/** 用户对某个「路径」做局部编辑：写入新值 + 记入 guardedPaths（重建时不被静默覆盖） */
export function updateScreenSpec(spec: ScreenSpec, patch: { path: string; value: string }): ScreenSpec {
  const next = { ...spec, updatedAt: now() };
  setPath(next as unknown as Record<string, unknown>, patch.path, patch.value);
  if (!next.guardedPaths.includes(patch.path)) next.guardedPaths = [...next.guardedPaths, patch.path];
  if (next.status !== "confirmed") next.status = "reviewing";
  return next;
}

/** 把某项高杠杆决策标记为「按假设选择 / 暂缓」（保留条目但记录 chosenHint） */
export function deferScreenSpecDecision(spec: ScreenSpec, decisionId: string, chosenHint: string): ScreenSpec {
  return {
    ...spec,
    unresolvedDecisions: spec.unresolvedDecisions
      .filter((d) => d.id !== decisionId)
      .concat(
        spec.unresolvedDecisions
          .filter((d) => d.id === decisionId)
          .map((d) => ({ ...d, chosenHint: chosenHint || d.chosenHint, impactNote: "已按假设选择，界面原型阶段需验证" })),
      ),
    updatedAt: now(),
  };
}

/** 回答某项高杠杆决策：用户给出明确取舍（移出未决，记 guardedPaths 避免重建回改） */
export function answerScreenSpecDecision(spec: ScreenSpec, decisionId: string, answer: string): ScreenSpec {
  const hints = (spec.unresolvedDecisions.find((d) => d.id === decisionId)?.options ?? []).find((o) => o === answer);
  return {
    ...spec,
    unresolvedDecisions: spec.unresolvedDecisions.filter((d) => d.id !== decisionId),
    guardedPaths: hints ? (spec.guardedPaths.includes("unresolvedDecisions") ? spec.guardedPaths : [...spec.guardedPaths, "unresolvedDecisions"]) : spec.guardedPaths,
    updatedAt: now(),
  };
}

/** 确认界面规格：status=confirmed，接受或带假设继续。 */
export function confirmScreenSpec(spec: ScreenSpec, acceptance: ScreenSpecAcceptance): ScreenSpec {
  const prev: FlattenedPreviousScreenSpec = {
    version: spec.version,
    status: spec.status,
    stale: spec.stale,
    screens: spec.screens,
    unresolvedDecisions: spec.unresolvedDecisions,
    updatedAt: spec.updatedAt,
  };
  return {
    ...spec,
    status: "confirmed",
    acceptance,
    stale: false,
    previousVersion: prev,
    updatedAt: now(),
  };
}

/** 恢复最近有效（前一）版本。 */
export function restorePreviousScreenSpec(spec: ScreenSpec): ScreenSpec | null {
  if (!spec.previousVersion) return null;
  return {
    ...emptyScreenSpec({ id: spec.id, projectId: spec.projectId }),
    ...spec.previousVersion,
    version: spec.version,
    previousVersion: null,
    stale: false,
    sourceBlueprintVersion: spec.sourceBlueprintVersion,
    sourceJourneyVersion: spec.sourceJourneyVersion,
    sourceScreenMapVersion: spec.sourceScreenMapVersion,
    generatedFromSignature: spec.generatedFromSignature,
    createdAt: spec.createdAt,
    updatedAt: now(),
  };
}

/** 版本来源/更新时间记录在 infoLines：便于展示来源与可操作性 */
export function screenSpecInfoLines(spec: ScreenSpec): string[] {
  const lines: string[] = [];
  lines.push(`版本 v${spec.version}`);
  if (spec.sourceScreenMapVersion) lines.push(`源页面结构 v${spec.sourceScreenMapVersion}`);
  if (spec.sourceJourneyVersion) lines.push(`源体验 v${spec.sourceJourneyVersion}`);
  if (spec.sourceBlueprintVersion) lines.push(`源蓝图 v${spec.sourceBlueprintVersion}`);
  lines.push(`状态：${spec.status === "confirmed" ? "已确认" : spec.status === "reviewing" ? "审阅中" : "草稿"}`);
  return lines;
}

// ───────────────────────── 重建 / 冲突保留（reconcile） ─────────────────────────

/**
 * 把重建产出的「下一版」next 与用户手工编辑过的 prev 合并：
 * - prev.guardedPaths 上的路径，若 next 有变化 → 保留 prev 的值，并把该变化记为冲突（进 unresolvedDecisions+lastConflicts）；
 * - 其余取 next。绝不静默覆盖用户手动编辑。
 */
export function reconcileScreenSpec(
  prev: ScreenSpec | null,
  next: ScreenSpec,
): { screenSpec: ScreenSpec; conflicts: string[] } {
  if (!prev) return { screenSpec: next, conflicts: [] };
  const conflicts: string[] = [];
  const merged = cloneScreenSpec(next);
  for (const path of prev.guardedPaths ?? []) {
    const prevVal = getPath(prev, path);
    const nextVal = getPath(merged, path);
    if (typeof prevVal !== "string" || !prevVal.trim()) continue;
    if (typeof nextVal === "string" && nextVal !== prevVal) {
      setPath(merged as unknown as Record<string, unknown>, path, prevVal);
      conflicts.push(path);
    }
  }
  if (conflicts.length) {
    for (const c of conflicts) {
      merged.unresolvedDecisions = [
        ...merged.unresolvedDecisions.filter((d) => d.question !== `「${c}」版本在重建时被改动`),
        {
          id: stableId(`ssconflict_${c}`),
          question: `「${c}」版本在重建时被改动，已保留你手动编辑的版本，请确认取舍。`,
          options: ["保留手动编辑", "采纳最新方案"],
          chosenHint: "保留手动编辑",
          impactNote: "待你决定是否采纳新版表述",
        },
      ];
    }
    merged.lastConflicts = conflicts;
  }
  merged.stale = false;
  merged.version = (prev.version || 0) + 1;
  merged.updatedAt = now();
  merged.previousVersion = {
    version: prev.version,
    status: prev.status,
    stale: false,
    screens: prev.screens,
    unresolvedDecisions: prev.unresolvedDecisions,
    updatedAt: prev.updatedAt,
  };
  return { screenSpec: merged, conflicts };
}