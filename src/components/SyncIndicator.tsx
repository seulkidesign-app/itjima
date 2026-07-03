import { useT } from "@/lib/i18n";

export function SyncIndicator({ active }: { active: boolean }) {
  const t = useT();
  if (!active) return null;
  return (
    <div
      className="relative h-0.5 w-full overflow-hidden bg-ink/[0.06]"
      role="status"
      aria-live="polite"
      aria-label={t("동기화 중", "Syncing")}
    >
      <div className="absolute inset-y-0 left-0 w-1/3 animate-[shimmer_1s_ease-in-out_infinite] bg-primary" />
    </div>
  );
}
