// F3-C 服务端确定性构建：从归一来源（ScreenSpec + ScreenMap + Journey + Blueprint）生成首版
// PrototypeSpec。纯离线、无 LLM 的启发式构建，作为后续任何 LLM 输出的结构化基准。
// 只被服务端 API 路由引用，不进入客户端 bundle。

import {
  prototypeFromSources,
  type PrototypeSourceScreenSpec,
  type PrototypeSourceScreenMap,
  type PrototypeSourceJourney,
  type PrototypeSourceBlueprint,
  type PrototypeSpec,
} from "./flow-prototype";

/**
 * 从归一来源确定性生成首版 PrototypeSpec。
 * 约束：
 * - 仅当四层来源齐全且 ScreenSpec 已 confirmed、未过期时调用（调用方已守卫）；
 * - 为 ScreenSpec 内每一个 screen 生成对应原型屏（布局块 + 状态）；
 * - 依据 Journey 步骤聚合交互流，映射 pivotalMoment 为关键时刻屏；
 * - 保留来源版本号以支持 stale 追踪；
 * - 全部内容证据为 assumption，绝不伪造 confirmed。
 */
export function buildPrototype(
  screenSpec: PrototypeSourceScreenSpec | null,
  screenMap: PrototypeSourceScreenMap | null,
  journey: PrototypeSourceJourney | null,
  blueprint: PrototypeSourceBlueprint | null,
  opts: { id?: string; projectId?: string } = {},
): { proto: PrototypeSpec } {
  if (!screenSpec || !screenMap || !journey || !blueprint) {
    throw new Error("schema:prototype-sources-not-ready");
  }
  return { proto: prototypeFromSources(screenSpec, screenMap, journey, blueprint, opts) };
}
