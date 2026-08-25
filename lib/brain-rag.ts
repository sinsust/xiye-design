// 第二大脑私有问答：只检索「当前用户的个人笔记」，把命中片段拼进 prompt，
// 让 AI 用用户自己的知识回答。与 ragt(通用技能库) 隔离，严格限定私有笔记。
//
// 双模式检索（第八阶段：本地向量检索）：
// - 语义模式（默认）：用 Xenova/all-MiniLM-L6-v2 生成问题向量，与笔记向量算余弦相似度取 TopK；
//   没有向量的笔记（embedding 为 null）走关键词匹配兜底，两者合并再取 TopK。
// - 关键词模式：退化为原来的 2 字滑窗双向打分匹配（全量笔记，含无向量的）。
// 前端可通过 ?mode=keyword 切换；模型不可用/向量为空时自动降级关键词。

import type { BrainNote } from "./brain-db";
import { embed } from "./embedding";

export type BrainRetrieveMode = "semantic" | "keyword";

export interface BrainRagHit {
  id: string;
  title: string;
  category: string;
  snippet: string;
  // 相关度（0~1，尽力估算，供前端来源标注展示）
  relevance?: number;
}

const WEAK = new Set([
  "这个", "一个", "可以", "需要", "进行", "还有", "以及", "不过", "因为", "所以",
  "就是", "不是", "怎么", "什么", "我们", "你们", "的", "了", "我", "你", "他",
  "the", "and", "for", "with", "that", "this", "your",
]);

/** 从一段文本提取关键词候选（2-8 字连续中英文/数字片段） */
function keywords(text: string, max = 24): string[] {
  const cands = text.match(/[\u4e00-\u9fa5A-Za-z0-9+]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cands) {
    const clean = c.trim();
    if (clean.length < 2 || seen.has(clean)) continue;
    seen.add(clean);
    if (!WEAK.has(clean.toLowerCase())) {
      out.push(clean);
      if (out.length >= max) break;
    }
  }
  return out;
}

/** 中文关键词用 2 字滑窗判定是否出现在全文里 */
function covers(kw: string, hay: string): boolean {
  const k = kw.toLowerCase();
  if (/^[a-z0-9+.-]+$/.test(k)) return hay.includes(k);
  for (let i = 0; i <= k.length - 2; i++) {
    if (hay.includes(k.slice(i, i + 2))) return true;
  }
  return false;
}

/** 双向匹配打分：问题关键词命中笔记 + 笔记关键词命中问题 */
function scoreNote(n: BrainNote, questionLower: string): number {
  const qkws = keywords(questionLower);
  const nText = `${n.title} ${n.category} ${n.summary} ${n.content}`.toLowerCase();
  const nkws = keywords(`${n.title} ${n.category} ${n.summary} ${n.content}`, 24);

  let s = 0;
  for (const kw of qkws) if (covers(kw, nText)) s += 2;
  for (const kw of nkws) if (covers(kw, questionLower)) s += 1;
  return s;
}

function snippet(n: BrainNote): string {
  const body = n.content.replace(/\n{3,}/g, "\n\n").trim();
  const text = body || n.summary;
  return text.slice(0, 400);
}

function toHit(n: BrainNote, relevance?: number): BrainRagHit {
  const h: BrainRagHit = { id: n.id, title: n.title, category: n.category, snippet: snippet(n) };
  if (relevance !== undefined) h.relevance = Number(relevance.toFixed(2));
  return h;
}

/** 关键词匹配（全量笔记，含无向量的），按相关度倒序返回。 */
function keywordRetrieve(notes: BrainNote[], lowerQ: string, limit: number): BrainRagHit[] {
  return notes
    .map((n) => ({ n, s: scoreNote(n, lowerQ) }))
    .filter((x) => x.s >= 2)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => toHit(x.n, Math.min(1, x.s / 8)));
}

/** 余弦相似度：应用层计算 384 维向量，毫秒级。 */
function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** 解析笔记存储的向量 JSON；异常返回 null。 */
function parseEmbedding(n: BrainNote): number[] | null {
  if (!n.embedding) return null;
  try {
    const arr = JSON.parse(n.embedding);
    return Array.isArray(arr) && arr.length > 0 ? (arr as number[]) : null;
  } catch {
    return null;
  }
}

/** 语义检索：有向量笔记按余弦相似度，无向量笔记关键词兜底，合并后取 TopK。 */
function semanticRetrieve(
  notes: BrainNote[],
  question: string,
  lowerQ: string,
  queryVector: number[],
  limit: number,
): BrainRagHit[] {
  const withVec: { n: BrainNote; score: number }[] = [];
  const withoutVec: BrainNote[] = [];
  for (const n of notes) {
    const v = parseEmbedding(n);
    if (v) withVec.push({ n, score: cosine(queryVector, v) });
    else withoutVec.push(n);
  }

  const vecHits = withVec
    .filter((x) => x.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .map((x) => toHit(x.n, x.score));
  // 无向量的笔记补充进关键词候选
  const kwCandidates = new Set(withoutVec.map((n) => n.id));
  const kwFill = keywordRetrieve(notes.filter((n) => kwCandidates.has(n.id)), lowerQ, limit);

  // 合并：先向量命中，再关键词兜底；用已命中 id 去重后取前 limit
  const merged: BrainRagHit[] = [...vecHits, ...kwFill];
  const seen = new Set<string>();
  const result: BrainRagHit[] = [];
  for (const h of merged) {
    if (seen.has(h.id)) continue;
    seen.add(h.id);
    result.push(h);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * 检索用户私有的相关笔记片段，按相关度排序。
 * @param mode semantic（默认，向量+关键词兜底）| keyword（纯关键词）
 */
export async function brainRetrieve(
  notes: BrainNote[],
  question: string,
  limit = 3,
  mode: BrainRetrieveMode = "semantic",
): Promise<BrainRagHit[]> {
  const q = (question ?? "").trim();
  if (!q || !notes.length) return [];
  const lowerQ = q.toLowerCase();

  if (mode !== "keyword") {
    const queryVector = await embed(question);
    if (queryVector) {
      const hits = semanticRetrieve(notes, question, lowerQ, queryVector, limit);
      if (hits.length) return hits;
    }
    // 向量不可用或无语义命中 → 降级关键词，确保仍有内容可答
  }

  return keywordRetrieve(notes, lowerQ, limit);
}

/** 拼成可注入的「个人笔记参考」段，无命中返回空串 */
export function buildBrainContext(hits: BrainRagHit[]): string {
  if (!hits.length) return "";
  return `\n\n【你的第二大脑笔记（RAG 命中的个人记录，回答时尽量引用，但不要臆造笔记里没有的内容）】
${hits.map((h) => `### ${h.title}（${h.category}）\n${h.snippet}`).join("\n\n")}`;
}