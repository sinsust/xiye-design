"use client";

import {
  Brain,
  CalendarClock,
  Check,
  ClipboardList,
  GraduationCap,
  Loader2,
  RotateCcw,
  Tags,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KnowledgeGraph } from "@/components/knowledge-graph";
import type { LearningTopic } from "@/lib/brain-path";
import { catColor, nextInHours, relativeTime, SOURCE_ICON } from "./brain-utils";

const OUTCOME_LABEL: Record<string, string> = {
  resolved: "已解决",
  partial: "部分完成",
  new_issue: "新问题",
  no_record: "无需记录",
};

/** 概览浮层：固定右侧面板，展示知识厚度、最近活跃、待复习、周报、行动项、图谱、学习路径 */
interface OverviewThickness {
  activeNoteIds: number;
  allNoteIds: number;
  versioned: number;
  snippetCount: number;
  avgDepth: number;
}

interface OverviewActivityItem {
  kind: string;
  text: string;
  time: string;
}

interface OverviewDueReview {
  id: string;
  noteId: string;
  nextReviewAt: string;
  interval: number;
  easeFactor: number;
  reviewCount: number;
  noteTitle: string;
  noteCategory: string;
}

interface OverviewReport {
  report?: {
    weekLabel: string;
    summary: string;
    completed: string[];
    decisions: string[];
    blockers: string[];
    next: string[];
    taskStats?: {
      completedTasks: number;
      outcomeCount: number;
      resolved: number;
      partial: number;
      newIssue: number;
    };
    outcomeSummaries?: {
      id: string;
      taskId: string;
      status: string;
      summary: string;
    }[];
  };
  source?: { id: string; title: string; category: string; summary: string }[];
}

interface OverviewWeekActionItem {
  text: string;
  owner?: string;
  dueDate?: string;
  noteTitle: string;
}

export interface OverviewPanelProps {
  onClose: () => void;
  thickness: OverviewThickness;
  activity: OverviewActivityItem[];
  activityShowAll: boolean;
  setActivityShowAll: (value: boolean | ((prev: boolean) => boolean)) => void;
  dueReviews: OverviewDueReview[];
  doReview: (id: string, action: "complete" | "skip") => void;
  reviewingId: string | null;
  nextReview: { noteTitle: string; nextReviewAt: string } | null;
  report: OverviewReport | null;
  reportError: boolean;
  generateReport: () => void;
  reporting: boolean;
  weekActionItems: OverviewWeekActionItem[];
  graphEntries: import("@/lib/knowledge-types").KnowledgeEntry[];
  centerEntry: import("@/lib/knowledge-types").KnowledgeEntry | undefined;
  learningTopics: LearningTopic[];
  openTopic: string | null;
  setOpenTopic: (value: string | null) => void;
  /** P3-B：点击周报任务结果摘要 → 打开对应任务详情 */
  onOpenOutcomeTask?: (taskId: string) => void;
}

export function OverviewPanel(props: OverviewPanelProps) {
  const {
    onClose,
    thickness,
    activity,
    activityShowAll,
    setActivityShowAll,
    dueReviews,
    doReview,
    reviewingId,
    nextReview,
    report,
    reportError,
    generateReport,
    reporting,
    weekActionItems,
    graphEntries,
    centerEntry,
    learningTopics,
    openTopic,
    setOpenTopic,
    onOpenOutcomeTask,
  } = props;

  return (
    <div className="fixed right-4 top-20 z-40 flex max-h-[80vh] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <span className="text-sm font-semibold text-foreground">概览</span>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="关闭概览面板"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* 知识厚度 */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="size-3.5" />
            </span>
            知识厚度
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-xl font-semibold leading-none text-foreground">{thickness.activeNoteIds}</div>
              <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">有效笔记<br/>（共 {thickness.allNoteIds} 篇）</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-xl font-semibold leading-none text-foreground">{thickness.versioned}</div>
              <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">版本演化<br/>笔记链数</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-xl font-semibold leading-none text-foreground">{thickness.snippetCount}</div>
              <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">代码片段<br/>已沉淀</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-xl font-semibold leading-none text-foreground">{thickness.avgDepth}</div>
              <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">平均版本深度<br/>×{thickness.allNoteIds} 版本</div>
            </div>
          </div>
        </div>

        {/* 最近活跃流 */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Brain className="size-3.5" />
            </span>
            最近大脑活跃
          </h2>
          <ul className="mt-3 space-y-2.5">
            {activity.length === 0 && (
              <li className="text-xs text-muted-foreground">还没有活动，录入几条笔记试试。</li>
            )}
            {(activityShowAll ? activity : activity.slice(0, 3)).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <span className="mt-px shrink-0 text-[11px]">
                  {item.kind === "tag" ? <Tags className="size-3.5" /> : SOURCE_ICON[item.kind] ?? <ClipboardList className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-foreground">{item.text.trim()}</span>{" "}
                  <span className="text-muted-foreground/70">{item.time}</span>
                </span>
              </li>
            ))}
          </ul>
          {activity.length > 3 && (
            <button
              onClick={() => setActivityShowAll((v) => !v)}
              className="mt-2 text-xs font-medium text-primary transition hover:opacity-80"
            >
              {activityShowAll ? "收起" : `查看更多（${activity.length - 3} 条）`}
            </button>
          )}
        </div>

        {/* 复习提醒（间隔复习/遗忘曲线） */}
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <RotateCcw className="size-3.5" />
            </span>
            <h2 className="text-sm font-semibold text-foreground">今日待复习</h2>
            {dueReviews.length > 0 && (
              <span className="ml-auto rounded-full bg-destructive px-1.5 py-px text-[10px] font-semibold text-white">
                {dueReviews.length}
              </span>
            )}
          </div>

          <div className="mt-3">
            {dueReviews.length === 0 ? (
              <p className="text-xs text-muted-foreground">✅ 今天没有需要复习的笔记</p>
            ) : (
              <ul className="space-y-2">
                {dueReviews.map((r) => (
                  <li key={r.id} className="rounded-[var(--radius)] border border-border/70 bg-muted/20 p-2.5">
                    <div className="truncate text-xs font-medium text-foreground">{r.noteTitle}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      第 {r.reviewCount + 1} 次复习 · 间隔 {r.interval} 天
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => doReview(r.id, "complete")}
                        disabled={reviewingId === r.id}
                      >
                        ✅ 已复习
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => doReview(r.id, "skip")}
                        disabled={reviewingId === r.id}
                      >
                        ⏭ 跳过
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 border-t border-border/70 pt-2 text-[11px] text-muted-foreground">
            {nextReview
              ? `下次复习：${nextInHours(nextReview.nextReviewAt)}${nextReview.noteTitle ? ` · ${nextReview.noteTitle}` : ""}`
              : dueReviews.length > 0
                ? "今日已排期，复习后自动重新排期"
                : "写入笔记后按遗忘曲线自动排期"}
          </div>
        </div>

        {/* 本周周报（独立一行，全宽） */}
        {/* 最近周报摘要 */}
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CalendarClock className="size-3.5" />
              </span>
              本周周报
            </h2>
            <Button variant="outline" size="sm" onClick={generateReport} disabled={reporting}>
              {reporting ? <Loader2 className="size-3 animate-spin" /> : <CalendarClock className="size-3" />}
              {report?.report ? "重生成" : "生成"}
            </Button>
          </div>

          {reportError && <p className="mt-3 text-sm text-destructive">周报生成失败，请稍后重试。</p>}

          {report?.report ? (
            <div className="mt-3 space-y-2.5 border-t border-border pt-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {report.report.weekLabel}
              </span>
              <p className="text-sm font-medium leading-relaxed text-foreground">{report.report.summary}</p>
              <div className="space-y-1.5">
                {report.report.completed.slice(0, 3).map((it, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 inline-block size-1 shrink-0 rounded-full bg-primary" />
                    <span className="line-clamp-1">{it}</span>
                  </div>
                ))}
                {report.report.completed.length > 3 && (
                  <span className="block pt-0.5 text-[11px] text-muted-foreground/70">
                    还有 {report.report.completed.length - 3} 项…
                  </span>
                )}
              </div>
              {/* P3-B：本周任务结果统计与摘要 */}
              {report.report.taskStats && (report.report.taskStats.completedTasks || report.report.taskStats.outcomeCount) && (
                <div className="flex flex-wrap gap-1.5 border-t border-border/60 pt-2.5">
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    完成任务 {report.report.taskStats.completedTasks}
                  </span>
                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    记录结果 {report.report.taskStats.outcomeCount}（已解决 {report.report.taskStats.resolved} · 部分 {report.report.taskStats.partial} · 新问题 {report.report.taskStats.newIssue}）
                  </span>
                </div>
              )}
              {report.report.outcomeSummaries && report.report.outcomeSummaries.length > 0 && (
                <div className="space-y-1 border-t border-border/60 pt-2">
                  {report.report.outcomeSummaries.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => onOpenOutcomeTask?.(o.taskId)}
                      disabled={!onOpenOutcomeTask}
                      className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left text-xs leading-relaxed text-muted-foreground transition hover:bg-muted disabled:cursor-default"
                      title="打开关联任务"
                    >
                      <span className="mt-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground">
                        {OUTCOME_LABEL[o.status] ?? o.status}
                      </span>
                      <span className="line-clamp-2 min-w-0 flex-1">{o.summary}</span>
                    </button>
                  ))}
                </div>
              )}
              {report.source && report.source.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground transition hover:text-primary">
                    依据 {report.source.length} 条笔记
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {report.source.map((s) => (
                      <li key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-block size-1.5 shrink-0 rounded-full" style={{ background: catColor(s.category) }} />
                        {s.title}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ) : (
            <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              本周暂无工作笔记，积累 3 条后可生成周报。
            </div>
          )}
        </div>

        {/* 本周行动项（周报深化：聚合 struct.actionItems） */}
        {weekActionItems.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Check className="size-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-foreground">本周行动项</h2>
              <span className="text-[11px] text-muted-foreground">来自 AI 整理</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {weekActionItems.map((a, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 text-foreground">{a.text}</span>
                  {a.owner && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{a.owner}</span>}
                  {a.dueDate && <span className="text-muted-foreground">{a.dueDate}</span>}
                  <span className="max-w-28 truncate text-[10px] text-muted-foreground/70">{a.noteTitle}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 图谱（独立一行，全宽） */}
        {graphEntries.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Brain className="size-3.5" />
              </span>
              知识图谱
            </div>
            <KnowledgeGraph entries={graphEntries} center={centerEntry} height={288} />
          </div>
        )}

        {/* 学习路径 */}
        {learningTopics.length > 0 && (
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GraduationCap className="size-3.5" />
              </span>
              <h2 className="text-sm font-semibold text-foreground">学习路径</h2>
            </div>
            <div className="space-y-3">
              {learningTopics.map((t) => {
                const open = openTopic === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setOpenTopic(open ? null : t.key)}
                    className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius)] text-base"
                        style={{ background: `color-mix(in srgb, ${t.color} 14%, transparent)` }}
                      >
                        {t.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{t.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t.count} 篇笔记 · 最近 {relativeTime(t.lastAt)}
                        </span>
                      </span>
                      <span className="text-xs font-semibold" style={{ color: t.color }}>
                        {t.count}
                      </span>
                    </div>
                    {open && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="relative space-y-2.5 pl-4">
                          <span className="absolute bottom-1 left-1 top-1 w-px" style={{ background: `color-mix(in srgb, ${t.color} 40%, transparent)` }} />
                          {t.notes.slice(-4).map((n) => (
                            <div key={n.id} className="relative">
                              <span className="absolute -left-[13.5px] top-1.5 size-2 rounded-full border-2 border-background" style={{ background: t.color }} />
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium text-foreground">{n.title}</div>
                                {n.summary && (
                                  <div className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{n.summary}</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {!open && t.count > 4 && (
                          <div className="mt-2 text-[11px] text-muted-foreground">还有 {t.count - 4} 篇…</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}