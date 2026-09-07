// M4 Connector 抽象（决策 19 / 13 / 14）：个人知识源统一接口。
// 现阶段承载 ima（只读，写适配见阶段 B），并预留 obsidian / 本地文件（桌面壳后接入）。
// 设计原则：read 产出可注入问答的 context + 带来源标注的引用；write 返回落点引用。
// 任何连接器能力不可用时，调用方应降级而非崩溃（ask.ts 既有降级语义）。

export interface ConnectorSource {
  noteId: string;
  title: string;
  source: string; // 连接器 id，如 "ima"
  sourceName?: string;
  relevance?: number;
  text?: string;
}

export interface ConnectorReadResult {
  context: string;
  sources: ConnectorSource[];
}

export interface ConnectorReadContext {
  question?: string;
  kbId?: string; // 可选：限定单个知识库/来源
}

export interface ConnectorWriteContext {
  action: "create" | "append";
  kbId?: string;
  title?: string;
  content?: string;
  noteId?: string; // append 时的目标（connection 内部 id）
}

export interface ConnectorWriteResult {
  ok: boolean;
  noteId?: string;
  noteUrl?: string;
  degraded?: boolean; // 能力可用但凭据/远端异常导致降级
  detail?: string;
}

export interface ConnectorStatus {
  ok: boolean;
  available: boolean; // 是否已配置/可连接
  label?: string;
  message?: string;
}

export interface Connector {
  id: string;
  label: string;
  caps: { read: boolean; write: boolean };
  status(creds?: unknown): Promise<ConnectorStatus>;
  read?(ctx: ConnectorReadContext, creds?: unknown): Promise<ConnectorReadResult>;
  write?(ctx: ConnectorWriteContext, creds?: unknown): Promise<ConnectorWriteResult>;
}