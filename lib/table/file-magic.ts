/**
 * 表格处理 —— 文件魔数检测
 *
 * 替代 file-type 库（依赖链庞大、Windows 沙箱下 npm 装不上）。
 * 30 行实现覆盖表格场景的 6 种真实类型。
 */

/** 简化类型：仅输出表格处理需要的真实文件类型 */
export type TableFileKind =
  | "xlsx" // ZIP magic → xlsx (或 docx/pptx，统一按 xlsx 试)
  | "xls" // OLE Compound File → xls
  | "html" // 可能是 .xls 伪装的 HTML 表格
  | "json" // 行式 JSON
  | "csv-text" // 纯文本（CSV/TSV 等，按分隔符区分在 parser 层做）
  | "unknown";

/**
 * 通过文件前若干字节判断真实类型
 * @param buffer 原始字节
 * @returns TableFileKind
 */
export function detectFileMagic(buffer: Buffer): TableFileKind {
  if (!buffer || buffer.length < 4) return "unknown";

  // ZIP（xlsx / docx / pptx） — PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "xlsx";
  }
  // OLE2 — D0 CF 11 E0
  if (
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return "xls";
  }
  // JSON — { 或 [ 开头
  if (buffer[0] === 0x7b /* { */ || buffer[0] === 0x5b /* [ */) return "json";
  // HTML（包含 <!DOCTYPE html、<html、<table）
  const head = buffer.slice(0, 64).toString("ascii", 0, 64).toLowerCase();
  if (
    head.includes("<!doctype html") ||
    head.includes("<html") ||
    head.includes("<table")
  ) {
    return "html";
  }
  // 纯文本：以"控制字符比例"判断（避免 UTF-8 多字节序列被误判为不可打印）
  const sample = buffer.slice(0, Math.min(buffer.length, 256));
  let control = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    // 不可接受的"二进制控制字符"（排除 \t \n \r）
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) control++;
  }
  if (control / sample.length < 0.1) return "csv-text";

  return "unknown";
}
