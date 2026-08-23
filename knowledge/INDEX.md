---
kind: knowledge-index
updated: 2026-08-22
---
# 知识库 · 机器索引（INDEX）

> **机器读取入口**。约定：每条目 `categories/*` 下的 markdown 用统一 frontmatter，索引据此汇总。
> 消费方（流程 / agent）应读取全部条目 frontmatter 的：
> `type / name / summary / useCase / stack / related / tags / status / updated`。
> 更新规则见 [[_meta/ORGANIZATION#四、新增条目落位规则]]。

## 统计

- skill: 31
- service: 7
- repository: 7
- prompt: 1
- pattern: 0
- design: 0
- reference: 1

<details><summary>按 type 的完整清单（新增时同步更新下面的表格）</summary>

### skill（01-skills）
| 条目 | 作用 | 适用场景 | 状态 |
| --- | --- | --- | --- |
| [[brandkit]] | Premium 品牌视觉生成（规范板/Logo/视觉世界演示） | 快速出品牌级视觉、定设计系统基调 | active |
| [[brand-design-md]] | 按品牌名拉取 getdesign.md 官方规范并生成匹配 UI | 品牌在 62 个支持清单内、想套官方规范 | active |
| [[1688-sourcing-inquiry]] | 把模糊采购需求转结构化询盘，平台匹配供应商 | 1688 批发找货源/比价/询盘 | active |
| [[web-scraper]] | 抓取 URL 网页的文本/标题/链接/图片 | 数据采集、竞品调研、语料整理 | active |
| [[code-quality-checker]] | 规范/安全/性能/覆盖率/依赖/复杂度多维体检 | 发布前或 CI 前的质量闸门 | active |
| [[full-output-enforcement]] | 强制完整输出、禁占位符、干净处理 token 拆分 | 长文档/大 JSON 防截断防偷懒占位 | active |
| [[find-skills]] | 搜索并安装可用的 Agent Skills | 想扩展能力但不知装哪个 skill | active |
| [[setup-matt-pocock-skills]] | 配置 AGENTS.md/CLAUDE.md 的 skills 块与 docs/agents 及 issue 追踪 | 初始化 agent 交接工程 | active |
| [[design-kungfu]] | 从 130+ 风格智能匹配方案 + 完整设计系统 + shadcn 指南 | 起步不晓得选什么风格/设计系统 | active |
| [[design-taste-frontend]] | Anti-slop 设计：读 brief 推断方向、重设先审计 | 落地页要反模板有辨识度（v2） | active |
| [[design-taste-frontend-v1]] | v1 原版兼容实现 | 仅旧项目沿用，新项目一律 v2 | frozen |
| [[high-end-visual-design]] | 字体/间距/阴影/卡片/动画"显得贵"标准 | 要贵感非模板、规避廉价 AI 风 | active |
| [[gpt-taste]] | Elite UX/UI + GSAP：随机布局/AIDA/严格滚动动效 | 要高级感 + 打磨过的动效 | active |
| [[stitch-design-taste]] | 输出反通用 premium 的 DESIGN.md | 定有设计主张的设计系统规范 | active |
| [[ui-ux-pro-max]] | 本地可搜：84 风格/192 配色/74 字体/22 技术栈 | 快速检索风格/配色/字体锚定方向 | active |
| [[industrial-brutalist-ui]] | 瑞士排版 + 军事终端美学的硬核 UI | 野兽派/硬核仪表盘/终端风 | active |
| [[minimalist-ui]] | 暖色单色调 + bento 网格、无渐变无重阴影 | 极简编辑感、bento、内容站 | active |
| [[redesign-existing-projects]] | 审计并识别 slop，不破坏功能地提升到高端 | 存量站点去 slop 化、视觉升级 | active |
| [[imagegen-frontend-web]] | 为每个 section 生成横向参考图统一调性 | 落地页/营销站出图定版面（仅出图） | active |
| [[imagegen-frontend-mobile]] | 高质量移动端屏幕概念与流程（仅出图） | 移动端视觉提案/评审 | active |
| [[image-to-code]] | 深度分析设计图后高还原实现 | 图纸到落地页的闭环 | active |
| [[shopify-section-html-to-library]] | 静态 HTML 转 Liquid 区块库 + 画布预览 | Shopify 主题开发沉淀区块 | active |
| [[pdf]] | PDF 读建/合并加密/表单/表格提取（Anthropic 官方） | 合同/报告/批量 PDF，真实处理 | active |
| [[docx]] | Word 创建/编辑/分析，真实格式输出（Anthropic 官方） | 自动化 docx 生成与结构化提取 | active |
| [[xlsx]] | Excel 建/编辑/分析，公式/格式化/透视（Anthropic 官方） | 报表/清洗/带公式表格 | active |
| [[pptx]] | PPT 创建/编辑/分析（Anthropic 官方） | 自动生成/套模板更新演示 | active |
| [[firecrawl]] | CLI 抓取/爬取/搜索/站点地图，自带反爬提取 | 健壮抓取、站内搜索、站点映射 | active |
| [[webapp-testing]] | Playwright 驱动本地 Web 应用验证/截图/日志（官方） | 本地前端 E2E / 冒烟回归 | active |
| [[test-driven-development]] | RED-GREEN-REFACTOR 测试驱动工作流 | 新特性测试先行、防回归 | active |
| [[systematic-debugging]] | 复现/隔离/识别/验证的四阶段根因调试 | 复杂 Bug 定位 | active |
| [[skill-creator]] | 创建/迭代 SKILL.md，跑评估对比基线（官方元技能） | 自研技能并验证质量 | active |

### service（02-services）
| 条目 | 作用 | 适用场景 | 状态 |
| --- | --- | --- | --- |
| [[supabase]] | 托管 Postgres + Auth + 实时 + 存储 一体化后端 | 全栈项目要 DB/鉴权/存储、少自建时 | active |
| [[openai]] | GPT/o1 系列模型 API：文本/代码/推理 | 要高质量 API 模型能力时 | active |
| [[anthropic-claude]] | Claude 推理/长上下文/代码生成 + Agent Skills 生态 | 强推理、长上下文、配合官方技能 | active |
| [[deepseek]] | 中文友好、高并发、成本低的 DeepSeek-V4 API | 中文/成本敏感/高并发场景 | active |
| [[openrouter]] | 多模型聚合 API，统一对比与路由 | 评估/切换多个模型时 | active |
| [[neon]] | Serverless Postgres：按量、分支、冷启动缩零 | 免运维 Postgres、原型/SaaS | active |
| [[vercel]] | Next.js Git 部署：CDN + Serverless Functions + 预览 | 部署生成的前端/Next 产物上线 | active |

### repository（03-repositories）
| 条目 | 作用 | 适用场景 | 状态 |
| --- | --- | --- | --- |
| [[shadcn-ui]] | 可复制、风格统一的 React 组件库（Radix+Tailwind） | React 项目要克制、可深度定制的组件底座 | active |
| [[react-bits]] | 110+ 动画化交互 React 组件，创意 UI/背景动画 | 落地页"拿来即用"的吸睛动效组件 | active |
| [[magicui]] | 150+ 动画组件与动效，复制粘贴集成 | 营销页要流光/渐变/动画网格 | active |
| [[motion]] | 开源动画引擎（原 Framer）：手势/滚动/布局过渡 | 页面过渡、滚动动效、手势交互 | active |
| [[aceternity]] | 面向 Landing 的区块组件：Hero/Bento/Parallax | 快速组版 SaaS 官网/营销落地页 | active |
| [[create-t3-app]] | 类型安全全栈 Next.js 样板（T3 Stack CLI） | 全栈底座参考/脚手架对标 | active |
| [[uiverse]] | 最大开源 UI 元素库：7K+ 组件，多格式复制 | 现成微组件作生成参考来源 | active |

### prompt（04-prompts）
| 条目 | 作用 | 适用场景 | 状态 |
| --- | --- | --- | --- |
| [[one-shot-to-prd]] | 把一句产品想法扩写成完整产品构想 + PRD 依据（愿景/用户/功能/市场契合） | 用户输入极简短、需要 AI 依据市场主流补全产品叙事时 | active |

### reference（07-references）
| 条目 | 作用 | 适用场景 | 状态 |
| --- | --- | --- | --- |
| [[uiverse-methodology]] | Uiverse 组件展示交互方法论（画廊实时预览+多格式复制+详情说明） | 借鉴组件展示/预览交互体验时对口范本 | active |

</details>