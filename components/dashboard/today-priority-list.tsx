"use client";

import { useState } from "react";
import { SquareArrowOutUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TodayBrief, TodayPriorityItem } from "@/lib/brain-priority";

const LEVEL_META: Record<TodayPriorityItem["priority"], { label: string; bar: string; badge: string }> = {
  critical: { label: "紧急", bar: "#ef4444", badge: "bg-red-500/10 text-red-600" },
  high: { label: "高", bar: "#f59e0b", badge: "bg-amber-500/10 text-amber-600" },
  normal: { label: "普通", bar: "#9ca3af", badge: "bg-muted text-muted-foreground" },
};

export interface TodayPriorityListProps {
  items: TodayBrief["priorities"];
  onAction: (action: TodayPriorityItem["primaryAction"]["action"], targetId: string) => void;
}

export function TodayPriorityList({ items, onAction }: TodayPriorityListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!items.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">今天最重要的事</h2>
        <p className="mt-3 text-sm text-muted-foreground">🎉 目前没有需要优先处理的事项</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        今天最重要的事
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
          {items.length}
        </span>
      </h2>
      <div className="mt-3 space-y-2.5">
        {items.map((it) => {
          const meta = LEVEL_META[it.priority];
          const expanded = expandedId === it.id;
          return (
            <div key={it.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
              {/* 可点击展开区：标题 + 摘要 + 原因（点击原地展开详情，不跳页） */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedId(expanded ? null : it.id);
                  }
                }}
                className="cursor-pointer select-none rounded-md outline-none focus-visible:ring-1 focus-visible:ring-primary"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 size-2 shrink-0 rounded-full" style={{ background: meta.bar }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground">{it.title}</span>
                      <span className={"shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold " + meta.badge}>
                        {meta.label}
                      </span>
                      {it.score > 0 && (
                        <span className="ml-auto shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          分值 {it.score}
                        </span>
                      )}
                    </div>
                    {it.summary && <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{it.summary}</div>}
                    {it.dueAt && <div className="mt-0.5 text-[11px] text-muted-foreground">截止：{it.dueAt}</div>}
                    {it.reasons.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {it.reasons.slice(0, expanded ? it.reasons.length : 3).map((r, idx) => (
                          <li key={idx} className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
                            <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/50" />
                            <span>{r}</span>
                          </li>
                        ))}
                        {!expanded && it.reasons.length > 3 && (
                          <li className="text-[11px] text-primary">+{it.reasons.length - 3} 条原因</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* 展开详情：全量原因 + 元信息 + 去完整页入口（内联，不跳页） */}
              {expanded && (
                <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/50 p-3 text-[12px]">
                  <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                    <span className="text-muted-foreground">优先级</span>
                    <span className="text-foreground">{meta.label}</span>
                    <span className="text-muted-foreground">分值</span>
                    <span className="text-foreground">{it.score}</span>
                    {it.dueAt && (
                      <>
                        <span className="text-muted-foreground">截止</span>
                        <span className="text-foreground">{it.dueAt}</span>
                      </>
                    )}
                    <span className="text-muted-foreground">动作类型</span>
                    <span className="text-foreground">{it.primaryAction.action}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAction(it.primaryAction.action, it.primaryAction.targetId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    打开完整详情
                    <SquareArrowOutUpRight className="size-3.5" />
                  </button>
                </div>
              )}

              <div className="mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={() => onAction(it.primaryAction.action, it.primaryAction.targetId)}
                >
                  {it.primaryAction.label}
                  <SquareArrowOutUpRight className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
