import { X } from "lucide-react";
import type { BrainTaskPriority } from "@/lib/brain-db";
import { TYPE_LABEL } from "./types";
import type { OrganizedActionItem, StructViewData } from "./types";

/** 按输入类型自适应渲染 AI 结构化结果；无内容返回 null。传 onActionItemsChange 时行动项可编辑（工作台用），否则只读 */
export function StructPreview({ d, onActionItemsChange }: { d: StructViewData; onActionItemsChange?: (items: OrganizedActionItem[]) => void }) {
  const type = d.type || "jotting";
  const ai = d.actionItems ?? [];
  const kp = d.keyPoints ?? [];
  const ins = d.insights ?? [];
  const has =
    (d.attendees?.length || 0) +
    (d.metrics?.length || 0) +
    (d.problemDomains?.length || 0) +
    ai.length +
    (d.strategy?.length || 0) +
    (d.openQuestions?.length || 0) +
    (d.decisions?.length || 0) +
    kp.length +
    ins.length +
    (d.source ? 1 : 0);
  if (!has) return null;

  const sectionTitle = (t: string) => (
    <div className="mb-1 text-xs font-medium text-foreground">{t}</div>
  );

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-border p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">AI 结构化拆解</div>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
          {TYPE_LABEL[type] || "随手记"}
        </span>
      </div>

      {/* 参会人 + 指标 chips：有则展示（会议/粘贴类常见） */}
      {(d.attendees?.length || d.metrics?.length) ? (
        <div className="flex flex-wrap gap-1.5">
          {(d.attendees ?? []).map((a) => (
            <span key={a} className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
              {a}
            </span>
          ))}
          {(d.metrics ?? []).map((m, i) => (
            <span key={i} className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-foreground">
              <span className="text-muted-foreground">{m.label}</span>{" "}
              <span className="font-semibold">{m.value}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* 问题域表（会议） */}
      {(d.problemDomains?.length || 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="border border-border px-2 py-1 font-medium">问题域</th>
                <th className="border border-border px-2 py-1 font-medium">现状 / 痛点</th>
                <th className="border border-border px-2 py-1 font-medium">结论 / 待决策</th>
              </tr>
            </thead>
            <tbody>
              {(d.problemDomains ?? []).map((p, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap border border-border px-2 py-1 font-medium text-foreground">
                    {p.domain}
                  </td>
                  <td className="border border-border px-2 py-1 text-muted-foreground">{p.status}</td>
                  <td className="border border-border px-2 py-1 text-foreground">{p.conclusion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 会议决议 */}
      {(d.decisions?.length || 0) > 0 && (
        <div>
          {sectionTitle("会议决议")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
            {(d.decisions ?? []).map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 来源（clip） */}
      {d.source ? (
        <div>
          {sectionTitle("来源")}
          <p className="break-all text-xs text-muted-foreground">{d.source}</p>
        </div>
      ) : null}

      {/* 核心观点 / 要点（clip / jotting） */}
      {kp.length > 0 && (
        <div>
          {sectionTitle(type === "clip" ? "核心观点" : "要点")}
          <ul className="space-y-1">
            {kp.map((k, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-foreground"
              >
                <span className="mt-0.5 text-primary">•</span>
                <span className="flex-1">{k.point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 我的批注 / 灵感 */}
      {ins.length > 0 && (
        <div>
          {sectionTitle(type === "clip" ? "我的批注与启发" : "灵感")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {ins.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 行动项：所有类型通用；工作台可编辑，详情只读 */}
      {ai.length > 0 && (
        <div>
          {sectionTitle("行动项")}
          {onActionItemsChange ? (
            <div className="space-y-1.5">
              {ai.map((a, i) => (
                <div key={i} className="space-y-1 rounded-md border border-border bg-muted/40 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <input
                      value={a.text}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], text: ev.target.value };
                        onActionItemsChange(next);
                      }}
                      className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1"
                      placeholder="行动内容"
                    />
                    <button
                      onClick={() => onActionItemsChange(ai.filter((_, j) => j !== i))}
                      className="shrink-0 text-muted-foreground transition hover:text-destructive"
                      aria-label="删除行动项"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      value={a.owner ?? ""}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], owner: ev.target.value };
                        onActionItemsChange(next);
                      }}
                      className="w-20 rounded border border-border bg-background px-1.5 py-0.5"
                      placeholder="负责人"
                    />
                    <input
                      type="date"
                      value={a.dueDate ?? ""}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], dueDate: ev.target.value || null };
                        onActionItemsChange(next);
                      }}
                      className="rounded border border-border bg-background px-1.5 py-0.5"
                    />
                    <select
                      value={a.priority}
                      onChange={(ev) => {
                        const next = [...ai];
                        next[i] = { ...next[i], priority: ev.target.value as BrainTaskPriority };
                        onActionItemsChange(next);
                      }}
                      className="rounded border border-border bg-background px-1 py-0.5 uppercase"
                    >
                      <option value="high">high</option>
                      <option value="medium">medium</option>
                      <option value="low">low</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                onClick={() =>
                  onActionItemsChange([...ai, { text: "", owner: "", dueDate: null, priority: "medium" }])
                }
                className="text-xs text-primary transition hover:opacity-80"
              >
                + 添加行动项
              </button>
            </div>
          ) : (
            <ul className="space-y-1">
              {ai.map((a, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
                >
                  <span className="text-foreground">{a.text}</span>
                  {a.owner && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{a.owner}</span>}
                  {a.dueDate && <span className="text-muted-foreground">{a.dueDate}</span>}
                  <span className="uppercase text-muted-foreground">{a.priority}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 策略规划建议（meeting） */}
      {(d.strategy?.length || 0) > 0 && (
        <div>
          {sectionTitle("策略规划建议")}
          <div className="space-y-1.5">
            {(d.strategy ?? []).map((s, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <div className="text-xs font-semibold text-foreground">{s.angle}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{s.logic}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 待决策 / 风险 */}
      {(d.openQuestions?.length || 0) > 0 && (
        <div>
          {sectionTitle("待决策 / 风险")}
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
            {(d.openQuestions ?? []).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}