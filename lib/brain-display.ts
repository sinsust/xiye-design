/**
 * 旧数据/异常数据可能把随机 ID（如 note-mtz4glo5-wcugb）或空标题落进 title 字段。
 * 显示层用此函数兜底：优先展示可读的原文首行，而非让用户看一堆无意义 ID。
 *
 * 入参刻意只依赖三个可选字段：`BrainNote`（含正文）与 `BrainNoteMeta`
 * （轻量投影、无 content）都能直接传入，无需各自适配。
 */
export interface TitleSource {
  title?: string | null;
  content?: string | null;
  summary?: string | null;
}

const NOTE_ID_LIKE = /^note-[a-z0-9]+(-[a-z0-9]+)*$/i;

export function isPlaceholderTitle(title: string | null | undefined): boolean {
  if (!title) return true;
  const t = title.trim();
  if (!t) return true;
  if (t === "未命名想法") return true;
  if (NOTE_ID_LIKE.test(t)) return true;
  if (t.length < 2) return true;
  return false;
}

export function firstLine(text: string, max = 40): string {
  const line = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? line.slice(0, max) + "…" : line;
}

export function displayTitle(
  note: TitleSource,
  opts?: { max?: number; fallback?: string },
): string {
  const max = opts?.max ?? 40;
  const fallback = opts?.fallback ?? "未命名想法";
  const raw = (note.title ?? "").trim();

  if (!isPlaceholderTitle(raw)) {
    return raw.length > max ? raw.slice(0, max) + "…" : raw;
  }

  const fromContent = firstLine(note.content ?? "", max);
  if (fromContent) return fromContent;

  const fromSummary = (note.summary ?? "").replace(/\n+/g, " ").trim();
  if (fromSummary) return fromSummary.length > max ? fromSummary.slice(0, max) + "…" : fromSummary;

  return raw || fallback;
}
