// F2-B 服务端确定性构建：从已确认 ProductBlueprint 生成首版 ExperienceJourney。
// 这是纯离线、无 LLM 的启发式构建，也作为后续任何 LLM 输出的结构化基准。
// 只被服务端 API 路由引用，不进入客户端 bundle。

import type { ProductBlueprint } from "./flow-blueprint";
import type { ExperienceJourney } from "./flow-journey";
import { journeyFromBlueprint } from "./flow-journey";

/**
 * 从已确认 ProductBlueprint 确定性生成首版 ExperienceJourney。
 * 约束：
 * - 只允许 Blueprint status=confirmed、stale=false 时调用；
 * - 生成 4–7 个顺序步骤，每个步骤含用户目标、用户动作、系统行为、可见结果；
 * - 生成一个 pivotalMoment；
 * - 生成 3–5 个与核心旅程直接相关的边界状态；
 * - 生成最多一个高杠杆 openDecision；
 * - 所有条目带明确来源（blueprintPath），证据一律标为 assumption（对 Blueprint 的展开归纳）；
 * - 绝不伪造用户已确认事实。
 */
export function buildJourney(
  blueprint: ProductBlueprint,
  opts: { id?: string; projectId?: string } = {},
): ExperienceJourney {
  return journeyFromBlueprint(blueprint, opts);
}
