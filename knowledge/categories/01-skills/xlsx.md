---
type: skill
name: Excel 处理（xlsx · anthropics）
summary: Excel 创建、编辑、分析，支持公式/格式化/数据分析
useCase: 财务报表、自动化表格生成、数据清洗与透视时
stack: []
related: [pdf, docx]
tags: [文档, Excel, 数据分析]
source: https://github.com/anthropics/skills/tree/main/skills/xlsx
status: active
updated: 2026-08-22
---
# Excel 处理（skill）

## 作用
Anthropic 官方：**创建、编辑、分析 Excel 工作簿**，支持**公式、单元格格式化、多工作表、数据清洗与透视**，让 LLM 能真实操作 .xlsx 而非仅倒 CSV。

## 适用场景
- **该用**：财务对账/报表生成、批量整理跨表数据、带公式的自动化表格产出。
- **不要用 / 注意**：仅单表纯数值时用 CSV 更轻；超大文件注意性能。
- **替代**：本底座 `xlsx` 技能（编辑器读写）；`docx`/`pdf` 输出文档形式。

## 用法 / 接入
1. 复制 anthropics/skills `skills/xlsx` 到项目 `skills/`。
2. 读写/计算/清洗 .xlsx。

## 依赖
- 来源：https://github.com/anthropics/skills/tree/main/skills/xlsx