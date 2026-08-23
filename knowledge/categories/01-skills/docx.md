---
type: skill
name: Word 文档处理（docx · anthropics）
summary: Word 文档创建、编辑、分析，真实格式输出而非 Markdown 冒充
useCase: 自动化生成/编辑 .docx、提取文档结构、合同与报告处理时
stack: []
related: [pdf, xlsx, pptx]
tags: [文档, Word, 生成]
source: https://github.com/anthropics/skills/tree/main/skills/docx
status: active
updated: 2026-08-22
---
# Word 文档处理（skill）

## 作用
Anthropic 官方：**创建、编辑、分析 Word 文档**，产出**真实 docx 格式**（标题/段落/表格/样式），而非用 Markdown 文本冒充文档。能提取文档结构与内容供下游处理。

## 适用场景
- **该用**：自动化生成公文/报告/合同、基于模板填充、批量编辑与结构化提取。
- **不要用**：只是轻量记录、Markdown 足够时。
- **替代**：本底座 `docx` 系统技能（编辑器内用）；`pdf`（最终出版态）。

## 用法 / 接入
1. 复制 anthropics/skills `skills/docx` 到项目 `skills/`。
2. 读写/编辑/分析 .docx。

## 依赖
- 来源：https://github.com/anthropics/skills/tree/main/skills/docx