---
type: skill
name: Agent 上下文工程（Context Engineering）
summary: 17 个子技能覆盖上下文基础/退化/压缩/优化、多 Agent 模式、记忆系统、长程提示、评估等，核心哲学是管理进入注意力预算的信息以最大化期望结果概率。
useCase: 当需要设计长会话对话、多 Agent 会诊、上下文压缩与防退化、记忆与评估体系时
stack: [python, typescript]
tags: [上下文, 上下文工程, 多agent, 压缩, 记忆, 评估, lost-in-middle]
status: active
updated: 2026-08-24
repoUrl: https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering
---

# Agent 上下文工程（skill）

## 作用
通过管理**进入模型注意力预算的信息**（系统提示、工具定义、检索文档、消息历史、工具输出）最大化期望结果概率——而非只优化提示词。目标：找到**最小的高信号 token 集**。

## 基础技能
- **context-fundamentals**：上下文解剖——系统提示/工具定义/检索文档/消息历史/工具输出如何影响行为。上下文窗口受注意力机制约束，非原始 token 容量。
- **context-degradation**：识别四类退化——**lost-in-middle（中间丢失）**、**poisoning（污染）**、**distraction（干扰）**、**clash（冲突）**；随长度增加呈可预测退化，源于注意力而非容量。
- **context-compression**：压缩策略在**状态保留**与**体积缩减**间平衡；摘要/丢弃/结构化提炼。

## 架构技能
- **multi-agent-patterns**：orchestrator（编排）/ peer-to-peer（点对点）/ hierarchical（层级）三种模式；关键在上下文隔离边界与交接协议。
- **long-horizon-prompting**：长程任务写伪形式化简报——精确成功谓词、非计数结果、审计门控返回、努力下限。
- **memory-systems**：短期（会话内）与长期（跨会话）记忆分离；图记忆追踪实体关系。
- **tool-design**：代理-工具契约、合并工具表面、重写工具描述（实测 top-1 命中 +7.8pp）。
- **filesystem-context**：大体积上下文移入文件、草稿本、即时发现；技能用目录布局而非扁平 md。

## 运维技能
- **context-optimization**：压缩/掩码/缓存/前缀复用/token 预算分配。
- **evaluation / advanced-evaluation**：确定性检查、评分标准、回归套件、LLM-as-a-Judge（成对比较需防位置偏差）。
- **harness-engineering / self-improvement-loops**：框架锁定指标、持久日志、回滚、自修改接受门禁。

## 关键规则
- **渐进式披露**：启动只加载技能名与描述，激活时才读全文
- **平台无关**：Claude Code / Cursor / Codex 通用
- SKILL.md 保持 <500 行；激活场景驱动加载

## 与本项目对话的关系
我们已有的窗口裁剪 + currentBrief 结构化记忆 + LLM 摘要 + 多专家会诊，正对应这里的 context-compression / memory-systems / multi-agent-patterns；四类退化清单可用于诊断长对话跑偏。
