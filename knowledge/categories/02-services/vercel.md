---
type: service
name: Vercel
summary: Git 驱动部署：CDN、Serverless Functions、Preview Deployments
useCase: 部署 Next.js/前端/全栈应用，要预览与一键上线时
website: https://vercel.com
freeTier: Hobby $0/10，适合个人与小规模；含 CDN/边缘请求等（以官网为准）
configSteps: ["连 Git 仓库", "自动识别框架构建", "绑域名/环境变量"]
security: 环境变量按项目管理，勿提交密钥
related: [netlify, cloudflare-pages]
tags: [部署, Next.js, CDN, serverless]
source: https://vercel.com/pricing
status: active
updated: 2026-08-22
---
# Vercel（service）

## 作用
**Vercel** 是 Next.js 原生的 Git 驱动部署平台：CDN + **Serverless Functions** + Preview Deployments，是"一句话生成 Web 底座"上线 Next 产物的首选宿主。

## 适用场景
- **该用**：生成的 Next.js/前端应用一键部署、要高性能 CDN 与预览部署时。
- **不要用**：纯静态站量级想极省时也可用 Netlify/Cloudflare；要 Docker 承载全栈另选 Railway。
- **替代**：`netlify`、`cloudflare-pages`、`railway`/`render`（更多后端服务）。

## 免费额度 / 计费
- Hobby 免费档面向个人与小规模；超量升 Pro，以官网为准。

## 接入
1. 导入仓库 → 自动构建 Next。
2. 配置环境变量与自定义域名。

## 安全注意
- 密钥放平台环境变量，别提交到代码库。