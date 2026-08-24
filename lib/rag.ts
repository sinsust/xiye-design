// 轻量 RAG：从知识库（knowledge/ 技能文档）检索与当前对话相关的条目，
// 把命中条目的摘要与正文片段注入 system prompt，让 AI 对话能真实借鉴知识库。
//
// 匹配策略（中文友好，不依赖用户分词）：
// 从每个条目的 name/summary/tags/useCase 提取「关键词」，检查是否出现在用户原文中
// （用 2 字滑窗判定，规避中文无空格导致的整句单 token 问题）。
// 知识库是「通用技能库」（设计/方法论/技术栈/工具），不是按产品领域分类，
// 所以产品描述类输入通常无命中属正常；命中集中在「设计、方法论、技术」触发词上。

import { loadKnowledgeEntries } from "@/lib/knowledge";
import type { KnowledgeEntry } from "@/lib/knowledge-types";

export interface RagHit {
  slug: string;
  name: string;
  type: string;
  summary: string;
  snippet: string;
}

/** 工具类/操作类 skill：是「让我去执行的技能」，不是「可借鉴的产品洞察」，检索时排除 */
const EXCLUDED_SLUGS = new Set([
  "find-skills",
  "docx",
  "pdf",
  "pptx",
  "xlsx",
  "csv",
  "tsv",
  "web-scraping",
  "cloudstudio-deploy",
  "marketplace-skill-installer",
  "skill-creator",
  "recommend-connectors",
  "recommend-experts",
  "expert-manager",
  "tencent-docs",
  "tencent-saas-docs",
  "tencent-docs-sheetagent",
  "tencent-pptx",
  "tencent-local-office-edit",
]);

/** 弱语义词（中英文助词/动词），不作为关键词参与匹配 */
const WEAK_TOKENS = new Set([
  "帮",
  "帮助",
  "一个",
  "给",
  "他们",
  "需要",
  "可以",
  "能够",
  "希望",
  "用于",
  "以及",
  "还有",
  "要做",
  "产品",
  "the",
  "for",
  "and",
  "with",
  "your",
  "you",
  "that",
  "this",
]);

/** 从条目提取关键词候选（2-8 字连续中英文/数字片段），过滤弱词 */
function entryKeywords(e: KnowledgeEntry): string[] {
  const src = `${e.name} ${e.summary ?? ""} ${(e.tags ?? []).join(" ")} ${e.useCase ?? ""}`;
  const cands = src.match(/[\u4e00-\u9fa5A-Za-z0-9+]+/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cands) {
    const clean = c.trim();
    if (clean.length < 2 || seen.has(clean)) continue;
    seen.add(clean);
    if (WEAK_TOKENS.has(clean.toLowerCase())) continue;
    out.push(clean);
    if (out.length >= 40) break;
  }
  return out;
}

/**
 * 双向匹配打分：条目的每个关键词，用 2 字滑窗判定「是否出现在用户原文」。
 * 每个关键词命中 +2；≥2 个关键词命中（≥4 分）才认为值得注入。
 */
function scoreEntry(e: KnowledgeEntry, lowerText: string): number {
  let s = 0;
  for (const kw of entryKeywords(e)) {
    const k = kw.toLowerCase();
    // 英文/数字关键词直接整词匹配（ASCII 无分词问题）
    if (/^[a-z0-9+.-]+$/.test(k)) {
      if (lowerText.includes(k)) s += 2;
      continue;
    }
    // 中文关键词用 2 字滑窗：用户原文含任一滑窗即视为命中该词
    for (let i = 0; i <= k.length - 2; i++) {
      const bi = k.slice(i, i + 2);
      if (lowerText.includes(bi)) {
        s += 2;
        break;
      }
    }
  }
  return s;
}

/**
 * RAG 检索：知识库条目（内置文件 + 云端共享）× 用户原文双向匹配，返回命中片段。
 * 异步（需读 DB 拉取云端贡献）；扫描条目每次可接受（服务端可缓存）。
 */
export async function ragRetrieve(text: string, limit = 3): Promise<RagHit[]> {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return [];
  const lowerText = trimmed.toLowerCase();

  const entries = await loadKnowledgeEntries();
  const hits = entries
    .filter((e) => !EXCLUDED_SLUGS.has(e.slug))
    .map((e) => ({ e, s: scoreEntry(e, lowerText) }))
    .filter((x) => x.s >= 4)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit);

  return hits.map(({ e }) => ({
    slug: e.slug,
    name: e.name,
    type: e.type,
    summary: e.summary ?? "",
    snippet: (e.body ?? "").replace(/\n{3,}/g, "\n\n").slice(0, 600),
  }));
}

/** 拼成 system 可注入的「知识库参考」段（无命中返回空串） */
export async function buildRagContext(text: string, limit = 3): Promise<string> {
  let hits: RagHit[] = [];
  try {
    hits = await ragRetrieve(text, limit);
  } catch {
    return "";
  }
  if (!hits.length) return "";
  return `\n\n【知识库参考（RAG 命中，供你借鉴、勿照抄；完整条目可在 /library 浏览深做）】
${hits.map((h) => `### ${h.name}\n> ${h.summary}\n${h.snippet}`).join("\n\n")}`;
}
