// 浏览器数据层：用 sql.js（SQLite wasm）做出与 better-sqlite3 同形的最小句柄，
// 使 lib/db 的同一份 DDL（applySqliteDdl）与同一套 drizzle 查询在两条轨道下都能跑。
//
// 与 better-sqlite3 的差异已按本项目实际用法对齐：
// - WAL 无意义（内存库），journal_mode 调用保留但无害；
// - 没有「写磁盘」概念，落盘 = db.export() 全量字节写 IndexedDB（见 persist）。

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { readDbBytes, writeDbBytes } from "@/lib/browser/idb";

export interface BrowserSqliteHandle {
  /** 与 better-sqlite3 .pragma() 同形：入参不含 PRAGMA 前缀 */
  pragma(sql: string): void;
  /** 与 better-sqlite3 .exec() 同形：可一次给多条语句 */
  exec(sql: string): void;
  /** 交给 drizzle-orm/sql-js 的原始库实例 */
  raw: Database;
}

let sqlStatic: SqlJsStatic | null = null;
let currentRaw: Database | null = null;
/** 自上次落盘以来是否有写操作 */
let dirty = false;
let flushing: Promise<void> | null = null;

async function loadSqlJs(): Promise<SqlJsStatic> {
  if (sqlStatic) return sqlStatic;
  // wasm 由应用自己托管在 public/，同源加载、无需 locateFile 猜路径
  sqlStatic = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  return sqlStatic;
}

/**
 * 建库：优先从 IndexedDB 恢复上次的库字节，首次使用则建空库。
 * 注意：DDL 不在这里跑，由 lib/db 统一跑 applySqliteDdl（两条轨道同一处）。
 */
export async function createBrowserSqlite(): Promise<BrowserSqliteHandle> {
  const SQL = await loadSqlJs();
  const saved = await readDbBytes();
  const raw = saved ? new SQL.Database(saved) : new SQL.Database();
  currentRaw = raw;
  dirty = false;
  return {
    pragma(sql: string) {
      raw.run(`PRAGMA ${sql}`);
      markDirty();
    },
    exec(sql: string) {
      raw.run(sql);
      markDirty();
    },
    raw,
  };
}

export function markDirty(): void {
  dirty = true;
}

/**
 * 落盘：把整库字节写入 IndexedDB。
 * 串行化（同一时刻只有一次写在进行），避免并发 export 互相覆盖。
 */
export async function persist(): Promise<void> {
  if (!currentRaw) return;
  if (flushing) {
    await flushing;
    return;
  }
  if (!dirty) return;
  flushing = (async () => {
    await writeDbBytes(currentRaw!.export());
    dirty = false;
  })().finally(() => {
    flushing = null;
  });
  await flushing;
}

/** 当前库实例（供导入/导出 .db 文件用） */
export function currentDb(): Database | null {
  return currentRaw;
}

/** 用外部字节整库替换（导入备份）；调用方需重新初始化数据层 */
export async function replaceDbFrom(bytes: Uint8Array): Promise<void> {
  const SQL = await loadSqlJs();
  // 先校验能打开，再落盘：坏文件不应毁掉现有库
  const probe = new SQL.Database(bytes);
  probe.run("select count(*) from sqlite_master;");
  probe.delete();
  await writeDbBytes(bytes);
  currentRaw = null;
  dirty = false;
}
