// Connector 注册表（决策 19）：按 id 取连接器实例。
// 连接器实现位于 ./ima（obsidian/本地文件待桌面壳后追加）；此处静态导入并注册，
// 避免循环依赖（registry → ima 单向）。
import type { Connector } from "./types";
import { ImaConnector } from "./ima";

const REGISTRY = new Map<string, Connector>();

function registerConnector(c: Connector): void {
  REGISTRY.set(c.id, c);
}

// 模块求值时注册全部已实现连接器
registerConnector(new ImaConnector());

export function getConnector<T extends Connector = Connector>(id: string): T | null {
  return (REGISTRY.get(id) as T | undefined) ?? null;
}

export function listConnectors(): Connector[] {
  return [...REGISTRY.values()];
}