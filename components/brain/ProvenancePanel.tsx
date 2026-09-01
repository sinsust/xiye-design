"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, FileText, Layers, ListTodo, Bell, FolderKanban, Sparkles } from "lucide-react";
import type {
  ProvenanceViewModel,
  ProvenanceOutputNote,
  ProvenanceOutputTask,
  ProvenanceOutputReminder,
  ProvenanceOutputProject,
} from "@/lib/brain-provenance";

export interface ProvenanceAnchor {
  noteId?: string | null;
  taskId?: string | null;
  reminderId?: string | null;
  inboxId?: string | null;
  planId?: string | null;
}

const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending_confirmation: "待确认",
  applied: "已应用",
  failed: "失败",
  rejected: "已拒绝",
};

function fmtTime(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 「来源与关联」统一展示面板（P2-A）。
 * 传入任意锚点（笔记/任务/提醒/收件箱/计划），自动读取并渲染完整来源链路与产出对象。
 * 未命中或无权限时展示明确空态；跳转通过回调交由父级实现。
 */
export function ProvenancePanel({
  anchor,
  onOpenNote,
  onOpenTask,
  onOpenPlan,
  title = "来源与关联",
  light = false,
}: {
  anchor?: ProvenanceAnchor | null;
  onOpenNote?: (id: string) => void;
  onOpenTask?: (id: string) => void;
  onOpenPlan?: (planId: string) => void;
  title?: string;
  // 紧凑模式：隐藏面板标题与卡片感，用于嵌在卡片内展示来源链路（P3-A 项目工作台关键知识）
  light?: boolean;
}) {
  const [view, setView] = useState<ProvenanceViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let disposed = false;
    if (!anchor || !(anchor.noteId || anchor.taskId || anchor.reminderId || anchor.inboxId || anchor.planId)) {
      setView(null);
      return;
    }
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (anchor.noteId) params.set("noteId", anchor.noteId);
    if (anchor.taskId) params.set("taskId", anchor.taskId);
    if (anchor.reminderId) params.set("reminderId", anchor.reminderId);
    if (anchor.inboxId) params.set("inboxId", anchor.inboxId);
    if (anchor.planId) params.set("planId", anchor.planId);
    fetch(`/api/brain/provenance?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (disposed) return;
        setView(d);
        if (!d?.found) setError("未找到关联的来源或产出");
      })
      .catch(() => {
        if (!disposed) {
          setView({ found: false } as ProvenanceViewModel);
          setError("加载来源链路失败");
        }
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [anchor?.noteId, anchor?.taskId, anchor?.reminderId, anchor?.inboxId, anchor?.planId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 text-xs text-muted-foreground">
        <span className="size-3 animate-spin rounded-full border-2 border-border border-t-primary" />
        正在回溯来源…
      </div>
    );
  }
  if (!view || !view.found) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Layers className="size-3.5 text-muted-foreground/50" />
        {error || "该对象暂无来源链路记录（直接录入或旧数据）"}
      </div>
    );
  }

  const note = view.outputNote;
  const tasks = view.outputTasks;
  const reminders = view.outputReminders;
  const project = view.outputProject;

  return (
    <div className={light ? "rounded-lg bg-muted/20 p-2" : "rounded-xl border border-border/70 bg-card p-4"}>
      {!light && (
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Layers className="size-3.5 text-primary" />
            {title}
          </div>
          {view.planId && view.planStatus && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              计划 · {PLAN_STATUS_LABEL[view.planStatus] ?? view.planStatus}
            </span>
          )}
        </div>
      )}

      {/* 来源 */}
      <div className="mb-3 rounded-lg bg-muted/40 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="cell truncate text-xs font-medium text-foreground">
            <span className="mr-1.5 text-muted-foreground">{view.sourceType}</span>
            {view.sourceTitle || "（未命名来源）"}
          </span>
          {view.sourceCreatedAt && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{fmtTime(view.sourceCreatedAt)}</span>
          )}
        </div>
      </div>

      {/* 链路时间线 */}
      {view.timeline.length > 0 && (
        <div className="space-y-1.5">
          {view.timeline.map((ev, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="size-1.5 shrink-0 rounded-full bg-primary/70" />
              <span className="text-muted-foreground">{ev.label}</span>
              <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">{fmtTime(ev.at)}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI 整理 / 用户确认 */}
      {(view.organizedAt || view.confirmedAt) && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded-lg border border-border/60 px-2.5 py-1.5">
            <div className="text-muted-foreground">智能整理</div>
            <div className="mt-0.5 font-medium text-foreground">{fmtTime(view.organizedAt)}</div>
          </div>
          <div className="rounded-lg border border-border/60 px-2.5 py-1.5">
            <div className="text-muted-foreground">用户确认</div>
            <div className="mt-0.5 font-medium text-foreground">{fmtTime(view.confirmedAt)}</div>
          </div>
        </div>
      )}

      {/* 产出概要 */}
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {note && <OutputChip icon={<FileText className="size-3" />} text="笔记" count={1} />}
        {tasks.length > 0 && <OutputChip icon={<ListTodo className="size-3" />} text="任务" count={tasks.length} />}
        {reminders.length > 0 && <OutputChip icon={<Bell className="size-3" />} text="提醒" count={reminders.length} />}
        {project && <OutputChip icon={<FolderKanban className="size-3" />} text="项目" count={1} />}
        {!(note || tasks.length || reminders.length || project) && !view.planId && (
          <span className="text-muted-foreground">暂未产出正式对象</span>
        )}
      </div>

      {/* 产出对象明细 */}
      {(note || tasks.length > 0 || reminders.length > 0 || project) && (
        <div className="mt-3 space-y-1">
          {project && <ProjLine p={project} />}
          {note && <NoteLine n={note} onOpenNote={onOpenNote} />}
          {tasks.map((t) => (
            <TaskLine key={t.id} t={t} onOpenTask={onOpenTask} />
          ))}
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
              <Bell className="size-3" /> <span className="truncate">{r.title}</span>
              {r.dueDate && <span className="ml-auto shrink-0 text-[10px]">{r.dueDate}</span>}
            </div>
          ))}
        </div>
      )}

      {/* 操作 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {view.rawContent && (
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10"
          >
            {showRaw ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            查看原始内容
          </button>
        )}
        {view.planId && onOpenPlan && (
          <button
            onClick={() => onOpenPlan(view.planId!)}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
          >
            <Sparkles className="size-3" /> 查看处理计划
          </button>
        )}
        {((note && onOpenNote) || (tasks.length > 0 && onOpenTask)) && (
          <span className="text-[10px] text-muted-foreground">点击明细可跳转查看</span>
        )}
      </div>

      {/* 原始内容展开 */}
      {showRaw && view.rawContent && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {view.rawContent}
        </pre>
      )}
    </div>
  );
}

function OutputChip({ icon, text, count }: { icon: React.ReactNode; text: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/5 px-2 py-0.5 font-medium text-primary">
      {icon} {count} 条{text}
    </span>
  );
}

function NoteLine({ n, onOpenNote }: { n: ProvenanceOutputNote; onOpenNote?: (id: string) => void }) {
  const inner = (
    <>
      <FileText className="size-3 shrink-0" />
      <span className="truncate">{n.title}</span>
    </>
  );
  return onOpenNote ? (
    <button
      onClick={() => onOpenNote(n.id)}
      className="flex w-full items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-left text-xs text-foreground transition hover:bg-primary/10"
    >
      {inner}
      <span className="ml-auto text-[10px] text-primary">查看 →</span>
    </button>
  ) : (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-foreground">{inner}</div>
  );
}

function ProjLine({ p }: { p: ProvenanceOutputProject }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
      <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} />
      <FolderKanban className="size-3 shrink-0" /> <span className="truncate">{p.name}</span>
    </div>
  );
}

function TaskLine({ t, onOpenTask }: { t: ProvenanceOutputTask; onOpenTask?: (id: string) => void }) {
  const inner = (
    <>
      <ListTodo className="size-3 shrink-0" />
      <span className="truncate">{t.title}</span>
      <span
        className={
          "ml-auto shrink-0 text-[10px] " +
          (t.status === "done" ? "text-emerald-500" : t.status === "in_progress" ? "text-blue-500" : "text-muted-foreground")
        }
      >
        {t.status === "done" ? "已完成" : t.status === "in_progress" ? "进行中" : "待处理"}
      </span>
    </>
  );
  return onOpenTask ? (
    <button
      onClick={() => onOpenTask(t.id)}
      className="flex w-full items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-left text-xs text-muted-foreground transition hover:bg-primary/10"
    >
      {inner}
    </button>
  ) : (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-2 py-1 text-xs text-muted-foreground">{inner}</div>
  );
}