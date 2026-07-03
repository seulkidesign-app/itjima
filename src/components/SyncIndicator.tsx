import { useT } from "@/lib/i18n";

type Props = {
  syncing?: boolean;
  error?: boolean;
  onRetry?: () => void;
};

export function SyncIndicator({ syncing, error, onRetry }: Props) {
  const t = useT();

  if (error) {
    return (
      <div
        className="flex items-center justify-between gap-2 bg-ink/[0.04] px-4 py-2.5"
        role="alert"
      >
        <span className="text-[12px] font-medium text-ink-soft">
          {t("저장이 잠깐 멈췄어요", "Saving paused for a moment")}
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="touch-target rounded-full bg-primary px-3 text-[11px] font-semibold text-ink touch-press"
          >
            {t("다시", "Retry")}
          </button>
        )}
      </div>
    );
  }

  if (!syncing) return null;

  return (
    <div
      className="relative h-0.5 w-full overflow-hidden bg-ink/[0.04]"
      role="status"
      aria-live="polite"
      aria-label={t("안전하게 저장하는 중", "Saving safely")}
    >
      <div className="skeleton-shimmer absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary/80" />
    </div>
  );
}
