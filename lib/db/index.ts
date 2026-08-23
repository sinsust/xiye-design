import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// 本地：better-sqlite3 文件库（零运维，Docker 不可用环境下直接跑通）。
// PHASE B（线上）：替换为 drizzle-orm/postgres-js 的 postgres 驱动，
//   const { drizzle } = await import("drizzle-orm/postgres-js");
//   export const db = drizzle(postgres(process.env.DATABASE_URL!), { schema });
// 其余业务代码无需改动。
const dbPath = process.env.SQLITE_PATH || "./xiye.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
