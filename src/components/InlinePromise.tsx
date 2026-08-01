import type { InboxItem } from "@/lib/store";
import {
  clarifyPicksForText,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import { buildPromiseCard } from "@/lib/promiseCard";
import {
  scheduleConfirmationChoices,
  scheduleConfirmationReason,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
import { useLang, useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";

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
    past_today: "오늘 시간은 이미 지났어요. 내일 같은 시간으로 바로 옮길 수 있어요.",
    weekend_day: "토요일인지 일요일인지 고르면 바로 일정에 넣어요.",
    after_work_time: "퇴근 시간을 골라 주세요. 선택한 시간으로 바로 추가해요.",
    assumed_meridiem: "오전인지 오후인지 고르면 바로 일정에 넣어요.",
  };
  const en: Record<ScheduleConfirmationReason, string> = {
    past_today: "That time has passed today. Move it to the same time tomorrow in one tap.",
    weekend_day: "Choose Saturday or Sunday and add it right away.",
    after_work_time: "Choose your after-work time and add it right away.",
    assumed_meridiem: "Choose AM or PM and add it right away.",
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
  const confirmationChoices = confirmation
    ? scheduleConfirmationChoices(item.text, confirmation, uiLang)
    : [];
  const clarifyOptions = clarifyPicksForText(item.text, uiLang);

  if (acknowledged) return null;

  const finish = (action: void | Promise<void>) => {
    void Promise.resolve(action).then(onDismiss);
  };

  const openManualSchedule = (source: "ambiguity" | "adjust" | "clarify") => {
    track("nl_manual_schedule_opened", {
      source,
      intent: card.nlIntent,
      confirmation_reason: confirmation ?? undefined,
    });
    onSchedule(item);
  };

  return (
    <div
      className="ml-1 w-full max-w-[min(320px,90%)] rounded-[18px] border border-ink/8 bg-[#fafaf8] p-3"
      data-testid="inline-promise"
      data-intent={card.nlIntent}
      data-confidence={card.confidenceLevel}
      data-sensitive={card.isSensitive ? "true" : "false"}
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
          ? confirmationChoices.length > 0
            ? confirmationCopy(confirmation, uiLang)
            : t(
                "날짜와 시간에 확인할 부분이 여러 개 있어요. 한 번에 같이 확인해 주세요.",
                "There are a few date and time details to check together.",
              )
          : card.nlIntent === "task"
            ? t(
                "날짜 없이 나중 할 일로 둘 수 있어요.",
                "Keep it as a later task without choosing a date.",
              )
            : card.promise}
      </p>

      {card.nlIntent === "schedule_clarify" ? (
        <>
          <div
            className="mt-3 grid grid-cols-3 gap-1.5"
            data-testid="promise-clarify-chips"
          >
            {clarifyOptions.map(({ pick, label }) => (
              <button
                key={pick}
                type="button"
                data-testid={`promise-clarify-${pick}`}
                onClick={() => finish(onConfirmClarify(item, pick))}
                className="touch-press min-h-[40px] rounded-full border border-ink/10 bg-white px-2 py-2 text-[11px] font-semibold text-ink"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="promise-manual"
            onClick={() => openManualSchedule("clarify")}
            className="touch-press mt-2 min-h-[40px] w-full rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("직접 고르기", "Pick manually")}
          </button>
        </>
      ) : card.nlIntent === "task" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="promise-primary"
            onClick={() => finish(onConfirmTaskLater(item))}
            className="pill-yellow touch-press min-h-[40px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {t("나중 할 일로 두기", "Keep as later task")}
          </button>
          <button
            type="button"
            data-testid="promise-add-date"
            onClick={() => openManualSchedule("adjust")}
            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("날짜 추가", "Add date")}
          </button>
        </div>
      ) : confirmation ? (
        <>
          {confirmationChoices.length > 0 && (
            <div
              className={`mt-3 grid gap-2 ${
                confirmationChoices.length === 1 ? "grid-cols-1" : "grid-cols-2"
              }`}
              data-testid="promise-confirmation-choices"
            >
              {confirmationChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  data-testid={`promise-confirm-${choice.id}`}
                  onClick={() => {
                    track("nl_inline_ambiguity_resolved", {
                      reason: confirmation,
                      choice: choice.id,
                    });
                    finish(
                      onConfirmScheduleQuick({
                        ...item,
                        text: choice.resolvedText,
                      }),
                    );
                  }}
                  className={`touch-press min-h-[40px] rounded-full px-3 py-2 text-[12px] font-bold text-ink ${
                    confirmationChoices.length === 1
                      ? "pill-yellow"
                      : "border border-ink/10 bg-white"
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            data-testid="promise-manual"
            onClick={() => openManualSchedule("ambiguity")}
            className="touch-press mt-2 min-h-[40px] w-full rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {confirmationChoices.length > 0
              ? t("직접 고르기", "Pick manually")
              : t("확인하고 추가", "Review and add")}
          </button>
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="promise-primary"
            onClick={() => finish(onConfirmScheduleQuick(item))}
            className="pill-yellow touch-press min-h-[40px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {t("일정에 추가", "Add to schedule")}
          </button>
          <button
            type="button"
            data-testid="promise-manual"
            onClick={() => openManualSchedule("adjust")}
            className="touch-press min-h-[40px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("수정", "Adjust")}
          </button>
        </div>
      )}
    </div>
  );
}
