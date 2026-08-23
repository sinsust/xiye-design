// 组件库目录 · 数据入口。
// 每个条目是一个「特效/区块组件」，自带可编辑设置（settings）与渲染描述。
// 页面 app/components 据此生成：侧边栏列表 + 画布预览 + 设置面板。

export interface SelectOption {
  label: string;
  value: string;
}

export type SettingKind =
  | "text"
  | "number"
  | "range"
  | "color"
  | "palette"
  | "select";

export interface ComponentSetting {
  key: string;
  label: string;
  kind: SettingKind;
  default: string | number | string[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: SelectOption[];
}

export interface LibraryComponent {
  id: string;
  name: string;
  icon: string; // lucide-react 图标名
  description: string;
  category: string;
  site?: string; // 整站模板下所属站点（如 Outstand），用于二级分组
  settings: ComponentSetting[];
}

// 组件源码文件在仓库中的相对路径（按组件 id 索引），仅「复制源码」与源码接口内部使用
export const SOURCE_FILES: Record<string, string[]> = {
  "fluid-text": ["components/originkit/ui/fluid-text.tsx"],
  "smoky-text": ["components/originkit/ui/smokytext.tsx"],
  "spotlight-text": ["components/originkit/ui/spotlighttext.tsx"],
  "ring-gallery": ["components/originkit/ring-gallery.tsx"],
  "hero-36": ["components/originkit/hero-36.tsx"],
  "hero-19": ["components/originkit/hero-19.tsx"],
  "outstand-hero": [
    "components/originkit/outstand/hero.tsx",
    "components/originkit/outstand/hero.module.css",
    "components/originkit/outstand/reveal.tsx",
  ],
  "outstand-pricing": [
    "components/originkit/outstand/pricing.tsx",
    "components/originkit/outstand/pricing.module.css",
  ],
  "outstand-faq": [
    "components/originkit/outstand/faq.tsx",
    "components/originkit/outstand/faq.module.css",
  ],
  "outstand-testimonials": [
    "components/originkit/outstand/testimonials.tsx",
    "components/originkit/outstand/testimonials.module.css",
  ],
  "outstand-features": [
    "components/originkit/outstand/features.tsx",
    "components/originkit/outstand/features.module.css",
  ],
  "outstand-about": [
    "components/originkit/outstand/about.tsx",
    "components/originkit/outstand/about.module.css",
  ],
  "outstand-cta": [
    "components/originkit/outstand/cta.tsx",
    "components/originkit/outstand/cta.module.css",
  ],
  "outstand-process": [
    "components/originkit/outstand/process.tsx",
    "components/originkit/outstand/process.module.css",
  ],
  "outstand-projects": [
    "components/originkit/outstand/projects.tsx",
    "components/originkit/outstand/projects.module.css",
  ],
  "outstand-whychooseus": [
    "components/originkit/outstand/why-choose-us.tsx",
    "components/originkit/outstand/why-choose-us.module.css",
  ],
};

export function sourcePathFor(id: string): string[] {
  return SOURCE_FILES[id] ?? [];
}

// 常用流体配色预设
export const FLUID_PALETTES: { label: string; colors: string[] }[] = [
  { label: "霓虹", colors: ["#A855F7", "#EC4899", "#3B82F6", "#AFFF00", "#00FFF5"] },
  { label: "落日", colors: ["#FF512F", "#DD2476", "#F6D365", "#FB923C", "#F472B6"] },
  { label: "海洋", colors: ["#00C9FF", "#92FE9D", "#2AF598", "#3B82F6", "#06B6D4"] },
  { label: "黑白", colors: ["#FFFFFF", "#FFFFFF", "#EDEDED", "#D6D6D6"] },
  { label: "渐变青", colors: ["#06B6D4", "#3B82F6", "#8B5CF6", "#A78BFA"] },
  { label: "火焰", colors: ["#F97316", "#EF4444", "#FDE047", "#FDBA74"] },
];

export const COMPONENT_LIB: LibraryComponent[] = [
  {
    id: "fluid-text",
    name: "流体文字",
    icon: "Waves",
    description: "WebGL 液态融合文字，鼠标/触摸拖动搅动流体，可调配色与强度。",
    category: "特效",
    settings: [
      { key: "text", label: "文字", kind: "text", default: "FLUID TEXT" },
      {
        key: "color",
        label: "基础色",
        kind: "color",
        default: "#FFFFFF",
      },
      {
        key: "palette",
        label: "流体配色",
        kind: "palette",
        default: FLUID_PALETTES[0].colors,
      },
      {
        key: "fontSize",
        label: "字号",
        kind: "range",
        default: 120,
        min: 40,
        max: 220,
        step: 4,
        unit: "px",
      },
      {
        key: "fontWeight",
        label: "字重",
        kind: "range",
        default: 700,
        min: 300,
        max: 900,
        step: 100,
      },
      {
        key: "splatRadius",
        label: "扩散半径",
        kind: "range",
        default: 7,
        min: 2,
        max: 20,
        step: 1,
      },
      {
        key: "splatForce",
        label: "推动力度",
        kind: "range",
        default: 10,
        min: 1,
        max: 40,
        step: 1,
      },
      {
        key: "curl",
        label: "湍流涡度",
        kind: "range",
        default: 50,
        min: 0,
        max: 120,
        step: 5,
      },
      {
        key: "densityDissipation",
        label: "消散速度",
        kind: "range",
        default: 5,
        min: 1,
        max: 30,
        step: 1,
      },
      {
        key: "bg",
        label: "画布底色",
        kind: "select",
        default: "dark",
        options: [
          { label: "深色", value: "dark" },
          { label: "浅色", value: "light" },
          { label: "纯黑", value: "black" },
          { label: "斑马纹", value: "zebra" },
        ],
      },
    ],
  },
  {
    id: "smoky-text",
    name: "烟雾文字",
    icon: "CloudFog",
    description: "文字从迷雾中浮现：烟雾沿字符逐个离散飘出再收拢成清晰字形，强度越高烟雾越浓越扩散。",
    category: "特效",
    settings: [
      { key: "text", label: "文字", kind: "text", default: "SMOKY\nTEXT" },
      {
        key: "color",
        label: "烟雾色",
        kind: "color",
        default: "#f5f5f5",
      },
      {
        key: "intensity",
        label: "烟雾浓度",
        kind: "range",
        default: 10,
        min: 1,
        max: 20,
        step: 1,
      },
      {
        key: "appearTrigger",
        label: "触发方式",
        kind: "select",
        default: "default",
        options: [
          { label: "进入即播", value: "default" },
          { label: "悬停触发", value: "hover" },
          { label: "滚动触发", value: "scroll" },
        ],
      },
      {
        key: "animationMode",
        label: "动画模式",
        kind: "select",
        default: "singleLine",
        options: [
          { label: "逐字顺序", value: "singleLine" },
          { label: "逐行错落", value: "multiLine" },
          { label: "原地聚拢", value: "inPlace" },
        ],
      },
      {
        key: "position",
        label: "飘散方向",
        kind: "select",
        default: "bottomLeft",
        options: [
          { label: "左下", value: "bottomLeft" },
          { label: "左上", value: "topLeft" },
        ],
      },
      {
        key: "fontSize",
        label: "字号",
        kind: "range",
        default: 120,
        min: 36,
        max: 200,
        step: 4,
        unit: "px",
      },
      {
        key: "duration",
        label: "动画时长",
        kind: "range",
        default: 2,
        min: 0.5,
        max: 5,
        step: 0.2,
        unit: "s",
      },
      {
        key: "bg",
        label: "画布底色",
        kind: "select",
        default: "black",
        options: [
          { label: "纯黑", value: "black" },
          { label: "深色", value: "dark" },
          { label: "浅色", value: "light" },
          { label: "斑马纹", value: "zebra" },
        ],
      },
    ],
  },
  {
    id: "spotlight-text",
    name: "聚光文字",
    icon: "Scan",
    description: "文字默认为暗色，光标扫过时聚光圆形亮相出亮色文字，如手电筒照过暗夜（源自 Cred Flashlight Effect）。",
    category: "特效",
    settings: [
      { key: "text", label: "文字", kind: "text", default: "Not everything is meant to be seen at once. Hover to reveal." },
      { key: "brightColor", label: "亮色", kind: "color", default: "#FFFFFF" },
      { key: "dimColor", label: "暗色", kind: "color", default: "#2A2A2A" },
      { key: "maskSize", label: "聚光半径", kind: "range", default: 150, min: 40, max: 400, step: 5, unit: "px" },
      { key: "intensity", label: "聚光浓度", kind: "range", default: 10, min: 10, max: 100, step: 5 },
      { key: "fontSize", label: "字号", kind: "range", default: 40, min: 16, max: 100, step: 2, unit: "px" },
      {
        key: "bg",
        label: "画布底色",
        kind: "select",
        default: "black",
        options: [
          { label: "纯黑", value: "black" },
          { label: "深色", value: "dark" },
          { label: "浅色", value: "light" },
          { label: "斑马纹", value: "zebra" },
        ],
      },
    ],
  },
  {
    id: "ring-gallery",
    name: "环形图廊",
    icon: "Orbit",
    description: "图片沿同心圆环持续旋转的展示装置，全参数可调（环数/半径/间距/尺寸/方向/速度/圆角/倾斜/填充）。",
    category: "特效",
    settings: [
      { key: "preset", label: "预设", kind: "select", default: "circle", options: [
        { label: "三环同向", value: "circle" },
        { label: "双环交替", value: "alt" },
      ] },
      { key: "rings", label: "环数", kind: "range", default: 3, min: 1, max: 6, step: 1 },
      { key: "direction", label: "方向", kind: "select", default: "cw", options: [
        { label: "顺时", value: "cw" },
        { label: "逆时", value: "ccw" },
        { label: "交替", value: "alternate" },
      ] },
      { key: "speed", label: "旋转速度", kind: "range", default: 7, min: 0, max: 20, step: 1 },
      { key: "innerRadius", label: "内环半径", kind: "range", default: 110, min: 40, max: 220, step: 2, unit: "px" },
      { key: "ringGap", label: "环间距", kind: "range", default: 120, min: 40, max: 240, step: 2, unit: "px" },
      { key: "cardWidth", label: "卡片宽", kind: "range", default: 72, min: 40, max: 160, step: 2, unit: "px" },
      { key: "cardHeight", label: "卡片高", kind: "range", default: 92, min: 48, max: 200, step: 2, unit: "px" },
      { key: "rounded", label: "圆角", kind: "range", default: 6, min: 0, max: 40, step: 1, unit: "px" },
      { key: "tilt", label: "倾斜", kind: "range", default: 6, min: 0, max: 24, step: 1, unit: "deg" },
      { key: "fit", label: "图片填充", kind: "select", default: "cover", options: [
        { label: "裁切", value: "cover" },
        { label: "包含", value: "contain" },
      ] },
      { key: "count", label: "图片数量", kind: "select", default: "12", options: [
        { label: "8", value: "8" },
        { label: "12", value: "12" },
        { label: "16", value: "16" },
      ] },
      { key: "bg", label: "画布底色", kind: "select", default: "dark", options: [
        { label: "深色", value: "dark" },
        { label: "浅色", value: "light" },
        { label: "纯黑", value: "black" },
        { label: "斑马纹", value: "zebra" },
      ] },
    ],
  },
  {
    id: "hero-36",
    name: "发卡 Hero",
    icon: "PanelsTopLeft",
    description: "卡片发放式落地 Hero，图纸式排版：两侧刻度导轨、虚线单元带、导航+文案+卡扇（取自 Originkit hero-36）。",
    category: "区块",
    settings: [
      { key: "bg", label: "画布底色", kind: "select", default: "light", options: [
        { label: "浅色", value: "light" },
        { label: "深色", value: "dark" },
      ] },
    ],
  },
  {
    id: "hero-19",
    name: "粒子球 Hero",
    icon: "Orbit",
    description: "玻璃底座上的 3D 粒子球 + 浮岛式产品 Hero：动态 tagline、徽标跑马灯、logo 卡片、项目徽标墙与悬浮玻璃贴片（取自 Originkit hero-19，three.js 驱动）。",
    category: "区块",
    settings: [
      { key: "bg", label: "画布底色", kind: "select", default: "light", options: [
        { label: "浅色", value: "light" },
        { label: "深色", value: "dark" },
      ] },
    ],
  },
  {
    id: "outstand-hero",
    name: "Outstand Hero",
    icon: "Sparkles",
    description: "深色主题 agency Hero：图案背景 + 光晕入场动画、逐词揭示标题、评分徽章、4 栏数据指标与无限滚动客户 Logo 跑马灯（取自 Originkit Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      { key: "heading", label: "标题", kind: "text", default: "Modern, Cool, and Effective Template for Your Business" },
      { key: "subheading", label: "副标题", kind: "text", default: "Boost Your Brand with Our Sleek and Cutting-Edge Framer Template" },
      { key: "ctaLabel", label: "CTA 文字", kind: "text", default: "Book a call" },
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-pricing",
    name: "Outstand 定价",
    icon: "Sparkles",
    description: "深色主题定价区块：月/年计费切换开关、三档计划卡片（Starter/Growth/Enterprise）、Popular 高亮卡、悬停箭头动效（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-faq",
    name: "Outstand FAQ",
    icon: "Sparkles",
    description: "深色主题 FAQ 手风琴区块：双栏问题分类（设计开发 / 营销服务）、逐条展开折叠、旋转加减号图标（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-testimonials",
    name: "Outstand 客户评价",
    icon: "Sparkles",
    description: "深色主题客户评价区块：6 张评价卡片网格，标题标签、引述文案、头像 + 姓名 + 角色 + X 社交链接（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-features",
    name: "Outstand 特性",
    icon: "Sparkles",
    description: "深色主题特性区块：左侧介绍卡 + 4 项要点 + 按钮，右侧 2x2 特性网格，点划虚线分隔线（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-about",
    name: "Outstand 关于我们",
    icon: "Sparkles",
    description: "深色主题关于区块：左侧介绍图 + 右侧大字数据卡片网格（5+ 年经验 / 500+ 项目 / 95% 满意度 / 40+ 成员），每卡含标题/分隔线/描述（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-cta",
    name: "Outstand 行动号召",
    icon: "Sparkles",
    description: "深色主题 CTA 转化区块：网格背景 + 光晕 + 顶部服务标签（设计开发/数字营销/品牌身份）+ 邮箱订阅表单（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-process",
    name: "Outstand 流程",
    icon: "Sparkles",
    description: "深色主题流程区块：6 步流程卡片（Consultation/Proposal/Execution/Delivery/Support/Feedback），每卡带图标 + 周数标签 + 标题 + 描述，底部卡片含 hover 亮光动效与箭头（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-projects",
    name: "Outstand 作品集",
    icon: "Sparkles",
    description: "深色主题作品集区块：3 个项目展示卡（Gency/Landfree/Waitlista），每卡含大封面图 + 缩略图切换 Tab + 标题 + Open 外链，底部 View All Projects 按钮（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
  {
    id: "outstand-whychooseus",
    name: "Outstand 差异化优势",
    icon: "Sparkles",
    description: "深色主题差异化优势区块：3 列卡片（Innovative Solutions / Putting Users First / Proven Track Record），每卡带图标 + 标题 + 描述，卡片含内边框（取自 Outstand 模板）。",
    category: "整站模板",
    site: "Outstand",
    settings: [
      {
        key: "accentColor",
        label: "主题色",
        kind: "color",
        default: "#CDF140",
      },
    ],
  },
];