# 知识库 · 组织规则（Obsidian Vault）

> 本文档定义知识库的 **定位、分类、新增落位规则**。Obsidian 打开本目录（仓库根下的 `knowledge/` 文件夹）即视为一个 vault。

---

## 一、知识库是做什么的

一句话：**`knowledge/` 是「一句话生成底座」的可积累资产层**——把你日常会用到的 skill、服务、GitHub 仓库、提示词、架构模式、设计规范，沉淀成**可在流程中被检索、可被 AI 引用**的结构化条目。

它和 `data/*.ts` 里硬编码目录（skill-catalog / service-providers / tech-stacks…）的**本质区别**：

| 维度 | `data/*.ts` 选定配置 | `knowledge/` 知识库 |
| --- | --- | --- |
| 内容来源 | 写死在代码里，改需改源码 | **由你人为持续增补**，随时加 |
| 更新 | 发版 | 新增一条 markdown 即生效 |
| 粒度 | 每个都是"要用的一个" | 宽泛采集，可横向对比 |
| 消费方 | 流程固定读取 | 人查 + 流程可扫描引用 |

两者是"**精选配置** 与 **素材库**"的关系：知识库里的条目，被你看中/选中后，可再沉淀进 `data/*` 成为流程的默认配置。

## 二、它服务谁

1. **你日常使用**：想问"这个仓库/技能/提示词是干嘛的？什么时候用？有没有替代？" → 查 `_MOC.md` 或按分类进，靠 **摘要 + 适用场景** 秒命中，而不是翻源码。
2. **整体流程引用**：AI 一句话 / 选型 / 生成时，可扫描 `knowledge/` 的 frontmatter 索引，把**你的私有资产**（自研 skill、私有 repo、定制 prompt、已接好的 service）作为候选注入建议，而不只是官方内置目录。桥接协议见 `_meta/BRIDGE.md`。

## 三、分类体系（既是文件夹，也是 type / 标签）

| type | 文件夹 | 装什么 | 每条必填 |
| --- | --- | --- | --- |
| `skill` | `categories/01-skills` | 可复用能力：脚本 / 工作流 / 代理指令 / 集成技能 / 一键命令 | summary + useCase + 依赖 |
| `service` | `categories/02-services` | 外部服务与 API：LLM / 数据库 / 支付 / 邮件 / 存储 / 向量… | website + freeTier + configSteps + security |
| `repository` | `categories/03-repositories` | GitHub 等代码仓库：拿来即用 / 参考实现 / 组件库 | repoUrl + 技术栈 + 何时用 + 替代 + 示例 |
| `prompt` | `categories/04-prompts` | 可复用提示词配方：生成 / 改写 / 提炼 / 打分 | 目标 + 输入变量 + 示例 + 最佳实践 |
| `pattern` | `categories/05-patterns` | 架构范式、设计模式、反模式 | 适用场景 + 权衡 + 落地 |
| `design` | `categories/06-design` | 视觉 / UX / 设计系统参考 | 风格 + 可用 token + 适用于 |
| `reference` | `categories/07-references` | 官方文档 / 教程 / 对比沉淀 | 来源 + 内容 + 何时看 |

> 一个条目只能归一类（type 唯一，便于索引）；但可以挂多个 `tags` 和双链，横向检索靠标签与链接。

## 四、新增条目落位规则（每次新增都走这套，保证"放对地方"）

1. **判 type** → 放入对应 `categories/0X-*`。
2. **复制模板** `_templates/<type>.md` 到该分类下，文件名用 kebab-case id（如 `openai-gpt4o.md`）。
3. **填 frontmatter**：`type / name / summary / useCase / stack / related / tags / updated`。
4. **正文按模板章节**，务必写清：
   - **作用（summary）**：它到底是干嘛的，一至两句话。
   - **适用场景（useCase）**：什么时候该用它、什么时候**不要**用它、有没有替代方案。
5. **回填索引**：在 `INDEX.md` 对应 type 表格加一行；值得陈列的同步到 `_MOC.md`。
6. **打通双链**：用 `[[条目]]` 关联相关条目和本分类的 MOC。
7. 日期用 `YYYY-MM-DD`，`updated` 每次改动都更新。

## 五、质量红线

- **不做"仓库名堆积"**：宁可少，每条都要有**经得起查的摘要 + 明确适用场景 + 一句话用法**。
- **不写死印象**：选用/接入信息标清"是否已验证"（`status: active | trial | frozen`），没验证过的别当已接入。
- **可治理**：定期（或用脚本）抽查 `INDEX` 与 `categories` 是否一致。

## 六、目录地图

```
knowledge/
  _MOC.md                 # 人类导航首页
  INDEX.md                # 机器可读索引（frontmatter 契约汇总）
  _meta/
    ORGANIZATION.md       # 本文件：定位 / 分类 / 新增规则
    BRIDGE.md             # 与 xiye 流程的桥接协议
  _templates/             # 各 type 的新建模板
  categories/
    01-skills/
    02-services/
    03-repositories/
    04-prompts/
    05-patterns/
    06-design/
    07-references/
```