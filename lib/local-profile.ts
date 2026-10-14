// 本地档案（profile）：形态 C（桌面应用）下替代登录账号，用于隔离与划分存储内容。
//
// 一个「档案」= 一整套独立的业务数据：所有业务表都按 user_id 分区，
// 因此切换档案就等于切换一整套数据（项目、随手记、偏好、知识库……）。
//
// ⚠️ 本文件会被客户端与服务端同时 import，不要引入 server-only 依赖。

import { isPublicDeploy } from "./deploy-mode";

/** 当前档案 id 的 cookie 名（服务端据此判断请求属于哪个档案） */
export const PROFILE_COOKIE = "xiye_profile";

/** 档案列表在前端的缓存 key（列表本身属于 UI 状态，存本地即可） */
export const PROFILE_LIST_KEY = "xiye-profiles";

/** 首次使用时的默认档案 */
export const DEFAULT_PROFILE_ID = "local";
export const DEFAULT_PROFILE_NAME = "默认档案";

export interface LocalProfile {
  id: string;
  name: string;
  createdAt: number;
}

/** 生成一个新的档案 id（仅含 cookie/URL 安全字符） */
export function newProfileId(): string {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 写入「当前档案」cookie（一年有效，全站路径可见）。
 *
 * ⚠️ public 部署模式（Vercel 公开多用户）下【禁止调用】：
 *   服务端的身份 cookie 是 HttpOnly + HMAC 签名的 `id.sig`，而 document.cookie
 *   写入会按 (name, domain, path) 覆盖同名 cookie（HttpOnly 只挡读取、不挡覆写），
 *   结果是签名被抹掉 → 验签失败 → 用户被踢回门户，形成 401 死循环。
 *   public 模式下身份只能由服务端 /api/enter 发放，前端无权改写。
 */
export function writeProfileCookie(id: string): void {
  if (isPublicDeploy()) return;
  document.cookie = `${PROFILE_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

/** 读取前端保存的档案列表；为空时回退到默认档案 */
export function readProfileList(): LocalProfile[] {
  try {
    const raw = localStorage.getItem(PROFILE_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(
          (p): p is LocalProfile =>
            Boolean(p) && typeof p.id === "string" && typeof p.name === "string",
        );
      }
    }
  } catch {
    /* 解析失败按空处理 */
  }
  return [{ id: DEFAULT_PROFILE_ID, name: DEFAULT_PROFILE_NAME, createdAt: 0 }];
}

/** 保存档案列表 */
export function writeProfileList(list: LocalProfile[]): void {
  try {
    localStorage.setItem(PROFILE_LIST_KEY, JSON.stringify(list));
  } catch {
    /* 忽略配额/隐私模式错误 */
  }
}

/** 读取 cookie 中的当前档案 id；缺省为默认档案 */
export function readCurrentProfileId(): string {
  try {
    const m = document.cookie.match(
      new RegExp(`(?:^|; )${PROFILE_COOKIE}=([^;]*)`),
    );
    const id = m ? decodeURIComponent(m[1]) : "";
    return id || DEFAULT_PROFILE_ID;
  } catch {
    return DEFAULT_PROFILE_ID;
  }
}

/**
 * 与服务端对齐当前档案。
 *
 * 服务端在没有 cookie 时会回退到「库里最早的档案」（升级前的老数据就挂在那个 id 下），
 * 客户端这里把服务端的判断拉回来、补进列表并固化成显式 cookie，
 * 避免首次打开时界面显示的档案名与实际读取的数据对不上。
 */
export async function syncCurrentProfile(): Promise<{
  list: LocalProfile[];
  currentId: string;
}> {
  const list = readProfileList();
  let id = readCurrentProfileId();
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    const d = await r.json();
    if (d?.user?.id) id = d.user.id as string;
  } catch {
    /* 网络失败保留本地判断 */
  }
  const next = list.some((p) => p.id === id)
    ? list
    : [
        ...list,
        {
          id,
          name: id === DEFAULT_PROFILE_ID ? DEFAULT_PROFILE_NAME : "原有数据",
          createdAt: 0,
        },
      ];
  writeProfileList(next);
  writeProfileCookie(id);
  return { list: next, currentId: id };
}