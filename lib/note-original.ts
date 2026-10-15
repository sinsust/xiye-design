// 原文保留契约（PRD §7.2 / 决策 16）：原文永久保留，AI 改写只是辅助视图。
//
// 背景：仓库内曾出现四处 `organized.rewritten || content` 的写法，一旦 AI 产出改写版，
// 用户原始正文就被静默丢弃 —— 这正是「随手记丢原文」的根因。正确语义应当是：
//   · 有改写 → 正文 = 改写 + 原文附录（可回溯）
//   · 无改写 → 正文 = 原文（不拼无意义的分隔符）
//
// 本模块零依赖（不 import 任何 node / db / server 代码），因此 client component 与
// server handler 均可安全引入。

/** 改写正文时的分隔/保留原文标记：保证 AI 精简改写不丢原文，可在笔记内回溯 */
export const ORIGIN_DIVIDER = "--- 原始记录（改写保留，防信息丢失）---";

/**
 * 把「主文」与「原始记录」合成为入库正文。
 *
 * @param primary  要作为正文主体的内容（通常是 AI 改写结果，无改时回落原文）
 * @param original 用户的原始正文；只有真正使用了改写版时才需要传入，否则传 null
 */
export function withOriginal(primary: string, original: string | null | undefined): string {
  if (!original || original === primary) return primary;
  return `${primary}\n\n${ORIGIN_DIVIDER}\n${original}`;
}

/**
 * 便捷封装：直接根据「改写结果 + 原文」算出入库正文。
 * 无改写时返回原文本身，不产生多余分隔符。
 */
export function contentWithOriginal(
  rewritten: string | null | undefined,
  original: string | null | undefined,
): string {
  const rw = rewritten?.trim() ?? "";
  return rw
    ? withOriginal(rw, rw === (original ?? "").trim() ? null : (original ?? null))
    : (original ?? "");
}

/**
 * 剥离「原文附录」段，取回正文主体。
 *
 * 用途：增量同步/去重的幂等比对。入库正文可能是「改写 + 原文附录」，
 * 若直接拿它与用户原始输入比对，永远不相等，会导致每次同步都误判 changed=true。
 * 因此比对前必须先剥离附录。
 */
export function stripOriginalAppendix(body: string | null | undefined): string {
  if (!body) return "";
  const idx = body.indexOf(ORIGIN_DIVIDER);
  return (idx === -1 ? body : body.slice(0, idx)).trim();
}
