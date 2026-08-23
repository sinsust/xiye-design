---
type: service
name: Supabase
summary: 托管 Postgres + Auth + 实时订阅 + 文件存储 的一体化后端，一次接入搞定 DB/鉴权/存储
useCase: 全栈项目不想自建服务端基建时首选；但若有定制化数据库索引/复杂事务或需完全本地化，需评估锁定风险
website: https://supabase.com
freeTier: 免费项目含 500MB DB、50K MAU、1GB 存储（额度会调整，以官网为准）
configSteps: ["创建项目 → 复制 Project URL + anon key", "设置 SUPABASE_URL / SUPABASE_ANON_KEY 环境变量", "服务端用 service role key，仅存在于 Server Action / Route Handler"]
security: 前端绝不暴露 service role key，只走 anon key + RLS 行级安全
related: []
tags: [数据库, 认证, 实时, 存储, BaaS]
status: active
updated: 2026-08-22
---
# Supabase（service）

## 作用
基于 Postgres 的托管后端，在一个平台提供 **数据库 / 认证(Auth) / 实时订阅 / 文件存储**。配套 RLS 行级安全，适合在「一句话生成底座」产出的全栈工程里充当默认后端，与 `data/tech-stacks` 的 `*_supabase` 架构直接对齐。

## 适用场景
- **该用**：需要 DB + 登录 + 存储 + 实时，希望少自建、快速上线；架构里已选 `nextjs_supabase / nuxt_firebase / astro_supabase`。
- **不要用 / 注意**：复杂事务/物化视图/分区等重 DB 场景要评估；免费额度用满后付费；绑定后迁移成本。
- **替代**：Firebase（更倾向实时/无 SQL）、自建 Postgres、MySQL（Neon/Planetscale）。

## 免费额度 / 计费
- 免费项目包含托管 Postgres（约 500MB）、Auth 50K MAU、1GB 存储 与部分实时；超限升级付费。

## 接入
1. 控制台创建项目，复制 Project URL 与 anon（publishable）key。
2. 环境变量：`SUPABASE_URL`、`SUPABASE_ANON_KEY`。
3. 服务端（Server Action / Route Handler）可用 service role key；客户端只用 anon key，靠 RLS 保证安全。

## 安全注意
- service role key 只放服务端环境变量；前端严忌暴露；开启用量/余额告警防超支；默认开启 RLS。