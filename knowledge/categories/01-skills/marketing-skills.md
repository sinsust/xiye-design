---
type: skill
name: Marketing Skills 营销技能包
summary: 50 个营销子技能（CRO/文案/SEO/投放/留存/定价/发布），以 product-marketing 上下文为地基，技能间互相引用；覆盖从策略、获客、转化到留存的完整营销链路。
useCase: 当需要营销侧洞察——转化优化、文案、SEO、定价、发布、冷启动策略时
stack: []
tags: [营销, cro, seo, 文案, 定价, 发布, 留存, 冷启动]
status: active
updated: 2026-08-24
repoUrl: https://github.com/coreyhaines31/marketingskills
---

# Marketing Skills 营销技能包（skill）

## 作用
把营销方法论编码为可被 AI 直接调用的结构化工作流。核心地基是 `product-marketing`（产品营销上下文）——其他技能执行前先读它了解产品/受众/定位，技能间互相引用形成依赖图谱。

## 八大类（50 个子技能）

**转化优化（CRO）**：cro（页面/表单转化）、signup（注册/激活）、onboarding（引导/TTV）、popups（弹窗）、paywalls（付费墙）
**内容文案**：copywriting（营销文案）、copy-editing（审校）、cold-email（B2B 冷邮件）、emails（邮件序列）、social（社媒）、video（视频）、image（图片）、sms（短信）
**SEO 与发现**：seo-audit、ai-seo（让内容被 LLM 引用）、programmatic-seo（规模化 SEO 页）、site-architecture、competitors（竞品对比）、schema、aso（应用商店）
**付费投放**：ads、ad-creative（广告创意批量）、events（活动）、public-relations（公关）、influencer-marketing（网红）、co-marketing（联合营销）
**衡量测试**：analytics、ab-testing（A/B 实验）、attribution（归因）
**留存增长**：churn-prevention（流失预防）、referrals（推荐裂变）、free-tools（免费工具获客）、community-marketing（社区）、marketing-loops（自动化营销循环）
**战略变现**：marketing-ideas（140 个 SaaS 营销点子）、marketing-psychology（心理原则）、marketing-plan、marketing-council（模拟专家顾问）、launch（发布）、pricing（定价）、offers（报价设计）、customer-research（客户调研）、prospecting（B2B 名单）、product-marketing（基础上下文）
**销售 RevOps**：revops（收入运营）、sales-enablement（销售物料）、competitor-profiling（竞品档案）

## 关键方法论
- **技能协作**：copywriting ↔ cro ↔ ab-testing；revops ↔ sales-enablement ↔ cold-email；seo-audit ↔ schema ↔ ai-seo；customer-research → copywriting/cro/competitors
- **事件弧线**："20% 活动当天 / 80% 前后"，网络研讨会漏斗、赞助 ROI、演讲（录制才是真正受众）
- **A/B 测试设计**：明确假设、样本量、实验周期，避免过早结论

## 用法示例
- "优化这个落地页转化" → cro
- "给我的 SaaS 写首页文案" → copywriting
- "搭建 GA4 注册追踪" → analytics
- "写 5 封欢迎邮件序列" → emails
