"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  Settings2,
  X,
  Clock,
  AlertTriangle,
  BookOpen,
  Inbox,
  Lightbulb,
  AlertCircle,
  Flag,
  CheckCircle2,
  ClipboardList,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  getPushPermissionState,
  requestNotificationPermission,
  sendNotification,
  shouldAttemptBrowserPush,
  isPushSeen,
  markPushSeen,
  clearPushSession,
  type PushPermissionState,
} from "@/lib/browser-notification";
import { ProvenancePanel } from "@/components/brain/ProvenancePanel";
import type { ReminderType } from "@/lib/brain-reminder";
import { fetchSession } from "@/lib/auth-session";
import { AUTH_CHANGED_EVENT } from "@/lib/auth-events";

// —— 通知中心数据（与 /api/brain/notifications 对齐）——
type NotificationStatus = "new" | "read" | "deferred" | "snoozed" | "done" | "ignored";
type NotificationPriority = "high" | "medium" | "low";
type NotificationAction = "read" | "unread" | "defer" | "snooze" | "done" | "ignore";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  link: string | null;
  refType: string | null;
  refId: string | null;
  reason: string | null;
  status: NotificationStatus;
  priority: NotificationPriority;
  snoozedUntil: number | null;
  completedAt: number | null;
  createdAt: number;
}

interface RuleSetting {
  type: ReminderType;
  enabled: boolean;
}

const PRIORITY_META: Record<NotificationPriority, { label: string; cls: string }> = {
  high: { label: "高优先级", cls: "text-red-500" },
  medium: { label: "中优先级", cls: "text-amber-500" },
  low: { label: "低优先级", cls: "text-muted-foreground" },
};

const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  task_overdue: { label: "任务到期", icon: AlertTriangle },
  task_due_soon: { label: "任务即将到期", icon: Clock },
  review_due: { label: "复习到期", icon: BookOpen },
  inbox_backlog: { label: "收件箱积压", icon: Inbox },
  strategy_review: { label: "策略回顾", icon: Lightbulb },
  knowledge_decay: { label: "知识衰减", icon: AlertCircle },
  project_milestone: { label: "里程碑", icon: Flag },
  task_complete_followup: { label: "任务复盘", icon: CheckCircle2 },
  reminder_item: { label: "确认提醒", icon: Bell },
  plan_pending: { label: "待确认计划", icon: ClipboardList },
  project_risk: { label: "项目风险", icon: ShieldAlert },
  // P4-C：主动风险简报来源（"今天值得关注"推送层）
  proactive_task: { label: "主动·任务", icon: AlertTriangle },
  proactive_project: { label: "主动·项目风险", icon: ShieldAlert },
  proactive_plan: { label: "主动·处理计划", icon: ClipboardList },
  proactive_inbox: { label: "主动·收件箱", icon: Inbox },
  proactive_note: { label: "主动·笔记", icon: BookOpen },
  proactive_review: { label: "主动·学习复习", icon: BookOpen },
  proactive_week: { label: "主动·本周计划", icon: Sparkles },
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

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ReminderCenter({ onNavigate }: ReminderCenterProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "settings" | "decay">("list");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inQuiet, setInQuiet] = useState(false);
  const [dailyCap, setDailyCap] = useState(20);

  // 衰减笔记
  const [decayed, setDecayed] = useState<{ id: string; title: string; days: number }[]>([]);
  const [decayLoading, setDecayLoading] = useState(false);

  // 设置
  const [rules, setRules] = useState<RuleSetting[]>([]);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [perm, setPerm] = useState<PushPermissionState>("default");
  const uidRef = useRef<string>("");
  // perm 实时镜像：load([]) 为稳定回调，内部需读取最新权限态而非闭包旧值
  const permRef = useRef<PushPermissionState>("default");
  // 面板外点击关闭
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/brain/notifications");
      if (!res.ok) return;
      const d = await res.json();
      const list: NotificationItem[] = Array.isArray(d.notifications) ? d.notifications : [];
      setNotifications(list);
      setUnread(d.unread ?? 0);
      setInQuiet(d.inQuietHours ?? false);
      setDailyCap(d.dailyCap ?? 20);
      // 浏览器通知：仅高优先级档位、非免打扰、已授权时才尝试弹；同一通知 id 当前会话只出现一次
    const uid = uidRef.current;
    for (const n of list) {
      if (!uid || isPushSeen(uid, n.id)) continue;
      markPushSeen(uid, n.id); // 先记录「已出现过」，保证每个 id 本次会话只处理一次（低优/免打扰时也不重复）
      if (
        shouldAttemptBrowserPush({
          state: permRef.current,
          inQuiet: Boolean(d.inQuietHours),
          status: n.status,
          priority: n.priority,
        })
      ) {
        sendNotification(n.title, n.detail || "点击前往处理", n.link || "/brain");
      }
    }
    } catch {
      /* 忽略 */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 300_000); // 每 5 分钟
    return () => clearInterval(t);
  }, [load]);

  // 关闭时重置角标？不：角标应反映未读，点开面板后仍保留直到全部已读。
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const act = async (id: string, action: NotificationAction, days?: number) => {
    const prev = notifications.find((n) => n.id === id);
    try {
      const res = await fetch("/api/brain/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(days ? { days } : {}) }),
      });
      if (!res.ok) return;
      const d = await res.json();
      const updated = d.notification as NotificationItem | undefined;
      if (!updated) return;
      setNotifications((prevList) => prevList.map((n) => (n.id === id ? updated : n)));
      const wasNew = prev?.status === "new";
      const isNew = updated.status === "new";
      if (wasNew && !isNew) setUnread((u) => Math.max(0, u - 1));
      if (!wasNew && isNew) setUnread((u) => u + 1);
    } catch {
      /* 忽略 */
    }
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/brain/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", all: true }),
      });
      setUnread(0);
      setNotifications((prevList) =>
        prevList.map((n) =>
          n.status === "new" || n.status === "deferred" || n.status === "snoozed"
            ? { ...n, status: "read" as const }
            : n,
        ),
      );
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
  // 初始化权限态；获取当前用户，用于会话去重键；登录/切换/登出时刷新 uid 并清理去重
  useEffect(() => {
    const applyPerm = () => {
      const p = getPushPermissionState();
      setPerm(p);
      permRef.current = p;
    };
    applyPerm();

    const syncUser = async () => {
      const u = await fetchSession({ force: true });
      const next = u?.id ?? "";
      if (next !== uidRef.current) {
        // 更换 / 登出 → 清理旧用户的会话去重桶，避免跨会话残留
        clearPushSession(uidRef.current || next);
        uidRef.current = next;
      }
    };
    syncUser();
    const onChange = () => {
      applyPerm();
      syncUser();
      load();
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    const onFocus = () => {
      const p = getPushPermissionState();
      setPerm(p);
      permRef.current = p;
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

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
    const p = getPushPermissionState();
    setPerm(p);
    permRef.current = p;
    void ok;
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

  // 点击通知 → 跳转真实对象；知识衰减 → 打开衰减处理列表
  const onNotificationClick = (n: NotificationItem) => {
    if (n.type === "knowledge_decay") openDecay();
    else if (n.link) onNavigate(n.link);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          setView("list");
          load();
        }}
        className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        aria-label="通知中心"
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[360px] origin-top-right animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden rounded-xl border border-border bg-white shadow-2xl shadow-primary/15">
          {/* 标题栏 */}
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">
              {view === "list" ? "🔔 通知中心" : view === "decay" ? "⚠️ 衰减笔记" : "⚙️ 提醒设置"}
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
                  aria-label="返回通知"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          {view === "list" ? (
            <NotificationList
              notifications={notifications}
              loading={loading}
              inQuiet={inQuiet}
              dailyCap={dailyCap}
              onAct={act}
              onClick={onNotificationClick}
            />
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

function ActionBtn({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={
        "rounded px-1.5 py-0.5 text-[10px] font-medium transition " +
        (danger ? "text-destructive hover:bg-destructive/10" : "text-primary hover:bg-primary/10")
      }
    >
      {children}
    </button>
  );
}

function NotificationRow({
  n,
  onAct,
  onClick,
}: {
  n: NotificationItem;
  onAct: (id: string, action: NotificationAction, days?: number) => void;
  onClick: (n: NotificationItem) => void;
}) {
  const meta = TYPE_META[n.type] ?? { label: "通知", icon: Bell };
  const Icon = meta.icon;
  const isActive = n.status === "new" || n.status === "deferred" || n.status === "snoozed";
  return (
    <div
      className={
        "border-b border-border/50 px-3 py-2 transition " +
        (n.status === "new" ? "bg-primary/[0.03]" : "")
      }
    >
      <button onClick={() => onClick(n)} className="flex w-full items-start gap-2 text-left">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-medium text-foreground">{n.title}</span>
            {n.status === "new" && <span className="size-1.5 shrink-0 rounded-full bg-red-500" />}
            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/70">{relTime(n.createdAt)}</span>
          </div>
          {n.detail && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{n.detail}</div>}
          <div className="mt-0.5 truncate text-[10px] text-muted-foreground/60">
            {n.reason || `规则触发：${meta.label}`}
          </div>
          {n.status === "snoozed" && n.snoozedUntil != null && (
            <div className="mt-0.5 text-[10px] text-amber-600">稍后至 {fmtDate(n.snoozedUntil)}</div>
          )}
        </div>
      </button>

      <div className="mt-1 flex items-center gap-0.5 pl-[22px]">
        {isActive ? (
          <>
            <ActionBtn onClick={() => onAct(n.id, "read")}>已读</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "defer")}>延后</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "snooze", 1)}>稍后</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "done")}>完成</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "ignore")} danger>
              忽略
            </ActionBtn>
          </>
        ) : n.status === "read" ? (
          <>
            <ActionBtn onClick={() => onAct(n.id, "unread")}>未读</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "done")}>完成</ActionBtn>
            <ActionBtn onClick={() => onAct(n.id, "ignore")} danger>
              忽略
            </ActionBtn>
          </>
        ) : (
          <ActionBtn onClick={() => onAct(n.id, "unread")}>恢复</ActionBtn>
        )}
      </div>

      {/* P2-A：确认提醒 → 来源与关联 */}
      {n.type === "reminder_item" && n.refId && (
        <div className="mt-1 pl-[22px]">
          <ProvenancePanel anchor={{ reminderId: n.refId }} title="来源与关联" />
        </div>
      )}
    </div>
  );
}

function NotificationList({
  notifications,
  loading,
  inQuiet,
  dailyCap,
  onAct,
  onClick,
}: {
  notifications: NotificationItem[];
  loading: boolean;
  inQuiet: boolean;
  dailyCap: number;
  onAct: (id: string, action: NotificationAction, days?: number) => void;
  onClick: (n: NotificationItem) => void;
}) {
  if (loading) {
    return <div className="p-6 text-center text-xs text-muted-foreground">加载中…</div>;
  }
  if (!notifications.length) {
    return (
      <div className="flex flex-col items-center gap-1 p-6 text-center">
        <Check className="size-5 text-emerald-500" />
        <p className="text-xs text-muted-foreground">当前没有通知</p>
        {inQuiet && <p className="text-[10px] text-muted-foreground/70">免打扰时段内，仅展示不弹通知</p>}
      </div>
    );
  }
  const active = notifications.filter((n) => n.status === "new" || n.status === "deferred" || n.status === "snoozed");
  const done = notifications.filter((n) => n.status === "read" || n.status === "done" || n.status === "ignored");
  return (
    <div className="max-h-[400px] overflow-y-auto">
      {inQuiet && (
        <div className="mx-3 mt-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
          免打扰时段：不弹浏览器通知 · 每日上限 {dailyCap} 条
        </div>
      )}
      {active.map((n) => (
        <NotificationRow key={n.id} n={n} onAct={onAct} onClick={onClick} />
      ))}
      {done.length > 0 && (
        <>
          <div className="px-3 pb-1 pt-2 text-[10px] font-medium text-muted-foreground/70">
            已处理（{done.length}）
          </div>
          {done.map((n) => (
            <NotificationRow key={n.id} n={n} onAct={onAct} onClick={onClick} />
          ))}
        </>
      )}
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
  perm: PushPermissionState;
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
    <div className="max-h-[420px] space-y-3 overflow-y-auto p-3">
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

      {/* 浏览器通知（附加渠道：仅高优先级站内通知可弹出；失败/未授权/不支持一律降级到站内通知） */}
      <div className="rounded-lg border border-border/70 bg-muted/20 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground">浏览器通知</span>
          <span className="text-[11px] text-muted-foreground">
            {perm === "granted"
              ? "✅ 已授权"
              : perm === "denied"
                ? "🚫 已拒绝"
                : perm === "unsupported"
                  ? "⚠️ 不支持"
                  : "⚪ 未授权"}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          仅「高优先级」的站内通知才会尝试弹出浏览器通知；未授权、被拒绝或临时失败时，消息仍完整保留在站内通知中心。
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {perm === "default" && (
            <button
              onClick={onAskPermission}
              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
            >
              授权通知
            </button>
          )}
          {perm === "granted" && (
            <button
              onClick={onTest}
              className="rounded-md border border-border bg-white px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
            >
              测试通知
            </button>
          )}
        </div>
        {perm === "denied" && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-destructive/80">
            已被浏览器拒绝。请在浏览器地址栏左侧的站点图标 → 网站设置 → 通知中改为「允许」后重新打开本面板；开启前消息仍保留在站内通知中心。
          </p>
        )}
        {perm === "unsupported" && (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            当前浏览器不支持 Web 通知，将继续使用站内通知中心作为消息渠道，不影响提醒功能。
          </p>
        )}
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
    <div className="max-h-[420px] space-y-2 overflow-y-auto p-3">
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
