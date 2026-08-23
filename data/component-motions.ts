// 按板块可挑选的动效清单（工作台预览引擎 applyMotionPreview 已支持的 id）。
// 用于「针对当前板块单独挑选 + 微调」的动效拾取器，不依赖变体写死的 motionId。
// tunable：该动效支持哪些微调参数。
//  - "lift"      位移幅度（上浮距离 px）
//  - "duration"  时长（s）
//  - "none"      仅演示、不支持微调

export type MotionTunable = "lift" | "duration" | "none";

export interface ComponentMotionOption {
  id: string; // 对应 applyMotionPreview 的 motionId
  name: string;
  description: string;
  tunable: MotionTunable;
}

export interface ComponentMotionGroup {
  id: string;
  name: string;
  options: ComponentMotionOption[];
}

export const COMPONENT_MOTION_GROUPS: ComponentMotionGroup[] = [
  {
    id: "entrance",
    name: "入场",
    options: [
      { id: "fade-up", name: "上浮淡入", description: "从下方淡入上滑，轻柔克制", tunable: "lift" },
      { id: "text-rise", name: "文字上扬", description: "整体上浮入场，舒展有力", tunable: "lift" },
      { id: "spring", name: "弹性缩放", description: "弹性放大归位，轻快有活力", tunable: "duration" },
      { id: "spring-bounce", name: "回弹入场", description: "回弹上滑，明确利落", tunable: "duration" },
      { id: "spring-elastic", name: "橡皮筋", description: "橡皮筋弹性舒展，柔和夸张", tunable: "duration" },
      { id: "wobble", name: "摆动入场", description: "小幅左右摇摆后落定", tunable: "none" },
      { id: "text-rotate", name: "旋转浮现", description: "旋转淡入归位", tunable: "duration" },
    ],
  },
  {
    id: "float",
    name: "悬浮 / 持续",
    options: [
      { id: "hover-lift", name: "上浮呼吸", description: "板块整体微微上下浮动（可微调幅度与速度）", tunable: "lift" },
      { id: "data-marquee", name: "循环跑马", description: "内容循环横向滚动", tunable: "none" },
    ],
  },
  {
    id: "scroll",
    name: "滚动触发",
    options: [
      { id: "reveal-on-scroll", name: "滚入上滑", description: "进入视口时一次上滑揭示", tunable: "lift" },
      { id: "scroll-clip", name: "裁剪揭示", description: "自下而上裁剪揭开内容", tunable: "none" },
      { id: "scroll-circle", name: "圆形揭示", description: "以圆形选区从中心扩散开", tunable: "none" },
      { id: "scroll-horizontal", name: "横向滚动", description: "吸顶并横向平移", tunable: "none" },
      { id: "sticky-stack", name: "吸顶堆叠", description: "多张卡片依次吸顶堆叠", tunable: "none" },
      { id: "zentry-image", name: "图片钉住", description: "图片揭幕并钉住滚动叙事", tunable: "none" },
    ],
  },
  {
    id: "parallax",
    name: "视差 / 滚动联动",
    options: [
      { id: "scroll-scrub", name: "滚动联动", description: "位移跟随滚动进度", tunable: "none" },
      { id: "parallax-hero", name: "视差纵深", description: "前后景速度差制造纵深", tunable: "none" },
      { id: "parallax-layers", name: "多层视差", description: "多层不同速度叠加", tunable: "none" },
      { id: "motion-path", name: "路径位移", description: "沿简单路径滑移", tunable: "none" },
    ],
  },
  {
    id: "data",
    name: "数字 / 数据",
    options: [
      { id: "data-count", name: "数字滚动", description: "数值缩放入场", tunable: "duration" },
      { id: "page-transition", name: "页间转场", description: "从右侧淡入切入", tunable: "none" },
    ],
  },
];

/** 根据 id 取选项（含所在分组名），便于拾取器展示当前态 */
export function findComponentMotion(id?: string): {
  group: string;
  option: ComponentMotionOption;
} | null {
  if (!id) return null;
  for (const g of COMPONENT_MOTION_GROUPS) {
    const option = g.options.find((o) => o.id === id);
    if (option) return { group: g.name, option };
  }
  return null;
}