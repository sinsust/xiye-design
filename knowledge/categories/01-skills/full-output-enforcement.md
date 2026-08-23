---
type: skill
name: 完整输出强制（full-output-enforcement）
summary: 覆盖 LLM 截断行为，禁止占位符，干净处理 token 上限拆分
useCase: 需要长输出不被截断、不出现占位符/偷懒内容时（如长文档生成、JSON 大 payload）
stack: []
related: [code-quality-checker]
tags: [输出, 防截断]
status: active
updated: 2026-08-22
---
# 完整输出强制（skill）

## 作用
强制 LLM 输出**完整、不截断、无占位符**：覆盖截断行为、禁止"此处略/按需填充"类偷懒占位，并在触达 token 上限时按干净边界拆分继续输出。

## 适用场景
- **该用**：生成长篇文档/PRD、大 JSON、N 个条目的清单，担心被截断或出占位符时。
- **不要用**：极短输出无需此约束。
- **替代**：提示词里自带"务必完整"约束；本 skill 提供更强制的机制。

## 用法 / 接入
1. 复制到项目 `skills/`。
2. 在需要完整输出的生成任务前启用。

## 依赖
- 通用（任意栈）。