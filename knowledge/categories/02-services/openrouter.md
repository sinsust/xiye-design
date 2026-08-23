---
type: service
name: OpenRouter
summary: 多模型聚合 API：统一调用多个提供商模型，含免费模型与灵活计费
useCase: 想评估/路由多个模型、实验对比时；单一模型依赖则不必引入
website: https://openrouter.ai
freeTier: Free 含 25+ 免费模型、4 免费提供商、50 reqs/day；Pay-as-you-go 平台费 5.5%（以官网为准）
configSteps: ["注册 key", "设置 OPENROUTER_API_KEY", "统一调 /api/v1/chat/completions"]
security: key 服务端私存；注意第三方模型数据政策
related: [openai, anthropic-claude, deepseek]
tags: [LLM, 聚合, 路由]
source: https://openrouter.ai/pricing
status: active
updated: 2026-08-22
---
# OpenRouter（service）

## 作用
**多模型聚合层**：统一 API 调用 OpenAI/Anthropic/DeepSeek 等多家的模型，便于做模型路由、A/B 对比，且提供免费用模型选项。

## 适用场景
- **该用**：想在一个 endpoint 下自由切换/对比多个模型、有免费模型需求做原型时。
- **不要用 / 注意**：只需单一固定模型时引入它徒增依赖与平台费。
- **替代**：直连各厂商（`openai`/`anthropic-claude`/`deepseek`）。

## 免费额度 / 计费
- Free 层含较多免费模型与限速；超限按量 + 平台费。

## 接入
1. 注册 key。
2. `OPENROUTER_API_KEY`；统一端点调用切换模型。

## 安全注意
- key 只存服务端；第三方模型遵循其数据使用政策。