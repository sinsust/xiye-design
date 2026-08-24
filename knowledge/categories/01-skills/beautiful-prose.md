---
type: skill
name: Beautiful Prose 硬边写作风格
summary: 硬边写作风格契约：干净、精确、动词驱动、无 AI 节奏与填充词；明令禁止 em 破折号、"不是 X 而是 Y"、治疗性语气、元评论；附质量自检 lint。
useCase: 当需要有力、精确、无 AI 味的高质量散文/文案/改写时
stack: []
tags: [写作, 反ai味, 风格契约, 文案, prose]
status: active
updated: 2026-08-24
repoUrl: https://github.com/SHADOWPR0/beautiful_prose
---

# Beautiful Prose 硬边写作风格（skill）

## 作用
产出 timeless、forceful 的英文/中文散文，无 AI 节奏（cadence）、填充词、治疗性语气。**这是风格契约而非氛围**——违反即视为失败。

## 绝对禁止
1. **Em 破折号**——用句号/逗号/冒号/分号/换行替代
2. **"不是 X 而是 Y"** 及变体（"This isn't about X. It's about Y"、"Not X but Y"、"X is a symptom. Y is the cause"）
3. **填充过渡与场景铺垫**——"At its core"、"In today's world"、"That said"、"Let's explore"、"Ultimately"、"It's important to note"
4. **治疗性/认可语言**——"I hear you"、"That sounds hard"、"You're valid"、"Give yourself grace"
5. **AI 元评论**——"In this essay"、"This piece explores"、"Here are the key takeaways"、为风格道歉
6. **对称填充**——为平衡而平衡的句子、未挣得的三段式排比

## 积极约束
- **句子**：优先陈述句；长度激进变化；短句做冲击；提问只在切中时用
- **用词**：具体名词优先于抽象、强动词优先于副词、盎格鲁-撒克逊词优先（需要精确时用拉丁词）
- **节奏**：段落呼吸、留白有意、以实质开头而非钩子、干净收尾不复述论点
- **权威**：写得像事实不需要许可；除非不确定性必要且显式，否则不 hedge

## 语域（可选）
- founding_fathers：正式、克制、公民重量
- literary_modern：鲜明意象、受控热度（默认）
- cold_steel：严重压缩、高信号低温度
- journalistic： crisp 事实、叙事清晰

## 质量自检（lint）
输出若命中任一则失败：
- 含 "--" 当 em 破折号
- 反转 pivot 模式（"not X, Y"）
- 禁止清单里的填充过渡
- 治疗性语言/认可
- 元写作谈（"this essay"/"we will"）
- 五连句长度相似

## 金句示范
- Bad: "This isn't about money. It's about power." → Good: "Money is the instrument. Power is the habit."
- Bad: "At its core, this is a complex issue. That said, in today's world..." → Good: "It is complex. Complexity is not an excuse for fog."

## 与本项目关系
与规范守门员"反 AI 味"边界同源；PRD 的愿景/定位/价值主张文案可用此风格校准。
