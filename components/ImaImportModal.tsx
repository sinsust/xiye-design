"use client";

import { useEffect, useState, type FormEvent } from "react";
import { X, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BrainNote } from "@/lib/brain-db";

interface ImaHit {
  media_id?: string;
  title?: string;
  summary?: string;
  url?: string;
  [k: string]: unknown;
}

// 从用户绑定的腾讯 ima 知识库导入到「第二大脑」：
// 绑定凭证（个人中心已配则可跳过）→ 选知识库 → 搜索 → 一键导入 brain_notes。
// 本组件返回普通 fixed overlay JSX，点击遮罩关闭。
export function ImaImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (note: BrainNote) => void;
}) {
  const [bound, setBound] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [bindError, setBindError] = useState("");

  const [kbs, setKbs] = useState<{ id: string; name: string }[]>([]);
  const [kbId, setKbId] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ImaHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/account/ima");
        const data = await res.json();
        if (data.bound) {
          setBound(true);
          loadKbs();
        } else {
          setBound(false);
        }
      } catch {
        setBound(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadKbs() {
    try {
      const res = await fetch("/api/brain/ima?action=list_kb");
      const data = await res.json();
      const list = (data.list ?? []).map((k: any) => ({
        id: k.id ?? k.knowledge_base_id ?? k.knowledgeBaseId,
        name: k.name ?? k.knowledge_base_name ?? "未命名知识库",
      }));
      setKbs(list);
      if (list[0] && !kbId) setKbId(list[0].id);
    } catch {
      /* ignore */
    }
  }

  async function doBind(e: FormEvent) {
    e.preventDefault();
    setBindError("");
    setLoading(true);
    try {
      const res = await fetch("/api/account/ima", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBindError(data.detail || data.error || "绑定失败");
        return;
      }
      setBound(true);
      loadKbs();
    } catch {
      setBindError("网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function doSearch(e: FormEvent) {
    e.preventDefault();
    setImportError("");
    if (!kbId || !query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/brain/ima?action=search&kbId=${encodeURIComponent(
          kbId,
        )}&q=${encodeURIComponent(query)}`,
      );
      const data = await res.json();
      setHits(data.list ?? []);
    } catch {
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  async function doImport(hit: ImaHit) {
    if (!hit.media_id) return;
    setImportingId(String(hit.media_id));
    setImportError("");
    try {
      const res = await fetch("/api/brain/ima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId: hit.media_id, name: hit.title }),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.detail || data.error || "导入失败");
        return;
      }
      onImported(data.note);
      onClose();
    } catch {
      setImportError("导入失败");
    } finally {
      setImportingId("");
    }
  }

  async function doUnbind() {
    if (!confirm("确定解绑 ima 凭证？已导入第二大脑的条目仍会保留。")) return;
    await fetch("/api/account/ima", { method: "DELETE" });
    setBound(false);
    setKbs([]);
    setHits([]);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            从 ima 导入到第二大脑
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius)] p-1 text-muted-foreground hover:text-foreground"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {bound === false && (
            <form onSubmit={doBind} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                绑定你的腾讯 ima 凭证（从{" "}
                <a
                  href="https://ima.qq.com/agent-interface"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  ima.qq.com/agent-interface
                </a>{" "}
                获取 Client ID 与 API Key）。也可在「个人中心」提前配置。凭证仅你本人持有，加密存储、明文不出服务端。
              </p>
              <div>
                <label className="text-xs text-muted-foreground">Client ID</label>
                <input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="ima-openapi-clientid"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">API Key</label>
                <input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  type="password"
                  className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="ima-openapi-apikey"
                />
              </div>
              {bindError && (
                <p className="break-words text-xs text-destructive">{bindError}</p>
              )}
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "验证中…" : "绑定并验证"}
              </Button>
            </form>
          )}

          {bound === true && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  已绑定 ima 凭证
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={doUnbind}
                >
                  <Trash2 className="size-3.5" /> 解绑
                </Button>
              </div>

              <div className="flex gap-2">
                <select
                  value={kbId}
                  onChange={(e) => setKbId(e.target.value)}
                  className="rounded-[var(--radius)] border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary"
                >
                  {kbs.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
                </select>
                <form onSubmit={doSearch} className="flex flex-1 gap-2">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="搜索知识库内容…"
                  />
                  <Button type="submit" size="sm" disabled={loading}>
                    <Search className="size-3.5" /> 搜索
                  </Button>
                </form>
              </div>

              {importError && (
                <p className="break-words text-xs text-destructive">{importError}</p>
              )}

              <div className="space-y-2">
                {hits.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    选择知识库并输入关键词，搜索你 ima 里的资料，一键导入第二大脑。
                  </p>
                )}
                {hits.map((h, i) => (
                  <div
                    key={String(h.media_id ?? i)}
                    className="flex items-start justify-between gap-2 rounded-[var(--radius)] border border-border bg-background p-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {String(h.title ?? h.name ?? "(无标题)")}
                      </div>
                      {h.summary && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {String(h.summary)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={importingId === h.media_id}
                      onClick={() => doImport(h)}
                    >
                      {importingId === h.media_id ? "导入中…" : "导入"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bound === null && (
            <p className="text-sm text-muted-foreground">加载中…</p>
          )}
        </div>
      </div>
    </div>
  );
}
