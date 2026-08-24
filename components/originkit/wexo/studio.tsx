'use client';

// Wexo 可视化编辑器：把原来是「只读 HTML 黑盒」的 Framer 区块变成可在预览里直接修改的页面。
// - 自动从 clean 后的 DOM 提取可编辑对象：文本(.framer-text)、配色(CSS 变量 token)、顶层视觉子区块
// - 右侧面板实时修改 -> 应用到预览
// - 一键把全部 12 块「修改后的整站」与 framer.css/images/fonts 一起打包成可独立部署的 zip 下载
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SECTION_BASE,
  WEXO_SLUGS,
  cleanVariants,
  variantForWidth,
  type Variant,
} from "./shared";

/* ============================ 可编辑模型 ============================ */

export interface WexoEditText {
  id: string;
  label: string;
  value: string;
}
export interface WexoEditColor {
  key: string;
  label: string;
  value: string; // hex
}
export interface WexoEditBlock {
  id: string;
  label: string;
  hidden: boolean;
}
export interface WexoEditModel {
  texts: WexoEditText[];
  colors: WexoEditColor[];
  blocks: WexoEditBlock[];
  dirty?: boolean;
}

// 供配色编辑覆盖的 Framer 主题 token（value 为默认 hex，面板据此初始化）
const COLOR_FIELDS = [
  { key: "--token-ed6c5d37-37bc-4eb6-b2ec-1bac7ba205f6", label: "页面背景", value: "#ffffff" },
  { key: "--token-74144689-7af9-4f97-9dc8-19aa6d7506c1", label: "边框 / 浅灰", value: "#dde5ed" },
  { key: "--token-f8762ae7-c598-4295-abdb-74012e5b6f50", label: "主文字（深）", value: "#1b1e21" },
  { key: "--token-162c843f-62b7-4354-9602-5a5cd83d974d", label: "次要文字（灰）", value: "#4d585f" },
];

const COLOR_PRESETS = [
  ["#ffffff", "#dde5ed", "#1b1e21", "#5b6870"],
  ["#fdf6e3", "#f2e3c5", "#5b4636", "#8a6f5a"],
  ["#f4f7f9", "#d9e4ea", "#0f2a3d", "#3f6172"],
  ["#1e1e24", "#3a3a44", "#f5f5f5", "#b0b0bc"],
  ["#fbe9e7", "#f2c0b5", "#4a2c24", "#8a5545"],
  ["#eafaf1", "#c5ecd8", "#14332a", "#3f6f5c"],
];

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// 从 clean 后的 DOM 提取文本与顶层视觉子区块
function extractModel(dom: Document, target: Variant): { texts: WexoEditText[]; blocks: WexoEditBlock[] } {
  const texts: WexoEditText[] = [];
  const textEls = dom.body.querySelectorAll<HTMLElement>(".framer-text");
  let i = 0;
  for (const el of Array.from(textEls)) {
    const t = (el.textContent || "").trim();
    if (!t) continue;
    const name = el.closest<HTMLElement>("[data-framer-name]")?.getAttribute("data-framer-name");
    const label = name || t.length > 18 ? t.slice(0, 18) + "…" : t;
    texts.push({ id: `t${i}`, label: label || `文本 ${i}`, value: t });
    i++;
  }

  // 顶层视觉子区块 = clean 后 html 根元素(section)的直接子元素
  const blocks: WexoEditBlock[] = [];
  const root = dom.body.firstElementChild as HTMLElement | null;
  if (root) {
    let bi = 0;
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.classList.contains("ssr-variant")) continue; // 响应式副本壳，忽略
      blocks.push({
        id: `b${bi}`,
        label: child.getAttribute("data-framer-name") || child.className.split(/\s+/)[0] || `区块 ${bi}`,
        hidden: false,
      });
      bi++;
    }
  }
  return { texts, blocks };
}

// 把编辑模型应用到 clean 后的 DOM 上
function applyModel(dom: Document, model: WexoEditModel): void {
  if (!model) return;
  const textEls = dom.body.querySelectorAll<HTMLElement>(".framer-text");
  let i = 0;
  for (const el of Array.from(textEls)) {
    const edit = model.texts[i];
    if (edit && edit.value.length > 0 && (el.textContent || "").trim()) {
      el.textContent = edit.value;
    }
    i++;
  }
  const root = dom.body.firstElementChild as HTMLElement | null;
  if (root) {
    let bi = 0;
    for (const child of Array.from(root.children)) {
      if (!(child instanceof HTMLElement) || child.classList.contains("ssr-variant")) continue;
      const edit = model.blocks[bi];
      if (edit) child.style.display = edit.hidden ? "none" : "";
      bi++;
    }
  }
  const colorOverride = (model.colors || []).filter((c) => c.value);
  if (colorOverride.length > 0) {
    const rules = colorOverride
      .map((c) => `${c.key}:${hexToRgb(c.value)}`)
      .join(";");
    const style = dom.createElement("style");
    style.dataset.wexoOverride = "1";
    style.textContent = `.framer-JzUpW{${rules}}`;
    // 放在 body 内，序列化 body.innerHTML 时才能随区块一并导出（覆盖作用作用于全局 .framer-JzUpW）
    dom.body.appendChild(style);
  }
}

function emptyModel(dom: Document, target: Variant): WexoEditModel {
  const { texts, blocks } = extractModel(dom, target);
  return {
    texts,
    blocks,
    colors: COLOR_FIELDS.map((f) => ({ ...f })),
  };
}

function serialize(dom: Document): string {
  if (dom.head.querySelector("style[data-wexo-override]")) {
    return dom.body.innerHTML;
  }
  return dom.body.innerHTML;
}

type ModelKind = "texts" | "colors" | "blocks";
type ModelElem<K extends ModelKind> = K extends "texts"
  ? WexoEditText
  : K extends "colors"
    ? WexoEditColor
    : WexoEditBlock;
type EditChange = <K extends ModelKind>(kind: K, index: number, patch: Partial<ModelElem<K>>) => void;

// 整站导出时把 public 根路径图片替换为 zip 内的相对路径
function relativizeImages(html: string): string {
  return html.replace(/\/originkit\/wexo\/images\/([^\s"')\]]+)/g, "images/$1");
}

/* ============================ 组件 ============================ */

export function WexoStudio({ slug }: { slug: string }) {
  const [err, setErr] = useState(false);
  const [width, setWidth] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [cleanHtml, setCleanHtml] = useState<string>("");
  const [model, setModel] = useState<WexoEditModel | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  // 保存每个切换过的块的最新编辑，供「导出整站」把所有块的修改落到 zip 里
  const allEditsRef = useRef<Record<string, WexoEditModel>>({});

  const target: Variant = width != null ? variantForWidth(width) : "72rtr7";

  // 当前块的编辑变化时，同步到整站编辑记录
  useEffect(() => {
    if (model) allEditsRef.current[slug] = model;
  }, [model, slug]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    const w0 = el.offsetWidth;
    if (w0) setWidth(w0);
    return () => ro.disconnect();
  }, []);

  // 拉取当前块 HTML + clean，并初始化可编辑模型
  useEffect(() => {
    let alive = true;
    setErr(false);
    setCleanHtml("");
    setModel(null);
    fetch(`${SECTION_BASE}/${slug}.html`)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => {
        if (!alive) return;
        const cleaned = cleanVariants(t, target);
        const doc = new DOMParser().parseFromString(cleaned, "text/html");
        setCleanHtml(cleaned);
        setModel(emptyModel(doc, target));
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, [slug, target]);

  const applyEdit: EditChange = (kind, index, patch) => {
    setModel((m) => {
      if (!m) return m;
      const arr = (m[kind] as unknown as any[]).slice();
      arr[index] = { ...(arr[index] as object), ...(patch as object) };
      return { ...m, [kind]: arr, dirty: true };
    });
  };

  // 预览 DOM：应用当前编辑模型后渲染
  const appliedHtml = useMemo(() => {
    if (!cleanHtml || !model) return cleanHtml;
    const doc = new DOMParser().parseFromString(cleanHtml, "text/html");
    applyModel(doc, model);
    return serialize(doc);
  }, [cleanHtml, model]);

  // 一键导出：整合全部 12 块修改后的整站，打包 zip 下载
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportMsg("正在生成并打包整站…");
    try {
      const parts: string[] = [];
      for (const s of WEXO_SLUGS) {
        const r = await fetch(`${SECTION_BASE}/${s}.html`);
        if (!r.ok) continue;
        const cleaned = cleanVariants(await r.text(), "72rtr7");
        const doc = new DOMParser().parseFromString(cleaned, "text/html");
        // 应用该块已编辑过的模型；未编辑过的块使用空模型（保持原样）
        const edit = allEditsRef.current[s] ?? emptyModel(doc, "72rtr7");
        applyModel(doc, edit);
        parts.push(doc.body.innerHTML);
      }
      const index = [
        "<!doctype html><html lang=\"zh-CN\"><head>",
        "<meta charset=\"utf-8\"/>",
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>",
        "<link rel=\"stylesheet\" href=\"framer.css\"/>",
        "</head><body>",
        `<div class="framer-JzUpW">${relativizeImages(parts.join(""))}</div>`,
        "</body></html>",
      ].join("");
      const res = await fetch("/api/brand/export-wexo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) throw new Error("导出失败");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "wexo-edited.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      setExportMsg("导出完成，已下载 wexo-edited.zip");
    } catch {
      setExportMsg("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const hasEdits = !!model?.dirty;

  return (
    <>
      <link rel="stylesheet" href="/originkit/wexo/framer.css" />
      {/* 顶部工具条：编辑开关 + 导出 */}
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={`h-8 rounded-[calc(var(--radius)+1px)] border px-3 text-xs font-medium transition-colors ${
            panelOpen
              ? "border-ring bg-muted text-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          }`}
        >
          面板 {panelOpen ? "收起" : "编辑"}
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="ml-auto h-8 rounded-[calc(var(--radius)+1px)] border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground disabled:opacity-50"
        >
          {exporting ? "打包中…" : "导出整站 Zip"}
        </button>
        {exportMsg && (
          <span className="text-xs text-muted-foreground">{exportMsg}</span>
        )}
      </div>
      <div
        ref={rootRef}
        className="relative"
        style={{ width: "100%", minWidth: 1140, overflow: "hidden" }}
      >
        {err ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            区块加载失败：/originkit/wexo/sections/{slug}.html
          </div>
        ) : (
          <div className="framer-JzUpW" dangerouslySetInnerHTML={{ __html: appliedHtml }} />
        )}
      </div>

      {/* 编辑面板 */}
      {panelOpen && model && (
        <EditPanel
          model={model}
          onChange={applyEdit}
          onClose={() => setPanelOpen(false)}
        />
      )}
    </>
  );
}

/* ============================ 编辑面板 ============================ */

function EditPanel({
  model,
  onChange,
  onClose,
}: {
  model: WexoEditModel;
  onChange: EditChange;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"text" | "color" | "block">("text");
  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-[300px] flex-col border-l border-border bg-background shadow-xl">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-0.5 text-xs font-medium">
          {(
            [
              ["text", "文本"],
              ["color", "配色"],
              ["block", "区块"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-[calc(var(--radius)-2px)] px-2 py-1 ${
                tab === k ? "bg-muted text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="关闭"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "text" && (
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">
              修改文案会实时反映到左侧预览。按钮 / 导航等短文本请保持长度一致，避免撑破版式。
            </p>
            {model.texts.map((t, i) => (
              <div key={t.id} className="space-y-1">
                <label className="block truncate text-[11px] text-muted-foreground">
                  {t.label}
                </label>
                <input
                  value={t.value}
                  onChange={(e) => onChange("texts", i, { value: e.target.value })}
                  className="h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                />
              </div>
            ))}
            {model.texts.length === 0 && (
              <p className="text-xs text-muted-foreground">当前区块没有可编辑文本。</p>
            )}
          </div>
        )}
        {tab === "color" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">快速主题</p>
              <div className="grid grid-cols-3 gap-1.5">
                {COLOR_PRESETS.map((preset, pi) => (
                  <button
                    key={pi}
                    onClick={() =>
                      preset.forEach((hex, ci) =>
                        onChange("colors", ci, { value: hex })
                      )
                    }
                    className="flex h-9 items-center justify-between rounded-[calc(var(--radius)-2px)] border border-border px-2 hover:border-ring"
                    title={`套用主题 ${pi + 1}`}
                  >
                    {preset.map((hex) => (
                      <span
                        key={hex}
                        className="size-4 rounded-full border border-black/10"
                        style={{ background: hex }}
                      />
                    ))}
                  </button>
                ))}
              </div>
            </div>
            {model.colors.map((c, i) => (
              <div key={c.key} className="space-y-1">
                <label className="block text-[11px] text-muted-foreground">
                  {c.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.value}
                    onChange={(e) => onChange("colors", i, { value: e.target.value })}
                    className="h-8 w-10 shrink-0 cursor-pointer rounded-[var(--radius)] border border-border bg-background"
                  />
                  <input
                    value={c.value}
                    onChange={(e) => onChange("colors", i, { value: e.target.value })}
                    className="h-8 w-full rounded-[var(--radius)] border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "block" && (
          <div className="space-y-1">
            <p className="mb-2 text-[11px] text-muted-foreground">
              关闭某个区块会直接隐藏它在预览中的显示（导出后同样生效）。
            </p>
            {model.blocks.map((b, i) => (
              <label
                key={b.id}
                className="flex h-9 cursor-pointer items-center justify-between rounded-[var(--radius)] border border-border px-3 text-xs"
              >
                <span className="truncate text-muted-foreground">{b.label}</span>
                <span
                  role="switch"
                  aria-checked={!b.hidden}
                  onClick={() => onChange("blocks", i, { hidden: !b.hidden })}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                    b.hidden ? "bg-muted" : "bg-foreground"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-background transition-transform ${
                      b.hidden ? "left-0.5" : "left-4"
                    }`}
                  />
                </span>
              </label>
            ))}
            {model.blocks.length === 0 && (
              <p className="text-xs text-muted-foreground">当前区块没有可开关的子区块。</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WexoStudio;