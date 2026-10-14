// 知识库读取入口（服务端）：内置条目来自仓库里的 knowledge/categories，
// 用户贡献条目来自 DB（sqlite / Postgres 两条轨道通用）。
//
// 文件扫描本身拆到 lib/knowledge-scan.ts —— 浏览器数据层没有文件系统，
// 那边改读构建期导出的 public/knowledge.json（见 scripts/build-sw.mjs）。
import type { KnowledgeEntry } from "./knowledge-types";
import { getKnowledgeEntries } from "./knowledge-scan";
import { listCloudKnowledge } from "./knowledge-db";

export {
  parseFrontmatter,
  getKnowledgeEntries,
  scanKnowledgeRoot,
  VAULT_ROOT,
} from "./knowledge-scan";

/**
 * 完整加载知识库 = 内置文件条目 + 云端共享条目（含贡献人邮箱）。
 * 异步：云端条目来自 DB（sqlite 本地 / Postgres 线上）。仅服务端调用。
 */
export async function loadKnowledgeEntries(): Promise<KnowledgeEntry[]> {
  return [...getKnowledgeEntries(), ...(await listCloudKnowledge())];
}
