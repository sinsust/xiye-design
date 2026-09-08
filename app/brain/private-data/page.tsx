"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  KeyRound,
  FileText,
  User,
  Wallet,
  StickyNote,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Copy,
  Download,
  Lock,
  ShieldCheck,
  MousePointerClick,
  Loader2,
  Sparkles,
} from "lucide-react";
import { decryptJSON, encryptJSON, verifyPassphrase, type EncryptedPayload } from "@/lib/webcrypto";

type PdType = "card" | "account" | "key" | "identity" | "contract" | "other";

interface PdMeta {
  id: string;
  type: PdType;
  name: string;
  hint: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

interface SecretField {
  label: string;
  value: string;
}

const TYPE_META: Record<PdType, { label: string; icon: typeof CreditCard; placeholder: string[] }> = {
  card: { label: "银行卡", icon: CreditCard, placeholder: ["卡号", "持卡人", "有效期", "CVV"] },
  account: { label: "账号", icon: Wallet, placeholder: ["账号", "密码", "绑定手机"] },
  key: { label: "密钥/令牌", icon: KeyRound, placeholder: ["Secret", "备注"] },
  identity: { label: "证件", icon: User, placeholder: ["证件号", "姓名", "有效期"] },
  contract: { label: "合同/协议", icon: FileText, placeholder: ["编号", "对方", "关键条款"] },
  other: { label: "其他", icon: StickyNote, placeholder: ["字段", "值"] },
};

const TYPE_ORDER: PdType[] = ["card", "account", "key", "identity", "contract", "other"];

export default function PrivateDataPage() {
  const [passphrase, setPassphrase] = useState<string | null>(null);
  const [items, setItems] = useState<PdMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockErr, setUnlockErr] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<PdType>("account");
  const [formName, setFormName] = useState("");
  const [formHint, setFormHint] = useState("");
  const [formTags, setFormTags] = useState("");
  const [fields, setFields] = useState<SecretField[]>([{ label: "", value: "" }]);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  const [viewId, setViewId] = useState<string | null>(null);
  const [viewFields, setViewFields] = useState<SecretField[] | null>(null);
  const [viewErr, setViewErr] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 决策 20：自动填充——解锁后将已存的账号机密（账号/密码等）填进一个样例表单，明文不出前端
  const [fillSecret, setFillSecret] = useState<SecretField[] | null>(null);
  const [fillErr, setFillErr] = useState("");
  const [filling, setFilling] = useState(false);

  async function fillSampleForm() {
    if (passphrase === null || !items.length) return;
    setFilling(true);
    setFillErr("");
    try {
      const target = items.find((i) => i.type === "account") ?? items[0];
      const res = await fetch(`/api/private-data/${target.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const item = data.item;
      const sec = await decryptJSON<SecretField[]>(passphrase, {
        salt: item.salt,
        iv: item.iv,
        ciphertext: item.ciphertext,
      });
      const valid = Array.isArray(sec) ? sec : [];
      setFillSecret(valid);
      if (target.type !== "account" && !valid.some((f) => /(密码|password)/i.test(f.label))) {
        setFillErr("当前条目不含账号类字段，可先新增一条「账号」类型资料再试。");
      }
    } catch {
      setFillSecret(null);
      setFillErr("解密失败，口令可能已变更");
    } finally {
      setFilling(false);
    }
  }

  function fillValue(labels: string[]): string {
    if (!fillSecret) return "";
    const l = labels.map((s) => s.toLowerCase());
    const hit = fillSecret.find((f) => l.some((k) => f.label.toLowerCase().includes(k)));
    return hit?.value ?? "";
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/private-data");
      if (res.status === 401) {
        setError("请先登录");
        setItems([]);
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data.items) ? data.items : [];
      setItems(
        raw.map((r: { id: string; type: string; name: string; hint: string; tags: string; createdAt: number; updatedAt: number }) => ({
          id: r.id,
          type: (TYPE_ORDER.includes(r.type as PdType) ? r.type : "other") as PdType,
          name: r.name,
          hint: r.hint,
          tags: safeParseTags(r.tags),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      );
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 首次进入：有记录要先解锁；无记录则引导设置口令
  useEffect(() => {
    if (!loading && passphrase === null && !unlockOpen) {
      setUnlockOpen(true);
    }
  }, [loading, passphrase, unlockOpen]);

  async function doUnlock() {
    setUnlockErr("");
    if (unlockInput.length < 4) {
      setUnlockErr("口令至少 4 位");
      return;
    }
    if (items.length > 0) {
      try {
        const res = await fetch(`/api/private-data/${items[0].id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const item = data.item;
        const ok = await verifyPassphrase(unlockInput, [
          { salt: item.salt, iv: item.iv, ciphertext: item.ciphertext },
        ]);
        if (!ok) {
          setUnlockErr("口令不正确");
          return;
        }
      } catch {
        setUnlockErr("校验失败，请重试");
        return;
      }
    }
    setPassphrase(unlockInput);
    setUnlockInput("");
    setUnlockOpen(false);
  }

  function openCreate() {
    setEditingId(null);
    setFormType("account");
    setFormName("");
    setFormHint("");
    setFormTags("");
    setFields([{ label: "", value: "" }]);
    setFormErr("");
    setEditorOpen(true);
  }

  async function openEdit(meta: PdMeta) {
    if (passphrase === null) {
      setUnlockOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/private-data/${meta.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const item = data.item;
      const secret = await decryptJSON<SecretField[]>(passphrase, {
        salt: item.salt,
        iv: item.iv,
        ciphertext: item.ciphertext,
      });
      setEditingId(meta.id);
      setFormType(meta.type);
      setFormName(meta.name);
      setFormHint(meta.hint);
      setFormTags(meta.tags.join(", "));
      setFields(secret.length ? secret : [{ label: "", value: "" }]);
      setFormErr("");
      setEditorOpen(true);
    } catch {
      setFormErr("解密失败，口令可能已变更");
    }
  }

  async function saveForm() {
    if (passphrase === null) {
      setFormErr("请先解锁");
      return;
    }
    const clean = fields.filter((f) => f.label.trim() && f.value.trim());
    if (!formName.trim()) {
      setFormErr("请填写名称");
      return;
    }
    if (!clean.length) {
      setFormErr("至少填写一个机密字段");
      return;
    }
    setSaving(true);
    setFormErr("");
    try {
      const enc: EncryptedPayload = await encryptJSON(passphrase, clean);
      const tags = formTags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 20);
      const body = {
        type: formType,
        name: formName.trim(),
        hint: formHint.trim(),
        tags,
        salt: enc.salt,
        iv: enc.iv,
        ciphertext: enc.ciphertext,
      };
      const res = editingId
        ? await fetch(`/api/private-data/${editingId}`, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/private-data", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) throw new Error();
      setEditorOpen(false);
      await load();
    } catch {
      setFormErr("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function viewItem(meta: PdMeta) {
    if (passphrase === null) {
      setUnlockOpen(true);
      return;
    }
    setViewErr("");
    setViewFields(null);
    setViewId(meta.id);
    try {
      const res = await fetch(`/api/private-data/${meta.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const item = data.item;
      const secret = await decryptJSON<SecretField[]>(passphrase, {
        salt: item.salt,
        iv: item.iv,
        ciphertext: item.ciphertext,
      });
      setViewFields(secret);
    } catch {
      setViewErr("解密失败，口令可能已变更");
    }
  }

  async function deleteItem(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/private-data/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (viewId === id) setViewId(null);
      await load();
    } catch {
      setError("删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  function exportEncrypted() {
    const blob = new Blob([JSON.stringify({ kind: "xiye-private-data", version: 1, items }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xiye-private-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="xiye-container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldCheck className="size-5 text-success" /> 私人资料
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            银行、账号、密钥、证件等敏感内容。端到端加密：明文仅本地解密，服务端只存密文，不进检索与 AI。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportEncrypted} disabled={!items.length}>
            <Download className="size-3.5" /> 加密导出
          </Button>
          <Button size="sm" onClick={openCreate} disabled={passphrase === null}>
            <Plus className="size-3.5" /> 新增
          </Button>
        </div>
      </div>

      {passphrase === null && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          <Lock className="size-4" /> 本地解密口令未解锁，敏感字段不可查看。
        </div>
      )}

      {error && <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      {/* 决策 20：自动填充测试卡（明文仅本地，不回传服务端） */}
      {passphrase !== null && items.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <MousePointerClick className="size-4 text-success" /> 自动填充表单（测试）
            </h2>
            <Button size="sm" variant="outline" onClick={fillSampleForm} disabled={filling}>
              {filling ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {fillSecret ? "重新填充" : "填入样例表单"}
            </Button>
          </div>
          {fillErr && <p className="mt-1 text-xs text-destructive">{fillErr}</p>}
          {fillSecret && fillSecret.length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs text-muted-foreground">
                账号
                <input
                  readOnly
                  value={fillValue(["账号", "user", "name", "登录名"])}
                  className="mt-1 w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm text-foreground"
                  placeholder="填充后显示账号"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                密码
                <input
                  readOnly
                  value={fillValue(["密码", "pass", "key"])}
                  className="mt-1 w-full rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-sm"
                  type="password"
                  placeholder="填充后显示密码"
                />
              </label>
              <p className="col-span-full text-[11px] text-muted-foreground">
                已自动填入，明文仅在此本地表单展示，不会回传服务端。
              </p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">加载中…</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">还没有私人资料。</p>
          <p className="mt-1 text-xs text-muted-foreground">设置解锁口令后，即可安全存放敏感信息。</p>
          <Button className="mt-4" size="sm" onClick={() => setUnlockOpen(true)}>
            设置解锁口令
          </Button>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => {
            const Icon = TYPE_META[it.type].icon;
            const isViewing = viewId === it.id;
            return (
              <li key={it.id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center gap-3 px-4 py-3">
                  <Icon className="size-4 shrink-0 text-success" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{maskName(it.name)}</div>
                    {it.hint && <div className="truncate text-xs text-muted-foreground">{it.hint}</div>}
                    {it.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {it.tags.map((t) => (
                          <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => viewItem(it)} title="查看明文">
                      <Eye className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(it)} title="编辑">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteItem(it.id)}
                      disabled={deletingId === it.id}
                      title="删除"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                {isViewing && (
                  <div className="border-t border-border px-4 py-3">
                    {viewErr ? (
                      <p className="text-xs text-destructive">{viewErr}</p>
                    ) : viewFields ? (
                      <div className="space-y-2">
                        {viewFields.map((f, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-[11px] text-muted-foreground">{f.label}</div>
                              <div className="truncate font-mono text-sm">{f.value}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigator.clipboard.writeText(f.value)}
                              title="复制"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">解密中…</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 解锁 / 设置口令 */}
      {unlockOpen && (
        <Overlay onClose={() => items.length === 0 ? setUnlockOpen(false) : setUnlockOpen(false)}>
          <h2 className="mb-1 text-base font-semibold">{items.length > 0 ? "解锁私人资料" : "设置解锁口令"}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            {items.length > 0
              ? "输入本地解密口令以查看敏感字段。口令不上传服务器。"
              : "设置一个本地解密口令（至少 4 位）。它只存在于本机浏览器，用于加密你的私人资料。"}
          </p>
          <input
            type="password"
            autoFocus
            value={unlockInput}
            onChange={(e) => setUnlockInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doUnlock()}
            placeholder="本地解密口令"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success/30"
          />
          {unlockErr && <p className="mt-2 text-xs text-destructive">{unlockErr}</p>}
          <div className="mt-4 flex justify-end gap-2">
            {items.length === 0 && (
              <Button variant="ghost" size="sm" onClick={() => setUnlockOpen(false)}>
                稍后
              </Button>
            )}
            <Button size="sm" onClick={doUnlock}>
              确定
            </Button>
          </div>
        </Overlay>
      )}

      {/* 新增 / 编辑 */}
      {editorOpen && (
        <Overlay onClose={() => setEditorOpen(false)}>
          <h2 className="mb-4 text-base font-semibold">{editingId ? "编辑私人资料" : "新增私人资料"}</h2>
          <div className="space-y-3">
            <Field label="类型">
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as PdType)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_META[t].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="名称">
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="如：招商银行储蓄卡"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success/30"
              />
            </Field>
            <Field label="提示（可见，非机密）">
              <input
                value={formHint}
                onChange={(e) => setFormHint(e.target.value)}
                placeholder="如：工资卡 / 尾号 8000"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success/30"
              />
            </Field>
            <Field label="标签（逗号分隔，可选）">
              <input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="银行, 常用"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-success/30"
              />
            </Field>
            <div>
              <div className="mb-1.5 text-xs font-medium text-muted-foreground">机密字段（仅本地加密）</div>
              <div className="space-y-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={f.label}
                      onChange={(e) => updateField(i, "label", e.target.value)}
                      placeholder={TYPE_META[formType].placeholder[i] ?? "字段名"}
                      className="w-1/3 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-success/30"
                    />
                    <input
                      value={f.value}
                      onChange={(e) => updateField(i, "value", e.target.value)}
                      placeholder="值"
                      className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-success/30"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setFields((prev) => prev.filter((_, j) => j !== i))}
                      disabled={fields.length <= 1}
                      title="删除字段"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setFields((prev) => [...prev, { label: "", value: "" }])}
              >
                <Plus className="size-3.5" /> 添加字段
              </Button>
            </div>
          </div>
          {formErr && <p className="mt-3 text-xs text-destructive">{formErr}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
              取消
            </Button>
            <Button size="sm" onClick={saveForm} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </Overlay>
      )}
    </main>
  );

  function updateField(i: number, key: "label" | "value", val: string) {
    setFields((prev) => prev.map((f, j) => (j === i ? { ...f, [key]: val } : f)));
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function maskName(name: string): string {
  if (name.length <= 2) return name;
  return name.slice(0, 1) + "•".repeat(Math.min(name.length - 2, 6)) + name.slice(-1);
}

function safeParseTags(tags: unknown): string[] {
  if (typeof tags === "string") {
    try {
      const v = JSON.parse(tags);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(tags) ? tags.map(String) : [];
}
