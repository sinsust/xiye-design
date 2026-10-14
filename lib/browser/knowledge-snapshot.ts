// 浏览器轨道的内置知识条目来源：构建期导出的静态快照 public/knowledge.json。
//
// 内置条目本来就在仓库的 knowledge/categories 下（只读内容，不是用户数据）。
// 浏览器里没有文件系统，所以打包 sw 之前先扫一次并落成 JSON —— 内容随包走，
// 线上不需要任何服务端存储；用户自己新增/编辑的条目仍然进浏览器本地库（DB）。
import type { KnowledgeEntry } from "@/lib/knowledge-types";

export async function fetchBuiltinKnowledgeSnapshot(): Promise<KnowledgeEntry[]> {
  const res = await fetch("/knowledge.json", { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`内置知识库快照读取失败（knowledge.json ${res.status}）`);
  }
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as KnowledgeEntry[]) : [];
}
