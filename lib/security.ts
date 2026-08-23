// 密钥/凭据检测的唯一来源。
// 同一套规则被两处复用，避免各自维护导致漂移：
//   - seed-verify.ts（运行时自检）用编译好的 SECRET_RE；
//   - seed-project.ts 生成的 seed/scripts/verify.mjs 用 SECRET_PATTERN 内嵌同一 pattern。

/** 原始正则源（等价的 JS 正则字面量正文，不含定界符与旗标） */
export const SECRET_PATTERN =
  '(sk-[A-Za-z0-9]{20,}|api[_-]?key\\s*[:=]\\s*["\'][^\'"]{16,}|password\\s*[:=]\\s*["\'][^\'"]{8,})';

/** 编译后的正则，用于客户端运行时自检 */
export const SECRET_RE = new RegExp(SECRET_PATTERN, "i");