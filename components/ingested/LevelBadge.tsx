// 泛型等级徽标（源：agent-workstudio/src/components/ui/PriorityBadge.tsx，去业务类型化）
// 原版依赖 URGENCY_LABELS/UrgencyLevel（订单催货上下文），此处改为 label + tone 通用接口。
const TONE_CLASS = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  sky: "border-sky-200 bg-sky-50 text-sky-800",
  zinc: "border-zinc-200 bg-zinc-100 text-zinc-600",
} as const;

export function LevelBadge({
  label,
  tone = "zinc",
}: {
  label: string;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span
      className={`inline-flex h-5 max-w-full items-center rounded border px-1.5 text-[10px] font-medium leading-none ${TONE_CLASS[tone]}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}

/** 紧急度速记映射（按需传入） */
export const URGENCY_TONES = {
  immediate: "red",
  today: "amber",
  attention: "sky",
  observe: "zinc",
} as const satisfies Record<string, keyof typeof TONE_CLASS>;
