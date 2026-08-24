---
type: skill
name: Varlock 安全密钥管理
summary: Secure-by-default 环境变量管理——密钥永不出现在 AI 会话/终端/日志/git；用 .env.schema 声明敏感度，varlock load 只显掩码值、run 注入命令。
useCase: 当需要安全处理 API 密钥/数据库连接串等敏感配置，防泄漏到会话与代码库时
stack: [node, cli]
tags: [安全, 密钥, 环境变量, secrets, 防泄漏]
status: active
updated: 2026-08-24
repoUrl: https://github.com/wrsmith108/varlock-claude-skill
---

# Varlock 安全密钥管理（skill）

## 核心原则
> **密钥必须 NEVER 出现在 AI 会话上下文中。**

| 禁止 | 安全替代 |
|------|---------|
| `cat .env` | `cat .env.schema` |
| `echo $SECRET` | `varlock load` |
| `printenv \| grep API` | `varlock load \| grep API` |

## 快速参考
- `varlock load` — 校验全部密钥（只显掩码值）
- `varlock load --quiet` — 静默校验（成功无输出）
- `varlock run -- npm start` — 注入密钥运行命令
- `cat .env.schema` — 查看 schema（安全，无值）

## .env.schema 声明敏感度
```
# @defaultSensitive=true @defaultRequired=infer
# @type=string(startsWith=sk_) @required @sensitive
STRIPE_SECRET_KEY=
# @type=url @required @sensitive
DATABASE_URL=
# @sensitive=false（公开配置）
NODE_ENV=development
```
注解：`@sensitive`（输出一律掩码）、`@sensitive=false`（公开）、`@required`（必须存在）、`@type=string(startsWith=X)`（前缀校验）。

## 处理密钥请求
- "检查 API key 是否设置" → `varlock load | grep API_KEY`
- "调试认证失败" → `varlock load`（校验全部）
- "更新一个密钥" → 拒绝，让用户手动更新
- "显示 .env" → `cat .env.schema`（不给值）

## 与本项目关系
与 SECURITY.md「密钥管理」章节一致：密钥只走服务端 .env、不进前端 bundle/代码库/交付物；知识库条目里也不该出现明文 key（已脱敏）。
