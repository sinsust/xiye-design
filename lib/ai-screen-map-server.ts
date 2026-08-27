// F3-A 服务端确定性构建：从已确认 ProductBlueprint + ExperienceJourney 生成首版 ScreenMap。
// 这是纯离线、无 LLM 的启发式构建，也作为后续任何 LLM 输出的结构化基准。
// 只被服务端 API 路由引用，不进入客户端 bundle。

import type { ProductBlueprint } from "./flow-blueprint";
import type { ExperienceJourney } from "./flow-journey";
import type { ScreenMap } from "./flow-screen-map";
import { screenMapFromBlueprintJourney } from "./flow-screen-map";

/**
 * 从已确认 ProductBlueprint + 已确认 ExperienceJourney 确定性生成首版 ScreenMap。
 * 约束：
 * - 只允许 Blueprint、Journey 均 status=confirmed、stale=false 时调用；
 * - 对 4–7 个 Journey step 做全量映射；尽量收敛为 2–5 个主界面（page）；
 * - 辅助步骤优先放 drawer/modal/embedded_state；
 * - 独立 page 必须有不可被其它页面承担的主任务理由；
 * - 每个 screen 至少一个与职责相关的状态；最多一个高杠杆 unresolved decision；
 * - navigation 保证可从入口进入并沿核心闭环完成，不产生孤立 screen；
 * - 所有条目带来源（journeyStepIds/blueprintPaths），证据一律 assumption，绝不伪造用户已确认事实。
 */
export function buildScreenMap(
  blueprint: ProductBlueprint,
  journey: ExperienceJourney,
  opts: { id?: string; projectId?: string } = {},
): ScreenMap {
  return screenMapFromBlueprintJourney(blueprint, journey, opts);
}