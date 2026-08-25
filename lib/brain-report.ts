// 第二大脑 · 自动周报管线：从用户本月的笔记里按"本周"筛选出工作类相关记录，
// 让 LLM 提炼成结构化周报（本周完成 / 关键决策 / 问题与阻塞 / 下周计划）。
// 优先 Qwen，失败/未配置时回退启发式聚合，保证始终能出可用报告。

import type { BrainNote } from "./brain-db";

export interface WeeklyReport {
  weekLabel: string;        // 如 "08.18 - 08.24"
  summary: string;          // 一句话总览
  completed: string[];      // 本周完成
  decisions: string[];      // 关键决策
  blockers: string[];       // 问题与阻塞
  next: string[];           // 下周计划
}

/** 取给定时间戳所在周的周一零点（本地时区） */
function startOfWeek(ts: number): Date {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

/** 筛选"本周"内的笔记；优先工作类，其余作补充上下文（最多取近 40 条） */
export function filterByThisWeek(notes: BrainNote[], now = Date.now()): {
  picked: BrainNote[];
  weekStart: Date;
  weekEnd: Date;
} {
  const ws = startOfWeek(now);
  const we = new Date(ws);
  we.setDate(we.getDate() + 7);
  const inWeek = notes
    .filter((n) => n.createdAt >= ws.getTime() && n.createdAt < we.getTime())
    .filter((n) => n.content && n.content.trim().length >= 8) // 跳过空/太短
    .sort((a, b) => a.createdAt - b.createdAt);

  // 本周如果有工作类笔记，优先取工作类；否则取全部本周；本周没有则降级取近 7 天任意
  let picked = inWeek;
  const workOnly = inWeek.filter((n) => /工作|项目|会议|客户|任务/i.test(n.category || ""));
  if (workOnly.length >= 2) picked = workOnly;
  else if (inWeek.length === 0) {
    picked = notes
      .filter((n) => /工作|项目|会议|客户|任务/i.test(n.category || "") && n.content)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 10);
  }
  return { picked: picked.slice(-40), weekStart: ws, weekEnd: we };
}

function fmt(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function weekLabel(ws: Date, we: Date): string {
  return `${fmt(ws.getTime())} - ${fmt(we.getTime() - 1)}`;
}

/** 启发式兜底：按行/标题聚合成本周完成清单 */
function heuristicReport(picked: BrainNote[], ws: Date, we: Date): WeeklyReport {
  const completion = picked.map((n) => {
    const head = (n.title || "").replace(/[:：]\s*$/, "");
    return head || n.summary.slice(0, 40) || "整理了一条笔记";
  });
  const tags = new Set<string>();
  for (const n of picked) for (const t of n.tags) if (t && t.length <= 12) tags.add(t);
  return {
    weekLabel: weekLabel(ws, we),
    summary: `本周记录了 ${picked.length} 条工作相关内容。`,
    completed: completion.length ? completion : ["本周暂无已记录的工作笔记"],
    decisions: [],
    blockers: [],
    next: [...tags].slice(0, 5).map((t) => `持续跟进：${t}`),
  };
}

function parseReport(raw: string): Partial<WeeklyReport> {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    const obj = JSON.parse(cleaned) as Record<string, unknown>;
    const arr = (v: unknown): string[] | undefined => {
      if (!Array.isArray(v)) return undefined;
      const list = v.map(String).map((s) => s.trim()).filter(Boolean);
      return list.length ? list : undefined;
    };
    const str = (v: unknown): string | undefined =>
      typeof v === "string" && v.trim() ? v.trim() : undefined;
    return {
      weekLabel: str(obj.weekLabel),
      summary: str(obj.summary),
      completed: arr(obj.completed),
      decisions: arr(obj.decisions),
      blockers: arr(obj.blockers),
      next: arr(obj.next),
    };
  } catch {
    return {};
  }
}

async function callQwen(noteText: string, ws: Date, we: Date): Promise<Partial<WeeklyReport>> {
  const baseUrl = (process.env.LLM_MODEL_BASE_URL || "").replace(/\/+$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LLM_MODEL_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL_MODEL_ID,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是用户的职场助理，根据用户本周的个人笔记自动生成一份结构化周报。输出严格 JSON，键为：" +
            "weekLabel（周区间，如 08.18 - 08.24）、summary（一句话总览，≤40 字）、" +
            "completed（字符串数组，本周完成的事项，保留关键动作与具体内容，避免空话）、" +
            "decisions（字符串数组，关键决策/结论，无则空数组）、" +
            "blockers（字符串数组，问题与阻塞，无则空数组）、" +
            "next（字符串数组，下周计划，基于未完成事项与摘要推断）。只输出 JSON，不要多余内容。",
        },
        { role: "user", content: noteText },
      ],
    }),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`brain_report_${res.status}`);
  const data = await res.json();
  const c: string = data?.choices?.[0]?.message?.content ?? "";
  if (!c) throw new Error("brain_report_empty");
  return parseReport(c);
}

/** 生成本周周报。服务端调用。返回报告 + 依据的笔记（供 UI 展示来源）。 */
export async function generateWeeklyReport(
  notes: BrainNote[],
  now = Date.now(),
): Promise<{ report: WeeklyReport; source: BrainNote[] }> {
  const { picked, weekStart, weekEnd } = filterByThisWeek(notes, now);
  const base = heuristicReport(picked, weekStart, weekEnd);

  if (!picked.length) {
    return { report: base, source: picked };
  }

  const apiKey = process.env.LLM_MODEL_API_KEY;
  const baseUrl = process.env.LLM_MODEL_BASE_URL;
  const model = process.env.LLM_MODEL_MODEL_ID;
  if (apiKey && baseUrl && model) {
    try {
      const noteText = picked
        .map((n) => {
          const meta = [n.category, n.summary].filter(Boolean).join(" · ");
          return `【${n.title}】\n${meta}\n${n.content}`;
        })
        .join("\n\n---\n\n");
      const ai = await callQwen(noteText, weekStart, weekEnd);
      const report: WeeklyReport = {
        weekLabel: ai.weekLabel || base.weekLabel,
        summary: ai.summary || base.summary,
        completed: ai.completed?.length ? ai.completed : base.completed,
        decisions: ai.decisions?.length ? ai.decisions : base.decisions,
        blockers: ai.blockers?.length ? ai.blockers : base.blockers,
        next: ai.next?.length ? ai.next : base.next,
      };
      return { report, source: picked };
    } catch {
      return { report: base, source: picked };
    }
  }
  return { report: base, source: picked };
}