---
type: skill
name: PDF 文档处理（pdf · anthropics）
summary: PDF 读取、创建、合并拆分、加密、表单填写、表格提取
useCase: 合同审阅/报告数据提取/批量 PDF 处理时；本资产底座要用二进制文档就靠它，而非手写
stack: []
related: [docx, xlsx, pptx]
tags: [文档, PDF, 表格, 提取]
source: https://github.com/anthropics/skills
status: active
updated: 2026-08-22
---
# PDF 文档处理（skill）

## 作用
Anthropic 官方技能：**读取、创建、合并、拆分、加密 PDF，填写表单、提取文本/表格**。是"让 LLM 真正处理 PDF 而非糊弄"的规范实现。

## 适用场景
- **该用**：合同审阅、报告/论文数据提取、批量 PDF 归档、生成带加密的 PDF。
- **不要用 / 注意**：纯文本内容无需跨库，直接读文件即可；大型扫描件提取前先考虑 OCR。
- **替代**：本地 `web-scraper`（只抓网页）；Adobe 手动处理；`xlsx` 处理表格数据。

## 用法 / 接入
1. 从 anthropics/skills 复制 `skills/pdf` 到项目 `skills/`。
2. 按其 API 读写/合并/提取。

## 依赖
- 来源：https://github.com/anthropics/skills