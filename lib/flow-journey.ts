// F2-B 核心用户旅程与关键场景收敛：从已确认的 ProductBlueprint 收敛为 ExperienceJourney。
// 与 F2-A 相同：这一层只含领域类型与纯函数（client / server / 离线验证脚本共用），
// 不触碰三栏视觉、不引入任何服务端依赖、不做任何数据库改动。
//
// 设计红线（对应 F2-B 需求）：
// - Journey 是「后台可审阅、可追溯」的核心体验，不是用户填写的表单或流程图编辑器；
// - 证据三分类继续严格使用：confirmed / assumption / unresolved，绝不伪造用户已确认事实；
// - 所有条目必须提供来源：Blueprint path，或 F1-A decision id；无可靠来源只标 assumption/unresolved；
// - Blueprint 版本/签名/引用字段变化 → Journey 标 stale；
// - 重建 reconcileJourney 保留 guardedPaths、冲突进 openDecisions+lastConflicts，不静默覆盖；
// - 状态机 draft → reviewing → confirmed（confirmed 含「接受」与「带假设继续」两种落点）。

import type { ProductBlueprint } from "./flow-blueprint";

export type JourneyStatus = "draft" | "reviewing" | "confirmed";
export type JourneyEvidence = "confirmed" | "assumption" | "unresolved";
export type JourneyAcceptance = "accepted" | "continue_with_assumptions";

/** 每项内容的来源：可回指 Blueprint 的字段路径，或 F1-A decision id */
export interface JourneySource {
  blueprintPath?: string;
  decisionIds?: string[];
  note?: string;
}

/** 首要场景：谁、在什么触发下、期待什么结果 */
export interface JourneyScenario {
  title: string;
  user: string;
  trigger: string;
  desiredOutcome: string;
  evidence: JourneyEvidence;
  source: JourneySource;
}

/** 用户旅程的一步：目标 / 动作 / 系统行为 / 可见结果 /（可选的摩擦或风险） */
export interface JourneyStep {
  id: string;
  order: number;
  userGoal: string;
  userAction: string;
  systemBehavior: string;
  visibleOutcome: string;
  frictionOrRisk?: string;
  evidence: JourneyEvidence;
  source: JourneySource;
}

/** 关键时刻：旅程里决定成败的那一步与验证标准 */
export interface PivotalMoment {
  stepId: string;
  rationale: string;
  successCriteria: string;
  evidence: JourneyEvidence;
  source: JourneySource;
}

/** 与核心旅程直接相关的边界 / 异常状态（trigger → 系统响应 → 用户恢复） */
export interface EdgeCase {
  id: string;
  trigger: string;
  systemResponse: string;
  userRecovery: string;
  priority: "high" | "medium" | "low";
  evidence: JourneyEvidence;
  source: JourneySource;
}

/** 高杠杆待决定项（规格：最多一个；回答后从 openDecisions 移除或标为按假设选择） */
export interface JourneyOpenDecision {
  id: string;
  question: string;
  options?: string[];
  impactNote?: string;
  chosenHint?: string;
}

/** 完整体验旅程 */
export interface ExperienceJourney {
  id: string;
  projectId: string;
  version: number;
  status: JourneyStatus;
  stale: boolean;
  acceptance?: JourneyAcceptance; // confirmed 后记录落点
  /** 来源于蓝图的版本号（用于 stale 判断） */
  sourceBlueprintVersion: number;
  /** 生成时蓝色图关键字段签名（用于 stale 判断） */
  generatedFromBlueprintSignature?: string;
  /** 用户绕过重建做手动编辑的路径（重建不静默覆盖） */
  guardedPaths: string[];
  previousVersion?: FlattenedPreviousJourney | null;

  primaryScenario: JourneyScenario;
  steps: JourneyStep[];
  pivotalMoment: PivotalMoment | null;
  edgeCases: EdgeCase[];
  openDecisions: JourneyOpenDecision[];
  lastConflicts?: string[];

  createdAt: number;
  updatedAt: number;
}

/** 仅保留可审计的前一版本最小集，避免快照膨胀 */
export interface FlattenedPreviousJourney {
  version: number;
  status: JourneyStatus;
  stale: boolean;
  primaryScenario: JourneyScenario;
  steps: JourneyStep[];
  pivotalMoment: PivotalMoment | null;
  edgeCases: EdgeCase[];
  openDecisions: JourneyOpenDecision[];
  updatedAt: number;
}

export interface JourneyReadiness {
  status: JourneyStatus;
  stepCount: number;
  consensusCount: number;
  unresolvedCount: number;
  hasUsableJourney: boolean;
  canProceed: boolean;
  acceptance?: JourneyAcceptance;
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
  return "j" + (h >>> 0).toString(36);
}

/** 点路径读写（支持数组下标：steps.0.userGoal） */
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

export function cloneJourney(j: ExperienceJourney): ExperienceJourney {
  return JSON.parse(JSON.stringify(j)) as ExperienceJourney;
}

// ───────────────────────── 空旅程 ─────────────────────────

export function emptyJourney(opts: { id?: string; projectId?: string } = {}): ExperienceJourney {
  const t = now();
  return {
    id: opts.id || "",
    projectId: opts.projectId || "",
    version: 0,
    status: "draft",
    stale: false,
    sourceBlueprintVersion: 0,
    guardedPaths: [],
    previousVersion: null,
    primaryScenario: emptyScenario(),
    steps: [],
    pivotalMoment: null,
    edgeCases: [],
    openDecisions: [],
    createdAt: t,
    updatedAt: t,
  };
}
function emptyScenario(): JourneyScenario {
  return { title: "", user: "", trigger: "", desiredOutcome: "", evidence: "unresolved", source: {} };
}

// ───────────────────────── 完成度（纯函数） ─────────────────────────

/** 统计各 section 里 confirmed / assumption / unresolved 的条目数 */
export function countJourneyEvidence(j: ExperienceJourney | null | undefined): { confirmed: number; assumption: number; unresolved: number } {
  if (!j) return { confirmed: 0, assumption: 0, unresolved: 0 };
  let confirmed = 0;
  let assumption = 0;
  let unresolved = 0;
  const add = (e: JourneyEvidence) => {
    if (e === "confirmed") confirmed++;
    else if (e === "assumption") assumption++;
    else unresolved++;
  };
  add(j.primaryScenario.evidence);
  for (const s of j.steps) add(s.evidence);
  if (j.pivotalMoment) add(j.pivotalMoment.evidence);
  for (const e of j.edgeCases) add(e.evidence);
  return { confirmed, assumption, unresolved };
}

/** 是否已有一份「可用的初版体验旅程」：有首要场景、≥3 步、存在 pivotalMoment，且非空版本 */
export function hasUsableJourney(j: ExperienceJourney | null | undefined): boolean {
  if (!j) return false;
  if (j.version <= 0) return false;
  const hasScenario = !isBlank(j.primaryScenario.title) && !isBlank(j.primaryScenario.user);
  const hasSteps = (j.steps ?? []).filter((s) => s.userAction && s.userGoal).length >= 3;
  const hasPivot = Boolean(j.pivotalMoment && j.pivotalMoment.stepId);
  return hasScenario && hasSteps && hasPivot;
}

export function getJourneyReadiness(j: ExperienceJourney | null | undefined): JourneyReadiness {
  if (!j) {
    return {
      status: "draft", stepCount: 0, consensusCount: 0, unresolvedCount: 0,
      hasUsableJourney: false, canProceed: false, reasons: ["尚无体验旅程——在蓝图确认后自动生成。"],
    };
  }
  const { confirmed } = countJourneyEvidence(j);
  const unresolvedCount = j.openDecisions.length;
  const usable = hasUsableJourney(j);
  const confirmedState = j.status === "confirmed";
  // 规格：canProceed = !stale && hasUsableJourney && status===confirmed
  const canProceed = !j.stale && usable && confirmedState;
  const reasons: string[] = [];
  if (j.stale) reasons.push("产品蓝图已更新，请基于最新方案重建体验旅程（你的手动修改会被保留，冲突将标为待确认）。");
  if (confirmedState) {
    reasons.push(
      j.acceptance === "continue_with_assumptions"
        ? `旅程已带假设确认（仍有 ${unresolvedCount} 项关键选择按假设处理）。`
        : "体验旅程已确认，可进入方案落地。",
    );
  } else {
    reasons.push(`核心体验已形成 ${j.steps.length} 个步骤 · 仍有 ${unresolvedCount} 项关键选择`);
    if (j.status === "reviewing") reasons.push("你仍在对旅程做局部确认或修改，完成后可接受体验旅程。");
    if (!usable) reasons.push("旅程内容还不够完整——可继续通过访谈补充，或直接带假设推进。");
    if (usable && !confirmedState) reasons.push("已具备可用体验旅程，可接受或带假设进入下一步。");
  }
  return {
    status: j.status,
    stepCount: j.steps.length,
    consensusCount: confirmed,
    unresolvedCount,
    hasUsableJourney: usable,
    canProceed,
    acceptance: j.acceptance,
    reasons,
  };
}

// ───────────────────────── 从 Blueprint 生成首版旅程（启发式，绝不编造） ─────────────────────────

/** 蓝图像关键字段的签名：任一被引用的字段变化 → 签名变化 → Journey stale */
export function blueprintJourneySignature(bp: ProductBlueprint): string {
  const sc = bp.coreLoop.map((s) => [s.step, s.userAction, s.systemResponse, s.userValue]);
  const mvp = {
    must: bp.mvpScope.mustHave.map((m) => m.text),
    out: bp.mvpScope.explicitlyOutOfScope.map((o) => o.text),
  };
  const tu = bp.targetUsers.map((g) => [g.persona, g.context, g.primaryNeed]);
  const pay = [bp.primaryJob.statement, bp.primaryJob.successMoment];
  const sig = [JSON.stringify(sc), JSON.stringify(mvp), JSON.stringify(tu), JSON.stringify(pay), bp.productPositioning.text];
  return sig.join("|");
}

/** Blueprint 是否变化（用于 stale）：版本不同或签名不同 */
export function blueprintChangedSinceJourney(
  blueprint: ProductBlueprint | null | undefined,
  journey: ExperienceJourney | null | undefined,
): boolean {
  if (!journey || !blueprint) return false;
  if (blueprint.version !== journey.sourceBlueprintVersion) return true;
  const sig = blueprintJourneySignature(blueprint);
  if (journey.generatedFromBlueprintSignature && sig !== journey.generatedFromBlueprintSignature) return true;
  return false;
}

/** 是否允许初始化 Journey：BlueBlueprint 已可用、status=confirmed、stale=false */
export function canInitJourney(blueprint: ProductBlueprint | null | undefined): boolean {
  return Boolean(blueprint && blueprint.status === "confirmed" && !blueprint.stale && hasUsableJourneyBlueprint(blueprint));
}

function hasUsableJourneyBlueprint(bp: ProductBlueprint): boolean {
  const pos = !isBlank(bp.productPositioning.text);
  const user = bp.targetUsers.some((g) => !isBlank(g.persona));
  const loop = bp.coreLoop.some((s) => !isBlank(s.userAction) && !isBlank(s.userValue));
  return (pos || user || loop);
}

function srcBlue(bp: ProductBlueprint, path: string, note?: string): JourneySource {
  return { blueprintPath: path, note };
}

/**
 * 从已确认 Blueprint 确定性生成首版 ExperienceJourney。
 * 所有条目都带 blueprintPath / note 来源；证据多为 assumption（对 Blueprint 的展开与归纳），
 * 只有在能从蓝图像直接映射为「用户已确认」时才标 confirmed——本实现不做这种假设，统一 assumption。
 * 这是无 LLM / 离线时的确定性兜底，也是后续任何 LLM 版输出的结构化基准。
 */
export function journeyFromBlueprint(
  bp: ProductBlueprint,
  opts: { id?: string; projectId?: string } = {},
): ExperienceJourney {
  const pb = blueprintJourneySignature(bp);
  const j: ExperienceJourney = emptyJourney(opts);
  j.sourceBlueprintVersion = bp.version;
  j.generatedFromBlueprintSignature = pb;

  const user0 = bp.targetUsers[0];
  const loop0 = bp.coreLoop[0];
  const must = bp.mvpScope.mustHave ?? [];
  const out = bp.mvpScope.explicitlyOutOfScope ?? [];

  // —— 首要场景 ——
  j.primaryScenario = {
    title: loop0?.step && !isBlank(loop0.step) && loop0.step !== "首条核心闭环" ? loop0.step : "核心体验起点",
    user: user0?.persona || bp.primaryJob.statement || "（待确认：首批用户）",
    trigger: loop0?.userAction || "用户带着零散想法/痛点进入产品",
    desiredOutcome: loop0?.userValue || bp.primaryJob.successMoment || bp.productPositioning.text || "用户感到核心问题被解决",
    evidence: "assumption",
    source: srcBlue(bp, loop0 ? "coreLoop.0" : "primaryScenario", "由已确认蓝图的首条闭环/首要场景收敛"),
  };

  // —— 4–7 个顺序步骤（围绕首条闭环 + MVP 必须有展开）——
  const stepTemplates: Array<{
    userGoal: string;
    userAction: string;
    systemBehavior: string;
    visibleOutcome: string;
    frictionOrRisk?: string;
    ref: string;
  }> = [
    {
      userGoal: `进入 ${user0?.persona || "首要用户"} 的${loop0?.step || "核心"}旅程`,
      userAction: loop0?.userAction || "打开产品，描述当前的痛点或想法",
      systemBehavior: "识别用户意图并承接内容（如已选方向则直接进入场景）",
      visibleOutcome: "看到一份可继续的整理会话",
      frictionOrRisk: "首次使用场景不清时，用户可能不知从哪开始",
      ref: "coreLoop.0",
    },
    {
      userGoal: "快速记录 / 导入零散内容",
      userAction: "录入一段想法、纪要或片段",
      systemBehavior: "自动结构化、去重并归类",
      visibleOutcome: must[0]?.text ? `内容被整理为「${must[0].text}」对应的可读条目` : "内容被整理为可读条目",
      frictionOrRisk: "输入过于杂乱时可能打断节奏",
      ref: must[0] ? "mvpScope.mustHave.0" : "coreLoop.0",
    },
    {
      userGoal: "得到自动归纳，而非人工整理",
      userAction: "请求归纳 / 延续整理",
      systemBehavior: "生成核心建议与下一步引导",
      visibleOutcome: "看到一条可直接执行的建议与后续步骤",
      ref: must[1] ? "mvpScope.mustHave.1" : must[0] ? "mvpScope.mustHave.0" : "coreLoop.0",
    },
    {
      userGoal: "对结果做取舍，落到可取决定",
      userAction: "接受建议，或手动改写 / 否决",
      systemBehavior: "保留用户的覆写，并把矛盾记录为偏好差异",
      visibleOutcome: "结果最终反映用户的决定",
      frictionOrRisk: "用户完全否定建议时需有落点",
      ref: "primaryJob",
    },
    {
      userGoal: "带着一个明确结论离开本次会话",
      userAction: "查看本次整理产物并保存",
      systemBehavior: "沉淀为可复用的方案 / 记录下次复习点",
      visibleOutcome: "用户带走一条清晰的下一步",
      ref: "primaryJob",
    },
  ];

  // 依据 MVP 规模控制步骤数：mustHave 多则铺满 5 步；不足则收敛到 4 步避免冗余
  const count = Math.min(5, Math.max(4, 3 + (must.length > 0 ? 1 : 0)));
  j.steps = stepTemplates.slice(0, count).map((t, i) => ({
    id: stableId(`jstep_${i}_${t.userGoal}`),
    order: i + 1,
    userGoal: t.userGoal,
    userAction: t.userAction,
    systemBehavior: t.systemBehavior,
    visibleOutcome: t.visibleOutcome,
    frictionOrRisk: t.frictionOrRisk,
    evidence: "assumption",
    source: srcBlue(bp, t.ref, `第 ${i + 1} 步 · 由蓝图像 ${t.ref} 展开（AI 归纳）`),
  }));

  // —— 关键时刻（pivotalMoment） ——
  j.pivotalMoment = {
    stepId: j.steps[Math.min(2, j.steps.length - 1)]?.id ?? "",
    rationale: "用户在此刻首次感到「问题被真正解决」——从被动记录转为主动得到一个可执行的结论",
    successCriteria: "用户不再需要人工整理，能直接采纳/落定一条下一步",
    evidence: "assumption",
    source: srcBlue(bp, "primaryJob", "关键时刻推断，需在方案落地阶段验证"),
  };

  // —— 与核心旅程直接相关的 3–5 个边界状态 ——
  const edgeTemplates: Array<{
    trigger: string;
    systemResponse: string;
    userRecovery: string;
    priority: "high" | "medium" | "low";
  }> = [
    { trigger: "用户在归纳完成前退出 / 中途离开", systemResponse: "自动保存草稿进度，重启后继续", userRecovery: "下次进入时提示「继续上次整理」", priority: "high" },
    { trigger: "输入内容过于杂乱，无法理解", systemResponse: "不强行归纳，改为澄清式追问", userRecovery: "用户补充信息或调整输入后再归纳", priority: "high" },
    { trigger: "系统建议与用户判断冲突 / 被完全否定", systemResponse: "保留用户覆写并记录偏好差异，不自动覆盖", userRecovery: "用户手写自己的结论并保存", priority: "medium" },
    { trigger: "相同内容被重复录入", systemResponse: "自动去重，并在结果中标明合并来源", userRecovery: "用户可展开查看重复项并决定保留", priority: "medium" },
    { trigger: "AI / 服务暂时不可用", systemResponse: "本地保留已录入内容与草稿，不丢数据", userRecovery: "恢复后自动重试归纳并提示用户复核", priority: "low" },
  ];
  j.edgeCases = edgeTemplates.slice(0, Math.min(5, Math.max(3, j.steps.length))).map((e, i) => ({
    id: stableId(`jedge_${i}_${e.trigger}`),
    trigger: e.trigger,
    systemResponse: e.systemResponse,
    userRecovery: e.userRecovery,
    priority: e.priority,
    evidence: "assumption",
    source: srcBlue(bp, out[i] ? `mvpScope.explicitlyOutOfScope.${i}` : "coreLoop.0", "边界状态由核心旅程推断（AI 归纳）"),
  }));

  // —— 最多一个高杠杆 openDecision ——
  const highLeverage = pickJourneyDecision(bp, j);
  if (highLeverage) j.openDecisions = [highLeverage];

  j.version = 1;
  j.createdAt = now();
  j.updatedAt = now();
  return j;
}

/** 针对旅程生成最多一个高杠杆待决定事项；无明确缺口则返回 null（不硬凑） */
function pickJourneyDecision(bp: ProductBlueprint, j: ExperienceJourney): JourneyOpenDecision | null {
  // 若蓝图像尚无可用成功信号 → 首要高杠杆缺口是「怎么证明旅程成功」
  if (!bp.successSignals?.length) {
    return {
      id: stableId("jd_success"),
      question: "这条核心旅程怎么算成功？需要一个可观测的成功信号。",
      options: ["用完成率/留存这类行为指标", "用用户自己描述的成功感受"],
      impactNote: "影响关键时刻的验收标准与后续产品验证方向",
    };
  }
  // 否则把「哪一步最可能让用户流失」作为高杠杆选择
  const withFriction = j.steps.find((s) => s.frictionOrRisk);
  if (withFriction) {
    return {
      id: stableId(`jd_friction_${withFriction.id}`),
      question: `在第 ${withFriction.order} 步「${withFriction.userGoal}」潜在卡点，优先投入哪种兜底？`,
      options: ["先做最重的错误恢复提示", "先收敛操作，减少这一步的步骤", "先验证卡点是否真实存在"],
      impactNote: "决定 MVP 内对这条闭环的投入优先级",
    };
  }
  return null;
}

// ───────────────────────── 状态机 / 更新 ─────────────────────────

/** 用户对某个「路径」做局部编辑：写入新值 + 记入 guardedPaths（重建时不被静默覆盖） */
export function applyJourneyLocalEdit(j: ExperienceJourney, patch: { path: string; value: string }): ExperienceJourney {
  const next = { ...j, updatedAt: now() };
  setPath(next as unknown as Record<string, unknown>, patch.path, patch.value);
  if (!next.guardedPaths.includes(patch.path)) next.guardedPaths = [...next.guardedPaths, patch.path];
  if (next.status !== "confirmed") next.status = "reviewing";
  return next;
}

/** 把某项 openDecision 标记为「按假设选择 / 暂缓」（保留条目但记录 chosenHint） */
export function resolveJourneyDecision(j: ExperienceJourney, decisionId: string, chosenHint: string): ExperienceJourney {
  return {
    ...j,
    openDecisions: j.openDecisions
      .filter((d) => d.id !== decisionId)
      .concat(
        j.openDecisions
          .filter((d) => d.id === decisionId)
          .map((d) => ({ ...d, chosenHint: chosenHint || d.chosenHint, impactNote: "已按假设选择，方案落地阶段需验证" })),
      ),
    updatedAt: now(),
  };
}

/** 回答 openDecision：用户给出明确取舍（移出 openDecisions，冲突处理内不再作为未决） */
export function answerJourneyDecision(j: ExperienceJourney, decisionId: string, answer: string): ExperienceJourney {
  const hints = (j.openDecisions.find((d) => d.id === decisionId)?.options ?? []).find((o) => o === answer);
  return {
    ...j,
    openDecisions: j.openDecisions
      .filter((d) => d.id !== decisionId)
      .map((d) => d), // 原样保留其余未决
    // 已答决策以 chosenHint 落底（进入 guardedPaths 视野，避免重建静默改回）
    guardedPaths: hints ? j.guardedPaths.includes("openDecisions") ? j.guardedPaths : [...j.guardedPaths, "openDecisions"] : j.guardedPaths,
    updatedAt: now(),
  };
}

/** 确认旅程：status=confirmed，接受或带假设继续。 */
export function confirmJourney(j: ExperienceJourney, acceptance: JourneyAcceptance): ExperienceJourney {
  const prev: FlattenedPreviousJourney = {
    version: j.version,
    status: j.status,
    stale: j.stale,
    primaryScenario: j.primaryScenario,
    steps: j.steps,
    pivotalMoment: j.pivotalMoment,
    edgeCases: j.edgeCases,
    openDecisions: j.openDecisions,
    updatedAt: j.updatedAt,
  };
  return {
    ...j,
    status: "confirmed",
    acceptance,
    stale: false,
    previousVersion: prev,
    updatedAt: now(),
  };
}

/** 恢复最近有效（前一）版本。 */
export function restorePreviousJourney(j: ExperienceJourney): ExperienceJourney | null {
  if (!j.previousVersion) return null;
  return {
    ...emptyJourney({ id: j.id, projectId: j.projectId }),
    ...j.previousVersion,
    version: j.version,
    previousVersion: null,
    stale: false,
    sourceBlueprintVersion: j.sourceBlueprintVersion,
    generatedFromBlueprintSignature: j.generatedFromBlueprintSignature,
    createdAt: j.createdAt,
    updatedAt: now(),
  };
}

/** 版本来源/更新时间记录在 infoLines：便于展示来源与可操作性 */
export function journeyInfoLines(j: ExperienceJourney): string[] {
  const lines: string[] = [];
  lines.push(`版本 v${j.version}`);
  if (j.sourceBlueprintVersion) lines.push(`源蓝图 v${j.sourceBlueprintVersion}`);
  lines.push(`状态：${j.status === "confirmed" ? "已确认" : j.status === "reviewing" ? "审阅中" : "草稿"}`);
  return lines;
}

// ───────────────────────── 重建 / 冲突保留（reconcile） ─────────────────────────

/**
 * 把重建产出的「下一版」next 与用户手工编辑过的 prev 合并：
 * - prev.guardedPaths 上的路径，若 next 有变化 → 保留 prev 的值，并把该变化记为冲突（进 openDecisions+lastConflicts）；
 * - 其余取 next。绝不静默覆盖用户手动编辑。
 */
export function reconcileJourney(prev: ExperienceJourney | null, next: ExperienceJourney): { journey: ExperienceJourney; conflicts: string[] } {
  if (!prev) return { journey: next, conflicts: [] };
  const conflicts: string[] = [];
  const merged = cloneJourney(next);
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
      merged.openDecisions = [
        ...merged.openDecisions.filter((d) => d.question !== `「${c}」版本在重建时被 AI 改动`),
        {
          id: stableId(`jconflict_${c}`),
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
    primaryScenario: prev.primaryScenario,
    steps: prev.steps,
    pivotalMoment: prev.pivotalMoment,
    edgeCases: prev.edgeCases,
    openDecisions: prev.openDecisions,
    updatedAt: prev.updatedAt,
  };
  return { journey: merged, conflicts };
}