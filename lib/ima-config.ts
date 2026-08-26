// 用户绑定的腾讯 ima 凭证：AES-256-GCM 加密存储 + 读写。
//
// 红线：ima 的 client_id / api_key 是用户个人账号凭证，产品绝不代持、明文不出服务端、不落 log。
// 每用户一行（按 email 隔离），密钥来自 env IMA_ENC_KEY（生产必须配置；缺失时仅本地开发兜底）。

import crypto from "node:crypto";
import { db, userImaConfig } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

// 自愈：本地 sqlite 的 dev server 常在「建表 SQL 之前」就启动，导致连接缓存旧 schema、
// 看不到后加的 user_ima_config 表。首次调用时在自己这条连接上补建一次（IF NOT EXISTS 幂等），
// 既修好旧进程、又防以后重复踩坑；pg 路径由迁移管理，db.run 不存在时直接跳过。
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (tableReady) return tableReady;
  tableReady = (async () => {
    const anyDb = db as unknown as { run?: (s: unknown) => Promise<unknown> };
    if (typeof anyDb.run !== "function") return;
    await anyDb.run(sql`CREATE TABLE IF NOT EXISTS user_ima_config (
      email text primary key,
      ima_client_id text not null,
      ima_api_key text not null,
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
  const raw = process.env.IMA_ENC_KEY;
  if (raw && raw.length >= 32) return Buffer.from(raw.slice(0, 32), "utf8");
  if (raw) return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
  // 安全红线：生产缺失 IMA_ENC_KEY 时拒绝服务（源码内兜底密钥可被任何人解密用户凭证），
  // 仅本地开发允许使用固定兜底密钥。
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[ima-config] 生产环境必须配置 IMA_ENC_KEY（≥32 字符），拒绝使用源码兜底密钥",
    );
  }
  console.warn(
    "[ima-config] IMA_ENC_KEY 未设置，使用固定兜底密钥（仅限本地开发；生产必须配置 IMA_ENC_KEY）",
  );
  return Buffer.from("xiye-dev-ima-fallback-key-0000000000".slice(0, 32), "utf8");
}

/** 加密明文 → "iv:tag:enc"（均 base64）。 */
export function encrypt(plain: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
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

export interface ImaCreds {
  clientId: string;
  apiKey: string;
}

/** 读取用户已绑定的 ima 凭证（apiKey 已解密）。未绑定返回 null。 */
export async function getImaConfig(email: string): Promise<ImaCreds | null> {
  try {
    await ensureTable();
    const rows = (await db
      .select()
      .from(userImaConfig)
      .where(eq(userImaConfig.email, email))) as Array<{
      imaClientId: string;
      imaApiKey: string;
    }>;
    if (!rows[0]) return null;
    return { clientId: rows[0].imaClientId, apiKey: decrypt(rows[0].imaApiKey) };
  } catch (err) {
    console.error("[ima-config] get failed:", err);
    return null;
  }
}

/** 保存 / 更新用户 ima 凭证（apiKey 加密后入库）。 */
export async function upsertImaConfig(
  email: string,
  clientId: string,
  apiKey: string,
): Promise<void> {
  const now = Date.now();
  const encKey = encrypt(apiKey);
  await ensureTable();
  await db
    .insert(userImaConfig)
    .values({
      email,
      imaClientId: clientId,
      imaApiKey: encKey,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userImaConfig.email,
      set: { imaClientId: clientId, imaApiKey: encKey, updatedAt: now },
    });
}

/** 解绑（删除）用户 ima 凭证。 */
export async function deleteImaConfig(email: string): Promise<void> {
  try {
    await ensureTable();
    await db.delete(userImaConfig).where(eq(userImaConfig.email, email));
  } catch (err) {
    console.error("[ima-config] delete failed:", err);
  }
}
