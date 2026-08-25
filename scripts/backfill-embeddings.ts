// 历史笔记语义向量回填：为 superseded=0 且尚无 embedding 的笔记逐条生成向量。
// - 断点续跑：每条更新后立刻写库，中断后重跑只处理缺失项。
// - 进度输出：[12/87] 处理中...
// 运行：npx tsx scripts/backfill-embeddings.ts
// 注意：lib/db 含 top-level await（CJS tsx 不支持），故用 better-sqlite3 原生 SQL；
//     embed 来自 lib/embedding.ts（仅动态 import，无顶层 await），tsx 可正常加载。
import path from "node:path";
import Database from "better-sqlite3";
import { embed, buildListableText } from "../lib/embedding";

const DB_PATH = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.join(process.cwd(), "xiye.db");

async function main() {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");

  // 确保需要的列存在（老库缺列时幂等补上，与 lib/db/index.ts 本地 DDL 一致）
  for (const col of [
    `alter table brain_notes add column superseded integer not null default 0`,
    `alter table brain_notes add column code_content text`,
    `alter table brain_notes add column embedding text`,
  ]) {
    try {
      sqlite.exec(col);
    } catch {
      /* 列已存在 */
    }
  }

  const rows = sqlite
    .prepare(
      `select id, title, content, summary, tags, code_content
       from brain_notes
       where superseded = 0 and (embedding is null or embedding = '')
       order by created_at asc`,
    )
    .all() as Array<{
    id: string;
    title: string | null;
    content: string | null;
    summary: string | null;
    tags: string | null;
    code_content: string | null;
  }>;

  const total = rows.length;
  if (!total) {
    console.log("没有需要回填的笔记（已全部有向量）");
    sqlite.close();
    return;
  }
  console.log(`待回填 ${total} 条，开始生成向量...`);

  const upd = sqlite.prepare(
    `update brain_notes set embedding = ?, updated_at = ? where id = ?`,
  );
  let ok = 0;
  let skipped = 0;

  for (let i = 0; i < total; i++) {
    const r = rows[i];
    const tags = (() => {
      try {
        const v = JSON.parse(r.tags ?? "[]");
        return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
      } catch {
        return [];
      }
    })();
    // 代码片段优先用 code_content 做向量，语义更贴近"代码本身"
    const vec = await embed(
      buildListableText({
        title: r.title ?? "",
        content: r.code_content || r.content || "",
        summary: r.summary ?? "",
        tags,
      }),
    );
    if (vec) {
      upd.run(JSON.stringify(vec), Date.now(), r.id);
      ok++;
    } else {
      skipped++;
    }
    console.log(`[${i + 1}/${total}] ${ok + skipped === total ? "完成" : "处理中"}: ${(r.title || "(无标题)").slice(0, 30)}`);
  }

  sqlite.close();
  console.log(`回填完成：成功 ${ok}，失败/跳过 ${skipped}（失败者下次重跑会继续补）`);
}

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});