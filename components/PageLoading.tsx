/**
 * 全局页面加载骨架（路由切换时显示，消除白屏）。
 * 克制风格：品牌色细 spinner + 居中文字，跟随明暗主题 token。
 */
export default function PageLoading({ label = "加载中…" }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="size-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
