# 知识库 × 流程 · 桥接协议（BRIDGE）

> 说明 `knowledge/` 如何被「一句话生成底座」整体流程引用，作为私有资产候选源。

## 目标

底座的 `data/*.ts` 是**人选的固定配置**；知识库是**你持续增补的素材库**。桥接要做的是：让知识库里 `type ∈ {skill, service, repository, prompt}` 的条目，**能作为流程选型 / AI 一句话的候选注入**，而不用改源码。

## 契约（机器可读）

每条目 frontmatter 即契约，indexer 直接读取：

```yaml
---
type: skill | service | repository | prompt | pattern | design | reference
name: 显示名
summary: 一句话作用          # 给 AI/人读的摘要
useCase: 何时用/何时不用/替代   # 适用场景
stack: [nextjs_supabase, ...] # 兼容技术栈 id；空=通用
related: [slug1, slug2]       # 双链条目标识
tags: [tag1, tag2]
status: active | trial | frozen
updated: YYYY-MM-DD
---
```

## 消费方做法（约定，按需实现）

1. 扫描 `categories/**/*.md`，解析 frontmatter。
2. `status: active` 才纳入候选；`frozen` 仅存档不进选型。
3. 按 `type` 归位：skill → 能力候选、service → 服务接入候选、repository → 参考实现候选、prompt → 提示词配方候选。
4. `useCase` / `summary` 作为注入 AI 一句话的上下文（让它知道你有哪些私有资产可用）。
5. 与现有 `data/skill-catalog`、`data/service-providers` 合并时，**优先级：knowledge 私有条目 > 内置目录**，命中即可推荐。

## 沉淀路径

你看了知识库觉得某条值得作为默认 → 手动沉淀进对应 `data/*.ts`（skill-catalog / service-providers / tech-stacks），知识库条目保留作为"来源说明 / 备选对比"。

## 维护

- 新增条目务必同步回填 `INDEX.md`（见 ORGANIZATION 规则），否则流程扫不到最新。
- 定期核对 `INDEX.md` 统计数与 `categories` 实际条目一致。