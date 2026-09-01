"use client";

/**
 * 数据引擎 —— 飞书多维表导入面板
 * 流程：
 *  未绑定 → 点「授权飞书」跳转 /api/feishu/authorize（飞书授权页 302）
 *  回调回前端 ?feishu=connected|error → 读 /api/feishu/status 刷新绑定态
 *  已绑定 → 填 appToken → 列出数据表 → 选表 → 导入（POST /api/feishu/import）
 *  导入结果复用 UploadResult 契约，回调 onImported 推进到 sheetSelect（确认流零改动）
 *  支持解绑（POST /api/feishu/disconnect）
 */

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ExternalLink, Loader2, Plug, RefreshCw, Table2, X } from "lucide-react";
import type { UploadResult } from "./TableUploader";

type Status = "loading" | "connected" | "disconnected";
type Busy = "" | "list" | "import" | "auth";

const REASON_MAP: Record<string, string> = {
  unauthorized: "未登录",
  no_code: "飞书未返回授权码",
  state_mismatch: "状态校验失败（可能跨账号）",
};

export function FeishuImportPanel({
  onImported,
}: {
  onImported: (data: UploadResult) => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [scope, setScope] = useState<string | null>(null);
  const [appToken, setAppToken] = useState("");
  const [tables, setTables] = useState<Array<{ tableId: string; name: string }>>([]);
  const [selectedTableId, setSelectedTableId] = useState("");
  const [busy, setBusy] = useState<Busy>("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (kind: "ok" | "err", msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };

  // 挂载：处理 ?feishu=connected|error 回跳参数 + 读绑定态
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fb = params.get("feishu");
    if (fb) {
      const url = new URL(window.location.href);
      url.searchParams.delete("feishu");
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
    const reason = params.get("reason");
    (async () => {
      try {
        const res = await fetch("/api/feishu/status");
        const data = await res.json().catch(() => null);
        if (data?.connected) {
          setStatus("connected");
          setScope(data.scope ?? null);
          if (fb === "connected") showToast("ok", "飞书已授权并绑定");
          if (fb === "error")
            showToast("err", REASON_MAP[reason ?? ""] ?? decodeURIComponent(reason ?? "授权失败"));
        } else {
          setStatus("disconnected");
          if (fb === "error")
            showToast("err", REASON_MAP[reason ?? ""] ?? decodeURIComponent(reason ?? "授权失败"));
        }
      } catch {
        setStatus("disconnected");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authorize = () => {
    setBusy("auth");
    // 跳转会离开本页，busy 状态无需复位
    window.location.href = "/api/feishu/authorize";
  };

  const listTables = async () => {
    setError("");
    setTables([]);
    setSelectedTableId("");
    const token = appToken.trim();
    if (!token) {
      setError("请填写 appToken（多维表链接中的 app 部分）");
      return;
    }
    setBusy("list");
    try {
      const res = await fetch(`/api/feishu/tables?appToken=${encodeURIComponent(token)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "列出数据表失败");
      const items = data.tables ?? [];
      setTables(items);
      if (items.length === 0) setError("该多维表下没有数据表，或当前账号无访问权限");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const doImport = async () => {
    setError("");
    const token = appToken.trim();
    if (!token) {
      setError("请填写 appToken");
      return;
    }
    if (!selectedTableId) {
      setError("请选择要导入的数据表");
      return;
    }
    const tableName = tables.find((t) => t.tableId === selectedTableId)?.name || "飞书多维表";
    setBusy("import");
    try {
      const res = await fetch("/api/feishu/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appToken: token, tableId: selectedTableId, tableName }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "导入失败");
      const first = data?.results?.[0];
      const result: UploadResult = {
        parsedInfo: {
          fileName: first?.sheetName || tableName,
          encoding: "utf-8",
          sheets: [
            {
              name: first?.sheetName || tableName,
              headers: first?.headers ?? [],
              rows: first?.rows ?? [],
              rowCount: first?.effectiveRowCount ?? 0,
              colCount: first?.effectiveColumnCount ?? 0,
            },
          ],
        },
        structure: { sameStructureGroups: [], differentSheets: [first?.sheetName || tableName] },
        results: data.results ?? [],
        truncated: data.truncated ?? [],
      };
      onImported(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const disconnect = async () => {
    setBusy("list");
    try {
      const res = await fetch("/api/feishu/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("解绑失败");
      setStatus("disconnected");
      setScope(null);
      setTables([]);
      setSelectedTableId("");
      setAppToken("");
      showToast("ok", "已解绑飞书");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        正在检查飞书绑定状态…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      {/* 绑定状态卡 */}
      <div
        className={
          "flex items-center justify-between rounded-xl border px-4 py-3 " +
          (status === "connected"
            ? "border-emerald-200 bg-emerald-50/70"
            : "border-border/70 bg-muted/30")
        }
      >
        <div className="flex items-center gap-2.5">
          <div
            className={
              "flex size-8 items-center justify-center rounded-lg " +
              (status === "connected"
                ? "bg-emerald-500/15 text-emerald-600"
                : "bg-muted text-muted-foreground")
            }
          >
            {status === "connected" ? <Check className="size-4" /> : <Plug className="size-4" />}
          </div>
          <div className="text-sm">
            <div className="font-medium text-foreground">飞书多维表</div>
            <div className="text-xs text-muted-foreground">
              {status === "connected"
                ? `已绑定${scope ? ` · 授权范围：${scope}` : ""}`
                : "尚未绑定"}
            </div>
          </div>
        </div>
        {status === "connected" ? (
          <button
            onClick={disconnect}
            disabled={busy === "list"}
            className="rounded-md border border-border/70 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            解绑
          </button>
        ) : (
          <button
            onClick={authorize}
            disabled={busy === "auth"}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/85 px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:shadow active:scale-[0.98] disabled:opacity-40"
          >
            <Plug className="size-3.5" />
            授权飞书
          </button>
        )}
      </div>

      {/* 已绑定：appToken + 选表 + 导入 */}
      {status === "connected" && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="text-xs text-muted-foreground">
            从飞书多维表链接复制 <span className="font-mono text-foreground">appToken</span>
            （链接形如 <span className="font-mono">…/base/【appToken】?table=【tableId】</span>）。
          </div>
          <div className="flex gap-2">
            <input
              value={appToken}
              onChange={(e) => setAppToken(e.target.value)}
              placeholder="粘贴 appToken"
              className="flex-1 rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
            <button
              onClick={listTables}
              disabled={busy === "list"}
              className="flex items-center gap-1.5 rounded-lg border border-border/70 px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-40"
            >
              {busy === "list" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              列出数据表
            </button>
          </div>

          {tables.length > 0 && (
            <div className="flex flex-col gap-2">
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                className="rounded-lg border border-border/70 bg-white px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              >
                <option value="">选择要导入的数据表…</option>
                {tables.map((t) => (
                  <option key={t.tableId} value={t.tableId}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button
                onClick={doImport}
                disabled={busy === "import" || !selectedTableId}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/85 px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg active:scale-[0.98] disabled:opacity-40"
              >
                {busy === "import" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Table2 className="size-4" />
                )}
                {busy === "import" ? "导入中…" : "导入并分析"}
              </button>
            </div>
          )}

          <a
            href="https://open.feishu.cn/app"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[11px] text-muted-foreground/70 transition hover:text-primary"
          >
            没有自建应用？前往飞书开放平台创建
            <ExternalLink className="size-3" />
          </a>
        </div>
      )}

      {/* 错误 */}
      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          <X className="size-3.5 shrink-0" />
          <span className="break-all">{error}</span>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div
          className={
            "fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-bottom-3 " +
            (toast.kind === "ok"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white")
          }
        >
          {toast.kind === "ok" ? <Check className="size-3.5" /> : <AlertCircle className="size-3.5" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
