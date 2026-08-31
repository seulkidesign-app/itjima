import { Check } from "lucide-react";
import { useLang, useT } from "@/lib/i18n";
import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";

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

function fuzzyWhenLabel(
  title: string,
  whenLabel: string,
  lang: "ko" | "en",
): string {
  if (!(whenLabel.includes("종일") || whenLabel.includes("All day"))) {
    return whenLabel;
  }
  const daypart = parseCanonicalTemporalModel(title).daypart;
  if (!daypart) return whenLabel;
  const ko = {
    morning: "오전",
    afternoon: "오후",
    evening: "저녁",
    night: "밤",
    dawn: "새벽",
    lunch: "점심",
    noon: "정오",
    midnight: "자정",
  } as const;
  const en = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    dawn: "Dawn",
    lunch: "Lunch",
    noon: "Noon",
    midnight: "Midnight",
  } as const;
  const label = lang === "en" ? en[daypart] : ko[daypart];
  return whenLabel.replace(lang === "ko" ? /하루 종일|종일/g : /All day/g, label);
}

export function SavedScheduleFeedback({ feedback, onEdit }: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const displayWhen = fuzzyWhenLabel(feedback.title, feedback.whenLabel, uiLang);

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
            {displayWhen}
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
