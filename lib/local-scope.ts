// 服务端档案解析：把「当前档案」翻译成业务主键 users.id。
//
// 背景（形态 C · 桌面应用）：
//   不再有登录体系，但业务代码仍需要一个用户主键来做数据分区。
//   这里用请求 cookie 里的档案 id 充当该主键，于是所有依赖
//   getSessionUser / requireUser 的既有逻辑零改动即可继续工作。
//
// ⚠️ 外键约束：所有业务表的 user_id 都带 `references users(id)`，
//   所以写数据前必须保证 users 表里存在对应行（见 ensureLocalUser）。

import { cookies } from "next/headers";
import { asc } from "drizzle-orm";
import { db, isBrowserData, users } from "@/lib/db";
import { readRequestCookie } from "@/lib/browser/current-request";
import { DEFAULT_PROFILE_ID, PROFILE_COOKIE } from "@/lib/local-profile";
import { isPublicDeploy } from "@/lib/deploy-mode";
import { verifyProfileCookie } from "@/lib/profile-signature";

/**
 * 归一化档案 id：只放行安全字符，非法值一律回退默认档案。
 * 避免异常 cookie 值进入 SQL / 外键，也避免与既有数据意外串号。
 */
export function normalizeProfileId(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return DEFAULT_PROFILE_ID;
  return /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : DEFAULT_PROFILE_ID;
}

/** 档案在 users 表里的邮箱占位（email 列唯一，用 id 派生保证不冲突） */
export function profileEmail(id: string): string {
  return `${id}@local.xiye`;
}

// 无 cookie 时的回退档案 id（进程内缓存，避免每次请求都查库）
let fallbackIdCache: string | null = null;

/**
 * 无 cookie 时用哪个档案。
 *
 * 优先沿用「库里最早的那个用户」——升级到本地档案模式前，既有数据都挂在原用户 id 下，
 * 沿用它可以保证老数据打开就在，不会像被清空；全新建库则回退默认档案。
 */
async function fallbackProfileId(): Promise<string> {
  if (fallbackIdCache) return fallbackIdCache;
  try {
    const rows = await db
      .select()
      .from(users)
      .orderBy(asc(users.createdAt))
      .limit(1);
    fallbackIdCache = rows[0]?.id ?? DEFAULT_PROFILE_ID;
  } catch {
    fallbackIdCache = DEFAULT_PROFILE_ID;
  }
  return fallbackIdCache;
}

/**
 * 读取当前请求所属的档案 id。
 *
 * local 模式（桌面单机）：cookie 由前端切换档案时写入，值即裸档案 id；
 *   无 cookie 时回退「库里最早的档案」（保证升级前老数据打开就在）。
 *
 * public 模式（Vercel 公开多用户）：cookie 值必须是服务端 HMAC 签名的
 *   `${id}.${sig}`（见 lib/profile-signature.ts）。验签失败一律返回 null，
 *   **绝不回退默认档案** —— 否则所有未认证访客会共享同一套数据。
 *   页面/API 请求已被 middleware 先行拦截，这里是二道闸；
 *   getSessionUser 收到 null → requireUser 走 401 分支（调用方零改动）。
 */
export async function resolveProfileId(): Promise<string | null> {
  // 浏览器轨道（sw 内跑 handler）：没有 next/headers，也没有 document —— 身份取自
  // 被拦截请求自带的 Cookie 头，语义与下面 cookies() 一致。
  if (isBrowserData) return normalizeProfileId(readRequestCookie(PROFILE_COOKIE));
  const store = await cookies();
  const raw = store.get(PROFILE_COOKIE)?.value;
  if (isPublicDeploy()) {
    return await verifyProfileCookie(raw);
  }
  if (raw && raw.trim()) return normalizeProfileId(raw);
  return await fallbackProfileId();
}

// 进程内已建档的档案 id，避免每个请求都打一次 INSERT
const ensured = new Set<string>();

/**
 * 幂等建档：保证 users 表里存在该档案对应的行，满足外键约束。
 * onConflictDoNothing 保证重复调用安全；失败不抛错，交由后续写操作暴露真实问题。
 */
export async function ensureLocalUser(id: string): Promise<void> {
  if (ensured.has(id)) return;
  try {
    await db
      .insert(users)
      .values({
        id,
        email: profileEmail(id),
        passwordHash: null,
        createdAt: Date.now(),
      })
      .onConflictDoNothing();
    ensured.add(id);
  } catch {
    /* 建档失败不阻塞读取路径 */
  }
}