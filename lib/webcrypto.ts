// M4 私人资料：客户端 WebCrypto 端到端加密（决策20）
// 设计：解锁口令（passphrase）仅存在于用户浏览器内存，永不发送到服务端。
// 服务端只存 PBKDF2 salt + AES-GCM iv + ciphertext（密文）。
// 明文（secret 字段）仅在本地解密后短暂展示/复制，不进入普通检索与 AI 上下文。

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITERATIONS = 120_000;

export interface EncryptedPayload {
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

function toB64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// TS 5.7+ 将 Uint8Array 类型化为 Uint8Array<ArrayBufferLike>，与 WebCrypto 的 BufferSource(ArrayBuffer) 不兼容；
// 运行时 Uint8Array 始终由 ArrayBuffer 支撑，故在此处做受控断言。
function asBuf(v: Uint8Array): BufferSource {
  return v as unknown as BufferSource;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    asBuf(enc.encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuf(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** 用口令加密任意 JSON 可序列化数据，返回密文三件套（base64）。 */
export async function encryptJSON(passphrase: string, data: unknown): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const plaintext = enc.encode(JSON.stringify(data));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuf(iv) }, key, asBuf(plaintext));
  return { salt: toB64(salt.buffer), iv: toB64(iv.buffer), ciphertext: toB64(ct) };
}

/** 用口令解密密文三件套，还原原数据。口令错误会抛异常（调用方据错误提示「口令不正确」）。 */
export async function decryptJSON<T = unknown>(passphrase: string, p: EncryptedPayload): Promise<T> {
  const salt = fromB64(p.salt);
  const iv = fromB64(p.iv);
  const key = await deriveKey(passphrase, salt);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: asBuf(iv) },
    key,
    asBuf(fromB64(p.ciphertext)),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

/** 用一组现有密文验证口令是否正确（取第一条尝试解密；无记录时无法校验，返回 true）。 */
export async function verifyPassphrase(passphrase: string, samples: EncryptedPayload[]): Promise<boolean> {
  if (!samples.length) return true;
  try {
    await decryptJSON(passphrase, samples[0]);
    return true;
  } catch {
    return false;
  }
}
