import type { BrainTaskPriority } from "@/lib/brain-db";
import type { BrainTask, BrainStrategy } from "@/lib/brain-db";

export type AskMode = "local" | "ima" | "mixed";
export interface AskSourceItem {
  noteId: string;
  title: string;
  source: "local" | "ima";
  sourceName?: string;
  relevance?: number;
}
export interface QaItem {
  q: string;
  a: string;
  sources: AskSourceItem[];
}
export interface SearchHits {
  noteHits: BrainNote[];
  taskHits: BrainTask[];
  strategyHits: BrainStrategy[];
  snippetHits: BrainNote[];
  total: number;
}

export interface BrainNote {
  id: string;
  source: string;
  title: string;
  content: string;
  category: string;
  summary: string;
  tags: string[];
  related: string[];
  // 版本链
  parentId: string | null;
  version: number;
  superseded: boolean;
  // 代码片段
  isSnippet: boolean;
  language: string | null;
  codeContent: string | null;
  // AI 整理完整结构化结果（OrganizedNote JSON 字符串）；null 表示未整理
  struct: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OrganizedActionItem {
  text: string;
  owner: string;
  dueDate: string | null;
  priority: BrainTaskPriority;
  strategyIndex?: number;
  // P0：是否为此任务创建一条独立提醒（确认写入时生效）
  makeReminder?: boolean;
}

export interface OrganizedMetric {
  label: string;
  value: string;
}
export interface OrganizedProblemDomain {
  domain: string;
  status: string;
  conclusion: string;
}
export interface OrganizedStrategy {
  angle: string;
  logic: string;
}

export interface OrganizedDraft {
  title: string;
  category: string;
  // 输入类型：meeting/clip/jotting/markdown/snippet/task
  type?: string;
  summary: string;
  tags: string[];
  related: string[];
  relatedReason: string;
  actionItems: OrganizedActionItem[];
  strategies: { title: string; description: string }[];
  decisions: string[];
  attendees: string[];
  metrics: OrganizedMetric[];
  problemDomains: OrganizedProblemDomain[];
  openQuestions: string[];
  strategy: OrganizedStrategy[];
  isMeeting: boolean;
  isSnippet: boolean;
  language: string;
  codeContent: string;
  // 复制粘贴/网页类：出处或来源链接
  source?: string;
  // 核心观点 / 要点（clip 与 jotting 用）
  keyPoints?: { point: string }[];
  // 我的批注 / 启发 / 灵感（clip 与 jotting 用）
  insights?: string[];
  // 深度重写后的规范正文（Markdown）；空字符串表示未重写
  rewritten: string;
}

/** 自适应卡片输入：与 OrganizedDraft 结构化字段对齐 */
export interface StructViewData {
  type?: string;
  attendees?: string[];
  metrics?: OrganizedMetric[];
  problemDomains?: OrganizedProblemDomain[];
  openQuestions?: string[];
  actionItems?: OrganizedActionItem[];
  strategy?: OrganizedStrategy[];
  decisions?: string[];
  source?: string;
  keyPoints?: { point: string }[];
  insights?: string[];
}

export const TYPE_LABEL: Record<string, string> = {
  meeting: "会议纪要",
  clip: "阅读摘录",
  jotting: "灵感碎片",
  markdown: "文档",
  snippet: "代码片段",
  task: "待办清单",
};