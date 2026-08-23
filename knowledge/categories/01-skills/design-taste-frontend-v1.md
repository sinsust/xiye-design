---
type: skill
name: 设计品味 v1（兼容版）
summary: 旧版 design-taste 实现，仅在与默认 v2 行为不兼容的旧项目中使用
useCase: 只有旧项目选它沿用 v1；新项目一律走 v2
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [design-taste-frontend]
tags: [前端, 设计, 兼容]
status: frozen
updated: 2026-08-22
---
# 设计品味 v1（skill）

## 作用
design-taste 的 v1 原版保留。功能等同 v2，但行为与默认 v2 不兼容，**仅为历史/旧项目兼容而存**。

## 适用场景
- **该用（仅此）**：已有项目锁定 v1 行为、迁移 v2 成本过高时。
- **不要用**：任何新项目都应直接用默认 `design-taste-frontend`（v2）。
- **替代**：v2 `design-taste-frontend`。

## 用法 / 接入
1. 复制到目标旧项目 `skills/`，避免与 v2 同时装载冲突。

## 依赖
- 面向任意 Web 框架；注意与 v2 二选一。