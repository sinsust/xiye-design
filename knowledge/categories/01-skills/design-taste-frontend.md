---
type: skill
name: Anti-slop 前端设计（design-taste-frontend）
summary: 读取 brief 推断设计方向，产出不像模板的界面；重设计先审计，含严格预检清单
useCase: 想要反通用的、有辨识度的落地页/界面；默认 v2 行为，避免廉价 AI 模板感
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [design-taste-frontend-v1, high-end-visual-design]
tags: [前端, 设计, landing]
status: active
updated: 2026-08-22
repoUrl: https://github.com/Koomook/claude-frontend-skills
---
# Anti-slop 前端设计（skill）

## 作用
从 brief 推断设计方向，产出**不像模板**的界面，避免通用 AI slop；涉及重设计先做设计审计，并有严格的预检清单。是默认(v2)的设计品味实现。

## 适用场景
- **该用**：做落地页/展示站，希望有设计辨识度、别千篇一律时。
- **不要用**：旧项目与 v2 行为不兼容时，改用 `design-taste-frontend-v1`。
- **替代**：`design-kungfu`（按需求选风格）、`high-end-visual-design`（高端"显得贵"标准）。可在线复现同款"反 AI slop、产出有辨识度界面"的开源实现是 [Koomook/claude-frontend-skills](https://github.com/Koomook/claude-frontend-skills)（公开参考，非本技能本体）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 提供 brief → 推断方向 → 产出差异化界面；重设计先审计。

## 依赖
- 面向任意 Web 框架。