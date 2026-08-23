---
type: repository
name: shadcn/ui
summary: 可复制到项目里、风格统一且可深度定制的 React 组件库（构建在 Radix + Tailwind 之上）
useCase: React 项目想要克制、符合设计系统、不需引 package 而是复制代码的组件；若需开箱即用的复杂业务组件则太偏基础
repoUrl: https://github.com/shadcn-ui/ui
stack: [nextjs_supabase, nuxt_firebase, react_express]
tags: [组件库, React, Tailwind, Radix]
related: [supabase]
status: active
updated: 2026-08-22
---
# shadcn/ui（repository）

## 作用
一套以"**复制进项目**"而非 "npm install" 方式使用的组件库，构建在 Radix UI + Tailwind CSS 之上。组件代码即你的、可任意定制，天然契合「一句话生成底座」里按视觉契约建模组件的思路——生成的组件与 shadcn 风格一致，好维护。

## 适用场景
- **该用**：React/Next 项目要一套克制、无障碍、强类型、可深度定制的组件基座；需要与自有设计 token 对齐（改 `tailwind.config` 即可换肤）。
- **不要用 / 注意**：需要开箱即用的复杂业务组件（表格/富文本/图表还是配 TanStack Table / TipTap / Recharts）；依赖你已用 Tailwind，纯 CSS 项目不适合。
- **替代**：Mantine（更新进组件多）、Radix 原语（更底层）、shadcn 的社区扩展（more 生态）。

## 技术栈 / 要求
- React 18+、Tailwind、Radix、其 CLI 可接入 Next/Vite。
- 建议在选型 `react_express / nextjs` 时配它作为 `uiLibrary.main`。

## 拿来即用 vs 仅供参考
- 组件按设计 token 可复制进项目，直接作为默认组件规范基线。
- 亦可作为生成组件"该长什么样"的参考实现。