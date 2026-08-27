"use client";

/**
 * T3-A —— 分析解读面板（LLM 受控叙述与行动建议）
 *
 * 独立模块，不抢占主内容；LLM 失败 / 超时 / 限流时只影响本面板，确定性结果照常可用。
 *  - fact：只复述确定性结果，必须可[查看依据]；
 *  - inference：表达不确定性（可能 / 疑似）；
 *  - recommendation：基于已有证据的可执行建议；
 *  - insufficient_data：明确说明缺什么数据。
 * 每条带证据引用的发现提供 [查看依据]，点击后定位到对应图表 / 分组 / 明细。
 * 解读不沉淀第二大脑、不创建任务 / 提醒。
 */

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  Link2,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import type { AnalysisNarrative, NarrativeFinding, NarrativeFindingKind } from "@/lib/table/narrative";

const KIND_META: Record<
  NarrativeFindingKind,
  { label: string; cls: string; icon: typeof CheckCircle2 }
> = {
  fact: { label: "事实", cls: "border-sky-200 bg-sky-50 text-sky-800", icon: CheckCircle2 },
  inference: { label: "推断", cls: "border-violet-200 bg-violet-50 text-violet-800", icon: Lightbulb },
  recommendation: { label: "建议", cls: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: Target },
  insufficient_data: { label: "数据不足", cls: "border-amber-200 bg-amber-50 text-amber-800", icon: AlertTriangle },
};

const PRIORITY_LABEL: Record<string, string> = { high: "高", medium: "中", low: "低" };

function FindingCard({
  finding,
  onLocate,
}: {
  finding: NarrativeFinding;
  onLocate: (resultId: string, groupKey?: string) => void;
}) {
  const meta = KIND_META[finding.kind];
  const Icon = meta.icon;
  const targetRef =
    finding.evidenceRefs.find((r) => r.groupKey) ?? finding.evidenceRefs[0];

  return (
    <div className="rounded-xl border border-border/70 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={"flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium " + meta.cls}>
          <Icon className="size-3" />
          {meta.label}
        </span>
        {finding.priority && (
          <span className="rounded bg-muted px-1.5 py-px text-[10px] text-muted-foreground">
            优先级：{PRIORITY_LABEL[finding.priority] ?? finding.priority}
          </span>
        )}
        {finding.kind === "inference" && (
          <span className="text-[10px] text-muted-foreground/70">（推测，非确定性结论）</span>
        )}
      </div>
      <div className="mt-1.5 text-[12px] font-medium text-foreground">{finding.title}</div>
      <div className="mt-0.5 text-[11px] leading-relaxed text-foreground/85">{finding.statement}</div>
      {finding.suggestedAction && (
        <div className="mt-1.5 rounded-lg bg-emerald-50/70 px-2.5 py-1.5 text-[11px] text-emerald-800">
          建议行动：{finding.suggestedAction}
        </div>
      )}
      {finding.limitations && finding.limitations.length > 0 && (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground">
          {finding.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      {targetRef && (
        <button
          onClick={() => onLocate(targetRef.resultId, targetRef.groupKey)}
          className="mt-2 flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
        >
          <Link2 className="size-3" />
          查看依据{targetRef.groupKey ? `（${targetRef.groupKey}）` : ""}
        </button>
      )}
    </div>
  );
}

export function AnalysisNarrativePanel({
  tableId,
  planId,
  resultId,
  onLocate,
}: {
  tableId: string;
  planId: string;
  resultId: string;
  onLocate: (resultId: string, groupKey?: string) => void;
}) {
  const [narrative, setNarrative] = useState<AnalysisNarrative | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "failed">("idle");
  const [error, setError] = useState("");

  const generate = useCallback(
    async (refresh = false) => {
      setStatus("generating");
      setError("");
      try {
        const res = await fetch("/api/brain/table/narrative", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId, planId, resultId, refresh }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || data?.error || "解读生成失败");
        const n = data.narrative as AnalysisNarrative;
        setNarrative(n);
        setStatus(n.status === "ready" ? "ready" : "failed");
      } catch (e) {
        setError((e as Error).message);
        setStatus("failed");
      }
    },
    [tableId, planId, resultId],
  );

  // 面板随 result 挂载：挂载即尝试生成（服务端缓存命中则秒回，不重复调模型）
  // fetch-on-mount：由 status/error 守卫，不会引发级联渲染
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [generate]);

  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="size-3.5 text-primary" />
          分析解读
          <span className="font-normal text-muted-foreground">（基于确定性计算结果，仅作解释）</span>
        </div>
        {status === "ready" && narrative?.retryable && (
          <button
            onClick={() => void generate(true)}
            className="flex items-center gap-1 rounded-md border border-border/60 bg-white px-2 py-1 text-[10px] text-muted-foreground transition hover:border-primary/40 hover:text-primary"
          >
            <RefreshCw className="size-3" /> 重新生成
          </button>
        )}
      </div>

      {status === "generating" && (
        <div className="flex items-center gap-2 py-4 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> 正在生成解读…
        </div>
      )}

      {status === "failed" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="flex-1 break-all">
            解读生成失败{error ? `：${error}` : ""}。图表、明细与证据不受影响，可稍后重试。
          </span>
          <button
            onClick={() => void generate(true)}
            className="flex items-center gap-1 text-amber-700 underline"
          >
            <RefreshCw className="size-3" /> 重试
          </button>
        </div>
      )}

      {status === "ready" && narrative && (
        <div className="mt-2 space-y-2">
          {narrative.executiveSummary && (
            <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-foreground/90">
              {narrative.executiveSummary}
            </div>
          )}
          {narrative.findings.length > 0 ? (
            <div className="space-y-2">
              {narrative.findings.map((f) => (
                <FindingCard key={f.id} finding={f} onLocate={onLocate} />
              ))}
            </div>
          ) : (
            <div className="py-3 text-center text-[11px] text-muted-foreground">暂无可用解读。</div>
          )}
          {narrative.caveats.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[10px] text-muted-foreground/80">
              {narrative.caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
