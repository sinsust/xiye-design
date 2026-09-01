"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Plus, Send, Check, ArrowRight, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import TaskTimeline from "@/components/tasks/TaskTimeline";
import { ProvenancePanel } from "@/components/brain/ProvenancePanel";

type TaskStatus = "todo" | "in_progress" | "done";

const STATUS_LABEL: Record<TaskStatus, string> = { todo: "待处理", in_progress: "进行中", done: "已完成" };
const STATUS_DOT: Record<TaskStatus, string> = { todo: "#94a3b8", in_progress: "#f59e0b", done: "#22c55e" };
const STATUS_NEXT: Record<TaskStatus, TaskStatus> = { todo: "in_progress", in_progress: "done", done: "todo" };

interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  sortOrder: number;
  priority: string;
}
interface TimelineItem {
  id: string;
  action: string;
  detail: string | null;
  createdAt: number;
}
interface CommentItem {
  id: string;
  content: string;
  createdAt: number;
}

interface DetailData {
  task: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    assignee: string | null;
    milestone: string | null;
    projectId: string | null;
    noteId: string | null;
    priority: string;
  };
  project: { id: string; name: string; color: string; status: string } | null;
  subtasks: SubTask[];
  subtaskProgress: { total: number; completed: number };
  parentTask: { id: string; title: string; status: TaskStatus } | null;
  relatedNotes: { id: string; title: string; source: string }[];
  relatedStrategy: { id: string; name: string } | null;
  timeline: TimelineItem[];
  comments: CommentItem[];
  canRecordOutcome: boolean;
  outcomes: {
    id: string;
    taskId: string;
    status: string;
    summary: string;
    detail: string | null;
    createdAt: number;
    updatedAt: number;
  }[];
}

type OutcomeStatus = "resolved" | "partial" | "new_issue" | "no_record";

const OUTCOME_OPTIONS: { value: OutcomeStatus; label: string }[] = [
  { value: "resolved", label: "已解决" },
  { value: "partial", label: "部分完成" },
  { value: "new_issue", label: "发现新问题" },
  { value: "no_record", label: "无需记录" },
];

function fmtDate(v: number | string | null): string {
  if (!v) return "";
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  if (isNaN(d.getTime())) return String(v);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export interface TaskDetailDrawerProps {
  taskId: string | null;
  onClose: () => void;
  onChanged: () => void;
  /** P3-B：new_issue 结果 → 打开既有 StructPreview 确认一条待确认处理计划 */
  onOpenPlanPreview?: (planId: string, body: unknown) => void;
}

export default function TaskDetailDrawer({ taskId, onClose, onChanged, onOpenPlanPreview }: TaskDetailDrawerProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [subInput, setSubInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"detail" | "timeline">("detail");
  // P3-B 结果沉淀
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeStatus, setOutcomeStatus] = useState<OutcomeStatus>("resolved");
  const [outcomeSummary, setOutcomeSummary] = useState("");
  const [outcomeDetail, setOutcomeDetail] = useState("");
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [outcomeError, setOutcomeError] = useState(false);
  // P3-B 前端提交锁：state 更新为异步，双击/回车连点会诱发并发请求，用 ref 立即加锁防重入
  const savingOutcomeRef = useRef(false);
  const [savedOutcome, setSavedOutcome] = useState<DetailData["outcomes"][number] | null>(null);
  const [organizePayload, setOrganizePayload] = useState<{ content: string; source: string } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planError, setPlanError] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brain/tasks/${id}/detail`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!taskId) {
      setData(null);
      setOutcomeOpen(false);
      setSavedOutcome(null);
      setOrganizePayload(null);
      setOutcomeError(false);
      setPlanError(false);
      setOutcomeStatus("resolved");
      setOutcomeSummary("");
      setOutcomeDetail("");
      return;
    }
    load(taskId);
  }, [taskId, load]);

  if (!taskId) return null;

  const patch = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/brain/tasks?id=${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        await load(taskId);
        onChanged();
      }
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const cycleStatus = () => {
    if (data) patch({ status: STATUS_NEXT[data.task.status] });
  };

  const addSubtask = async () => {
    const title = subInput.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/brain/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, parentTaskId: taskId, noteId: data?.relatedNotes[0]?.id }),
      });
      if (res.ok) {
        setSubInput("");
        await load(taskId);
        onChanged();
      }
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const toggleSub = async (sid: string, status: TaskStatus) => {
    const next = status === "done" ? "todo" : "done";
    setBusy(true);
    try {
      const res = await fetch(`/api/brain/tasks?id=${sid}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next as TaskStatus }),
      });
      if (res.ok) {
        await load(taskId);
        onChanged();
      }
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const reorderSub = async (sid: string, dir: number) => {
    setBusy(true);
    try {
      const cur = [...(data?.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
      const i = cur.findIndex((s) => s.id === sid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return;
      const a = cur[i];
      const b = cur[j];
      await Promise.all([
        fetch(`/api/brain/tasks?id=${a.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: b.sortOrder }) }),
        fetch(`/api/brain/tasks?id=${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sortOrder: a.sortOrder }) }),
      ]);
      await load(taskId);
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    const content = commentInput.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/brain/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setCommentInput("");
        await load(taskId);
      }
    } catch {
      /* 忽略 */
    } finally {
      setBusy(false);
    }
  };

  // —— P3-B：保存任务结果 ——
  const saveOutcome = async () => {
    if (!data || savingOutcome || savingOutcomeRef.current) return;
    savingOutcomeRef.current = true;
    const forceSummary =
      outcomeStatus !== "no_record" && !outcomeSummary.trim()
        ? `（${OUTCOME_OPTIONS.find((o) => o.value === outcomeStatus)?.label ?? ""}）`
        : outcomeSummary.trim();
    setSavingOutcome(true);
    setOutcomeError(false);
    setPlanError(false);
    try {
      // 同一明确操作中标记任务完成：结果通常跟着「完成」一起落地
      const res = await fetch(`/api/brain/tasks/${data.task.id}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: outcomeStatus,
          summary: forceSummary,
          detail: outcomeDetail.trim() || undefined,
          markDone: data.task.status !== "done",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error);
      setSavedOutcome({
        id: body.outcome.id,
        taskId: body.outcome.taskId,
        status: body.outcome.status,
        summary: body.outcome.summary,
        detail: body.outcome.detail ?? null,
        createdAt: body.outcome.createdAt,
        updatedAt: body.outcome.updatedAt,
      });
      setOrganizePayload(body.organize ?? null);
      setOutcomeOpen(false);
      if (body.task?.status !== data.task.status) await load(taskId);
      setOutcomeSummary("");
      setOutcomeDetail("");
      onChanged();
    } catch {
      setOutcomeError(true);
    } finally {
      savingOutcomeRef.current = false;
      setSavingOutcome(false);
    }
  };

  const closeOutcome = () => {
    setOutcomeOpen(false);
    setOutcomeError(false);
  };

  // —— P3-B：new_issue → 根据该结果生成后续处理计划（走既有 organizeToPlan，仅建 pending_confirmation Plan）——
  const buildPlanFromOutcome = async () => {
    if (!data || !organizePayload || planOpen) return;
    setPlanOpen(true);
    setPlanError(false);
    try {
      const res = await fetch("/api/brain/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: organizePayload.content, source: organizePayload.source }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.plan) throw new Error(body?.error);
      if (onOpenPlanPreview) onOpenPlanPreview(body.plan.id, body.body ?? null);
      setPlanOpen(false);
    } catch {
      setPlanError(true);
      setPlanOpen(false);
    }
  };

  const subs = [...(data?.subtasks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const progress = data?.subtaskProgress?.total
    ? Math.round((data.subtaskProgress.completed / data.subtaskProgress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* 抽屉 */}
      <div className="relative flex h-full w-full max-w-[480px] flex-col bg-card shadow-2xl">
        <div className="flex items-start gap-2 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">{data?.task.title ?? "加载中…"}</h3>
            {/* 归区：项目 · 里程碑 / 负责人 */}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {data?.project && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: data.project.color }} />
                  📁 {data.project.name}
                </span>
              )}
              {data?.task.milestone && (
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600">
                  里程碑：{data.task.milestone}
                </span>
              )}
              {data?.task.assignee && (
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  负责人：{data.task.assignee}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {/* 详情 / 时间线 子 Tab */}
          <div className="flex items-center gap-4 border-b border-border/60 pb-2">
            {([
              { k: "detail" as const, label: "详情" },
              { k: "timeline" as const, label: "时间线" },
            ]).map((tab) => (
              <button key={tab.k} onClick={() => setView(tab.k)} className="relative pb-1 text-xs transition">
                <span className={view === tab.k ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground"}>
                  {tab.label}
                </span>
                {view === tab.k && <span className="absolute inset-x-0 -bottom-[9px] h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground">创建至今 {(data?.timeline?.length ?? 0) > 0 ? `${data!.timeline.length} 条` : "—"}</span>
          </div>

          {view === "detail" && (
          <>
          {/* 状态 + 截止 */}
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <button
              onClick={cycleStatus}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-primary/10"
            >
              <span className="size-2 rounded-full" style={{ background: STATUS_DOT[data?.task.status ?? "todo"] }} />
              {data ? STATUS_LABEL[data.task.status] : "…"} <ArrowRight className="size-3" />
            </button>
            <span className="text-xs text-muted-foreground">
              截止：{data?.task.dueDate ? fmtDate(data.task.dueDate) : "未设置"}
            </span>
          </div>

          {/* P3-B：任务结果沉淀 */}
          {data && data.canRecordOutcome && (
            <section className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-foreground">任务结果</h4>
                {!outcomeOpen && (
                  <button
                    onClick={() => setOutcomeOpen(true)}
                    className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/15"
                  >
                    记录结果
                  </button>
                )}
              </div>

              {savedOutcome && savedOutcome.taskId === data.task.id && (
                <div className="mt-2 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                    <Check className="size-3.5" /> 已保存任务结果
                  </div>
                  {organizePayload && (
                    <button
                      onClick={buildPlanFromOutcome}
                      disabled={planOpen}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-emerald-300 bg-card px-2 py-1.5 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {planOpen ? <Loader2 className="size-3 animate-spin" /> : <ArrowRight className="size-3" />}
                      根据该结果生成后续处理计划
                    </button>
                  )}
                  {planError && (
                    <div className="text-[11px] text-red-600">生成处理计划失败，请重试。</div>
                  )}
                </div>
              )}

              {outcomeOpen && (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {OUTCOME_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setOutcomeStatus(o.value)}
                        className={
                          "rounded-full border px-2.5 py-1 text-[11px] transition " +
                          (outcomeStatus === o.value
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground hover:border-primary/40")
                        }
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {outcomeStatus !== "no_record" && (
                    <>
                      <input
                        value={outcomeSummary}
                        onChange={(e) => setOutcomeSummary(e.target.value)}
                        placeholder="结果摘要（一句话，如：方案定稿并落地）…"
                        className="h-8 w-full rounded-lg border border-border bg-card px-2 text-xs focus:border-primary focus:outline-none"
                      />
                      <textarea
                        value={outcomeDetail}
                        onChange={(e) => setOutcomeDetail(e.target.value)}
                        placeholder="补充经验 / 问题 / 后续方向（可选）…"
                        rows={2}
                        className="w-full resize-none rounded-lg border border-border bg-card px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                      />
                    </>
                  )}
                  {outcomeStatus === "no_record" && (
                    <p className="text-[11px] text-muted-foreground">不保存结果，仅完成任务即可。</p>
                  )}
                  {outcomeError && (
                    <div className="text-[11px] text-red-600">保存失败，请重试。</div>
                  )}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={closeOutcome}
                      disabled={savingOutcome}
                      className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition hover:bg-muted"
                    >
                      稍后再说
                    </button>
                    <button
                      onClick={saveOutcome}
                      disabled={savingOutcome || (outcomeStatus !== "no_record" && !outcomeSummary.trim())}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {savingOutcome ? <Loader2 className="size-3 animate-spin" /> : null}
                      保存结果
                    </button>
                  </div>
                </div>
              )}

              {data.outcomes.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {data.outcomes.map((o) => (
                    <div key={o.id} className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                          {OUTCOME_OPTIONS.find((x) => x.value === o.status)?.label ?? o.status}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{fmtDate(o.createdAt)}</span>
                      </div>
                      {o.summary && <div className="mt-1 text-xs text-foreground">{o.summary}</div>}
                      {o.detail && <div className="mt-0.5 whitespace-pre-wrap text-[11px] text-muted-foreground">{o.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 子任务 */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground">子任务 ({data?.subtaskProgress.total ?? 0})</h4>
              {data && data.subtaskProgress.total > 0 && (
                <span className="text-[11px] text-muted-foreground">{data.subtaskProgress.completed}/{data.subtaskProgress.total} · {progress}%</span>
              )}
            </div>
            {data && data.subtaskProgress.total > 0 && (
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            )}
            <div className="space-y-1.5">
              {subs.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/60 py-3 text-center text-[11px] text-muted-foreground">
                  暂无子任务，可在下方添加
                </div>
              )}
              {subs.map((s, idx) => (
                <div key={s.id} className="group flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
                  <button
                    onClick={() => toggleSub(s.id, s.status)}
                    className={"flex size-4 shrink-0 items-center justify-center rounded border transition " +
                      (s.status === "done" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-transparent hover:border-primary/40")}
                    aria-label="完成子任务"
                  >
                    <Check className="size-3" />
                  </button>
                  <span className={"min-w-0 flex-1 truncate text-xs " + (s.status === "done" ? "text-muted-foreground line-through" : "text-foreground")}>
                    {s.title}
                  </span>
                  {s.dueDate && <span className="shrink-0 text-[10px] text-muted-foreground">{fmtDate(s.dueDate)}</span>}
                  <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                    <button onClick={() => reorderSub(s.id, -1)} disabled={idx === 0} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="size-3" />
                    </button>
                    <button onClick={() => reorderSub(s.id, 1)} disabled={idx === subs.length - 1} className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSubtask(); }}
                placeholder="添加子任务，回车创建…"
                className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-xs focus:border-primary focus:outline-none"
              />
              <button onClick={addSubtask} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground transition hover:opacity-90">
                <Plus className="size-3.5" /> 添加
              </button>
            </div>
          </section>

          {/* 来源与关联（P2-A：任务 → 处理计划 → 原始来源/产出回溯） */}
          <ProvenancePanel anchor={{ taskId }} title="来源与关联" />

          {/* 关联 */}
          {(data?.relatedNotes?.length || data?.relatedStrategy) && (
            <section>
              <h4 className="mb-2 text-xs font-semibold text-foreground">关联</h4>
              <div className="space-y-1.5">
                {data?.relatedNotes.map((n) => (
                  <div
                    key={n.id}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs text-muted-foreground"
                  >
                    <span>📝</span> <span className="truncate">{n.title}</span>
                  </div>
                ))}
                {data?.relatedStrategy && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs text-primary">
                    <span>🎯</span> <span className="truncate">{data.relatedStrategy.name}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          </>
          )}

          {view === "timeline" && (
            <section>
              <h4 className="mb-2 text-xs font-semibold text-foreground">时间线</h4>
              <TaskTimeline items={data?.timeline ?? []} />
            </section>
          )}
        </div>

        {/* 备注输入区 */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-1.5">
            <input
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              placeholder="输入备注…"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 text-xs focus:border-primary focus:outline-none"
            />
            <button onClick={addComment} disabled={busy} className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:opacity-90">
              发送 <Send className="size-3.5" />
            </button>
          </div>
          {data && data.comments.length > 0 && (
            <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto">
              {data.comments.map((c) => (
                <div key={c.id} className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <div className="text-xs text-foreground">{c.content}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{fmtDateTime(c.createdAt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}