"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  FolderPlus,
  Inbox,
  Layers,
  ListTodo,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvenancePanel, type ProvenanceAnchor } from "@/components/brain/ProvenancePanel";

// —— 类型（与后端 /api/brain/inbox 对齐）——
type InboxIntent = "note" | "task" | "meeting" | "snippet" | "project" | "unknown";

// P2-A：收件箱状态机
type InboxStatus =
  | "pending"
  | "processing"
  | "pending_confirmation"
  | "converted"
  | "processed"
  | "dismissed"
  | "failed";

export interface InboxItem {
  id: string;
  rawContent: string;
  intent: InboxIntent | null;
  confidence: number;
  suggestedTitle?: string;
  suggestedCategory?: string;
  suggestedTags?: string[];
  // —— P2-A 状态与来源/产出链路 ——
  status?: InboxStatus;
  initialStatus?: InboxStatus;
  processingPlanId?: string | null;
  noteId?: string | null;
  outputTaskIds?: string[];
  outputReminderIds?: string[];
  outputProjectId?: string | null;
  convertedAt?: number | null;
  failedReason?: string | null;
}

const STATUS_META: Record<InboxStatus, { label: string; cls: string }> = {
  pending: { label: "待处理", cls: "bg-muted text-muted-foreground" },
  processing: { label: "整理中", cls: "bg-amber-500/15 text-amber-600 animate-pulse" },
  pending_confirmation: { label: "待确认", cls: "bg-indigo-500/15 text-indigo-600" },
  converted: { label: "已转化", cls: "bg-emerald-500/15 text-emerald-600" },
  processed: { label: "已处理", cls: "bg-sky-500/15 text-sky-600" },
  dismissed: { label: "已忽略", cls: "bg-muted text-muted-foreground/70" },
  failed: { label: "处理失败", cls: "bg-red-500/15 text-red-600" },
};

const INTENT_META: Record<InboxIntent, { icon: string; label: string; cls: string }> = {
  note: { icon: "📝", label: "笔记", cls: "bg-sky-500/10 text-sky-600" },
  task: { icon: "📋", label: "任务", cls: "bg-blue-500/10 text-blue-600" },
  meeting: { icon: "🗓", label: "会议纪要", cls: "bg-violet-500/10 text-violet-600" },
  snippet: { icon: "💻", label: "代码片段", cls: "bg-emerald-500/10 text-emerald-600" },
  project: { icon: "📁", label: "项目", cls: "bg-amber-500/10 text-amber-600" },
  unknown: { icon: "❓", label: "待识别", cls: "bg-muted text-muted-foreground" },
};

const INTENT_OPTIONS: { value: InboxIntent; label: string }[] = [
  { value: "note", label: "📝 笔记" },
  { value: "task", label: "📋 任务" },
  { value: "meeting", label: "🗓 会议纪要" },
  { value: "snippet", label: "💻 代码片段" },
  { value: "project", label: "📁 项目" },
];

const DEFAULT_CATEGORIES = ["工作", "学习", "技术", "设计", "生活", "灵感", "随手记"];

interface EditState {
  title: string;
  category: string;
  tags: string[];
  intent: InboxIntent;
}

export function InboxDrawer({
  open,
  onClose,
  onPendingChange,
  onOpenPlan,
  onOpenNote,
  onOpenTask,
}: {
  open: boolean;
  onClose: () => void;
  onPendingChange: (n: number) => void;
  onOpenPlan?: (planId: string) => void;
  onOpenNote?: (noteId: string) => void;
  onOpenTask?: (taskId: string) => void;
}) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [submittingBatch, setSubmittingBatch] = useState(false);
  // 正在处理 / 正在修改的条目 id
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: EditState } | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState("");
  // P2-A：展开查看「来源与关联」/ 已转化产物明细的条目 id
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/inbox");
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setItems(data.items);
        // 徽标统计「可处理」条目（待处理 / 整理中 / 待确认 / 失败），已转化/已忽略不计数
        const actionable = data.items.filter((i: InboxItem) =>
          i.status === "pending" || i.status === "processing" || i.status === "pending_confirmation" || i.status === "failed",
        ).length;
        onPendingChange(actionable);
      } else {
        setError(data?.error || "加载收件箱失败");
      }
    } catch {
      setError("收件箱加载失败");
    } finally {
      setLoading(false);
    }
  }, [onPendingChange]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // 提交批量输入：按空行拆分 → POST /inbox → 刷新列表
  const submitBatch = async () => {
    const blocks = batchText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    if (!blocks.length || submittingBatch) return;
    setSubmittingBatch(true);
    setError("");
    try {
      const res = await fetch("/api/brain/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: blocks.map((rawContent) => ({ rawContent })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "提交失败");
      setBatchText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // 单条处理
  const processOne = async (item: InboxItem, action: "confirm" | "edit" | "dismiss", overrides: Record<string, unknown> = {}) => {
    setBusy(item.id);
    setError("");
    try {
      const res = await fetch(`/api/brain/inbox/${item.id}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, overrides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "处理失败");
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setEditing(null);
      onPendingChange(Math.max(0, items.length - 1));
    } catch (e) {
      setError(e instanceof Error ? e.message : "处理失败");
    } finally {
      setBusy(null);
    }
  };

  // P2-A：失败的收件箱条目重试整理（走统一 organize→plans 闭环）
  const retryOrganize = async (item: InboxItem) => {
    setBusy(item.id);
    setError("");
    try {
      const res = await fetch("/api/brain/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inboxId: item.id, source: "inbox" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "重新整理失败");
      await load();
      // 生成待确认计划后，引导用户直接确认
      const planId = data.plan?.id ?? data.planId;
      if (planId && onOpenPlan) onOpenPlan(planId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "重新整理失败");
    } finally {
      setBusy(null);
    }
  };

  // 批量处理
  const batchProcess = async (action: "confirm" | "dismiss") => {
    if (!items.length) return;
    setBusy("__all__");
    setError("");
    try {
      const res = await fetch("/api/brain/inbox/batch-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items
            .filter((i) => i.status === "pending" || i.status === "processing" || i.status === "pending_confirmation" || i.status === "failed")
            .map((i) => ({ id: i.id, action })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "批量处理失败");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "批量处理失败");
    } finally {
      setBusy(null);
    }
  };

  const startEdit = (item: InboxItem) => {
    setEditing({
      id: item.id,
      draft: {
        title: item.suggestedTitle || item.rawContent.slice(0, 50),
        category: item.suggestedCategory || "未分类",
        tags: item.suggestedTags || [],
        intent: item.intent && item.intent !== "unknown" ? item.intent : "note",
      },
    });
  };

  // 可处理条目数（待处理 / 整理中 / 待确认 / 失败）
  const actionableCount = items.filter(
    (i) => i.status === "pending" || i.status === "processing" || i.status === "pending_confirmation" || i.status === "failed",
  ).length;

  return (
    <div
      className={
        "fixed inset-0 z-50 " + (open ? "" : "pointer-events-none")
      }
      aria-hidden={!open}
      // 关闭时 inert：屏幕阅读器 + 焦点 + 点击全部跳过（React 19 原生支持的 HTML 属性）
      inert={!open}
    >
      {/* 遮罩：直接出现/消失（无过渡动画） */}
      <div
        className={
          "absolute inset-0 bg-black/30 " + (open ? "opacity-100 animate-in fade-in duration-200" : "pointer-events-none opacity-0")
        }
        onClick={onClose}
      />
      {/* 抽屉主体：直接出现（无位移动画）；关闭态 display:none，彻底脱离视口与布局 */}
      <aside
        className={
          "absolute right-0 top-0 flex h-full w-[540px] max-w-full flex-col bg-card shadow-2xl " +
          (open ? "animate-in slide-in-from-right-[28px] fade-in duration-200 ease-out" : "hidden")
        }
      >
        {/* 头部 */}
        <div className="flex items-center justify-between border-b border-border/70 bg-card px-5 py-3.5">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Inbox className="size-4.5 text-primary" />
            收件箱
            {actionableCount > 0 && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-600">
                {actionableCount} 条待处理
              </span>
            )}
          </div>
          <button onClick={onClose} className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="关闭">
            <X className="size-4" />
          </button>
        </div>

        {/* 批量输入 */}
        <div className="border-b border-border/70 bg-card px-5 py-3">
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="粘贴多条内容，每段之间空一行，AI 自动拆分…"
              className="max-h-[140px] min-h-[64px] w-full resize-y rounded-md border border-muted bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
              rows={2}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">先预览再落库，确认后才写入笔记</span>
              <Button size="sm" onClick={submitBatch} disabled={!batchText.trim() || submittingBatch}>
                {submittingBatch ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                拆分并预览
              </Button>
            </div>
          </div>
        </div>

        {error && <div className="border-b border-destructive/20 bg-destructive/5 px-5 py-2 text-xs text-destructive">{error}</div>}

        {/* 列表 */}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> 加载中…
            </div>
          )}
          {!loading && items.length === 0 && (
            <div className="py-14 text-center">
              <Inbox className="mx-auto size-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">收件箱是空的，没有待处理条目</p>
              <p className="mt-1 text-xs text-muted-foreground/70">批量粘贴内容，AI 会自动拆分、分类并建议标题</p>
            </div>
          )}
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-card p-3.5 shadow-sm">
              {/* 意图 + 置信度 + 状态 */}
              <div className="mb-2 flex items-center gap-2">
                <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " + (INTENT_META[item.intent ?? "unknown"]?.cls)}>
                  {INTENT_META[item.intent ?? "unknown"]?.icon}{" "}
                  {INTENT_META[item.intent ?? "unknown"]?.label}
                </span>
                {item.confidence > 0 && item.status !== "converted" && item.status !== "dismissed" && (
                  <span className="text-[11px] text-muted-foreground">置信度 {Math.round(item.confidence * 100)}%</span>
                )}
                <span className={"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium " + (STATUS_META[item.status ?? "pending"]?.cls ?? STATUS_META.pending.cls)}>
                  {STATUS_META[item.status ?? "pending"]?.label ?? "待处理"}
                </span>
              </div>

              {/* 原文预览 */}
              <div className="whitespace-pre-wrap break-words rounded-md bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
                {item.rawContent.length > 220 ? item.rawContent.slice(0, 220) + "…" : item.rawContent}
              </div>

              {/* 编辑模式 */}
              {editing?.id === item.id ? (
                <div className="mt-2 space-y-2">
                  <input
                    value={editing.draft.title}
                    onChange={(e) => setEditing({ ...editing, draft: { ...editing.draft, title: e.target.value } })}
                    placeholder="标题"
                    className="w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary"
                  />
                  <div className="flex flex-wrap gap-1">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <button
                        key={c}
                        onClick={() => setEditing({ ...editing, draft: { ...editing.draft, category: c } })}
                        className={
                          "rounded-full px-2 py-0.5 text-[11px] transition " +
                          (editing.draft.category === c ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(editing.draft.tags || []).map((t) => (
                      <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                        {t}
                        <button onClick={() => setEditing({ ...editing, draft: { ...editing.draft, tags: editing.draft.tags.filter((x) => x !== t) } })}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && tagInput.trim()) {
                          e.preventDefault();
                          if (!editing.draft.tags.includes(tagInput.trim())) {
                            setEditing({ ...editing, draft: { ...editing.draft, tags: [...editing.draft.tags, tagInput.trim()] } });
                          }
                          setTagInput("");
                        }
                      }}
                      placeholder="+ 标签"
                      className="w-20 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">类型</span>
                    <div className="flex flex-wrap gap-1">
                      {INTENT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setEditing({ ...editing, draft: { ...editing.draft, intent: opt.value } })}
                          className={
                            "rounded-full px-2 py-0.5 text-[11px] transition " +
                            (editing.draft.intent === opt.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setEditing(null)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() =>
                        processOne(item, "edit", {
                          title: editing.draft.title,
                          category: editing.draft.category,
                          tags: editing.draft.tags,
                          intent: editing.draft.intent,
                        })
                      }
                    >
                      <Check className="size-3.5" /> 保存
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* AI 建议 */}
                  {(item.suggestedTitle || item.suggestedCategory || item.suggestedTags?.length) && (
                    <div className="mt-2 space-y-0.5 rounded-md bg-primary/5 px-3 py-2 text-xs">
                      {item.suggestedTitle && (
                        <div className="truncate text-foreground">
                          <span className="text-muted-foreground">建议标题：</span>
                          {item.suggestedTitle}
                        </div>
                      )}
                      {item.suggestedCategory && (
                        <div className="text-muted-foreground">
                          建议分类：<span className="font-medium text-foreground">{item.suggestedCategory}</span>
                        </div>
                      )}
                      {item.suggestedTags?.length ? (
                        <div className="text-muted-foreground">
                          标签：{item.suggestedTags.slice(0, 4).map((t) => (
                            <span key={t} className="mr-1.5 inline-block rounded bg-secondary px-1.5 py-px text-[11px] text-secondary-foreground">{t}</span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                  {/* P2-A：状态与去向展示 */}
                  {item.status === "converted" && (item.noteId || (item.outputTaskIds?.length ?? 0) > 0) && (
                    <div className="mt-2 space-y-1 rounded-md bg-emerald-500/5 px-3 py-2 text-xs">
                      <div className="text-emerald-700">已转化</div>
                      <div className="space-y-0.5">
                        {item.noteId && (
                          <button
                            onClick={() => onOpenNote?.(item.noteId!)}
                            className="flex items-center gap-1.5 text-foreground transition hover:text-primary"
                          >
                            <FileText className="size-3.5 text-emerald-600" /> → 笔记
                          </button>
                        )}
                        {(item.outputTaskIds?.length ?? 0) > 0 && (
                          <button
                            onClick={() => onOpenTask?.(item.outputTaskIds![0])}
                            className="flex items-center gap-1.5 text-foreground transition hover:text-primary"
                          >
                            <ListTodo className="size-3.5 text-emerald-600" /> → {item.outputTaskIds!.length} 项任务
                          </button>
                        )}
                        {(item.outputReminderIds?.length ?? 0) > 0 && (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Bell className="size-3.5 text-emerald-600" /> → {item.outputReminderIds!.length} 个提醒
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {item.status === "failed" && (
                    <div className="mt-2 rounded-md bg-red-500/5 px-3 py-2 text-[11px] text-red-600">
                      {item.failedReason || "处理失败"}，可重试整理
                    </div>
                  )}

                  {/* 操作按钮（按状态路由到统一闭环） */}
                  <div className="mt-3 flex items-center gap-1.5">
                    {item.status === "converted" || item.status === "processed" || item.status === "dismissed" ? (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpenPanel((v) => (v === item.id ? null : item.id))}>
                        <Layers className="size-3.5" /> 来源与关联
                      </Button>
                    ) : item.status === "failed" ? (
                      <Button size="sm" className="flex-1" disabled={busy !== null} onClick={() => retryOrganize(item)}>
                        {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                        重试整理
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="flex-1"
                          disabled={busy !== null}
                          onClick={() => (item.processingPlanId && onOpenPlan ? onOpenPlan(item.processingPlanId) : processOne(item, "confirm"))}
                        >
                          {busy === item.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                          {item.processingPlanId && onOpenPlan ? "查看并确认" : "确认"}
                        </Button>
                        {!item.processingPlanId && (
                          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => startEdit(item)}>
                            <Pencil className="size-3.5" /> 修改
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={busy !== null} onClick={() => processOne(item, "dismiss")}>
                          <Trash2 className="size-3.5" /> 忽略
                        </Button>
                      </>
                    )}
                  </div>

                  {/* P2-A：来源与关联面板（收件箱锚点） */}
                  {openPanel === item.id && (
                    <div className="mt-3">
                      <ProvenancePanel
                        anchor={{ inboxId: item.id } as ProvenanceAnchor}
                        onOpenNote={onOpenNote}
                        onOpenTask={onOpenTask}
                        onOpenPlan={onOpenPlan}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* 底部批量操作 */}
        {actionableCount > 0 && (
          <div className="flex items-center justify-between gap-2 border-t border-border/70 bg-card px-5 py-3">
            <span className="text-xs text-muted-foreground">{actionableCount} 条待处理</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => batchProcess("dismiss")}>
                全部忽略
              </Button>
              <Button size="sm" disabled={busy !== null} onClick={() => batchProcess("confirm")}>
                {busy === "__all__" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                全部确认
              </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}