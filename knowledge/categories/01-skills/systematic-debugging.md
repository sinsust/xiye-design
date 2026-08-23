---
type: skill
name: 系统性调试（systematic-debugging · superpowers）
summary: 四阶段根因分析：复现、隔离、识别、验证修复
useCase: 复杂 Bug / 生产问题 / 多组件故障，避免"瞎猜改代码"时
stack: []
related: [code-quality-checker]
tags: [调试, 根因分析]
source: https://github.com/obra/superpowers
status: active
updated: 2026-08-22
---
# 系统性调试（skill）

## 作用
社区高口碑（obra/superpowers）：把调试流程化——**复现 → 隔离 → 识别根因 → 验证修复**，避免凭感觉乱改，适合复杂/难复现的故障。

## 适用场景
- **该用**：Bug 难复现、多组件相互作用、生产环境偶发问题，需要根因而非打补丁时。
- **不要用**：一眼可见的笔误，直接改即可。
- **替代**：`code-quality-checker`（静态排查）、日志/APM 工具。

## 用法 / 接入
1. 复制 obra/superpowers 的 systematic-debugging 技能。
2. 按复现→隔离→识别→验证推进。

## 依赖
- 来源：https://github.com/obra/superpowers