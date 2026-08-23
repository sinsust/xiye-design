---
name: prioritize · RICE 优先级排序
summary: 用 RICE 框架把一堆想法 / 功能 / 需求快速排优先级，输出带理由的清晰排名，让决策可解释。
useCase: PRD 的「成功指标 / 范围 / 路线图」需要量化优先级，或用户给出多个功能要排先后顺序时套用。
stack: []
related: ["amp-craft-spec", "amp-pre-mortem"]
tags: ["RICE", "优先级", "路线图", "amplitude"]
status: active
updated: 2026-08-23
userAdded: false
repoUrl: https://github.com/amplitude/builder-skills
source: https://github.com/amplitude/builder-skills/tree/main/product-skills/skills/prioritize
---

# prioritize · RICE 优先级排序

> 来源：[amplitude/builder-skills](https://github.com/amplitude/builder-skills)（Amplitude 官方 PM 团队）。提炼版，供 xiye「AI 一句话」与人工复用。

## 方法（RICE 四步）
1. **Clarify Items（澄清条目）** —— 每条用一句话重述，模糊的标假设或要求澄清。
2. **Score with RICE** —— 对每条估算：
   - **Reach（触达）**：每季度影响多少用户/账户（用数量级：百 / 千 / 万）。
   - **Impact（影响）**：对目标拉动多大（3=巨大 / 2=高 / 1=中 / 0.5=低 / 0.25=极小）。
   - **Confidence（信心）**：100%=有数据 / 80%=强信号 / 50%=有根据猜测 / 20%=推测。
   - **Effort（投入）**：人周（0.5 / 1 / 2 / 4 / 8 / 16+）。
   - **RICE = (Reach × Impact × Confidence%) / Effort**
   - 输出排序表：`| Rank | Item | Reach | Impact | Confidence | Effort | RICE |`
3. **Sanity Check（体检）** —— 排名是否符合直觉？有无依赖（#3 是否要先于 #1）？中间是否藏着一天能上线的 quick win？
4. **Recommendation（建议）** —— 现在做 Top 3（各一句理由），明确 defer 与 kill（"kill"= 别做，不是"以后做"）。

## 规则
- 没有数据时用粗略估算并声明在猜；信心应随猜测降低，别伪装数据。
- 框架是工具不是上帝：数学说一套、战略说另一套时，两者都要说清。
- 两条目分差 <20% 视为 toss-up，讲权衡而非假装精确。

## 对 xiye PRD 的意义
PRD「成功指标」应带 RICE 表；「范围 / 非目标」应给出明确的 kill 清单（而非"以后做"），让优先级可解释、可问责。

## 原框架提示（可复制）
```
RICE Score = (Reach × Impact × Confidence%) / Effort
| Rank | Item | Reach | Impact | Confidence | Effort | RICE Score |
State top 3 to do now (one sentence each). State what to defer and what to kill.
Be direct — "kill" means don't do it, not "do it later".
```
