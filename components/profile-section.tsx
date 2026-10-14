"use client";

// 档案管理区（/account）：列出全部本地档案，支持切换 / 新建 / 重命名。
//
// 说明：档案的数据清理（连同该档案的业务数据一并删除）需要遍历业务表按
// user_id 清理，属于需求②（数据全本地）的范畴，此处暂不提供，避免出现
// 「只从列表移除、数据仍留在库里」的误导性行为。

import { useEffect, useState } from "react";
import { Check, Layers, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PROFILE_ID,
  newProfileId,
  syncCurrentProfile,
  writeProfileCookie,
  writeProfileList,
  type LocalProfile,
} from "@/lib/local-profile";

export function ProfileSection() {
  const [profiles, setProfiles] = useState<LocalProfile[]>([]);
  const [currentId, setCurrentId] = useState(DEFAULT_PROFILE_ID);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    let alive = true;
    // 与服务端对齐：无 cookie 时服务端回退到既有数据所属的档案，这里同步展示
    syncCurrentProfile().then(({ list, currentId: id }) => {
      if (!alive) return;
      setProfiles(list);
      setCurrentId(id);
    });
    return () => {
      alive = false;
    };
  }, []);

  function persist(list: LocalProfile[]) {
    setProfiles(list);
    writeProfileList(list);
  }

  function switchTo(id: string) {
    if (id === currentId) return;
    writeProfileCookie(id);
    window.location.reload();
  }

  function create() {
    const name = draftName.trim() || `档案 ${profiles.length + 1}`;
    const next: LocalProfile = { id: newProfileId(), name, createdAt: Date.now() };
    persist([...profiles, next]);
    setDraftName("");
    setCreating(false);
    switchTo(next.id);
  }

  function commitRename(id: string) {
    const name = editingName.trim();
    if (name) {
      persist(profiles.map((p) => (p.id === id ? { ...p, name } : p)));
    }
    setEditingId(null);
    setEditingName("");
  }

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Layers className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">本地档案</h2>
        <span className="text-xs text-muted-foreground">
          每个档案的数据相互独立
        </span>
      </div>

      <ul className="mt-3 divide-y divide-border">
        {profiles.map((p) => {
          const isCurrent = p.id === currentId;
          return (
            <li key={p.id} className="flex items-center gap-2 py-2">
              {editingId === p.id ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(p.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                  <Button size="sm" onClick={() => commitRename(p.id)}>
                    保存
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    取消
                  </Button>
                </>
              ) : (
                <>
                  <Check
                    className={`size-3.5 shrink-0 ${
                      isCurrent ? "text-primary" : "opacity-0"
                    }`}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {p.name}
                  </span>
                  {isCurrent ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      当前使用
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => switchTo(p.id)}>
                      切换
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`重命名 ${p.name}`}
                    onClick={() => {
                      setEditingId(p.id);
                      setEditingName(p.name);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-3">
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") setCreating(false);
              }}
              placeholder={`档案 ${profiles.length + 1}`}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
            />
            <Button size="sm" onClick={create}>
              创建
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
              取消
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> 新建档案
          </Button>
        )}
      </div>
    </section>
  );
}