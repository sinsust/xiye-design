---
name: pre-mortem · 上市前风险预演
summary: 假设产品已失败，倒推哪里出错——在还能修的时候暴露团队没在聊的风险（Tigers / Paper Tigers / Elephants）。
useCase: PRD 定稿后、上线前做风险体检；或用户问「会不会翻车」「还差什么」时套用。
stack: []
related: ["amp-craft-spec", "amp-prioritize"]
tags: ["pre-mortem", "风险管理", "上线", "amplitude"]
status: active
updated: 2026-08-23
userAdded: false
repoUrl: https://github.com/amplitude/builder-skills
source: https://github.com/amplitude/builder-skills/tree/main/product-skills/skills/pre-mortem
---

# pre-mortem · 上市前风险预演

> 来源：[amplitude/builder-skills](https://github.com/amplitude/builder-skills)（Amplitude 官方 PM 团队）。提炼版，供 xiye「AI 一句话」与人工复用。

## 心法
规格定了、团队在造、大家都乐观。本 skill 强制假设「上线 30 天后已失败」，倒推原因——趁还有时间修。

## 方法（三类风险 + 紧迫度）
把每个风险归入三类：
- **Tigers（真老虎）** —— 有证据支撑、能拖垮项目的真实威胁，需缓解方案。
- **Paper Tigers（纸老虎）** —— 听着吓人但不太可能/被夸大的，点名让团队别再纠结。
- **Elephants（大象）** —— 没人提的隐性风险：团队没质疑的假设、没人敢说的顾虑、回避的真相。**最值钱的输出往往是 Elephant。**

每个 Tiger 标紧迫度：
- **Launch-Blocking（上线阻断）** —— 必须解决才能发；没解决就推迟。
- **Fast-Follow（快速跟进）** —— 上线 30 天内处理，可接受带病上线但不能无视。
- **Track（观察）** —— 上线后监控，信号恶化再升级。

每个 Tiger 含：具体缓解动作 + 建议负责人（角色非人名）+ 相对上线的截止时间。

## 规则
- 上线前 2-3 周跑，不是前一天。
- 不确定就归 Tiger——缓解一个小事比忽视一个真风险便宜。
- 诚实，目标是提升就绪度，不是制造虚假信心。

## 对 xiye PRD 的意义
PRD 应增「风险预演（Pre-Mortem）」章：列出 Tigers（含紧迫度+缓解+角色）与 Elephants（团队回避的假设）。让 PRD 从「理想蓝图」变成「带风险意识的可执行文档」。

## 原框架提示（可复制）
```
Imagine it is 30 days after launch and this has failed. Work backward.
Classify risks as Tigers / Paper Tigers / Elephants.
For each Tiger: Launch-Blocking / Fast-Follow / Track + mitigation + owner(role) + deadline.
Be brutally honest. Pay special attention to Elephants.
```
