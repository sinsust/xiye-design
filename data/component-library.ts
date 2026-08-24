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
  "coverflow-gallery": ["components/originkit/coverflow-gallery/ui/coverflowgallery.tsx"],
  "round-carousel": ["components/originkit/round-carousel/ui/roundcarousel.tsx"],
  "shiny-pill": ["components/originkit/ui/shiny-pill.tsx"],
  "water-button": ["components/originkit/ui/water-button.tsx"],
  "keycap-button": ["components/originkit/ui/keycap-button.tsx"],
  "moving-gradient-button": ["components/originkit/ui/moving-gradient-button.tsx"],
  "button-resource": ["components/originkit/ui/button-resource.tsx"],
  "hero-36": ["components/originkit/hero-36.tsx"],
  "hero-19": ["components/originkit/hero-19.tsx"],
  "hero-04": [
    "components/originkit/hero-04.tsx",
    "components/originkit/hero-04.css",
    "components/originkit/ui/hero-04/section-13-hero.tsx",
    "components/originkit/ui/hero-04/hero-content.tsx",
    "components/originkit/ui/hero-04/navbar.tsx",
    "components/originkit/ui/hero-04/ring-gallery.tsx",
    "components/originkit/ui/hero-04/ring-stage.tsx",
    "components/originkit/ui/hero-04/textured-background.tsx",
    "components/originkit/ui/hero-04/button.tsx",
    "components/originkit/ui/hero-04/vinyl-disc.tsx",
  ],
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
  "outstand-values": [
    "components/originkit/outstand/values.tsx",
    "components/originkit/outstand/values.module.css",
  ],
  "outstand-expertise": [
    "components/originkit/outstand/expertise.tsx",
    "components/originkit/outstand/expertise.module.css",
  ],
  "outstand-digitalsolutions": [
    "components/originkit/outstand/digital-solutions.tsx",
    "components/originkit/outstand/digital-solutions.module.css",
  ],
  "outstand-benefits": [
    "components/originkit/outstand/benefits.tsx",
    "components/originkit/outstand/benefits.module.css",
  ],
  "outstand-benefits-section": [
    "components/originkit/outstand/benefits-section.tsx",
    "components/originkit/outstand/benefits-section.module.css",
  ],
  "outstand-contact-us": [
    "components/originkit/outstand/contact-us.tsx",
    "components/originkit/outstand/contact-us.module.css",
  ],
  "outstand-lets-work-together": [
    "components/originkit/outstand/lets-work-together.tsx",
    "components/originkit/outstand/lets-work-together.module.css",
  ],
  "outstand-our-solution-section": [
    "components/originkit/outstand/our-solution-section.tsx",
    "components/originkit/outstand/our-solution-section.module.css",
  ],
  "outstand-works-contact-us": [
    "components/originkit/outstand/works-contact-us.tsx",
    "components/originkit/outstand/works-contact-us.module.css",
  ],
  "outstand-works-excellence": [
    "components/originkit/outstand/works-excellence.tsx",
    "components/originkit/outstand/works-excellence.module.css",
  ],
  "outstand-works-partners": [
    "components/originkit/outstand/works-partners.tsx",
    "components/originkit/outstand/works-partners.module.css",
  ],
  "outstand-works-portfolio": [
    "components/originkit/outstand/works-portfolio.tsx",
    "components/originkit/outstand/works-portfolio.module.css",
  ],
  "outstand-works-projects": [
    "components/originkit/outstand/works-projects.tsx",
    "components/originkit/outstand/works-projects.module.css",
  ],
  "outstand-works-projects-hero": [
    "components/originkit/outstand/works-projects-hero.tsx",
    "components/originkit/outstand/works-projects-hero.module.css",
  ],
  "outstand-works-testimonials": [
    "components/originkit/outstand/works-testimonials.tsx",
    "components/originkit/outstand/works-testimonials.module.css",
  ],
  "outstand-services-benefits": [
    "components/originkit/outstand/services-benefits.tsx",
    "components/originkit/outstand/services-benefits.module.css",
  ],
  "outstand-services-comparison": [
    "components/originkit/outstand/services-comparison.tsx",
    "components/originkit/outstand/services-comparison.module.css",
  ],
  "outstand-services-expertise": [
    "components/originkit/outstand/services-expertise.tsx",
    "components/originkit/outstand/services-expertise.module.css",
  ],
  "outstand-services-faq": [
    "components/originkit/outstand/services-faq.tsx",
    "components/originkit/outstand/services-faq.module.css",
  ],
  "outstand-services-hero": [
    "components/originkit/outstand/services-hero.tsx",
    "components/originkit/outstand/services-hero.module.css",
  ],
  "outstand-services-keyfeatures": [
    "components/originkit/outstand/services-keyfeatures.tsx",
    "components/originkit/outstand/services-keyfeatures.module.css",
  ],
  "outstand-services-payment": [
    "components/originkit/outstand/services-payment.tsx",
    "components/originkit/outstand/services-payment.module.css",
  ],
  "outstand-services-pricingplan": [
    "components/originkit/outstand/services-pricingplan.tsx",
    "components/originkit/outstand/services-pricingplan.module.css",
  ],
  "outstand-services-process": [
    "components/originkit/outstand/services-process.tsx",
    "components/originkit/outstand/services-process.module.css",
  ],
  "outstand-services-services": [
    "components/originkit/outstand/services-services.tsx",
    "components/originkit/outstand/services-services.module.css",
  ],
  "outstand-services-overview": [
    "components/originkit/outstand/services-overview.tsx",
    "components/originkit/outstand/services-overview.module.css",
  ],
  "outstand-about-call-to-action": [
    "components/originkit/outstand/about-call-to-action.tsx",
    "components/originkit/outstand/about-call-to-action.module.css",
  ],
  "outstand-about-careers": [
    "components/originkit/outstand/about-careers.tsx",
    "components/originkit/outstand/about-careers.module.css",
  ],
  "outstand-about-excellence": [
    "components/originkit/outstand/about-excellence.tsx",
    "components/originkit/outstand/about-excellence.module.css",
  ],
  "outstand-about-features": [
    "components/originkit/outstand/about-features.tsx",
    "components/originkit/outstand/about-features.module.css",
  ],
  "outstand-about-hero": [
    "components/originkit/outstand/about-hero.tsx",
    "components/originkit/outstand/about-hero.module.css",
  ],
  "outstand-about-our-culture": [
    "components/originkit/outstand/about-our-culture.tsx",
    "components/originkit/outstand/about-our-culture.module.css",
  ],
  "outstand-about-our-story": [
    "components/originkit/outstand/about-our-story.tsx",
    "components/originkit/outstand/about-our-story.module.css",
  ],
  "outstand-about-team-members": [
    "components/originkit/outstand/about-team-members.tsx",
    "components/originkit/outstand/about-team-members.module.css",
  ],
  "outstand-about-testimonials": [
    "components/originkit/outstand/about-testimonials.tsx",
    "components/originkit/outstand/about-testimonials.module.css",
  ],
  "outstand-contact-digital-presence": [
    "components/originkit/outstand/contact-digital-presence.tsx",
    "components/originkit/outstand/contact-digital-presence.module.css",
  ],
  "outstand-contact-faq": [
    "components/originkit/outstand/contact-faq.tsx",
    "components/originkit/outstand/contact-faq.module.css",
  ],
  "outstand-contact-hero": [
    "components/originkit/outstand/contact-hero.tsx",
    "components/originkit/outstand/contact-hero.module.css",
  ],
  "outstand-contact-support": [
    "components/originkit/outstand/contact-support.tsx",
    "components/originkit/outstand/contact-support.module.css",
  ],
  "outstand-not-found": [
    "components/originkit/outstand/not-found.tsx",
    "components/originkit/outstand/not-found.module.css",
  ],
  "outstand-privacy-policy": [
    "components/originkit/outstand/privacy-policy.tsx",
    "components/originkit/outstand/privacy-policy.module.css",
  ],
  "wexo-hero": [
    "components/originkit/wexo/hero.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/hero.html",
  ],
  "wexo-product-overview": [
    "components/originkit/wexo/product-overview.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/product-overview.html",
  ],
  "wexo-how-to-use": [
    "components/originkit/wexo/how-to-use.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/how-to-use.html",
  ],
  "wexo-user-feedback": [
    "components/originkit/wexo/user-feedback.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/user-feedback.html",
  ],
  "wexo-pricing": [
    "components/originkit/wexo/pricing.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/pricing.html",
  ],
  "wexo-unique-feature": [
    "components/originkit/wexo/unique-feature.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/unique-feature.html",
  ],
  "wexo-about-us": [
    "components/originkit/wexo/about-us.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/about-us.html",
  ],
  "wexo-comparison": [
    "components/originkit/wexo/comparison.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/comparison.html",
  ],
  "wexo-our-team": [
    "components/originkit/wexo/our-team.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/our-team.html",
  ],
  "wexo-blogs": [
    "components/originkit/wexo/blogs.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/blogs.html",
  ],
  "wexo-testimonials": [
    "components/originkit/wexo/testimonials.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/testimonials.html",
  ],
  "wexo-cta": [
    "components/originkit/wexo/cta.tsx",
    "components/originkit/wexo/shared.tsx",
    "public/originkit/wexo/sections/cta.html",
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
    id: "coverflow-gallery",
    name: "Coverflow 画廊",
    icon: "Orbit",
    description: "3D 封面流轮播：中心卡片正立高亮、两侧沿透视向后倾斜，点击任意卡片平滑归位；支持自动播放、标题角标与倾斜/间距/圆角等全参数调节（取自 Originkit coverflowgallery）。",
    category: "特效",
    settings: [
      { key: "cardWidth", label: "卡片宽", kind: "range", default: 400, min: 200, max: 800, step: 10, unit: "px" },
      { key: "cardHeight", label: "卡片高", kind: "range", default: 400, min: 200, max: 800, step: 10, unit: "px" },
      { key: "radius", label: "圆角", kind: "range", default: 3, min: 0, max: 20, step: 1 },
      { key: "tilt", label: "主倾斜", kind: "range", default: 12, min: 0, max: 30, step: 1, unit: "deg" },
      { key: "sideTilt", label: "侧倾斜", kind: "range", default: 8, min: 0, max: 30, step: 1, unit: "deg" },
      { key: "gap", label: "间距", kind: "range", default: 8, min: 0, max: 20, step: 1 },
      { key: "opacity", label: "暗化强度", kind: "range", default: 60, min: 0, max: 100, step: 5, unit: "%" },
      {
        key: "autoplay",
        label: "自动播放",
        kind: "select",
        default: "on",
        options: [
          { label: "关", value: "off" },
          { label: "开", value: "on" },
        ],
      },
      {
        key: "autoplayDirection",
        label: "播放方向",
        kind: "select",
        default: "rightToLeft",
        options: [
          { label: "右→左", value: "rightToLeft" },
          { label: "左→右", value: "leftToRight" },
        ],
      },
      {
        key: "showTitle",
        label: "显示标题",
        kind: "select",
        default: "on",
        options: [
          { label: "显示", value: "on" },
          { label: "隐藏", value: "off" },
        ],
      },
      { key: "titleColor", label: "标题色", kind: "color", default: "#ffffff" },
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
    id: "round-carousel",
    name: "3D 环形轮播",
    icon: "Rotate3d",
    description: "3D 环形相册轮播：图片沿圆周均匀排布、持续自转，可拖拽惯性交互、内外双面贴图、圆角与透视可调（取自 Originkit Round Carousel）。",
    category: "特效",
    settings: [
      { key: "imageWidth", label: "卡片宽", kind: "range", default: 300, min: 120, max: 500, step: 10, unit: "px" },
      { key: "imageHeight", label: "卡片高", kind: "range", default: 300, min: 120, max: 500, step: 10, unit: "px" },
      { key: "spacing", label: "间距", kind: "range", default: 3, min: 0, max: 10, step: 1 },
      { key: "speed", label: "转速", kind: "range", default: 7, min: 0, max: 20, step: 1 },
      {
        key: "direction",
        label: "方向",
        kind: "select",
        default: "right",
        options: [
          { label: "顺时针", value: "right" },
          { label: "逆时针", value: "left" },
        ],
      },
      {
        key: "drag",
        label: "拖拽",
        kind: "select",
        default: "on",
        options: [
          { label: "开", value: "on" },
          { label: "关", value: "off" },
        ],
      },
      { key: "sensitivity", label: "拖拽灵敏度", kind: "range", default: 5, min: 0, max: 20, step: 1 },
      { key: "tilt", label: "俯仰角", kind: "range", default: -7, min: -30, max: 30, step: 1, unit: "deg" },
      { key: "perspective", label: "透视", kind: "range", default: 3000, min: 500, max: 5000, step: 100, unit: "px" },
      { key: "cornerRadius", label: "圆角", kind: "range", default: 22, min: 0, max: 80, step: 1, unit: "px" },
      { key: "innerDim", label: "内侧变暗", kind: "range", default: 3.5, min: 0, max: 10, step: 0.5 },
      { key: "background", label: "画布底色", kind: "color", default: "#000000" },
    ],
  },
  {
    id: "shiny-pill",
    name: "Shiny Pill",
    icon: "Sparkles",
    description: "Shiny Pill —— 扫光文字：文字带一道往复扫过的高光渐变（Orgininkit），底色/高光色/速度/字大均可调。",
    category: "特效",
    settings: [
      { key: "text", label: "文字", kind: "text", default: "SHINY PILL" },
      { key: "textColor", label: "底色", kind: "color", default: "#FFFFFF" },
      { key: "shineColor", label: "高光色", kind: "color", default: "#78FF83" },
      { key: "speed", label: "扫光速度", kind: "range", default: 1.5, min: 0.3, max: 6, step: 0.1, unit: "s" },
      { key: "fontSize", label: "字号", kind: "range", default: 120, min: 16, max: 240, step: 2, unit: "px" },
      { key: "link", label: "链接(可选)", kind: "text", default: "" },
    ],
  },
  {
    id: "water-button",
    name: "水波按钮",
    icon: "Waves",
    description: "装在一圈玻璃里的水：鼠标掠过会被拨开、溅起水花的水面按钮（取自 Originkit water-button，canvas 一维浅水模拟，质量守恒）。",
    category: "按钮",
    settings: [
      { key: "label", label: "文字", kind: "text", default: "WATER BUTTON" },
      { key: "textColor", label: "文字颜色", kind: "color", default: "#000000" },
      { key: "waterColor", label: "水色", kind: "color", default: "#00EEFF" },
      { key: "waterAmount", label: "水量", kind: "range", default: 69, min: 10, max: 90, step: 1, unit: "%" },
      { key: "paddingX", label: "水平内边距", kind: "range", default: 64, min: 16, max: 160, step: 2, unit: "px" },
      { key: "paddingY", label: "垂直内边距", kind: "range", default: 38, min: 12, max: 100, step: 2, unit: "px" },
      { key: "rounded", label: "圆角", kind: "range", default: 100, min: 0, max: 100, step: 2, unit: "px" },
      { key: "fontSize", label: "字号", kind: "range", default: 16, min: 12, max: 40, step: 1, unit: "px" },
      { key: "border", label: "边框", kind: "select", default: "on", options: [
        { label: "显示", value: "on" },
        { label: "隐藏", value: "off" },
      ] },
      { key: "press", label: "按压缩放", kind: "select", default: "on", options: [
        { label: "开", value: "on" },
        { label: "关", value: "off" },
      ] },
    ],
  },
  {
    id: "keycap-button",
    name: "键帽按钮",
    icon: "Keyboard",
    description: "悬浮的多层键帽：等轴侧视角、棱柱厚度与浮动、悬停上浮变亮（取自 Originkit keycap-button，framer-motion 立体按钮）。",
    category: "按钮",
    settings: [
      { key: "label", label: "文字", kind: "text", default: "KEY CAP" },
      { key: "fill", label: "键帽填充色", kind: "color", default: "#16121D" },
      { key: "textColor", label: "文字颜色", kind: "color", default: "#A05CFF" },
      { key: "prismColor", label: "棱柱色", kind: "color", default: "#A05CFF" },
      { key: "rounded", label: "圆角", kind: "range", default: 45, min: 0, max: 80, step: 1, unit: "px" },
      { key: "fontSize", label: "字号", kind: "range", default: 24, min: 12, max: 64, step: 1, unit: "px" },
    ],
  },
  {
    id: "moving-gradient-button",
    name: "流光渐变按钮",
    icon: "Palette",
    description: "常驻流动的动态渐变按钮：多彩流光时刻随鼠标位置移动，悬停换色（取自 Originkit moving-gradient-button，framer-motion 驱动）。",
    category: "按钮",
    settings: [
      { key: "label", label: "文字", kind: "text", default: "MOVING GRADIENT" },
      { key: "fill", label: "填充色", kind: "color", default: "#000000" },
      { key: "textColor", label: "文字颜色", kind: "color", default: "#FFFFFF" },
      { key: "hoverTextColor", label: "悬停文字色", kind: "color", default: "#CCC30E" },
      { key: "rounded", label: "圆角", kind: "range", default: 100, min: 0, max: 100, step: 1, unit: "px" },
      { key: "fontSize", label: "字号", kind: "range", default: 24, min: 12, max: 64, step: 1, unit: "px" },
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
    id: "hero-04",
    name: "黑胶唱片 Hero",
    icon: "Disc3",
    description: "深色音乐人 Hero：顶栏 Nav + 转动的黑胶唱盘（vinyl-disc）、环形艺人肖像画廊（ring-gallery）、质感纹理背景与居中 Logo（取自 Originkit hero-04，framer-motion 驱动）。",
    category: "区块",
    settings: [
      { key: "bg", label: "画布底色", kind: "select", default: "dark", options: [
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
  {
    id: "outstand-values",
    name: "Outstand 价值观",
    icon: "Sparkles",
    description: "深色主题价值观区块：Our Guiding Principles 标题，6 张价值观卡片（Customer Focus/Integrity Always/Continuous Improvement/Innovation Driven/Team Collaboration/Excellence Pursuit），2 列 3 行布局，每卡带图标 + 底部装饰线（取自 Outstand 模板）。",
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
    id: "outstand-expertise",
    name: "Outstand 能力与数据指标",
    icon: "Sparkles",
    description: "深色主题能力与数据指标区块：Our Expertise 标题 + 4 张能力卡（E-Commerce Solutions/Digital Marketing/Mobile App Development/Content Strategy），每卡含图片 + 图标 + 描述 + 3 组数据指标（如 40% Sales Increased/100+ Satisfied Clients/Awarded）（取自 Outstand 模板）。",
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
    id: "outstand-digitalsolutions",
    name: "Outstand 数字方案",
    icon: "Sparkles",
    description: "深色主题数字方案区块：Digital Solutions Tailored for You 标题 + 6 张方案卡（Customized Digital Solutions/Collaborative Approach/Innovative Tech Solutions/Data-Driven Decisions/Adaptable Business Solutions/Clear & Open Communication），每卡带图标 + 分隔线 + 描述（取自 Outstand 模板）。",
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
    id: "outstand-benefits",
    name: "Outstand 优势列表",
    icon: "Sparkles",
    description: "深色主题优势列表区块：标题 + 2 列多行优势条目（带编号、图标、分隔线，如 FAQ-style 优势展示），低频简洁（取自 Outstand 模板）。",
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
    id: "outstand-benefits-section",
    name: "Outstand 优势区块",
    icon: "Sparkles",
    description: "深色主题优势区块：大标题 + 多个带大图/图标的优势卡（Benefits 场景），图文混排展示核心卖点（取自 Outstand 模板）。",
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
    id: "outstand-contact-us",
    name: "Outstand 联系表单",
    icon: "Sparkles",
    description: "深色主题联系区块：标题 + 表单（Name/Email/Message 输入区 + 提交按钮）+ 联系信息（邮箱/地址等），表单含内边框输入框（取自 Outstand 模板）。",
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
    id: "outstand-lets-work-together",
    name: "Outstand 合作横幅",
    icon: "Sparkles",
    description: "深色主题合作横幅：Rise & Shine With Us 标题 + 合作文案/CTA，下方 Past Customers 客户 Logo 墙（静态排列），顶部可与 Let's Work Together 区块结合（取自 Outstand 模板）。",
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
    id: "outstand-our-solution-section",
    name: "Outstand 方案介绍",
    icon: "Sparkles",
    description: "深色主题方案介绍大区块：大标题 + 图文方案展示（方案卡片 + 特性标签 + 数据），场景化介绍整体解决方案（取自 Outstand 模板）。",
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
    id: "outstand-works-contact-us",
    name: "Outstand 联系（作品页）",
    icon: "Sparkles",
    description: "深色联系区块：Get in Touch with Agency pro 标题 + 联系表单（Submit 按钮）+ 联系信息（取自 Outstand Works 页面）。",
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
    id: "outstand-works-excellence",
    name: "Outstand 成就展示",
    icon: "Sparkles",
    description: "深色成就区块：Awards & Recognition 标题 + Excellence in Design 等获奖/成就条目（含数据与图标），展示荣誉与认可（取自 Outstand Works 页面）。",
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
    id: "outstand-works-partners",
    name: "Outstand 合作伙伴",
    icon: "Sparkles",
    description: "深色合作区块：Our Collaborative Partnerships 标题 + Global Connect/Development 等合作领域条目 + 合作伙伴 Logo/信息展示（取自 Outstand Works 页面）。",
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
    id: "outstand-works-portfolio",
    name: "Outstand 作品精选",
    icon: "Sparkles",
    description: "深色作品精选区块：Explore Our Portfolio 标题 + 精选项目卡（Gency 等，含封面图 + 描述 + 外链按钮），展示代表作品（取自 Outstand Works 页面）。",
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
    id: "outstand-works-projects",
    name: "Outstand 项目展示（作品页）",
    icon: "Sparkles",
    description: "深色项目展示区块：Our Project Showcase 标题 + 项目卡网格（Gency/Agency Template for business Brand 等，含图 + 描述 + 外链）（取自 Outstand Works 页面）。",
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
    id: "outstand-works-projects-hero",
    name: "Outstand 作品页首屏背景",
    icon: "Sparkles",
    description: "深色作品页首屏背景区块：响应式横幅大图（picture + 多断点 srcSet，桌面/平板/手机三档），作为作品集页面顶部背景（取自 Outstand Works 页面）。",
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
    id: "outstand-works-testimonials",
    name: "Outstand 客户评价（作品页）",
    icon: "Sparkles",
    description: "深色客户评价区块：What our Clients say About Us 标题 + 评价卡列表（Happy!/Awesome! 等 + 客户头像/姓名），展示客户反馈（取自 Outstand Works 页面）。",
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
    id: "outstand-services-benefits",
    name: "Outstand 优势（服务页）",
    icon: "Sparkles",
    description: "深色优势区块：Benefits of Choosing Us 标题 + 优势条目/卡，展示选择服务的价值（取自 Outstand Services 页面）。",
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
    id: "outstand-services-comparison",
    name: "Outstand 服务对比",
    icon: "Sparkles",
    description: "深色对比区块：Service Comparison Overview 标题 + 服务方案对比表（特性逐行对比，突出推荐项），用于服务/套餐对比（取自 Outstand Services 页面）。",
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
    id: "outstand-services-expertise",
    name: "Outstand 能力（服务页）",
    icon: "Sparkles",
    description: "深色能力区块：Our Range of Expertise 标题 + 能力分类（Design & Development 等 + 能力清单），展示专业服务范围（取自 Outstand Services 页面）。",
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
    id: "outstand-services-faq",
    name: "Outstand FAQ（服务页）",
    icon: "Sparkles",
    description: "深色手风琴 FAQ：Questions? We Have Answers 标题 + 分类问题（Design & Development 等）+ 可交互折叠问答（useState 手风琴），点击展开/收起（取自 Outstand Services 页面）。",
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
    id: "outstand-services-hero",
    name: "Outstand 服务首屏",
    icon: "Sparkles",
    description: "深色服务首屏：Explore Works 标题 + 数据指标（Projects Completed/Satisfied Clients 等）+ 环形旋转文字（CircularText 环绕动画），视觉冲击力强（取自 Outstand Services 页面）。",
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
    id: "outstand-services-keyfeatures",
    name: "Outstand 核心特性",
    icon: "Sparkles",
    description: "深色核心特性区块：Our Competitive Edge 标题 + 特性卡（Custom Solutions 等 + 亮点/图标），突出服务核心竞争力（取自 Outstand Services 页面）。",
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
    id: "outstand-services-payment",
    name: "Outstand 付款方式",
    icon: "Sparkles",
    description: "深色付款区块：Flexible Payment Options 标题 + 付款方式卡（Stripe 等 + 图标），展示支持的支付渠道（取自 Outstand Services 页面）。",
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
    id: "outstand-services-pricingplan",
    name: "Outstand 定价（服务页）",
    icon: "Sparkles",
    description: "深色定价区块：Pricing plans 标题 + 定价卡 + Monthly/Yearly 切换（useState 联动，如价格随计费周期变化），含推荐/基础档（取自 Outstand Services 页面）。",
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
    id: "outstand-services-process",
    name: "Outstand 流程（服务页）",
    icon: "Sparkles",
    description: "深色流程区块：The Outstand Way 标题 + 流程步骤卡（Consultation 等 + 周数/图标），展示服务交付阶段（取自 Outstand Services 页面）。",
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
    id: "outstand-services-services",
    name: "Outstand 服务列表",
    icon: "Sparkles",
    description: "深色服务列表区块：Comprehensive Digital Solutions 标题 + 服务条目（Design & Development 等 + 描述/更多），概览服务目录（取自 Outstand Services 页面）。",
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
    id: "outstand-services-overview",
    name: "Outstand 服务概览",
    icon: "Sparkles",
    description: "深色服务概览区块：Our Services Overview 标题 + 服务概览卡（Design & Development 等图文混合 + 数据），完整服务能力全景（取自 Outstand Services 页面）。",
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
    id: "outstand-about-call-to-action",
    name: "Outstand 行动号召（关于页）",
    icon: "Sparkles",
    description: "深色 CTA 区块：Join Now 环形旋转文字（CircularText）+ 号召性标题 + CTA 按钮，引导注册/合作（取自 Outstand About 页面）。",
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
    id: "outstand-about-careers",
    name: "Outstand 招聘职位",
    icon: "Sparkles",
    description: "深色招聘区块：Explore Exciting Opportunities 标题 + 职位卡（Front End Developer 等 + 描述/申请按钮），展示开放岗位（取自 Outstand About 页面）。",
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
    id: "outstand-about-excellence",
    name: "Outstand 成就展示（关于页）",
    icon: "Sparkles",
    description: "深色成就区块：Awards & Recognition 标题 + Excellence in Design 等获奖/成就条目（含数据与图标），展示荣誉认可（取自 Outstand About 页面）。",
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
    id: "outstand-about-features",
    name: "Outstand 使命价值观",
    icon: "Sparkles",
    description: "深色使命区块：Our Mission & Values 标题 + Mission/价值观条目，传达品牌使命与文化（取自 Outstand About 页面）。",
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
    id: "outstand-about-hero",
    name: "Outstand 关于首屏",
    icon: "Sparkles",
    description: "深色关于首屏：About Us + Trusted by world leaders 大标题 + 数据指标 + 图文展示，品牌门面（取自 Outstand About 页面）。",
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
    id: "outstand-about-our-culture",
    name: "Outstand 企业文化",
    icon: "Sparkles",
    description: "深色文化区块：Our Culture, Empowering Excellence 标题 + 文化条目（Diversity & Inclusion 等 + 图标/描述），传达公司氛围（取自 Outstand About 页面）。",
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
    id: "outstand-about-our-story",
    name: "Outstand 品牌故事",
    icon: "Sparkles",
    description: "深色故事区块：Over The Years 标题 + 里程碑时间线（Founded 等阶段），讲述品牌发展历程（取自 Outstand About 页面）。",
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
    id: "outstand-about-team-members",
    name: "Outstand 团队成员",
    icon: "Sparkles",
    description: "深色团队区块：Awesome Team Members 标题 + 成员卡（Raj Khanna 等，含头像/姓名/角色），展示团队阵容（取自 Outstand About 页面）。",
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
    id: "outstand-about-testimonials",
    name: "Outstand 客户评价（关于页）",
    icon: "Sparkles",
    description: "深色客户评价区块：What our Clients say About Us 标题 + 评价卡（Happy! 等 + 客户头像/姓名），展示客户反馈（取自 Outstand About 页面）。",
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
    id: "outstand-contact-digital-presence",
    name: "Outstand 数字形象",
    icon: "Sparkles",
    description: "深色数字形象区块：Digital Presence 标题 + 社交媒体链接（Our Socials + 各平台图标），展示品牌线上形象（取自 Outstand Contact 页面）。",
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
    id: "outstand-contact-faq",
    name: "Outstand FAQ（联系页）",
    icon: "Sparkles",
    description: "深色手风琴 FAQ：Questions? We Have Answers 标题 + 分类问题 + 可交互折叠问答（useState 手风琴），点击展开/收起（取自 Outstand Contact 页面）。",
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
    id: "outstand-contact-hero",
    name: "Outstand 联系首屏",
    icon: "Sparkles",
    description: "深色联系首屏：Contact Us + Send a Message 联系表单 + Google 地图嵌入 + 办公室信息（Canada Office 等），联系入口大区块（取自 Outstand Contact 页面）。",
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
    id: "outstand-contact-support",
    name: "Outstand 客服支持",
    icon: "Sparkles",
    description: "深色支持区块：Support + Connect with Our Team 标题 + 支持入口（Design & Development 等 + 客服渠道），帮助用户联系售后（取自 Outstand Contact 页面）。",
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
    id: "outstand-not-found",
    name: "Outstand 404 页面",
    icon: "Sparkles",
    description: "深色 404 区块：Page Not Found 大标题 + 提示 + Back to Home 返回按钮，作为无法访问页面的兜底页（取自 Outstand 模板）。",
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
    id: "outstand-privacy-policy",
    name: "Outstand 隐私政策",
    icon: "Sparkles",
    description: "深色政策区块：Privacy Policy + Our Privacy Policy 大标题 + 分节长文（Information We Collect 等章节标题 + 说明文字），作为法律条款页内容（取自 Outstand 模板）。",
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

  // ===== Wexo 整站模板（Originkit Framer 导出，按 data-framer-name 拆为 12 独立区块）=====
  {
    id: "wexo-hero",
    name: "Wexo Hero",
    icon: "Orbit",
    description: "Wexo 整站首屏：导航 + 主标题 + 副标题 + CTA + 评分徽章 + 多层光效背景与产品 UI 展示（Originkit 原版，CSS 动效忠实还原）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-product-overview",
    name: "Wexo 产品概览",
    icon: "Orbit",
    description: "Wexo 产品概览区块：特性标签 + 大标题 + 产品截图展示，左右图文排版（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-how-to-use",
    name: "Wexo 使用方式",
    icon: "Orbit",
    description: "Wexo 使用方式区块：步骤缩略图 + 播放按钮 + 操作流程展示，含视频/动图占位（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-user-feedback",
    name: "Wexo 用户反馈",
    icon: "Orbit",
    description: "Wexo 用户反馈区块：社交媒体评价墙 + 用户头像/评分/引述卡片，强社会证明（Originkit 原版，220KB 富内容区块）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-pricing",
    name: "Wexo 定价",
    icon: "Orbit",
    description: "Wexo 定价区块：月/年计费切换 + 多档计划对比卡片 + 高亮推荐方案（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-unique-feature",
    name: "Wexo 独特功能",
    icon: "Orbit",
    description: "Wexo 独特功能区块：特性徽章 + 图文卡片网格，突出产品差异化卖点（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-about-us",
    name: "Wexo 关于我们",
    icon: "Orbit",
    description: "Wexo 关于我们区块：品牌故事 + 团队/数据展示，简洁图文排版（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-comparison",
    name: "Wexo 方案对比",
    icon: "Orbit",
    description: "Wexo 方案对比区块：双栏对比表 + Vs 标签 + 维度逐项对照（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-our-team",
    name: "Wexo 团队成员",
    icon: "Orbit",
    description: "Wexo 团队成员区块：头像 + 姓名 + 角色卡片网格，含社交链接（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-blogs",
    name: "Wexo 博客",
    icon: "Orbit",
    description: "Wexo 博客区块：文章卡片网格，含封面图/标题/摘要/日期（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-testimonials",
    name: "Wexo 客户评价",
    icon: "Orbit",
    description: "Wexo 客户评价区块：评价卡片网格 + 头像/评分/姓名/职位（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "wexo-cta",
    name: "Wexo 行动召唤",
    icon: "Orbit",
    description: "Wexo 底部 CTA 区块：大标题 + 订阅/联系表单 + 页脚链接容器（Originkit 原版）。",
    category: "整站模板",
    site: "Wexo",
    settings: [],
  },
  {
    id: "button-resource",
    name: "统一按钮资源",
    icon: "MousePointerClick",
    description: "三种 Originkit 交互按钮（水波/键帽/流光）收敛到同一份契约，一份配置即时切换风格，作为整站主按钮或独立使用。",
    category: "按钮",
    settings: [
      { key: "label", label: "文字", kind: "text", default: "开始体验" },
      { key: "style", label: "按钮风格", kind: "select", default: "moving", options: [
        { label: "水波", value: "water" },
        { label: "键帽", value: "keycap" },
        { label: "流光", value: "moving" },
      ] },
      { key: "fill", label: "填充色", kind: "color", default: "#000000" },
      { key: "textColor", label: "文字颜色", kind: "color", default: "#FFFFFF" },
      { key: "hoverTextColor", label: "悬停文字色", kind: "color", default: "#CCC30E" },
      { key: "prismColor", label: "棱柱/高光色", kind: "color", default: "#A05CFF" },
      { key: "waterColor", label: "水色", kind: "color", default: "#00EEFF" },
      { key: "rounded", label: "圆角", kind: "range", default: 100, min: 0, max: 100, step: 1, unit: "px" },
      { key: "fontSize", label: "字号", kind: "range", default: 22, min: 12, max: 64, step: 1, unit: "px" },
    ],
  },
];