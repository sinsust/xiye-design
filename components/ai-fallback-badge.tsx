"use client";

import { AlertTriangle } from "lucide-react";

/**
 * AI 降级角标（B4）：一次 AI 操作实际走了「启发式兜底」（未命中模型）时显示，
 * 避免把本地规则产出当成真实模型结论呈现给用户。
 *
 * 服务端已由各 handler 在响应体 `flowMeta.fallbackUsed` 标记（flow-ai-types.ts），
 * 此前前端零消费 → 用户无法分辨「AI 生成」与「规则兜底」。本组件统一呈现。
 * 视觉复用周报既有的「未启用 AI 摘要」样式（bg-warning/10 + text-warning）。
 */
export function AiFallbackBadge({
  className,
  label = "启发式兜底",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-[var(--radius)] bg-warning/10 px-1.5 py-0.5 text-[10px] font-normal text-warning",
        className ?? "",
      ].join(" ")}
      title="本次内容由本地启发式规则生成，未调用 AI 模型；配置 LLM_MODEL_*（API Key / Base URL / Model ID 三者齐备）后自动改用 AI"
    >
      <AlertTriangle className="size-3" />
      {label}
    </span>
  );
}
