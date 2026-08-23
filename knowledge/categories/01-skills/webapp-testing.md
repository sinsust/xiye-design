---
type: skill
name: Web 应用测试（webapp-testing · anthropics）
summary: 用 Playwright 驱动本地 Web 应用，验证行为、截图、检查日志
useCase: 本地前端验证、UI 回归、端到端流程测试时
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [test-driven-development]
tags: [测试, Playwright, E2E]
source: https://github.com/anthropics/skills/tree/main/skills/webapp-testing
status: active
updated: 2026-08-22
---
# Web 应用测试（skill）

## 作用
Anthropic 官方：用 **Playwright 驱动本地 Web 应用**——导航、点击、验证前端行为、截图、检查控制台日志，做端到端/UI 回归验证。

## 适用场景
- **该用**：本地起服务后自动验证页面行为、跑冒烟/回归、排查前端交互问题。
- **不要用**：仅静态代码检查用 `code-quality-checker`；跨仓库编排自动化测试另说。
- **替代**：本项目浏览器测试子代理；`test-driven-development`（写测试驱动开发）。

## 用法 / 接入
1. 复制 anthropics/skills `skills/webapp-testing`。
2. 起本地 dev → Playwright 脚本验证。

## 依赖
- 来源：https://github.com/anthropics/skills/tree/main/skills/webapp-testing