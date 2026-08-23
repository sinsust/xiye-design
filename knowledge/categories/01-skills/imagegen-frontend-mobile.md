---
type: skill
name: 移动端图像生成（imagegen-frontend-mobile）
summary: 高质量 iOS/Android/跨平台屏幕概念与流程，仅出图不写代码
useCase: 需要移动端视觉概念图/流程稿做提案评审时；最终要代码则再走 image-to-code
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [imagegen-frontend-web, image-to-code]
tags: [移动端, 图像, 设计]
status: active
updated: 2026-08-22
---
# 移动端图像生成（skill）

## 作用
生成高质量 **iOS / Android / 跨平台** 的屏幕概念图与流程演示，统一调性。**只出图、不写代码**，用于前期的视觉提案与方向评审。

## 适用场景
- **该用**：移动端视觉方向还未定、先用概念图对齐各方时。
- **不要用**：要可直接落地的代码时，图只是参考，最终需 `image-to-code` 还原。
- **替代**：`imagegen-frontend-web`（网页端出图）、`image-to-code`（图转代码）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 描述屏幕/流程 → 出系列概念图。

## 依赖
- 面向任意 Web 框架；需要图像生成能力。