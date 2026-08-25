import {
  Check,
  ClipboardList,
  Copy,
  Pencil,
  RotateCcw,
  Target,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrainStrategy, BrainTask } from "@/lib/brain-db";
import {
  STRATEGY_COLOR,
  STRATEGY_LABEL,
  SOURCE_ICON,
  catColor,
  formatDueDate,
  highlightCode,
  langColor,
  langLabel,
  nowDateStr,
  relativeTime,
  snippetPreview,
} from "./brain-utils";
import type { BrainNote } from "./types";

export function NoteCard({
  note,
  tasks,
  strategies,
  versions,
  expanded,
  confirmDelete,
  copiedCode,
  onToggle,
  onEdit,
  onDeletePress,
  onToggleTask,
  onUpgrade,
  onCopyCode,
}: {
  note: BrainNote;
  tasks: BrainTask[];
  strategies: BrainStrategy[];
  versions: BrainNote[];
  expanded: boolean;
  confirmDelete: boolean;
  copiedCode: string | null;
  onToggle: () => void;
  onEdit: () => void;
  onDeletePress: () => void;
  onToggleTask: (id: string, done: boolean) => void;
  onUpgrade: () => void;
  onCopyCode: (code: string, id: string) => void;
}) {
  const openCount = tasks.filter((t) => t.status !== "done").length;
  return (
    <div
      id={`note-${note.id}`}
      className="pv-lift group relative cursor-pointer rounded-[var(--radius)] border border-border bg-card shadow-sm"
      onClick={onToggle}
    >
      {/* 顶部：分类色块 + 来源图标 + 任务徽标 + hover 操作 */}
      <div className="flex items-center gap-2 px-3.5 pt-3">
        {note.isSnippet && (
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
            style={{ background: langColor(note.language) }}
          >
            {langLabel(note.language)}
          </span>
        )}
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: catColor(note.category) }}
        />
        <span className="text-xs font-medium text-muted-foreground">{note.category || "随手记"}</span>
        {tasks.length > 0 && (
          <span
            className={
              "inline-flex items-center gap-1 rounded-[var(--radius)] px-1.5 py-0.5 text-[11px] font-medium " +
              (openCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")
            }
            title={`${openCount} 项待处理 / ${tasks.length} 项任务`}
          >
            {openCount > 0 ? (<><ClipboardList className="size-3" />{openCount}/{tasks.length}</>) : (<><Check className="size-3" />完成</>)}
          </span>
        )}
        {strategies.length > 0 && (
          <span
            className="inline-flex items-center gap-1 rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
            title={`关联 ${strategies.length} 个策略`}
          >
            <Target className="size-3" />{strategies.length}
          </span>
        )}
        {/* 版本标识：已归档 / 版本号 */}
        {note.superseded ? (
          <span
            className="inline-flex items-center rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            title="已被更高版本取代"
          >
            已归档
          </span>
        ) : note.version > 1 ? (
          <span
            className="inline-flex items-center rounded-[var(--radius)] bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
            title={`第 ${note.version} 版`}
          >
            v{note.version}
          </span>
        ) : null}
        <span className="ml-auto text-sm leading-none">{SOURCE_ICON[note.source] ?? <ClipboardList className="size-3.5" />}</span>
        <span className="relative flex items-center gap-0.5 pl-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            className="rounded-[var(--radius)] p-1.5 text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
            onClick={(ev) => {
              ev.stopPropagation();
              onEdit();
            }}
            aria-label="编辑"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            className={
              "rounded-[var(--radius)] p-1.5 transition " +
              (confirmDelete
                ? "bg-destructive/10 text-destructive"
                : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")
            }
            onClick={(ev) => {
              ev.stopPropagation();
              onDeletePress();
            }}
            aria-label={confirmDelete ? "确认删除" : "删除"}
          >
            {confirmDelete ? <Check className="size-3.5" /> : <Trash2 className="size-3.5" />}
          </button>
        </span>
      </div>

      {/* 中部：标题 + 两行摘要 */}
      <div className="px-3.5 pt-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{note.title}</h3>
          {note.isSnippet && note.codeContent && (
            <button
              className="inline-flex shrink-0 items-center gap-1 rounded-[var(--radius)] border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
              onClick={(ev) => {
                ev.stopPropagation();
                onCopyCode(note.codeContent!, note.id);
              }}
              title="复制代码"
            >
              {copiedCode === note.id ? (<><Check className="size-3" />已复制</>) : (<><Copy className="size-3" />复制</>)}
            </button>
          )}
        </div>
        {note.summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{note.summary}</p>
        )}
        {/* 代码片段预览：monospace + 深色背景，前 5 行 */}
        {note.isSnippet && note.codeContent && (
          <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-[#0f172a] px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-200">
            <code>{highlightCode(snippetPreview(note.codeContent, expanded ? 40 : 5))}</code>
          </pre>
        )}
      </div>

      {/* 底部：标签 + 相对时间 */}
      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-3 pt-2.5">
        {note.tags.slice(0, 2).map((t) => (
          <span key={t} className="rounded-[var(--radius)] bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
            #{t}
          </span>
        ))}
        {note.tags.length > 2 && (
          <span className="text-[11px] text-muted-foreground">+{note.tags.length - 2}</span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{relativeTime(note.createdAt)}</span>
      </div>

      {/* 展开原文 */}
      {expanded && (
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap border-t border-border/70 bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {note.content}
        </pre>
      )}

      {/* 展开关联策略 */}
      {expanded && strategies.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">关联策略（{strategies.length}）</div>
          <div className="space-y-1">
            {strategies.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span
                  className="inline-block size-1.5 shrink-0 rounded-full"
                  style={{ background: STRATEGY_COLOR[s.status] }}
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{s.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{STRATEGY_LABEL[s.status]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 展开关联任务：直接勾选完成 */}
      {expanded && tasks.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 text-[11px] font-semibold text-foreground">
            关联任务（{tasks.filter((t) => t.status !== "done").length}/{tasks.length}）
          </div>
          <div className="space-y-1.5">
            {tasks.map((tk) => (
              <label key={tk.id} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={tk.status === "done"}
                  onChange={(ev) => {
                    ev.stopPropagation();
                    onToggleTask(tk.id, ev.target.checked);
                  }}
                  className="accent-[var(--primary)]"
                />
                <span className={tk.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}>
                  {tk.title}
                </span>
                {tk.dueDate && tk.status !== "done" && (
                  <span
                    className={
                      "ml-auto text-[11px] " +
                      (tk.dueDate < nowDateStr() ? "text-destructive" : "text-muted-foreground")
                    }
                  >
                    {formatDueDate(tk.dueDate)}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 展开版本时间线 + 升级按钮 */}
      {expanded && versions.length > 0 && (
        <div className="border-t border-border/70 px-4 py-2.5">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground">版本时间线（{versions.length}）</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{note.version ? `当前 v${note.version}` : ""}</span>
          </div>
          <div className="flex items-center gap-0">
            {versions.map((v, i) => {
              const isCurrent = v.id === note.id;
              return (
                <div key={v.id} className="flex min-w-0 items-center">
                  <div
                    className={
                      "flex flex-col items-center " +
                      (i === versions.length - 1 ? "" : "flex-1")
                    }
                  >
                    <div
                      className={
                        "size-2.5 rounded-full border border-background " +
                        (isCurrent ? "bg-primary" : v.superseded ? "bg-muted-foreground/60" : "bg-muted-foreground/30")
                      }
                    />
                    <span
                      className={
                        "mt-0.5 whitespace-nowrap text-[10px] " +
                        (isCurrent ? "font-semibold text-primary" : "text-muted-foreground")
                      }
                    >
                      v{v.version}
                    </span>
                  </div>
                  {i < versions.length - 1 && (
                    <div className="mx-0.5 mb-4 h-px flex-1 bg-border" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">初版 → 最新（点击卡片名可切换）</div>
        </div>
      )}
      {expanded && !note.superseded && (
        <div className="border-t border-border/70 px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs"
            onClick={(ev) => {
              ev.stopPropagation();
              onUpgrade();
            }}
          >
            <RotateCcw className="size-3" /> 升级为新版
          </Button>
        </div>
      )}
    </div>
  );
}