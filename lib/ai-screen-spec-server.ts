// F3-B 服务端确定性构建：从已确认 ScreenMap + ExperienceJourney + ProductBlueprint
// 生成首版界面规格契约（ScreenSpec）。这是纯离线、无 LLM 的启发式构建，
// 也作为后续任何 LLM 输出的结构化基准。只被服务端 API 路由引用，不进入客户端 bundle。

import type { ProductBlueprint } from "./flow-blueprint";
import type { ExperienceJourney } from "./flow-journey";
import type { ScreenMap } from "./flow-screen-map";
import type { ScreenSpec } from "./flow-screen-spec";
import {
  screenSpecFromScreenMapJourneyBlueprint,
  screenSpecSignature,
} from "./flow-screen-spec";

/**
 * 从已确认 ScreenMap + ExperienceJourney + ProductBlueprint 确定性生成首版 ScreenSpec。
 * 约束：
 * - 只允许 Blueprint / Journey / ScreenMap 均 status=confirmed、stale=false 时调用；
 * - 为 ScreenMap 内每一个 screen 全量生成对应规格，保持 id/name/type/导航语义一致；
 * - 每个 screen 有唯一 primaryOutcome、2–4 个信息层级、与 primaryActions/exitPaths 对齐的交互、
 *   每个已声明状态的设计、首版必要数据需求；
 * - Journey pivotalMoment 映射到承载该 step 的 screen，写入可感知的 successFeedback；
 * - 最多一个跨界面的高杠杆 unresolved decision；
 * - 全部内容证据为 assumption，带可追溯来源，绝不伪造 confirmed。
 */
export function buildScreenSpec(
  screenMap: ScreenMap,
  journey: ExperienceJourney,
  blueprint: ProductBlueprint,
  opts: { id?: string; projectId?: string } = {},
): ScreenSpec {
  return screenSpecFromScreenMapJourneyBlueprint(blueprint, journey, screenMap, opts);
}

export { screenSpecSignature };