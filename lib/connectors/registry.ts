// Connector 注册表（决策 19）：按 id 取连接器实例。
// 连接器实现位于 ./ima（obsidian/本地文件待桌面壳后追加）；此处静态导入并注册，
// 避免循环依赖（registry → ima 单向）。
import type { Connector } from "./types";
import { ImaConnector } from "./ima";
import { isPublicDeploy } from "@/lib/deploy-mode";

const REGISTRY = new Map<string, Connector>();

function registerConnector(c: Connector): void {
  // PRD 决策 14：依赖桌面运行态的连接器（Obsidian / 本地文件）在线上（public）部署下不注册 ——
  // 它们需要持久磁盘与长驻进程，Vercel 上既不可用，也不该向用户暴露入口。
  if (c.requiresDesktop && isPublicDeploy()) return;
  REGISTRY.set(c.id, c);
}

// 模块求值时注册全部已实现连接器
// P2-3：抽象已统一（含 requiresDesktop 能力标记）。桌面壳落地后，
// 只需在此追加 registerConnector(new ObsidianConnector()) 即可自动生效。
registerConnector(new ImaConnector());

export function getConnector<T extends Connector = Connector>(id: string): T | null {
  return (REGISTRY.get(id) as T | undefined) ?? null;
}

export function listConnectors(): Connector[] {
  return [...REGISTRY.values()];
}