---
type: skill
name: Humanizer 去除 AI 写作痕迹
summary: 识别并修正 35 种 AI 写作模式（夸大/销售语/三段式/破折号滥用/机器人腔等），两轮改写保留事实、去除套路、回归自然，使文本像真人写的。
useCase: 当需要把 AI 生成/编辑的散文改得像真人书写、去除 AI 味时
stack: []
tags: [写作, 反ai味, humanize, 编辑, 文案]
status: active
updated: 2026-08-24
repoUrl: https://github.com/blader/humanizer
---

# Humanizer 去除 AI 写作痕迹（skill）

## 作用
通过识别和修正 **35 种 AI 写作模式**去除 AI 痕迹，保持原意不变。来源：维基百科 "Signs of AI writing" 页面（WikiProject AI Cleanup 维护）。

## 两轮改写策略
1. **第一轮（结构自由）**：不把原文结构当固定，先整体重写一遍
2. **第二轮（检查修正）**：对照 35 种模式逐项检查 → 对照原文事实核对 → 对仍显 AI 味的部分精准重写

## 硬约束
- **不虚构事实**：名称/数字/日期/引用必须来自原文；缺失则询问而非编造
- **保留风格**：个人写作保留作者风格；技术/参考文本保持中立平实
- **样本匹配**：用户给写作样本则模仿其节奏/用词/标点
- **边界**：只改散文，不碰代码、数据、frontmatter、链接目标

## 35 种模式速查（高频）
**内容**：夸大重要性（"marking a pivotal moment"）、堆名字证明（"cited in NYT, BBC"）、肤浅 -ing 分析（symbolizing/reflecting）、销售语（"nestled within"）、模糊来源（"Experts believe"）、公式化挑战展望（"Despite challenges... continues to thrive"）
**语法**：AI 词汇（actually/additionally/testament/landscape/showcasing）、回避 is/are（"serves as"→"is"）、"不是 X 而是 Y"、强行三段式排比、称呼变换、虚假 from-X-to-Y、被动语态缺主语
**风格**：em/en 破折号滥用、过多加粗、列表加粗小标题、Title Case、emoji、弯引号、过多连字符复合词、虚假深层真理（"At its core"）、预告下一点（"Let's dive in"）、标题下重复标题内容
**机器人腔**："I hope this helps"、"While details are limited"、"Great question! You're absolutely right!"
**填充**："In order to"→"To"、"could potentially possibly"→"may"、泛泛正面结尾（"The future looks bright"）

## 执行准则
- 改写优先于修复；事实优先于形式；样本覆盖默认风格
- 破折号规则可被样本覆盖；引文受保护；真实技术术语（feature gating）不受词汇规则影响
- 输出前展示过程：先给第一轮改写 + 简短批评，再给最终版

## 与本项目关系
对应规范守门员的"反 AI 味"边界；PRD/文案产出前可用这套清单自查。
