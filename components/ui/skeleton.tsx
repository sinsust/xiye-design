/** 加载骨架屏：替代裸 Loader2「加载中…」，避免首屏闪烁（P2-1） */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-muted " + className} aria-hidden />;
}

/** 多行卡片骨架：列表类加载态通用 */
export function SkeletonRows({ rows = 3, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={"space-y-2 " + className} role="status" aria-busy="true" aria-label="加载中">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border/60 p-2.5">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
