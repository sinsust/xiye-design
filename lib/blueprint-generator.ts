// 蓝图生成器：把骨架工作台的「选择组合」导出为一份 LLM 高保真蓝图。
// 目标：把这份 PROJECT_BLUEPRINT.md 丢给编程工具（Claude/Cursor/Codex…）时，
// 可用性还原度最高——统一规范先行、代码完整落地、动效明确，避免颜色硬编码/风格漂移。

import { SKELETON_PAGES } from "@/data/skeletons";
import type { VisualStyle } from "@/data/visual-styles";
import { FONT_STACK } from "@/data/visual-styles";
import { styleToCss } from "@/data/visual-styles";
import { resolveContent, deepMerge, collectPlaceholders, type ContentOverride } from "@/lib/content-resolver";
import { DEMO_CONTENT, CONTENT_PLACEHOLDER_DOCS } from "@/data/skeleton-content";
import type { ComponentMotion } from "@/lib/skeleton-store";
import { findKit } from "@/data/uiverse-kit";

/** 蓝图内容：每个页面收集到的区块（含选中变体与代码） */
export interface BlueprintBlock {
  pageName: string;
  componentName: string;
  variant: { id: string; name: string; code: string; motionId?: string };
  /** 生效动效（含按板块微调参数）：override 优先，否则跟随变体 motionId */
  motion?: { id: string; params?: { distance?: number; duration?: number } } | null;
}

export interface BlueprintResult {
  blocks: BlueprintBlock[];
  markdown: string;
  /** 统计：页面数 / 区块数 / 带动效数 */
  stats: { pages: number; blocks: number; withMotion: number };
}

const PLACEHOLDER_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * 把 JSX 文本位置的占位符（{{path}}）改写为对内容数据模块的引用（{content.path}）。
 * 真实项目里文案统一由 site-content.ts 提供 → 改一处全站同步，杜绝在组件里内联硬编码文案。
 */
function toContentRefs(code: string): string {
  return code.replace(PLACEHOLDER_RE, (_m, path: string) => `{content.${path}}`);
}

/** 生成 site-content.ts：把「demo 默认 + AI/真实覆盖」解析后的完整内容序列化为数据模块 */
function buildSiteContentModule(content?: ContentOverride): string {
  const resolved = deepMerge(DEMO_CONTENT, content);
  const serialized = JSON.stringify(resolved, null, 2)
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return `// site-content.ts · 全站文案单一事实源\n// 由 AI 根据产品 PRD/特征生成（来源：一键文案）。改这里即可全站同步，无需逐组件改动。\nexport const content = ${serialized};`;
}

function resolveVariantId(
  pageId: string,
  componentId: string,
  variants: { id: string }[],
  picks: Record<string, string> | undefined,
): string {
  if (picks && picks[componentId] && variants.some((v) => v.id === picks[componentId])) {
    return picks[componentId];
  }
  return variants[0]?.id ?? "";
}

export function buildBlueprint(
  picks: Record<string, Record<string, string>>,
  style: VisualStyle,
  projectName: string,
  content?: ContentOverride,
  componentMotion?: Record<string, ComponentMotion>,
  componentOverride?: Record<string, string>,
  prdMarkdown?: string,
  architectureMarkdown?: string,
  techStackLine?: string,
): BlueprintResult {
  const p = style.palette;
  const blocks: BlueprintBlock[] = [];
  let withMotion = 0;
  let pages = 0;

  // 生效动效：按板块 override 优先；「无动效」→ 不绑定；否则跟随变体自带 motionId
  const resolveMotion = (
    pageId: string,
    componentId: string,
    variant: { motionId?: string },
  ): { id: string; params?: { distance?: number; duration?: number } } | null => {
    const ov = componentMotion?.[`${pageId}:${componentId}`];
    if (ov) return ov.motionId === "motion-none" ? null : { id: ov.motionId, params: ov.params };
    return variant.motionId ? { id: variant.motionId } : null;
  };

  for (const page of SKELETON_PAGES) {
    const pagePicks = picks[page.id];
    const pageBlocks: BlueprintBlock[] = [];
    for (const comp of page.components) {
      if (comp.variants.length === 0) continue; // 占位组件不导出
      // 只导出用户已选择的组件
      if (!pagePicks || !pagePicks[comp.id]) continue;
      const vid = pagePicks[comp.id];
      const v = comp.variants.find((x) => x.id === vid) ?? comp.variants[0];
      const motion = resolveMotion(page.id, comp.id, v);
      // 就地换件：该区块被换成内置 Uiverse 精选件时，导出其代码，保留区块动效
      const kit = componentOverride?.[`${page.id}:${comp.id}`] ? findKit(componentOverride[`${page.id}:${comp.id}`]) : null;
      const outVariant = kit
        ? { id: kit.id, name: kit.name, code: kit.code, motionId: motion?.id }
        : v;
      pageBlocks.push({
        pageName: page.name,
        componentName: kit ? comp.name + "（" + kit.name + "）" : comp.name,
        variant: { id: outVariant.id, name: outVariant.name, code: outVariant.code, motionId: motion?.id },
        motion,
      });
      if (motion) withMotion++;
    }
    if (pageBlocks.length > 0) {
      pages++;
      blocks.push(...pageBlocks);
    }
  }

  // ── 组装 Markdown ──
  // ── 动效实现指引（含按板块微调参数）──
  // 预览 motionId → 落地实现说明。`{d}`=位移幅度、`{t}`=时长，由微调参数填充。
  const MOTION_IMPL: Record<string, string> = {
    "fade-up": "淡入上滑：GSAP fromTo `y:{d}→0`、`opacity:0→1`（power3.out，`{t}s`）；需视口触发则加 ScrollTrigger `start: \"top 90%\"`",
    "text-rise": "整体上浮入场：GSAP fromTo `y:{d}→0`、`opacity:0→1`（power3.out，`{t}s`）",
    "reveal-on-scroll": "滚入上滑：ScrollTrigger 进入视口时 fromTo `y:{d}→0`、`opacity:0→1`（power2.out，`{t}s`，只播一次）",
    "hover-lift": "上浮呼吸：整块 `translateY(-{d}px)` 上下浮动，`{t}s` 一个周期，`yoyo` 无限循环（常驻微动，尊重 prefers-reduced-motion）",
    "scroll-clip": "裁剪揭示：图片/容器 `clip-path: inset(0 0 100% 0)→0%`，滚动触发",
    "scroll-circle": "圆形揭示：`clip-path: circle(0%)→circle(75%)` 自中心扩散，滚动触发",
    "scroll-horizontal": "横向滚动：区块吸顶 + `translateX` 随滚动 scrub",
    "sticky-stack": "吸顶堆叠：多卡片依次 `position:sticky` 钉顶，前卡被推时缩小让位",
    "zentry-image": "图片钉住叙事：图片 clip 揭幕 + `pin` + `scrub`",
    "spring": "弹性缩放：`scale:0.9→1` + elastic 缓动（`{t}s`）入场",
    "spring-bounce": "回弹入场：`translateY(-32px)→0` + back out 缓动（`{t}s`）",
    "spring-elastic": "橡皮筋：`scale:0.6→1` + elastic 缓动（`{t}s`）",
    "wobble": "摆动入场：小幅左右摇摆后落定（仅 transform:rotate）",
    "text-rotate": "旋转浮现：`rotateX`/`translateY` 淡入归位（`{t}s`）",
    "text-mask-reveal": "文字遮罩：`clip-path: inset(0 0 100%→0)` + 透明淡入（`{t}s`）",
    "data-count": "数据滚动：数字 CountUp 计数，或容器缩放入场示意（`{t}s`）",
    "data-marquee": "循环跑马灯：双份列表 + `translateX` 无限循环 + 两端淡出遮罩",
    "scroll-scrub": "滚动联动：位移 `x:-60→60` 绑定滚动进度（scrub）",
    "parallax-hero": "视差纵深：前后景 `translateY` 不同速度（scrub）",
    "parallax-layers": "多层视差：多层 `translateY` 速度差叠加（scrub）",
    "page-transition": "页间转场：`translateX(28px)→0` 淡入切入（`{t}s`）",
    "motion-path": "路径位移：沿简单路径 `x/y` 滑移",
    "text-chars": "逐字揭幕：SplitText 拆字 + masked 上滑（stagger）",
    "text-words": "逐词揭幕：SplitText 拆词 + masked 上滑（stagger）",
  };
  const DEF: Record<string, { d?: number; t?: number }> = {
    "fade-up": { d: 24, t: 1.4 }, "text-rise": { d: 24, t: 1.8 }, "reveal-on-scroll": { d: 36, t: 0.8 },
    "hover-lift": { d: 8, t: 1.6 }, spring: { t: 1.2 }, "spring-bounce": { t: 1.6 }, "spring-elastic": { t: 1.8 },
    "text-rotate": { t: 2 }, "text-mask-reveal": { t: 1.8 }, "data-count": { t: 2 }, "page-transition": { t: 2.4 },
  };

  const fmtParams = (m: { params?: { distance?: number; duration?: number } }) => {
    const bits: string[] = [];
    if (m.params?.distance != null) bits.push(`幅度 ${m.params.distance}px`);
    if (m.params?.duration != null) bits.push(`时长 ${m.params.duration}s`);
    return bits.length ? `（${bits.join(" · ")}）` : "";
  };

  const fillMotion = (m: { id: string; params?: { distance?: number; duration?: number } }) => {
    const def = DEF[m.id] ?? {};
    const d = m.params?.distance ?? def.d ?? "…";
    const t = m.params?.duration ?? def.t ?? "…";
    const tpl = MOTION_IMPL[m.id] ?? "按既有动效库实现（仅动 transform/opacity，尊重 prefers-reduced-motion）";
    return tpl.replaceAll("{d}", String(d)).replaceAll("{t}", String(t));
  };

  const motionLines = blocks
    .filter((b) => b.motion)
    .map((b) => `- ${b.pageName} · ${b.componentName}（${b.variant.name}）→ 动效 \`${b.motion!.id}\`${fmtParams(b.motion!)}`)
    .join("\n");

  // 每个区块的落地实现指引（含你的微调数值）
  const motionDetailLines = blocks
    .filter((b) => b.motion)
    .map((b) => `- **${b.pageName} · ${b.componentName}**（${b.variant.name}）：${fillMotion(b.motion!)}`)
    .join("\n");

  const pageSections = SKELETON_PAGES.map((page) => {
    const pagePicks = picks[page.id];
    const list = page.components
      .filter((c) => c.variants.length > 0)
      .map((c) => {
        const vid = resolveVariantId(page.id, c.id, c.variants, pagePicks);
        const v = c.variants.find((x) => x.id === vid) ?? c.variants[0];
        const kit = componentOverride?.[`${page.id}:${c.id}`] ? findKit(componentOverride[`${page.id}:${c.id}`]) : null;
        return kit
          ? `- **${c.name}** · 就地换成 ${kit.name}（\`${kit.id}\`，来源 ${kit.source}）`
          : `- **${c.name}** · ${v.name}（\`${v.id}\`）`;
      })
      .join("\n");
    return `### ${page.name}\n${list}`;
  }).join("\n\n");

  const codeSections = blocks
    .map((b, i) => {
      const motion = b.motion ? ` · 动效 \`${b.motion.id}\`${fmtParams(b.motion)}` : "";
      // 真实项目：组件读取 site-content.ts 的 content，文案改一处全站同步，不内联硬编码
      const body = `import { content } from "./site-content";\n\n${toContentRefs(b.variant.code)}`;
      return `### ${i + 1}. ${b.pageName} / ${b.componentName}（${b.variant.name}）${motion}\n\n\`\`\`tsx\n${body}\n\`\`\``;
    })
    .join("\n\n");

  // 内容映射表：本组合用到的占位符 → 当前内容值（demo 或真实覆盖），供编程工具一次替换。
  const usedPlaceholders = [...new Set(blocks.flatMap((b) => collectPlaceholders(b.variant.code)))];
  const contentTable = usedPlaceholders.length
    ? CONTENT_PLACEHOLDER_DOCS.filter((d) => usedPlaceholders.includes(d.key))
        .map((d) => `| \`${d.key}\` | ${d.meaning} | ${resolveContent(d.key, content)} |`)
        .join("\n")
    : "- 本组合未使用占位符文案（均为变体专属示例内容）。";

  // ── PRD / 架构章节（若外部已生成则内联全文，否则提示去流程工作台补全）──
  const demote = (md: string) => md.replace(/^(#+)/gm, (h) => "#" + h);
  const prdSection = prdMarkdown
    ? `## 产品需求文档（PRD）\n\n> AI 落地前先通读，明确目标用户 / 核心功能 / 范围边界。\n\n${demote(prdMarkdown)}`
    : `## 产品需求文档（PRD）\n\n- 本蓝图未附带 PRD：请先在流程工作台完成「AI 一句话」或「探索式访谈」生成产品叙事，再导出蓝图。`;
  const archSection = architectureMarkdown
    ? `## 工程架构（ARCHITECTURE）\n\n> 目录结构 / 分层 / 数据流照此落地，不得改成扁平实现。\n\n${demote(architectureMarkdown)}`
    : `## 工程架构（ARCHITECTURE）\n\n- 本蓝图未附带架构：请在流程工作台选择技术栈后导出，或参考 docs/ARCHITECTURE.md。`;

  const markdown = `# ${projectName} · 页面蓝图（PROJECT BLUEPRINT）

> 由 xiye 骨架工作台自动生成 · ${new Date().toLocaleString("zh-CN", { hour12: false })}
> 视觉风格：**${style.name}** · 来源：${style.sourceSkill}${style.libraryId ? ` · 关联库：${style.libraryId}` : ""}

---

## 0. 给编程工具的统一规范指令（最重要，先读）

建议按「规范 → 产品需求(PRD) → 工程架构 → 视觉规范 → 区块代码」顺序通读后再落地。

请严格遵循以下规范实现本蓝图，保证还原度与一致性：

1. **技术栈**：前端 React + TypeScript + Tailwind CSS（或项目既定 CSS 方案）${techStackLine ? `；后端/数据：${techStackLine}` : ""}。
2. **设计 Token**：必须使用下方「1. 视觉设计规范」定义的 CSS 变量（\`--background\`、\`--surface\`、\`--primary\` 等）。**禁止硬编码任何颜色、字体、圆角数值**——一律引用变量或既有 token。
3. **区块实现**：每个区块按「3. 区块完整代码」实现，结构与样式不得偏离；**必须先创建 \`site-content.ts\`，所有区块已 \`import { content }\` 读取真实文案**；示例图片等可替换为真实内容。
4. **组装顺序**：按「2. 页面区块组装清单」的顺序自上而下组装页面；区块间保持一致的垂直间距（与 token 的 spacing 一致）。
5. **组件一致性**：同一种组件在不同页面出现时，样式必须一致（复用同一套变体），不要各写各的。
6. **动效**：按「4. 动效规范」实现；所有动效不得影响可读性与可用性，尊重 prefers-reduced-motion。
7. **响应式**：桌面优先，移动端需正常可用（区块在窄屏下单列堆叠）。
8. **反 AI 味（Anti-Slop）**：可见文案禁止 em-dash（—/–），一律用句号/逗号/括号/连字符；禁止纯黑 \`#000\` 与纯白 \`#fff\` 直出（用 off-black / off-white）；全页单一 accent 色、单一圆角体系；CTA 文字与底色满足 WCAG AA（≥4.5:1）；全高区块用 \`min-h-[100dvh]\` 而非 \`h-screen\`；动效只动 transform/opacity；入场动效只播一次（跑马灯/常驻微动除外）；尊重 prefers-reduced-motion。

---

${prdSection}

${archSection}

## 1. 视觉设计规范（Design Tokens）

| Token | 值 | 用途 |
| --- | --- | --- |
| \`--background\` | \`${p.bg}\` | 页面背景 |
| \`--surface\` | \`${p.surface}\` | 卡片/面板 |
| \`--border\` | \`${p.border}\` | 描边/分隔 |
| \`--foreground\` | \`${p.text}\` | 主文本 |
| \`--muted-foreground\` | \`${p.muted}\` | 次级文本 |
| \`--primary\` | \`${p.accent}\` | 主色/行动 |
| \`--secondary\` | \`${p.accent2}\` | 强调/辅助 |
| \`--radius\` | \`${style.radius}px\` | 圆角基准 |
| 字体 | \`${FONT_STACK[style.font]}\` | 全站字体 |

\`\`\`css
${styleToCss(style)}
\`\`\`

> 规则：所有组件圆角用 \`--radius\`（或派生值），所有主行动按钮用 \`--primary\` 底 + 白色文字，次行动用描边。

---

## 1.5 内容数据模块（先创建 site-content.ts）

所有区块已改为读取 \`{content.xxx}\`，**不在组件里内联任何文案**。先把下方内容保存为 \`site-content.ts\`；全站文案的统一单一事实源就在这里——改它即全站同步，无需逐组件改动：

\`\`\`ts
${buildSiteContentModule(content)}
\`\`\`

---

## 2. 页面区块组装清单

${pageSections}

---

## 3. 区块完整代码（${blocks.length} 个，按顺序落地）

${codeSections}

---

## 4. 动效规范

${motionLines || "- 本组合未绑定动效。"}

各区块动效实现（含工作台内微调数值，直接照做即可）：

${motionDetailLines || "- 无。"}

通用提示：
- \`hover-lift\` / 常驻微动：尊重 \`prefers-reduced-motion\`，必要时禁用。
- 所有动效只动 \`transform\` / \`opacity\`，无 \`window scroll\` 监听（用 ScrollTrigger / IntersectionObserver）。
- 入场动效只播一次（跑马灯 / 常驻微动除外）。

---

## 5. 内容映射表

下列占位符已在「3. 区块完整代码」中改写为 \`content.*\`。它们与「1.5 内容数据模块」的 \`site-content.ts\` 一一对应——改 \`site-content.ts\` 里的字段即全站同步，无需逐组件改动。当前内容值如下：

| 占位符 | 含义 | 当前内容 |
| --- | --- | --- |
${contentTable}

---

## 6. 交付前 Pre-Flight 自检（实现方必过，任何一项不过即未完成）

- [ ] 零 em-dash（—/–）：所有可见文案（标题/正文/按钮/alt）无该字符
- [ ] 无纯黑 \`#000\` / 纯白 \`#fff\` 直出，用 off-black / off-white
- [ ] 全页单一 accent 色，无跨 section 漂移（暖灰页面不突然出现蓝 CTA）
- [ ] 单一圆角体系（全直角 / 全柔和 / 全胶囊），无混用
- [ ] 所有 CTA 文字对比度 WCAG AA（≥4.5:1），无白字白底、透明按钮无描边
- [ ] CTA 文案桌面端单行不换行；全页同一意图只用一个 CTA 文案
- [ ] Hero：标题 ≤2 行、副文案 ≤20 词且 ≤4 行、CTA 首屏可见、顶部 padding ≤ pt-24
- [ ] 导航桌面端单行、高度 ≤80px
- [ ] 移动端 <768px 全部单列塌陷（w-full px-4），无横向溢出
- [ ] 动效只用 transform/opacity，无 window scroll 监听（用 ScrollTrigger / IO）
- [ ] 入场动效尊重 prefers-reduced-motion（动效强度 >3 必做）
- [ ] 空 / 加载 / 错误三态齐备（表单、列表、图表容器）
- [ ] 无 div 拼凑的假截图 / 假终端 / 假仪表盘
- [ ] 引文 ≤3 行、署名含姓名+角色；跑马灯每页最多 1 个

---

_由 xiye 骨架工作台生成。若编程工具支持，可直接将本文件整体作为上下文。_
`;

  return { blocks, markdown, stats: { pages, blocks: blocks.length, withMotion } };
}
