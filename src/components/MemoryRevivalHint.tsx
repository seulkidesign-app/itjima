import { ChevronRight, X } from "lucide-react";
import { useT } from "@/lib/i18n";

type Props = {
  count: number;
  onView: () => void;
  onDismiss: () => void;
};

export function MemoryRevivalHint({
  count,
  onView,
  onDismiss,
}: Props) {
  const t = useT();

  return (
    <div className="rounded-[20px] bg-ink/[0.04] px-4 py-3.5 ring-1 ring-ink/[0.05]">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink-soft">
            {t("전에도 비슷하게 생각했어요.", "You thought about this before.")}
          </p>
          <button
            type="button"
            onClick={onView}
            className="touch-press mt-1 inline-flex items-center gap-1 text-[14px] font-semibold text-ink"
          >
            {t(
              `비슷한 기억 ${count}개`,
              count === 1 ? "1 similar memory" : `${count} similar memories`,
            )}
            <ChevronRight size={15} className="text-ink-soft" aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="touch-target shrink-0 rounded-full text-ink-soft/70"
          aria-label={t("닫기", "Dismiss")}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
