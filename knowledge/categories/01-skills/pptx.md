---
type: skill
name: PPT 幻灯片处理（pptx · anthropics）
summary: PowerPoint 演示文稿创建、编辑、分析
useCase: 自动化生成/更新幻灯片、批量套模板、分析演示内容时
stack: []
related: [docx, xlsx, pdf]
tags: [文档, PPT, 演示]
source: https://github.com/anthropics/skills/tree/main/skills/pptx
status: active
updated: 2026-08-22
---
# PPT 幻灯片处理（skill）

## 作用
Anthropic 官方：**创建、编辑、分析 PowerPoint 演示文稿**，真实生成 .pptx（含版式/形状/文本），用于自动化做幻灯片或按模板批量更新。

## 适用场景
- **该用**：汇报/提案自动生成、批量套用品牌模板更新旧 deck、分析现有 PPT 内容。
- **不要用**：需要精修动效/排版的发布会级 deck 时，仍要人处理；本底座另可用 `pptx` 系统技能。
- **替代**：`docx`（文字稿前身）、`pdf`（静态输出）。

## 用法 / 接入
1. 复制 anthropics/skills `skills/pptx` 到项目 `skills/`。
2. 创建/编辑/分析 .pptx。

## 依赖
- 来源：https://github.com/anthropics/skills/tree/main/skills/pptx