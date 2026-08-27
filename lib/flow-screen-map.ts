// F3-A 页面地图与信息架构：从已确认且未过期的 ProductBlueprint 与 ExperienceJourney
// 收敛为首版 ScreenMap。与 F2-A/F2-B 相同：这一层只含领域类型与纯函数
// （client / server / 离线验证脚本共用），不触碰三栏视觉、不引入服务端依赖、不做数据库改动。
//
// 设计红线（对应 F3-A 需求）：
// - ScreenMap 是「后台可审阅、可追溯」的产品设计产物，不是用户填写的功能表、流程图编辑器或高保真页面；
// - 证据三分类继续严格使用：confirmed / assumption / unresolved，绝不伪造用户已确认事实；
// - 所有有内容的条目必须有来源（journeyStepIds / blueprintPaths / decisionIds），否则只能 assumption/unresolved；
// - 确定性生成的 screen/navigation 初始一律 assumption；
// - Blueprint 或 Journey 版本/签名变化 → ScreenMap 标 stale；
// - 重建 reconcileScreenMap 保留 guardedPaths、冲突进 unresolvedDecisions+lastConflicts，不静默覆盖；
// - 状态机 draft → reviewing → confirmed（confirmed 含「接受」与「带假设继续」两种落点）。

import type { ProductBlueprint } from "./flow-blueprint";
import {
  type ExperienceJourney,
  blueprintJourneySignature,
  hasUsableJourney,
} from "./flow-journey";

export type ScreenMapStatus = "draft" | "reviewing" | "confirmed";
export type ScreenMapEvidence = "confirmed" | "assumption" | "unresolved";
export type ScreenMapAcceptance = "accepted" | "continue_with_assumptions";
export type ScreenType = "page" | "modal" | "drawer" | "embedded_state";
export type ScreenState =
  | "default"
  | "first_use"
  | "empty"
  | "loading"
  | "error"
  | "success"
  | "permission_required";

/** 每项内容的来源：可回指 Journey 步骤 / Blueprint 字段路径 / F1 决策 id */
export interface ScreenMapSource {
  journeyStepIds?: string[];
  blueprintPaths?: string[];
  decisionIds?: string[];
  note?: string;
}

/** 单个界面：谁承载哪些旅程步骤、使命、入口/出口、关键信息与主操作、必要状态 */
export interface ScreenInfo {
  id: string;
  name: string;
  type: ScreenType;
  purpose: string;
  /** 从哪些入口进入；为空表示这是主入口页 */
  entryPoints: string[];
  /** 用户从这里可以退往哪些功能面（展示层文案） */
  exitPaths: string[];
  primaryJourneyStepIds: string[];
  keyInformation: string;
  primaryActions: string[];
  states: ScreenState[];
  evidence: ScreenMapEvidence;
  source: ScreenMapSource;
}

/** 界面间关键跳转 */
export interface ScreenNavigation {
  fromScreenId: string;
  action: string;
  toScreenId: string;
  condition?: string;
}

/** 高杠杆待决定项（规格：最多一个；回答后移出或按假设暂缓） */
export interface ScreenMapDecision {
  id: string;
  question: string;
  options?: string[];
  chosenHint?: string;
  impactNote?: string;
}

/** 仅保留可审计的前一版本最小集，避免快照膨胀 */
export interface FlattenedPreviousScreenMap {
  version: number;
  status: ScreenMapStatus;
  stale: boolean;
  screens: ScreenInfo[];
  navigation: ScreenNavigation[];
  unresolvedDecisions: ScreenMapDecision[];
  updatedAt: number;
}

/** 首版页面地图 */
export interface ScreenMap {
  id: string;
  projectId: string;
  version: number;
  status: ScreenMapStatus;
  stale: boolean;
  acceptance?: ScreenMapAcceptance;
  sourceBlueprintVersion: number;
  sourceJourneyVersion: number;
  /** 生成时 Blueprint+Journey 关键字段签名（用于 stale 判断） */
  generatedFromSignature?: string;
  /** 用户绕过重建做手动编辑的路径（重建不静默覆盖） */
  guardedPaths: string[];
  previousVersion?: FlattenedPreviousScreenMap | null;
  lastConflicts?: string[];

  screens: ScreenInfo[];
  navigation: ScreenNavigation[];
  unresolvedDecisions: ScreenMapDecision[];

  createdAt: number;
  updatedAt: number;
}

export interface ScreenMapReadiness {
  status: ScreenMapStatus;
  /** 独立主页面（type=page）数量 */
  pageCount: number;
  screenCount: number;
  consensusCount: number;
  unresolvedCount: number;
  hasUsableScreenMap: boolean;
  canProceed: boolean;
  acceptance?: ScreenMapAcceptance;
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
  return "sm" + (h >>> 0).toString(36);
}

/** 点路径读写（支持数组下标：screens.0.purpose） */
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

export function cloneScreenMap(sm: ScreenMap): ScreenMap {
  return JSON.parse(JSON.stringify(sm)) as ScreenMap;
}

// ───────────────────────── 空页面地图 ─────────────────────────

export function emptyScreenMap(opts: { id?: string; projectId?: string } = {}): ScreenMap {
  const t = now();
  return {
    id: opts.id || "",
    projectId: opts.projectId || "",
    version: 0,
    status: "draft",
    stale: false,
    sourceBlueprintVersion: 0,
    sourceJourneyVersion: 0,
    guardedPaths: [],
    previousVersion: null,
    screens: [],
    navigation: [],
    unresolvedDecisions: [],
    createdAt: t,
    updatedAt: t,
  };
}

// ───────────────────────── 完成度（纯函数） ─────────────────────────

/** 统计各 section 里 confirmed / assumption / unresolved 的条目数 */
export function countScreenMapEvidence(sm: ScreenMap | null | undefined): { confirmed: number; assumption: number; unresolved: number } {
  if (!sm) return { confirmed: 0, assumption: 0, unresolved: 0 };
  let confirmed = 0;
  let assumption = 0;
  let unresolved = 0;
  const add = (e: ScreenMapEvidence) => {
    if (e === "confirmed") confirmed++;
    else if (e === "assumption") assumption++;
    else unresolved++;
  };
  for (const s of sm.screens) add(s.evidence);
  return { confirmed, assumption, unresolved };
}

/** 所有 Journey 步骤都被某个界面承载 */
export function allJourneyStepsMapped(sm: ScreenMap | null | undefined, journey: ExperienceJourney | null | undefined): boolean {
  if (!sm || !journey) return false;
  const steps = (journey.steps ?? []).filter((s) => s.id);
  if (steps.length === 0) return false;
  const carried = new Set<string>();
  for (const sc of sm.screens) for (const sid of sc.primaryJourneyStepIds ?? []) carried.add(sid);
  return steps.every((s) => carried.has(s.id));
}

/** 从入口出发，navigation 能否遍历到全部界面（即无孤立 screen） */
export function noIsolatedScreens(sm: ScreenMap | null | undefined): boolean {
  if (!sm || sm.screens.length === 0) return false;
  const byId = new Map(sm.screens.map((s) => [s.id, s]));
  const entry = sm.screens
    .filter((s) => s.type === "page" && (!s.entryPoints || s.entryPoints.length === 0))
    .map((s) => s.id);
  if (entry.length === 0) return false;
  const edges = new Map<string, string[]>();
  for (const n of sm.navigation) {
    const list = edges.get(n.fromScreenId) ?? [];
    if (byId.has(n.toScreenId)) list.push(n.toScreenId);
    edges.set(n.fromScreenId, list);
  }
  const visited = new Set<string>();
  const stack = [...entry];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const to of edges.get(cur) ?? []) if (!visited.has(to)) stack.push(to);
  }
  return sm.screens.every((s) => visited.has(s.id));
}

/** 是否已有一份「可用的首版页面地图」：≥1 个 page、screens 非空、全部旅程步骤被映射、导航无孤立 */
export function hasUsableScreenMap(sm: ScreenMap | null | undefined, journey: ExperienceJourney | null | undefined): boolean {
  if (!sm) return false;
  if (sm.version <= 0) return false;
  if (sm.screens.length === 0) return false;
  if (!sm.screens.some((s) => s.type === "page")) return false;
  if (!allJourneyStepsMapped(sm, journey)) return false;
  return noIsolatedScreens(sm);
}

export function getScreenMapReadiness(
  sm: ScreenMap | null | undefined,
  journey: ExperienceJourney | null | undefined,
): ScreenMapReadiness {
  if (!sm) {
    return {
      status: "draft", pageCount: 0, screenCount: 0, consensusCount: 0, unresolvedCount: 0,
      hasUsableScreenMap: false, canProceed: false, reasons: ["尚无页面结构——在核心体验确认后自动生成。"],
    };
  }
  const { confirmed } = countScreenMapEvidence(sm);
  const unresolvedCount = sm.unresolvedDecisions.length;
  const usable = hasUsableScreenMap(sm, journey);
  const confirmedState = sm.status === "confirmed";
  // 规格：canProceed = !stale && hasUsableScreenMap && status===confirmed
  const canProceed = !sm.stale && usable && confirmedState;
  const pageCount = sm.screens.filter((s) => s.type === "page").length;
  const reasons: string[] = [];
  if (sm.stale) reasons.push("产品蓝图或核心体验已更新，请基于最新方案重建页面结构（你的手动修改会被保留，冲突将标为待确认）。");
  if (confirmedState) {
    reasons.push(
      sm.acceptance === "continue_with_assumptions"
        ? `页面结构已带假设确认（仍有 ${unresolvedCount} 项关键选择按假设处理）。`
        : "页面结构已确认，可进入界面落地。",
    );
  } else {
    reasons.push(`页面结构已形成 ${pageCount} 个关键界面 · 仍有 ${unresolvedCount} 项关键选择`);
    if (sm.status === "reviewing") reasons.push("你仍在对页面结构做局部确认或修改，完成后可接受当前结构。");
    if (!usable) reasons.push("页面结构还不够完整——可继续通过访谈补充，或直接带假设推进。");
    if (usable && !confirmedState) reasons.push("已具备可用页面结构，可接受或带假设进入下一步。");
  }
  return {
    status: sm.status,
    pageCount,
    screenCount: sm.screens.length,
    consensusCount: confirmed,
    unresolvedCount,
    hasUsableScreenMap: usable,
    canProceed,
    acceptance: sm.acceptance,
    reasons,
  };
}

// ───────────────────────── 从 Blueprint+Journey 生成首版 ScreenMap ─────────────────────────

/**
 * Blueprint+Journey 关键字段签名：任一被引用字段变化 → 签名变化 → ScreenMap stale。
 * 把蓝图签名（journey 已实现的 blueprintJourneySignature）与旅程步骤签名合并，并在头部压入两份版本号，
 * 使「版本变化」与「内容变化」都能被侦测。
 */
export function screenMapSignature(bp: ProductBlueprint | null | undefined, journey: ExperienceJourney | null | undefined): string {
  const bpPart = bp ? blueprintJourneySignature(bp) : "";
  const stepPart = (journey?.steps ?? [])
    .map((s) => `${s.order}:${s.userGoal}|${s.userAction}|${s.systemBehavior}|${s.visibleOutcome}`)
    .join("\n");
  return `${bp ? bp.version : 0}|${journey ? journey.version : 0}|${bpPart}|${stepPart}`;
}

/** Blueprint 或 Journey 变化 → ScreenMap stale */
export function screenMapChangedSince(
  blueprint: ProductBlueprint | null | undefined,
  journey: ExperienceJourney | null | undefined,
  sm: ScreenMap | null | undefined,
): boolean {
  if (!sm || !blueprint || !journey) return false;
  if (blueprint.version !== sm.sourceBlueprintVersion) return true;
  if (journey.version !== sm.sourceJourneyVersion) return true;
  const cur = screenMapSignature(blueprint, journey);
  if (sm.generatedFromSignature && cur !== sm.generatedFromSignature) return true;
  return false;
}

/** 是否允许初始化 ScreenMap：Blueprint 与 Journey 均 confirmed、未 stale、且可用 */
export function canInitScreenMap(blueprint: ProductBlueprint | null | undefined, journey: ExperienceJourney | null | undefined): boolean {
  return Boolean(
    blueprint &&
      journey &&
      blueprint.status === "confirmed" &&
      !blueprint.stale &&
      journey.status === "confirmed" &&
      !journey.stale &&
      hasUsableJourney(journey),
  );
}

function srcOf(
  journeyStepIds: string[],
  blueprintPaths: string[],
  decisionIds: string[] = [],
  note?: string,
): ScreenMapSource {
  return {
    journeyStepIds: journeyStepIds.filter(Boolean),
    blueprintPaths: blueprintPaths.filter(Boolean),
    decisionIds: decisionIds.filter(Boolean),
    note,
  };
}

const STEP_KW = {
  entry: /进入|起点|启动/,
  record: /记录|导入|录入|片段/,
  refine: /取舍|否决|改写|调整|决定/,
  suggest: /归纳|建议|整理|下一步/,
  done: /结论|离开|保存/,
};

/**
 * 从已确认 Blueprint+Journey 确定性生成首版 ScreenMap。
 * - 对 4–7 个 Journey step 做全量映射；
 * - 尽量收敛为 2–5 个主界面（page）；
 * - 辅助步骤（取舍/改写）优先放入 drawer；
 * - 独立 page 都有「不可被其它页面承担的主任务」理由（purpose）；
 * - 每个 screen 至少一个与职责相关的状态；
 * - 最多一个高杠杆 unresolved decision；
 * - navigation 保证可从入口进入并沿核心闭环完成，无孤立 screen。
 * 所有条目带来源（journeyStepIds/blueprintPaths/decisionIds），证据一律 assumption。
 * 这是无 LLM / 离线时的确定性兜底，也是后续任何 LLM 版输出的结构化基准。
 */
export function screenMapFromBlueprintJourney(
  bp: ProductBlueprint,
  journey: ExperienceJourney,
  opts: { id?: string; projectId?: string } = {},
): ScreenMap {
  const sm = emptyScreenMap(opts);
  sm.sourceBlueprintVersion = bp.version;
  sm.sourceJourneyVersion = journey.version;
  sm.generatedFromSignature = screenMapSignature(bp, journey);

  const steps = (journey.steps ?? []).slice();
  const must = bp.mvpScope.mustHave ?? [];
  const user0 = bp.targetUsers?.[0];
  const decisionIds = (bp.sourceDecisionIds ?? []).filter(Boolean);

  // —— 用关键词把每一步归位（兜底按位置） ——
  const findIdx = (re: RegExp) => steps.findIndex((s) => re.test(s.userGoal || ""));
  let idxEntry = findIdx(STEP_KW.entry);
  let idxRecord = findIdx(STEP_KW.record);
  let idxRefine = findIdx(STEP_KW.refine);
  const idxSuggest = findIdx(STEP_KW.suggest);
  const idxDone = findIdx(STEP_KW.done);
  if (idxEntry < 0) idxEntry = 0;
  if (idxRecord < 0) idxRecord = steps.length > 1 ? 1 : idxEntry;
  // 确保各不相同，避免重叠
  idxRecord = idxRecord === idxEntry ? (steps.length > 1 ? 1 : idxEntry) : idxRecord;
  if (idxRefine < 0 && idxSuggest === idxDone && steps.length > 3) idxRefine = steps.length - 2;
  // 决策页：兜住「得到归纳 / 带走结论」等未被专门承载的步骤
  const pinned = new Set<number>([idxEntry, idxRecord, idxRefine]);
  const decisionStepIdx: number[] = [];
  for (let i = 0; i < steps.length; i++) {
    if (pinned.has(i)) continue;
    decisionStepIdx.push(i);
  }
  const decisionIdsFor = (idx: number) => (idx >= 0 && idx < steps.length ? steps[idx].id : "");

  const screens: ScreenInfo[] = [];

  // [1] 起步页（page）—— 主入口
  const entryStep = steps[idxEntry];
  screens.push({
    id: stableId("screen_entry"),
    name: "起步页",
    type: "page",
    purpose: `承接首次进入：识别「${user0?.persona || entryStep?.userGoal || "首要用户"}」的意图与切入点，不让用户在起点停留。`,
    entryPoints: [],
    exitPaths: ["记录与整理页"],
    primaryJourneyStepIds: [decisionIdsFor(idxEntry)].filter(Boolean),
    keyInformation: "当前场景 / 用户最近一次进度",
    primaryActions: ["开始描述当前的痛点或想法", "选择一个已铺垫的方向"],
    states: ["first_use", "default", "loading", "error"],
    evidence: "assumption",
    source: srcOf([decisionIdsFor(idxEntry)], ["coreLoop.0"], decisionIds, "起步页由进入旅程的第 1 步收敛（AI 归纳）"),
  });

  // [2] 记录与整理页（page）
  const must0 = must[0]?.text;
  screens.push({
    id: stableId("screen_record"),
    name: "记录与整理页",
    type: "page",
    purpose:
      "高频内容录入、去重与自动归类的主阵地——内容一旦落入即被结构化。这是核心高频任务，无法被其它页面承担。",
    entryPoints: ["起步页"],
    exitPaths: ["建议与落定页", "起步页"],
    primaryJourneyStepIds: [decisionIdsFor(idxRecord)].filter(Boolean),
    keyInformation: "已记录条目与归类状态" + (must0 ? `（目标形态：${must0}）` : ""),
    primaryActions: ["录入 / 导入一段内容", "请求自动归纳"],
    states: ["empty", "default", "loading", "success", "error"],
    evidence: "assumption",
    source: srcOf([decisionIdsFor(idxRecord)], ["mvpScope.mustHave.0", "coreLoop.0"], decisionIds, "记录与整理页由记录/导入旅程步骤收敛（AI 归纳）"),
  });

  // [3] 建议与落定页（page）
  const decisionSteps = steps.filter((s, i) => decisionStepIdx.includes(i));
  const suggestStep = decisionStepIdx.includes(idxSuggest) ? steps[idxSuggest] : decisionSteps[0];
  screens.push({
    id: stableId("screen_decision"),
    name: "建议与落定页",
    type: "page",
    purpose:
      "归纳结果出来后，用户在此做出取舍并带走一条明确的下一步——方案落地前的最终决策点，独立承担「给结论、可保存」的主任务。",
    entryPoints: ["记录与整理页"],
    exitPaths: ["记录与整理页", "取舍抽屉"],
    primaryJourneyStepIds: decisionSteps.map((s) => s.id),
    keyInformation: "自动归纳的建议 / 待确认的下一步与成功信号",
    primaryActions: ["查看归纳结论", "采纳 / 保存一条下一步"],
    states: ["default", "loading", "success", "error", "empty"],
    evidence: "assumption",
    source: srcOf(decisionSteps.map((s) => s.id), ["coreLoop.0", "primaryJob"], decisionIds, "建议与落定页由归纳/带走结论旅程步骤收敛（AI 归纳）"),
  });

  // [4] 取舍抽屉（drawer，辅助步骤）
  const hasRefine = idxRefine >= 0 && idxRefine < steps.length && idxRefine !== idxEntry && idxRefine !== idxRecord;
  const refineStep = hasRefine ? steps[idxRefine] : null;
  if (refineStep) {
    screens.push({
      id: stableId("screen_refine"),
      name: "取舍抽屉",
      type: "drawer",
      purpose: `在不离开主帧的情况下让用户采纳 / 改写 / 否决建议${suggestStep ? `（针对「${suggestStep.userGoal}」的结论）` : ""}，保留用户的覆写。`,
      entryPoints: ["建议与落定页"],
      exitPaths: ["建议与落定页"],
      primaryJourneyStepIds: [refineStep.id],
      keyInformation: "当前建议 / 用户已做的取舍",
      primaryActions: ["接受建议", "改写建议", "否决并手写结论"],
      states: ["default", "error"],
      evidence: "assumption",
      source: srcOf([refineStep.id], ["coreLoop.0"], decisionIds, "取舍抽屉由「对结果取舍」旅程步骤收敛，优先放辅助层（AI 归纳）"),
    });
  }

  const entryId = screens[0].id;
  const recordId = screens[1].id;
  const decisionId = screens[2].id;
  const refineId: string = hasRefine ? stableId("screen_refine") : "";

  // —— navigation：保证自入口可沿核心闭环完成、无孤立 ——
  const nav: ScreenNavigation[] = [];
  if (hasRefine) {
    nav.push(
      { fromScreenId: entryId, action: "开始描述 / 选择方向", toScreenId: recordId },
      { fromScreenId: recordId, action: "录入完成后请求归纳", toScreenId: decisionId },
      { fromScreenId: decisionId, action: "对建议做取舍 / 改写", toScreenId: refineId, condition: "用户想调整建议" },
      { fromScreenId: refineId, action: "保存取舍结果", toScreenId: decisionId },
      { fromScreenId: decisionId, action: "返回继续记录", toScreenId: recordId },
      { fromScreenId: recordId, action: "回到起步", toScreenId: entryId },
    );
  } else {
    nav.push(
      { fromScreenId: entryId, action: "开始描述 / 选择方向", toScreenId: recordId },
      { fromScreenId: recordId, action: "录入完成后请求归纳", toScreenId: decisionId },
      { fromScreenId: decisionId, action: "返回继续记录", toScreenId: recordId },
      { fromScreenId: recordId, action: "回到起步", toScreenId: entryId },
    );
  }
  sm.screens = screens;
  sm.navigation = nav;

  // —— 最多一个高杠杆 unresolved decision ——
  const highLeverage = pickScreenMapDecision(bp, journey, sm);
  if (highLeverage) sm.unresolvedDecisions = [highLeverage];

  sm.version = 1;
  sm.createdAt = now();
  sm.updatedAt = now();
  return sm;
}

/** 针对页面地图生成最多一个高杠杆待决定项；无明确缺口返回 null（不硬凑） */
function pickScreenMapDecision(
  bp: ProductBlueprint,
  journey: ExperienceJourney,
  sm: ScreenMap,
): ScreenMapDecision | null {
  const allScope = [
    ...(bp.mvpScope.mustHave ?? []),
    ...(bp.mvpScope.shouldHave ?? []),
    ...(bp.mvpScope.explicitlyOutOfScope ?? []),
  ].map((i) => i.text).join(" ");
  const talksAccount = /登录|账号|权限|注册|协作|多用户|降权/i.test(allScope);
  // 首次进入是否要登录：影响起步页的 permission_required 状态与导航入口（信息架构级的取舍）
  if (talksAccount) {
    return {
      id: stableId("smp_login"),
      question: "首次进入是否需要先登录？这决定起步页是否要放权限拦截。",
      options: ["先体验再看功能（匿名起步）", "进入即登录", "登录入口放到记录页之后"],
      impactNote: "决定起步页的 permission_required 状态与首次旅程的入口结构",
    };
  }
  // 否则把「起步页第一视角」作为高杠杆信息架构选择
  const entry = sm.screens.find((s) => s.type === "page" && (!s.entryPoints || s.entryPoints.length === 0));
  return {
    id: stableId("smp_entry_view"),
    question: `起步页「${entry?.name ?? "首屏"}」的第一视角：让用户直接开始，还是先引导选方向？`,
    options: ["直接开始（少一步）", "先引导选择方向（更稳但多一步）"],
    impactNote: "决定入口导航与首次使用时的步骤数",
  };
}

// ───────────────────────── 状态机 / 更新 ─────────────────────────

/** 用户对某个「路径」做局部编辑：写入新值 + 记入 guardedPaths（重建时不被静默覆盖） */
export function applyScreenMapLocalEdit(sm: ScreenMap, patch: { path: string; value: string }): ScreenMap {
  const next = { ...sm, updatedAt: now() };
  setPath(next as unknown as Record<string, unknown>, patch.path, patch.value);
  if (!next.guardedPaths.includes(patch.path)) next.guardedPaths = [...next.guardedPaths, patch.path];
  if (next.status !== "confirmed") next.status = "reviewing";
  return next;
}

/** 把某项 openDecision 标记为「按假设选择 / 暂缓」 */
export function resolveScreenMapDecision(sm: ScreenMap, decisionId: string, chosenHint: string): ScreenMap {
  return {
    ...sm,
    unresolvedDecisions: sm.unresolvedDecisions
      .filter((d) => d.id !== decisionId)
      .concat(
        sm.unresolvedDecisions
          .filter((d) => d.id === decisionId)
          .map((d) => ({ ...d, chosenHint: chosenHint || d.chosenHint, impactNote: "已按假设选择，界面落地阶段需验证" })),
      ),
    updatedAt: now(),
  };
}

/** 回答 openDecision：用户给出明确取舍（移出未决） */
export function answerScreenMapDecision(sm: ScreenMap, decisionId: string, answer: string): ScreenMap {
  const hints = (sm.unresolvedDecisions.find((d) => d.id === decisionId)?.options ?? []).find((o) => o === answer);
  return {
    ...sm,
    unresolvedDecisions: sm.unresolvedDecisions.filter((d) => d.id !== decisionId),
    guardedPaths: hints ? sm.guardedPaths.includes("unresolvedDecisions") ? sm.guardedPaths : [...sm.guardedPaths, "unresolvedDecisions"] : sm.guardedPaths,
    updatedAt: now(),
  };
}

/** 确认页面地图：status=confirmed，接受或带假设继续。 */
export function confirmScreenMap(sm: ScreenMap, acceptance: ScreenMapAcceptance): ScreenMap {
  const prev: FlattenedPreviousScreenMap = {
    version: sm.version,
    status: sm.status,
    stale: sm.stale,
    screens: sm.screens,
    navigation: sm.navigation,
    unresolvedDecisions: sm.unresolvedDecisions,
    updatedAt: sm.updatedAt,
  };
  return {
    ...sm,
    status: "confirmed",
    acceptance,
    stale: false,
    previousVersion: prev,
    updatedAt: now(),
  };
}

/** 恢复最近有效（前一）版本。 */
export function restorePreviousScreenMap(sm: ScreenMap): ScreenMap | null {
  if (!sm.previousVersion) return null;
  return {
    ...emptyScreenMap({ id: sm.id, projectId: sm.projectId }),
    ...sm.previousVersion,
    version: sm.version,
    previousVersion: null,
    stale: false,
    sourceBlueprintVersion: sm.sourceBlueprintVersion,
    sourceJourneyVersion: sm.sourceJourneyVersion,
    generatedFromSignature: sm.generatedFromSignature,
    createdAt: sm.createdAt,
    updatedAt: now(),
  };
}

/** 版本来源/更新时间记录在 infoLines：便于展示来源与可操作性 */
export function screenMapInfoLines(sm: ScreenMap): string[] {
  const lines: string[] = [];
  lines.push(`版本 v${sm.version}`);
  if (sm.sourceBlueprintVersion) lines.push(`源蓝图 v${sm.sourceBlueprintVersion}`);
  if (sm.sourceJourneyVersion) lines.push(`源体验 v${sm.sourceJourneyVersion}`);
  lines.push(`状态：${sm.status === "confirmed" ? "已确认" : sm.status === "reviewing" ? "审阅中" : "草稿"}`);
  return lines;
}

// ───────────────────────── 重建 / 冲突保留（reconcile） ─────────────────────────

/**
 * 把重建产出的「下一版」next 与用户手工编辑过的 prev 合并：
 * - prev.guardedPaths 上的路径，若 next 有变化 → 保留 prev 的值，并把该变化记为冲突（进 unresolvedDecisions+lastConflicts）；
 * - 其余取 next。绝不静默覆盖用户手动编辑。
 */
export function reconcileScreenMap(prev: ScreenMap | null, next: ScreenMap): { screenMap: ScreenMap; conflicts: string[] } {
  if (!prev) return { screenMap: next, conflicts: [] };
  const conflicts: string[] = [];
  const merged = cloneScreenMap(next);
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
        ...merged.unresolvedDecisions.filter((d) => d.question !== `「${c}」版本在重建时被 AI 改动`),
        {
          id: stableId(`smconflict_${c}`),
          question: `「${c}」版本在重建时被 AI 改动，已保留你手动编辑的版本，请确认取舍。`,
          options: ["保留手动编辑", "采纳最新方案"],
          chosenHint: "保留手动编辑",
          impactNote: "待你决定是否采纳 AI 的新表述",
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
    navigation: prev.navigation,
    unresolvedDecisions: prev.unresolvedDecisions,
    updatedAt: prev.updatedAt,
  };
  return { screenMap: merged, conflicts };
}