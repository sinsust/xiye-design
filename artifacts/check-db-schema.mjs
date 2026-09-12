// 只读检查：列出 brain_* 表 + 关键表的列
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) { console.error("no DATABASE_URL"); process.exit(1); }

const direct = url
  .replace("aws-0-ap-northeast-2.pooler.supabase.com:5432", "db.qnvcfcgctlqujhcpfpay.supabase.co:5432")
  .replace("postgres.qnvcfcgctlqujhcpfpay:", "postgres:");
const sql = postgres(direct, { ssl: { rejectUnauthorized: false }, max: 1 });

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema='public' and table_name like 'brain_%' order by table_name`;
console.log("=== brain_* tables in DB ===");
console.log(tables.map(r => r.table_name).join("\n"));

const focus = ["brain_notes", "brain_projects", "brain_inbox_items", "brain_proactive_state", "brain_notification_states", "brain_notifications", "brain_tasks", "brain_strategies", "brain_reviews"];
for (const t of focus) {
  const cols = await sql`
    select column_name from information_schema.columns
    where table_schema='public' and table_name=${t} order by ordinal_position`;
  if (cols.length === 0) { console.log(`\n[${t}] ❌ TABLE MISSING`); continue; }
  console.log(`\n[${t}] cols(${cols.length}): ${cols.map(r => r.column_name).join(", ")}`);
}
await sql.end();
