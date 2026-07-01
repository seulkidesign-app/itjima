import type { CSSProperties } from "react";

type Props = { className?: string; style?: CSSProperties };

export function SkeletonBlock({ className = "", style }: Props) {
  return <div className={`skeleton-shimmer rounded-[20px] ${className}`} style={style} aria-hidden />;
}

export function InboxListSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-1 py-2" aria-busy="true" aria-label="Loading">
      {[0.72, 0.58, 0.64].map((w, i) => (
        <div key={i} className="flex justify-end">
          <SkeletonBlock className="h-[72px]" style={{ width: `${Math.round(w * 100)}%` }} />
        </div>
      ))}
    </div>
  );
}

export function ScheduleListSkeleton() {
  return (
    <div className="flex flex-col gap-3 py-2" aria-busy="true" aria-label="Loading">
      <SkeletonBlock className="h-3 w-16" />
      <SkeletonBlock className="h-[108px] w-full" />
      <SkeletonBlock className="h-3 w-20 mt-2" />
      <SkeletonBlock className="h-[96px] w-full" />
    </div>
  );
}

export function ArchiveGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 py-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonBlock key={i} className="h-[120px] w-full" />
      ))}
    </div>
  );
}
