/**
 * 支持的服务商模板：供「添加模型」表单预填 base_url 与候选模型。
 *
 * 全部按 OpenAI 兼容协议接入（`${baseUrl}/chat/completions`）。
 * keyRequired=false 的服务商（如局域网/自建端点）允许不填 API Key。
 */

export type ModelProvider = "qwen" | "deepseek" | "kimi" | "openai" | "custom";

export interface ProviderTemplate {
  id: ModelProvider;
  name: string;
  /** OpenAI 兼容 base（不含 /chat/completions） */
  baseUrl: string;
  /** 候选模型名（供下拉/筛选，仍允许自填） */
  models: string[];
  /** 是否必须填写 API Key */
  keyRequired: boolean;
  /** 获取 Key 的去向说明 */
  keyHint?: string;
}

export const PROVIDERS: ProviderTemplate[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyRequired: true,
    keyHint: "在 platform.deepseek.com 创建 API Key",
  },
  {
    id: "qwen",
    name: "通义千问（DashScope 兼容）",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: ["qwen-max", "qwen-plus", "qwen-turbo", "qwen3-max"],
    keyRequired: true,
    keyHint: "在阿里云百炼控制台创建 API Key",
  },
  {
    id: "kimi",
    name: "Kimi（Moonshot）",
    baseUrl: "https://api.moonshot.cn/v1",
    models: ["kimi-k2-0905-preview", "moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyRequired: true,
    keyHint: "在 platform.moonshot.cn 创建 API Key",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"],
    keyRequired: true,
    keyHint: "在 platform.openai.com 创建 API Key",
  },
  {
    id: "custom",
    name: "自定义（OpenAI 兼容）",
    baseUrl: "",
    models: [],
    keyRequired: false,
    keyHint: "任何 OpenAI 兼容端点均可；不需要鉴权时可留空 Key",
  },
];

export function getProvider(id: string): ProviderTemplate | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function isModelProvider(v: string): v is ModelProvider {
  return PROVIDERS.some((p) => p.id === v);
}