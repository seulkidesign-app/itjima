import { RefreshCw, WifiOff } from "lucide-react";
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
      <div className="relative z-30 px-3 pt-2" role="alert">
        <div className="mx-auto flex min-h-12 w-full max-w-[680px] items-center gap-2.5 rounded-2xl border border-ink/[0.07] bg-white/92 px-3 py-2 shadow-card backdrop-blur-xl">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink/[0.05] text-ink-soft"
            aria-hidden
          >
            <WifiOff size={15} strokeWidth={2.1} />
          </span>
          <span className="min-w-0 flex-1 text-[12px] font-medium leading-snug text-ink-soft">
            {t(
              "잠깐 연결이 끊겼어요. 내용은 이 기기에 안전하게 남아 있어요.",
              "Connection paused — your thoughts are still safe on this device.",
            )}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="touch-press flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3 text-[11px] font-semibold text-white"
            >
              <RefreshCw size={13} strokeWidth={2.2} aria-hidden />
              {t("다시 연결", "Retry")}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!syncing) return null;

  return (
    <div
      className="relative z-30 h-[2px] w-full overflow-hidden bg-ink/[0.035]"
      role="status"
      aria-live="polite"
      aria-label={t("저장하는 중", "Saving…")}
    >
      <div className="skeleton-shimmer absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary/85" />
    </div>
  );
}
