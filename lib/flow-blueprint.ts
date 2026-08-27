// F2-A 方案结构化：从产品创意（ProductConceptBrief）收敛为 ProductBlueprint。
// 这一层只含领域类型与纯函数（client / server / 离线验证脚本共用），
// 不触碰三栏视觉、不引入任何服务端依赖、不做任何数据库改动。
//
// 设计红线（对应 F2-A 需求）：
// - Blueprint 是「可审阅、可追溯、可执行」的首版产品蓝图，不是用户逐项填写的表单；
// - 不把 AI 推断伪装成用户确认：confirmed / assumption / unresolved 三类证据必须显式标注；
// - 每一项关键内容都能追溯到 Brief 字段或 decision id（source）；
// - F1-A 决策变化会让 Blueprint 变 stale；重建时保留用户手动编辑，冲突进 unresolved，不静默覆盖；
// - 状态机：draft → reviewing → confirmed（confirmed 含「接受」与「带假设继续」两种落点）。

// ───────────────────────── 类型 ─────────────────────────

import type { ProductConceptBrief } from "./flow-concept";

export type BlueprintStatus = "draft" | "reviewing" | "confirmed";

/** 证据状态：已确认 / AI 推断假设 / 仍需用户选择 */
export type BlueprintEvidence = "confirmed" | "assumption" | "unresolved";

/** 用户对当前蓝图的采纳状态（与概念层一致） */
export type BlueprintAcceptance = "accepted" | "continue_with_assumptions";

/** 每一项关键内容的来源：可回指 Brief 字段或 F1-A decision id */
export interface BlueprintSource {
  decisionIds: string[];
  briefField?: string;
  note?: string;
}

export interface PositionedText {
  text: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

export interface TargetUserGroup {
  id: string;
  persona: string;
  context: string;
  primaryNeed: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

export interface PrimaryJob {
  statement: string;
  successMoment: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

export interface ScopeItem {
  id: string;
  text: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

/** 核心闭环跑图：一条 step 由「动作 + 系统响应 + 用户价值」构成 */
export interface LoopStep {
  id: string;
  step: string;
  userAction: string;
  systemResponse: string;
  userValue: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

export interface AssumptionItem {
  id: string;
  text: string;
  impact: string;
  validationIdea: string;
  status: "assumed" | "being_validated" | "validated" | "rejected";
  source: BlueprintSource;
}

export interface SuccessSignal {
  id: string;
  metric: string;
  target?: string;
  rationale: string;
  evidence: BlueprintEvidence;
  source: BlueprintSource;
}

export interface UnresolvedDecision {
  id: string;
  question: string;
  options?: string[];
  chosenHint?: string;
  impactNote?: string;
}

/** 完整蓝图（顶格字段 + 各 section；可审阅/局部修改/确认） */
export interface ProductBlueprint {
  id: string;
  projectId: string;
  version: number;
  previousVersion?: FlattenedPreviousBlueprint | null;
  status: BlueprintStatus;
  acceptance?: BlueprintAcceptance; // confirmed 后记录落点
  /** F1-A 决策新增/修改后置位；重建后清除 */
  stale: boolean;
  /** 用户做过局部手动编辑的路径集合（重建时这些路径不被静默覆盖） */
  guardedPaths: string[];
  /** 产出的来源概念版本（用于判断 stale） */
  generatedFromConceptVersion?: number;
  /** 生成时 F1-A 关键决策集的签名（决策 id+title 拼接）；null 表示未标 */
  lastConceptSignature?: string;
  /** 最近一次重建产生的冲突提示（已并入 unresolvedDecisions） */
  lastConflicts?: string[];

  productPositioning: PositionedText;
  targetUsers: TargetUserGroup[];
  primaryJob: PrimaryJob;
  mvpScope: { mustHave: ScopeItem[]; shouldHave: ScopeItem[]; explicitlyOutOfScope: ScopeItem[] };
  coreLoop: LoopStep[];
  assumptions: AssumptionItem[];
  successSignals: SuccessSignal[];
  unresolvedDecisions: UnresolvedDecision[];

  /** 整个蓝图的来源：顶部关联的 F1-A decision id 集 */
  sourceDecisionIds: string[];

  createdAt: number;
  updatedAt: number;
}

/** 仅保留可审计的前一版本最小集，避免快照膨胀 */
export interface FlattenedPreviousBlueprint {
  version: number;
  status: BlueprintStatus;
  stale: boolean;
  productPositioning: PositionedText;
  targetUsers: TargetUserGroup[];
  primaryJob: PrimaryJob;
  mvpScope: ProductBlueprint["mvpScope"];
  coreLoop: LoopStep[];
  assumptions: AssumptionItem[];
  successSignals: SuccessSignal[];
  unresolvedDecisions: UnresolvedDecision[];
  updatedAt: number;
}

export interface BlueprintReadiness {
  status: BlueprintStatus;
  /** 已形成共识（confirmed）的条目数 */
  consensusCount: number;
  /** 仍待关键选择 / 未决的数目 */
  unresolvedCount: number;
  /** 是否可确认 / 进入下一步 */
  canProceed: boolean;
  acceptance?: BlueprintAcceptance;
  reasons: string[];
}

/** 构建首版蓝图所需的最小概念输入（结构等价于 ProductConceptBrief 的相关字段） */
export interface BlueprintConceptInput {
  targetUsers: string;
  primaryScenario: string;
  problemStatement: string;
  valueProposition: string;
  coreCapabilities: string[];
  nonGoals: string[];
  successMetrics: string[];
  assumptions: string[];
  openQuestions: string[];
  openCriticalQuestions: string[];
  decisions: { id: string; title: string }[];
  planDraft: string;
}

/** F1-A 决策是否变化（用于判断 Blueprint 是否变 stale）：比较决策集签名 + 概念版本号 */
export function conceptChangedSinceBlueprint(
  concept: Pick<ProductConceptBrief, "decisions" | "version" | "planDraft"> | null | undefined,
  blueprint: ProductBlueprint | null | undefined,
): boolean {
  if (!blueprint || !concept) return false;
  const sig = concept.decisions.map((d) => d.id + "|" + d.title).join("\n");
  if (blueprint.generatedFromConceptVersion !== undefined && concept.version !== blueprint.generatedFromConceptVersion) {
    return true;
  }
  const genSig = (blueprint.lastConceptSignature ?? "");
  if (sig !== genSig) return true;
  return false;
}

// ───────────────────────── 工具 / 路径 ─────────────────────────

function now(): number {
  return Date.now();
}

export function isBlank(s: string | null | undefined): boolean {
  return !s || !s.trim();
}

function srcOf(decisionIds: string[], briefField?: string, note?: string): BlueprintSource {
  return { decisionIds: decisionIds.filter(Boolean), briefField, note };
}

/** 稳定 id：按内容生成短指纹 */
export function stableId(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "bp" + (h >>> 0).toString(36);
}

/** 点路径读写（支持数组下标：targetUsers.0.persona） */
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

// ───────────────────────── 空蓝图 ─────────────────────────

export function emptyBlueprint(opts: { id?: string; projectId?: string } = {}): ProductBlueprint {
  const t = now();
  return {
    id: opts.id || "",
    projectId: opts.projectId || "",
    version: 0,
    previousVersion: null,
    status: "draft",
    stale: false,
    guardedPaths: [],
    productPositioning: emptyText("产品定位"),
    targetUsers: [],
    primaryJob: emptyJob(),
    mvpScope: { mustHave: [], shouldHave: [], explicitlyOutOfScope: [] },
    coreLoop: [],
    assumptions: [],
    successSignals: [],
    unresolvedDecisions: [],
    sourceDecisionIds: [],
    createdAt: t,
    updatedAt: t,
  };
}
function emptyText(label: string): PositionedText {
  return { text: "", evidence: "unresolved", source: { decisionIds: [] } };
}
function emptyJob(): PrimaryJob {
  return { statement: "", successMoment: "", evidence: "unresolved", source: { decisionIds: [] } };
}

// ───────────────────────── 完成度（纯函数） ─────────────────────────

/** 统计各 section 里 confirmed / assumption / unresolved 的条目数 */
export function countBlueprintEvidence(bp: ProductBlueprint): { confirmed: number; assumption: number; unresolved: number } {
  let confirmed = 0;
  let assumption = 0;
  let unresolved = 0;
  const add = (e: BlueprintEvidence) => {
    if (e === "confirmed") confirmed++;
    else if (e === "assumption") assumption++;
    else unresolved++;
  };
  add(bp.productPositioning.evidence);
  for (const g of bp.targetUsers) add(g.evidence);
  add(bp.primaryJob.evidence);
  for (const it of [...bp.mvpScope.mustHave, ...bp.mvpScope.shouldHave, ...bp.mvpScope.explicitlyOutOfScope]) add(it.evidence);
  add(bp.coreLoop.length ? bp.coreLoop[0].evidence : "unresolved");
  for (const s of bp.successSignals) add(s.evidence);
  // assumption 列表计算为「需要验证的假设」数
  confirmed += bp.assumptions.filter((a) => a.status === "validated").length;
  assumption += bp.assumptions.filter((a) => a.status !== "validated").length;
  return { confirmed, assumption, unresolved };
}

export function getBlueprintReadiness(bp: ProductBlueprint | null | undefined): BlueprintReadiness {
  if (!bp) {
    return { status: "draft", consensusCount: 0, unresolvedCount: 0, canProceed: false, reasons: ["尚无产品蓝图——在创意确认后自动生成。"] };
  }
  const { confirmed } = countBlueprintEvidence(bp);
  const unresolvedCount = bp.unresolvedDecisions.length;
  const confirmedState = bp.status === "confirmed";
  // 可进入下一步：已有一份可用初版蓝图且未过期（无论当前是 draft/reviewing 皆可接受；confirmed 视为已完成）
  const usable = hasUsableBlueprint(bp);
  const canProceed = !bp.stale && usable;
  const reasons: string[] = [];
  if (bp.stale) reasons.push("F1-A 有了新的关键决策，需要重新生成蓝图（手动编辑会被保留，冲突将标为待确认）。");
  if (confirmedState) {
    reasons.push(
      bp.acceptance === "continue_with_assumptions"
        ? `蓝图已带假设确认（仍有 ${unresolvedCount} 项关键选择按假设处理）。`
        : "蓝图已确认，可进入方案落地。",
    );
  } else {
    reasons.push(`方案蓝图已形成 ${confirmed} 项共识 · 仍有 ${unresolvedCount} 项关键选择。`);
    if (bp.status === "reviewing") reasons.push("你仍在对蓝图做局部确认或修改，完成后可接受蓝图。");
    if (!usable) reasons.push("蓝图内容还不够完整——可继续通过访谈补充，或直接带假设推进。");
    if (usable && bp.status !== "confirmed") reasons.push("已具备可用首版蓝图，可接受或带假设进入下一步。");
  }
  return {
    status: bp.status,
    consensusCount: confirmed,
    unresolvedCount,
    canProceed,
    acceptance: bp.acceptance,
    reasons,
  };
}

/** 是否已有一份「可用的初版蓝图」（至少产品定位 + 首个用户 + 一条闭环雏形，且非空版本） */
export function hasUsableBlueprint(bp: ProductBlueprint | null | undefined): boolean {
  if (!bp) return false;
  const pos = !isBlank(bp.productPositioning.text);
  const user = bp.targetUsers.some((g) => !isBlank(g.persona));
  const { confirmed, assumption } = countBlueprintEvidence(bp);
  return (pos || user) && (confirmed + assumption) > 0 && bp.version > 0;
}

// ───────────────────────── 从 F1-A 概念构建首版蓝图（启发式，绝不编造） ─────────────────────────

/**
 * 从已确认/可取用初版方案的 ConceptBrief 构建首版 Blueprint。
 * 只把「能从 Brief 明确落定」的内容标为 confirmed/assumption；真的缺的进 unresolvedDecisions，
 * 绝不伪造证据。这是无 API key / LLM 失效时的离线兜底，也是 LLM 输出的结构化基准。
 * 每一项结论都回指 `decisions` 的 id 或 brief 字段（source），保证可追溯。
 */
export function blueprintFromConcept(
  brief: BlueprintConceptInput,
  opts: { id?: string; projectId?: string } = {},
): ProductBlueprint {
  const decisionIds = (brief.decisions ?? []).map((d) => d.id).filter(Boolean);
  const noteOf = (title: string) => `源自已确认决策「${title}」`;
  /** 决策是否确凿落定了某事实（看有没有 decision title 命中关键词） */
  const hasDecisionAbout = (kw: string[]) =>
    (brief.decisions ?? []).some((d) => kw.some((k) => d.title.toLowerCase().includes(k.toLowerCase())));

  const scopeEvidence = (kw: string[]): BlueprintEvidence =>
    hasDecisionAbout(kw) ? "confirmed" : "assumption";
  const makeScopeItem = (text: string, kw: string[]): ScopeItem => ({
    id: stableId(`scope_${text}`),
    text,
    evidence: scopeEvidence(kw),
    source: hasDecisionAbout(kw)
      ? srcOf(decisionIds, undefined, noteOf(kw[0]))
      : srcOf(decisionIds, undefined, hasDecisionKw(brief, kw) ? "根据访谈归纳" : "AI 归纳，待你确认（assumption）"),
  });

  const hasUsers = !isBlank(brief.targetUsers);
  const hasScenario = !isBlank(brief.primaryScenario);
  const hasProblem = !isBlank(brief.problemStatement);
  const usersConfirmed = hasUsers && hasDecisionAbout(["用户", "人群", "target", "persona"]);

  const bp: ProductBlueprint = emptyBlueprint(opts);
  bp.productPositioning = {
    text: hasProblem ? brief.problemStatement : brief.valueProposition || "",
    evidence: hasProblem && hasDecisionAbout(["价值", "问题", "痛点", "问题"]) ? "confirmed" : hasProblem ? "confirmed" : "unresolved",
    source: srcOf(decisionIds, hasProblem ? "problemStatement" : "valueProposition"),
  };

  if (hasUsers) {
    bp.targetUsers = [
      {
        id: stableId("tu_0"),
        persona: brief.targetUsers,
        context: brief.primaryScenario,
        primaryNeed: brief.problemStatement,
        evidence: usersConfirmed ? "confirmed" : "assumption",
        source: srcOf(decisionIds, "targetUsers"),
      },
    ];
  } else {
    bp.unresolvedDecisions.push(probDecision("第一批优先服务的用户是谁？", ["聚焦单一人群", "两三人群并进"], "impactSomeScope"));
  }

  bp.primaryJob = {
    statement: brief.problemStatement || "（待确认：用户最想被完成的核心任务）",
    successMoment: hasScenario ? `在「${brief.primaryScenario}」场景里，用户感到「问题被解决」的时刻` : "",
    evidence: hasProblem ? "confirmed" : "unresolved",
    source: srcOf(decisionIds, "problemStatement"),
  };

  bp.mvpScope = {
    mustHave: brief.coreCapabilities.map((c, i) => ({
      id: stableId(`must_${i}_${c}`),
      text: c,
      evidence: scopeEvidence(["能力", "capabil", "mvp", "核心"]),
      source: srcOf(decisionIds, "coreCapabilities"),
    })),
    shouldHave: [],
    explicitlyOutOfScope: brief.nonGoals.map((n) => makeScopeItem(n, ["不做", "非目标", "暂不", "out of scope"])),
  };

  if (hasDecisionAbout(["闭环", "核心流程", "loop", "回归", "一步"]) || !isBlank(brief.planDraft)) {
    bp.coreLoop = [
      {
        id: stableId("loop_0"),
        step: "首条核心闭环",
        userAction: brief.primaryScenario || "（待确认：用户在该场景下的第一步动作）",
        systemResponse: brief.coreCapabilities[0] || "（待确认：系统如何承接）",
        userValue: brief.valueProposition || "",
        evidence: hasDecisionAbout(["闭环", "核心流程", "loop", "回归"]) ? "confirmed" : "assumption",
        source: srcOf(decisionIds, "primaryScenario"),
      },
    ];
  } else {
    bp.unresolvedDecisions.push(probDecision("第一条最核心的用户闭环是什么？", ["记录 → 归纳 → 交付", "录入 → 分析 → 建议"], "impactScope"));
  }

  bp.successSignals = brief.successMetrics.map((m, i) => ({
    id: stableId(`sig_${i}_${m}`),
    metric: m,
    rationale: "来自访谈或用户自述的成功感受（assumption，需验证）",
    evidence: "assumption",
    target: undefined,
    source: srcOf(decisionIds, "successMetrics"),
  }));

  bp.assumptions = brief.assumptions.map((a, i) => ({
    id: stableId(`asm_${i}_${a}`),
    text: a,
    impact: "可能整体影响首版方案方向",
    validationIdea: "在方案落地阶段通过最小验证确认",
    status: "assumed",
    source: srcOf(decisionIds, "assumptions"),
  }));

  for (const q of brief.openCriticalQuestions ?? []) {
    bp.unresolvedDecisions.push(probDecision(q, undefined, "impactCritical"));
  }
  // 关键未决问题较普通待确认更重要：优先展示（避免重复）
  for (const q of brief.openQuestions ?? []) {
    if (bp.unresolvedDecisions.some((d) => d.question === q)) continue;
    bp.unresolvedDecisions.push(probDecision(q));
  }

  bp.sourceDecisionIds = decisionIds;
  bp.lastConceptSignature = (brief.decisions ?? [])
    .map((d) => d.id + "|" + d.title)
    .join("\n");
  bp.version = 1;
  bp.createdAt = now();
  bp.updatedAt = now();
  return bp;
}

/** 从 ConceptBinaryBrief 直接构建首版蓝图（服务端/前端共用入口） */
export function blueprintFromConceptBrief(
  brief: ProductConceptBrief,
  opts: { id?: string; projectId?: string } = {},
): ProductBlueprint {
  const bp = blueprintFromConcept(
    {
      targetUsers: brief.targetUsers,
      primaryScenario: brief.primaryScenario,
      problemStatement: brief.problemStatement,
      valueProposition: brief.valueProposition,
      coreCapabilities: brief.coreCapabilities,
      nonGoals: brief.nonGoals,
      successMetrics: brief.successMetrics,
      assumptions: brief.assumptions,
      openQuestions: brief.openQuestions,
      openCriticalQuestions: brief.openCriticalQuestions,
      decisions: brief.decisions.map((d) => ({ id: d.id, title: d.title })),
      planDraft: brief.planDraft,
    },
    opts,
  );
  bp.generatedFromConceptVersion = brief.version;
  return bp;
}

function hasDecisionKw(brief: BlueprintConceptInput, kw: string[]): boolean {
  const text = (brief.decisions ?? [])
    .map((d) => d.title)
    .join(" ")
    .toLowerCase();
  return kw.some((k) => text.includes(k.toLowerCase()));
}

function probDecision(question: string, options?: string[], impactNote?: string): UnresolvedDecision {
  return { id: stableId(`ud_${question}`), question, options: options ?? [], impactNote };
}

// ───────────────────────── 状态机 / 更新 ─────────────────────────

/** 用户对某个「路径」做局部编辑：写入新值 + 记入 guardedPaths（重建时不被静默覆盖） */
export function applyBlueprintLocalEdit(bp: ProductBlueprint, patch: { path: string; value: string }): ProductBlueprint {
  const next = { ...bp, updatedAt: now() };
  setPath(next as unknown as Record<string, unknown>, patch.path, patch.value);
  if (!next.guardedPaths.includes(patch.path)) next.guardedPaths = [...next.guardedPaths, patch.path];
  if (next.status !== "confirmed") next.status = "reviewing";
  return next;
}

/** 把某项 unresolved 决策标记为「按假设选择」（用户挑了方向/暂时略过） */
export function resolveBlueprintDecision(bp: ProductBlueprint, decisionId: string, chosenHint: string): ProductBlueprint {
  return {
    ...bp,
    unresolvedDecisions: bp.unresolvedDecisions
      .filter((d) => d.id !== decisionId)
      .concat(
        bp.unresolvedDecisions
          .filter((d) => d.id === decisionId)
          .map((d) => ({ ...d, chosenHint: chosenHint || d.chosenHint, impactNote: "已按假设选择，方案落地阶段需验证" })),
      ),
    updatedAt: now(),
  };
}

/** 确认蓝图：status=confirmed，接受或带假设继续。 */
export function confirmBlueprint(bp: ProductBlueprint, acceptance: BlueprintAcceptance): ProductBlueprint {
  const prev: FlattenedPreviousBlueprint = {
    version: bp.version,
    status: bp.status,
    stale: bp.stale,
    productPositioning: bp.productPositioning,
    targetUsers: bp.targetUsers,
    primaryJob: bp.primaryJob,
    mvpScope: bp.mvpScope,
    coreLoop: bp.coreLoop,
    assumptions: bp.assumptions,
    successSignals: bp.successSignals,
    unresolvedDecisions: bp.unresolvedDecisions,
    updatedAt: bp.updatedAt,
  };
  return {
    ...bp,
    status: "confirmed",
    acceptance,
    stale: false,
    previousVersion: prev,
    updatedAt: now(),
  };
}

/** 恢复最近有效（前一）版本。 */
export function restorePreviousBlueprint(bp: ProductBlueprint): ProductBlueprint | null {
  if (!bp.previousVersion) return null;
  return {
    ...emptyBlueprint({ id: bp.id, projectId: bp.projectId }),
    ...bp.previousVersion,
    version: bp.version, // 保持当前版本号递增空间，previousVersion 另行记录
    previousVersion: null,
    stale: false,
    createdAt: bp.createdAt,
    updatedAt: now(),
  };
}

/** 版本来源/更新时间记录在 infoLines：便于展示「上一版」来源 */
export function blueprintInfoLines(bp: ProductBlueprint): string[] {
  const lines: string[] = [];
  lines.push(`版本 v${bp.version}`);
  if (bp.generatedFromConceptVersion !== undefined) lines.push(`源副概概念 v${bp.generatedFromConceptVersion}`);
  lines.push(`状态：${bp.status === "confirmed" ? "已确认" : bp.status === "reviewing" ? "审阅中" : "草稿"}`);
  return lines;
}

// ───────────────────────── 重建 / 冲突保留（reconcile） ─────────────────────────

/**
 * 把 LLM/启发式产出的「下一版」next 与用户手工编辑过的 prev 合并：
 * - prev.guardedPaths 上的路径，若 next 有变化 → 保留 prev 的值，并把该变化记为冲突（进 unresolvedDecisions）；
 * - 其余取 next。绝不静默覆盖用户手动编辑。
 */
export function reconcileBlueprint(prev: ProductBlueprint | null, next: ProductBlueprint): { blueprint: ProductBlueprint; conflicts: string[] } {
  if (!prev) return { blueprint: next, conflicts: [] };
  const conflicts: string[] = [];
  const merged = cloneBlueprint(next);
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
          id: stableId(`conflict_${c}`),
          question: `「${c}」版本在重建时被 AI 改动，已保留你手动编辑的版本，请确认取舍。`,
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
    productPositioning: prev.productPositioning,
    targetUsers: prev.targetUsers,
    primaryJob: prev.primaryJob,
    mvpScope: prev.mvpScope,
    coreLoop: prev.coreLoop,
    assumptions: prev.assumptions,
    successSignals: prev.successSignals,
    unresolvedDecisions: prev.unresolvedDecisions,
    updatedAt: prev.updatedAt,
  };
  return { blueprint: merged, conflicts };
}

export function cloneBlueprint(bp: ProductBlueprint): ProductBlueprint {
  return JSON.parse(JSON.stringify(bp)) as ProductBlueprint;
}