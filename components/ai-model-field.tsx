"use client";

import { useId, useState } from "react";

/**
 * 「模型 id」输入框 + 从厂商实时拉取可用模型的下拉。
 *
 * 为什么要实时拉：内置候选（lib/llm/providers.ts）只是手输提示，厂商会下架改名 ——
 * kimi-k2-0905-preview 已经 404，照着旧清单填就是「配了 key 却全都不可用」。
 * 拉不到清单（自建端点没实现 /models）时不拦人：照样手填，只把原因写出来。
 */
export function ModelIdField({
  label = "模型 id",
  value,
  onChange,
  baseUrl,
  apiKey,
  storedId,
  presets = [],
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  baseUrl: string;
  apiKey?: string;
  /** 已存配置：留空 API Key 时用库里那把去查 */
  storedId?: string;
  presets?: string[];
}) {
  const listId = useId();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function pull() {
    if (!baseUrl.trim()) {
      setNote("先填 Base URL");
      return;
    }
    setLoading(true);
    setNote(null);
    try {
      const r = await fetch("/api/ai/models/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey?.trim() || null, id: storedId }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) {
        setNote(String(d?.message ?? d?.error ?? "拉取失败"));
        return;
      }
      const got: string[] = Array.isArray(d?.models) ? d.models.map(String) : [];
      if (got.length === 0) {
        setModels(null);
        setNote(`该端点没给出模型清单${d?.skipped ? `（${d.skipped}）` : ""}，可继续手填`);
        return;
      }
      setModels(got);
      setNote(`可用 ${got.length} 个，已填进下拉`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "拉取失败");
    } finally {
      setLoading(false);
    }
  }

  const options = models ?? presets;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-muted-foreground">{label}</label>
        <button
          type="button"
          onClick={pull}
          disabled={loading}
          title="向该服务商查询你的账号实际能用哪些模型"
          className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition hover:bg-muted/70 hover:text-foreground disabled:opacity-50"
        >
          {loading ? "查询中…" : "拉取可用模型"}
        </button>
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        placeholder="可从候选里选，也可自填"
        className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      <datalist id={listId}>
        {options.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>
      {note && <p className="mt-1 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
