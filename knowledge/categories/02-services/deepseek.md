---
type: service
name: DeepSeek
summary: DeepSeek-V4 模型 API：中文友好、并发高、成本低，兼容 OpenAI/Anthropic 格式
useCase: 中文场景/成本敏感/高并发时；空闲时段更便宜
website: https://deepseek.com
freeTier: 官方为按量计费（如 v4-flash 空闲缓存未命中 输入1.5/输出4.5元 每百万，以官网为准）
configSteps: ["注册平台 key", "设置 DEEPSEEK_API_KEY", "OpenAI 兼容 /v1"]
security: key 服务端私存；余额与用量告警
related: [openai, anthropic-claude, openrouter]
tags: [LLM, DeepSeek, 低成本, 中文]
source: https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
status: active
updated: 2026-08-22
---
# DeepSeek（service）

## 作用
提供 **DeepSeek-V4** 系列（Flash/Pro）模型的 API：**中文友好、并发高、成本低**，支持 OpenAI 与 Anthropic 两种调用格式，并支持思考模式/JSON Output/Tool Calls。

## 适用场景
- **该用**：中文为主、成本敏感、高并发或低延迟的场景；AI 一句话扩写、批量生成。
- **不要用 / 注意**：需要欧美供应商合规/超长专有上下文时对比 Claude；高峰期价加倍。
- **替代**：`openai`、`anthropic-claude`、`openrouter`（聚合多家）。

## 免费额度 / 计费
- 按量计费，空闲时段比高峰便宜一半；以官网最新为准。

## 接入
1. 注册 key。
2. `DEEPSEEK_API_KEY` 环境变量；OpenAI 兼容端点。

## 安全注意
- key 只存服务端；监控余额与用量。