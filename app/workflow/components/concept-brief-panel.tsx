"use client";

// F1-A 产品创意 Brief：**不占据主工作区的轻量状态条 + PRD 抽屉**。
//
// 原则（XIYE 原始“多轮访谈，把想法做丰满”为核心）：
// - 主工作区上方只放一条极简状态：已形成 X 条关键决策 · 当前正在讨论 Y + 完成度 + 「查看当前 PRD / 产品初稿」入口。
// - 完整 Brief / 结构化内容全部收进右侧抽屉，默认不遮挡对话。
// - 抽屉里展示自动沉淀的内容，支持局部修改（初稿 / 关键决策 / 产品定义字段 / 方案表态），但绝不用它代替访谈。
// - 不把 targetUsers / 场景 / 问题 / 价值 / MVP 能力铺成首屏平铺表单。

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  FileText,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  type ConceptFieldKey,
  type ConceptReadiness,
  type ProductConceptBrief,
  acceptConceptPlan,
  addManualConceptDecision,
  continueConceptWithAssumptions,
  confirmConcept,
  confirmConceptField,
  releaseConceptField,
  setConceptPlanDraft,
} from "@/lib/flow-concept";

// 抽屉里「产品定义（自动沉淀）」一节展示的核心字段（支持局部修改，不铺在主工作区）
const CORE_FIELDS: { key: ConceptFieldKey; label: string; placeholder: string }[] = [
  { key: "targetUsers", label: "目标用户", placeholder: "例如：从 0-1 探索早期产品定位的个人/小团队…" },
  { key: "primaryScenario", label: "使用场景", placeholder: "例如：随手记录点子，每晚自动整理成计划…" },
  { key: "problemStatement", label: "核心问题", placeholder: "它到底解决用户什么问题？" },
  { key: "valueProposition", label: "一句话价值", placeholder: "用户为什么非它不可？" },
  { key: "coreCapabilities", label: "MVP 核心能力", placeholder: "至少 1 项，回车添加，3 项以内" },
];

interface ConceptBriefPanelProps {
  brief: ProductConceptBrief | null;
  readiness: ConceptReadiness;
  onConfirm: (brief: ProductConceptBrief) => void;
  onChanged: (brief: ProductConceptBrief | null) => void;
}

export function ConceptBriefPanel({ brief, readiness, onConfirm, onChanged }: ConceptBriefPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const decisionCount = brief?.decisions.length ?? 0;
  const hasPlan = Boolean(brief?.planDraft && brief.planDraft.trim());
  const currentTopic = brief?.currentTopic?.trim();
  const statusText = hasPlan
    ? `已形成 ${decisionCount} 条关键决策 · 初版方案已就绪 · ${currentTopic ? `正在讨论「${currentTopic}」` : "随时可按需修订"}`
    : `已形成 ${decisionCount} 条关键决策 · ${currentTopic ? `正在讨论「${currentTopic}」` : "在对话里把想法聊丰满，方案会随每轮访谈长出来"}`;

  return (
    <>
      <Card className="shrink-0 rounded-2xl border-border/70 shadow-sm">
        <CardContent className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* 左：过程状态 */}
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {brief?.status === "confirmed" ? "产品创意已确认" : "产品创意"}
                  {brief?.status === "confirmed" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 className="size-3" /> v{brief.frozenVersion ?? brief.version}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground" title={statusText}>
                  {statusText}
                </p>
              </div>
            </div>

            {/* 右：完成度 + 抽屉入口 */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${readiness.readiness}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground">{readiness.readiness}%</span>
              </div>
              <Button
                size="sm"
                variant={hasPlan ? "default" : "outline"}
                className="gap-1.5"
                disabled={!brief}
                onClick={() => setDrawerOpen(true)}
              >
                <FileText className="size-3.5" />
                查看当前 PRD / 产品初稿
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PRD 抽屉：完整 Brief 默认不占据主工作区 */}
      {drawerOpen && brief && (
        <ConceptDraftDrawer
          brief={brief}
          readiness={readiness}
          onClose={() => setDrawerOpen(false)}
          onChanged={onChanged}
          onConfirm={onConfirm}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* PRD 抽屉：自动沉淀内容 + 局部修改 + 方案表态                          */

function ConceptDraftDrawer({
  brief,
  readiness,
  onClose,
  onChanged,
  onConfirm,
}: {
  brief: ProductConceptBrief;
  readiness: ConceptReadiness;
  onClose: () => void;
  onChanged: (b: ProductConceptBrief | null) => void;
  onConfirm: (b: ProductConceptBrief) => void;
}) {
  const [planDraft, setPlanDraft] = useState(brief.planDraft);
  const [draftSaved, setDraftSaved] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [editing, setEditing] = useState<ConceptFieldKey | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");
  const [capInput, setCapInput] = useState("");
  const [decTitle, setDecTitle] = useState("");
  const [decDetail, setDecDetail] = useState("");
  const confirmedSet = useMemo(() => new Set(brief.confirmedFields ?? []), [brief.confirmedFields]);
  const accepted = brief.acceptance === "accepted" || brief.acceptance === "continue_with_assumptions";
  const isCap = editing === "coreCapabilities";

  const isFilled = (k: ConceptFieldKey) =>
    Array.isArray(brief[k]) ? (brief[k] as string[]).length > 0 : Boolean(String(brief[k]).trim());
  const arrayVal = (k: ConceptFieldKey): string[] => (Array.isArray(brief[k]) ? (brief[k] as string[]) : []);
  const scalarVal = (k: ConceptFieldKey): string => (Array.isArray(brief[k]) ? "" : String(brief[k] ?? ""));

  const savePlanDraft = () => {
    onChanged(setConceptPlanDraft(brief, planDraft));
    setDraftSaved(true);
    window.setTimeout(() => setDraftSaved(false), 1600);
  };

  const startEdit = (k: ConceptFieldKey) => {
    setEditing(k);
    setFieldDraft(Array.isArray(brief[k]) ? "" : String(brief[k] ?? ""));
    setCapInput("");
  };
  const saveField = (k: ConceptFieldKey) => {
    const next = confirmConceptField(brief, k, Array.isArray(brief[k]) ? brief[k] : fieldDraft.trim());
    onChanged(next);
    setEditing(null);
  };
  const addCapability = () => {
    if (!capInput.trim()) return;
    const cap = capInput.trim();
    if (!brief.coreCapabilities.includes(cap)) {
      onChanged(confirmConceptField(brief, "coreCapabilities", [...brief.coreCapabilities, cap].slice(0, 3)));
    }
    setCapInput("");
  };
  const removeCapability = (cap: string) => {
    onChanged(confirmConceptField(brief, "coreCapabilities", brief.coreCapabilities.filter((c) => c !== cap)));
  };
  const addDecision = () => {
    if (!decTitle.trim()) return;
    onChanged(addManualConceptDecision(brief, decTitle.trim(), decDetail.trim()));
    setDecTitle("");
    setDecDetail("");
  };

  const renderFieldEditor = (k: ConceptFieldKey) => {
    const meta = CORE_FIELDS.find((f) => f.key === k)!;
    const confirmed = confirmedSet.has(k);
    return (
      <div className="mt-1 rounded-xl border border-border bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            编辑 {meta.label}
            {confirmed && <span className="ml-1 text-[11px] text-emerald-600">（你已手动确认，AI 不再覆盖）</span>}
          </p>
          <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>
        {isCap ? (
          <div className="mt-2 space-y-2">
            <ul className="flex flex-wrap gap-1.5">
              {arrayVal(k).map((c) => (
                <li key={c} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-foreground">
                  {c}
                  <button type="button" onClick={() => removeCapability(c)} className="text-muted-foreground hover:text-destructive">
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={capInput}
                onChange={(e) => setCapInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCapability())}
                placeholder="输入一项核心能力，回车添加"
                className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <Button size="sm" variant="outline" onClick={addCapability} disabled={!capInput.trim()}>
                <Plus className="size-3.5" /> 添加
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">手动添加后该字段标记为「已确认」。</p>
          </div>
        ) : (
          <textarea
            value={fieldDraft}
            onChange={(e) => setFieldDraft(e.target.value)}
            rows={2}
            autoFocus
            placeholder={meta.placeholder}
            className="mt-2 w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
        )}
        <div className="mt-2.5 flex gap-2">
          <Button size="sm" onClick={() => saveField(k)} disabled={isCap ? false : !fieldDraft.trim()}>
            <CheckCircle2 className="size-3.5" /> 确认
          </Button>
          {confirmed && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onChanged(releaseConceptField(brief, k));
                setEditing(null);
              }}
            >
              解锁让 AI 重生成
            </Button>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEditing(null)}>
            取消
          </Button>
        </div>
      </div>
    );
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(560px,100vw)] flex-col border-l border-border bg-background shadow-xl">
        {/* 头部 */}
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              产品创意 Brief
              {brief.status === "confirmed" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="size-3" /> 已确认 · v{brief.frozenVersion ?? brief.version}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <CircleDashed className="size-3" /> v{brief.version}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              这里由访谈自动沉淀，可局部修订；单条修改不影响“老鸭子”主导的多轮访谈节奏。
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </header>

        {/* 内容 */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* 初版产品方案（PRD 初稿） */}
          <section>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">初版产品方案 / PRD 初稿</p>
            {brief.planDraft.trim() ? (
              <textarea
                value={planDraft}
                onChange={(e) => setPlanDraft(e.target.value)}
                rows={14}
                placeholder="基于访谈逐轮生长，可在下方局部修订…"
                className="w-full resize-y rounded-xl border border-border bg-card px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none focus:border-primary"
              />
            ) : (
              <div className="rounded-xl border border-dashed border-border/70 bg-background px-3 py-4 text-xs text-muted-foreground">
                初版方案还没长出来——老鸭子正陪你通过访谈逐步收敛，这里会自动生成可读的 PRD 初稿。
              </div>
            )}
            {brief.planDraft.trim() && (
              <div className="mt-2 flex items-center justify-end gap-2">
                <span className={draftSaved ? "text-[11px] text-emerald-600" : "text-[11px] text-muted-foreground"}>
                  {draftSaved ? "已保存，并以它为基线续写" : "可随时修订，尊重你的选择"}
                </span>
                <Button size="sm" variant="outline" onClick={savePlanDraft} disabled={planDraft === brief.planDraft}>
                  <CheckCircle2 className="size-3.5" /> 保存初稿
                </Button>
              </div>
            )}
          </section>

          {/* 关键决策 */}
          <section>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              关键决策（{brief.decisions.length}）
            </p>
            {brief.decisions.length ? (
              <ul className="space-y-2">
                {brief.decisions.map((d) => (
                  <li key={d.id} className="rounded-xl border border-border/70 bg-card px-3 py-2">
                    <p className="text-sm font-medium text-foreground">{d.title}</p>
                    {d.detail && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{d.detail}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">每轮访谈的关键取舍会沉淀在这里。</p>
            )}
            <div className="mt-2 space-y-1.5 rounded-xl border border-dashed border-border/70 bg-background p-2.5">
              <input
                value={decTitle}
                onChange={(e) => setDecTitle(e.target.value)}
                placeholder="追加一条方向结论 / 采纳的专家建议（一句话标题）"
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <input
                value={decDetail}
                onChange={(e) => setDecDetail(e.target.value)}
                placeholder="细节（可选）"
                className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
              />
              <Button size="sm" variant="outline" onClick={addDecision} disabled={!decTitle.trim()}>
                <Plus className="size-3.5" /> 追加
              </Button>
            </div>
          </section>

          {/* 待确认 / 关键未决问题 */}
          <section>
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">待确认</p>
            {brief.openCriticalQuestions.length || brief.openQuestions.length ? (
              <ul className="space-y-1.5">
                {brief.openCriticalQuestions.map((q) => (
                  <li key={q} className="flex gap-2 text-xs leading-snug text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    <span>
                      <span className="font-medium">关键（会改变首版方向）· </span>
                      {q}
                    </span>
                  </li>
                ))}
                {brief.openCriticalQuestions.length > 0 && brief.openQuestions.length > 0 && <div className="h-px bg-border" />}
                {brief.openQuestions.map((q) => (
                  <li key={q} className="flex gap-2 text-xs leading-snug text-muted-foreground">
                    <CircleDashed className="mt-0.5 size-3 shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">暂无未决问题。</p>
            )}
          </section>

          {/* 产品定义（自动沉淀 · 支持局部修改） */}
          <section>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border/70 bg-card px-3 py-2 text-left"
              onClick={() => setShowFields((v) => !v)}
            >
              <span className="text-sm font-medium text-foreground">产品定义（自动沉淀 · 可局部修改）</span>
              {showFields ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
            </button>
            {showFields && (
              <div className="mt-2 space-y-2">
                {CORE_FIELDS.map(({ key, label, placeholder }) => {
                  const confirmed = confirmedSet.has(key);
                  const filled = isFilled(key);
                  return (
                    <div
                      key={key}
                      className="cursor-pointer rounded-xl border border-border/60 bg-background px-3 py-2 transition hover:border-primary/50"
                      onClick={() => startEdit(key)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && startEdit(key)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
                        {confirmed && <CheckCircle2 className="size-2.5 text-emerald-500" />}
                      </div>
                      {key === "coreCapabilities" ? (
                        arrayVal(key).length ? (
                          <ul className="mt-0.5 flex flex-wrap gap-1">
                            {arrayVal(key).slice(0, 3).map((c) => (
                              <li key={c} className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-foreground/80">
                                {c}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground/60">{placeholder}</p>
                        )
                      ) : filled ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-foreground/80">{scalarVal(key)}</p>
                      ) : (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/60">{placeholder}</p>
                      )}
                    </div>
                  );
                })}
                {editing && renderFieldEditor(editing)}
                {/* 可选片段 read-only */}
                <OptionalReadonly labels={["非目标"]} values={brief.nonGoals} />
                <OptionalReadonly labels={["成功指标"]} values={brief.successMetrics} />
                <OptionalReadonly labels={["关键假设"]} values={brief.assumptions} />
              </div>
            )}
          </section>
        </div>

        {/* 底部：完成度 + 表态 + 确认 */}
        <footer className="border-t border-border/70 px-4 py-3">
          {readiness.reasons.length > 0 && (
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">{readiness.reasons.join(" ")}</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {brief.status !== "confirmed" ? (
              <>
                {brief.planDraft.trim() && !accepted ? (
                  <>
                    <span className={brief.acceptance === "continue_with_assumptions" ? "text-[11px] text-amber-600" : "text-[11px] text-muted-foreground"}>
                      有待确认的关键问题时可带假设推进
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto gap-1.5"
                      onClick={() => onChanged(continueConceptWithAssumptions(brief))}
                    >
                      带着假设继续
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onChanged(acceptConceptPlan(brief))}>
                      <CheckCircle2 className="size-3.5" /> 接受当前方案
                    </Button>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {accepted
                      ? brief.acceptance === "continue_with_assumptions"
                        ? "你已选择带假设继续，方案可进入落地。"
                        : "你已接受当前方案。"
                      : "老鸭子仍在陪你聊，方案长好后这里可表态。"}
                  </span>
                )}
                <Button
                  size="sm"
                  className="ml-auto gap-1.5"
                  disabled={!readiness.canProceed}
                  onClick={() => onConfirm(confirmConcept(brief))}
                  title={!readiness.canProceed ? "需先有一版可用方案并表态后才可确认" : "确认后冻结当前版本，AI 不再覆盖必填字段"}
                >
                  <CheckCircle2 className="size-3.5" /> 确认产品创意
                </Button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-4" /> 产品创意已确认，可前往方案落地。
              </span>
            )}
          </div>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function OptionalReadonly({ labels, values }: { labels: string[]; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="rounded-xl border border-border/50 bg-background px-3 py-2">
      <p className="text-[11px] font-medium text-muted-foreground">{labels.join(" / ")}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <li key={v} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground/80">
            {v}
          </li>
        ))}
      </ul>
    </div>
  );
}