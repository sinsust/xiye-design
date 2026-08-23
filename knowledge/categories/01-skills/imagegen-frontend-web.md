---
type: skill
name: 网页设计图像生成（imagegen-frontend-web）
summary: 为每个 section 生成独立横向参考图，统一调性，适用于落地页与营销站
useCase: 做落地页/营销站前先用横向参考图定版面与视觉调性（仅出图）
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [imagegen-frontend-mobile, image-to-code]
tags: [网页, 图像, 设计]
status: active
updated: 2026-08-22
---
# 网页设计图像生成（skill）

## 作用
按落地页/营销站的结构，为**每个 section 生成独立的横向参考图**，统一整体视觉调性，支撑后续版面还原。**仅出图、不写代码**。

## 适用场景
- **该用**：落地页/营销站先做 section 级视觉稿、统一版面调性时。
- **不要用**：直接写代码时，参考图作为还原来源，最终走 `image-to-code`。
- **替代**：`image-to-code`（图转代码）、`imagegen-frontend-mobile`（移动端出图）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 描述页面结构 → 出各 section 参考图。

## 依赖
- 面向任意 Web 框架；需图像生成能力。