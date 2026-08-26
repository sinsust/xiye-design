"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, Settings2, X } from "lucide-react";
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  sendNotification,
} from "@/lib/browser-notification";
import type { ReminderType, ReminderPriority } from "@/lib/brain-reminder";

type Reminder = {
  type: ReminderType;
  title: string;
  detail: string;
  link: string;
  priority: ReminderPriority;
};

interface RuleSetting {
  type: ReminderType;
  enabled: boolean;
}

const PRIORITY_ORDER: ReminderPriority[] = ["high", "medium", "low"];
const PRIORITY_META: Record<ReminderPriority, { label: string; cls: string }> = {
  high: { label: "高优先级", cls: "text-red-500" },
  medium: { label: "中优先级", cls: "text-amber-500" },
  low: { label: "低优先级", cls: "text-muted-foreground" },
};

const RULE_LABELS: Record<ReminderType, string> = {
  task_overdue: "任务到期提醒",
  task_due_soon: "任务即将到期",
  review_due: "复习到期提醒",
  inbox_backlog: "收件箱积压提醒",
  strategy_review: "策略回顾提醒",
  knowledge_decay: "知识衰减预警",
  project_milestone: "里程碑截止提醒",
  task_complete_followup: "任务完成跟进",
  reminder_item: "确认提醒",
};
// 独立提醒无规则开关，设置页不展示对应开关
const RULE_TYPES = (Object.keys(RULE_LABELS) as ReminderType[]).filter((t) => t !== "reminder_item");

export interface ReminderCenterProps {
  onNavigate: (link: string) => void;
}

export function ReminderCenter({ onNavigate }: ReminderCenterProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "settings" | "decay">("list");
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inQuiet, setInQuiet] = useState(false);

  // 衰减笔记
  const [decayed, setDecayed] = useState<{ id: string; title: string; days: number }[]>([]);
  const [decayLoading, setDecayLoading] = useState(false);

  // 设置
  const [rules, setRules] = useState<RuleSetting[]>([]);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [perm, setPerm] = useState<NotificationPermission>("default");

  // 已推送过的类型（本次会话只推一次，避免 5 分钟轮询重复打扰）
  const notified = useRef<Set<string>>(new Set());
  // 面板外点击关闭
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadReminders = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/reminders");
      if (res.ok) {
        const d = await res.json();
        setReminders(d.reminders ?? []);
        setUnread(d.unread ?? 0);
        setInQuiet(d.inQuietHours ?? false);
        // 免打扰时段不发浏览器通知
        if (!d.inQuietHours && (d.reminders ?? []).length) {
          for (const r of d.reminders as Reminder[]) {
            if (notified.current.has(r.type)) continue;
            notified.current.add(r.type);
            sendNotification(r.title, r.detail || "点击前往处理", r.link);
          }
        }
      }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReminders();
    const t = setInterval(loadReminders, 300_000); // 每 5 分钟
    return () => clearInterval(t);
  }, [loadReminders]);

  // 关闭时重置角标？不：角标应反映未读，点开面板后仍保留直到全部已读。
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const markAllRead = async () => {
    try {
      await fetch("/api/brain/reminders/read", { method: "POST" });
      setUnread(0);
    } catch {
      /* 忽略 */
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/reminder-settings");
      if (res.ok) {
        const d = await res.json();
        setRules(d.rules ?? []);
        setQuietStart(d.quietHoursStart || "22:00");
        setQuietEnd(d.quietHoursEnd || "08:00");
      }
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    setPerm(notificationPermission() as NotificationPermission);
  }, []);

  const openSettings = () => {
    setView("settings");
    loadSettings();
  };

  const toggleRule = async (type: ReminderType, enabled: boolean) => {
    setRules((prev) => prev.map((r) => (r.type === type ? { ...r, enabled } : r)));
    try {
      await fetch("/api/brain/reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: [{ type, enabled }] }),
      });
    } catch {
      /* 忽略 */
    }
  };

  const saveQuiet = async () => {
    try {
      await fetch("/api/brain/reminder-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quietHoursStart: quietStart, quietHoursEnd: quietEnd }),
      });
    } catch {
      /* 忽略 */
    }
  };

  const askPermission = async () => {
    const ok = await requestNotificationPermission();
    setPerm(notificationPermission() as NotificationPermission);
    if (!ok) setReminders((prev) => prev); // 无副作用占位
  };

  const openDecay = useCallback(async () => {
    setView("decay");
    setDecayLoading(true);
    try {
      const res = await fetch("/api/brain/notes/decay");
      if (res.ok) {
        const d = await res.json();
        setDecayed(Array.isArray(d.notes) ? d.notes : []);
      }
    } catch {
      /* 忽略 */
    } finally {
      setDecayLoading(false);
    }
  }, []);

  const actOnDecay = async (id: string, action: "keep" | "archive" | "delete") => {
    try {
      const res = await fetch("/api/brain/notes/decay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        const d = await res.json();
        setDecayed(d.notes ?? []);
      }
    } catch {
      /* 忽略 */
    }
  };

  // 点击衰减类提醒 → 打开衰减处理列表
  const onReminderClick = (r: Reminder) => {
    if (r.type === "knowledge_decay") openDecay();
    else onNavigate(r.link);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setView("list");
          loadReminders();
        }}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="提醒中心"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[340px] origin-top-right animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden rounded-xl border border-border bg-white shadow-2xl shadow-primary/15">
          {/* 标题栏 */}
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">
              {view === "list" ? "🔔 提醒中心" : view === "decay" ? "⚠️ 衰减笔记" : "⚙️ 提醒设置"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {view === "list" ? (
                <>
                  <button
                    onClick={markAllRead}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-primary transition hover:bg-primary/10"
                  >
                    全部已读
                  </button>
                  <button
                    onClick={openSettings}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="提醒设置"
                  >
                    <Settings2 className="size-3.5" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setView("list")}
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label="返回提醒"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {view === "list" ? (
            <ReminderList reminders={reminders} loading={loading} onClick={onReminderClick} inQuiet={inQuiet} />
          ) : view === "decay" ? (
            <DecayList loading={decayLoading} notes={decayed} onAction={actOnDecay} />
          ) : (
            <ReminderSettings
              rules={rules}
              quietStart={quietStart}
              quietEnd={quietEnd}
              perm={perm}
              onToggleRule={toggleRule}
              onQuietStart={setQuietStart}
              onQuietEnd={setQuietEnd}
              onSaveQuiet={saveQuiet}
              onAskPermission={askPermission}
              onOpenDecay={openDecay}
              onTest={() => sendNotification("测试通知", "这是你的第二大脑，通知已生效", "/brain")}
            />
          )}

          {view === "list" && (
            <div className="border-t border-border/70 p-1.5">
              <button
                onClick={openSettings}
                className="flex w-full items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-[11px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Settings2 className="size-3.5" /> 提醒设置
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReminderList({
  reminders,
  loading,
  onClick,
  inQuiet,
}: {
  reminders: Reminder[];
  loading: boolean;
  onClick: (r: Reminder) => void;
  inQuiet: boolean;
}) {
  if (loading) {
    return <div className="p-6 text-center text-xs text-muted-foreground">加载中…</div>;
  }
  if (!reminders.length) {
    return (
      <div className="flex flex-col items-center gap-1 p-6 text-center">
        <Check className="size-5 text-emerald-500" />
        <p className="text-xs text-muted-foreground">当前没有待处理的提醒</p>
        {inQuiet && <p className="text-[10px] text-muted-foreground/70">免打扰时段内，仅展示不弹通知</p>}
      </div>
    );
  }
  return (
    <div className="max-h-[360px] space-y-3 overflow-y-auto p-3">
      {inQuiet && (
        <div className="rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">免打扰时段：不弹浏览器通知</div>
      )}
      {PRIORITY_ORDER.map((p) => {
        const items = reminders.filter((r) => r.priority === p);
        if (!items.length) return null;
        return (
          <div key={p}>
            <div className={"mb-1 text-[11px] font-medium " + PRIORITY_META[p].cls}>
              {PRIORITY_META[p].label}
            </div>
            <div className="space-y-1.5">
              {items.map((r) => (
                <button
                  key={r.type}
                  onClick={() => onClick(r)}
                  className="block w-full rounded-lg border border-border/70 bg-muted/20 px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="text-xs font-medium text-foreground">{r.title}</div>
                  {r.detail && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{r.detail}</div>}
                  <div className="mt-1 text-[10px] font-medium text-primary">去处理 →</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReminderSettings({
  rules,
  quietStart,
  quietEnd,
  perm,
  onToggleRule,
  onQuietStart,
  onQuietEnd,
  onSaveQuiet,
  onAskPermission,
  onOpenDecay,
  onTest,
}: {
  rules: RuleSetting[];
  quietStart: string;
  quietEnd: string;
  perm: NotificationPermission;
  onToggleRule: (type: ReminderType, enabled: boolean) => void;
  onQuietStart: (v: string) => void;
  onQuietEnd: (v: string) => void;
  onSaveQuiet: () => void;
  onAskPermission: () => void;
  onOpenDecay: () => void;
  onTest: () => void;
}) {
  const ruleMap = new Map(rules.map((r) => [r.type, r.enabled]));
  return (
    <div className="max-h-[400px] space-y-3 overflow-y-auto p-3">
      {/* 免打扰 */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
        <div className="mb-1.5 text-[11px] font-medium text-foreground">免打扰时段</div>
        <div className="flex items-center gap-1.5">
          <input
            type="time"
            value={quietStart}
            onChange={(e) => onQuietStart(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none"
          />
          <span className="text-xs text-muted-foreground">~</span>
          <input
            type="time"
            value={quietEnd}
            onChange={(e) => onQuietEnd(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs focus:border-primary focus:outline-none"
          />
        </div>
        <button
          onClick={onSaveQuiet}
          className="mt-2 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          保存免打扰
        </button>
      </div>

      {/* 各类型开关 */}
      <div className="space-y-1">
        {RULE_TYPES.map((type) => {
          const enabled = ruleMap.get(type) ?? true;
          return (
            <div key={type} className="flex items-center justify-between rounded-lg border border-border/60 px-2.5 py-1.5">
              <span className="text-xs text-foreground">{RULE_LABELS[type]}</span>
              <button
                onClick={() => onToggleRule(type, !enabled)}
                className={
                  "relative h-5 w-9 rounded-full transition " +
                  (enabled ? "bg-primary" : "bg-muted")
                }
                aria-pressed={enabled}
              >
                <span
                  className={
                    "absolute top-0.5 size-4 rounded-full bg-white shadow transition-all " +
                    (enabled ? "left-[18px]" : "left-0.5")
                  }
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* 浏览器通知 */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground">浏览器通知</span>
          <span className="text-[11px] text-muted-foreground">
            {perm === "granted" ? "✅ 已授权" : perm === "denied" ? "🚫 已拒绝" : "⚪ 未授权"}
          </span>
        </div>
        <div className="mt-2 flex gap-1.5">
          {!notificationsSupported() ? (
            <span className="text-[11px] text-muted-foreground">当前浏览器不支持通知</span>
          ) : perm !== "granted" ? (
            <button
              onClick={onAskPermission}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
            >
              授权通知
            </button>
          ) : null}
          <button
            onClick={onTest}
            className="rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
          >
            测试通知
          </button>
        </div>
      </div>
      {/* 知识衰减处理入口 */}
      <button
        onClick={onOpenDecay}
        className="flex w-full items-center justify-between rounded-lg border border-dashed border-border px-2.5 py-2 text-left transition hover:border-primary/40 hover:bg-primary/5"
      >
        <span className="text-xs text-foreground">⚠️ 衰减笔记处理</span>
        <span className="text-[11px] font-medium text-primary">查看并处理 →</span>
      </button>
    </div>
  );
}

function DecayList({
  loading,
  notes,
  onAction,
}: {
  loading: boolean;
  notes: { id: string; title: string; days: number }[];
  onAction: (id: string, action: "keep" | "archive" | "delete") => void;
}) {
  if (loading) {
    return <div className="p-6 text-center text-xs text-muted-foreground">加载中…</div>;
  }
  if (!notes.length) {
    return (
      <div className="flex flex-col items-center gap-1 p-6 text-center">
        <Check className="size-5 text-emerald-500" />
        <p className="text-xs text-muted-foreground">知识库很健康，没有衰减笔记</p>
      </div>
    );
  }
  return (
    <div className="max-h-[400px] space-y-2 overflow-y-auto p-3">
      <p className="text-[11px] text-muted-foreground">⚠️ 以下笔记可能已被遗忘（60 天未被引用/复习/打开）</p>
      {notes.map((n) => (
        <div key={n.id} className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <div className="text-xs font-medium text-foreground">「{n.title}」</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{n.days} 天未访问</div>
          <div className="mt-1.5 flex gap-1">
            <button
              onClick={() => onAction(n.id, "keep")}
              className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
            >
              保留
            </button>
            <button
              onClick={() => onAction(n.id, "archive")}
              className="rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-foreground transition hover:bg-muted"
            >
              归档
            </button>
            <button
              onClick={() => onAction(n.id, "delete")}
              className="rounded-md border border-border bg-white px-2 py-0.5 text-[11px] font-medium text-destructive transition hover:bg-destructive/10"
            >
              删除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}