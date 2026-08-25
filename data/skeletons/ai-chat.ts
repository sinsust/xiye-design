// AI 对话页（AI Chat）页面骨架数据。

import type { SkeletonPage } from "./types";

export const AI_CHAT_PAGE: SkeletonPage = {
  id: "ai-chat",
  name: "AI 对话",
  icon: "Bot",
  description: "AI 产品对话界面：消息流、输入区、建议提示",
  components: [
    {
      id: "chat-window",
      name: "对话窗口",
      icon: "MessagesSquare",
      description: "消息流展示",
      variants: [
        {
          id: "cwin_messages",
          name: "标准消息流",
          description: "AI/用户气泡交替 + 时间",
          tags: ["消息", "标准"],
          prompt:
            "Build a chat message stream: user messages right-aligned (primary tint), AI messages left-aligned (surface), avatar dot for AI, timestamps, auto-scroll hint at bottom. Clean bubbles, no heavy borders.",
          code: `export function ChatWindow() {
  const msgs = [
    { from: "ai", text: "你好，我是 {{brand}} AI 助手。有什么可以帮你？" },
    { from: "user", text: "帮我总结一下本周的转化数据" },
    { from: "ai", text: "本周整体转化率 +8.2%，其中周五峰值最高（+14%）。需要我出个详细报表吗？" },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      {msgs.map((m, i) => (
        <div key={i} className={"flex items-start gap-2.5 " + (m.from === "user" ? "flex-row-reverse" : "")}>
          {m.from === "ai" && (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>✦</span>
          )}
          <div className={"max-w-[75%] rounded-2xl px-4 py-2.5 text-sm " + (m.from === "user" ? "text-[var(--on-primary)]" : "")} style={m.from === "user" ? { background: "var(--primary)" } : { background: "var(--background)" }}>
            {m.text}
          </div>
        </div>
      ))}
      <p className="text-center text-xs" style={{ color: "var(--muted-foreground)" }}>AI 生成内容，请注意甄别</p>
    </div>
  );
}`,
          interaction: "用户右蓝/ AI 左灰；流式打字",
        },
      ],
    },
    {
      id: "chat-input",
      name: "输入区",
      icon: "TextCursorInput",
      description: "对话输入框",
      variants: [
        {
          id: "cinput_bar",
          name: "圆角输入条",
          description: "输入框 + 发送按钮",
          tags: ["输入", "标准"],
          prompt:
            "Build a chat input bar: rounded-full container with placeholder text, attach icon, and a send button (primary circle). Disabled state when empty. Floating at the bottom of the chat.",
          code: `export function ChatInput() {
  return (
    <div className="flex items-center gap-2 rounded-full border p-1.5 pl-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <span className="text-base" style={{ color: "var(--muted-foreground)" }}>＋</span>
      <input placeholder="输入消息…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      <button aria-label="发送" className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>
        ↑
      </button>
    </div>
  );
}`,
          interaction: "空态禁用发送；Enter 发送",
        },
        {
          id: "cinput_panel",
          name: "输入面板",
          description: "输入区 + 快捷键提示 + 模式",
          tags: ["输入", "面板"],
          prompt:
            "Build a chat input panel: rounded-2xl container with a textarea placeholder, bottom row with model selector chip, mode toggle (Chat/Image), and a send button. Functional, premium.",
          code: `export function ChatInput() {
  return (
    <div className="rounded-2xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <textarea rows={2} placeholder="输入消息…（Enter 发送，Shift+Enter 换行）" className="w-full resize-none bg-transparent text-sm outline-none" />
      <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full border px-2.5 py-1 text-[10px]" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>智能模型 v2</span>
          <span className="rounded-full px-2.5 py-1 text-[10px] font-medium text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>对话</span>
        </div>
        <button aria-label="发送" className="flex size-8 items-center justify-center rounded-full text-sm text-[var(--on-primary)]" style={{ background: "var(--primary)" }}>↑</button>
      </div>
    </div>
  );
}`,
          interaction: "模型选择 + 模式切换 + 发送",
        },
      ],
    },
    {
      id: "chat-suggest",
      name: "建议提示",
      icon: "Lightbulb",
      description: "开场建议与快捷指令",
      variants: [
        {
          id: "csugg_chips",
          name: "建议药丸",
          description: "快捷问题药丸，点击即问",
          tags: ["建议", "药丸"],
          prompt:
            "Build suggestion chips: 3-4 pill buttons with sample questions ('Summarize this week', 'Write a landing page...'), arranged in a row above the input. Neutral style, hover fills.",
          code: `export function Suggestions() {
  const chips = ["总结本周数据", "写一段产品文案", "分析竞品定价"];
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {chips.map((c) => (
        <button key={c} className="rounded-full border px-4 py-1.5 text-sm transition hover:bg-muted" style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}>
          {c}
        </button>
      ))}
    </div>
  );
}`,
          interaction: "点击填入输入框并发送",
        },
        {
          id: "csugg_card",
          name: "建议卡组",
          description: "带图标的能力卡，引导上手",
          tags: ["建议", "卡片"],
          prompt:
            "Build capability suggestion cards: 2x2 grid of small cards each with an icon, title, and one-line description (Summarize / Write / Analyze / Code). Hover lifts. For empty-chat onboarding.",
          code: `export function Suggestions() {
  const cards = [
    { icon: "◷", t: "总结", d: "浓缩长文与会议纪要" },
    { icon: "✎", t: "写作", d: "生成文案与邮件" },
    { icon: "◈", t: "分析", d: "洞察数据与趋势" },
    { icon: "⌥", t: "代码", d: "解释与生成代码" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <button key={c.t} className="group flex items-start gap-3 rounded-xl border p-4 text-left transition-shadow hover:shadow-md" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <span className="text-lg" style={{ color: "var(--primary)" }}>{c.icon}</span>
          <span>
            <span className="block text-sm font-semibold">{c.t}</span>
            <span className="mt-0.5 block text-xs" style={{ color: "var(--muted-foreground)" }}>{c.d}</span>
          </span>
        </button>
      ))}
    </div>
  );
}`,
          interaction: "空会话引导卡；点击开新对话",
        },
      ],
    },
  ],
};
