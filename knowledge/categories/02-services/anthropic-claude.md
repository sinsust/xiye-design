---
type: service
name: Anthropic Claude
summary: Claude 系列模型 API + Claude Code：复杂推理、长上下文、代码生成
useCase: 需要长上下文/复杂推理与高质量代码；Claude Code 适合个人开发辅助
website: https://www.anthropic.com
freeTier: 官方定价页未见免费额度；Sonnet 4.6 约 输入$3/输出$15 每MTok（以官网为准）
configSteps: ["创建 API key", "设置 ANTHROPIC_API_KEY", "调 /v1/messages"]
security: key 只存服务端；Code 布局谨慎对待扩展
related: [openai, deepseek, skill-creator]
tags: [LLM, Claude, 推理, 长上下文]
source: https://platform.claude.com/docs/en/about-claude/pricing
status: active
updated: 2026-08-22
---
# Anthropic Claude（service）

## 作用
提供 **Claude 系列**模型（含 Agent Skills / Claude Code 生态）：擅长复杂推理、长上下文、代码生成与 AI 编程辅助；`anthropics/skills` 的文档/测试等技能即围绕它构建。

## 适用场景
- **该用**：需要强推理、长文档/长上下文处理、或要用官方 Agent Skills 生态时。
- **不要用 / 注意**：不考虑推理只求便宜/低延迟时看 DeepSeek/Gemini。
- **替代**：`openai`、`deepseek`、`openrouter`（聚合）。

## 免费额度 / 计费
- 按模型按 token 计费，长上下文模型更贵；官方无明确免费层。

## 接入
1. 创建 Anthropic 项目 API key。
2. 环境变量 `ANTHROPIC_API_KEY`；`/v1/messages`。

## 安全注意
- key 服务端私存；装第三方 skills 前审 SKILL.md 避免注入。