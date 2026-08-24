---
type: skill
name: Agent 工程技能配置（setup-matt-pocock-skills）
summary: 在 AGENTS.md / CLAUDE.md 配置 Agent skills 块与 docs/agents，统一 issue 追踪与领域文档
useCase: 初始化/维护工程底座的 Agent 交接文件：skills 块、docs/agents 与 issue 追踪
stack: []
related: [find-skills]
tags: [AGENTS.md, 工程, 配置]
status: active
updated: 2026-08-22
source: https://github.com/anthropics/skills
---
# Agent 工程技能配置（setup-matt-pocock-skills）

## 作用
工程化配置 Agent 能力：在 **`AGENTS.md` / `CLAUDE.md`** 里配置 skills 块与 `docs/agents`，统一 **issue 追踪**与**领域文档**，让 agent 交接文件结构化、可持续。

## 适用场景
- **该用**：初始化一个要给 AI agent 交接的工程、建立统一 skills 声明与领域文档体系时。
- **不要用**：工程很小、不需要 agent 交接文档时。
- **替代**：`find-skills`（发现安装技能，与本技能互补）；另有官方 [anthropics/skills](https://github.com/anthropics/skills) 与 [obra/superpowers](https://github.com/obra/superpowers) 提供的可安装技能集（公开参考，非本技能本体）。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 配置 AGENTS.md/CLAUDE.md skills 块 + docs/agents + issue 追踪约定。

## 依赖
- 想有 Agent 协作规范的工程（通用）。