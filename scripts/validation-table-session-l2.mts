/**
 * 验证：表格会话 L2（Supabase）跨实例找回 —— 根治 `410 table_expired`
 *
 * 背景：upload 与 analyze 在 Vercel Serverless 上可能落到不同容器，
 * 旧实现只有进程内 Map（L1），跨实例必然 getTableCache → null → 410。
 *
 * 验证手法：用**两个独立 node 子进程**模拟两个容器实例。
 * 子进程各自拥有一份全新的空 L1 Map，因此 reader 能读到数据，
 * 只可能来自 L2（Supabase brain_table_sessions）。
 *
 * 用例：
 *   C1 跨实例找回      writer 写 → 全新 reader 进程读 → headers/rows/columnTypes 必须一致
 *   C2 防串读          换一个 userId 读同一 tableId → 必须 null
 *   C3 删除后不可读     deleteTableCache（含 L2）→ 全新进程读 → 必须 null
 *   C4 凭据缺失即暴露   清掉 SUPABASE_SERVICE_ROLE_KEY → L2 停用，跨实例读 null（不静默假成功）
 *
 * 运行：pnpm validate:table-session-l2
 */

import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

/* ─────────── env 加载（独立 node 进程不会自动读 .env） ─────────── */
function loadEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(".env");
loadEnv(".env.local");

/* ─────────── 测试夹具 ─────────── */
const HEADERS = ["订单号", "金额", "下单时间"];
const ROWS: unknown[][] = [
  ["A-1001", 129.5, "2026-08-30"],
  ["A-1002", 88, "2026-08-31"],
  ["A-1003", 240.75, "2026-09-01"],
];
const TYPES = ["string", "number", "date"];

async function fetchAnyUserId(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${url}/rest/v1/users?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const j: unknown = await r.json();
  if (!Array.isArray(j) || !j[0] || typeof (j[0] as { id?: string }).id !== "string") {
    throw new Error(`users 表取不到 id（HTTP ${r.status}）: ${JSON.stringify(j)}`);
  }
  return (j[0] as { id: string }).id;
}

/* ─────────── 子进程 phase ─────────── */
const [, self, phase, argUser = "", argTable = ""] = process.argv;

async function phaseWrite(): Promise<void> {
  const { cacheTable } = await import("../lib/table/session-cache");
  const id = await cacheTable(argUser, HEADERS, ROWS, TYPES);
  console.log(`TABLE_ID=${id}`);
}

async function phaseRead(): Promise<void> {
  const { getTableCache } = await import("../lib/table/session-cache");
  const got = await getTableCache(argTable, argUser);
  console.log(`READ=${JSON.stringify(got)}`);
}

async function phaseDelete(): Promise<void> {
  const { deleteTableCache } = await import("../lib/table/session-cache");
  await deleteTableCache(argTable, argUser);
  console.log("DELETED=1");
}

/* ─────────── orchestrator ─────────── */
type Res = { ok: boolean; out: string; err: string };

function run(ph: string, user: string, table = "", env: Record<string, string> = {}): Res {
  const r = spawnSync(process.execPath, [self, ph, user, table], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { ok: r.status === 0, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function pick(out: string, key: string): string | null {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(out);
  return m ? m[1] : null;
}

const results: Array<{ id: string; name: string; pass: boolean; detail: string }> = [];
function check(id: string, name: string, pass: boolean, detail: string): void {
  results.push({ id, name, pass, detail });
  console.log(`${pass ? "✅" : "❌"} ${id} ${name} —— ${detail}`);
}

async function orchestrate(): Promise<void> {
  console.log("=== 表格会话 L2 跨实例验证（双进程模拟 Serverless 多容器）===\n");

  const userId = await fetchAnyUserId();
  const otherUserId = randomUUID();
  console.log(`真实 userId : ${userId.slice(0, 8)}…（取自 users 表）`);
  console.log(`陌生 userId : ${otherUserId.slice(0, 8)}…（随机，用于防串读）\n`);

  // --- writer 进程 ---
  const w = run("write", userId);
  const tableId = pick(w.out, "TABLE_ID");
  if (!tableId) {
    console.error("writer 失败：\n" + w.out + w.err);
    process.exit(1);
  }
  console.log(`[实例 A · writer] cacheTable → tableId=${tableId}\n`);

  // --- C1 跨实例找回 ---
  const r1 = run("read", userId, tableId);
  const raw1 = pick(r1.out, "READ");
  let c1detail = "reader 返回 null（L2 未生效 → 线上就是 410）";
  let c1pass = false;
  if (raw1 && raw1 !== "null") {
    const got = JSON.parse(raw1) as {
      headers: string[];
      rows: unknown[][];
      columnTypes: string[];
    };
    const same =
      JSON.stringify(got.headers) === JSON.stringify(HEADERS) &&
      JSON.stringify(got.rows) === JSON.stringify(ROWS) &&
      JSON.stringify(got.columnTypes) === JSON.stringify(TYPES);
    c1pass = same;
    c1detail = same
      ? `全新进程读回 ${got.rows.length} 行 / ${got.headers.length} 列，与写入完全一致`
      : `读回了数据但内容不一致：${raw1.slice(0, 200)}`;
  }
  check("C1", "跨实例找回", c1pass, c1detail);

  // --- C2 防串读 ---
  const r2 = run("read", otherUserId, tableId);
  const raw2 = pick(r2.out, "READ");
  check(
    "C2",
    "防串读（他人 userId）",
    raw2 === "null",
    raw2 === "null" ? "陌生 userId 读同一 tableId → null" : `未拦截，返回：${String(raw2).slice(0, 120)}`,
  );

  // --- C4 凭据缺失即停用（先于删除跑，需要数据仍在） ---
  const r4 = run("read", userId, tableId, { SUPABASE_SERVICE_ROLE_KEY: "" });
  const raw4 = pick(r4.out, "READ");
  const warned = /SUPABASE_SERVICE_ROLE_KEY/.test(r4.out + r4.err);
  check(
    "C4",
    "缺 service_role 时明确告警",
    raw4 === "null" && warned,
    raw4 !== "null"
      ? "居然读到了数据，凭据检查形同虚设"
      : warned
        ? "L2 停用且日志点名 SUPABASE_SERVICE_ROLE_KEY（不再静默回落 anon）"
        : "L2 已停用，但日志未点名缺失变量，线上难排查",
  );

  // --- C3 删除后不可读 ---
  const d = run("delete", userId, tableId);
  if (!d.ok) console.error("delete 阶段异常：" + d.err);
  const r3 = run("read", userId, tableId);
  const raw3 = pick(r3.out, "READ");
  check(
    "C3",
    "删除后跨实例不可读",
    raw3 === "null",
    raw3 === "null" ? "L2 记录已随 deleteTableCache 清除" : `残留数据：${String(raw3).slice(0, 120)}`,
  );

  // --- 汇总 ---
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== 结果：${results.length - failed.length}/${results.length} 通过 ===`);
  if (failed.length) {
    console.log("未通过：" + failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("L2 持久化生效，upload/analyze 跨容器不再 410 table_expired。");
}

/* ─────────── 分派 ─────────── */
const main =
  phase === "write"
    ? phaseWrite
    : phase === "read"
      ? phaseRead
      : phase === "delete"
        ? phaseDelete
        : orchestrate;

main().catch((e) => {
  console.error((e as Error).stack ?? String(e));
  process.exit(1);
});
