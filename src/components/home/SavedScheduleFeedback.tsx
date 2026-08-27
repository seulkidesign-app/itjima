import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";

export type SavedScheduleFeedbackModel = {
  id: string;
  scheduleId: string;
  title: string;
  whenLabel: string;
};

type Props = {
  feedback: SavedScheduleFeedbackModel;
  onEdit: () => void;
};

/**
 * Special-state feedback card (Figma 04 Clear Save) — card surface only for this confirmation.
 */
export function SavedScheduleFeedback({ feedback, onEdit }: Props) {
  const t = useT();

  return (
    <div
      className="quietly-feedback-card w-full px-4 py-4"
      data-testid="saved-schedule-feedback"
      data-schedule-id={feedback.scheduleId}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/35 text-ink"
          aria-hidden
        >
          <Check size={16} strokeWidth={2.6} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-ink-soft">
            {t("저장했어요", "Saved")}
          </p>
          <strong
            className="mt-1 block text-[17px] font-bold leading-snug tracking-[-0.02em] text-ink"
            data-testid="saved-schedule-title"
          >
            {feedback.title}
          </strong>
          <p
            className="mt-1 text-[14px] font-semibold tabular-nums tracking-[-0.01em] text-primary"
            data-testid="saved-schedule-when"
          >
            {feedback.whenLabel}
          </p>
        </div>
        <button
          type="button"
          data-testid="saved-schedule-edit"
          onClick={onEdit}
          className="touch-press inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-2 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          {t("수정", "Edit")}
        </button>
      </div>
    </div>
  );
}
