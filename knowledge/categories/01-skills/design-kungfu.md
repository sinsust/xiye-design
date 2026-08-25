---
type: skill
name: 智能设计推荐（design-kungfu）
summary: 分析 Web 应用需求，从 130+ 设计风格智能匹配最佳方案，给出完整设计系统与 shadcn/ui 指南
useCase: 项目刚起步还不知道该选什么设计风格/设计系统时；提供需求它会给出含资的设计方向
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [shadcn-ui, design-taste-frontend, ui-ux-pro-max]
alternative: [UI/UX Pro Max 设计系统生成, Anti-slop 前端设计（design-taste-frontend）]
alternative_note: "同为设计风格推荐/落地工具，可按项目阶段选用"
tags: [设计, 推荐, shadcn]
status: active
updated: 2026-08-22
repoUrl: https://github.com/s5uy/ui-craft
---
# 智能设计推荐（skill）

## 作用
分析 Web 应用的需求与目标，从 **130+ 设计风格**中智能匹配最佳方案，输出建议 + 完整设计系统 + shadcn/ui 落地指南，降低"选风格、搭体系"的决策成本。

## 适用场景
- **该用**：需求清晰但不确定走哪种设计风格/视觉语言时，作为选型起点。
- **不要用**：早已定死风格、或只要极简模板时，直接走 `minimalist-ui` 更省事。
- **替代**：`ui-ux-pro-max`（本地可搜的设计智能库）；`design-taste-frontend`（落地页反模板）。可在线复现同款"风格推荐 + premium 设计方向"的开源实现是 [s5uy/ui-craft](https://github.com/s5uy/ui-craft)（公开参考，非本技能本体）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 给出应用需求 → 得到推荐风格 + 设计系统 + shadcn 落地指南。

## 依赖
- 面向任意 Web 框架。