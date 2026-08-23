---
type: repository
name: create-t3-app（全栈样板）
summary: 交互式 CLI 生成类型安全的全栈 Next.js 应用（T3 Stack）
useCase: 需要"可运行、类型安全"的全栈底座参考/脚手架时
repoUrl: https://github.com/t3-oss/create-t3-app
stack: [nextjs_supabase, react_express]
tags: [样板, starter, Next.js]
source: https://create.t3.gg/
status: active
updated: 2026-08-22
---
# create-t3-app（repository）

## 作用
**T3 Stack** 官方脚手架：交互式 CLI 生成**类型安全**的全栈 Next.js 应用，把 Next.js + tRPC + Prisma + Tailwind 等串起来，作为"生产级全栈底座"的经典参考。

## 适用场景
- **该用**：要一套约定成熟、类型安全的全栈 Next/ 底座参照；生成产物技术选型对标它。
- **不要用 / 注意**：不需要 tRPC/ORM 复杂度时反而啰嗦；可作为参考而非直接模板。
- **替代**：本底座内置 `tech-stacks` 直接生成；`ChadNext`（带 UI/认证）、Supabase 官方模板。

## 技术栈 / 要求
- Next.js、TypeScript、可选 Prisma/trpc/Tailwind。

## 相关
- [shadcn-ui](shadcn-ui.md) · [supabase](supabase.md)