// F1-A 产品创意 Brief：把「访谈对话」收敛为一张聚焦的产品定义卡片 + 阶段完成度。
// 这一层只含领域类型与纯函数（client / server / 离线验证脚本共用），
// 不触碰三栏视觉架构、不引入任何服务端依赖。

// ───────────────────────── 类型 ─────────────────────────

export type ConceptBriefStatus = "draft" | "confirmed";

/** 用户对当前初版方案的采纳状态：尚未表态 / 已接受 / 带假设继续 */
export type ConceptAcceptance = "pending" | "accepted" | "continue_with_assumptions";

/** 每轮访谈沉淀的一条关键决策（用户结论 / 方向选择 / 采纳的专家建议） */
export interface ConceptDecision {
  id: string;
  title: string;
  detail: string;
  /** epoch ms */
  at: number;
}

/** Brief 证据来源：能够回指到对应的用户输入或已确认结论 */
export type ConceptEvidenceSource =
  | "idea" // 用户原始产品想法
  | "interview" // 用户已提交的访谈回答
  | "direction" // 已确认的方向选择
  | "manual" // 用户手动编辑/确认
  | "ai"; // AI 从既有材料归纳（管理用途，无独立事实）

export interface ConceptEvidence {
  source: ConceptEvidenceSource;
  /** 标识用的是哪条输入（如访谈消息序号 / 方向 id / 手动编辑），无强约定 */
  refId?: string;
  /** 简短证据说明，便于回到具体出处 */
  note?: string;
  /** epoch ms */
  at: number;
}

export type ConceptEvidenceRefs = Partial<
  Record<ConceptFieldKey, ConceptEvidence[]>
>;

/** 可被 AI 更新 / 用户确认的产品定义字段（与 readiness 必填项、confirmedFields 对齐） */
export type ConceptFieldKey =
  | "productName"
  | "oneLiner"
  | "targetUsers"
  | "primaryScenario"
  | "problemStatement"
  | "valueProposition"
  | "coreCapabilities"
  | "nonGoals"
  | "successMetrics"
  | "assumptions";

/** 必填字段（能否进入方案落地的最小集） */
export const CONCEPT_REQUIRED_FIELDS: ConceptFieldKey[] = [
  "targetUsers",
  "primaryScenario",
  "problemStatement",
  "valueProposition",
  "coreCapabilities",
];

/** 可选但建议补全的字段 */
export const CONCEPT_OPTIONAL_FIELDS: ConceptFieldKey[] = [
  "productName",
  "oneLiner",
  "nonGoals",
  "successMetrics",
  "assumptions",
];

/**
 * 产品创意 Brief：产品定义层的一张卡片。
 * 刻意不含技术栈 / 数据库 / 框架 / 部署 —— 那些是 F2 方案落地层的事。
 */
export interface ProductConceptBrief {
  id: string;
  projectId: string;
  version: number;
  status: ConceptBriefStatus;
  /** 确认/冻结时的版本号；确认后 AI 不再覆盖必填字段 */
  frozenVersion?: number;
  /** 前一版本快照（仅保留紧邻上一版，供审计；不做完整历史浏览） */
  previousBrief?: FlattenedPreviousBrief | null;

  // —— 产品定义（可为空的字段用空串 / 空数组表示未定，空值进入 openQuestions）——
  productName: string;
  oneLiner: string;
  targetUsers: string;
  primaryScenario: string;
  problemStatement: string;
  valueProposition: string;
  coreCapabilities: string[];
  nonGoals: string[];
  successMetrics: string[];
  assumptions: string[];

  /** 待确认事项：缺失 / 未定的产品定义缺口（不用泛泛假设填满） */
  openQuestions: string[];

  /** 会改变首版方向的关键未决问题（readiness 的重要否决因子） */
  openCriticalQuestions: string[];

  /** 每轮访谈沉淀的关键决策（本轮更新 / 方向选择 / 采纳建议） */
  decisions: ConceptDecision[];

  /** 当前正在讨论的议题（轻量过程状态展示用） */
  currentTopic: string;

  /** 可读的初版产品方案 / PRD 初稿（随访谈逐步生成，非用户逐项填写的表单） */
  planDraft: string;

  /** planDraft 最近一次落定的时间 */
  planUpdatedAt?: number;

  /** 用户对当前初版方案的采纳状态 */
  acceptance: ConceptAcceptance;

  /** 用户手动编辑 / 明确确认过的字段；AI 更新不得覆盖这些字段 */
  confirmedFields: ConceptFieldKey[];

  /** 每个已填产品定义字段可回溯到哪条输入 / 结论 */
  evidenceRefs: ConceptEvidenceRefs;

  createdAt: number;
  updatedAt: number;
}

/** 仅保留「能落到审计」的前一版本最小集，避免快照无限膨胀 */
export interface FlattenedPreviousBrief {
  version: number;
  status: ConceptBriefStatus;
  productName: string;
  oneLiner: string;
  targetUsers: string;
  primaryScenario: string;
  problemStatement: string;
  valueProposition: string;
  coreCapabilities: string[];
  openQuestions: string[];
  confirmedFields: ConceptFieldKey[];
  confirmedAt?: number;
}

export interface ConceptBriefInputs {
  /** 用户原始产品想法 */
  idea?: string;
  /** 用户已提交的访谈回答 */
  answers?: string[];
  /** 已确认的方向选择 */
  directions?: string[];
  /** 最新一轮对话纪要（加工素材，只作提炼依据，不落为事实字段） */
  transcript?: { role: "user" | "assistant" | "direction"; content: string }[];
  /** 本轮用户明确采纳的专家建议（加工素材） */
  expertAdvice?: string[];
}

/** AI 一次概念提取返回的原生结构（LLM 输出，须经 sanitize 归一） */
export interface RawConceptOutput {
  productName?: string;
  oneLiner?: string;
  targetUsers?: string;
  primaryScenario?: string;
  problemStatement?: string;
  valueProposition?: string;
  coreCapabilities?: string[];
  nonGoals?: string[];
  successMetrics?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  /** 会改变首版方向的关键未决问题 */
  openCriticalQuestions?: string[];
  /** 本轮新增的关键决策（标题 + 细节） */
  decisions?: { title: string; detail: string }[];
  /** 当前正在讨论的议题 */
  currentTopic?: string;
  /** 逐步生长的可读初版方案 / PRD 初稿 */
  planDraft?: string;
  /** AI 本轮提出的「最关键的下一问题」 */
  nextQuestion?: string;
  /** 2~4 个上下文相关的快捷选项 */
  quickOptions?: string[];
}

/** 构建/更新一次概念 Brief 的受控操作结果 */
export interface ConceptBriefOpResult {
  brief: ProductConceptBrief;
  /** AI 面向用户的回复（一句提炼 + 单个最关键问题） */
  reply: string;
  nextQuestion?: string;
  quickOptions?: string[];
}

// ───────────────────────── 完成度（纯函数） ─────────────────────────

export interface ConceptReadiness {
  /** 0–100 */
  readiness: number;
  completedFields: ConceptFieldKey[];
  missingRequiredFields: ConceptFieldKey[];
  optionalFields: ConceptFieldKey[];
  canProceed: boolean;
  /** 面向用户的缺项 / 受影响说明 */
  reasons: string[];
}

const FIELD_LABELS: Record<ConceptFieldKey, string> = {
  productName: "产品名",
  oneLiner: "一句话价值",
  targetUsers: "目标用户",
  primaryScenario: "使用场景",
  problemStatement: "核心问题",
  valueProposition: "价值主张",
  coreCapabilities: "MVP 核心能力",
  nonGoals: "非目标",
  successMetrics: "成功指标",
  assumptions: "关键假设",
};

export function isConceptFieldFilled(brief: ProductConceptBrief, key: ConceptFieldKey): boolean {
  const v = brief[key];
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * 产品创意阶段完成度（决策驱动）。
 * 依据三件事，绝不按「对话轮数 / 专家数 / 五个基础字段是否填满」算：
 *  - 是否已有可用的初版产品方案（planDraft）；
 *  - 是否存在会改变首版方向的关键未决问题（openCriticalQuestions）；
 *  - 用户是否接受当前方案、或选择带假设继续（acceptance）。
 * 字段是否落定仍用于抽屉里的局部编辑视图，但不再作为进入下一步的门禁。
 */
export function hasReadableConceptPlan(brief: ProductConceptBrief | null | undefined): boolean {
  return Boolean(brief && brief.planDraft && brief.planDraft.trim().length > 0);
}

export function getConceptReadiness(brief: ProductConceptBrief | null | undefined): ConceptReadiness {
  const completed = CONCEPT_REQUIRED_FIELDS.filter((k) => brief && isConceptFieldFilled(brief, k));
  const missing = CONCEPT_REQUIRED_FIELDS.filter((k) => !completed.includes(k));
  const filledOptional = CONCEPT_OPTIONAL_FIELDS.filter((k) => brief && isConceptFieldFilled(brief, k));

  // 已确认：视为可进入下一步（本身即「已接受」）
  if (!brief || brief.status === "confirmed") {
    return {
      readiness: 100,
      completedFields: completed,
      missingRequiredFields: missing,
      optionalFields: CONCEPT_OPTIONAL_FIELDS.filter((k) => !filledOptional.includes(k)),
      canProceed: !brief ? false : true,
      reasons: brief?.status === "confirmed" ? ["产品创意已确认，可直接进入方案落地。"] : [],
    };
  }

  const decisions = brief.decisions?.length ?? 0;
  const progress = Math.min(decisions / 3, 1); // 约 3 条关键决策即可撑起一个可用的初版方案
  const hasPlan = hasReadableConceptPlan(brief);
  const criticals = brief.openCriticalQuestions?.length ?? 0;
  const accepted = brief.acceptance === "accepted" || brief.acceptance === "continue_with_assumptions";

  let value = 0;
  if (!hasPlan) {
    // 方案还没长出来：只反映「已沉淀的决策成熟度」，始终不足以进入下一步
    value = Math.round(progress * 40);
  } else {
    // 初版方案已就绪：以采纳状态 + 关键未决问题校准
    value = 55 + Math.round(progress * 15); // 55~70
    if (criticals > 0) value -= 20; // 有会改变首版方向的问题，显著拉低
    if (brief.acceptance === "accepted") value += 25;
    else if (brief.acceptance === "continue_with_assumptions") value += 20;
    else value += 5; // 尚未采纳，留足提升空间
  }

  const reasons: string[] = [];
  if (!hasPlan) {
    reasons.push("还没有一套能落地的初版产品方案——老鸨子仍在陪你聊出 MVP 骨架与核心取舍。");
  } else if (!accepted) {
    reasons.push("初版产品方案已就绪，但你对它还没表态——选择「接受方案」或「带着假设继续」后才能进入方案落地。");
    if (criticals > 0)
      reasons.push(`仍有 ${criticals} 个会改变首版方向的关键问题未定，需要先拍板，或明确带假设继续。`);
  } else if (criticals > 0) {
    reasons.push(`有 ${criticals} 个关键问题仍按假设处理，进入方案落地后需在相应阶段复核。`);
  }

  return {
    readiness: Math.max(0, Math.min(100, Math.round(value))),
    completedFields: completed,
    missingRequiredFields: missing,
    optionalFields: CONCEPT_OPTIONAL_FIELDS.filter((k) => !filledOptional.includes(k)),
    canProceed: hasPlan && accepted,
    reasons,
  };
}

// ───────────────────────── 空 Brief 工厂 ─────────────────────────

export function emptyConceptBrief(opts: { id?: string; projectId?: string } = {}): ProductConceptBrief {
  const now = Date.now();
  return {
    id: opts.id || "",
    projectId: opts.projectId || "",
    version: 0,
    status: "draft",
    previousBrief: null,
    productName: "",
    oneLiner: "",
    targetUsers: "",
    primaryScenario: "",
    problemStatement: "",
    valueProposition: "",
    coreCapabilities: [],
    nonGoals: [],
    successMetrics: [],
    assumptions: [],
    openQuestions: [],
    openCriticalQuestions: [],
    decisions: [],
    currentTopic: "",
    planDraft: "",
    acceptance: "pending",
    confirmedFields: [],
    evidenceRefs: {},
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 把任意（可能来自旧版本持久化 / 草稿恢复的）部分对象补齐为完整的 ProductConceptBrief，
 * 保证 decisions / openCriticalQuestions 等数组字段始终存在，避免消费侧读取 .length 崩溃。
 */
export function coerceConceptBrief(b: ProductConceptBrief | null | undefined): ProductConceptBrief | null {
  if (!b) return null;
  return {
    ...emptyConceptBrief(),
    ...b,
    decisions: Array.isArray(b.decisions) ? b.decisions : [],
    openCriticalQuestions: Array.isArray(b.openCriticalQuestions) ? b.openCriticalQuestions : [],
  };
}

// ───────────────────────── 归一化 / schema 校验 ─────────────────────────

export function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
export function asConceptStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
}

/** 把 LLM 原生结构归一成合法概念段（只取合法类型，空值丢弃） */
export function normalizeConceptOutput(raw: RawConceptOutput | null | undefined): RawConceptOutput {
  if (!raw || typeof raw !== "object") return {};
  return {
    productName: asString(raw.productName),
    oneLiner: asString(raw.oneLiner),
    targetUsers: asString(raw.targetUsers),
    primaryScenario: asString(raw.primaryScenario),
    problemStatement: asString(raw.problemStatement),
    valueProposition: asString(raw.valueProposition),
    coreCapabilities: asConceptStrings(raw.coreCapabilities),
    nonGoals: asConceptStrings(raw.nonGoals),
    successMetrics: asConceptStrings(raw.successMetrics),
    assumptions: asConceptStrings(raw.assumptions),
    openQuestions: asConceptStrings(raw.openQuestions),
    openCriticalQuestions: asConceptStrings(raw.openCriticalQuestions),
    decisions: Array.isArray(raw.decisions)
      ? raw.decisions
          .map((d) => ({
            title: asString((d as { title?: unknown })?.title),
            detail: asString((d as { detail?: unknown })?.detail),
          }))
          .filter((d) => d.title)
      : [],
    currentTopic: asString(raw.currentTopic),
    planDraft: asString(raw.planDraft),
    nextQuestion: asString(raw.nextQuestion),
    quickOptions: asConceptStrings(raw.quickOptions).slice(0, 4),
  };
}

/** 字段是否「有效非空」（供 merge / readiness 共用） */
function hasValue(v: string | string[] | undefined): boolean {
  if (Array.isArray(v)) return v.length > 0;
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * field-level merge：AI 更新只覆盖「非确认」字段；confirmedFields 一律保留。
 * openQuestions 由 AI 全量维护（反映当前未知项）。不整体覆盖 Brief。
 */
export function mergeConceptBrief(
  prev: ProductConceptBrief,
  raw: RawConceptOutput,
  inputs?: ConceptBriefInputs,
): ProductConceptBrief {
  const norm = normalizeConceptOutput(raw);
  const confirmed = new Set(prev.confirmedFields);
  const evSuffix = inputs ? dominantEvidence(inputs, prev) : ("ai" as const);
  const now = Date.now();

  const pick = (field: ConceptFieldKey, next: string): string => {
    if (confirmed.has(field)) return prev[field] as string;
    return hasValue(next) ? next : (prev[field] as string);
  };
  const pickArr = (field: ConceptFieldKey, next: string[]): string[] => {
    if (confirmed.has(field)) return prev[field] as string[];
    return hasValue(next) ? next : (prev[field] as string[]);
  };

  const proposal: ProductConceptBrief = {
    ...prev,
    productName: pick("productName", norm.productName ?? ""),
    oneLiner: pick("oneLiner", norm.oneLiner ?? ""),
    targetUsers: pick("targetUsers", norm.targetUsers ?? ""),
    primaryScenario: pick("primaryScenario", norm.primaryScenario ?? ""),
    problemStatement: pick("problemStatement", norm.problemStatement ?? ""),
    valueProposition: pick("valueProposition", norm.valueProposition ?? ""),
    coreCapabilities: pickArr("coreCapabilities", norm.coreCapabilities ?? []),
    nonGoals: pickArr("nonGoals", norm.nonGoals ?? []),
    successMetrics: pickArr("successMetrics", norm.successMetrics ?? []),
    assumptions: pickArr("assumptions", norm.assumptions ?? []),
    // openQuestions 全量维护（去重保留），反映当前仍缺的确认项
    openQuestions: dedupe(norm.openQuestions ?? []),
    updatedAt: now,
  };

  // 证据：仅当该字段本轮「由 AI 更新」时才补记（确认字段不动）
  const evRefs: ConceptEvidenceRefs = { ...prev.evidenceRefs };
  const FIELD_KEYS: ConceptFieldKey[] = [
    "productName",
    "oneLiner",
    "targetUsers",
    "primaryScenario",
    "problemStatement",
    "valueProposition",
    "coreCapabilities",
    "nonGoals",
    "successMetrics",
    "assumptions",
  ];
  for (const field of FIELD_KEYS) {
    if (confirmed.has(field)) continue;
    const before = prev[field];
    const after = proposal[field];
    const changed =
      Array.isArray(after)
        ? JSON.stringify(before) !== JSON.stringify(after)
        : before !== after;
    // 出现「首次落定」或「内容变化」才补证据，避免每轮刷 at
    if (changed && hasValue(after as string | string[])) {
      evRefs[field] = [
        ...(evRefs[field] ?? []).filter(Boolean),
        {
          source: evSuffix,
          at: now,
          note: inputs ? summaryOfInputs(inputs) : "AI 归纳",
        },
      ].slice(-3); // 每字段至多保留最近 3 条，控制体积
    }
  }
  if (JSON.stringify(evRefs) !== JSON.stringify(prev.evidenceRefs)) {
    proposal.evidenceRefs = evRefs;
  }
  return proposal;
}

/** 用户手动编辑一个字段：写入值 + 标为 confirmed（除非用户明确要求重新生成） */
export function confirmConceptField(brief: ProductConceptBrief, field: ConceptFieldKey, value: string | string[]): ProductConceptBrief {
  const now = Date.now();
  const next: ProductConceptBrief = {
    ...brief,
    [field]: value,
    confirmedFields: brief.confirmedFields.includes(field)
      ? brief.confirmedFields
      : [...brief.confirmedFields, field],
    updatedAt: now,
    evidenceRefs: {
      ...brief.evidenceRefs,
      [field]: [{ source: "manual", at: now }],
    },
  };
  // 用户确认的目标字段，从 openQuestions 里移除对应缺口
  const label = FIELD_LABELS[field];
  const hasOpen = brief.openQuestions.some((q) => q.includes(label) || q.includes(field));
  if (hasOpen) {
    next.openQuestions = brief.openQuestions.filter(
      (q) => !(q.includes(label) || q.includes(field)),
    );
  }
  return next;
}

/** 转换一个字段上已确认但用户希望「重生成」的字段解除锁定（保留旧值待 AI 覆盖） */
export function releaseConceptField(brief: ProductConceptBrief, field: ConceptFieldKey): ProductConceptBrief {
  return {
    ...brief,
    confirmedFields: brief.confirmedFields.filter((k) => k !== field),
  };
}

// ───────────────────────── 决策层辅助（每轮访谈沉淀 · 采纳状态） ─────────────────────────

/** 是否已有一版「可用」的初版产品方案（planDraft 非空且足够成段） */
export function hasReadablePlan(brief: ProductConceptBrief | null | undefined): boolean {
  return Boolean(brief && brief.planDraft && brief.planDraft.trim().length > 0);
}

/**
 * 把 AI 本轮形成的关键决策 / 当前议题 / 初版方案初稿 / 关键未决问题并入 Brief。
 * 决策按标题去重追加；planDraft 以 AI 给出的为准（其上下文已含上一版初稿与用户确认字段）；
 * acceptance 不由 AI 改动（用户在前台显式表态）。这是 field-level 之外的「事实层」更新，
 * 不整体覆盖 Brief。
 */
export function applyConceptRound(
  brief: ProductConceptBrief,
  round: {
    decisions?: { title: string; detail: string }[];
    currentTopic?: string;
    planDraft?: string;
    openCriticalQuestions?: string[];
  },
): ProductConceptBrief {
  const now = Date.now();
  let decisions = brief.decisions;
  const titles = new Set(decisions.map((d) => d.title.toLowerCase()));
  const incoming = (round.decisions ?? [])
    .map((d) => ({ title: d.title.trim(), detail: d.detail.trim() }))
    .filter((d) => d.title && !titles.has(d.title.toLowerCase()));
  incoming.forEach((d, i) => {
    titles.add(d.title.toLowerCase());
    decisions = [...decisions, { id: `d${now.toString(36)}_${decisions.length}`, title: d.title, detail: d.detail, at: now }];
  });

  const mergeStrArr = (prevList: string[] | undefined, next: string[] | undefined): string[] => {
    const out = [...(prevList ?? [])];
    const seen = new Set(out.map((x) => x.toLowerCase()));
    for (const v of next ?? []) {
      const k = v.toLowerCase();
      if (v && !seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  };

  const next: ProductConceptBrief = {
    ...brief,
    decisions,
    updatedAt: now,
    openCriticalQuestions: mergeStrArr(brief.openCriticalQuestions, round.openCriticalQuestions),
  };
  if (round.currentTopic && round.currentTopic.trim()) next.currentTopic = round.currentTopic.trim();
  if (round.planDraft && round.planDraft.trim()) {
    next.planDraft = round.planDraft.trim();
    next.planUpdatedAt = now;
  }
  return next;
}

/** 用户对当前初版方案显式表态：接受 / 带假设继续 / 取消表态 */
export function setConceptAcceptance(brief: ProductConceptBrief, acceptance: ConceptAcceptance): ProductConceptBrief {
  return { ...brief, acceptance, updatedAt: Date.now() };
}

/** 接受当前初版方案 */
export function acceptConceptPlan(brief: ProductConceptBrief): ProductConceptBrief {
  return setConceptAcceptance(brief, "accepted");
}

/** 带着假设继续（关键未决问题尚存时的显式持续动作） */
export function continueConceptWithAssumptions(brief: ProductConceptBrief): ProductConceptBrief {
  return setConceptAcceptance(brief, "continue_with_assumptions");
}

/** 用户在前台抽屉里手动修改初版方案初稿（证据手动来源，供后续 AI 以其为基线续写） */
export function setConceptPlanDraft(brief: ProductConceptBrief, draft: string): ProductConceptBrief {
  return {
    ...brief,
    planDraft: draft.trim(),
    planUpdatedAt: Date.now(),
    updatedAt: Date.now(),
    evidenceRefs: {
      ...brief.evidenceRefs,
      productName: [
        { source: "manual", at: Date.now(), note: "手动修订产品初稿" },
        ...(brief.evidenceRefs.productName ?? []),
      ],
    },
  };
}

/** 用户在抽屉里手动新增一条关键决策 */
export function addManualConceptDecision(brief: ProductConceptBrief, title: string, detail: string): ProductConceptBrief {
  const now = Date.now();
  return {
    ...brief,
    decisions: [
      ...brief.decisions,
      { id: `d${now.toString(36)}_${brief.decisions.length}`, title, detail, at: now },
    ],
    updatedAt: now,
  };
}

/** 是否已满足可确认（进入下一步）条件 */
export function canConfirmConcept(brief: ProductConceptBrief): boolean {
  return getConceptReadiness(brief).canProceed;
}

/** 确认产品创意：status=confirmed，冻结当前 version，并保留前一版本快照供审计 */
export function confirmConcept(brief: ProductConceptBrief): ProductConceptBrief {
  const now = Date.now();
  const prev: FlattenedPreviousBrief | null = {
    version: brief.version,
    status: brief.status,
    productName: brief.productName,
    oneLiner: brief.oneLiner,
    targetUsers: brief.targetUsers,
    primaryScenario: brief.primaryScenario,
    problemStatement: brief.problemStatement,
    valueProposition: brief.valueProposition,
    coreCapabilities: brief.coreCapabilities,
    openQuestions: brief.openQuestions,
    confirmedFields: brief.confirmedFields,
    confirmedAt: now,
  };
  return {
    ...brief,
    status: "confirmed",
    frozenVersion: brief.version,
    previousBrief: prev,
    updatedAt: now,
  };
}

/** 生成/更新时递增版本；version=0 视为首版 */
export function bumpConceptVersion(brief: ProductConceptBrief): ProductConceptBrief {
  return { ...brief, previousBrief: strippedPrevious(brief) };
}
function strippedPrevious(brief: ProductConceptBrief): FlattenedPreviousBrief | null {
  if (brief.version === 0) return null;
  return {
    version: brief.version,
    status: brief.status,
    productName: brief.productName,
    oneLiner: brief.oneLiner,
    targetUsers: brief.targetUsers,
    primaryScenario: brief.primaryScenario,
    problemStatement: brief.problemStatement,
    valueProposition: brief.valueProposition,
    coreCapabilities: brief.coreCapabilities,
    openQuestions: brief.openQuestions,
    confirmedFields: brief.confirmedFields,
  };
}

// ───────────────────────── 元信息 / 证据辅助 ─────────────────────────

function dominantEvidence(inputs: ConceptBriefInputs, prev: ProductConceptBrief): ConceptEvidenceSource {
  // 有方向选择 → direction；有新访谈回答 → interview；只有原始想法 → idea
  if (inputs?.directions?.length) return "direction";
  if (inputs?.answers?.length) return "interview";
  if (inputs?.idea?.trim()) return "idea";
  return prev.version > 0 ? "ai" : "idea";
}

function summaryOfInputs(inputs: ConceptBriefInputs): string {
  const idea = inputs?.idea?.trim();
  if (idea) return `源于原始想法：${idea.slice(0, 24)}`;
  const ans = inputs?.answers?.filter((s) => s.trim());
  if (ans?.length) return `源于访谈回答：${ans[ans.length - 1].trim().slice(0, 24)}`;
  return "汇总访谈结论";
}

function dedupe(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of arr) {
    if (!s) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// ───────────────────────── 从输入构建初始候选（纯规则，供 AI 缺失时兜底） ─────────────────────────

/** 从原始输入里抠一个可作产品名的短语；抠不到留空（不编造） */
export function deriveConceptName(idea: string): string {
  const t = idea.trim();
  if (!t) return "";
  const quoted = t.match(/[「」『』“”"']([^「」『』“”"']{2,18})[」」』”"']/);
  const afterVerb = t.match(/(?:做|想做个|做一个|想做|打造一个)["「『“']?([\u4e00-\u9fa5A-Za-z0-9·]{2,16})/);
  return (quoted?.[1] ?? afterVerb?.[1] ?? "").trim();
}

/** 从原始输入提炼一句片段当 oneLiner 候选；过长或无可提炼则留空 */
export function deriveConceptOneLiner(idea: string): string {
  const t = idea.trim().replace(/[。.!！?？]+$/, "");
  if (!t) return "";
  return t.length <= 60 ? t : "";
}

/**
 * 初始/无 API key 时的离线兜底构建：只把「能确定」的字段落定，
 * 其余丢进 openQuestions —— 绝不编造目标用户、指标、市场数据。
 */
export function buildConceptHeuristic(inputs: ConceptBriefInputs, prev: ProductConceptBrief): ConceptBriefInputs & RawConceptOutput {
  const out: ConceptBriefInputs & RawConceptOutput = {
    idea: inputs.idea,
    answers: inputs.answers,
    directions: inputs.directions,
    productName: prev.productName || deriveConceptName(inputs.idea ?? ""),
    oneLiner: prev.oneLiner || deriveConceptOneLiner(inputs.idea ?? ""),
    coreCapabilities: prev.coreCapabilities,
    decisions: [],
  };
  // 方向选择 → 视为已确认的可落定结论：回填核心问题 + 沉淀为关键决策
  if (inputs.directions?.length) {
    if (!prev.problemStatement) {
      out.problemStatement = `围绕已确认方向「${inputs.directions.join("、")}」解决……（待你补充具体痛点）`;
    }
    const existing = new Set(prev.decisions.map((d) => d.title.toLowerCase()));
    for (const dir of inputs.directions) {
      const title = `确定方向：${dir}`;
      if (!existing.has(title.toLowerCase())) {
        out.decisions!.push({ title, detail: `用户在访谈中确认了该方向，将作为 MVP 边界与核心取舍的依据。` });
      }
    }
  }
  // 用户明确表达“类似 XX 平台/产品”时，沉淀一条竞品/模式参考决策（仅作引用，不编造）
  const idea = inputs.idea ?? "";
  const referenceMatch = idea.match(/类似\s*([「『“"]?[\u4e00-\u9fa5A-Za-z0-9·]{2,16}[」』”"]?)|跟?(.{2,16})流程类似|参考\s*([\u4e00-\u9fa5A-Za-z0-9·]{2,16})/);
  if (referenceMatch) {
    const target = referenceMatch[1] ?? referenceMatch[2] ?? referenceMatch[3] ?? "";
    if (target) {
      const title = `参考模式：${target.trim()}`;
      const existing = new Set(prev.decisions.map((d) => d.title.toLowerCase()));
      if (!existing.has(title.toLowerCase())) {
        out.decisions!.push({ title, detail: "用户提到可参照该模式设计流程，后续需结合具体品类与平台规则细化。" });
      }
    }
  }
  return out;
}