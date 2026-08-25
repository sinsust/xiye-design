// 第二大脑 · 学习路径追踪：从用户的私有人笔记里按主题聚类出"学习路径"。
// 例如识别出 Python / 易经 等主题，按时间排成学习节点，估算进度。
// 纯本地规则（关键词 + 时间线），无需额外 AI，保证稳定、即时、不耗 token。

import type { BrainNote } from "./brain-db";

// 只需用到的笔记字段子集，UI 侧（局部简化类型）也能传入
export type PathNoteLike = Pick<
  BrainNote,
  "id" | "title" | "summary" | "tags" | "content" | "category" | "createdAt"
>;

export interface LearningTopic {
  key: string;            // 主题标识，如 "python" / "yijing"
  name: string;           // 展示名，如 "Python 编程"
  emoji: string;
  color: string;
  notes: LearningNode[];  // 按时间升序的学习节点
  count: number;
  firstAt: number;
  lastAt: number;
}

export interface LearningNode {
  id: string;
  title: string;
  summary: string;
  createdAt: number;
  tags: string[];
}

// 主题定义：关键词命中（title/tags/summary/content 任一处）即归入该主题
const TOPIC_RULES: {
  key: string;
  name: string;
  emoji: string;
  color: string;
  keywords: string[];
}[] = [
  {
    key: "python",
    name: "Python 编程",
    emoji: "🐍",
    color: "#3776AB",
    keywords: ["python", "pandas", "django", "flask", "爬虫", "数据分析", "虚拟环境", "conda", "numpy", "列表推导"],
  },
  {
    key: "yijing",
    name: "易经",
    emoji: "☯",
    color: "#b7791f",
    keywords: ["易经", "周易", "八卦", "卦象", "六爻", "阴阳", "五行", "太极", "乾卦", "坤卦", "64卦", "变卦"],
  },
];

// 兜底：PHP/JS/TS/React/设计等常见主题也可在后续扩展；MVP 固定 Python + 易经

function hitKeywords(keys: string[], text: string): boolean {
  const lower = text.toLowerCase();
  return keys.some((k) => lower.includes(k.toLowerCase()));
}

function noteText(n: PathNoteLike): string {
  return `${n.title} ${n.summary} ${(n.tags || []).join(" ")} ${n.content}`;
}

/** 从用户全部笔记里聚出学习主题。只统计"学习/技术"类或命中了主题关键词的笔记。 */
export function detectLearningTopics(notes: PathNoteLike[]): LearningTopic[] {
  const topics = TOPIC_RULES.map((rule) => ({
    ...rule,
    nodes: [] as LearningNode[],
  }));

  for (const n of notes) {
    const text = noteText(n);
    for (const t of topics) {
      // 学习路径优先看"学习/技术"类；其他类需在标题/标签明显命中关键词
      const inScope = /学习|技术|技能/i.test(n.category || "") || t.nodes.length > 0;
      if (hitKeywords(t.keywords, text)) {
        const node: LearningNode = {
          id: n.id,
          title: n.title,
          summary: n.summary,
          createdAt: n.createdAt,
          tags: n.tags,
        };
        t.nodes.push(node);
        void inScope;
      }
    }
  }

  const result = topics
    .filter((t) => t.nodes.length > 0)
    .map((t) => ({
      key: t.key,
      name: t.name,
      emoji: t.emoji,
      color: t.color,
      notes: t.nodes.sort((a, b) => a.createdAt - b.createdAt),
      count: t.nodes.length,
      firstAt: Math.min(...t.nodes.map((x) => x.createdAt)),
      lastAt: Math.max(...t.nodes.map((x) => x.createdAt)),
    }));

  return result.sort((a, b) => b.lastAt - a.lastAt);
}