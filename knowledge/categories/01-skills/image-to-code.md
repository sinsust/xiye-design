---
type: skill
name: 图像转代码（image-to-code）
summary: 先生成设计图并深度分析，再实现高度还原的网站
useCase: 基于概念图/参考图高还原地实现前端页面；适合图纸到落地的闭环
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [imagegen-frontend-web, imagegen-frontend-mobile, design-taste-frontend]
tags: [图像, 代码, 前端]
status: active
updated: 2026-08-22
---
# 图像转代码（skill）

## 作用
把手头的设计图**深度分析**后，实现高度还原的网站：先提炼布局/间距/配色等要素，再产出与图像匹配的前端代码。

## 适用场景
- **该用**：已有设计图/概念图，需要高质量还原成真实页面时。
- **不要用 / 注意**：图我非最终版时先出 `imagegen-*` 定稿；还原度受参考图质量影响。
- **替代**：直接按文字 brief 用 `design-taste-frontend` 设计开发。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 提供设计图 → 深度分析 → 生成还原页面。

## 依赖
- 面向任意 Web 框架。