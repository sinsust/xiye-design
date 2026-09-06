// M3 收录闭环改造 — content=原文 的存量迁移（决策 16 兜底）。
//
// 背景：旧版落库用 `organized.rewritten || rawContent` 当 content，AI 改写可能覆盖了用户原文，
// 且 struct.organized 未存原始输入 → 原文不可逆恢复。此脚本不伪造复原，
// 只对那些「content 已被改写覆盖」的行在 struct 内打 `_migratedFromRewrite` 标记，
// 详情视图据此显示"早期记录，原文不可还原（改写保留在摘要/说明）"。
//
// 判定：struct.organized.rewritten 为字符串、非空、且 !== content。
// 幂等：已打标记的行跳过，可断点续跑。
//
// 双模式：设置了 DATABASE_URL（Postgres/Supabase/Vercel）→ 走 pg；否则回退本地 better-sqlite3。
// 运行：npx tsx scripts/migrate-brain-rewritten.ts
import fs from "node:fs";
import path from "node:path";

const FLAG = "_migratedFromRewrite";

function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  );
}

// Next 会自动加载 .env，但独立 tsx 脚本不会：这里轻量解析 .env（不覆盖已设置的变量）。
function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (!key || process.env[key] !== undefined) continue;
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

async function migratePg() {
  const { default: postgres } = await import("postgres"); // 动态 import，避免一步式 CJS 加载
  const sql = postgres(resolveDatabaseUrl(), { prepare: false });
  try {
    const rows = await sql`select id, content, struct from brain_notes
      where struct is not null and struct <> ''`;
    let flagged = 0;
    let skipped = 0;
    let malformed = 0;
    for (const r of rows) {
      let organized: Record<string, unknown>;
      try {
        organized = JSON.parse(r.struct) as Record<string, unknown>;
      } catch {
        malformed += 1;
        continue;
      }
      if (!organized || organized[FLAG] === true) {
        skipped += 1;
        continue;
      }
      const rewritten = organized?.rewritten;
      const isRewriteOverwritten =
        typeof rewritten === "string" && rewritten.trim() !== "" && rewritten !== (r.content ?? "");
      if (!isRewriteOverwritten) {
        skipped += 1;
        continue;
      }
      organized[FLAG] = true;
      await sql`update brain_notes set struct = ${sql.json(organized as unknown as Parameters<typeof sql.json>[0])} where id = ${r.id}`;
      flagged += 1;
    }
    console.log(
      `[pg] 迁移完成：标记改写覆盖 ${flagged} / 跳过(已迁移或原文) ${skipped} / struct非JSON跳过 ${malformed}`,
    );
  } finally {
    await sql.end();
  }
}

async function migrateSqlite() {
  const { default: Database } = await import("better-sqlite3");
  const DB_PATH = process.env.SQLITE_PATH
    ? path.resolve(process.env.SQLITE_PATH)
    : path.join(process.cwd(), "xiye.db");
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  try {
    const rows = sqlite
      .prepare(
        `select id, content, struct from brain_notes
         where struct is not null and struct != '' order by created_at asc`,
      )
      .all() as Array<{ id: string; content: string | null; struct: string | null }>;
    const upd = sqlite.prepare("update brain_notes set struct = ?, updated_at = ? where id = ?");
    let flagged = 0;
    let skipped = 0;
    let malformed = 0;
    const now = Date.now();
    for (const r of rows) {
      let organized: Record<string, unknown>;
      try {
        organized = JSON.parse(r.struct as string) as Record<string, unknown>;
      } catch {
        malformed += 1;
        continue;
      }
      if (!organized || organized[FLAG] === true) {
        skipped += 1;
        continue;
      }
      const rewritten = organized?.rewritten;
      const isRewriteOverwritten =
        typeof rewritten === "string" && rewritten.trim() !== "" && rewritten !== (r.content ?? "");
      if (!isRewriteOverwritten) {
        skipped += 1;
        continue;
      }
      organized[FLAG] = true;
      upd.run(String(JSON.stringify(organized)), now, r.id);
      flagged += 1;
    }
    console.log(
      `[sqlite] 迁移完成：标记改写覆盖 ${flagged} / 跳过(已迁移或原文) ${skipped} / struct非JSON跳过 ${malformed}`,
    );
  } finally {
    sqlite.close();
  }
}

async function main() {
  loadDotEnv();
  if (resolveDatabaseUrl()) {
    await migratePg();
  } else {
    await migrateSqlite();
  }
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});