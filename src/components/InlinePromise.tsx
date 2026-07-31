import type { InboxItem } from "@/lib/store";
import {
  clarifyPicksForText,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import { buildPromiseCard } from "@/lib/promiseCard";
import {
  scheduleConfirmationReason,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
import { useLang, useT } from "@/lib/i18n";

type Props = {
  item: InboxItem;
  acknowledged?: boolean;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onConfirmClarify: (
    item: InboxItem,
    pick: ClarifyPick,
  ) => void | Promise<void>;
  onConfirmTaskLater: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onDismiss: () => void;
};

function confirmationCopy(
  reason: ScheduleConfirmationReason,
  lang: "ko" | "en",
): string {
  const ko: Record<ScheduleConfirmationReason, string> = {
    past_today: "말한 시간이 이미 지났어요. 날짜와 시간을 한 번 확인해 주세요.",
    weekend_day: "주말은 토요일인지 일요일인지 아직 확실하지 않아요.",
    after_work_time: "퇴근 시간을 오후 6시로 단정하지 않고 확인할게요.",
    assumed_meridiem: "오전·오후가 없어서 시간을 한 번 확인할게요.",
  };
  const en: Record<ScheduleConfirmationReason, string> = {
    past_today: "That time has already passed today. Check the date and time first.",
    weekend_day: "Weekend could mean Saturday or Sunday, so let's check.",
    after_work_time: "I won't assume what time you finish work.",
    assumed_meridiem: "AM or PM is missing, so let's confirm the time.",
  };
  return lang === "en" ? en[reason] : ko[reason];
}

/** Focused v1 interpretation card for schedules and tasks only. */
export function InlinePromise({
  item,
  acknowledged = false,
  onConfirmScheduleQuick,
  onConfirmClarify,
  onConfirmTaskLater,
  onSchedule,
  onDismiss,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const card = buildPromiseCard(item.text, uiLang);
  const confirmation =
    card.nlIntent === "schedule_exact"
      ? scheduleConfirmationReason(item.text)
      : null;
  const clarifyOptions = clarifyPicksForText(item.text, uiLang);

  if (acknowledged) return null;

  const finish = (action: void | Promise<void>) => {
    void Promise.resolve(action).then(onDismiss);
  };

  return (
    <div
      className="ml-1 w-full max-w-[min(320px,90%)] rounded-[18px] border border-ink/8 bg-[#fafaf8] p-3"
      data-testid="inline-promise"
      data-intent={card.nlIntent}
      data-needs-confirmation={confirmation ? "true" : "false"}
    >
      <p className="text-[11px] font-semibold text-ink-soft">
        {t("이렇게 이해했어요", "Here's what I understood")}
      </p>
      <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
        {card.label}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-ink-soft">
        {confirmation
          ? confirmationCopy(confirmation, uiLang)
          : card.nlIntent === "task"
            ? t(
                "날짜 없이 나중 할 일로 둘 수 있어요.",
                "Keep it as a later task without choosing a date.",
              )
            : card.promise}
      </p>

      {card.nlIntent === "schedule_clarify" ? (
        <>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {clarifyOptions.map(({ pick, label }) => (
              <button
                key={pick}
                type="button"
                onClick={() => finish(onConfirmClarify(item, pick))}
                className="touch-press min-h-[40px] rounded-full border border-ink/10 bg-white px-2 py-2 text-[11px] font-semibold text-ink"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onSchedule(item)}
            className="touch-press mt-2 min-h-[40px] w-full rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("직접 고르기", "Pick manually")}
          </button>
        </>
      ) : card.nlIntent === "task" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => finish(onConfirmTaskLater(item))}
            className="pill-yellow touch-press min-h-[40px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {t("나중 할 일로 두기", "Keep as later task")}
          </button>
          <button
            type="button"
            onClick={() => onSchedule(item)}
            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("날짜 추가", "Add date")}
          </button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              confirmation
                ? onSchedule(item)
                : finish(onConfirmScheduleQuick(item))
            }
            className="pill-yellow touch-press min-h-[40px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {confirmation
              ? t("확인하고 추가", "Review and add")
              : t("일정에 추가", "Add to schedule")}
          </button>
          <button
            type="button"
            onClick={() => onSchedule(item)}
            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("수정", "Adjust")}
          </button>
        </div>
      )}
    </div>
  );
}
