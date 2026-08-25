"use client";

import { useMemo, useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  AtSign,
  Check,
  Code2,
  Copy,
  Link as LinkIcon,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { KNOWLEDGE_TYPE_META, type KnowledgeEntry } from "@/lib/knowledge-types";
import { KnowledgeGraph } from "@/components/knowledge-graph";

type FilterId = KnowledgeEntry["type"] | "all" | "recent";

const STATUS_LABEL: Record<string, string> = {
  active: "已接入",
  trial: "试用中",
  frozen: "已冻结",
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const tone =
    status === "active"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : status === "trial"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-[var(--radius)] px-2 py-0.5 text-xs ${tone}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function useCopied(resetMs = 1500) {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), resetMs);
    });
  };
  return { copied, copy };
}

function CopyIconButton({ text, label }: { text: string; label: string }) {
  const { copied, copy } = useCopied();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="shrink-0 px-2"
      onClick={() => copy(text)}
      aria-label={label}
      title={label}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}

/** 可点击 + 可复制的外链行（GitHub / 官网） */
function CopyableLink({ label, href }: { label: string; href: string }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
        >
          {href}
        </a>
        <CopyIconButton text={href} label="复制链接" />
      </dd>
    </div>
  );
}

/** 可复制的本地路径行 */
function CopyablePath({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs text-foreground">
          {value}
        </code>
        <CopyIconButton text={value} label="复制路径" />
      </dd>
    </div>
  );
}

// ───────────────────────── 客户端轻量 frontmatter 解析（不依赖 node:fs） ─────────────────────────

function parseFmClient(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function extractBodyClient(raw: string): string {
  const m = raw.match(/^---\s*\n[\s\S]*?\n---\s*\n?([\s\S]*)$/);
  return (m ? m[1] : raw).trim();
}

// ───────────────────────── 新增 / 编辑 条目弹窗 ─────────────────────────

interface EntryDraft {
  type: KnowledgeEntry["type"];
  name: string;
  repoUrl: string;
  source: string;
  localPath: string;
  body: string;
  /** 编辑 / 完善后回填的 metadata（保存时随 PUT 传，否则服务端保留原值） */
  summary?: string;
  useCase?: string;
  tags?: string[];
  stack?: string[];
}

interface MetaPreview {
  summary?: string;
  useCase?: string;
  tags?: string[];
}

const EMPTY_DRAFT: EntryDraft = {
  type: "prompt",
  name: "",
  repoUrl: "",
  source: "",
  localPath: "",
  body: "",
};

function fileToDraft(
  text: string,
  fileName: string,
): Partial<EntryDraft> {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (m) {
    const fm = parseFmClient(m[1]);
    const body = extractBodyClient(text);
    const next: Partial<EntryDraft> = { body };
    if (fm.type && KNOWLEDGE_TYPE_META.some((x) => x.id === fm.type)) {
      next.type = fm.type as EntryDraft["type"];
    }
    if (fm.name) next.name = fm.name;
    if (fm.repoUrl) next.repoUrl = fm.repoUrl;
    if (fm.source) next.source = fm.source;
    if (fm.localPath) next.localPath = fm.localPath;
    return next;
  }
  // 无 frontmatter：文件名（去扩展名）当 name，全文当 body
  return { name: fileName.replace(/\.(md|txt)$/i, ""), body: text };
}

function EntryFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  initial?: KnowledgeEntry;
  onClose: () => void;
  onSaved: (e: KnowledgeEntry, mode: "add" | "edit") => void;
}) {
  const [draft, setDraft] = useState<EntryDraft>(
    initial
      ? {
          type: initial.type,
          name: initial.name,
          repoUrl: initial.repoUrl ?? "",
          source: initial.source ?? "",
          localPath: initial.localPath ?? "",
          body: initial.body,
        }
      : EMPTY_DRAFT,
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<MetaPreview | null>(
    initial
      ? { summary: initial.summary, useCase: initial.useCase, tags: initial.tags }
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof EntryDraft>(k: K, v: EntryDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const typeLabel = (t: KnowledgeEntry["type"]) =>
    KNOWLEDGE_TYPE_META.find((m) => m.id === t)?.label ?? t;

  const canGenerate = draft.name.trim().length > 0;

  const onFile = (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const next = fileToDraft(text, file.name);
      setDraft((d) => ({ ...d, ...next }));
      setPreview(null);
    };
    reader.readAsText(file);
    ev.target.value = "";
  };

  const generate = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/knowledge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(String(res.status));
      const meta = (await res.json()) as MetaPreview;
      setPreview(meta);
      // 把完善结果写回 draft，编辑保存时随 PUT 一并落盘
      setDraft((d) => ({ ...d, summary: meta.summary, useCase: meta.useCase, tags: meta.tags }));
    } catch {
      setError("AI 完善失败，可直接保存（将自动回退）");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving || !draft.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (mode === "add") {
        const res = await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.entry) throw new Error(String(data?.error ?? res.status));
        onSaved(data.entry as KnowledgeEntry, "add");
      } else {
        if (!initial) throw new Error("missing_initial");
        const putBody: Record<string, unknown> = {
          type: draft.type,
          slug: initial.slug,
          name: draft.name,
          repoUrl: draft.repoUrl,
          source: draft.source,
          localPath: draft.localPath,
          body: draft.body,
        };
        // 仅在用户点过「完善摘要」后才覆盖 metadata，否则服务端保留原值
        if (draft.summary || draft.useCase || (draft.tags && draft.tags.length) || (draft.stack && draft.stack.length)) {
          putBody.summary = draft.summary;
          putBody.useCase = draft.useCase;
          putBody.tags = draft.tags;
          putBody.stack = draft.stack;
        }
        const res = await fetch("/api/knowledge", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(putBody),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.entry) throw new Error(String(data?.error ?? res.status));
        onSaved(data.entry as KnowledgeEntry, "edit");
      }
      onClose();
    } catch {
      setError("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold text-foreground">
            {mode === "edit" ? "编辑知识条目" : "新增知识条目"}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="关闭">
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-auto p-5">
          {/* 分类选择：水平平铺 */}
          <label className="text-xs uppercase tracking-wide text-muted-foreground">
            分类
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {KNOWLEDGE_TYPE_META.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => set("type", m.id)}
                className={[
                  "rounded-[var(--radius)] border px-3 py-1.5 text-sm transition-colors",
                  draft.type === m.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary",
                ].join(" ")}
              >
                {m.label}
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">
            名称
          </label>
          <input
            className={inputCls + " mt-2"}
            value={draft.name}
            onChange={(ev) => set("name", ev.target.value)}
            placeholder="例如：让 AI 生成商品卖点的提示词"
            autoFocus
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                仓库地址（GitHub 等）
              </label>
              <input
                className={inputCls + " mt-1.5"}
                value={draft.repoUrl}
                onChange={(ev) => set("repoUrl", ev.target.value)}
                placeholder="https://github.com/..."
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                官网 / 文档
              </label>
              <input
                className={inputCls + " mt-1.5"}
                value={draft.source}
                onChange={(ev) => set("source", ev.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>

          {mode === "add" && (
            <div className="mt-4">
              <label className="text-xs uppercase tracking-wide text-muted-foreground">
                本地文件夹地址
              </label>
              <input
                className={inputCls + " mt-1.5"}
                value={draft.localPath}
                onChange={(ev) => set("localPath", ev.target.value)}
                placeholder="D:\projects\foo  （保存后可一键复制）"
              />
            </div>
          )}

          <div className="mt-4">
            <label className="text-xs uppercase tracking-wide text-muted-foreground">
              上传文件（.md / .txt）
            </label>
            <input
              type="file"
              accept=".md,.txt"
              onChange={onFile}
              className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-primary hover:file:bg-primary/20"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              含 frontmatter 的文件会自动解析分类 / 名称 / 地址；纯文本文件以文件名当名称、全文当正文。
            </p>
          </div>

          <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">
            正文 / 提示词原文
          </label>
          <textarea
            className={inputCls + " mt-1.5 min-h-32 resize-y font-mono text-xs leading-relaxed"}
            value={draft.body}
            onChange={(ev) => set("body", ev.target.value)}
            placeholder={"在这里粘贴提示词原文或多行内容…\n保存后这项内容会保留原文，可一键复制。"}
          />

          {/* AI 完善预览 */}
          {preview && (preview.summary || preview.useCase || (preview.tags && preview.tags.length)) && (
            <div className="mt-4 rounded-[var(--radius)] border border-border bg-muted/40 p-3">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">摘要</dt>
              <dd className="mt-0.5 text-sm text-foreground">{preview.summary}</dd>
              {preview.useCase && (
                <>
                  <dt className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
                    适用场景
                  </dt>
                  <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                    {preview.useCase}
                  </dd>
                </>
              )}
              {preview.tags && preview.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {preview.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={generate}
              disabled={!canGenerate || generating}
            >
              <Sparkles className="size-3.5" />
              完善摘要
            </Button>
            <span className="text-xs text-muted-foreground">
              保存时也会自动完善{" "}
              {typeLabel(draft.type)} / 摘要 / 适用场景
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button size="sm" onClick={save} disabled={saving || !draft.name.trim()}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 主列表组件 ─────────────────────────

export function KnowledgeBrowser({
  entries,
}: {
  entries: KnowledgeEntry[];
}) {
  const [active, setActive] = useState<FilterId>("all");
  const [open, setOpen] = useState<KnowledgeEntry | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [extra, setExtra] = useState<KnowledgeEntry[]>([]);
  // 编辑后覆盖式更新的条目（key = type/slug）
  const [patched, setPatched] = useState<Record<string, KnowledgeEntry>>({});
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 当前登录用户邮箱：云端共享条目仅「贡献人本人」可见编辑/删除
  const [myEmail, setMyEmail] = useState<string | null>(null);
  // 全局图谱展开态
  const [graphOpen, setGraphOpen] = useState(false);

  // 云端条目仅贡献人本人可管理；内置条目 userAdded 为空，一律不可管理
  const canManage = (e: KnowledgeEntry) =>
    Boolean(e.userAdded) && (!e.contributorEmail || e.contributorEmail === myEmail);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.user?.email) setMyEmail(d.user.email);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const keyOf = (e: KnowledgeEntry) => `${e.type}/${e.slug}`;

  // 两步删除确认：首次点击进入「确认删除」态，2.5s 内再点才会真正删除
  const askDelete = (key: string) => {
    setConfirmKey(key);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmKey(null), 2500);
  };

  const doDelete = async (e: KnowledgeEntry) => {
    const key = keyOf(e);
    try {
      const res = await fetch(
        `/api/knowledge?type=${encodeURIComponent(e.type)}&slug=${encodeURIComponent(e.slug)}`,
        { method: "DELETE" },
      );
      if (!res.ok) return;
      setDeleted((prev) => new Set(prev).add(key));
      setExtra((prev) => prev.filter((x) => keyOf(x) !== key));
      if (open && keyOf(open) === key) setOpen(null);
    } finally {
      setConfirmKey(null);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    }
  };

  const onDeleteClick = (e: KnowledgeEntry) => {
    const key = keyOf(e);
    if (confirmKey === key) doDelete(e);
    else askDelete(key);
  };

  const onSaved = (e: KnowledgeEntry, mode: "add" | "edit") => {
    if (mode === "add") setExtra((prev) => [e, ...prev]);
    else setPatched((prev) => ({ ...prev, [keyOf(e)]: e }));
    if (open && keyOf(open) === keyOf(e)) setOpen(e);
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: entries.length + extra.length };
    for (const m of KNOWLEDGE_TYPE_META) map[m.id] = 0;
    for (const e of entries) map[e.type] = (map[e.type] ?? 0) + 1;
    for (const e of extra) map[e.type] = (map[e.type] ?? 0) + 1;
    return map;
  }, [entries, extra]);

  const tabs = useMemo(
    () =>
      [
        { id: "all" as FilterId, label: "全部" },
        { id: "recent" as FilterId, label: "最近添加" },
        ...KNOWLEDGE_TYPE_META.map((m) => ({ id: m.id as FilterId, label: m.label })),
      ].filter((t) => t.id === "all" || t.id === "recent" || (counts[t.id] ?? 0) > 0),
    [counts],
  );

  const filtered = useMemo(() => {
    const patch = (e: KnowledgeEntry) => patched[keyOf(e)] ?? e;
    const keep = (e: KnowledgeEntry) => !deleted.has(keyOf(e));
    const base = entries.map(patch).filter(keep);
    const add = extra.map(patch).filter(keep);
    const all = [...add, ...base];
    if (active === "all") return all;
    if (active === "recent") {
      // 按添加时间倒序；无 createdAt 的内置条目沉到末尾
      return all
        .slice()
        .sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity));
    }
    return all.filter((e) => e.type === active);
  }, [active, entries, extra, patched, deleted]);

  // 全量条目（含新增/编辑/删除后的最新态），供图谱匹配关联
  const allEntries = useMemo(() => {
    const patch = (e: KnowledgeEntry) => patched[keyOf(e)] ?? e;
    const keep = (e: KnowledgeEntry) => !deleted.has(keyOf(e));
    return [...extra.map(patch).filter(keep), ...entries.map(patch).filter(keep)];
  }, [entries, extra, patched, deleted]);

  const typeLabel = (t: KnowledgeEntry["type"]) =>
    KNOWLEDGE_TYPE_META.find((m) => m.id === t)?.label ?? t;

  const copyAddress = (e: KnowledgeEntry) =>
    e.repoUrl || e.source || e.localPath || "";

  return (
    <div>
      {/* 全局图谱入口 */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => setGraphOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[var(--radius)] border border-border bg-card px-4 py-2.5 text-left transition-colors hover:border-primary/40"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <LinkIcon className="size-4 text-primary" />
            知识图谱
            <span className="text-xs font-normal text-muted-foreground">
              {allEntries.length} 条 · 按关系类型连线
            </span>
          </span>
          <span className="text-muted-foreground transition-transform" style={{ transform: graphOpen ? "rotate(180deg)" : undefined }}>
            ▾
          </span>
        </button>
        {graphOpen && (
          <div className="mt-2">
            <KnowledgeGraph
              entries={allEntries}
              onSelect={(e) => setOpen(e)}
              height={360}
            />
          </div>
        )}
      </div>

      {/* 分类筛选 + 新增入口 */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const isActive = active === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActive(t.id)}
                className={[
                  "rounded-[var(--radius)] border px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary",
                ].join(" ")}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            新增条目
          </Button>
        </div>
      </div>

      {/* 卡片网格 */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((e) => {
          const addr = copyAddress(e);
          return (
            <div
              key={`${e.type}/${e.slug}`}
              className="flex flex-col rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground">{e.name}</h3>
                <div className="flex shrink-0 items-center gap-1.5">
                  {e.repoUrl && (
                    <a
                      href={e.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="GitHub / 仓库"
                      className="rounded-[var(--radius)] bg-muted p-1 text-muted-foreground transition-colors hover:text-primary"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <Code2 className="size-3.5" />
                    </a>
                  )}
                  <span className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {typeLabel(e.type)}
                  </span>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                {e.summary}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={e.status} />
                {e.tags?.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              {e.contributorEmail && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <AtSign className="size-3 shrink-0" />
                  <span>贡献人</span>
                  <a
                    href={`mailto:${e.contributorEmail}`}
                    className="min-w-0 flex-1 truncate text-primary hover:underline"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    {e.contributorEmail}
                  </a>
                </div>
              )}
              {e.createdAt && (
                <div className="mt-2 text-xs text-muted-foreground">
                  添加于 {new Date(e.createdAt).toLocaleDateString("zh-CN")}
                </div>
              )}
              <div className="mt-4 flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setOpen(e)}>
                  查看条目
                  <ArrowUpRight className="size-3.5" />
                </Button>
                {e.body && <CopyIconButton text={e.body} label="复制原文" />}
                {addr && <CopyIconButton text={addr} label="复制地址" />}
                {canManage(e) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-primary"
                      onClick={() => setEditing(e)}
                      title="编辑这条记录"
                      aria-label="编辑条目"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        confirmKey === keyOf(e)
                          ? "text-destructive"
                          : "text-muted-foreground hover:text-destructive"
                      }
                      onClick={() => onDeleteClick(e)}
                      title="删除这条记录（云端共享条目将一并移除）"
                      aria-label="删除条目"
                    >
                      {confirmKey === keyOf(e) ? "确认删除" : <Trash2 className="size-3.5" />}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 弹窗：完整条目 */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(null)}
          >
            <div
              className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background"
              onClick={(ev) => ev.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-foreground">{open.name}</h2>
                  <span className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {typeLabel(open.type)}
                  </span>
                  <StatusBadge status={open.status} />
                </div>
                <div className="flex items-center gap-1.5">
                  {canManage(open) && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-primary"
                        onClick={() => {
                          setOpen(null);
                          setEditing(open);
                        }}
                        title="编辑这条记录"
                        aria-label="编辑条目"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={
                          confirmKey === keyOf(open)
                            ? "text-destructive"
                            : "text-muted-foreground hover:text-destructive"
                        }
                        onClick={() => onDeleteClick(open)}
                        title="删除这条记录（云端共享条目将一并移除）"
                        aria-label="删除条目"
                      >
                        {confirmKey === keyOf(open) ? "确认删除" : <Trash2 className="size-4" />}
                      </Button>
                    </>
                  )}
                  {open.body && <CopyIconButton text={open.body} label="复制全部原文" />}
                  <Button variant="ghost" size="sm" onClick={() => setOpen(null)} aria-label="关闭">
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="overflow-auto p-5">
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  {open.summary && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        作用
                      </dt>
                      <dd className="mt-1 text-foreground">{open.summary}</dd>
                    </div>
                  )}
                  {open.contributorEmail && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        贡献人
                      </dt>
                      <dd className="mt-1 flex items-center gap-2">
                        <AtSign className="size-3.5 text-muted-foreground" />
                        <a
                          href={`mailto:${open.contributorEmail}`}
                          className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
                        >
                          {open.contributorEmail}
                        </a>
                        <CopyIconButton text={open.contributorEmail} label="复制邮箱" />
                      </dd>
                    </div>
                  )}
                  {open.useCase && (
                    <div className="sm:col-span-2">
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        适用场景
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-foreground">
                        {open.useCase}
                      </dd>
                    </div>
                  )}
                  {open.stack && open.stack.length > 0 && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        兼容技术栈
                      </dt>
                      <dd className="mt-1 text-foreground">{open.stack.join("、")}</dd>
                    </div>
                  )}
                  {open.related && open.related.length > 0 && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        关联
                      </dt>
                      <dd className="mt-1 font-mono text-xs text-muted-foreground">
                        {open.related.join("、")}
                      </dd>
                    </div>
                  )}
                  {open.updated && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        更新
                      </dt>
                      <dd className="mt-1 text-foreground">{open.updated}</dd>
                    </div>
                  )}
                  {open.createdAt && (
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                        添加于
                      </dt>
                      <dd className="mt-1 text-foreground">
                        {new Date(open.createdAt).toLocaleDateString("zh-CN")}
                      </dd>
                    </div>
                  )}
                  {open.repoUrl && <CopyableLink label="GitHub / 仓库" href={open.repoUrl} />}
                  {open.source && <CopyableLink label="官网 / 文档" href={open.source} />}
                  {open.localPath && <CopyablePath label="本地路径" value={open.localPath} />}
                </dl>
                {/* 局部图谱：当前条目 + 关联 */}
                <div className="mt-5">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    关联图谱
                  </dt>
                  <div className="mt-2">
                    <KnowledgeGraph
                      entries={allEntries}
                      center={open}
                      onSelect={(e) => setOpen(e)}
                      height={300}
                    />
                  </div>
                </div>
                {open.tags && open.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {open.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-[var(--radius)] bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-5 border-t border-border pt-4">
                  <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">
                    {open.body}
                  </pre>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {adding &&
        createPortal(
          <EntryFormModal mode="add" onClose={() => setAdding(false)} onSaved={onSaved} />,
          document.body,
        )}

      {editing &&
        createPortal(
          <EntryFormModal
            mode="edit"
            initial={editing}
            onClose={() => setEditing(null)}
            onSaved={onSaved}
          />,
          document.body,
        )}

    </div>
  );
}
