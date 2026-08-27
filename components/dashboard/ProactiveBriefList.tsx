"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, EyeOff, Loader2, RefreshCw, Sparkles } from "lucide-react";

// P4-C：主动风险简报（"今天值得关注"推送层）前端区块。
// 最多展示 3 张卡片；无主动建议时保持轻量。控制动作：立即处理 / 明天提醒 / 本周静默 / 忽略。
// 仅消费 /api/brain/active-brief，绝不动 Today Assistant 即有语义。

export interface ProactiveBriefItem {
  id: string;
  type: `proactive_${string}`;
  title: string;
  summary: string;
  severity: "high" | "medium" | "low";
  score: number;
  reasons: string[];
  targetType: string;
  targetId: string;
  projectId: string | null;
  link: string;
  primaryAction: { type: string; label: string };
  generatedAt: number;
}

const TYPE_LABEL: Record<string, string> = {
  proactive_task: "任务",
  proactive_project: "项目风险",
  proactive_plan: "处理计划",
  proactive_inbox: "收件箱",
  proactive_note: "笔记",
  proactive_review: "学习复习",
  proactive_week: "本周计划",
};

const SEV_STYLE: Record<string, string> = {
  high: "border-red-200/60 bg-red-50/50",
  medium: "border-amber-200/70 bg-amber-50/40",
  low: "border-border bg-white",
};
const BADGE_STYLE: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-muted text-muted-foreground",
};

export function ProactiveBriefList() {
  const router = useRouter();
  const [items, setItems] = useState<ProactiveBriefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealIgnore, setRevealIgnore] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brain/active-brief");
      const d = await res.json();
      if (res.ok) setItems(Array.isArray(d?.items) ? d.items : []);
      else setError(d?.error || "加载失败");
    } catch {
      setError("主动建议加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = useCallback(
    async (
      briefId: string,
      action: string,
      scope?: "type" | "object" | "project",
      projectId?: string | null,
    ) => {
      setBusyId(briefId);
      setRevealIgnore(null);
      try {
        await fetch("/api/brain/active-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ briefId, action, scope, projectId }),
        });
      } catch {
        /* 失败留在原状，下一页刷新可见 */
      } finally {
        setBusyId(null);
        await load(true);
      }
    },
    [load],
  );

  // 无主动建议时：不渲染区域，避免空白大卡
  if (!loading && !error && items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">今天值得关注</h2>
        {items.length > 0 && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">
            {items.length}
          </span>
        )}
        <button
          onClick={() => load()}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          aria-label="刷新主动建议"
        >
          <RefreshCw className={"size-3 " + (loading ? "animate-spin" : "")} />
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-4 py-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 正在扫描高优先级风险…
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button onClick={() => load()} className="ml-3 text-xs font-medium underline">
            重试
          </button>
        </div>
      )}

      {items.map((it) => (
        <div
          key={it.id}
          className={"rounded-xl border p-4 shadow-sm transition " + (SEV_STYLE[it.severity] ?? SEV_STYLE.low)}
        >
          <div className="flex items-start gap-2">
            <span
              className={
                "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                (BADGE_STYLE[it.severity] ?? BADGE_STYLE.low)
              }
            >
              {TYPE_LABEL[it.type] ?? it.type.replace("proactive_", "")}
            </span>
            <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">{it.title}</h3>
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{it.summary}</p>

          {it.reasons.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {it.reasons.slice(0, 3).map((r, i) => (
                <span
                  key={i}
                  className="rounded-md bg-background/70 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  {r}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => router.push(it.link)}
              disabled={busyId === it.id}
              className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {it.primaryAction.label || "立即处理"}
            </button>

            <button
              onClick={() => runAction(it.id, "tomorrow", undefined, it.projectId)}
              disabled={busyId === it.id}
              title="明天提醒"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              <CalendarClock className="size-3.5" /> 明天提醒
            </button>

            <button
              onClick={() => runAction(it.id, "silence_week", undefined, it.projectId)}
              disabled={busyId === it.id}
              title="本周不再提示此类"
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              <EyeOff className="size-3.5" /> 静默本周
            </button>

            <button
              onClick={() => setRevealIgnore(revealIgnore === it.id ? null : it.id)}
              disabled={busyId === it.id}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            >
              忽略
            </button>
          </div>

          {revealIgnore === it.id && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>忽略范围：</span>
              <button
                onClick={() => runAction(it.id, "ignore", "type", it.projectId)}
                className="rounded-md bg-muted px-2 py-1 transition hover:bg-muted/70 hover:text-foreground"
              >
                仅此类
              </button>
              <button
                onClick={() => runAction(it.id, "ignore", "object", it.projectId)}
                className="rounded-md bg-muted px-2 py-1 transition hover:bg-muted/70 hover:text-foreground"
              >
                仅此对象
              </button>
              {it.projectId && (
                <button
                  onClick={() => runAction(it.id, "ignore", "project", it.projectId)}
                  className="rounded-md bg-muted px-2 py-1 transition hover:bg-muted/70 hover:text-foreground"
                >
                  仅此项目
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}