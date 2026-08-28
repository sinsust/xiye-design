"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  GitBranch,
  Loader2,
  PencilLine,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowStore } from "@/lib/store/flow-store";
import { personaPayload } from "../agents-store";
import {
  interpretIntentSmart,
  applyIntentRecommendation,
} from "@/lib/ai-intent";
import {
  briefToNarrative,
  synthesizeBriefToText,
  type Branch,
  type DiscoverMessage,
  type ProductBrief,
} from "@/lib/ai-discover";
import {
  extractFlowError,
  flowError,
  flowErrorUserMessage,
  newRequestId,
  type FlowAIError,
} from "@/lib/flow-ai-types";

const SAMPLES = [
  "AI 周报助手：自动汇总 PR 与故障风险",
  "灵感录音板：语音记点子，每晚自动成计划",
  "同城二手置换：成色鉴定 + 信用担保",
  "人形 AI 面试官：批量初筛技术候选人",
];

/**
 * 中栏 · 对话流（主舞台）
 * Phase 1：协调员单角色多轮对话（复用 /api/ai/discover，与老 flow 同一协议与会话缓存）
 * Phase 2：专家会诊卡片将插入本对话流
 */
export function ChatStream({
  onConversationChange,
  onSummon,
  consulting,
  onManualProceed,
  onViewCurrentPlan,
}: {
  /** 通知父栏对话进展（消息数 / 思考态 / 消息列表 / 是否被失败的 AI 操作阻塞），用于会诊按钮可用性与自动会诊 */
  onConversationChange: (s: {
    messageCount: number;
    thinking: boolean;
    messages: DiscoverMessage[];
    blocked?: boolean;
  }) => void;
  onSummon: () => void;
  consulting: boolean;
  /** F0-A 失败态动作：继续手动完善（解除 AI 阻塞） / 查看当前方案 */
  onManualProceed?: () => void;
  onViewCurrentPlan?: () => void;
}) {
  const [phase, setPhase] = useState<"input" | "chat">("input");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DiscoverMessage[]>([]);
  const [brief, setBrief] = useState<ProductBrief | null>(null);
  const [thinking, setThinking] = useState(false);
  // F0-A：当前操作的统一错误（含 requestId）；失败态据此渲染而非伪造 assistant
  const [opError, setOpError] = useState<FlowAIError | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // F0-A：幂等 operationId（同一操作重试复用）+ 可取消的 AbortController
  const opIdRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);

  const intentSession = useFlowStore((s) => s.intentSession);
  const setIntentSession = useFlowStore((s) => s.setIntentSession);
  const clearIntentSession = useFlowStore((s) => s.clearIntentSession);
  const setProductBrief = useFlowStore((s) => s.setProductBrief);
  const setIntentNarrative = useFlowStore((s) => s.setIntentNarrative);
  const setTechStack = useFlowStore((s) => s.setTechStack);
  const setVisualStyle = useFlowStore((s) => s.setVisualStyle);
  const clearBlueprint = useFlowStore((s) => s.clearBlueprint);
  const setPanelOutput = useFlowStore((s) => s.setPanelOutput);
  const setDeliverArtifacts = useFlowStore((s) => s.setDeliverArtifacts);

  // 等待 persist 水合完成再决定恢复缓存会话（与老 IntentExplorer 同一防御）
  const [hydrated, setHydrated] = useState(() =>
    typeof window !== "undefined" ? useFlowStore.persist.hasHydrated() : false,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (useFlowStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useFlowStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  // 首页 ?intent= / ?reset= 引导：清旧状态 + 用意图自动发起首条对话（替代老 /flow 的 Step0Intent）。
  // 防重复扣费：参数消费后立即 replaceState 清理，刷新不再重放；
  // 若缓存会话的首条用户消息与 intent 相同，则直接续用缓存，不重置、不重发（下方「恢复缓存会话」effect 接管）。
  // 注意：React Strict Mode 开发期会把本组件卸载再重挂载，而上面 replaceState 已清掉 URL 的 intent；
  // 因此 intent 在「清 URL 之前」先从缓存会话里兜底取回（cached.messages[0]），保证重挂载也能种下首条消息。
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const urlIntent = params.get("intent")?.trim();
    const reset = params.get("reset") === "1";
    const cached = useFlowStore.getState().intentSession;
    // 重挂载兜底：URL 的 intent 已被首次挂载清掉时，从已落库的缓存首条用户消息取回
    const intent = urlIntent || (cached?.messages?.[0]?.role === "user" ? cached.messages[0].content : null);
    if (!intent && !reset) return;

    const firstUserMsg = cached?.messages.find((m) => m.role === "user");
    const canResume = Boolean(intent) && !reset && Boolean(cached && cached.messages.length > 0 && firstUserMsg?.content === intent);

    // 消费 URL 参数（避免刷新重放重复调 AI）；仅当 URL 上确有该参数时才清理
    if (urlIntent || reset) {
      params.delete("intent");
      params.delete("reset");
      history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
    }

    if (canResume) return;
    useFlowStore.getState().resetAll(1);
    useFlowStore.getState().setSavedProjectId(null);
    if (intent) {
      startedRef.current = true;
      setPhase("chat");
      const first: DiscoverMessage = { role: "user", content: intent };
      setMessages([first]);
      setBrief(null);
      // 同时落到 store，使 Strict Mode 重挂载时「恢复缓存会话」effect 能接力渲染首条消息
      useFlowStore.getState().setIntentSession({ messages: [first], brief: null, done: false, updatedAt: Date.now() });
      void runDiscover([first], null, "new");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // 恢复缓存会话（与老 /flow 共享同一 intentSession，可无缝接力）
  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    const cached = intentSession?.messages?.length ? intentSession : null;
    if (cached) {
      startedRef.current = true;
      setPhase("chat");
      setMessages(cached.messages);
      setBrief(cached.brief);
      setProductBrief(cached.brief);
      setIntentNarrative(cached.brief ? briefToNarrative(cached.brief) : null);
      // Strict Mode 重挂载后，若缓存只有用户首条、AI 回复尚未落库（首轮请求在卸载前未返回），补发一次取回回复
      const msgs = cached.messages;
      const last = msgs[msgs.length - 1];
      if (last?.role === "user") void runDiscover(msgs, cached.brief, "new");
    }
  }, [hydrated, intentSession, setProductBrief, setIntentNarrative]);

  const lastCountRef = useRef(0);
  useEffect(() => {
    if (messages.length === lastCountRef.current) return;
    lastCountRef.current = messages.length;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // 同步对话进展给父栏（会诊按钮可用性 / 自动会诊判断）
  useEffect(() => {
    onConversationChange({ messageCount: messages.length, thinking, messages, blocked: Boolean(opError) });
  }, [messages, thinking, onConversationChange, opError]);

  // 会话缓存持久化（复用 intentSession 字段）
  useEffect(() => {
    if (phase === "chat") {
      setIntentSession({
        messages,
        brief,
        done: false,
        updatedAt: Date.now(),
      });
    }
  }, [messages, brief, phase, setIntentSession]);

  // brief 更新 → 回填 flow-store（沿用老管线：智能解读 + 应用推荐 + PRD/叙事同步）
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

  // F0-A 保存优先：发起 AI 请求前，先把最新输入/阶段写入可恢复本地草稿（zustand persist→localStorage）
  const saveNow = (next: DiscoverMessage[], bf: ProductBrief | null) => {
    setIntentSession({ messages: next, brief: bf, done: false, updatedAt: Date.now() });
  };

  // F0-A 核心：discover 调用。mode=new 生成新 operationId 并新建可取消 signal；
  // mode=retry 复用同一 operationId（幂等：不重复写用户消息），仅换新的 signal。
  const runDiscover = async (
    next: DiscoverMessage[],
    currentBrief: ProductBrief | null,
    mode: "new" | "retry",
  ) => {
    if (mode === "new") opIdRef.current = newRequestId("op");
    abortRef.current = new AbortController();
    const operationId = opIdRef.current;
    const signal = abortRef.current.signal;
    setThinking(true);
    setOpError(null);
    setCancelled(false);
    saveNow(next, currentBrief);
    try {
      const res = await fetch("/api/ai/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          brief: currentBrief,
          agents: personaPayload(),
          operationId,
        }),
        signal,
      });
      let data: Record<string, unknown> | null = null;
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = null;
      }
      const flowErr = extractFlowError(data);
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      const replied = reply !== "";
      if (flowErr || !replied) {
        // 失败/空响应：不伪造 assistant，保留用户输入，转统一失败态
        setOpError(
          flowErr ??
            flowError(!res.ok ? "provider_unavailable" : "invalid_response", {
              operation: "discover",
              phase: "dialog",
            }),
        );
        return;
      }
      const payload = data as { reply: string; branches?: Branch[]; brief?: ProductBrief | null };
      const assistant: DiscoverMessage = {
        role: "assistant",
        content: reply,
        branches: Array.isArray(payload.branches) ? payload.branches : undefined,
      };
      setMessages([...next, assistant]);
      const bf = payload.brief;
      setBrief(bf ?? currentBrief);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") {
        // 用户取消：停止 loading，不给成功也不给失败
        setCancelled(true);
        setOpError(null);
        return;
      }
      setOpError(flowError("provider_unavailable", { operation: "discover", phase: "dialog" }));
    } finally {
      setThinking(false);
    }
  };

  // F0-A：重试本轮 —— 复用同一 operationId，只重发失败的操作
  const retryLast = () => {
    if (thinking) return;
    void runDiscover(messages, brief, "retry");
  };

  // F0-A：切走/卸载时取消在途请求，避免迟到结果污染
  useEffect(() => () => abortRef.current?.abort(), []);

  const startFromInput = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setPhase("chat");
    setInput("");
    const first: DiscoverMessage = { role: "user", content: t };
    setMessages([first]);
    setBrief(null);
    void runDiscover([first], null, "new");
  };

  const chooseBranch = (b: Branch) => {
    if (thinking) return;
    const userMsg: DiscoverMessage = {
      role: "user",
      content: b.label,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    void runDiscover(next, brief, "new");
  };

  const sendText = () => {
    const t = input.trim();
    if (!t || thinking) return;
    const next = [...messages, { role: "user", content: t } as DiscoverMessage];
    setMessages(next);
    setInput("");
    void runDiscover(next, brief, "new");
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    opIdRef.current = "";
    setPhase("input");
    setInput("");
    setMessages([]);
    setBrief(null);
    setOpError(null);
    setCancelled(false);
    startedRef.current = false;
    clearIntentSession();
    setProductBrief(null);
    setIntentNarrative(null);
    setTechStack("");
    setVisualStyle(null);
    clearBlueprint();
    // 跨阶段缓存一并失效，避免旧会诊/旧产物残留在后续阶段
    setPanelOutput(null);
    setDeliverArtifacts(null);
  };

  // ───────── 输入阶段（首屏） ─────────
  if (phase === "input") {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card">
        <StreamHeader onReset={null} />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="mx-auto mt-4 w-full max-w-xl">
            <div className="mb-5 text-center">
              <h2 className="text-2xl font-semibold text-foreground">今天想做什么产品？</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                用一句话描述想法，老鸨子会陪你聊清楚，再召集后宫智囊团给出建议。
              </p>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  startFromInput(input);
              }}
              rows={4}
              placeholder="例如：做一个「灵感录音板」，随手用语音记点子，AI 每晚整理成可执行计划。"
              className="w-full resize-none rounded-[var(--radius)] border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary placeholder:text-muted-foreground"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">⌘/Ctrl + ↵ 开始</span>
              <Button size="sm" onClick={() => startFromInput(input)} disabled={!input.trim()}>
                和老鸨子探索 <ArrowRight className="size-3.5" />
              </Button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
          </div>
        </div>
      </div>
    );
  }

  // ───────── 对话阶段 ─────────
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-card">
      <StreamHeader onReset={reset} />

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
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
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                ) : (
                  <RichText content={m.content} />
                )}
              </div>

              {/* 分支方向卡片（产品灵魂交互，保留） */}
              {m.role === "assistant" && m.branches && m.branches.length > 0 && !thinking && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {m.branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => chooseBranch(b)}
                      className="rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary hover:bg-primary/5"
                    >
                      <div className="flex items-center gap-1.5">
                        <GitBranch className="size-3.5 text-primary" />
                        <span className="text-sm font-medium text-foreground">{b.label}</span>
                      </div>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">
                        {b.description}
                      </p>
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

        {(thinking || consulting) && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-background px-3.5 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              {consulting ? "后宫智囊团会诊中…" : "老鸨子正在思考…"}
            </div>
          </div>
        )}

        {cancelled && !opError && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
              本轮已取消。你的输入已保存，可以继续，不会重复生成。
            </div>
          </div>
        )}

        {opError && (
          <div className="flex justify-start">
            <div className="w-full max-w-[92%] rounded-2xl rounded-bl-sm border border-destructive/30 bg-card px-4 py-3.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-destructive">本轮专家协作暂未完成</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    你的输入已保存，可以稍后继续。
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    {flowErrorUserMessage(opError)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="icon" onClick={retryLast} disabled={thinking} title="重试本轮">
                  <RotateCcw className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    setOpError(null);
                    setCancelled(false);
                    onManualProceed?.();
                  }}
                  title="继续手动完善"
                >
                  <PencilLine className="size-4" />
                </Button>
                {onViewCurrentPlan && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={onViewCurrentPlan}
                    title="查看当前方案"
                  >
                    <FileText className="size-4" />
                  </Button>
                )}
              </div>
            </div>
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
            placeholder="继续聊你的想法，或选择上方方向卡片…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary placeholder:text-muted-foreground"
          />
          <Button size="sm" onClick={sendText} disabled={!input.trim() || thinking}>
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function StreamHeader({ onReset }: { onReset: (() => void) | null }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
      <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sparkles className="size-4" />
      </span>
      <span className="text-sm font-semibold text-foreground">老鸨子</span>
      <span className="text-xs text-muted-foreground">多轮访谈，把想法做丰满</span>
      {onReset && (
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={onReset}
          title="重置对话"
        >
          <RotateCcw className="size-4" />
        </Button>
      )}
    </div>
  );
}

/* ───────────────────────── 结构化富文本渲染 ─────────────────────────
 * 老鸨子的回复被要求输出扫读友好的 Markdown（加粗 / 短要点 / 标题），
 * 这里做一次轻量转换：**加粗**、- 要点、### 小标题、以及 `${line}` 代码，
 * 让关键信息明显、列表宽松、不再是一大段连排文字。 */
function renderInline(text: string): ReactNode {
  // `code` -> styled 内联码
  const withCode = text.split(/`([^`]+)`/g).map((seg, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
      >
        {seg}
      </code>
    ) : (
      seg
    ),
  );
  // **加粗** -> <strong>
  return withCode.flatMap((node, i) => {
    if (typeof node !== "string") return [<span key={`c${i}`}>{node}</span>];
    return node.split(/\*\*(.+?)\*\*/g).map((seg, j) => {
      const k = `s${i}_${j}`;
      if (j % 2 === 1) {
        return (
          <strong key={k} className="font-semibold text-foreground">
            {seg}
          </strong>
        );
      }
      if (seg === "") return <span key={k} />;
      return <span key={k}>{seg}</span>;
    });
  });
}

const RichText = memo(function RichText({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    // 小标题 ### / ##
    const h = line.match(/^\s*(#{1,6})\s+(.*)/);
    if (h) {
      blocks.push(
        <p key={i} className="mb-1 mt-1.5 text-[13px] font-semibold text-foreground">
          {renderInline(h[2])}
        </p>,
      );
      i++;
      continue;
    }
    // 无序要点 - / • / *
    const bullet = line.match(/^\s*[-•*]\s+(.*)/);
    if (bullet) {
      const items: { key: string; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*[-•*]\s+(.*)/);
        if (!m) break;
        items.push({ key: `b_${i}`, text: m[1] });
        i++;
      }
      blocks.push(
        <ul key={i} className="mb-1.5 mt-0.5 space-y-1">
          {items.map((it) => (
            <li key={it.key} className="flex gap-1.5 leading-relaxed">
              <span className="mt-[0.55em] size-[5px] shrink-0 rounded-full bg-primary/70" />
              <span className="min-w-0">{renderInline(it.text)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }
    // 有序要点 1. / 1、/ ①
    const num = line.match(/^\s*(?:\d+[.、)）]|①|②|③|④|⑤|⑥)\s*(.*)/);
    if (num) {
      const items: { key: string; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:\d+[.、)）]|①|②|③|④|⑤|⑥)\s*(.*)/);
        if (!m) break;
        items.push({ key: `n_${i}`, text: m[1] });
        i++;
      }
      blocks.push(
        <ol key={i} className="mb-1.5 mt-0.5 space-y-1">
          {items.map((it, idx) => (
            <li key={it.key} className="flex gap-1.5 leading-relaxed">
              <span className="w-4 shrink-0 text-[11px] font-medium leading-relaxed text-primary">
                {idx + 1}.
              </span>
              <span className="min-w-0">{renderInline(it.text)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }
    // 普通段
    blocks.push(
      <p key={i} className="mb-1.5 leading-relaxed text-foreground/90">
        {renderInline(line)}
      </p>,
    );
    i++;
  }
  return <div className="space-y-0.5">{blocks}</div>;
});
