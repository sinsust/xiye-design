// 一次性迁移：把旧版 knowledge/user/**/*.md 里已自建的知识条目搬进云端共享库（knowledge_entries 表）。
// 幂等：已存在同 slug 的跳过。旧文件保留（不再被读取，避免重复）。
// 直接走 better-sqlite3 原生 SQL，避免经 lib/db（含 top-level await，CJS tsx 不支持）。
// 运行：npx tsx scripts/migrate-knowledge-user.ts
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { KNOWLEDGE_TYPE_META } from "../lib/knowledge-types";

const USER_ROOT = path.join(process.cwd(), "knowledge", "user");
const DB_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(process.cwd(), "xiye.db");

function parseFrontmatter(raw: string): Record<string, unknown> | null {
  const m = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return null;
  const data: Record<string, unknown> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const val = kv[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      const inner = val.slice(1, -1).trim();
      data[kv[1]] = inner.length
        ? inner.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""))
        : [];
    } else {
      data[kv[1]] = val.replace(/^["']|["']$/g, "");
    }
  }
  return data;
}

function extractBody(raw: string): string {
  const m = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (m ? m[1] : raw).trim();
}

function main() {
  if (!fs.existsSync(USER_ROOT)) {
    console.log("未发现 knowledge/user 目录，无需迁移");
    return;
  }
  // 确保表存在（与 db/index.ts 本地 DDL 一致）
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(`create table if not exists knowledge_entries (
    slug text primary key,
    type text not null,
    name text not null,
    summary text,
    use_case text,
    stack text,
    tags text,
    status text,
    updated text,
    repo_url text,
    source text,
    contributor_email text,
    body text not null,
    created_at integer not null,
    updated_at integer not null
  );`);

  const existsStmt = sqlite.prepare("select 1 from knowledge_entries where slug = ?");
  const insertStmt = sqlite.prepare(`insert into knowledge_entries
    (slug, type, name, summary, use_case, stack, tags, status, updated, repo_url, source, contributor_email, body, created_at, updated_at)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  let inserted = 0;
  let skipped = 0;
  const now = Date.now();
  const today = new Date().toISOString().slice(0, 10);

  for (const meta of KNOWLEDGE_TYPE_META) {
    const dir = path.join(USER_ROOT, meta.folder);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "index.md")) {
      const slug = file.replace(/\.md$/, "");
      if (existsStmt.get(slug)) {
        skipped++;
        continue;
      }
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const fm = parseFrontmatter(raw) ?? {};
      const type = KNOWLEDGE_TYPE_META.some((m) => m.id === fm.type)
        ? fm.type
        : meta.id;
      const toJson = (v: unknown) => (Array.isArray(v) && v.length ? JSON.stringify(v) : null);
      insertStmt.run(
        slug,
        type,
        String(fm.name ?? file),
        String(fm.summary ?? ""),
        fm.useCase ? String(fm.useCase) : null,
        toJson(fm.stack),
        toJson(fm.tags),
        fm.status ? String(fm.status) : "active",
        fm.updated ? String(fm.updated) : today,
        fm.repoUrl ? String(fm.repoUrl) : null,
        fm.source ? String(fm.source) : null,
        // 旧本地文件的贡献人未知，置空（不可被他人管理，仅展示）
        null,
        extractBody(raw),
        now,
        now,
      );
      inserted++;
      console.log(`插入 ${type}/${slug}（原文件夹 ${path.basename(dir)}）`);
    }
  }
  sqlite.close();
  console.log(`迁移完成：新增 ${inserted}，跳过 ${skipped}`);
}

main();