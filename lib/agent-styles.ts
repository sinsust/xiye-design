// 角色风格注册表（client + server 共用，不引入任何 client-only / server-only 依赖）
//
// 把原本硬编码在 ai-panel-server / chat-stream / collab-stage / agents 页面里的
// 「后宫智囊团 / 老鸨子」主题收口到此，按 styleId 透传到会诊 prompt 与 UI 文案。
//
// 7 套预设：后宫 / 帝王 / 霸总 / 江湖 / 修仙 / 校园 / 赛博。
// 头像默认路径：/flow-v2/avatars/<style>/<role>.png（由 ImageGen 生成写实立绘）。
// 未生成时回退 DiceBear 风格化 SVG，再失败回退图标。

export type AgentStyleId =
  | "harem"
  | "emperor"
  | "ceo"
  | "jianghu"
  | "xianxia"
  | "campus"
  | "cyber";

export type AgentId = "moderator" | "pm" | "architect" | "designer" | "guard";

export const AGENT_ROLES: AgentId[] = [
  "moderator",
  "pm",
  "architect",
  "designer",
  "guard",
];

export interface AgentStyleAgent {
  /** 该风格下此角色的对外称呼 */
  name: string;
}

export interface AgentStyle {
  id: AgentStyleId;
  /** 展示名，如「后宫风」 */
  name: string;
  emoji: string;
  /** 趣味 / 闷骚一句话 */
  tagline: string;
  description: string;
  /** 选择器卡片主色（hex） */
  accent: string;
  /** 主控头衔，如「老鸨子」「朕」「顾总」 */
  moderatorTitle: string;
  /** 主控标签，如「老鸨子 · 主持」 */
  moderatorLabel: string;
  /** 智囊团框架词，如「后宫智囊团」「御前智囊」 */
  framing: string;
  /** 会诊中态文案，如「后宫智囊团会诊中…」 */
  consultingText: string;
  /** 对话占位提示，如「老鸨子会陪你聊清楚…」 */
  hintText: string;
  /** DiceBear 子风格（头像未生成时的在线回退） */
  diceBearStyle: string;
  /** 五位角色的默认称呼 */
  agents: Record<AgentId, AgentStyleAgent>;
  /** moderator system prompt 模板（注入 title / framing） */
  moderatorSystem: (title: string, framing: string) => string;
}

const MODERATOR_SYSTEM_TPL = (
  title: string,
  framing: string,
) => `你是多 Agent 协同工作台里的「${title}」，负责统筹${framing}会诊。
基于下方产品定义，给出：当前最该优先确认的关键问题、需要用户补充的约束、以及下一步建议。
你必须且只能输出一个 JSON 对象（不要 markdown 代码块、不要 JSON 外任何文字）：
{ "status": "producing" | "thinking" | "done", "progress": <0-100整数>, "summary": "<一句话给用户的协调结论>", "details": ["<关键要点1>", "<关键要点2>", "..."] }`;

export const AGENT_STYLES: Record<AgentStyleId, AgentStyle> = {
  harem: {
    id: "harem",
    name: "后宫风",
    emoji: "🏮",
    tagline: "朕的后宫，你说啥就是啥（才怪）",
    description: "老鸨子坐镇，五位红人各司其职，把你的想法宠成产品。",
    accent: "#e7559d",
    moderatorTitle: "老鸨子",
    moderatorLabel: "老鸨子 · 主持",
    framing: "后宫智囊团",
    consultingText: "后宫智囊团会诊中…",
    hintText: "老鸨子会陪你聊清楚，再召集后宫智囊团给出建议。",
    diceBearStyle: "lorelei",
    agents: {
      moderator: { name: "老鸨子-丽颖" },
      pm: { name: "产品专家-亦菲" },
      architect: { name: "架构专家-热巴" },
      designer: { name: "视觉专家-冰冰" },
      guard: { name: "开发规范-苍老师" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  emperor: {
    id: "emperor",
    name: "帝王风",
    emoji: "👑",
    tagline: "普天之下，皆是朕的产品",
    description: "朕御笔亲批，丞相太尉御史分掌六部，朝堂议政出方案。",
    accent: "#d4af37",
    moderatorTitle: "朕",
    moderatorLabel: "陛下 · 主持",
    framing: "御前智囊",
    consultingText: "御前智囊议政中…",
    hintText: "陛下先说构想，朕召御前智囊商议。",
    diceBearStyle: "personas",
    agents: {
      moderator: { name: "朕-秦皇" },
      pm: { name: "丞相-魏征" },
      architect: { name: "太尉-李靖" },
      designer: { name: "尚衣监-公输" },
      guard: { name: "御史大夫-狄仁" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  ceo: {
    id: "ceo",
    name: "霸总风",
    emoji: "💼",
    tagline: "这个项目，我要的是结果",
    description: "顾总定方向，COO/CTO/CVO/合规一字排开，董事会级输出。",
    accent: "#1f2937",
    moderatorTitle: "顾总",
    moderatorLabel: "顾总 · 主持",
    framing: "董事会智囊",
    consultingText: "董事会智囊会议中…",
    hintText: "顾总先定方向，团队马上给方案。",
    diceBearStyle: "notionists",
    agents: {
      moderator: { name: "顾总" },
      pm: { name: "COO-林特助" },
      architect: { name: "CTO-沈工" },
      designer: { name: "CVO-苏设计" },
      guard: { name: "合规官-秦律" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  jianghu: {
    id: "jianghu",
    name: "江湖风",
    emoji: "🗡️",
    tagline: "江湖路远，产品为刀",
    description: "帮主发话，军师堂主绣娘刑堂齐聚，兄弟们一起合计。",
    accent: "#7c2d12",
    moderatorTitle: "帮主",
    moderatorLabel: "帮主 · 主持",
    framing: "江湖智囊",
    consultingText: "江湖智囊议事中…",
    hintText: "帮主发话，兄弟们一起合计。",
    diceBearStyle: "open-peeps",
    agents: {
      moderator: { name: "帮主-风爷" },
      pm: { name: "军师-诸葛" },
      architect: { name: "堂主-铁手" },
      designer: { name: "绣娘-青鸾" },
      guard: { name: "刑堂-冷面" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  xianxia: {
    id: "xianxia",
    name: "修仙风",
    emoji: "☯️",
    tagline: "大道至简，产品亦如修行",
    description: "掌门起念，首座器峰丹青戒律共参产品大道。",
    accent: "#0ea5e9",
    moderatorTitle: "掌门",
    moderatorLabel: "掌门 · 主持",
    framing: "宗门智囊",
    consultingText: "宗门智囊论道中…",
    hintText: "掌门起念，众长老共参产品大道。",
    diceBearStyle: "lorelei",
    agents: {
      moderator: { name: "掌门-清虚" },
      pm: { name: "首座-云岚" },
      architect: { name: "器峰-墨阳" },
      designer: { name: "丹青-琉璃" },
      guard: { name: "戒律-玄铁" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  campus: {
    id: "campus",
    name: "校园风",
    emoji: "🎒",
    tagline: "这次小组作业，包在我身上！",
    description: "班长带头，学委电教宣传纪律组队，把方案当作业做漂亮。",
    accent: "#22c55e",
    moderatorTitle: "班长",
    moderatorLabel: "班长 · 主持",
    framing: "班委智囊",
    consultingText: "班委智囊开会中…",
    hintText: "班长带头，班委一起把方案做出来。",
    diceBearStyle: "fun-emoji",
    agents: {
      moderator: { name: "班长-小杨" },
      pm: { name: "学委-小琳" },
      architect: { name: "电教-大神" },
      designer: { name: "宣传-阿美" },
      guard: { name: "纪律-老班" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
  cyber: {
    id: "cyber",
    name: "赛博风",
    emoji: "🤖",
    tagline: "初始化产品矩阵…意识已连接",
    description: "核心 ORACLE 上线，逻辑体架构体美学体防火墙同步解构。",
    accent: "#06b6d4",
    moderatorTitle: "核心 ORACLE",
    moderatorLabel: "核心 · 主控",
    framing: "矩阵智囊",
    consultingText: "矩阵智囊同步中…",
    hintText: "核心已上线，开始解构你的产品构想。",
    diceBearStyle: "bottts",
    agents: {
      moderator: { name: "核心-ORACLE" },
      pm: { name: "逻辑体-PLAN" },
      architect: { name: "架构体-SYS" },
      designer: { name: "美学体-AESTH" },
      guard: { name: "防火墙-SENTRY" },
    },
    moderatorSystem: MODERATOR_SYSTEM_TPL,
  },
};

export const DEFAULT_STYLE: AgentStyleId = "harem";

export const AGENT_STYLE_LIST: AgentStyle[] = AGENT_ROLES
  ? Object.values(AGENT_STYLES)
  : [];

/** 安全取风格：非法 id 回退默认 */
export function getStyle(id?: string | null): AgentStyle {
  if (id && AGENT_STYLES[id as AgentStyleId]) {
    return AGENT_STYLES[id as AgentStyleId];
  }
  return AGENT_STYLES[DEFAULT_STYLE];
}

/** 默认头像本地路径（AI 生成写实立绘） */
export function styleAvatarPath(styleId: AgentStyleId, role: AgentId): string {
  return `/flow-v2/avatars/${styleId}/${role}.png`;
}

/** 头像未生成时的在线回退（DiceBear 风格化 SVG） */
export function diceBearAvatar(
  styleId: AgentStyleId,
  role: AgentId,
): string {
  const s = AGENT_STYLES[styleId].diceBearStyle;
  return `https://api.dicebear.com/7.x/${s}/svg?seed=${encodeURIComponent(
    `${styleId}-${role}`,
  )}&backgroundType=gradientLinear`;
}
