---
type: skill
name: 高端视觉设计标准（high-end-visual-design）
summary: 定义字体/间距/阴影/卡片/动画，屏蔽廉价通用 AI 风，让网站显得昂贵
useCase: 需要"贵感"非模板的视觉基座、或审计并提升现有页面质感时
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [gpt-taste, design-taste-frontend, redesign-existing-projects]
tags: [视觉, 高端, 设计]
status: active
updated: 2026-08-22
repoUrl: https://github.com/s5uy/ui-craft
---
# 高端视觉设计标准（skill）

## 作用
给出可执行的**视觉标准**（字体、间距、阴影、卡片、动效），用于把页面做成"看起来昂贵"，主动规避廉价常见的通用 AI 观感。

## 适用场景
- **该用**：为新设计定基调，或做高端化审计时；与 `redesign-existing-projects` 搭配升级现有站。
- **不要用 / 注意**：走极简/野兽派等特定风格时标准会冲突，按风格选技能。
- **替代**：`minimalist-ui`（极简）、`industrial-brutalist-ui`（野兽派）、`stitch-design-taste`（反通用设计系统）。在线同主题的"premium、反 gradient/反 slop、层级优先"开源实现是 [s5uy/ui-craft](https://github.com/s5uy/ui-craft)（公开参考，非本技能本体）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 按标准生成/评审视觉。

## 依赖
- 面向任意 Web 框架。