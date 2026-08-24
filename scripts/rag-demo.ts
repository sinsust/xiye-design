import { ragRetrieve } from "../lib/rag";

const inputs = [
  "帮我优化这个落地页的转化率",
  "写一个有力的产品介绍文案，不要有 AI 味",
  "怎么管理 API 密钥，防止泄露到对话和代码库",
  "长对话聊多了上下文越来越乱，怎么压缩",
  "做一个有设计感的 SaaS 落地页",
  "想做一份结构化的 PRD，按标准方法论来",
];
for (const text of inputs) {
  const hits = await ragRetrieve(text, 3);
  console.log("=== 输入：", text);
  if (!hits.length) { console.log("  （无命中）"); continue; }
  for (const h of hits) console.log(`  >> ${h.name}`);
}
