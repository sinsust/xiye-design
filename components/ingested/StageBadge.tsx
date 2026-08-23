// 泛型阶段徽标（源：agent-workstudio/src/components/ui/StageBadge.tsx，去业务类型化）
// 原版依赖 STAGE_LABELS/OrderStage（订单阶段上下文），此处简化为纯文本中性徽标。
export function StageBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex h-5 max-w-full items-center rounded border border-zinc-200 bg-zinc-50 px-1.5 text-[10px] font-medium leading-none text-zinc-600">
      <span className="truncate">{label}</span>
    </span>
  );
}
