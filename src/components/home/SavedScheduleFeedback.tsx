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
 * Quiet post-commit confirmation.
 * Hierarchy: title > when > status > soft edit. No yellow banner / save CTA.
 */
export function SavedScheduleFeedback({ feedback, onEdit }: Props) {
  const t = useT();

  return (
    <div
      className="w-full border-b border-ink/[0.06] px-0 py-3"
      data-testid="saved-schedule-feedback"
      data-schedule-id={feedback.scheduleId}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <strong
            className="block text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink"
            data-testid="saved-schedule-title"
          >
            {feedback.title}
          </strong>
          <p
            className="mt-1 text-[13px] font-medium text-ink-soft"
            data-testid="saved-schedule-when"
          >
            {feedback.whenLabel}
          </p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft">
            <Check
              size={13}
              strokeWidth={2.6}
              className="text-primary"
              aria-hidden
            />
            {t("일정으로 남겼어요", "Saved to your schedule")}
          </p>
        </div>
        <button
          type="button"
          data-testid="saved-schedule-edit"
          onClick={onEdit}
          className="touch-press inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-2 text-[13px] font-medium text-ink-soft"
        >
          {t("수정", "Edit")}
        </button>
      </div>
    </div>
  );
}
