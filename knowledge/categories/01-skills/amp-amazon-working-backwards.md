---
name: amazon-working-backwards · PR/FAQ 反向验证
summary: 用亚马逊 Working Backwards 法：先写客户视角的新闻稿（Press Release），再倒推要造什么——在投入 spec 前压力测试想法是否值得做。
useCase: 用户只有一个模糊产品想法、要验证「值不值得做」时；或 PRD 前需要先 crystallize 成 compelling 客户叙事时套用。
stack: []
related: ["amp-craft-spec", "amp-jobs-to-be-done", "amp-pre-mortem"]
tags: ["PR-FAQ", "working-backwards", "想法验证", "amplitude"]
status: active
updated: 2026-08-23
userAdded: false
repoUrl: https://github.com/amplitude/builder-skills
source: https://github.com/amplitude/builder-skills/tree/main/product-skills/skills/amazon-working-backwards
---

# amazon-working-backwards · PR/FAQ 反向验证

> 来源：[amplitude/builder-skills](https://github.com/amplitude/builder-skills)（Amplitude 官方 PM 团队）。提炼版，供 xiye「AI 一句话」与人工复用。

## 心法
从客户出发：写代码前先写新闻稿。如果你写不出有说服力的新闻稿，想法就没准备好。PR/FAQ 是思考工具，不是营销稿——目标是暴露模糊思维。

## 方法（PR/FAQ 结构）
**PRESS RELEASE（新闻稿）**
- Heading：清晰的客户向产品名（非内部代号）。
- Subheading：一句话说清客户是谁、得到什么好处。
- Date & City：合理的未来上线日期与地点。
- Opening：3-4 句概述产品与好处，先痛点后方案，像真新闻稿无黑话。
- Problem：生动具体地描述客户当前痛点（具体场景，非抽象陈述）。**最重要的段落。**
- Solution：聚焦客户体验而非技术，现在能做什么以前不能。
- Quote from Leader：VP/CEO 引语，逼出「why now」与战略立场。
- How It Works：3-5 句走通 happy path。
- Quote from Customer：虚构但真实的目标客户引语。
- Call to Action：一句如何上手。

**FAQ**
- External（客户向，4-6）：定价/可得性、与替代对比、适合/不适合谁、数据隐私、"yes but" 异议。
- Internal（团队向，4-6）：市场规模与商业论证、技术可行性与时间线、依赖与风险、why now vs later、不做什么、怎么衡量成功。

**WORKING BACKWARDS ASSESSMENT（5 测）**
1. Clarity——外行读新闻稿能懂吗？
2. Differentiation——竞品能填空吗？（不能则独特价值不锐）
3. Customer——虚构客户会说那句话吗？
4. Internal FAQ——内部答案有说服力吗？手挥处即最大风险。
5. Kill——基于此 PR/FAQ，该推进 / 重做 / 砍掉？给结论。

## 规则
- 新闻稿写六年级阅读水平；需黑话说明想法不清。
- 问题段落最重要，痛点不生动则下游全虚。
- 内部 FAQ 至少含一个你还没好答案的问题（诚实部分）。
- 评估要残酷；暴露弱想法的 PR/FAQ 比粉饰的有价值。

## 对 xiye PRD 的意义
PRD 开头应增「PR/FAQ 反向验证」摘要：用一句话新闻稿式价值主张 + 1 个客户引语 + 内部 kill/rework/go 结论，让「愿景/定位」从空话变成可验证叙事。

## 原框架提示（可复制）
```
Write a PR/FAQ: Press Release (Heading, Subheading, Problem, Solution, Leader quote, How It Works, Customer quote, CTA)
+ FAQs (External 4-6, Internal 4-6) + Working Backwards Assessment (Clarity/Differentiation/Customer/Internal/Kill).
Write the press release at a 6th-grade reading level. The problem paragraph is the most important.
```
