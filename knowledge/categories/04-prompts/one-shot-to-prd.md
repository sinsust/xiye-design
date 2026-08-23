---
type: prompt
name: 一句话扩写成完整产品构想 + PRD 依据
summary: 把一句/几个词的产品想法，扩写成愿景/定位/目标用户/核心功能/非目标/成功指标/市场契合 的完整产品叙事
useCase: 用户输入极简短时让 AI 依据当前市场主流补全；若要输出严格 JSON 给机器则必须限定格式
variables: [userIdea, styleContext, year]
exampleInput: "想做一个 AI 简历工具"
exampleOutput: "产品愿景+定位+目标用户数组+核心功能(含why)+非目标+成功指标+市场契合(为何套该视觉/页面结构)"
tags: [生成, 产品, PRD, 扩写, 市场]
related: [brandkit]
status: active
updated: 2026-08-22
---
# 一句话扩写成完整产品构想 + PRD 依据（prompt）

## 目标
把简短的产品想法补全成**可落地、结构完整**的产品叙事，直接可作为 `docs/PRD.md` 的素材。核心要求：AI 要结合**当前行业与主流视觉趋势**扩写，而不是只按字面。

## 适用场景
- **该用**：用户只给了"一句话/几个词"，需要 AI 主动补全产品定位、目标用户、核心功能与选择某视觉风格的理由。
- **不要用**：用户已给了结构化需求、或场景极度专业把 AI 硬扩写反而失真时；此时应由你给定信息优先。
- **输入要求**：至少要有一句想法；缺省的风格/栈由 AI 定合理默认，避免空白即可用。

## 提示词正文
```text
用户的想法可能只有一句话甚至几个词。请结合你对当前行业与市场主流产品形态、主流视觉趋势的了解，把它合理扩展为一个可落地、完整、具体的产品构想。
输出 JSON：
{ "vision": 产品愿景一句话, "positioning": 定位与差异, "targetAudience": ["目标用户"],
  "coreFeatures": [{"name": 核心功能, "why": 解决什么问题}],
  "nonGoals": ["本期非目标"], "successMetrics": ["成功指标"],
  "marketFit": "所选视觉风格/页面结构为何符合当下市场主流审美与产品形态" }
硬性约束：narrative 必填完整；不要因为输入简短就产出单薄结果；只输出 JSON。
```

## 输入变量
| 变量 | 说明 | 示例 |
| --- | --- | --- |
| userIdea | 用户的一句话产品想法 | AI 简历工具 |
| styleContext | 当前可选视觉风格候选（供 marketFit 引用） | Tangerine 柑橘 等 |
| year | 作为"当前市场"基准年 | 2026 |

## 最佳实践
- 与 `<code>data/DESIGN_SPEC` 的加载/反馈等视觉契约联动，`marketFit` 才不空泛。
- 落在 `lib/ai-intent*` 管线里，扩写结果喂给 `applyIntentRecommendation → flow-store → buildPrdMd`。