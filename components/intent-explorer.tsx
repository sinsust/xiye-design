"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  RotateCcw,
  Target,
  Users,
  Layers,
  GitBranch,
  ListTree,
  ShieldAlert,
  Flag,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiIntentComposer } from "@/components/ai-intent-composer";
import { useFlowStore } from "@/lib/store/flow-store";
import {
  interpretIntentSmart,
  applyIntentRecommendation,
} from "@/lib/ai-intent";
import {
  emptyBrief,
  synthesizeBriefToText,
  briefToNarrative,
  type Branch,
  type DiscoverMessage,
  type ProductBrief,
} from "@/lib/ai-discover";

const SAMPLES = [
  "AI 周报助手：自动汇总 PR 与故障风险",
  "灵感录音板：语音记点子，每晚自动成计划",
  "同城二手置换：成色鉴定 + 信用担保",
  "人形 AI 面试官：批量初筛技术候选人",
];

const SECTION_ICON: Record<string, { icon: typeof Target; label: string }> = {
  vision: { icon: Target, label: "产品愿景" },
  positioning: { icon: Flag, label: "定位 / 差异" },
  targetAudience: { icon: Users, label: "目标用户" },
  coreModules: { icon: Layers, label: "核心模块" },
  chosenDirections: { icon: GitBranch, label: "已选方向" },
  phases: { icon: ListTree, label: "分期规划" },
  roles: { icon: ShieldAlert, label: "角色权限" },
  risks: { icon: ShieldAlert, label: "风险 / 提醒" },
};

export function IntentExplorer({
  defaultValue = "",
  className = "",
}: {
  defaultValue?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<"input" | "chat">(
    defaultValue.trim() ? "chat" : "input",
  );
  const [input, setInput] = useState(defaultValue);
  const [messages, setMessages] = useState<DiscoverMessage[]>([]);
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [showBrief, setShowBrief] = useState(true);
  const [error, setError] = useState<{ message: string; kind?: string } | null>(null);
  const [quickMode, setQuickMode] = useState(false);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const intentSession = useFlowStore((s) => s.intentSession);
  const setIntentSession = useFlowStore((s) => s.setIntentSession);
  const clearIntentSession = useFlowStore((s) => s.clearIntentSession);
  const setProductBrief = useFlowStore((s) => s.setProductBrief);
  const setIntentNarrative = useFlowStore((s) => s.setIntentNarrative);
  const clearBlueprint = useFlowStore((s) => s.clearBlueprint);

  // 等待 zustand persist 从 localStorage 恢复完成，避免首帧 intentSession 还是 null
  // 导致 URL 里的 ?intent= 直接触发新一轮生成、把旧缓存覆盖掉。
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== "undefined" ? useFlowStore.persist.hasHydrated() : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (useFlowStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useFlowStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  // 首页 ?intent= 自动起聊：带新想法进来 = 明确开启新一轮探索，清掉旧会话与蓝图，
  // 避免继续停留在旧项目的缓存对话里；相同输入（刷新）则恢复缓存，不重复扣费
  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    const cached = intentSession?.messages.length ? intentSession : null;
    const wantsNew = defaultValue.trim().length > 0;
    const sameStart =
      !!cached &&
      cached.messages[0]?.content?.trim() === defaultValue.trim();

    if (wantsNew && !sameStart) {
      startedRef.current = true;
      clearIntentSession();
      setProductBrief(null);
      setIntentNarrative(null);
      clearBlueprint();
      startFromInput(defaultValue.trim());
      return;
    }

    if (cached) {
      startedRef.current = true;
      setPhase("chat");
      setMessages(cached.messages);
      setBrief(cached.brief);
      setDone(cached.done);
      setProductBrief(cached.brief);
      setIntentNarrative(
        cached.brief ? briefToNarrative(cached.brief) : null,
      );
    } else if (wantsNew) {
      startedRef.current = true;
      startFromInput(defaultValue.trim());
    }
  }, [
    hydrated,
    defaultValue,
    intentSession,
    setProductBrief,
    setIntentNarrative,
    clearIntentSession,
    clearBlueprint,
  ]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // 缓存探索式会话到 flow-store（持久化），重新进入页面可直接恢复
  useEffect(() => {
    if (phase === "chat") {
      setIntentSession({ messages, brief, done, updatedAt: Date.now() });
    }
  }, [messages, brief, done, phase, setIntentSession]);

  // 每当 PRD 草稿更新，自动同步到 flow-store，底部「下一步」只需切换步骤
  useEffect(() => {
    if (!brief?.vision) return;
    const text = synthesizeBriefToText(brief);
    void interpretIntentSmart(text).then(({ rec }) => {
      const st = useFlowStore.getState();
      applyIntentRecommendation(rec, st);
      st.setProductBrief(brief);
      st.setIntentNarrative(briefToNarrative(brief));
    });
  }, [brief]);

  const callApi = async (next: DiscoverMessage[], currentBrief: ProductBrief | null) => {
    setThinking(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, brief: currentBrief }),
      });
      const data = (await res.json()) as {
        reply?: string;
        branches?: Branch[];
        brief?: ProductBrief;
        done?: boolean;
        error?: string;
      };
      const assistant: DiscoverMessage = {
        role: "assistant",
        content: data.reply ?? "（AI 未返回内容）",
        branches: data.branches,
      };
      setMessages([...next, assistant]);
      setBrief(data.brief ?? currentBrief);
      setDone(Boolean(data.done));
    } catch {
      setError({ message: "AI 调用失败，请重试或用文字继续补充。", kind: "client" });
    } finally {
      setThinking(false);
    }
  };

  const retryLast = () => {
    if (!messages.length || thinking) return;
    void callApi(messages, brief);
  };

  const startFromInput = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setPhase("chat");
    setInput("");
    const first: DiscoverMessage = { role: "user", content: t };
    setMessages([first]);
    setBrief(null);
    setDone(false);
    void callApi([first], null);
  };

  const chooseBranch = (b: Branch) => {
    if (thinking) return;
    const userMsg: DiscoverMessage = {
      role: "user",
      content: `我选择方向：${b.label} —— ${b.description}`,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    void callApi(next, brief);
  };

  const sendText = () => {
    const t = input.trim();
    if (!t || thinking) return;
    const userMsg: DiscoverMessage = { role: "user", content: t };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    void callApi(next, brief);
  };

  const reset = () => {
    setPhase("input");
    setInput("");
    setMessages([]);
    setBrief(null);
    setDone(false);
    setError(null);
    startedRef.current = false;
    clearIntentSession();
    setProductBrief(null);
    setIntentNarrative(null);
    clearBlueprint();
  };

  // ───────── 快速生成（次级路径：单轮一键组合） ─────────
  if (quickMode) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setQuickMode(false)}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
        >
          ← 返回 AI 探索式访谈
        </button>
        <AiIntentComposer
          defaultValue={input}
          autoAnalyze={false}
          onApplied={() => useFlowStore.getState().nextStep()}
        />
      </div>
    );
  }

  // ───────── 输入阶段（首屏） ─────────
  if (phase === "input") {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) startFromInput(input);
            }}
            rows={4}
            placeholder="用一句话说出你的想法，例如：做一个「灵感录音板」，随手用语音记点子、AI 每晚整理成可执行计划。AI 会和你一步步聊，把产品做丰满。"
            className="w-full resize-none bg-transparent px-4 py-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground"
          />
          <div className="pointer-events-none absolute bottom-4 right-4 text-xs text-muted-foreground">
            ⌘/Ctrl + ↵ 开始
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:gap-x-4">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
            {SAMPLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="truncate rounded-[var(--radius)] border border-border bg-background px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setQuickMode(true)}
              className="text-xs text-muted-foreground underline-offset-2 transition hover:text-primary hover:underline"
            >
              跳过对话，直接生成 →
            </button>
            <Button size="sm" onClick={() => startFromInput(input)} disabled={!input.trim()}>
              <Wand2 className="size-3.5" /> 让 AI 一起探索
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ───────── 对话阶段 ─────────
  return (
    <div className={`grid h-full min-h-0 gap-4 lg:grid-cols-[1fr_320px] ${className}`}>
      {/* 左：对话（占满剩余高度，内部滚动） */}
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold text-foreground">AI 产品探索</span>
          <span className="text-xs text-muted-foreground">多轮访谈，把想法做丰满</span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setShowBrief((v) => !v)}>
              {showBrief ? "隐藏 PRD" : "查看 PRD"}
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" /> 重新输入
            </Button>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div className={m.role === "user" ? "max-w-[85%]" : "max-w-[92%]"}>
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                      : "rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
                  }
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                </div>

                {/* 分支卡片 */}
                {m.role === "assistant" && m.branches && m.branches.length > 0 && !thinking && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {m.branches.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => chooseBranch(b)}
                        className="group rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary/5"
                      >
                        <div className="flex items-center gap-1.5">
                          <GitBranch className="size-3.5 text-primary" />
                          <span className="text-sm font-medium text-foreground">{b.label}</span>
                        </div>
                        <p className="mt-1 text-xs leading-snug text-muted-foreground">{b.description}</p>
                        {b.preview && (
                          <p className="mt-1 text-[11px] text-primary/80">{b.preview}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {thinking && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                AI 正在分析你的想法…
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-2">
              <p className="text-center text-xs text-red-500">{error.message}</p>
              <Button variant="outline" size="sm" onClick={retryLast} disabled={thinking}>
                <RotateCcw className="size-3.5" /> 重试
              </Button>
            </div>
          )}
        </div>

        {/* 常驻输入框 */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendText();
                }
              }}
              rows={1}
              placeholder="补充想法、回答问题，或选择上方方向卡片…"
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary placeholder:text-muted-foreground"
            />
            <Button size="sm" onClick={sendText} disabled={!input.trim() || thinking}>
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* 右：PRD 草稿面板（与左栏同高，内容内部滚动） */}
      {showBrief && (
        <div className="hidden h-full lg:block">
          <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Wand2 className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">PRD 草稿（生长中）</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <BriefPanel brief={brief} />
            </div>
            {thinking && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/80 backdrop-blur-sm">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">AI 正在更新 PRD…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 小屏：PRD 面板移到下方（同样限高 + 内部滚动，防止撑开压住操作条） */}
      {showBrief && (
        <div className="lg:hidden">
          <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <Wand2 className="size-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">PRD 草稿（生长中）</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <BriefPanel brief={brief} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────── PRD 草稿渲染（小标题用主题色 text-primary，辨识度更高） ─────────
function BriefPanel({ brief }: { brief: ProductBrief | null }) {
  if (!brief) {
    return <p className="text-xs text-muted-foreground">开始对话后，这里会实时生长出你的产品 PRD。</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {brief.vision && <Line label="产品愿景" value={brief.vision} />}
      {brief.positioning && <Line label="定位 / 差异" value={brief.positioning} />}
      {brief.targetAudience.length > 0 && (
        <Chips label="目标用户" items={brief.targetAudience} />
      )}
      {brief.coreModules.length > 0 && (
        <div>
          <SectionTitle label="核心模块" />
          <ul className="mt-1 space-y-1">
            {brief.coreModules.map((m, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{m.name}</span>
                {m.detail ? `：${m.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.chosenDirections.length > 0 && (
        <Chips label="已选方向" items={brief.chosenDirections} />
      )}
      {brief.phases.length > 0 && (
        <div>
          <SectionTitle label="分期规划" />
          <ul className="mt-1 space-y-1.5">
            {brief.phases.map((p, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium text-foreground">{p.name}</span>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {p.items.map((it, j) => (
                    <span key={j} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {it}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.roles.length > 0 && (
        <div>
          <SectionTitle label="角色权限" />
          <ul className="mt-1 space-y-1">
            {brief.roles.map((r, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.role}</span>：{r.scope}
              </li>
            ))}
          </ul>
        </div>
      )}
      {brief.extra && Object.keys(brief.extra).length > 0 && (
        <div className="space-y-2 border-t border-border pt-2">
          <SectionTitle label="专属要点" />
          {Object.entries(brief.extra).map(([k, v]) =>
            Array.isArray(v) ? (
              <Chips key={k} label={k} items={v} />
            ) : (
              <Line key={k} label={k} value={v} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return <p className="text-[11px] font-semibold text-primary">{label}</p>;
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <SectionTitle label={label} />
      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{value}</p>
    </div>
  );
}
function Chips({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <SectionTitle label={label} />
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((it, i) => (
          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            {it}
          </span>
        ))}
      </div>
    </div>
  );
}
