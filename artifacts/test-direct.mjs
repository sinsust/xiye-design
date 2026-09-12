// 直连稳定性测试 x8
import { readFileSync } from "node:fs";
import postgres from "postgres";
const env = readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const direct = url
  .replace("aws-0-ap-northeast-2.pooler.supabase.com:5432", "db.qnvcfcgctlqujhcpfpay.supabase.co:5432")
  .replace("postgres.qnvcfcgctlqujhcpfpay:", "postgres:");
let ok = 0, fail = 0;
for (let i = 0; i < 8; i++) {
  const sql = postgres(direct, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8 });
  try { await sql`select 1`; ok++; } catch (e) { fail++; console.log(e.code, e.message?.slice(0, 80)); }
  await sql.end({ timeout: 1 });
}
console.log(`direct: ok=${ok} fail=${fail}`);
