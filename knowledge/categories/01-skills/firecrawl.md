---
type: skill
name: Firecrawl 网页抓取（firecrawl）
summary: 通过 CLI 抓取、爬取、搜索、映射网站，自带反反爬与智能提取
useCase: 需要健壮地抓取/爬取/站内搜索/站点地图时；比裸 HTTP 抓取可靠
stack: []
related: [web-scraper]
tags: [爬虫, 数据提取, 站点映射]
source: https://github.com/firecrawl/cli
status: active
updated: 2026-08-22
---
# Firecrawl 网页抓取（skill）

## 作用
Firecrawl 的 **CLI/技能形态**：抓取、爬取、搜索、**站点映射（map）**网站，附带反爬处理与结构化提取能力，`webapp-testing` 之外的更健壮网页采集方案。

## 适用场景
- **该用**：目标站有反爬/需 JS 渲染、要站内全文搜索或整站地图、要 clean 文本/结构化数据时。
- **不要用**：单页简单静态抓取时用轻量方案即可。
- **替代**：本地 `web-scraper`（简单抓取）；浏览器自动化（交互类）。

## 用法 / 接入
1. 复制 firecrawl/cli 的 `skills/firecrawl-cli`。
2. 用 CLI 抓取/爬取/搜索/Map 目标站。

## 依赖
- 来源：https://github.com/firecrawl/cli