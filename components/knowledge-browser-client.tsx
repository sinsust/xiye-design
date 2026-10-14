"use client";

import { useEffect, useState } from "react";
import { KnowledgeBrowser } from "@/components/knowledge-browser";
import type { KnowledgeEntry } from "@/lib/knowledge-types";

// 浏览器数据层下的知识库列表：内置条目来自静态快照、用户条目来自本机库，
// 两者都由 /api/knowledge 的 GET 汇总（在 sw 内完成，见 lib/api-handlers/knowledge/_root.ts）。
export function KnowledgeBrowserFromClient() {
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/knowledge");
        const data = await res.json().catch(() => null);
        if (!alive) return;
        if (!res.ok) {
          setError(String(data?.message ?? data?.error ?? res.status));
          return;
        }
        setEntries(Array.isArray(data?.entries) ? (data.entries as KnowledgeEntry[]) : []);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 取不到就明说，不显示成「知识库是空的」
  if (error) {
    return (
      <p className="py-8 text-sm text-destructive" role="alert">
        知识库没能加载：{error}
      </p>
    );
  }
  if (!entries) {
    return <p className="py-8 text-sm text-muted-foreground">加载中…</p>;
  }
  return <KnowledgeBrowser entries={entries} />;
}
