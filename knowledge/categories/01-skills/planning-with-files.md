---
type: skill
name: Planning with Files 文件级规划
summary: Manus 风格的持久化 Markdown 规划——context 是易失 RAM，filesystem 是持久 Disk；task_plan/findings/progress 三文件 + Hook 强制执行，让计划在 /clear 后存活。
useCase: 当需要多步骤/多会话项目推进、防止上下文腐烂、会话中断恢复时
stack: [markdown]
tags: [规划, 文件系统, hook, 持久化, 上下文, 项目推进]
status: active
updated: 2026-08-24
repoUrl: https://github.com/OthmanAdi/planning-with-files
---

# Planning with Files 文件级规划（skill）

## 核心原则
> **Context Window = RAM（易失、有限）；Filesystem = Disk（持久、无限）→ 任何重要的东西都写入磁盘。**

Manus 三原则：文件系统即记忆（状态存文件而非上下文）、注意力操控（每次决策前重读计划）、错误持久化（失败记录进计划避免重复犯错）、目标追踪（复选框展示进度）。

## 三文件结构（落盘形态）
- **task_plan.md** — 阶段 + 复选框；/clear 之后的恢复点（"要去哪"）
- **findings.md** — 研究笔记与决策，随做随追加（"学到了什么"）
- **progress.md** — 会话日志与测试结果（"走到哪了"）

并行任务隔离到 `.planning/YYYY-MM-DD-slug/`，用 `.active_plan` 指针激活。

## 6 步操作流程（Hook 强制）
1. 任务需 3+ 步骤或 5+ 工具调用？→ 先创建三个文件
2. 学到新东西？→ 追加 findings.md
3. 做了某件事？→ 记录 progress.md
4. 完成某阶段？→ task_plan.md 勾选
5. 上下文死亡（/clear/崩溃）？→ 会话捕获重读三文件
6. 所有阶段完成？→ 才释放 Stop 门（gated 模式）

## 关键规则
1. **先建计划**——绝不在没有 task_plan.md 时开始工作
2. **2 动作规则**——每 2 次查看/浏览器操作后必须保存发现到 findings.md
3. **记录所有错误**——避免重复犯错
4. **绝不重复失败**——记录尝试过程，变更方法

## 会话恢复
/clear 后检查会话存储 → 找规划文件最后更新时间 → 提取丢失对话 → 显示 catchup 报告。实测：有规划新会话恢复平均 5.0 回合，无规划裸代理需 13.3 回合。

## 增强特性
- **自治模式**（--autonomous）：去掉每次工具调用的计划复述
- **门控模式**（--gated）：Stop 完成门——所有完成条件满足才放行
- **计划认证**（/plan-attest）：SHA-256 锁定 task_plan.md，篡改即拒注入
- **结构感知注入**：长计划后期只保留当前阶段、阶段计数、最近 3 个决策

## 与本项目的关系
工作流的 4 阶段（协同/完善/搭建/交付）推进、以及 deliver 的多阶段工程交付，都可套用"目标文件 + 进度文件 + 知识文件"的持久化模式。
