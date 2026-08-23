---
type: skill
name: Shopify 区块注入（shopify-section-html-to-library）
summary: 把静态 HTML 区块转为 Liquid 区块库，注册 Hero/布局变体并接入画布预览
useCase: 做 Shopify 主题开发，想把现成 HTML 区块沉淀成可复用的 Liquid 区块库
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [image-to-code]
tags: [Shopify, Liquid, 电商]
status: active
updated: 2026-08-22
---
# Shopify 区块注入（skill）

## 作用
面向 Shopify 主题开发：把**静态 HTML 区块**转化为 **Liquid 区块库**，注册 Hero / 布局等变体，并**接入画布预览**，让区块在编辑器中可直接看到效果。

## 适用场景
- **该用**：在做 Shopify 主题/店铺装修，想把已有 HTML 沉淀成可复用、可预览的 liquid 区块时。
- **不要用**：非 Shopify 或纯前端 Styling 项目，无需引入 Liquid/meta。
- **替代**：`image-to-code`（反打 raw HTML）；直接在 Shopify 后台手动建区块。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 提供静态区块 → 转 Liquid 区块库 → 注册变体 + 画布预览。

## 依赖
- Shopify 主题开发环境。