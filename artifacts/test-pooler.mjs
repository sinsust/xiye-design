// 连续 N 次走 pooler 新建连接，统计被拒率（session mode 15 上限）
import { readFileSync } from "node:fs";
import postgres from "postgres";

const env = readFileSync(".env", "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();

let ok = 0, fail = 0;
const errs = {};
for (let i = 0; i < 12; i++) {
  const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 8 });
  try {
    await sql`select 1`;
    ok++;
  } catch (e) {
    fail++;
    const k = e.code || e.message?.slice(0, 60);
    errs[k] = (errs[k] || 0) + 1;
  }
  await sql.end({ timeout: 1 });
}
console.log(`pooler: ok=${ok} fail=${fail}`);
for (const [k, v] of Object.entries(errs)) console.log(`  ${k} x${v}`);
