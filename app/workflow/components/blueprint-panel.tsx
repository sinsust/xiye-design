"use client";

// F2-A 产品蓝图：**不占据主工作区的状态条 + 完整 Blueprint 侧边抽屉**。
//
// 原则（保持多轮访谈节奏，不回退为表单驱动）：
// - 主工作区上方只放一条极简状态：蓝图已形成 X 项共识 · 仍有 Y 项关键选择 + 是否 stale + 「查看产品蓝图」入口。
// - 完整 Blueprint 全部收进右侧抽屉，默认不遮挡「老鸭子对话」。
// - 抽屉里按「摘要」组织：产品定位 / 首批用户与关键任务 / 核心闭环 / MVP 必须有与暂不做 / 当前假设 / 成功信号 / 未决选择。
//   每项带证据徽标（已确认✓ / 假设 / 待确认）与来源；支持局部操作（接受 / 修改 / 暂缓标为假设）。
// - 底部页脚：接受当前蓝图 / 带着假设进入下一步 / 返回继续讨论（沿用 F0-A 保存与失败恢复）。

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FlaskConical,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Target,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type BlueprintReadiness,
  type ProductBlueprint,
  type BlueprintEvidence,
} from "@/lib/flow-blueprint";

/* ------------------------------------------------------------------ */
/* 证据徽标与来源                                                       */

function EvidenceBadge({ evidence }: { evidence: BlueprintEvidence }) {
  if (evidence === "confirmed") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
        <CheckCircle2 className="size-2.5" /> 已确认
      </span>
    );
  }
  if (evidence === "assumption") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
        <FlaskConical className="size-2.5" /> 假设
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      <CircleDashed className="size-2.5" /> 待确认
    </span>
  );
}

function SourceHint({ source }: { source: { decisionIds?: string[]; briefField?: string; note?: string } }) {
  const text = source?.note || (source?.briefField ? `源自 Brief.${source.briefField}` : source?.decisionIds?.length ? `来自 ${source.decisionIds.length} 条决策` : "来源待定");
  if (!text) return null;
  return <p className="text-[10px] text-muted-foreground/60">{text}</p>;
}

/* ------------------------------------------------------------------ */
/* 局部编辑行：接受 / 修改 / 标为假设                                    */

function EditableRow({
  value,
  evidence,
  source,
  path,
  onLocalEdit,
}: {
  value: string;
  evidence: BlueprintEvidence;
  source: { decisionIds?: string[]; briefField?: string; note?: string };
  path: string;
  onLocalEdit: (path: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const start = () => {
    setDraft(value);
    setEditing(true);
  };
  return (
    <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-3 min-w-0 flex-1 text-sm text-foreground/90">{value || "（空）"}</p>
        <div className="flex shrink-0 items-center gap-1.5">
          <EvidenceBadge evidence={evidence} />
          <button type="button" onClick={start} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" title="修改">
            <PencilLine className="size-3.5" />
          </button>
        </div>
      </div>
      <SourceHint source={source} />
      {editing && (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            autoFocus
            className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              disabled={!draft.trim() || draft === value}
              onClick={() => {
                onLocalEdit(path, draft.trim());
                setEditing(false);
              }}
            >
              保存修改
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 完整蓝图抽屉                                                         */

export function BlueprintDrawer({
  blueprint,
  readiness,
  stale,
  busy,
  error,
  onClose,
  onLocalEdit,
  onResolve,
  onAccept,
  onContinueAssumptions,
  onRebuild,
  onRestore,
}: {
  blueprint: ProductBlueprint;
  readiness: BlueprintReadiness;
  stale: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onLocalEdit: (path: string, value: string) => void;
  onResolve: (decisionId: string, hint: string) => void;
  onAccept: () => void;
  onContinueAssumptions: () => void;
  onRebuild: () => void;
  onRestore: () => void;
}) {
  const confirmed = blueprint.status === "confirmed";
  const must = blueprint.mvpScope.mustHave ?? [];
  const out = blueprint.mvpScope.explicitlyOutOfScope ?? [];

  return createPortal(
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-[min(600px,100vw)] flex-col border-l border-border bg-background shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
              产品蓝图 ProductBlueprint
              {confirmed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <ShieldCheck className="size-3" /> 已确认 · v{blueprint.version}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                  v{blueprint.version}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              由 F1-A 方案与决策自动收敛 · 每项结论可回溯到决策或原 Brief · 你的修改会被保留。
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {stale && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">F1-A 有了新的关键决策，蓝图已过期</p>
                <Button
                  size="icon"
                  variant="outline"
                  className="mt-2"
                  onClick={onRebuild}
                  disabled={busy}
                  title="重新生成蓝图（保留手动修改，冲突位置标为待确认）"
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* 完成度 */}
          <section>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              共识进度
            </p>
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${Math.min(100, Math.round((readiness.consensusCount / Math.max(1, readiness.consensusCount + readiness.unresolvedCount)) * 100))}%` }} />
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {readiness.consensusCount} 项共识 · {readiness.unresolvedCount} 项待确认
              </span>
            </div>
            {readiness.reasons.length > 0 && (
              <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{readiness.reasons.join(" ")}</p>
            )}
          </section>

          {/* 产品定位 */}
          <Section title="产品定位">
            <EditableRow value={blueprint.productPositioning.text} evidence={blueprint.productPositioning.evidence} source={blueprint.productPositioning.source} path="productPositioning.text" onLocalEdit={onLocalEdit} />
          </Section>

          {/* 首批用户与关键任务 */}
          <Section title="首批用户与关键任务">
            {blueprint.targetUsers.length ? (
              blueprint.targetUsers.map((g, gi) => (
                <div key={g.id} className="space-y-2">
                  <EditableRow value={g.persona} evidence={g.evidence} source={g.source} path={`targetUsers.${gi}.persona`} onLocalEdit={onLocalEdit} />
                  <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5">
                      <span className="text-muted-foreground/60">场景：</span>
                      <span className="line-clamp-2">{g.context || "待补"}</span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-background px-2.5 py-1.5">
                      <span className="text-muted-foreground/60">首要需求：</span>
                      <span className="line-clamp-2">{g.primaryNeed || "待补"}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground/70">尚无首批用户——仍在访谈中收窄。</p>
            )}
            <div className="rounded-xl border border-border/60 bg-background px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">核心任务（Job to be done）</p>
              <p className="mt-1 text-sm text-foreground/90">{blueprint.primaryJob.statement || "（待确认）"}</p>
              {blueprint.primaryJob.successMoment && (
                <p className="mt-1 text-xs text-muted-foreground">成功时刻：{blueprint.primaryJob.successMoment}</p>
              )}
              <div className="mt-1.5 flex items-center gap-1.5">
                <EvidenceBadge evidence={blueprint.primaryJob.evidence} />
                <SourceHint source={blueprint.primaryJob.source} />
              </div>
            </div>
          </Section>

          {/* 核心闭环 */}
          <Section title="核心闭环">
            {blueprint.coreLoop.length ? (
              blueprint.coreLoop.map((s, si) => (
                <div key={s.id} className="rounded-xl border border-dashed border-indigo-300/60 bg-indigo-500/5 px-3 py-2.5">
                  <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <Target className="size-3.5 text-indigo-600" /> {s.step} · 第 {si + 1} 步
                    <EvidenceBadge evidence={s.evidence} />
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li><span className="text-foreground/80">动作：</span>{s.userAction}</li>
                    <li><span className="text-foreground/80">系统响应：</span>{s.systemResponse}</li>
                    <li><span className="text-foreground/80">用户价值：</span>{s.userValue || "待补"}</li>
                  </ul>
                  <SourceHint source={s.source} />
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground/70">首条核心闭环仍在讨论中。</p>
            )}
          </Section>

          {/* MVP 必须有 / 暂不做 */}
          <Section title="MVP 必须有 / 暂不做">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">必须有</p>
            {must.length ? (
              <ul className="space-y-1.5">
                {must.map((m, mi) => (
                  <li key={m.id}>
                    <EditableRow value={m.text} evidence={m.evidence} source={m.source} path={`mvpScope.mustHave.${mi}.text`} onLocalEdit={onLocalEdit} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">待定。</p>
            )}
            <p className="mb-1 mt-3 text-[11px] font-medium text-muted-foreground">明确暂不做</p>
            {out.length ? (
              <ul className="space-y-1.5">
                {out.map((o, oi) => (
                  <li key={o.id}>
                    <EditableRow value={o.text} evidence={o.evidence} source={o.source} path={`mvpScope.explicitlyOutOfScope.${oi}.text`} onLocalEdit={onLocalEdit} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">暂未列出（可后续补充）。</p>
            )}
          </Section>

          {/* 当前假设 */}
          <Section title="当前假设">
            {blueprint.assumptions.length ? (
              <ul className="space-y-1.5">
                {blueprint.assumptions.map((a) => (
                  <li key={a.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                    <p className="text-sm text-foreground/90">{a.text}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">影响：{a.impact}</p>
                    <p className="text-xs text-muted-foreground">验证：{a.validationIdea}</p>
                    {a.source?.briefField && <SourceHint source={a.source} />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">暂无假设。</p>
            )}
          </Section>

          {/* 成功信号 */}
          <Section title="成功信号">
            {blueprint.successSignals.length ? (
              <ul className="space-y-1.5">
                {blueprint.successSignals.map((s, si) => (
                  <li key={s.id}>
                    <EditableRow value={`${s.metric}${s.target ? `（目标 ${s.target}）` : ""}`} evidence={s.evidence} source={s.source} path={`successSignals.${si}.metric`} onLocalEdit={onLocalEdit} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground/70">尚未定义（会随访谈补充）。</p>
            )}
          </Section>

          {/* 未决选择 */}
          {(blueprint.unresolvedDecisions.length > 0 || (blueprint.lastConflicts?.length ?? 0) > 0) && (
            <Section title={blueprint.lastConflicts?.length ? "待确认（含重建冲突）" : "未决选择"}>
              <ul className="space-y-1.5">
                {blueprint.unresolvedDecisions.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1.5 rounded-xl border border-border/60 bg-background px-3 py-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground/90">{d.question}</p>
                        {(d.impactNote || d.chosenHint) && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {d.impactNote ? `影响：${d.impactNote}` : ""}{d.chosenHint ? ` · 已选倾向：${d.chosenHint}` : ""}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => onResolve(d.id, d.chosenHint || "按假设继续")}>
                        按假设继续
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* 版本来源 */}
          <section>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">版本</p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>当前 v{blueprint.version}</span>
              {blueprint.generatedFromConceptVersion !== undefined && <span>· 源自 Brief v{blueprint.generatedFromConceptVersion}</span>}
              {blueprint.guardedPaths.length > 0 && <span>· 已保留 {blueprint.guardedPaths.length} 处手动修改</span>}
              {blueprint.previousVersion && (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={onRestore} disabled={busy}>
                  <RotateCcw className="size-3" /> 恢复上一有效版本
                </Button>
              )}
            </div>
          </section>
        </div>

        {/* 页脚：接受 / 带假设进入下一步 / 返回继续讨论 */}
        <footer className="border-t border-border/70 px-4 py-3">
          {error && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] leading-snug text-destructive">
              <AlertTriangle className="size-3 shrink-0" /> {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!confirmed && (
              <Button size="sm" variant="ghost" onClick={onClose} disabled={busy}>
                返回继续讨论
              </Button>
            )}
            {!confirmed ? (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={onContinueAssumptions}>
                  <FlaskConical className="size-3.5" /> 带着假设进入下一步
                </Button>
                <Button size="sm" className="gap-1.5" disabled={busy || !readiness.canProceed} onClick={onAccept} title={!readiness.canProceed ? "尚未确认，可直接带假设推进" : "确认当前蓝图"}>
                  <CheckCircle2 className="size-3.5" /> 接受当前蓝图
                </Button>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                <ShieldCheck className="size-4" />{" "}
                {blueprint.acceptance === "continue_with_assumptions" ? "蓝图已带假设确认，可进入方案落地。" : "蓝图已确认，可进入方案落地。"}
              </span>
            )}
          </div>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export { Users as _BlueprintIconRef };