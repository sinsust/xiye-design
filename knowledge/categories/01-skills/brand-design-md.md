---
type: skill
name: 品牌设计规范生成（brand-design-md）
summary: 按品牌名从 getdesign.md 自动获取设计规范并生成匹配风格 UI 代码，支持 62 个顶级品牌
useCase: 品牌名已知、想一键套用该品牌官方设计规范的 UI 时；非知名品牌则无现成规范可拉取
stack: [nextjs_supabase, nuxt_firebase, react_express, astro_supabase]
related: [brandkit, design-kungfu]
tags: [品牌, UI, 设计系统]
status: active
updated: 2026-08-22
source: https://getdesign.md
repoUrl: https://github.com/google-labs-code/design.md
---
# 品牌设计规范生成（skill）

## 作用
输入品牌名，从 `getdesign.md` 自动拉取该品牌的**设计规范**，并据此生成风格匹配的 UI 代码。覆盖 62 个顶级品牌，适合需要"贴合某一真实品牌调性"的落地页/站。

## 适用场景
- **该用**：品牌确属受支持范围、想直接借用其字体/配色/间距的官方规范。
- **不要用 / 注意**：品牌不在 62 个清单内会拿不到规范；涉及商标识符商用需自行确认授权。
- **替代**：`brandkit`（生成自有品牌视觉）；`design-kungfu`（按需求智能匹配设计风格）。数据源为 [getdesign.md](https://getdesign.md)（MIT），格式规范见 [design.md](https://github.com/google-labs-code/design.md)（公开参考，非本技能本体）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 传品牌名 → 获取规范 → 生成匹配 UI。

## 依赖
- 支持任意 Web 框架（面向 UI 类）。