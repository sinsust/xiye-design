---
type: skill
name: Skill 创建器（skill-creator · anthropics）
summary: 创建/迭代 Agent Skills：写 SKILL.md、跑评估、对比基线
useCase: 你想给能力库自研新技能、并验其质量时（造技能的元技能）
stack: []
related: [find-skills, one-shot-to-prd]
tags: [技能, 元技能, SKILL.md]
source: https://github.com/anthropics/skills
status: active
updated: 2026-08-22
---
# Skill 创建器（skill）

## 作用
Anthropic 官方**元技能**：创建与迭代 Agent Skills——写 `SKILL.md`、跑 `with-skill` 评估、对比基线效果，保证新技能可靠再发布。

## 适用场景
- **该用**：想为底座/项目**自研新 skill** 并验证质量时；配合本知识库"新增落位规则"沉淀私有能力。
- **不要用**：只是想用现成技能时用 `find-skills`。
- **替代**：`skill-creator`（本机系统技能）——两者目标一致，取其一避免重复。

## 用法 / 接入
1. 从 anthropics/skills 复制 `skills/skill-creator`。
2. 起草 SKILL.md → 评估 → 对比基线。

## 依赖
- 来源：https://github.com/anthropics/skills