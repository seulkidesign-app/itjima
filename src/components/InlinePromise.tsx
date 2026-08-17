import {
  CalendarDays,
  Clock3,
  ListTodo,
  Pencil,
  ShieldCheck,
} from "lucide-react";
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
};

type SchedulePreview = {
  title: string;
  date: string | null;
  time: string | null;
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

function schedulePreview(text: string, lang: "ko" | "en"): SchedulePreview {
  const datePatterns =
    lang === "ko"
      ? [
          /이번\s*주\s*(?:월|화|수|목|금|토|일)요일/,
          /다음\s*주\s*(?:월|화|수|목|금|토|일)요일/,
          /(?:오늘|내일|모레|주말|이번\s*주말|다음\s*주말)/,
          /(?:월|화|수|목|금|토|일)요일/,
          /\d{1,2}월\s*\d{1,2}일/,
        ]
      : [
          /\b(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend)\b/i,
          /\b(?:today|tomorrow|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
          /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}\b/i,
        ];
  const timePatterns =
    lang === "ko"
      ? [
          /(?:오전|오후)\s*\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/,
          /\d{1,2}\s*시(?:\s*\d{1,2}\s*분)?/,
          /퇴근\s*(?:후|하고|하고서|뒤)/,
        ]
      : [
          /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i,
          /\bat\s+\d{1,2}(?::\d{2})?\b/i,
          /\bafter\s+work\b/i,
        ];

  const date = datePatterns.map((pattern) => text.match(pattern)?.[0]).find(Boolean) ?? null;
  const time = timePatterns.map((pattern) => text.match(pattern)?.[0]).find(Boolean) ?? null;

  let title = text;
  if (date) title = title.replace(date, " ");
  if (time) title = title.replace(time, " ");
  title = title
    .replace(/\s+/g, " ")
    .replace(/^(?:에|에서|까지|부터)\s*/, "")
    .replace(/\s*(?:에|에서|까지|부터)$/g, "")
    .trim();

  return {
    title: title || text.trim(),
    date,
    time,
  };
}

function resolvedChoiceItem(item: InboxItem, resolvedText: string): InboxItem {
  const resolved = buildNaturalScheduleDraft({ ...item, text: resolvedText });
  return withInboxScheduleDraft(item, resolved);
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
  const preview = schedulePreview(item.text, uiLang);
  const confirmation =
    card.nlIntent === "schedule_exact"
      ? scheduleConfirmationReason(item.text)
      : null;
  const confirmationChoices = confirmation
    ? scheduleConfirmationChoices(item.text, confirmation, uiLang)
    : [];
  const clarifyOptions = clarifyPicksForText(item.text, uiLang);
  const isTask = card.nlIntent === "task";

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
      className="ml-1 w-full max-w-[min(350px,94%)] rounded-[20px] border border-ink/8 bg-[#fafaf8] p-3.5 shadow-card"
      data-testid="inline-promise"
      data-intent={card.nlIntent}
      data-confidence={card.confidenceLevel}
      data-sensitive={card.isSensitive ? "true" : "false"}
      data-needs-confirmation={confirmation ? "true" : "false"}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-ink/[0.055] text-ink-soft">
          {isTask ? <ListTodo size={15} aria-hidden /> : <CalendarDays size={15} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-soft">
            {isTask
              ? t("할 일로 이해했어요", "Understood as a task")
              : t("일정으로 이해했어요", "Understood as a schedule")}
          </p>
        </div>
        <button
          type="button"
          data-testid="promise-header-adjust"
          onClick={() => openManualSchedule("adjust")}
          className="touch-press inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-ink-soft hover:bg-ink/[0.05]"
        >
          <Pencil size={12} aria-hidden />
          {t("수정", "Adjust")}
        </button>
      </div>

      <div
        className="mt-3 overflow-hidden rounded-[15px] border border-ink/[0.07] bg-white"
        data-testid="promise-summary"
      >
        <div className="flex min-h-[48px] items-center gap-3 px-3 py-2.5">
          <span className="w-[3.2rem] shrink-0 text-[11px] font-semibold text-ink-soft">
            {t("내용", "Plan")}
          </span>
          <strong className="min-w-0 flex-1 text-[14px] font-bold leading-snug text-ink">
            {preview.title}
          </strong>
        </div>

        {!isTask && (
          <>
            <div className="flex min-h-[44px] items-center gap-3 border-t border-ink/[0.06] px-3 py-2">
              <CalendarDays size={14} className="shrink-0 text-ink-soft" aria-hidden />
              <span className="w-[2.2rem] shrink-0 text-[11px] font-semibold text-ink-soft">
                {t("날짜", "Date")}
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-semibold text-ink">
                {preview.date ?? t("확인 필요", "Needs confirmation")}
              </span>
              {!preview.date && (
                <span className="rounded-full bg-primary/55 px-2 py-1 text-[9.5px] font-bold text-ink">
                  {t("미정", "Open")}
                </span>
              )}
            </div>
            <div className="flex min-h-[44px] items-center gap-3 border-t border-ink/[0.06] px-3 py-2">
              <Clock3 size={14} className="shrink-0 text-ink-soft" aria-hidden />
              <span className="w-[2.2rem] shrink-0 text-[11px] font-semibold text-ink-soft">
                {t("시간", "Time")}
              </span>
              <span className="min-w-0 flex-1 text-[12px] font-semibold text-ink">
                {preview.time ?? t("시간 미정", "No time yet")}
              </span>
              {confirmation && (
                <span className="rounded-full bg-primary/55 px-2 py-1 text-[9.5px] font-bold text-ink">
                  {t("확인", "Check")}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-[1.45] text-ink-soft">
        <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden />
        <p>
          {confirmation
            ? confirmationChoices.length > 0
              ? confirmationCopy(confirmation, uiLang)
              : t(
                  "날짜와 시간에 확인할 부분이 여러 개 있어요. 한 번에 같이 확인해 주세요.",
                  "There are a few date and time details to check together.",
                )
            : isTask
              ? t(
                  "날짜 없이 나중 할 일로 둘 수 있어요.",
                  "Keep it as a later task without choosing a date.",
                )
              : card.promise}
        </p>
      </div>

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
      ) : isTask ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="promise-primary"
            onClick={() => finish(onConfirmTaskLater(item))}
            className="pill-yellow touch-press min-h-[42px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {t("나중 할 일로 두기", "Keep as later task")}
          </button>
          <button
            type="button"
            data-testid="promise-add-date"
            onClick={() => openManualSchedule("adjust")}
            className="touch-press min-h-[42px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
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
                      onConfirmScheduleQuick(
                        resolvedChoiceItem(item, choice.resolvedText),
                      ),
                    );
                  }}
                  className={`touch-press min-h-[42px] rounded-full px-3 py-2 text-[12px] font-bold text-ink ${
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
              ? t("다른 시간 고르기", "Choose another time")
              : t("확인하고 추가", "Review and add")}
          </button>
        </>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="promise-primary"
            onClick={() => finish(onConfirmScheduleQuick(item))}
            className="pill-yellow touch-press min-h-[42px] flex-1 px-3 py-2 text-[12px] font-bold text-ink"
          >
            {t("일정에 추가", "Add to schedule")}
          </button>
          <button
            type="button"
            data-testid="promise-manual"
            onClick={() => openManualSchedule("adjust")}
            className="touch-press min-h-[42px] rounded-full border border-ink/12 bg-white px-3 py-2 text-[12px] font-semibold text-ink"
          >
            {t("수정", "Adjust")}
          </button>
        </div>
      )}
    </div>
  );
}
