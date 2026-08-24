"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Loader2, Check, Pencil } from "lucide-react";
import { useFlowStore } from "@/lib/store/flow-store";
import { synthesizeBriefToText } from "@/lib/ai-discover";

/**
 * 流程顶部「项目身份锚点」：AI 建议的项目名/描述全程可见，可就地改名，也可点 ✨ 让 AI 重新取名。
 * - 无名字时显示占位提示，点击直接进入编辑。
 * - 尊重手改：AI 重新取名会作为「新建议」回填，用户在第三步仍可自行覆盖。
 */
export function ProjectIdentity() {
  const projectInfo = useFlowStore((s) => s.projectInfo);
  const setProjectInfo = useFlowStore((s) => s.setProjectInfo);
  const productBrief = useFlowStore((s) => s.productBrief);
  const intentNarrative = useFlowStore((s) => s.intentNarrative);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentName = projectInfo?.projectName?.trim() ?? "";
  // 锚点始终渲染：有名字显示全名，没名字显示「未命名项目」，都可点开改名 / 一键 AI 取名

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const beginEdit = () => {
    setDraft(currentName);
    setError(null);
    setEditing(true);
  };

  const commitEdit = () => {
    const v = draft.trim();
    setEditing(false);
    if (v && v !== currentName) setProjectInfo({ projectName: v });
  };

  // 汇总当前已有叙事用于「AI 重新取名」，尽量丰满
  const buildProductText = (): string => {
    const st = useFlowStore.getState();
    const brief = st.productBrief;
    if (brief && brief.vision) return synthesizeBriefToText(brief);
    const n = st.intentNarrative;
    if (n) {
      const lines = [
        `产品愿景：${n.vision || ""}`,
        `定位/差异：${n.positioning || ""}`,
        `目标用户：${(n.targetAudience || []).join("、")}`,
        `核心模块：${(n.coreFeatures || [])
          .map((f) => `${f.name}（${f.why}）`)
          .join("；")}`,
      ].filter(Boolean);
      return lines.join("\n");
    }
    return "";
  };

  const aiRename = async () => {
    if (busy) return;
    const text = buildProductText();
    if (!text) {
      setError("还没有可用的产品背景，请先在第一步完成想法探索。");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/ai/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productText: text }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { name?: string; description?: string };
      if (j.name?.trim()) {
        setProjectInfo({
          projectName: j.name.trim(),
          projectDescription:
            j.description?.trim() || projectInfo?.projectDescription || "",
        });
      } else {
        setError("这轮没给出名字，再试一次？");
      }
    } catch {
      setError("AI 暂时不可用，请稍后再试，或直接手动取名。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {editing ? (
        <>
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") setEditing(false);
            }}
            onBlur={commitEdit}
            placeholder="给项目起个名字…"
            className="h-7 w-56 rounded-md border border-primary/40 bg-background px-2 text-center text-sm font-medium text-foreground outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={commitEdit}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            <Check className="size-3" /> 好了
          </button>
        </>
      ) : (
        <>
          <span
            role="button"
            tabIndex={0}
            onClick={beginEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") beginEdit();
            }}
            title={currentName ? "点击改名" : "给项目起个名字"}
            className="group inline-flex max-w-[16rem] cursor-pointer items-center gap-1.5 rounded-md border border-transparent bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary transition hover:border-primary/30"
          >
            <span className="truncate">{currentName || "未命名项目"}</span>
            <Pencil className="size-3 shrink-0 opacity-60 transition group-hover:opacity-100" />
          </span>
          <button
            type="button"
            onClick={aiRename}
            disabled={busy}
            title="让 AI 重新取个名"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            {busy ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            重新取名
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}