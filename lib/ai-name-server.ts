// 服务端：用真实大模型（DeepSeek，OpenAI 兼容）为已丰满的产品给出一对建议名 + 描述。
// 只被 app/api/ai/name 路由引用，绝不进入客户端 bundle。

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

const SYSTEM_PROMPT = `你是品牌命名与定位专家。用户会给你一段已丰满的产品叙事（可能包含产品名、愿景、定位、目标用户、核心模块、分期等）。
请你为它给出一个「项目名 + 一句对外描述」，要求：

1. name：贴合业务、有记忆点的短名字，中文优先，可接受中英组合（如「宠遇 Pety」）。
   - 若叙事里用户已经提到明确的产品名/品牌名，直接沿用；否则新造。
   - 不要用「XX平台 / XX系统 / XX工具」这类后缀堆（除非品类确实如此）；尽量给出像「真实品牌」的名字（≤ 8 个字，英文词 ≤ 3 词，避免生僻字/拗口）。
   - 反套话：不要叫「智能XX助手 / 一站式XX / XX管家」这种放哪都成立的通用名，要为特定业务定制的名字。
2. description：一句话面向用户、可对外展示的产品描述（30~60 字），讲清它是谁、为谁解决什么、有何差异。不要喊空口号。

只输出一个 JSON 对象：
{
  "name": "<项目名>",
  "description": "<一句话描述>"
}
不要 markdown 代码块，不要任何多余文字。`;

export interface BrandNameSuggestion {
  name: string;
  description: string;
}

export async function suggestBrandName(
  productText: string,
  apiKey: string,
): Promise<BrandNameSuggestion> {
  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `产品叙事：\n${productText}` },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    console.error("DeepSeek name request failed, status:", res.status);
    throw new Error("AI 服务暂不可用，请稍后重试");
  }
  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "";
  const cleaned = content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Partial<BrandNameSuggestion>;
  return {
    name: typeof parsed?.name === "string" ? parsed.name.trim() : "",
    description: typeof parsed?.description === "string" ? parsed.description.trim() : "",
  };
}