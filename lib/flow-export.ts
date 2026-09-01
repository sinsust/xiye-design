// 收敛链导出：把 collab 阶段产出的 5 层领域对象（blueprint/journey/screenMap/screenSpec/
// prototype）渲染成结构化 Markdown 文档，随 generateProject 的 docs[] 一起进交付物 zip。
//
// 背景：此前这 5 层仅在 collab 内部自洽收敛，project-generator / agent-manifest 完全不消费，
// 用户在协同阶段花精力审阅确认的产物在交付门被整体丢弃。本模块让它们进入最终交付物，
// 使「做产品」链路真正闭环（P0 修复）。
//
// 约定：所有渲染只用对象已确认字段，null/空数组安全降级为「（无）」；不引入任何外部依赖。

import { getStyle, type AgentStyleId } from "./agent-styles";
import type { ProductBlueprint } from "./flow-blueprint";
import type { ExperienceJourney } from "./flow-journey";
import type { ScreenMap } from "./flow-screen-map";
import type { ScreenSpec } from "./flow-screen-spec";
import type { PrototypeSpec } from "./flow-prototype";

/**
 * 收敛视角注脚：所选「角色风格」的 framing / 主持视角会随收敛链 spec 文档进交付物，
 * 让蓝图/旅程/规格的叙事语气与用户在个人中心选定的风格一致（而非只改聊天气泡）。
 * 收敛链本身是确定性启发式（无 LLM），风格无法改变其结构化内容，但能统一文档的"口吻"。
 */
function buildStyleHeader(styleId: AgentStyleId | string): string {
  const style = getStyle(styleId as AgentStyleId);
  return `> 收敛视角：${style.framing}（由「${style.moderatorTitle}」统筹收敛）\n\n`;
}

type ConvergenceState = {
  blueprint: ProductBlueprint | null;
  journey: ExperienceJourney | null;
  screenMap: ScreenMap | null;
  screenSpec: ScreenSpec | null;
  prototype: PrototypeSpec | null;
};

export interface ExportedDoc {
  filename: string;
  title: string;
  content: string;
}

function mdList(items: string[]): string {
  if (!items.length) return "_（无）_\n";
  return items.map((i) => `- ${i}`).join("\n") + "\n";
}

/** 证据标记：confirmed 不标，其它（assumption/unresolved）以斜体标注 */
function ev(e?: string): string {
  return e && e !== "confirmed" ? ` _(${e})_` : "";
}

// —— F2-A 产品蓝图 ——
function buildBlueprintMd(b: ProductBlueprint): string {
  return `# 产品蓝图（Blueprint）

> 状态：${b.status} · 版本 v${b.version}${b.stale ? " · ⚠️ 已过期（上游决策变化，建议重建）" : ""}

## 产品定位
${b.productPositioning?.text ?? "—"}${ev(b.productPositioning?.evidence)}

## 目标用户
${b.targetUsers
  .map(
    (u) =>
      `### ${u.persona}\n- 场景：${u.context}\n- 核心需求：${u.primaryNeed}${ev(u.evidence)}`,
  )
  .join("\n\n")}

## 核心任务（Primary Job）
- 陈述：${b.primaryJob.statement}
- 成功时刻：${b.primaryJob.successMoment}

## MVP 范围
### Must Have
${mdList(b.mvpScope.mustHave.map((s) => s.text))}
### Should Have
${mdList(b.mvpScope.shouldHave.map((s) => s.text))}
### 明确不做（Out of Scope）
${mdList(b.mvpScope.explicitlyOutOfScope.map((s) => s.text))}

## 核心闭环
${b.coreLoop
  .map(
    (s, i) =>
      `${i + 1}. **${s.step}** — 用户：${s.userAction}；系统：${s.systemResponse}；价值：${s.userValue}`,
  )
  .join("\n")}

## 假设
${mdList(
  b.assumptions.map(
    (a) => `${a.text}（影响：${a.impact}；验证想法：${a.validationIdea}）${ev(a.status)}`,
  ),
)}

## 成功信号
${b.successSignals
  .map((s) => `- ${s.metric}${s.target ? `（目标 ${s.target}）` : ""}：${s.rationale}`)
  .join("\n")}

## 待决决策
${mdList(b.unresolvedDecisions.map((d) => `${d.question}${d.impactNote ? ` — ${d.impactNote}` : ""}`))}
`;
}

// —— F2-B 用户体验旅程 ——
function buildJourneyMd(j: ExperienceJourney): string {
  const steps = [...j.steps].sort((a, b) => a.order - b.order);
  return `# 用户体验旅程（Journey）

> 状态：${j.status} · 版本 v${j.version}${j.stale ? " · ⚠️ 已过期" : ""}

## 首要场景
- 用户：${j.primaryScenario.user}
- 触发：${j.primaryScenario.trigger}
- 期待结果：${j.primaryScenario.desiredOutcome}

## 旅程步骤
${steps
  .map(
    (s) =>
      `### 步骤 ${s.order}：${s.userGoal}\n- 用户动作：${s.userAction}\n- 系统行为：${s.systemBehavior}\n- 可见结果：${s.visibleOutcome}${s.frictionOrRisk ? `\n- ⚠️ 摩擦/风险：${s.frictionOrRisk}` : ""}`,
  )
  .join("\n\n")}

## 关键时刻
${j.pivotalMoment ? `- ${j.pivotalMoment.rationale}（成功标准：${j.pivotalMoment.successCriteria}）` : "_（无）_"}

## 边界 / 异常
${mdList(
  j.edgeCases.map(
    (e) =>
      `${e.trigger} → 系统：${e.systemResponse}；用户恢复：${e.userRecovery}（优先级 ${e.priority}）`,
  ),
)}

## 开放决策
${mdList(j.openDecisions.map((d) => d.question))}
`;
}

// —— F3-A 信息架构 / 页面地图 ——
function buildScreenMapMd(m: ScreenMap): string {
  return `# 信息架构 / 页面地图（Screen Map）

> 状态：${m.status} · 版本 v${m.version}${m.stale ? " · ⚠️ 已过期" : ""}

## 界面清单
${m.screens
  .map(
    (s) =>
      `### ${s.name}（${s.type}）\n- 使命：${s.purpose}\n- 入口：${s.entryPoints.length ? s.entryPoints.join("、") : "主入口"}\n- 出口：${s.exitPaths.join("、") || "—"}\n- 关键信息：${s.keyInformation}\n- 主操作：\n${mdList(s.primaryActions)}\n- 状态：${s.states.join("、")}${ev(s.evidence)}`,
  )
  .join("\n\n")}

## 关键跳转
${mdList(
  m.navigation.map(
    (n) =>
      `${n.action}：${n.fromScreenId} → ${n.toScreenId}${n.condition ? `（条件：${n.condition}）` : ""}`,
  ),
)}

## 待决决策
${mdList(m.unresolvedDecisions.map((d) => d.question))}
`;
}

// —— F3-B 界面规格契约 ——
function buildScreenSpecMd(s: ScreenSpec): string {
  return `# 界面规格契约（Screen Spec）

> 状态：${s.status} · 版本 v${s.version}${s.stale ? " · ⚠️ 已过期" : ""}

${s.screens
  .map(
    (sc) => `## ${sc.name}（${sc.type}）
**主结果**：${sc.primaryOutcome}${sc.pivotalMomentRole ? ` · 关键时刻角色：${sc.pivotalMomentRole}` : ""}

### 信息层级
${sc.informationHierarchy
  .map(
    (h) =>
      `- [${h.level}] ${h.title}：${h.purpose}${h.contentItems.length ? `（含：${h.contentItems.join("、")}）` : ""}`,
  )
  .join("\n")}

### 交互契约
${sc.interactions
  .map(
    (i) =>
      `- **${i.trigger}** → 意图：${i.userIntent}；系统：${i.systemResponse}；反馈：${i.successFeedback}${i.nextScreenId ? `；跳转：${i.nextScreenId}` : ""}${i.requiresConfirmation ? "；需二次确认" : ""}${i.preservesDraft ? "；保留草稿" : ""}`,
  )
  .join("\n")}

### 状态设计
${sc.stateDesign
  .map(
    (st) =>
      `- ${st.state}：${st.userMessage}${st.primaryAction ? `；动作：${st.primaryAction}` : ""}${st.recoveryPath ? `；恢复：${st.recoveryPath}` : ""}`,
  )
  .join("\n")}

### 数据需求
${sc.dataNeeds
  .map(
    (d) =>
      `- ${d.label}（${d.sensitivity} / ${d.source}）：${d.purpose}${d.requiredForFirstRelease ? "；首版必需" : ""}`,
  )
  .join("\n")}

### 开放问题
${mdList(sc.openQuestions.map((q) => q.question))}
`,
  )
  .join("\n")}

## 待决决策
${mdList(s.unresolvedDecisions.map((d) => d.question))}
`;
}

// —— F3-C 可点击原型规格 ——
function buildPrototypeMd(p: PrototypeSpec): string {
  return `# 可点击原型规格（Prototype）

> 状态：${p.status} · 模式：${p.prototypeMode} · 入口屏幕：${p.entryScreenId}

## 屏幕
${p.screens
  .map((sc) => {
    const blocks = [...sc.layoutBlocks].sort((a, b) => a.priority - b.priority);
    return `### ${sc.name}\n${blocks
      .map((b) => `- [${b.role}] ${b.title ?? ""}：${b.purpose}`)
      .join("\n")}\n- 状态：${sc.prototypeStates
      .map((st) => `${st.state}（${st.visibleMessage}${st.recoveryAction ? `；恢复：${st.recoveryAction}` : ""}）`)
      .join("；")}`;
  })
  .join("\n\n")}

## 流程
${p.flows
  .map(
    (f) =>
      `### ${f.name}\n${mdList(
        f.interactions.map(
          (i) =>
            `${i.triggerLabel}${i.targetScreenId ? ` → ${i.targetScreenId}` : ""}${i.targetState ? ` @ ${i.targetState}` : ""}${i.expectedOutcome ? `：${i.expectedOutcome}` : ""}`,
        ),
      )}`,
  )
  .join("\n\n")}

## 测试场景
${p.testScenarios.map((t) => `- **${t.title}**：\n${mdList(t.successCriteria)}`).join("\n")}
`;
}

/**
 * 把收敛链（若存在）渲染为交付文档列表。
 * 仅当对应对象非 null 时才产出文档——匿名/未生成链路的用户不会得到空文件。
 * @param styleId 可选，传入则每篇 spec 顶部加「收敛视角」注脚，使文档语气与所选角色风格一致。
 */
export function buildConvergenceDocs(state: ConvergenceState, styleId?: AgentStyleId | string | null): ExportedDoc[] {
  const docs: ExportedDoc[] = [];
  const styleHeader = styleId ? buildStyleHeader(styleId) : "";
  if (state.blueprint) {
    docs.push({ filename: "BLUEPRINT.md", title: "产品蓝图", content: styleHeader + buildBlueprintMd(state.blueprint) });
  }
  if (state.journey) {
    docs.push({ filename: "USER_JOURNEY.md", title: "用户体验旅程", content: styleHeader + buildJourneyMd(state.journey) });
  }
  if (state.screenMap) {
    docs.push({
      filename: "INFORMATION_ARCHITECTURE.md",
      title: "信息架构与页面地图",
      content: styleHeader + buildScreenMapMd(state.screenMap),
    });
  }
  if (state.screenSpec) {
    docs.push({ filename: "SCREEN_SPEC.md", title: "界面规格契约", content: styleHeader + buildScreenSpecMd(state.screenSpec) });
  }
  if (state.prototype) {
    docs.push({ filename: "PROTOTYPE.md", title: "可点击原型规格", content: styleHeader + buildPrototypeMd(state.prototype) });
  }
  return docs;
}
