/**
 * 飞书自建应用 OAuth 凭证：AES-256-GCM 加密存储 + 读写。
 *
 * 红线：飞书 user_access_token / refresh_token 是用户个人账号凭证，产品绝不代持、
 *       明文不出服务端、不落 log。每用户一行（按 userId 隔离）。
 * 密钥优先级：FEISHU_ENC_KEY → 缺失时复用 IMA_ENC_KEY → 再缺失仅本地开发兜底。
 *
 * 范式照搬 lib/ima-config.ts（AES-256-GCM + ensureTable 自愈）。
 */

import crypto from "node:crypto";
import { db, userFeishuConfig } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// 自愈：本地 sqlite 的 dev server 常在「建表 SQL 之前」就启动，导致连接缓存旧 schema、
// 看不到后加的 user_feishu_config 表。首次调用时补建一次（IF NOT EXISTS 幂等）。
// pg 路径由迁移管理，db.run 不存在时直接跳过。
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (tableReady) return tableReady;
  tableReady = (async () => {
    const anyDb = db as unknown as { run?: (s: unknown) => Promise<unknown> };
    if (typeof anyDb.run !== "function") return;
    await anyDb.run(sql`CREATE TABLE IF NOT EXISTS user_feishu_config (
      user_id text primary key,
      access_token_enc text not null,
      refresh_token_enc text not null,
      expires_at integer not null default 0,
      scope text,
      created_at integer not null,
      updated_at integer not null
    )`);
  })().catch((e) => {
    tableReady = null; // 允许下次重试
    throw e;
  });
  return tableReady;
}

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw = process.env.FEISHU_ENC_KEY ?? process.env.IMA_ENC_KEY;
  if (raw && raw.length >= 32) return Buffer.from(raw.slice(0, 32), "utf8");
  if (raw) return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
  // 安全红线：生产缺失加密密钥时拒绝服务，仅本地开发允许固定兜底密钥。
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[feishu-config] 生产环境必须配置 FEISHU_ENC_KEY（≥32 字符），拒绝使用源码兜底密钥",
    );
  }
  console.warn(
    "[feishu-config] FEISHU_ENC_KEY/IMA_ENC_KEY 未设置，使用固定兜底密钥（仅限本地开发；生产必须配置）",
  );
  return Buffer.from("xiye-dev-feishu-fallback-00000000".slice(0, 32), "utf8");
}

/** 加密明文 → "iv:tag:enc"（均 base64）。 */
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(":");
}

/** 解密 "iv:tag:enc" → 明文。 */
export function decrypt(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, encB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !encB64) return "";
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export interface FeishuCreds {
  /** 解密后的 user_access_token */
  accessToken: string;
  /** 解密后的 refresh_token */
  refreshToken: string;
  /** user_access_token 过期时间（epoch ms）；0 表示未知 */
  expiresAt: number;
  /** 授权范围 */
  scope?: string;
}

/** 读取用户已绑定的飞书凭证（token 已解密）。未绑定返回 null。 */
export async function getFeishuConfig(userId: string): Promise<FeishuCreds | null> {
  try {
    await ensureTable();
    const rows = (await db
      .select()
      .from(userFeishuConfig)
      .where(eq(userFeishuConfig.userId, userId))) as Array<{
      accessTokenEnc: string;
      refreshTokenEnc: string;
      expiresAt: number;
      scope: string | null;
    }>;
    if (!rows[0]) return null;
    return {
      accessToken: decrypt(rows[0].accessTokenEnc),
      refreshToken: decrypt(rows[0].refreshTokenEnc),
      expiresAt: rows[0].expiresAt,
      scope: rows[0].scope ?? undefined,
    };
  } catch (err) {
    console.error("[feishu-config] get failed:", err);
    return null;
  }
}

/** 保存 / 更新用户飞书凭证（token 加密后入库）。 */
export async function upsertFeishuConfig(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresAt: number,
  scope?: string,
): Promise<void> {
  const now = Date.now();
  const encAccess = encrypt(accessToken);
  const encRefresh = encrypt(refreshToken);
  await ensureTable();
  await db
    .insert(userFeishuConfig)
    .values({
      userId,
      accessTokenEnc: encAccess,
      refreshTokenEnc: encRefresh,
      expiresAt,
      scope: scope ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userFeishuConfig.userId,
      set: {
        accessTokenEnc: encAccess,
        refreshTokenEnc: encRefresh,
        expiresAt,
        scope: scope ?? null,
        updatedAt: now,
      },
    });
}

/** 解绑（删除）用户飞书凭证。 */
export async function deleteFeishuConfig(userId: string): Promise<void> {
  try {
    await ensureTable();
    await db.delete(userFeishuConfig).where(eq(userFeishuConfig.userId, userId));
  } catch (err) {
    console.error("[feishu-config] delete failed:", err);
  }
}
