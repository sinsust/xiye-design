---
type: skill
name: 发现并安装 Skill（find-skills）
summary: 当你想扩展能力时，搜索并安装可安装的 Agent Skills
useCase: 需要给项目/工作台新增能力但不知道装哪个 skill 时用它检索安装
stack: []
related: [setup-matt-pocock-skills]
tags: [skill, 发现, 安装]
status: active
updated: 2026-08-22
---
# 发现并安装 Skill（skill）

## 作用
当用户想扩展能力、但不知道有哪些 Agent Skill 可用时，本技能负责**搜索可安装的 skill 并执行安装**。

## 适用场景
- **该用**：进入一个新项目/想补能力、不确定该装什么时，先跑它做发现。
- **不要用**：已经明确要某个 skill 时直接 `find-skills` 安装清单即可，或在仓库里复制。
- **替代**：手动从 `D:/workspace/skill/.agents/skills/` 复制。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 输入诉求 → 搜索候选 → 安装选定 skill。

## 依赖
- 通用（任意栈）。