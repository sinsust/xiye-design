export type KnowledgeType =
  | "skill"
  | "service"
  | "repository"
  | "prompt"
  | "pattern"
  | "design"
  | "reference";

export interface KnowledgeEntry {
  slug: string;
  type: KnowledgeType;
  name: string;
  summary: string;
  useCase?: string;
  stack?: string[];
  related?: string[];
  tags?: string[];
  status?: string;
  updated?: string;
  /** GitHub / 仓库地址（如 https://github.com/...），方便随时贴给 AI 工具 */
  repoUrl?: string;
  /** 官网 / 文档地址 */
  source?: string;
  /** 本地地址路径（绝对路径，可一键复制） */
  localPath?: string;
  /** 是否为「新增条目」后用户自建的条目（仅此类允许删除） */
  userAdded?: boolean;
  body: string;
}

export interface KnowledgeTypeMeta {
  id: KnowledgeType;
  label: string;
  folder: string;
}

// 与 knowledge/_meta/ORGANIZATION.md 的分类体系保持一致：
// skill 只是 7 类中的一类，知识库是「素材库」，data/*.ts 才是「精选配置」。
// 本文件不引入任何服务端依赖，client / server 均可安全引用。
export const KNOWLEDGE_TYPE_META: KnowledgeTypeMeta[] = [
  { id: "skill", label: "技能", folder: "01-skills" },
  { id: "service", label: "服务", folder: "02-services" },
  { id: "repository", label: "仓库", folder: "03-repositories" },
  { id: "prompt", label: "提示词", folder: "04-prompts" },
  { id: "pattern", label: "架构范式", folder: "05-patterns" },
  { id: "design", label: "设计参考", folder: "06-design" },
  { id: "reference", label: "官方资料", folder: "07-references" },
];
