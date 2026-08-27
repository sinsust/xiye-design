"use client";

// 把「访谈对话」同步进产品创意 Brief 的客户端助手。
// - 有已保存项目（pid）→ 调服务端受控操作 build/update（LLM 或离线启发式），并按 userId 幂等；
// - 尚无项目 → 先在本地用纯启发式建一份（不编造：只落能确定的、其余进 openQuestions），
//   待项目自动保存后随快照落库，后续轮次再走服务端正常更新。
// 失败一律静默保留旧 Brief（F0-A 语义：不清空用户内容、不伪装成功）。

import type { DiscoverMessage } from "@/lib/ai-discover";
import {
  type ConceptBriefInputs,
  type ProductConceptBrief,
  buildConceptHeuristic,
  emptyConceptBrief,
  getConceptReadiness,
  mergeConceptBrief,
} from "@/lib/flow-concept";
import { newRequestId } from "@/lib/flow-ai-types";

interface SyncOptions {
  messages: DiscoverMessage[];
  prev: ProductConceptBrief | null;
  projectId: string; // 可为空串：尚无保存项目
  setBrief: (b: ProductConceptBrief | null) => void;
  signal?: AbortSignal;
}

/** 从对话消息提取概念 Brief 输入（原始想法 = 首条用户消息；回答 = 后续用户消息；方向 = 分支选择） */
export function messagesToConceptInputs(messages: DiscoverMessage[]): ConceptBriefInputs {
  const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content.trim());
  const idea = userMsgs[0] ?? "";
  // 首条之后的用户回答作为「访谈回答」；含已知方向的视为已确认方向
  const answers = userMsgs.slice(1).filter(Boolean);
  const directions = answers.filter((a) => /方向|选|做|按这个|就它|可以|ok|OK|是|同意|轻量|完整|渐进/.test(a)).slice(0, 3);
  return { idea, answers, directions };
}

/** 本地启发式构建（无项目 / 无可信 LLM 时兜底），保证「绝不编造」 */
export function buildConceptLocal(inputs: ConceptBriefInputs, prev: ProductConceptBrief | null): ProductConceptBrief {
  const base = prev ?? emptyConceptBrief();
  const heuristic = buildConceptHeuristic(inputs, base);
  const merged = mergeConceptBrief(base, heuristic, inputs);
  const next = { ...merged, version: prev ? prev.version + 1 : 1 };
  return ensureQuestions(next);
}

function ensureQuestions(brief: ProductConceptBrief): ProductConceptBrief {
  const existing = new Set(brief.openQuestions.map((q) => q.toLowerCase()));
  const missing: string[] = [];
  if (!brief.targetUsers.trim()) missing.push("目标用户是谁？他们的典型痛点是什么？");
  if (!brief.primaryScenario.trim()) missing.push("核心使用场景是什么？用户在什么时刻、为了什么用它？");
  if (!brief.problemStatement.trim()) missing.push("它到底解决用户的什么问题？");
  if (!brief.valueProposition.trim()) missing.push("一句话，用户为什么非它不可？");
  if (!brief.coreCapabilities.length) missing.push("MVP 阶段必须有哪 1~3 个核心能力？");
  const toAdd = missing.filter((q) => !existing.has(q.toLowerCase()));
  if (!toAdd.length) return brief;
  return { ...brief, openQuestions: [...brief.openQuestions, ...toAdd] };
}

/**
 * 一轮对话结束后的概念同步：更新 store 中的 conceptBrief（面板随之刷新）。
 * 返回是否成功（供调用方决定是否展示同步态）。
 */
export async function syncConcept(opts: SyncOptions): Promise<boolean> {
  const { messages, prev, projectId, setBrief, signal } = opts;
  if (!messages.some((m) => m.role === "user")) return false;
  const inputs = messagesToConceptInputs(messages);
  const operation = prev ? "update_concept_brief" : "build_concept_brief";

  const apply = (next: ProductConceptBrief | null) => {
    setBrief(next);
    return Boolean(next);
  };

  if (!projectId) {
    // 尚无保存项目：本地启发式（不调网络，保证可用性）
    const local = buildConceptLocal(inputs, prev);
    return apply(local);
  }

  try {
    const res = await fetch("/api/ai/concept-brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        operationId: newRequestId("op"),
        operation,
        brief: prev,
        inputs,
      }),
      signal,
    });
    const data = await res.json().catch(() => null);
    const briefOut = data?.data?.brief as ProductConceptBrief | undefined;
    if (!res.ok || !briefOut) {
      // 失败保留旧 Brief（F0-A）
      return apply(prev);
    }
    return apply(briefOut);
  } catch {
    // 网络 / 取消：保留旧值
    return apply(prev);
  }
}

export { getConceptReadiness };