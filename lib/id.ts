/**
 * 不可预测 ID 生成工具（审计 Medium：弱随机 ID）。
 *
 * 替代各处的 Math.random().toString(36) 后缀，统一收敛到密码学安全随机源，
 * 杜绝内部主键 / 令牌被预测。仅用于内部主键等场景（非安全令牌，但统一收口）。
 */
import { randomBytes } from "node:crypto";

/** 密码学安全的随机后缀（8 位十六进制，不可预测）。 */
export function randomSuffix(): string {
  return randomBytes(4).toString("hex");
}

/** 生成带前缀的不可预测 ID：`<prefix>-<时间36>-<随机hex>`。 */
export function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomSuffix()}`;
}
