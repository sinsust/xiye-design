---
name: craft-spec · 结构化 PRD 写作
summary: 把混乱想法（随手笔记 / Slack 片段 / 半成品思路）转成工程师、设计师、利益相关方都能直接用的结构化产品需求文档（PRD）。
useCase: 用户只有零散想法、一句话或一段需求，需要产出规范、可交付的 PRD 时套用。
stack: []
related: ["amp-jobs-to-be-done", "amp-amazon-working-backwards", "amp-pre-mortem"]
tags: ["PRD", "产品需求", "spec", "amplitude"]
status: active
updated: 2026-08-23
userAdded: false
repoUrl: https://github.com/amplitude/builder-skills
source: https://github.com/amplitude/builder-skills/tree/main/product-skills/skills/craft-spec
---

# craft-spec · 结构化 PRD 写作

> 来源：[amplitude/builder-skills](https://github.com/amplitude/builder-skills)（Amplitude 官方 PM 团队 `product-skills`）。本条目为引入 xiye 知识库的提炼版，供「AI 一句话」与人工复制甩给 AI 复用。

## 什么时候用
- 用户丢来一堆 bullet points、Slack 记录或半成型想法，需要变成 PRD。
- 说「写个 PRD」「把这个 spec 一下」「变成文档」时。
- 不要先替用户美化笔记——原样喂进去才是重点。

## 方法（提炼自原 skill 的 Prompt Template）
写 PRD 时强制覆盖以下 6 节，语气清晰直接、短句优先、主动标注假设：

1. **Problem Statement（问题陈述）** —— 为谁解决什么问题？
2. **Goals & Success Metrics（目标与成功指标）** —— 成功长什么样？怎么量化？
3. **Scope（范围）** —— v1 做什么？明确不做什么（out of scope）？
4. **Proposed Solution（方案概述）** —— 高层思路，不陷实现细节。
5. **Key User Stories（关键用户故事）** —— 从用户视角描述核心工作流。
6. **Open Questions（开放问题）** —— 动手前还需敲定的事。

## 对 xiye PRD 生成的意义
xiye 的 `buildPrdMd` 现已聚焦正向产品定义，章节为：产品概述 / 目标用户 / 核心功能 / 页面架构 / 市场契合 / 价值主张 / 方法论溯源。套用本框架后，多轮访谈产出的 PRD 应突出「问题陈述 + 关键用户故事」，并让核心功能模块带 JTBD 动机与验收标准（见 `lib/ai-methodology.ts` 注入串）。

## 原框架提示（可整段复制给 AI）
```
You are an experienced product manager helping me write a PRD.
Based on this context, write a structured PRD that includes:
1. Problem Statement — What problem are we solving and for whom?
2. Goals & Success Metrics — What does success look like? How will we measure it?
3. Scope — What's in scope for v1? What's explicitly out of scope?
4. Proposed Solution — High-level description of the approach.
5. Key User Stories — The core workflows from the user's perspective.
6. Open Questions — Things that still need to be resolved before building.
Keep the tone clear and direct. Prefer short sentences. Flag assumptions you're making.
```
