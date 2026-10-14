// 双模式数据库层：
// - 设置了 Postgres 连接串 → 走 Supabase/Postgres（postgres-js 驱动），用于 Vercel 线上部署；
// - 否则 → 回退本地 better-sqlite3 文件库，用于本地零运维开发。
// 两个驱动均按需「动态 import」，确保 Vercel 构建期永远不会触碰 better-sqlite3 原生模块。
// 业务代码只需 `import { db, users, projects } from "@/lib/db"`，无需关心底层方言。
// 模式选择：显式 DB_MODE=pg|sqlite 单一开关（审计 C3）；未设置时按连接串自动探测（Vercel 兼容）。

import { reconcilePgSchema } from "./pg-schema-reconcile";
import { applySqliteDdl } from "./ddl-sqlite";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as SqliteSchema from "./schema";

// Vercel 部署时数据库 URL 可能由不同集成自动注入，这里按优先级兜底识别：
// 1) DATABASE_URL          —— 用户手动设置（推荐，用 Supabase 事务池 6543 端口）
// 2) POSTGRES_URL          —— Vercel 自带 Postgres Storage（池化）
// 3) SUPABASE_DB_URL       —— Supabase 官方 Vercel 集成（直连）
// 4) POSTGRES_URL_NON_POOLING —— Vercel Postgres 直连
function resolveDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.SUPABASE_DB_URL ??
    process.env.POSTGRES_URL_NON_POOLING ??
    ""
  );
}

// C2 · 双 DB 单一开关（审计 C3）：
//   DB_MODE=pg      → 强制 Postgres（连接串缺失时启动即报错，杜绝静默回退）
//   DB_MODE=sqlite  → 强制本地 SQLite（即使配了连接串也不连远端，本地可安全保留 env）
//   DB_MODE=browser → 浏览器数据层（sql.js + IndexedDB 字节持久化；由 sw 打包时 define 注入）
//   未设置          → 向后兼容自动探测（有连接串 → pg，否则 sqlite；Vercel 只注入连接串）
function resolveDbMode(): "pg" | "sqlite" | "browser" {
  const mode = (process.env.DB_MODE ?? "").trim().toLowerCase();
  if (mode === "pg" || mode === "postgres") return "pg";
  if (mode === "sqlite" || mode === "local") return "sqlite";
  if (mode === "browser") return "browser";
  if (mode) {
    throw new Error(`[db] 未知 DB_MODE="${process.env.DB_MODE}"，仅支持 pg | sqlite | browser`);
  }
  return DATABASE_URL ? "pg" : "sqlite";
}

const DATABASE_URL = resolveDatabaseUrl();
const dbMode = resolveDbMode();
const isPg = dbMode === "pg";
/** 浏览器数据层（service worker 轨道）：身份、持久化、服务端专属功能都按此分流 */
export const isBrowserData = dbMode === "browser";

if (isPg && !DATABASE_URL) {
  throw new Error(
    "[db] DB_MODE=pg 但未配置数据库连接串（DATABASE_URL / POSTGRES_URL / SUPABASE_DB_URL / POSTGRES_URL_NON_POOLING）。请补连接串，或改用 DB_MODE=sqlite 走本地库。",
  );
}

// R-2 · 连接串引导：:5432?pgbouncer=true 是 session 池（连接上限小、易打满），
// Supabase 官方推荐 6543 事务池。这里只告警不静默改写（改写连接串有副作用）。
if (isPg && /\b5432\b/.test(DATABASE_URL) && /pgbouncer=true/.test(DATABASE_URL)) {
  console.warn(
    "[db] 检测到 session 池连接串（:5432?pgbouncer=true）。建议改用事务池：端口改 6543 并去掉 pgbouncer=true（Supabase 控制台 → Database → Connection string → Pooled）。",
  );
}

let db!: BetterSQLite3Database<typeof SqliteSchema>;
let users!: typeof SqliteSchema.users;
let projects!: typeof SqliteSchema.projects;
let agentSettings!: typeof SqliteSchema.agentSettings;
let knowledgeEntries!: typeof SqliteSchema.knowledgeEntries;
let brainNotes!: typeof SqliteSchema.brainNotes;
let brainTasks!: typeof SqliteSchema.brainTasks;
let brainReviews!: typeof SqliteSchema.brainReviews;
let brainStrategies!: typeof SqliteSchema.brainStrategies;
let brainImaSyncLog!: typeof SqliteSchema.brainImaSyncLog;
let brainInboxItems!: typeof SqliteSchema.brainInboxItems;
let brainProjects!: typeof SqliteSchema.brainProjects;
let brainTaskTimeline!: typeof SqliteSchema.brainTaskTimeline;
let brainTaskComments!: typeof SqliteSchema.brainTaskComments;
let brainReminderRules!: typeof SqliteSchema.brainReminderRules;
let brainReminderLog!: typeof SqliteSchema.brainReminderLog;
let brainNoteAccessLog!: typeof SqliteSchema.brainNoteAccessLog;
let brainProcessingPlans!: typeof SqliteSchema.brainProcessingPlans;
let brainReminderItems!: typeof SqliteSchema.brainReminderItems;
let brainSimilarPairs!: typeof SqliteSchema.brainSimilarPairs;
let brainRelations!: typeof SqliteSchema.brainRelations;
let brainCurationLog!: typeof SqliteSchema.brainCurationLog;
let brainTaskOutcomes!: typeof SqliteSchema.brainTaskOutcomes;
let brainWeeklyReviews!: typeof SqliteSchema.brainWeeklyReviews;
let brainLearningReviews!: typeof SqliteSchema.brainLearningReviews;
let brainLearningReviewEvents!: typeof SqliteSchema.brainLearningReviewEvents;
let brainProactiveState!: typeof SqliteSchema.brainProactiveState;
let brainProactivePreferences!: typeof SqliteSchema.brainProactivePreferences;
let brainProactiveActions!: typeof SqliteSchema.brainProactiveActions;
let brainNotifications!: typeof SqliteSchema.brainNotifications;
let userPreferences!: typeof SqliteSchema.userPreferences;
let userImaConfig!: typeof SqliteSchema.userImaConfig;
let userObsidianConfig!: typeof SqliteSchema.userObsidianConfig;
let userFeishuConfig!: typeof SqliteSchema.userFeishuConfig;
let aiModelConfigs!: typeof SqliteSchema.aiModelConfigs;
let aiModelSettings!: typeof SqliteSchema.aiModelSettings;
let aiUsage!: typeof SqliteSchema.aiUsage;
let flowOpLedger!: typeof SqliteSchema.flowOpLedger;
let projectCheckpoints!: typeof SqliteSchema.projectCheckpoints;
let privateData!: typeof SqliteSchema.privateData;
let privateDataAudit!: typeof SqliteSchema.privateDataAudit;
let decisionLedger!: typeof SqliteSchema.decisionLedger;
let auditLogs!: typeof SqliteSchema.auditLogs;
let schema!: typeof SqliteSchema;

// 初始化整体收进函数：Service Worker 脚本静态禁止顶层 top-level await（与代码是否执行无关），
// 而本文件的驱动加载必须 await。node 侧靠下方那条 await 保持「import 即就绪」，
// 浏览器侧那条语句的条件会被 esbuild define 折叠成 false、连内部 await 一起剪掉。
async function initDb(): Promise<void> {
  if (isPg) {
    const [{ drizzle }, postgresMod, schemaPg] = await Promise.all([
      import("drizzle-orm/postgres-js"),
      import("postgres"),
      import("./schema.pg"),
    ]);
    // 全局单例 client：dev 模式 HMR 反复 reload 模块时复用同一连接池，
    // 避免每次热更新都 new 一个 postgres 客户端叠加连接，最终打满 Supabase 15 连接池。
    const g = globalThis as any;
    let client = g.__xiye_pg_client__ as ReturnType<typeof postgresMod.default> | undefined;
    if (!client) {
      client = postgresMod.default(DATABASE_URL, { prepare: false, max: 8 });
      g.__xiye_pg_client__ = client;
    }
    db = drizzle(client, { schema: schemaPg }) as unknown as BetterSQLite3Database<typeof SqliteSchema>;
    users = schemaPg.users as unknown as typeof SqliteSchema.users;
    projects = schemaPg.projects as unknown as typeof SqliteSchema.projects;
    agentSettings = schemaPg.agentSettings as unknown as typeof SqliteSchema.agentSettings;
    knowledgeEntries = schemaPg.knowledgeEntries as unknown as typeof SqliteSchema.knowledgeEntries;
    brainNotes = schemaPg.brainNotes as unknown as typeof SqliteSchema.brainNotes;
    brainTasks = schemaPg.brainTasks as unknown as typeof SqliteSchema.brainTasks;
    brainReviews = schemaPg.brainReviews as unknown as typeof SqliteSchema.brainReviews;
    brainStrategies = schemaPg.brainStrategies as unknown as typeof SqliteSchema.brainStrategies;
    brainImaSyncLog = schemaPg.brainImaSyncLog as unknown as typeof SqliteSchema.brainImaSyncLog;
    brainInboxItems = schemaPg.brainInboxItems as unknown as typeof SqliteSchema.brainInboxItems;
    brainProjects = schemaPg.brainProjects as unknown as typeof SqliteSchema.brainProjects;
    brainTaskTimeline = schemaPg.brainTaskTimeline as unknown as typeof SqliteSchema.brainTaskTimeline;
    brainTaskComments = schemaPg.brainTaskComments as unknown as typeof SqliteSchema.brainTaskComments;
    brainReminderRules = schemaPg.brainReminderRules as unknown as typeof SqliteSchema.brainReminderRules;
    brainReminderLog = schemaPg.brainReminderLog as unknown as typeof SqliteSchema.brainReminderLog;
    brainNoteAccessLog = schemaPg.brainNoteAccessLog as unknown as typeof SqliteSchema.brainNoteAccessLog;
    brainProcessingPlans = schemaPg.brainProcessingPlans as unknown as typeof SqliteSchema.brainProcessingPlans;
    brainReminderItems = schemaPg.brainReminderItems as unknown as typeof SqliteSchema.brainReminderItems;
    brainSimilarPairs = schemaPg.brainSimilarPairs as unknown as typeof SqliteSchema.brainSimilarPairs;
    brainRelations = schemaPg.brainRelations as unknown as typeof SqliteSchema.brainRelations;
    brainCurationLog = schemaPg.brainCurationLog as unknown as typeof SqliteSchema.brainCurationLog;
    brainTaskOutcomes = schemaPg.brainTaskOutcomes as unknown as typeof SqliteSchema.brainTaskOutcomes;
    brainWeeklyReviews = schemaPg.brainWeeklyReviews as unknown as typeof SqliteSchema.brainWeeklyReviews;
    brainLearningReviews = schemaPg.brainLearningReviews as unknown as typeof SqliteSchema.brainLearningReviews;
    brainLearningReviewEvents = schemaPg.brainLearningReviewEvents as unknown as typeof SqliteSchema.brainLearningReviewEvents;
    brainProactiveState = schemaPg.brainProactiveState as unknown as typeof SqliteSchema.brainProactiveState;
    brainProactivePreferences = schemaPg.brainProactivePreferences as unknown as typeof SqliteSchema.brainProactivePreferences;
    brainProactiveActions = schemaPg.brainProactiveActions as unknown as typeof SqliteSchema.brainProactiveActions;
    brainNotifications = schemaPg.brainNotifications as unknown as typeof SqliteSchema.brainNotifications;
    userPreferences = schemaPg.userPreferences as unknown as typeof SqliteSchema.userPreferences;
    userImaConfig = schemaPg.userImaConfig as unknown as typeof SqliteSchema.userImaConfig;
    userObsidianConfig = schemaPg.userObsidianConfig as unknown as typeof SqliteSchema.userObsidianConfig;
    userFeishuConfig = schemaPg.userFeishuConfig as unknown as typeof SqliteSchema.userFeishuConfig;
    aiModelConfigs = schemaPg.aiModelConfigs as unknown as typeof SqliteSchema.aiModelConfigs;
    aiModelSettings = schemaPg.aiModelSettings as unknown as typeof SqliteSchema.aiModelSettings;
    aiUsage = schemaPg.aiUsage as unknown as typeof SqliteSchema.aiUsage;
    flowOpLedger = schemaPg.flowOpLedger as unknown as typeof SqliteSchema.flowOpLedger;
    privateDataAudit = schemaPg.privateDataAudit as unknown as typeof SqliteSchema.privateDataAudit;
    decisionLedger = schemaPg.decisionLedger as unknown as typeof SqliteSchema.decisionLedger;
    auditLogs = schemaPg.auditLogs as unknown as typeof SqliteSchema.auditLogs;
    schema = schemaPg as unknown as typeof SqliteSchema;
    // P0 根治：pg 路径启动幂等补齐缺失表/列（与 SQLite 路径自愈对齐）。
    // Vercel buildCommand 不跑 schema 脚本，纯 .sql 轨道下线上写操作会因缺表/缺列而崩。
    // 包裹 try/catch：DDL 失败（权限不足等）只告警，不阻断启动。
    if (process.env.DATABASE_RECONCILE !== "0") {
      try {
        await reconcilePgSchema(client);
      } catch (err) {
        console.error("[db] pg schema reconcile failed (non-fatal):", (err as Error)?.message);
      }
    }
  } else {
    const schemaSqlite = await import("./schema");
    // sqlite 方言下两条轨道共用同一份 applySqliteDdl：
    // - node（本地/桌面）：better-sqlite3 打开 ./xiye.db 文件；
    // - browser（线上 sw）：sql.js 内存库，整库字节存 IndexedDB（见 lib/browser/sqlite.ts）。
    let sqliteDb: unknown;
    if (isBrowserData) {
      const [{ drizzle: drizzleSqlJs }, { createBrowserSqlite }] = await Promise.all([
        import("drizzle-orm/sql-js"),
        import("@/lib/browser/sqlite"),
      ]);
      const sqlite = await createBrowserSqlite();
      sqlite.pragma("foreign_keys = ON");
      applySqliteDdl(sqlite);
      sqliteDb = drizzleSqlJs(sqlite.raw, { schema: schemaSqlite });
    } else {
      const [{ default: Database }, { drizzle: drizzleSqlite }] = await Promise.all([
        import("better-sqlite3"),
        import("drizzle-orm/better-sqlite3"),
      ]);
      const sqlite = new Database(process.env.SQLITE_PATH || "./xiye.db");
      sqlite.pragma("journal_mode = WAL");
      sqlite.pragma("foreign_keys = ON");
      applySqliteDdl(sqlite);
      sqliteDb = drizzleSqlite(sqlite, { schema: schemaSqlite });
    }
    db = sqliteDb as BetterSQLite3Database<typeof SqliteSchema>;
    users = schemaSqlite.users;
    projects = schemaSqlite.projects;
    agentSettings = schemaSqlite.agentSettings;
    knowledgeEntries = schemaSqlite.knowledgeEntries;
    brainNotes = schemaSqlite.brainNotes;
    brainTasks = schemaSqlite.brainTasks;
    brainReviews = schemaSqlite.brainReviews;
    brainStrategies = schemaSqlite.brainStrategies;
    brainImaSyncLog = schemaSqlite.brainImaSyncLog;
    brainInboxItems = schemaSqlite.brainInboxItems;
    brainProjects = schemaSqlite.brainProjects;
    brainTaskTimeline = schemaSqlite.brainTaskTimeline;
    brainTaskComments = schemaSqlite.brainTaskComments;
    brainReminderRules = schemaSqlite.brainReminderRules;
    brainReminderLog = schemaSqlite.brainReminderLog;
    brainNoteAccessLog = schemaSqlite.brainNoteAccessLog;
    brainProcessingPlans = schemaSqlite.brainProcessingPlans;
    brainReminderItems = schemaSqlite.brainReminderItems;
    brainSimilarPairs = schemaSqlite.brainSimilarPairs;
    brainRelations = schemaSqlite.brainRelations;
    brainCurationLog = schemaSqlite.brainCurationLog;
    brainTaskOutcomes = schemaSqlite.brainTaskOutcomes;
    brainWeeklyReviews = schemaSqlite.brainWeeklyReviews;
    brainLearningReviews = schemaSqlite.brainLearningReviews;
    brainLearningReviewEvents = schemaSqlite.brainLearningReviewEvents;
    brainProactiveState = schemaSqlite.brainProactiveState;
    brainProactivePreferences = schemaSqlite.brainProactivePreferences;
    brainProactiveActions = schemaSqlite.brainProactiveActions;
    brainNotifications = schemaSqlite.brainNotifications;
    userPreferences = schemaSqlite.userPreferences;
    userImaConfig = schemaSqlite.userImaConfig;
    userObsidianConfig = schemaSqlite.userObsidianConfig;
    userFeishuConfig = schemaSqlite.userFeishuConfig;
    aiModelConfigs = schemaSqlite.aiModelConfigs;
    aiModelSettings = schemaSqlite.aiModelSettings;
    aiUsage = schemaSqlite.aiUsage;
    flowOpLedger = schemaSqlite.flowOpLedger;
    projectCheckpoints = schemaSqlite.projectCheckpoints;
    privateData = schemaSqlite.privateData;
    privateDataAudit = schemaSqlite.privateDataAudit;
    decisionLedger = schemaSqlite.decisionLedger;
    auditLogs = schemaSqlite.auditLogs;
    schema = schemaSqlite;
  }
}

/**
 * 数据层就绪 Promise。本文件内禁止出现顶层 await —— 浏览器数据层的 sw 打包会被它
 * 逐层插入 await（esbuild 不会因条件为假而删除），而 Service Worker 脚本静态禁止顶层 await。
 * 所以初始化在这里只「发起」，何时 await 由入口决定：
 * - node 轨道：lib/db/index.ts 立刻 await，保持既有「import 即就绪」语义（35 个调用方零改动）；
 * - 浏览器轨道：sw 在分发第一个请求前 await（见 lib/browser/sw-entry.ts）。
 */
export const dbReady: Promise<void> = initDb();

export { db, users, projects, agentSettings, knowledgeEntries, brainNotes, brainTasks, brainReviews, brainStrategies, brainImaSyncLog, brainInboxItems, brainProjects, brainTaskTimeline, brainTaskComments, brainReminderRules, brainReminderLog, brainNoteAccessLog, brainProcessingPlans, brainReminderItems, brainSimilarPairs, brainRelations, brainCurationLog, brainTaskOutcomes, brainWeeklyReviews, brainLearningReviews, brainLearningReviewEvents, brainProactiveState, brainProactivePreferences, brainProactiveActions, brainNotifications, userPreferences, userImaConfig, userObsidianConfig, userFeishuConfig, aiModelConfigs, aiModelSettings, aiUsage, flowOpLedger, projectCheckpoints, privateData, privateDataAudit, decisionLedger, auditLogs, schema };
