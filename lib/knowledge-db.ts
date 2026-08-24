// 云端共享知识库读写层：用户贡献的知识条目存进共享 DB（sqlite 本地 / Postgres 云端），
// 所有用户可见，并记录贡献人邮箱。内置 categories/ 文件条目不走这里（见 lib/knowledge.ts）。

import { db, knowledgeEntries } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { KnowledgeEntry } from "@/lib/knowledge-types";

interface CloudRow {
  slug: string;
  type: string;
  name: string;
  summary: string | null;
  useCase: string | null;
  stack: string | null;
  tags: string | null;
  status: string | null;
  updated: string | null;
  createdAt: number | null;
  repoUrl: string | null;
  source: string | null;
  contributorEmail: string | null;
  body: string;
}

function splitList(v: string | null): string[] | undefined {
  if (!v) return undefined;
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) && arr.length ? arr.map(String) : undefined;
  } catch {
    return undefined;
  }
}

function toEntry(r: CloudRow): KnowledgeEntry {
  return {
    slug: r.slug,
    type: r.type as KnowledgeEntry["type"],
    name: r.name,
    summary: r.summary ?? "",
    useCase: r.useCase ?? undefined,
    stack: splitList(r.stack),
    tags: splitList(r.tags),
    status: r.status ?? undefined,
    updated: r.updated ?? undefined,
    createdAt: r.createdAt ?? undefined,
    repoUrl: r.repoUrl ?? undefined,
    source: r.source ?? undefined,
    // 空串视为无贡献人（旧版本地文件），空/undefined 时不可被他人管理
    contributorEmail: r.contributorEmail || undefined,
    userAdded: true,
    body: r.body,
  };
}

export type NewCloudKnowledge = {
  slug: string;
  type: string;
  name: string;
  summary: string;
  useCase?: string;
  stack?: string[];
  tags?: string[];
  status?: string;
  updated: string;
  repoUrl?: string;
  source?: string;
  contributorEmail: string;
  body: string;
};

/** 读取全部云端共享条目（含贡献人邮箱），按 updated 倒序（新贡献靠前） */
export async function listCloudKnowledge(): Promise<KnowledgeEntry[]> {
  try {
    const rows = (await db.select().from(knowledgeEntries)) as CloudRow[];
    return rows
      .map(toEntry)
      .sort((a, b) => ((b.updated ?? "") < (a.updated ?? "") ? -1 : 1));
  } catch (err) {
    console.error("[knowledge-db] list failed:", err);
    return [];
  }
}

export async function getCloudKnowledge(slug: string): Promise<KnowledgeEntry | null> {
  try {
    const rows = (await db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.slug, slug))) as CloudRow[];
    return rows[0] ? toEntry(rows[0]) : null;
  } catch (err) {
    console.error("[knowledge-db] get failed:", err);
    return null;
  }
}

export async function insertCloudKnowledge(row: NewCloudKnowledge): Promise<KnowledgeEntry> {
  const now = Date.now();
  await db.insert(knowledgeEntries).values({
    slug: row.slug,
    type: row.type,
    name: row.name,
    summary: row.summary,
    useCase: row.useCase ?? null,
    stack: row.stack?.length ? JSON.stringify(row.stack) : null,
    tags: row.tags?.length ? JSON.stringify(row.tags) : null,
    status: row.status ?? null,
    updated: row.updated,
    repoUrl: row.repoUrl ?? null,
    source: row.source ?? null,
    contributorEmail: row.contributorEmail || null,
    body: row.body,
    createdAt: now,
    updatedAt: now,
  });
  return toEntry({
    ...row,
    summary: row.summary,
    useCase: row.useCase ?? null,
    stack: row.stack?.length ? JSON.stringify(row.stack) : null,
    tags: row.tags?.length ? JSON.stringify(row.tags) : null,
    status: row.status ?? null,
    updated: row.updated,
    repoUrl: row.repoUrl ?? null,
    source: row.source ?? null,
    contributorEmail: row.contributorEmail || null,
  } as CloudRow);
}

export type UpdateCloudKnowledge = Partial<
  Pick<
    NewCloudKnowledge,
    | "type"
    | "name"
    | "summary"
    | "useCase"
    | "stack"
    | "tags"
    | "status"
    | "updated"
    | "repoUrl"
    | "source"
    | "body"
  >
>;

export async function updateCloudKnowledge(
  slug: string,
  patch: UpdateCloudKnowledge,
): Promise<KnowledgeEntry | null> {
  const set: Record<string, unknown> = {
    name: patch.name ?? undefined,
    summary: patch.summary ?? null,
    useCase: patch.useCase ?? null,
    stack: patch.stack ? JSON.stringify(patch.stack) : null,
    tags: patch.tags ? JSON.stringify(patch.tags) : null,
    status: patch.status ?? null,
    updated: patch.updated ?? undefined,
    repoUrl: patch.repoUrl ?? null,
    source: patch.source ?? null,
    body: patch.body ?? undefined,
    updatedAt: Date.now(),
  };
  // 去除显式 undefined（保持原值），仅更新 caller 真正想改的字段
  for (const k of Object.keys(set)) {
    if (set[k] === undefined) delete set[k];
  }
  if (patch.type) set.type = patch.type;
  await db
    .update(knowledgeEntries)
    .set(set)
    .where(eq(knowledgeEntries.slug, slug));
  return getCloudKnowledge(slug);
}

export async function deleteCloudKnowledge(slug: string): Promise<void> {
  try {
    await db.delete(knowledgeEntries).where(eq(knowledgeEntries.slug, slug));
  } catch (err) {
    console.error("[knowledge-db] delete failed:", err);
  }
}