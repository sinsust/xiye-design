/**
 * AI 功能清单：功能级模型分配的 key 与中文标签。
 *
 * 新增 AI 调用点时，在这里登记一个 FeatureKey，并在 resolveLLM(userId, feature)
 * 处传参，即可让该功能支持「单独指定模型」。未登记/未指定的功能统一跟随「当前生效模型」。
 */

export type FeatureKey =
  | "flow-intent"
  | "flow-discover"
  | "flow-concept"
  | "flow-name"
  | "flow-panel"
  | "copy"
  | "brand-rewrite"
  | "brain-organize"
  | "brain-report"
  | "brain-ask"
  | "knowledge"
  | "table-analysis";

export interface FeatureMeta {
  key: FeatureKey;
  /** UI 展示名（中文） */
  label: string;
  /** UI 归类 */
  group: string;
}

export const FEATURES: FeatureMeta[] = [
  { key: "flow-intent", label: "一句话解构", group: "流程生成" },
  { key: "flow-discover", label: "需求发现", group: "流程生成" },
  { key: "flow-concept", label: "概念简报", group: "流程生成" },
  { key: "flow-name", label: "方案命名", group: "流程生成" },
  { key: "flow-panel", label: "会诊面板", group: "流程生成" },
  { key: "copy", label: "文案生成", group: "内容生成" },
  { key: "brand-rewrite", label: "品牌文案改写", group: "内容生成" },
  { key: "knowledge", label: "知识库条目生成", group: "内容生成" },
  { key: "brain-organize", label: "内容整理", group: "第二大脑" },
  { key: "brain-report", label: "周报生成", group: "第二大脑" },
  { key: "brain-ask", label: "智能问答", group: "第二大脑" },
  { key: "table-analysis", label: "表格分析", group: "表格分析" },
];

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);

export function isFeatureKey(v: string): v is FeatureKey {
  return (FEATURE_KEYS as string[]).includes(v);
}