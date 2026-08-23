---
type: service
name: Neon
summary: Serverless Postgres：按量计费、数据库分支、冷启动、存储快照
useCase: 想要免运维、可分支的 Serverless Postgres，原型/SaaS 皆宜
website: https://neon.com
freeTier: Free：每项目 0.5GB 存储、100 CU-hours、最多100项目、计算5分钟缩零（以官网为准）
configSteps: ["创建项目", "拿连接串 DATABASE_URL", "接 ORM/Driver"]
security: 连接串只存服务端；限制网络入口
related: [supabase]
tags: [数据库, Postgres, serverless]
source: https://neon.com/faqs/managed-postgres-databases-free-tier
status: active
updated: 2026-08-22
---
# Neon（service）

## 作用
**Serverless Postgres**：按量付费、**数据库分支**、冷启动缩零、存储快照，免运维的托管 PG，适合原型与低活跃工作量。

## 适用场景
- **该用**：要 Postgres 又不想运维、需要 branch 做实验/多环境、低流量省成本时。
- **不要用 / 注意**：要 MySQL 生态则用 PlanetScale；要 Auth/Storage 一体化则 Supabase。
- **替代**：`supabase`（PG+Auth+存储）、`pocketbase`（单文件自托管）。

## 免费额度 / 计费
- Free 层 0.5GB/100CU-h/100 项目；5 分钟不活跃计算缩零。

## 接入
1. 创建项目拿连接串。
2. 设 `DATABASE_URL` 环境变量，接 Prisma/Drizzle。

## 安全注意
- 连接串只存服务端；生产开网络白名单。