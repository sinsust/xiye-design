// P2-B「整理」服务：相似内容检测、可能过期策略、关系建议。
// - 相似/过期/关系全部只读分析 + 记录用户决策，绝不静默合并、删除或覆盖原笔记。
// - 过期阈值默认 90 天在服务端可配置（env BRAIN_STALE_DAYS 或 user_preferences），不写死在 UI。
// - 关系建议仅落地为「边」记录（brain_relations），用户确认/忽略，不建图、不直接改对象。

import {
  listBrainNotes,
  getBrainNote,
  listBrainTasks,
  getBrainTaskById,
  getBrainProject,
  listBrainSimilarPairs,
  getBrainSimilarPair,
  findBrainSimilarPair,
  insertBrainSimilarPair,
  setBrainSimilarDecision,
  listBrainRelations,
  insertBrainRelation,
  setBrainRelationDecision,
  listBrainCurationLogs,
  insertBrainCurationLog,
  markBrainNoteSuperseded,
  updateBrainNote,
  type BrainNote,
  type BrainSimilarPair,
  type BrainRelation,
  type BrainRelationType,
  type BrainRelationKind,
  type BrainCurationAction,
} from "./brain-db";

const DAY = 86_400_000;

export interface CurateConfig {
  staleDays: number; // 服务端默认 90 天；可被 env 覆盖
}

/** 服务端默认阈值 + 可配置策略（env BRAIN_STALE_DAYS），UI 不硬编码 90 天。 */
export function getCurateConfig(): CurateConfig {
  const fromEnv = Number(process.env.BRAIN_STALE_DAYS);
  const days = Number.isFinite(fromEnv) && fromEnv > 0 ? Math.round(fromEnv) : 90;
  return { staleDays: days };
}

// ---------- 内部相似度工具（语义向量余弦 + 关键词兜底） ----------

function parseEmbedding(n: BrainNote): number[] | null {
  if (!n.embedding) return null;
  try {
    const arr = JSON.parse(n.embedding);
    return Array.isArray(arr) && arr.length > 0 ? (arr as number[]) : null;
  } catch {
    return null;
  }
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

const STOP = new Set(["的","了","我","你","他","我们","你们","这个","一个","可以","需要","进行","还有","以及","因为","所以","就是","不是","怎么","什么","the","and","for","with","that","this","your"]);

function keywords(text: string, max = 30): Set<string> {
  const out = new Set<string>();
  const cands = text.match(/[\u4e00-\u9fa5A-Za-z0-9+]+/g) ?? [];
  for (const c of cands) {
    const clean = c.trim();
    if (clean.length < 2 || STOP.has(clean.toLowerCase()) || out.has(clean)) continue;
    out.add(clean);
    if (out.size >= max) break;
  }
  return out;
}

/** 关键词 Jaccard 相似度 */
function keywordScore(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const k of a) if (b.has(k)) inter++;
  return inter / (a.size + b.size - inter);
}

function noteText(n: BrainNote): string {
  return `${n.title} ${n.category} ${n.summary} ${n.content}`.toLowerCase();
}

// ---------- 相似内容检测 ----------

const SEMANTIC_THRESHOLD = 0.42;
const KEYWORD_THRESHOLD = 0.42;

export async function scanSimilarNotes(userId: string, noteId?: string): Promise<{ added: number; total: number }> {
  const notes = (await listBrainNotes(userId)).filter((n) => !n.superseded);
  const withVec = notes.map((n) => ({ n, v: parseEmbedding(n) }));
  // 复用既有决策，避免重复插入同一对
  const existing = await listBrainSimilarPairs(userId);
  const decidedKeys = new Set(
    existing
      .filter((p) => p.status !== "suggested")
      .map((p) => pairKey(p.noteIdA, p.noteIdB)),
  );

  let added = 0;
  for (let i = 0; i < notes.length; i++) {
    for (let j = i + 1; j < notes.length; j++) {
      const A = notes[i];
      const B = notes[j];
      // 给定 noteId 时只重算与该笔记相关的配对，避免单卡「重新扫描」触发全库 O(N²)
      if (noteId && A.id !== noteId && B.id !== noteId) continue;
      const key = pairKey(A.id, B.id);
      if (decidedKeys.has(key)) continue;
      if (await findBrainSimilarPair(userId, A.id, B.id)) continue; // suggested 已存在则跳过
      const va = withVec[i].v;
      const vb = withVec[j].v;
      let score = 0;
      let method: "semantic" | "keyword" = "keyword";
      if (va && vb) {
        score = cosine(va, vb);
        method = "semantic";
      }
      if (score < SEMANTIC_THRESHOLD || !method) {
        const ks = keywordScore(keywords(noteText(A)), keywords(noteText(B)));
        if (method === "semantic" && ks >= SEMANTIC_THRESHOLD) {
          score = Math.max(score, ks);
        } else if (method === "keyword" || score < SEMANTIC_THRESHOLD) {
          score = Math.max(score, ks);
          method = ks >= score ? "keyword" : method;
        }
      }
      if (score >= (method === "semantic" ? SEMANTIC_THRESHOLD : KEYWORD_THRESHOLD)) {
        try {
          await insertBrainSimilarPair(userId, { noteIdA: A.id, noteIdB: B.id, score, method });
          added++;
        } catch {
          /* 并发重复插入忽略 */
        }
      }
    }
  }
  const after = await listBrainSimilarPairs(userId);
  return { added, total: after.length };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

// ---------- 可能过期 ----------

export interface StaleNoteInfo {
  noteId: string;
  title: string;
  staleDays: number;
  thresholdDays: number;
  reason: "not_updated" | "not_referenced";
}

export function getStaleNotes(userId: string, notes: BrainNote[], days?: number): StaleNoteInfo[] {
  const cfg = getCurateConfig();
  const threshold = days && days > 0 ? days : cfg.staleDays;
  const now = Date.now();
  const referredIds = new Set<string>();
  for (const n of notes) for (const r of n.related) referredIds.add(r);

  const out: StaleNoteInfo[] = [];
  for (const n of notes) {
    if (n.superseded) continue;
    const staleDays = Math.floor((now - n.updatedAt) / DAY);
    if (staleDays < threshold) continue;
    const referenced = n.related.length > 0 || referredIds.has(n.id);
    const reason: "not_updated" | "not_referenced" = referenced ? "not_updated" : "not_referenced";
    out.push({
      noteId: n.id,
      title: n.title || "未命名笔记",
      staleDays,
      thresholdDays: threshold,
      reason,
    });
  }
  return out;
}

// ---------- 关系建议（数据可证规则，第一版） ----------

export type { BrainRelationType, BrainRelationKind } from "./brain-db";

export const RELATION_TYPE_LABEL: Record<BrainRelationType, string> = {
  derived_from: "来源于",
  belongs_to_project: "属于项目",
  produces_task: "产生任务",
  supports_conclusion: "支持结论",
  blocks_task: "阻塞任务",
  depends_on_task: "依赖任务",
  similar_to: "与…相似",
  may_conflict: "可能冲突",
};

/** 由真实数据推导关系建议：note→task(产生任务) / task|note→project(属于项目) / note→note(与…相似)。 */
export async function proposeRelations(userId: string, noteId?: string): Promise<{ added: number }> {
  const notes = (await listBrainNotes(userId)).filter((n) => !n.superseded);
  const noteIds = new Set(notes.map((n) => n.id));
  const tasks = await listBrainTasks(userId);
  const existing = await listBrainRelations(userId);
  const seenKeys = new Set(
    existing.map((r) => `${r.type}|${r.sourceId}:${r.sourceType}|${r.targetId}:${r.targetType}`),
  );

  let added = 0;
  const add = async (
    type: BrainRelationType,
    sourceId: string,
    sourceType: BrainRelationKind,
    targetId: string,
    targetType: BrainRelationKind,
    note?: string,
  ) => {
    const key = `${type}|${sourceId}:${sourceType}|${targetId}:${targetType}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    await insertBrainRelation(userId, { type, sourceId, sourceType, targetId, targetType, note });
    added++;
  };

  // note → task：产生任务
  for (const t of tasks) {
    if (noteId && t.noteId !== noteId) continue;
    if (!noteIds.has(t.noteId)) continue;
    await add("produces_task", t.noteId, "note", t.id, "task", `该笔记生成了任务「${t.title}」`);
  }

  // task → project：属于项目（也顺带 note → project）
  for (const t of tasks) {
    if (noteId && t.noteId !== noteId) continue;
    if (!t.projectId || !noteIds.has(t.noteId)) continue;
    await add("belongs_to_project", t.noteId, "note", t.projectId, "project", "该笔记关联到项目");
    await add("belongs_to_project", t.id, "task", t.projectId, "project", "该任务所属项目");
  }

  // note → note：与…相似（由已标记相关的相似对生成）
  const similar = (await listBrainSimilarPairs(userId)).filter((p) => p.status === "related");
  for (const p of similar) {
    if (noteId && p.noteIdA !== noteId && p.noteIdB !== noteId) continue;
    await add("similar_to", p.noteIdA, "note", p.noteIdB, "note", "用户已将其标记为相关");
  }

  return { added };
}

// ---------- 汇总视图模型（供 GET /api/brain/curate?noteId=…） ----------

export interface CurateSimilarItem {
  pairId: string;
  otherNoteId: string;
  otherTitle: string;
  otherSummary: string;
  score: number;
  method: "semantic" | "keyword";
  status: BrainSimilarPair["status"];
}
export interface CurateRelationItem {
  id: string;
  type: BrainRelationType;
  typeLabel: string;
  direction: "out" | "in";
  targetId: string;
  targetType: BrainRelationKind;
  targetTitle: string;
  note: string | null;
  status: BrainRelation["status"];
}
export interface CurateView {
  noteId: string;
  stale: {
    isStale: boolean;
    staleDays: number;
    thresholdDays: number;
    reason?: "not_updated" | "not_referenced";
    lastDecision?: BrainCurationAction;
  } | null;
  similar: CurateSimilarItem[];
  relations: CurateRelationItem[];
}

export async function getCurateView(userId: string, noteId: string): Promise<CurateView> {
  const note = await getBrainNote(userId, noteId);
  if (!note) {
    return { noteId, stale: null, similar: [], relations: [] };
  }
  const notes = (await listBrainNotes(userId)).filter((n) => !n.superseded);
  const cfg = getCurateConfig();

  // 相似：所有涉及该笔记的候选
  const pairs = await listBrainSimilarPairs(userId);
  const similar: CurateSimilarItem[] = [];
  for (const p of pairs) {
    const otherId = p.noteIdA === noteId ? p.noteIdB : p.noteIdB === noteId ? p.noteIdA : null;
    if (!otherId) continue;
    const other = await getBrainNote(userId, otherId);
    if (!other) continue;
    similar.push({
      pairId: p.id,
      otherNoteId: otherId,
      otherTitle: other.title || "未命名笔记",
      otherSummary: other.summary || other.content.slice(0, 120),
      score: p.score,
      method: p.method,
      status: p.status,
    });
  }
  similar.sort((a, b) => b.score - a.score);

  // 过期：仅统计自身是否达到阈值
  let stale: CurateView["stale"] = null;
  if (!note.superseded) {
    const staleDays = Math.floor((Date.now() - note.updatedAt) / DAY);
    if (staleDays >= cfg.staleDays) {
      const referredIds = new Set<string>();
      for (const n of notes) for (const r of n.related) referredIds.add(r);
      const referenced = note.related.length > 0 || referredIds.has(noteId);
      const logs = await listBrainCurationLogs(userId, noteId);
      stale = {
        isStale: true,
        staleDays,
        thresholdDays: cfg.staleDays,
        reason: referenced ? "not_updated" : "not_referenced",
        lastDecision: logs[0]?.action,
      };
    } else {
      stale = { isStale: false, staleDays, thresholdDays: cfg.staleDays };
    }
  }

  // 关系：出边 + 入边，解析对象标题
  const relationsOf = await listBrainRelations(userId, { kind: "note", id: noteId });
  const allRelations = await listBrainRelations(userId);
  const relations: CurateRelationItem[] = [];
  const resolveTitle = async (targetId: string, targetType: BrainRelationKind): Promise<string> => {
    if (targetType === "note") return (await getBrainNote(userId, targetId))?.title || "笔记";
    if (targetType === "task") return (await getBrainTaskById(userId, targetId))?.title || "任务";
    if (targetType === "project") return (await getBrainProject(userId, targetId))?.name || "项目";
    return "对象";
  };
  for (const r of allRelations) {
    const isOut = r.sourceId === noteId && r.sourceType === "note";
    const isIn = r.targetId === noteId && r.targetType === "note" && r.sourceType === "note";
    if (isOut) {
      relations.push({
        id: r.id,
        type: r.type,
        typeLabel: RELATION_TYPE_LABEL[r.type] ?? r.type,
        direction: "out",
        targetId: r.targetId,
        targetType: r.targetType,
        targetTitle: await resolveTitle(r.targetId, r.targetType),
        note: r.note,
        status: r.status,
      });
    } else if (isIn) {
      relations.push({
        id: r.id,
        type: r.type,
        typeLabel: RELATION_TYPE_LABEL[r.type] ?? r.type,
        direction: "in",
        targetId: r.sourceId,
        targetType: r.sourceType,
        targetTitle: await resolveTitle(r.sourceId, r.sourceType),
        note: r.note,
        status: r.status,
      });
    }
  }
  const byId = new Map(relations.map((r) => [r.id, r]));
  for (const r of relationsOf) {
    if (byId.has(r.id)) continue;
    relations.push({
      id: r.id,
      type: r.type,
      typeLabel: RELATION_TYPE_LABEL[r.type] ?? r.type,
      direction: "out",
      targetId: r.targetId,
      targetType: r.targetType,
      targetTitle: await resolveTitle(r.targetId, r.targetType),
      note: r.note,
      status: r.status,
    });
  }

  return { noteId, stale, similar, relations };
}

// ---------- 决策动作（供 POST 接口调用） ----------

export async function decideSimilar(userId: string, pairId: string, action: "related" | "independent" | "ignored"): Promise<boolean> {
  const ok = await setBrainSimilarDecision(userId, pairId, action);
  // 标记相关 → 落一条 similar_to 关系建议，供详情页展示
  if (ok && action === "related") {
    const pair = await getBrainSimilarPair(userId, pairId);
    if (pair) {
      const existing = await listBrainRelations(userId);
      const dup = existing.find(
        (r) => r.type === "similar_to" && r.sourceId === pair.noteIdA && r.targetId === pair.noteIdB && r.status === "suggested",
      );
      if (!dup) {
        await insertBrainRelation(userId, {
          type: "similar_to",
          sourceId: pair.noteIdA,
          sourceType: "note",
          targetId: pair.noteIdB,
          targetType: "note",
          note: "用户已将其标记为相关",
        });
      }
    }
  }
  return ok;
}

export async function decideStale(
  userId: string,
  noteId: string,
  action: BrainCurationAction,
  reason?: "not_updated" | "not_referenced",
): Promise<boolean> {
  const note = await getBrainNote(userId, noteId);
  if (!note) return false;
  const cfg = getCurateConfig();
  const staleDays = Math.floor((Date.now() - note.updatedAt) / DAY);
  const finalReason = reason ?? (note.related.length ? "not_updated" : "not_referenced");

  if (action === "archive") {
    // 软归档：走既有 superseded 语义，不删除
    await markBrainNoteSuperseded(userId, noteId);
  } else {
    // keep / reorganize → 刷新 updatedAt（重新整理时即使不重跑 AI，也视为重新审视并保留有效）
    await updateBrainNote(userId, noteId, {});
  }

  await insertBrainCurationLog(userId, {
    noteId,
    reason: finalReason,
    thresholdDays: cfg.staleDays,
    staleDays,
    action,
  });
  return true;
}

export async function decideRelation(userId: string, relationId: string, action: "confirmed" | "ignored"): Promise<boolean> {
  return setBrainRelationDecision(userId, relationId, action);
}