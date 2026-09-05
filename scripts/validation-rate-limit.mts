/**
 * 限流持久化验证（批次2 P1 #3 跨实例）：
 * 直连真实 Supabase 调 rateLimit()，断言：
 *   T1 窗口内超 limit 被拦截（limit=3 → 前3次放行、第4次拦截）
 *   T2 短窗口过期后放行（limit=1/window=2000ms → 立即二次拦截、等 2300ms 后放行；
 *      窗口需远大于远端 RPC 网络延迟才能稳定复现"窗口内"）
 *
 * 依赖真实 Supabase（RPC check_rate_limit + rate_limits 表）。
 * 无 env 时 SKIP（exit 0），CI 未配 Secrets 时不误红。
 * 运行：npm run validate:rate-limit
 */

import { rateLimit } from "../lib/rate-limit";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";

/* ─────────── env 加载（独立 node 进程不自动读 .env） ─────────── */
function loadEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(".env");
loadEnv(".env.local");

/* ─────────── 断言 ─────────── */
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`✅ ${name}${detail ? " —— " + detail : ""}`);
  } else {
    failed++;
    console.error(`❌ ${name}${detail ? " —— " + detail : ""}`);
  }
}

async function main(): Promise<void> {
  // 无 Supabase env → 诚实跳过（不视为失败）
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("=== 限流持久化验证（跨实例 RPC）===");
    console.log("⚠️  SKIP: 未配置 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY，");
    console.log("    CI 未注入凭据时跳过（不视为失败）；配置后会在真实 Supabase 上验证。");
    process.exit(0);
  }

  console.log("=== 限流持久化验证（跨实例 RPC）===\n");

  // T1：limit=3 / 60s，前3次放行、第4次拦截
  const k1 = `validate-ratelimit:${randomUUID()}`;
  const t1a = await rateLimit(k1, 3, 60_000);
  const t1b = await rateLimit(k1, 3, 60_000);
  const t1c = await rateLimit(k1, 3, 60_000);
  const t1d = await rateLimit(k1, 3, 60_000);
  check("T1 前3次放行", t1a && t1b && t1c, `hits 1/2/3 → ${t1a}/${t1b}/${t1c}`);
  check("T1 第4次拦截", t1d === false, `第4次(>limit) → ${t1d}`);

  // T2：limit=1 / 2000ms，立即二次拦截、过期后放行
  // 注：DB 在远端，单次 RPC 有网络延迟（~数十 ms），窗口需远大于延迟才能稳定复现"窗口内"。
  const k2 = `validate-ratelimit:${randomUUID()}`;
  const t2a = await rateLimit(k2, 1, 2000);
  const t2b = await rateLimit(k2, 1, 2000);
  check("T2 首次放行", t2a === true, `首次 → ${t2a}`);
  check("T2 立即二次拦截", t2b === false, `2000ms 内二次 → ${t2b}`);
  await new Promise((r) => setTimeout(r, 2300));
  const t2c = await rateLimit(k2, 1, 2000);
  check("T2 窗口过期后放行", t2c === true, `等 2300ms(>2000ms) → ${t2c}`);

  console.log(`\n=== 结果：${passed} 通过, ${failed} 失败 ===`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error((e as Error).stack ?? String(e));
  process.exit(1);
});
