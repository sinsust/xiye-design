---
type: skill
name: UI/UX Pro Max 设计系统生成
summary: 需求分析→多域检索→推理引擎→设计系统输出→预交付检查的五步闭环，让 AI 产出专业级 UI 代码；含 192 类产品规则、50 种激活风格、192 套配色、74 组字体配对。
useCase: 当需要从自然语言需求生成完整设计系统、或审查既有界面的专业性时
stack: [react, vue, svelte, tailwind]
tags: [ui, ux, 设计系统, 反模式, 预交付检查, 配色, 字体]
status: active
updated: 2026-08-24
repoUrl: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
---

# UI/UX Pro Max 设计系统（skill）

## 作用
把"Build a landing page"这类需求，通过**需求分析 → 多域检索 → 推理引擎 → 设计系统输出 → 预交付检查**五步闭环，产出专业级界面。本质是给 AI 一把"按行业差异化出设计系统"的尺子，避免通用模板感。

## 五步闭环
1. **用户请求** — 自然语言描述 UI/UX 任务（build/design/implement/review/fix）
2. **设计系统生成** — 推理引擎自动产出完整设计系统
3. **智能推荐** — 按产品类型匹配最佳风格/配色/字体组合
4. **代码生成** — 按设计系统落地，用正确的颜色/字体/间距与最佳实践
5. **预交付检查** — 对照反模式清单逐项校验

## 推理引擎（4 层流水线）
- **多域并行搜索**：产品类型（192 类）→ 风格（50 激活）→ 配色（192 套）→ 落地页模式（34 种）→ 字体配对（74 组）
- **推理规则**：产品→UI 类别规则匹配；BM25 排序风格优先级；按行业过滤反模式
- **完整输出**：模式 + 风格 + 配色 + 字体 + 关键效果 + 需避免的反模式 + 预交付清单
- **持久化（可选）**：写 `design-system/MASTER.md`（全局真值）+ `pages/[page].md`（页面覆盖）

## 行业差异化规则（示例）
- **金融/银行类**：明确禁止 AI 紫/粉渐变
- **SaaS**：落地页用 Hero-Centric + Social Proof 模式
- 每个产品类型有专属的：推荐结构、风格优先级、配色情绪、字体性格、反模式清单

## 输出规范（8 区块）
PATTERN（落地页结构+CTA 位置）→ STYLE（风格关键词+成本+无障碍风险）→ COLORS（Primary/Secondary/CTA/BG/Text 五色）→ TYPOGRAPHY（字体组合+情绪）→ KEY EFFECTS（阴影/过渡/悬停）→ AVOID（反模式）→ PRE-DELIVERY CHECKLIST（8 项）→ 持久化。

## 预交付检查（8 项硬性）
- 禁 emoji 当图标（用 SVG: Heroicons/Lucide）
- 所有可点击元素 cursor-pointer
- 亮色模式文本对比度 ≥ 4.5:1
- 键盘导航焦点态可见
- 尊重 prefers-reduced-motion
- 文本/芯片/徽章不裁剪地重排（窄宽/缩放/间距覆盖）
- 响应式断点 375/768/1024/1440px
- 交互时序遵循平台与用户偏好

## 反模式（禁止）
亮霓虹色、生硬动画、金融类禁 AI 紫粉渐变、emoji 当图标、依赖标题平衡换行保证特定词在末行、文本裁剪、紧凑标签无完整值访问路径、徽章仅用颜色传义、忽略 reduced-motion。

## 要点
- 弹性文本是渐进增强而非保证：设计必须兼容自然换行
- 版本感知搜索：区分 Svelte 4 / Next.js 15 等新旧版本
- 分层检索：建页面先查 pages/[page].md，存在则覆盖 MASTER，否则仅用 MASTER
