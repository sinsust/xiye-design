// 档案 cookie 的 HMAC-SHA256 签名（public 部署模式专用）。
//
// local 模式：cookie 值是裸档案 id（前端可直接切换，桌面单机信任模型）。
// public 模式：cookie 值改为 `${id}.${sig}`，其中
//   sig = base64url(HMAC_SHA256(id, PROFILE_HMAC_KEY)) 截断为 16 字节
// 服务端验签通过才承认该档案身份 —— 没有密钥的人无法伪造档案 id，
// 从根上堵住「改 cookie 冒充他人 / 无 cookie 共享默认档案」两类越权。
//
// 兼容性：只用 Web Crypto（crypto.subtle）+ TextEncoder，
// edge middleware 与 node runtime 均可运行；不 import node:*，middleware 打包干净。

const KEY_ENV = "PROFILE_HMAC_KEY";
/** 签名截断长度（字节）。16 字节 = 128 bit，对防伪造绰绰有余，cookie 也更短 */
const SIG_BYTES = 16;

function getKey(): string {
  const raw = process.env.PROFILE_HMAC_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      `[profile-signature] public 部署模式必须配置 ${KEY_ENV}（≥32 字符随机串）`,
    );
  }
  return raw;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function hmac(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(id),
  );
  return bytesToB64url(new Uint8Array(sig)).slice(0, 22); // 16 字节 → 22 个 base64url 字符
}

/** 生成签名 cookie 值：`${id}.${sig}` */
export async function signProfileCookie(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

/** 仅取签名部分（供门户页种 cookie 时复用） */
export async function signProfileId(id: string): Promise<string> {
  return hmac(id);
}

/**
 * 验签档案 cookie 值。合法返回档案 id；任何异常（无值/格式错/签名不符）返回 null。
 * 注意：调用方负责把 null 当作「未认证」处理，绝不应回退到默认档案。
 */
export async function verifyProfileCookie(
  value: string | undefined | null,
): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const expect = await hmac(id);
  return sig === expect ? id : null;
}
