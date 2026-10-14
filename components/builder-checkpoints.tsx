"use client";

// M2-C 检查点面板：保存当前工作区 / 列出历史 / 一键回退。
// 挂载于 builder 左侧栏底部。检查点载荷复用 project-snapshot 的
// captureSnapshot / applySnapshot（与「保存项目」同一套快照格式）。
// A5（审计 F-6）：新增「对比」——逐版本差异视图（逐页/逐字段），
// 支持「与当前工作区对比」与「任选两个历史版本对比」。

import { useCallback, useEffect, useState } from "react";
import { useFlowStore } from "@/lib/store/flow-store";
import { captureSnapshot, applySnapshot } from "@/lib/project-snapshot";
import { diffCheckpoints, fieldLabel, GLOBAL_PAGE, type DiffItem } from "@/lib/checkpoint-diff";
import { History, RotateCcw, Trash2, Save, Loader2, GitCompare, X } from "lucide-react";

interface Checkpoint {
  id: string;
  projectId: string;
  userId: string;
  data: string; // JSON 字符串 {version,flow,skeleton}
  label: string;
  createdAt: number;
}

/** 从检查点载荷解析轻量摘要（页面数 / 组件数 / 风格），供列表展示 */
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

const KIND_STYLE: Record<DiffItem["kind"], { label: string; cls: string }> = {
  added: { label: "新增", cls: "bg-emerald-500/15 text-emerald-500" },
  removed: { label: "删除", cls: "bg-red-500/15 text-red-500" },
  modified: { label: "修改", cls: "bg-amber-500/15 text-amber-500" },
};

export function BuilderCheckpoints({ projectId }: { projectId: string | null }) {
  const [list, setList] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState("");
  // A5 · 对比状态：compareA 为基准；compareB 为对比目标；compareCurrent 表示目标为当前工作区
  const [compareA, setCompareA] = useState<Checkpoint | null>(null);
  const [compareB, setCompareB] = useState<Checkpoint | null>(null);
  const [compareCurrent, setCompareCurrent] = useState(false);

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
    if (r.ok) {
      setList((prev) => prev.filter((c) => c.id !== cid));
      if (compareA?.id === cid || compareB?.id === cid) clearCompare();
    }
  };

  const clearCompare = () => {
    setCompareA(null);
    setCompareB(null);
    setCompareCurrent(false);
  };

  /** 选两个历史版本：第一次点选基准，第二次点选目标，再点已选者取消 */
  const pickPair = (cp: Checkpoint) => {
    if (compareCurrent) clearCompare();
    if (!compareA) {
      setCompareA(cp);
      setCompareB(null);
      return;
    }
    if (compareA.id === cp.id) {
      setCompareA(null);
      setCompareB(null);
      return;
    }
    if (compareB?.id === cp.id) {
      setCompareB(null);
      return;
    }
    setCompareB(cp);
  };

  /** 与当前工作区对比 */
  const compareWithCurrent = (cp: Checkpoint) => {
    setCompareA(cp);
    setCompareB(null);
    setCompareCurrent(true);
  };

  // 组装 diff：A 始终为基准检查点；B 为对比检查点或当前工作区快照
  const currentSnap = compareCurrent ? JSON.stringify(captureSnapshot()) : null;
  const aData = compareA?.data ?? null;
  const bData = compareCurrent ? currentSnap : (compareB?.data ?? null);
  const diff = aData && bData ? diffCheckpoints(aData, bData) : null;

  const cpName = (cp: Checkpoint | null) =>
    cp ? cp.label || new Date(cp.createdAt).toLocaleString() : "—";

  if (!projectId) {
    return (
      <div className="border-t border-border px-3 py-3 text-xs text-muted-foreground">
        保存项目后可在此创建检查点
      </div>
    );
  }

  return (
    <div className="border-t border-border px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <History className="size-3.5" />
          检查点
        </div>
        {list.length >= 2 && !compareA && (
          <button
            type="button"
            onClick={() => setCompareA(list[0])}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary transition hover:bg-primary/10"
          >
            <GitCompare className="size-3" />
            对比版本
          </button>
        )}
      </div>
      <div className="mb-2 flex items-center gap-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          aria-label="检查点备注"
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

      {/* A5 · 对比面板 */}
      {diff && compareA && (
        <div className="mb-2 rounded-lg border border-border/80 bg-background">
          <div className="flex items-center justify-between gap-2 border-b border-border/70 px-2 py-1.5">
            <div className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">
              <span className="font-semibold text-foreground">{cpName(compareA)}</span>
              <span className="mx-1">↔</span>
              {compareCurrent ? (
                <span className="font-semibold text-primary">当前工作区</span>
              ) : (
                <span className="font-semibold text-foreground">{cpName(compareB)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={clearCompare}
              title="关闭对比"
              className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 text-[10px]">
            <span className="font-medium text-emerald-500">+{diff.summary.added} 新增</span>
            <span className="font-medium text-red-500">−{diff.summary.removed} 删除</span>
            <span className="font-medium text-amber-500">~{diff.summary.modified} 修改</span>
            {diff.summary.added + diff.summary.removed + diff.summary.modified === 0 && (
              <span className="text-muted-foreground">两版本无差异</span>
            )}
          </div>
          {diff.items.length > 0 && (
            <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto px-2 pb-2">
              {diff.items.map((it, i) => {
                const st = KIND_STYLE[it.kind];
                return (
                  <li key={i} className="rounded border border-border/60 px-1.5 py-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 rounded px-1 py-px text-[9px] font-semibold ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                        {it.page === GLOBAL_PAGE ? "⚙ 全局配置" : it.page}
                      </span>
                    </div>
                    {it.fields.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {it.fields.slice(0, 12).map((f) => (
                          <span
                            key={f}
                            className="rounded bg-muted px-1 py-px text-[9px] text-muted-foreground"
                          >
                            {fieldLabel(f)}
                          </span>
                        ))}
                        {it.fields.length > 12 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{it.fields.length - 12} 项
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">加载中…</p>
      ) : list.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无检查点</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {list.map((cp) => {
            const s = summarize(cp.data);
            const isA = compareA?.id === cp.id;
            const isB = compareB?.id === cp.id;
            return (
              <li
                key={cp.id}
                className={`rounded-lg border px-2 py-1.5 transition ${
                  isA
                    ? "border-primary/60 bg-primary/5"
                    : isB
                      ? "border-amber-500/60 bg-amber-500/5"
                      : "border-border/70 bg-background"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {cp.label || new Date(cp.createdAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => compareWithCurrent(cp)}
                    title="与当前工作区对比"
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <GitCompare className="size-3.5" />
                  </button>
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
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {s.pages} 页 · {s.components} 组件 · 风格 {s.style}
                </p>
                {list.length >= 2 && compareA && (
                  <button
                    type="button"
                    onClick={() => pickPair(cp)}
                    className={`mt-1 w-full rounded px-1 py-0.5 text-[10px] transition ${
                      isA || isB
                        ? "bg-primary/15 text-primary"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {!compareA || compareA.id === cp.id
                      ? "取消选择"
                      : isB
                        ? "取消选择"
                        : "选择为对比目标"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
