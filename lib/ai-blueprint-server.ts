// 服务端：把 F1-A 产品创意 Brief 收敛为一份可审阅、可追溯、可执行的 ProductBlueprint。
// 只被 app/api/ai/blueprint 引用，绝不进入客户端 bundle。
//
// 边界（F2-A 硬约束）：
// - Blueprint 是基于「已确认方案 + 用户选择 + 方案草案 + 未决问题」自动收敛，不是用户逐项填写的表单；
// - 生成是确定性启发式（离线、无 LLM 依赖、幂等重建），保证「绝不编造证据 / 绝不伪装用户确认」：
//   confirmed = 用户已表态/决策已落定，assumption = AI 归纳待确认，unresolved = 仍需用户选择；
// - 不接入外部检索 / 竞品研究 / 代码生成 / 第二大脑沉淀（F2-B / F3 的事，本阶段不做）；
// - schema 校验失败由路由层转换为统一错误协议并保留旧 Blueprint。
//
// 说明：V1 / rebuild 都以纯启发式生成（blueprintFromConceptBrief）。这样即使 LLM / 网络不可用，
// 也能稳定产出结构一致、可追溯、无伪造的首版蓝图，满足 F0-A「超时 + 本地兜底」铁则。

import { type ProductConceptBrief } from "@/lib/flow-concept";
import {
  type ProductBlueprint,
  blueprintFromConceptBrief,
} from "@/lib/flow-blueprint";

/**
 * 生成/重建一份蓝图。
 * @param concept 已形成初版方案且用户已表态的 F1-A Brief（调用方须先用 getConceptReadiness(concept).canProceed 把关）
 * @returns 新蓝图（version 由 reconcile/init 层统一编排）
 */
export function buildBlueprint(concept: ProductConceptBrief): ProductBlueprint {
  return blueprintFromConceptBrief(concept);
}