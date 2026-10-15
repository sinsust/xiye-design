"use client";

// 设置 · AI 模型管理
//
// - 用户自行添加模型（DeepSeek / Qwen / Kimi / OpenAI / 自定义），选其一为「当前生效」；
// - 功能级分配：可给某个功能单独指定模型，未指定则跟随「当前生效」；
// - 至少配置一个模型，AI 功能才可用。
// 明文 Key 不出服务端：列表只回 hasKey。

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelIdField } from "@/components/ai-model-field";
import { toast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm-dialog";

interface ModelView {
  id: string;
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  sortOrder: number;
}
interface ModelSettings {
  activeModelId: string | null;
  featureMap: Record<string, string>;
}
interface ProviderTemplate {
  id: string;
  name: string;
  baseUrl: string;
  models: string[];
  keyRequired: boolean;
  keyHint?: string;
}
interface FeatureMeta {
  key: string;
  label: string;
  group: string;
}

export default function AccountModelsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelView[]>([]);
  const [settings, setSettings] = useState<ModelSettings>({ activeModelId: null, featureMap: {} });
  const [providers, setProviders] = useState<ProviderTemplate[]>([]);
  const [features, setFeatures] = useState<FeatureMeta[]>([]);

  const load = useCallback(async () => {
    const r = await fetch("/api/ai/models");
    if (!r.ok) {
      toast.error("模型列表加载失败");
      return;
    }
    const d = await r.json();
    setModels(d.models ?? []);
    setSettings(d.settings ?? { activeModelId: null, featureMap: {} });
    setProviders(d.providers ?? []);
    setFeatures(d.features ?? []);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const modelName = useCallback(
    (id: string | null | undefined) => models.find((m) => m.id === id)?.name ?? "未设置",
    [models],
  );

  const inUse = useCallback(
    (id: string) =>
      settings.activeModelId === id ||
      Object.values(settings.featureMap).includes(id),
    [settings],
  );

  async function setActive(id: string) {
    const r = await fetch("/api/ai/models/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeModelId: id }),
    });
    if (!r.ok) {
      toast.error("切换失败，请重试");
      return;
    }
    const d = await r.json();
    setSettings(d.settings);
    toast.success(`当前生效模型已切换为「${modelName(id)}」`);
  }

  async function setFeatureModel(featureKey: string, modelId: string) {
    const next = { ...settings.featureMap };
    if (modelId) next[featureKey] = modelId;
    else delete next[featureKey];
    const r = await fetch("/api/ai/models/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featureMap: next }),
    });
    if (!r.ok) {
      toast.error("功能分配保存失败");
      return;
    }
    const d = await r.json();
    setSettings(d.settings);
  }

  async function removeModel(m: ModelView) {
    const ok = await confirmDialog({
      title: "删除模型",
      description: `将删除「${m.name}」。此操作不可撤销。`,
      confirmText: "删除",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    const r = await fetch(`/api/ai/models/${m.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(
        d?.error === "model_in_use"
          ? "该模型正在使用中，请先在功能分配里改掉再删除"
          : "删除失败，请重试",
      );
      return;
    }
    toast.success("已删除模型");
    await load();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        加载中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3">
        <Link
          href="/account"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
          aria-label="返回设置"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground">AI 模型</p>
          <p className="text-xs text-muted-foreground">
            添加 DeepSeek / Qwen / Kimi 等模型并设为「当前生效」；也可给单个功能指定不同模型。
          </p>
        </div>
      </div>

      {/* 当前生效模型 */}
      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Star className="size-4" /> 当前生效模型
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">
            未单独指定模型的功能，统一走这里选中的模型。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={settings.activeModelId ?? ""}
              onChange={(e) => e.target.value && setActive(e.target.value)}
              className="min-w-56 flex-1 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">（未设置）</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 模型列表 */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="size-4" /> 模型列表（{models.length}）
          </h2>
        </div>
        {models.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            还没有配置任何模型。AI 功能需要先添加至少一个模型（API）才能使用。
          </p>
        ) : (
          <ul className="space-y-2">
            {models.map((m) => (
              <ModelRow
                key={m.id}
                model={m}
                isActive={settings.activeModelId === m.id}
                isUsed={inUse(m.id)}
                onSetActive={() => setActive(m.id)}
                onDelete={() => removeModel(m)}
                onSaved={load}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 添加模型 */}
      <AddModelSection providers={providers} onSaved={load} />

      {/* 功能分配 */}
      <FeatureAssignSection
        features={features}
        models={models}
        featureMap={settings.featureMap}
        onChange={setFeatureModel}
      />

      {/* 本月用量（只读统计：不设上限、不拦截 —— Key 与费用都归你自己） */}
      <UsageSection />
    </div>
  );
}

/* ───────────────────────── 本月用量（只读） ───────────────────────── */

interface UsageGroupRow {
  key: string;
  label: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

interface UsageSummary {
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgLatencyMs: number;
  byFeature: UsageGroupRow[];
  byModel: UsageGroupRow[];
}

/** token 数紧凑格式：1234 → 1.2K，1234567 → 1.2M */
function compactTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function UsageSection() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [month, setMonth] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/ai/usage");
      if (!r.ok) return; // 统计失败不打扰用户（主页面照常可用）
      const d = await r.json();
      setMonth(d.month ?? "");
      setSummary(d.summary ?? null);
    })();
  }, []);

  const top = summary?.byFeature.filter((f) => f.calls > 0).slice(0, 5) ?? [];

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-foreground">
        本月用量{month ? `（${month}）` : ""}
      </h2>
      <div className="rounded-2xl border border-border bg-card p-4">
        {!summary || summary.totalCalls === 0 ? (
          <p className="text-sm text-muted-foreground">本月还没有 AI 调用记录。</p>
        ) : (
          <>
            {/* 汇总行：单行展示，不堆卡片 */}
            <p className="text-sm text-foreground">
              共 <span className="font-semibold">{summary.totalCalls}</span> 次调用
              <span className="text-muted-foreground">
                {" "}· 输入 {compactTokens(summary.totalTokensIn)} tokens · 输出{" "}
                {compactTokens(summary.totalTokensOut)} tokens · 平均{" "}
                {(summary.avgLatencyMs / 1000).toFixed(1)}s
              </span>
            </p>
            {top.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {top.map((f) => (
                  <li
                    key={f.key}
                    className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
                  >
                    <span className="truncate text-foreground">{f.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {f.calls} 次 · {compactTokens(f.tokensIn + f.tokensOut)} tokens
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">
              仅作统计展示：不设上限、不拦截。API Key 由你自行提供，用量与费用以服务商账单为准。
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── 单个模型行 ───────────────────────── */

function ModelRow({
  model,
  isActive,
  isUsed,
  onSetActive,
  onDelete,
  onSaved,
}: {
  model: ModelView;
  isActive: boolean;
  isUsed: boolean;
  onSetActive: () => void;
  onDelete: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(model.name);
  const [baseUrl, setBaseUrl] = useState(model.baseUrl);
  const [modelId, setModelId] = useState(model.model);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { name, baseUrl, model: modelId };
      // 输入了才覆盖 Key；留空表示不变
      if (apiKey.trim()) patch.apiKey = apiKey.trim();
      const r = await fetch(`/api/ai/models/${model.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!r.ok) {
        // 服务端会给出具体原因（如「该账号下没有模型 kimi-k2-0905-preview，可用：kimi-k3…」），
        // 必须原样显示；只说「保存失败」会让人反复检查填错的字段。
        const d = await r.json().catch(() => null);
        toast.error(String(d?.message ?? d?.error ?? "") || "保存失败，请检查填写");
        return;
      }
      toast.success("已保存");
      setEditing(false);
      setApiKey("");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{model.name}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {model.provider}
            </span>
            {isActive && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                当前生效
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                model.hasKey ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              }`}
            >
              {model.hasKey ? "已配 Key" : "无 Key"}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {model.model} · {model.baseUrl}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!isActive && (
            <Button size="sm" variant="outline" onClick={onSetActive}>
              设为当前
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
            title="编辑"
          >
            {editing ? <X className="size-3.5" /> : <Pencil className="size-3.5" />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={onDelete}
            disabled={isUsed}
            title={isUsed ? "使用中，需先切换" : "删除"}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <FieldInput label="名称" value={name} onChange={setName} />
          <FieldInput label="Base URL" value={baseUrl} onChange={setBaseUrl} />
          <ModelIdField
            value={modelId}
            onChange={setModelId}
            baseUrl={baseUrl}
            apiKey={apiKey}
            storedId={model.id}
          />
          <FieldInput
            label={`API Key（留空表示不变${model.hasKey ? "，当前已配置" : ""}）`}
            value={apiKey}
            onChange={setApiKey}
            type="password"
            placeholder="sk-..."
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              取消
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/* ───────────────────────── 添加模型 ───────────────────────── */

function AddModelSection({
  providers,
  onSaved,
}: {
  providers: ProviderTemplate[];
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId],
  );
  const keyRequired = provider?.keyRequired ?? false;

  function pickProvider(id: string) {
    setProviderId(id);
    const p = providers.find((x) => x.id === id);
    setBaseUrl(p?.baseUrl ?? "");
    setModelId(p?.models[0] ?? "");
    if (!name || providers.some((x) => x.name === name)) {
      setName(p ? p.name : "");
    }
  }

  async function save() {
    if (!name.trim() || !baseUrl.trim() || !modelId.trim()) {
      toast.error("请填写名称、Base URL 与模型 id");
      return;
    }
    if (keyRequired && !apiKey.trim()) {
      toast.error("该服务商需要填写 API Key");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          provider: providerId || "custom",
          baseUrl: baseUrl.trim(),
          model: modelId.trim(),
          apiKey: apiKey.trim() || null,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => null);
        toast.error(String(d?.message ?? d?.error ?? "") || "添加失败，请检查填写");
        return;
      }
      toast.success("已添加模型");
      setOpen(false);
      setProviderId("");
      setName("");
      setBaseUrl("");
      setModelId("");
      setApiKey("");
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="size-4" /> 添加模型
        </h2>
        <Button size="sm" variant={open ? "ghost" : "outline"} onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "添加"}
        </Button>
      </div>

      {open && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div>
            <label className="text-xs text-muted-foreground">服务商</label>
            <select
              value={providerId}
              onChange={(e) => pickProvider(e.target.value)}
              className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              <option value="">请选择…</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {provider?.keyHint && (
              <p className="mt-1 text-[11px] text-muted-foreground">{provider.keyHint}</p>
            )}
          </div>

          <FieldInput label="名称" value={name} onChange={setName} placeholder="如：DeepSeek Chat" />
          <FieldInput label="Base URL" value={baseUrl} onChange={setBaseUrl} />

          <ModelIdField
            value={modelId}
            onChange={setModelId}
            baseUrl={baseUrl}
            apiKey={apiKey}
            presets={provider?.models ?? []}
          />

          <FieldInput
            label={`API Key${keyRequired ? "（必填）" : "（可留空）"}`}
            value={apiKey}
            onChange={setApiKey}
            type="password"
            placeholder={keyRequired ? "sk-..." : "不需要鉴权可留空"}
            disabled={!keyRequired && !apiKey}
          />

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              取消
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── 功能级分配 ───────────────────────── */

function FeatureAssignSection({
  features,
  models,
  featureMap,
  onChange,
}: {
  features: FeatureMeta[];
  models: ModelView[];
  featureMap: Record<string, string>;
  onChange: (featureKey: string, modelId: string) => void;
}) {
  const [onlyAssigned, setOnlyAssigned] = useState(false);

  const groups = useMemo(() => {
    const visible = onlyAssigned
      ? features.filter((f) => featureMap[f.key])
      : features;
    const map = new Map<string, FeatureMeta[]>();
    for (const f of visible) {
      const arr = map.get(f.group) ?? [];
      arr.push(f);
      map.set(f.group, arr);
    }
    return Array.from(map.entries());
  }, [features, featureMap, onlyAssigned]);

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Check className="size-4" /> 功能分配
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyAssigned}
            onChange={(e) => setOnlyAssigned(e.target.checked)}
          />
          仅看已指定
        </label>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        默认「跟随当前」；也可给单个功能指定模型（如「文案生成」用更快的模型）。
      </p>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border py-8 text-center text-xs text-muted-foreground">
          还没有单独指定的功能
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map(([group, list]) => (
            <div key={group}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </p>
              <ul className="space-y-2">
                {list.map((f) => {
                  const assigned = featureMap[f.key] ?? "";
                  return (
                    <li
                      key={f.key}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                        {f.label}
                      </span>
                      <select
                        value={assigned}
                        onChange={(e) => onChange(f.key, e.target.value)}
                        className="w-48 shrink-0 rounded-[var(--radius)] border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                      >
                        <option value="">跟随当前</option>
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── 通用输入 ───────────────────────── */

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-1 w-full rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
      />
    </div>
  );
}