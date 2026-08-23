---
type: skill
name: 测试驱动开发（test-driven-development · superpowers）
summary: RED-GREEN-REFACTOR 工作流，让新特性先写测试再实现
useCase: 写新功能想让代码有测试覆盖、行为有保障时
stack: []
related: [code-quality-checker, webapp-testing]
tags: [TDD, 测试, 工作流]
source: https://github.com/obra/superpowers
status: active
updated: 2026-08-22
---
# 测试驱动开发（skill）

## 作用
社区高口碑（obra/superpowers）：把开发流程约束为 **RED-GREEN-REFACTOR**——先写会失败的测试，再实现到通过，最后重构，保证功能自带测试覆盖。

## 适用场景
- **该用**：开发有明确行为的新特性、希望"测试先行、防回归"的质量文化时。
- **不要用**：一次性脚本/原型或探索性代码，强制 TDD 会拖慢。
- **替代**：`webapp-testing`（端到端）、`code-quality-checker`（事后体检）。

## 用法 / 接入
1. 复制 obra/superpowers 的 tdd 技能。
2. 按红→绿→重构循环开发。

## 依赖
- 来源：https://github.com/obra/superpowers