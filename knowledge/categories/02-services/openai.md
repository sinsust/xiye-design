---
type: service
name: OpenAI
summary: GPT/o1 系列模型 API：文本/代码生成、复杂推理
useCase: 需要高质量 API 化模型能力时；成本敏感/中文场景可对比 DeepSeek
website: https://openai.com
freeTier: 官方定价页未见免费额度；gpt-4o-mini 约 输入$0.075/输出$0.30 每1M tokens（以官网为准）
configSteps: ["创建 API key", "设置 OPENAI_API_KEY", "调 /v1/chat/completions"]
security: key 只存服务端环境变量，勿进前端
related: [anthropic-claude, deepseek, openrouter]
tags: [LLM, OpenAI, 推理]
source: https://developers.openai.com/api/docs/pricing
status: active
updated: 2026-08-22
---
# OpenAI（service）

## 作用
提供 **GPT / o1** 系列模型的 API，用于 AI 生成网站/应用里的文本生成、代码生成与复杂推理。若项目期限望高质量模型能力，是本底座的默认 LLM 候选之一。

## 适用场景
- **该用**：要高质量 API 化模型、生态成熟/文档好时；生成底座做 AI 一句话扩写、代码补全。
- **不要用 / 注意**：成本敏感或中文大规模调用时对比 DeepSeek；数据出境已有主见时要评估合规。
- **替代**：`anthropic-claude`（长上下文/复杂推理）、`deepseek`（中文/成本）、`openrouter`（聚合）。

## 免费额度 / 计费
- 按模型按 token 计费，模型越小越便宜；官方无明确免费层，以官网最新为准。

## 接入
1. 创建项目与 API key。
2. 环境变量 `OPENAI_API_KEY`；服务端调用。

## 安全注意
- key 只存服务端；客户端走受控端点，避免泄露。