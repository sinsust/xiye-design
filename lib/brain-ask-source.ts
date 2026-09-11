// 问答引用来源的统一定义（跨库问答 B5）。
// 纯逻辑模块：不依赖 DB / 请求上下文，便于独立验证，也被前后端共用以避免两处定义漂移。
import type { BrainNote } from "./brain-db";

/** 一条引用的真实出处：
 *  - local      本地随手记（无同步溯源）
 *  - obsidian   由 Obsidian vault 同步进来的笔记
 *  - ima-synced 由 ima 增量同步进来的笔记
 *  - ima        ima 实时检索命中的远端文档（无本地笔记 id，不可跳转） */
export type AskSourceKind = "local" | "obsidian" | "ima-synced" | "ima";

export interface AskSource {
  noteId: string;
  title: string;
  source: AskSourceKind;
  sourceName?: string;
  relevance?: number;
}

/** 展示文案：问答引用 chip / 导出清单共用 */
export const ASK_SOURCE_LABEL: Record<AskSourceKind, string> = {
  local: "本地",
  obsidian: "Obsidian",
  "ima-synced": "ima 同步",
  ima: "ima",
};

/**
 * 本地命中的来源细分：按笔记的同步溯源列判定（obsidianNoteId / imaDocId 由同步链路回填）。
 * 未传 note（查不到）时按本地处理，不改变检索行为，只影响标注。
 */
export function localSourceOf(note: BrainNote | undefined | null): {
  source: AskSourceKind;
  sourceName?: string;
} {
  if (note?.obsidianNoteId) {
    // relPath 形如 "10-工作/foo.md"，取父目录名作来源提示；
    // 不回传 vault 绝对路径，避免把本机目录结构泄漏给前端。
    const dir = (note.obsidianRelPath ?? "").split(/[\\/]/).filter(Boolean).slice(-2, -1)[0];
    return { source: "obsidian", sourceName: dir || undefined };
  }
  if (note?.imaDocId) return { source: "ima-synced" };
  return { source: "local" };
}

/** 无 LLM 时的兜底清单文案：把来源写清楚，不把 Obsidian / ima 同步内容混称「本地」 */
export function sourceMention(s: AskSource): string {
  switch (s.source) {
    case "ima":
      return "来自 ima" + (s.sourceName ? " · " + s.sourceName : "");
    case "obsidian":
      return "来自 Obsidian" + (s.sourceName ? " · " + s.sourceName : "");
    case "ima-synced":
      return "来自 ima 同步笔记";
    default:
      return "本地笔记";
  }
}
