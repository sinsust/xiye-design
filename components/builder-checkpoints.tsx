"use client";

// M2-C 检查点面板：保存当前工作区 / 列出历史 / 一键回退。
// 挂载于 builder 左侧栏底部。检查点载荷复用 project-snapshot 的
// captureSnapshot / applySnapshot（与「保存项目」同一套快照格式）。

import { useCallback, useEffect, useState } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { captureSnapshot, applySnapshot } from "@/lib/project-snapshot";
import { History, RotateCcw, Trash2, Save, Loader2 } from "lucide-react";

interface Checkpoint {
  id: string;
  projectId: string;
  userId: string;
  data: string; // JSON 字符串 {version,flow,skeleton}
  label: string;
  createdAt: number;
}

/** 从检查点载荷解析轻量摘要（页面数 / 组件数 / 风格），供 diff 视图展示 */
function summarize(data: string): { pages: number; components: number; style: string } {
  try {
    const snap = JSON.parse(data) as { flow?: Record<string, unknown> };
    const flow = snap.flow ?? {};
    const bp = (flow.pageBlueprint as Array<{ pageSlug: string }>) ?? [];
    const pages = new Set(bp.map((b) => b.pageSlug)).size;
    const style = (flow.visualStyle as string) ?? "—";
    return { pages, components: bp.length, style };
  } catch {
    return { pages: 0, components: 0, style: "—" };
  }
}

export function BuilderCheckpoints({ projectId }: { projectId: string | null }) {
  const [list, setList] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/projects/${projectId}/checkpoints`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setList(d.checkpoints ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!projectId || saving) return;
    setSaving(true);
    try {
      const snap = captureSnapshot();
      const r = await fetch(`/api/projects/${projectId}/checkpoints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: snap, label: label.trim() }),
      });
      if (r.ok) {
        setLabel("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const restore = (cp: Checkpoint) => {
    try {
      const snap = JSON.parse(cp.data);
      applySnapshot(snap);
    } catch {
      /* 忽略损坏数据 */
    }
  };

  const remove = async (cid: string) => {
    if (!projectId) return;
    const r = await fetch(`/api/projects/${projectId}/checkpoints/${cid}`, {
      method: "DELETE",
    });
    if (r.ok) setList((prev) => prev.filter((c) => c.id !== cid));
  };

  if (!projectId) {
    return (
      <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        保存项目后可在此创建检查点
      </div>
    );
  }

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <History className="size-3.5" />
        检查点
      </div>
      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="备注（可选）"
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          保存
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无检查点</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((cp) => {
            const s = summarize(cp.data);
            return (
              <li
                key={cp.id}
                className="rounded-lg border border-border/70 bg-background px-2 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {cp.label || new Date(cp.createdAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => restore(cp)}
                    title="回退到此检查点"
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(cp.id)}
                    title="删除检查点"
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {s.pages} 页 · {s.components} 组件 · 风格 {s.style}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
