import { Clock3, Pencil } from "lucide-react";
import type { InboxItem } from "@/lib/store";
import {
  clarifyPicksForText,
  type ClarifyPick,
} from "@/lib/nlSchedule";
import { buildPromiseCard } from "@/lib/promiseCard";
import {
  extractClockPlanLines,
  scheduleConfirmationChoices,
  scheduleConfirmationReason,
  type ScheduleConfirmationReason,
} from "@/lib/nlScheduleSafety";
import { withInboxScheduleDraft } from "@/lib/inboxScheduleDefaults";
import { buildNaturalScheduleDraft } from "@/lib/naturalScheduleDraft";
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
  /** Restore raw text into the capture composer (multi-clock). */
  onEditCaptureText?: (text: string) => void;
};

function confirmationCopy(
  reason: ScheduleConfirmationReason,
  lang: "ko" | "en",
): string {
  const ko: Record<ScheduleConfirmationReason, string> = {
    invalid_datetime: "시간이나 날짜를 정확히 이해하지 못했어요.",
    broad_daypart: "정확한 시간이 없어요. 시간을 조금 더 구체적으로 적어 주세요.",
    past_today: "오늘 시간은 이미 지났어요. 내일 같은 시간으로 바로 옮길 수 있어요.",
    weekend_day: "토요일인지 일요일인지 고르면 바로 일정에 넣어요.",
    after_work_time: "퇴근 시간을 골라 주세요. 선택한 시간으로 바로 추가해요.",
    assumed_meridiem: "몇 시로 기억할까요?",
    multiple_clocks: "시간이 두 개 있어요",
  };
  const en: Record<ScheduleConfirmationReason, string> = {
    invalid_datetime: "I couldn't safely understand that date or time.",
    broad_daypart: "There isn't an exact time yet. Add a more specific time.",
    past_today: "That time has passed today. Move it to the same time tomorrow in one tap.",
    weekend_day: "Choose Saturday or Sunday and add it right away.",
    after_work_time: "Choose your after-work time and add it right away.",
    assumed_meridiem: "Which time should I remember?",
    multiple_clocks: "There are two times here",
  };
  return lang === "en" ? en[reason] : ko[reason];
}

function scheduleTitlePreview(text: string, lang: "ko" | "en"): string {
  const draft = buildNaturalScheduleDraft({
    id: "preview",
    text,
    images: [],
    created_at: new Date().toISOString(),
  });
  if (draft.text.trim()) return draft.text;
  return text.trim() || (lang === "en" ? "Untitled" : "제목 없음");
}

function resolvedChoiceItem(item: InboxItem, resolvedText: string): InboxItem {
  const resolved = buildNaturalScheduleDraft({ ...item, text: resolvedText });
  return withInboxScheduleDraft(item, resolved);
}

/** Ambiguity / clarify surface — never a second “save” after a clear capture. */
export function InlinePromise({
  item,
  acknowledged = false,
  onConfirmScheduleQuick,
  onConfirmClarify,
  onSchedule,
  onDismiss,
  onEditCaptureText,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const card = buildPromiseCard(item.text, uiLang);
  const draftedTitle = scheduleTitlePreview(item.text, uiLang);
  // Clarify keeps the spoken phrase; timed asks prefer the cleaned event title.
  const title =
    card.nlIntent === "schedule_clarify" ? item.text.trim() || draftedTitle : draftedTitle;
  // Safety vetoes apply even when the parser already assumed PM for bare hours.
  const activeConfirmation = scheduleConfirmationReason(item.text);
  const confirmationChoices = activeConfirmation
    ? scheduleConfirmationChoices(item.text, activeConfirmation, uiLang)
    : [];
  const clarifyOptions = clarifyPicksForText(item.text, uiLang);
  const clockLines =
    activeConfirmation === "multiple_clocks"
      ? extractClockPlanLines(item.text)
      : [];

  if (acknowledged) return null;

  const finish = (action: void | Promise<void>) => {
    void Promise.resolve(action).then(onDismiss);
  };

  const openManualSchedule = (source: "ambiguity" | "adjust" | "clarify") => {
    track("nl_manual_schedule_opened", {
      source,
      intent: card.nlIntent,
      confirmation_reason: activeConfirmation ?? undefined,
    });
    onSchedule(item);
  };

  const editCapture = () => {
    track("nl_multi_clock_edit_input", { intent: card.nlIntent });
    onEditCaptureText?.(item.text);
  };

  // --- Meridiem ambiguity (compact ask → commit on choice) ---
  if (activeConfirmation === "assumed_meridiem" && confirmationChoices.length > 0) {
    return (
      <div
        className="w-full rounded-[16px] border border-ink/[0.08] bg-white px-4 py-3.5"
        data-testid="inline-promise"
        data-intent={card.nlIntent}
        data-confidence={card.confidenceLevel}
        data-needs-confirmation="true"
        data-confirmation-reason="assumed_meridiem"
      >
        <strong className="block text-[16px] font-semibold leading-snug text-ink">
          {title}
        </strong>
        <p className="mt-2 text-[14px] font-medium leading-snug text-ink">
          {confirmationCopy("assumed_meridiem", uiLang)}
        </p>
        <div
          className="mt-3 grid grid-cols-2 gap-2"
          data-testid="promise-confirmation-choices"
        >
          {confirmationChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              data-testid={`promise-confirm-${choice.id}`}
              onClick={() => {
                track("nl_inline_ambiguity_resolved", {
                  reason: "assumed_meridiem",
                  choice: choice.id,
                });
                finish(
                  onConfirmScheduleQuick(
                    resolvedChoiceItem(item, choice.resolvedText),
                  ),
                );
              }}
              className="touch-press min-h-11 rounded-[12px] border border-ink/12 bg-ink/[0.03] px-3 py-2.5 text-[13px] font-semibold text-ink active:border-primary active:bg-primary/25"
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- Multiple clocks: honesty + restore composer ---
  if (activeConfirmation === "multiple_clocks") {
    return (
      <div
        className="w-full rounded-[16px] border border-ink/[0.08] bg-white px-4 py-3.5"
        data-testid="inline-promise"
        data-intent={card.nlIntent}
        data-confidence={card.confidenceLevel}
        data-needs-confirmation="true"
        data-confirmation-reason="multiple_clocks"
      >
        <p className="text-[16px] font-semibold leading-snug text-ink">
          {confirmationCopy("multiple_clocks", uiLang)}
        </p>
        <ul
          className="mt-3 divide-y divide-ink/[0.06] border-y border-ink/[0.06]"
          data-testid="multi-clock-lines"
        >
          {clockLines.map((line) => (
            <li
              key={line}
              className="py-2.5 text-[14px] font-medium leading-snug text-ink"
            >
              {line.trim()}
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[13px] leading-snug text-ink-soft">
          {t(
            "지금은 한 번에 하나씩 남길 수 있어요.",
            "For now, leave one plan at a time.",
          )}
        </p>
        <button
          type="button"
          data-testid="promise-edit-input"
          onClick={editCapture}
          className="touch-press mt-2 inline-flex min-h-11 items-center gap-1.5 px-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          <Pencil size={14} aria-hidden />
          {t("입력 수정", "Edit input")}
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-[16px] border border-ink/[0.08] bg-white px-4 py-3.5"
      data-testid="inline-promise"
      data-intent={card.nlIntent}
      data-confidence={card.confidenceLevel}
      data-sensitive={card.isSensitive ? "true" : "false"}
      data-needs-confirmation={activeConfirmation ? "true" : "false"}
    >
      <strong className="block text-[16px] font-semibold leading-snug text-ink">
        {title}
      </strong>
      <p className="mt-2 text-[14px] font-medium leading-snug text-ink">
        {activeConfirmation
          ? confirmationCopy(activeConfirmation, uiLang)
          : t("일정으로 이해했어요", "Understood as a schedule")}
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
                className="touch-press min-h-11 rounded-[12px] border border-ink/12 bg-ink/[0.03] px-2 py-2 text-[13px] font-semibold text-ink active:border-primary active:bg-primary/25"
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            data-testid="promise-manual"
            onClick={() => openManualSchedule("clarify")}
            className="touch-press mt-2 inline-flex min-h-11 items-center px-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
          >
            {t("직접 고르기", "Pick manually")}
          </button>
        </>
      ) : activeConfirmation && confirmationChoices.length > 0 ? (
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
                  reason: activeConfirmation,
                  choice: choice.id,
                });
                finish(
                  onConfirmScheduleQuick(
                    resolvedChoiceItem(item, choice.resolvedText),
                  ),
                );
              }}
              className="touch-press min-h-11 rounded-[12px] border border-ink/12 bg-ink/[0.03] px-3 py-2.5 text-[13px] font-semibold text-ink active:border-primary active:bg-primary/25"
            >
              {choice.label}
            </button>
          ))}
        </div>
      ) : activeConfirmation ? (
        <button
          type="button"
          data-testid="promise-edit-input"
          onClick={editCapture}
          className="touch-press mt-2 inline-flex min-h-11 items-center gap-1.5 px-1 text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          <Pencil size={14} aria-hidden />
          {t("입력 수정", "Edit input")}
        </button>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-ink-soft">
          <Clock3 size={14} aria-hidden />
          <span>
            {t(
              "일정을 저장하는 중이에요…",
              "Saving to your schedule…",
            )}
          </span>
        </div>
      )}
    </div>
  );
}
