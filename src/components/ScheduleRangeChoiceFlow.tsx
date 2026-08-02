import { useEffect, useMemo, useState } from "react";
import { Check, CalendarDays, Clock3 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import {
  type WhenKey,
  type ReminderKey,
  type RepeatKey,
  baseDateForWhen,
  defaultEndFromStart,
  inferWhenFromDate,
  reminderToMinutes,
  repeatKeyToRule,
  repeatLabel,
  repeatRuleToKey,
  startOfDay,
} from "@/lib/scheduleChoices";
import type { RepeatRule } from "@/lib/store";
import {
  defaultReminderForNewSchedule,
  scheduleHasSpecificTime,
} from "@/lib/push/scheduleNotificationDefaults";
import { resolveScheduleAllDayFlags } from "@/lib/scheduleTime";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import { EASE_OUT_APP } from "@/lib/motion";

const STEP_FADE = { duration: 0.24, ease: EASE_OUT_APP };
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

type Step = "when" | "time" | "reminder";

export type ScheduleRangeConfirmOptions = {
  reminderMinutes: number | null;
  allDay: boolean;
  startAllDay: boolean;
  endAllDay: boolean;
  repeat: RepeatRule | null;
};

type Props = {
  open: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialStartAllDay?: boolean;
  initialEndAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  suggestedStart?: Date;
  suggestionReason?: string | null;
  editMode?: boolean;
  initialReminderKey?: ReminderKey;
  onConfirm: (
    start: Date,
    end: Date,
    options: ScheduleRangeConfirmOptions,
  ) => void;
};

function toDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toTimeValue(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateFromValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function dateTimeFromValues(dateValue: string, timeValue: string): Date {
  const date = dateFromValue(dateValue);
  const [hours, minutes] = timeValue.split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function endOfLocalDay(value: string): Date {
  const date = dateFromValue(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: string, days: number): string {
  const date = dateFromValue(value);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

function sameDateValue(a: string, b: string): boolean {
  return a === b;
}

function formatDuration(ms: number, lang: "ko" | "en"): string {
  const totalMinutes = Math.max(1, Math.round(ms / MINUTE_MS));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];

  if (days) parts.push(lang === "ko" ? `${days}일` : `${days}d`);
  if (hours) parts.push(lang === "ko" ? `${hours}시간` : `${hours}h`);
  if (minutes || parts.length === 0) {
    parts.push(lang === "ko" ? `${minutes}분` : `${minutes}m`);
  }
  return parts.join(" ");
}

function formatRangeSummary(
  start: Date,
  end: Date,
  allDay: boolean,
  lang: "ko" | "en",
): string {
  const locale = lang === "ko" ? "ko-KR" : "en-US";
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (allDay) {
    const startLabel = start.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
    const endLabel = end.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
    const dayCount =
      Math.round(
        (startOfDay(end).getTime() - startOfDay(start).getTime()) /
          (24 * HOUR_MS),
      ) + 1;
    if (sameDay) {
      return lang === "ko"
        ? `${startLabel} · 하루 종일`
        : `${startLabel} · All day`;
    }
    return lang === "ko"
      ? `${startLabel} → ${endLabel} · ${dayCount}일 · 하루 종일`
      : `${startLabel} → ${endLabel} · ${dayCount} days · All day`;
  }

  const startDate = start.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  const endDate = end.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
  const startTime = start.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: lang === "en",
  });
  const endTime = end.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: lang === "en",
  });
  const duration = formatDuration(end.getTime() - start.getTime(), lang);

  return sameDay
    ? `${startDate} · ${startTime}–${endTime} · ${duration}`
    : `${startDate} ${startTime} → ${endDate} ${endTime} · ${duration}`;
}

function IosSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        tick();
        onChange(!checked);
      }}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-ink/15"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_4px_oklch(0_0_0/0.18)] transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12px] font-semibold text-ink-soft/75">
      {children}
    </span>
  );
}

function NativeField({
  label,
  type,
  value,
  min,
  onChange,
}: {
  label: string;
  type: "date" | "time";
  value: string;
  min?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        aria-label={label}
        type={type}
        value={value}
        min={min}
        step={type === "time" ? 60 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-[14px] border border-ink/[0.08] bg-white px-3 text-[15px] font-semibold tabular-nums text-ink shadow-[0_1px_2px_rgba(0,0,0,0.02)] input-focus-ring"
      />
    </label>
  );
}

function ChoiceButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tick();
        onClick();
      }}
      className={`touch-press flex w-full items-center justify-between rounded-[15px] px-4 py-3.5 text-left text-[15px] font-semibold ${
        active
          ? "bg-primary/35 text-ink ring-1 ring-primary/45"
          : "bg-ink/[0.035] text-ink ring-1 ring-ink/[0.045]"
      }`}
    >
      <span>{children}</span>
      {active && <Check size={17} strokeWidth={2.75} />}
    </button>
  );
}

export function ScheduleRangeChoiceFlow({
  open,
  title,
  onTitleChange,
  initialStart,
  initialEnd,
  initialAllDay,
  initialStartAllDay,
  initialEndAllDay,
  initialRepeat,
  suggestedStart,
  suggestionReason,
  editMode,
  initialReminderKey,
  onConfirm,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en" : "ko";
  const [step, setStep] = useState<Step>("when");
  const [when, setWhen] = useState<WhenKey>("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [repeat, setRepeat] = useState<RepeatKey>("none");
  const [reminder, setReminder] = useState<ReminderKey>("at");

  useEffect(() => {
    if (!open) return;
    const seedStart = initialStart ?? suggestedStart ?? new Date();
    const seedEnd = initialEnd ?? defaultEndFromStart(seedStart);
    const resolved = resolveScheduleAllDayFlags({
      start_time: seedStart.toISOString(),
      end_time: seedEnd.toISOString(),
      all_day: initialAllDay,
      start_all_day: initialStartAllDay,
      end_all_day: initialEndAllDay,
    });
    const bothAllDay = resolved.startAllDay && resolved.endAllDay;

    setWhen(inferWhenFromDate(seedStart));
    setStartDate(toDateValue(seedStart));
    setEndDate(toDateValue(seedEnd));
    setStartTime(toTimeValue(seedStart));
    setEndTime(toTimeValue(seedEnd));
    setAllDay(bothAllDay);
    setRepeat(repeatRuleToKey(initialRepeat));
    setReminder(
      editMode
        ? initialReminderKey ?? "off"
        : defaultReminderForNewSchedule(
            scheduleHasSpecificTime(bothAllDay, bothAllDay),
          ),
    );
    setStep("when");
  }, [
    open,
    initialStart?.getTime(),
    initialEnd?.getTime(),
    initialAllDay,
    initialStartAllDay,
    initialEndAllDay,
    initialRepeat,
    initialReminderKey,
    suggestedStart?.getTime(),
    editMode,
  ]);

  const range = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = allDay
      ? dateFromValue(startDate)
      : dateTimeFromValues(startDate, startTime);
    const end = allDay
      ? endOfLocalDay(endDate)
      : dateTimeFromValues(endDate, endTime);
    return { start, end };
  }, [allDay, endDate, endTime, startDate, startTime]);

  const rangeValid = Boolean(
    range &&
      range.end.getTime() > range.start.getTime() &&
      dateFromValue(endDate).getTime() >= dateFromValue(startDate).getTime(),
  );

  const todayValue = toDateValue(new Date());
  const minimumDate = editMode ? undefined : todayValue;

  const applyQuickDate = (key: WhenKey) => {
    const next = startOfDay(baseDateForWhen(key));
    const previousStart = range?.start;
    const previousEnd = range?.end;
    const duration =
      previousStart && previousEnd
        ? Math.max(HOUR_MS, previousEnd.getTime() - previousStart.getTime())
        : HOUR_MS;
    const nextStartDate = toDateValue(next);
    setWhen(key);
    setStartDate(nextStartDate);

    if (allDay) {
      const previousDaySpan =
        startDate && endDate
          ? Math.max(
              0,
              Math.round(
                (dateFromValue(endDate).getTime() -
                  dateFromValue(startDate).getTime()) /
                  (24 * HOUR_MS),
              ),
            )
          : 0;
      setEndDate(addDays(nextStartDate, previousDaySpan));
      return;
    }

    const nextStart = dateTimeFromValues(nextStartDate, startTime);
    const nextEnd = new Date(nextStart.getTime() + duration);
    setEndDate(toDateValue(nextEnd));
    setEndTime(toTimeValue(nextEnd));
  };

  const updateStartDate = (value: string) => {
    setWhen("pick_date");
    setStartDate(value);
    if (!endDate || dateFromValue(endDate).getTime() < dateFromValue(value).getTime()) {
      setEndDate(value);
    }
  };

  const updateStartTime = (value: string) => {
    setStartTime(value);
    if (!allDay && startDate && endDate) {
      const nextStart = dateTimeFromValues(startDate, value);
      const currentEnd = dateTimeFromValues(endDate, endTime);
      if (currentEnd.getTime() <= nextStart.getTime()) {
        const nextEnd = new Date(nextStart.getTime() + HOUR_MS);
        setEndDate(toDateValue(nextEnd));
        setEndTime(toTimeValue(nextEnd));
      }
    }
  };

  const updateEndDate = (value: string) => {
    setEndDate(value);
  };

  const updateAllDay = (value: boolean) => {
    setAllDay(value);
    if (value && dateFromValue(endDate).getTime() < dateFromValue(startDate).getTime()) {
      setEndDate(startDate);
    }
    if (!editMode) {
      setReminder(
        defaultReminderForNewSchedule(scheduleHasSpecificTime(value, value)),
      );
    }
  };

  const handleDone = () => {
    if (!range || !rangeValid) return;
    confirmHaptic();
    onConfirm(range.start, range.end, {
      reminderMinutes: reminderToMinutes(reminder),
      allDay,
      startAllDay: allDay,
      endAllDay: allDay,
      repeat: repeatKeyToRule(repeat),
    });
  };

  const whenOptions: { key: WhenKey; label: string }[] = [
    { key: "today", label: t("오늘", "Today") },
    { key: "tomorrow", label: t("내일", "Tomorrow") },
    { key: "weekend", label: t("이번 주말", "This weekend") },
  ];

  const reminderOptions: { key: ReminderKey; label: string }[] = [
    { key: "at", label: t("시작할 때", "At start time") },
    { key: "5m", label: t("5분 전", "5 min before") },
    { key: "10m", label: t("10분 전", "10 min before") },
    { key: "30m", label: t("30분 전", "30 min before") },
    { key: "1h", label: t("1시간 전", "1 hour before") },
    { key: "1d", label: t("하루 전", "1 day before") },
    { key: "off", label: t("알림 없음", "No reminder") },
  ];

  const repeatOptions: RepeatKey[] = [
    "none",
    "daily",
    "weekly",
    "monthly",
    "yearly",
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="schedule-range-flow">
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        <AnimatePresence mode="wait">
          {step === "when" && (
            <motion.div
              key="when"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={STEP_FADE}
            >
              <div className="mb-4">
                <h2 className="text-[19px] font-bold tracking-[-0.025em] text-ink">
                  {t("일정은 언제 시작하나요?", "When does it start?")}
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                  {suggestionReason ??
                    t(
                      "날짜를 먼저 정하고, 다음 화면에서 시작과 종료를 정확히 설정해요.",
                      "Choose the date first, then set the exact start and end.",
                    )}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {whenOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => applyQuickDate(option.key)}
                    className={`touch-press rounded-full px-2 py-2.5 text-[13px] font-semibold ${
                      when === option.key
                        ? "bg-primary text-ink"
                        : "bg-ink/[0.035] text-ink-soft ring-1 ring-ink/[0.05]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-[18px] border border-ink/[0.07] bg-ink/[0.025] p-4">
                <div className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <CalendarDays size={17} strokeWidth={2.2} />
                  {t("시작 날짜", "Start date")}
                </div>
                <NativeField
                  label={t("날짜", "Date")}
                  type="date"
                  value={startDate}
                  min={minimumDate}
                  onChange={updateStartDate}
                />
              </div>
            </motion.div>
          )}

          {step === "time" && (
            <motion.div
              key="time"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={STEP_FADE}
            >
              <button
                type="button"
                onClick={() => setStep("when")}
                className="mb-3 text-[13px] font-medium text-ink-soft/75 touch-press"
              >
                {t("← 시작 날짜", "← Start date")}
              </button>

              <input
                aria-label={t("일정 이름", "Schedule title")}
                value={title}
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t("무슨 일정인가요?", "What is this schedule?")}
                className="mb-4 w-full rounded-[16px] border border-ink/[0.07] bg-white px-4 py-3.5 text-[16px] font-semibold text-ink placeholder:text-ink-soft/45 input-focus-ring"
              />

              <div className="mb-3 flex items-center justify-between rounded-[16px] border border-ink/[0.07] bg-ink/[0.025] px-4 py-3.5">
                <div>
                  <p className="text-[15px] font-semibold text-ink">
                    {t("하루 종일", "All day")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-soft">
                    {t(
                      "여러 날이면 시작일과 종료일 모두 표시돼요.",
                      "Multi-day plans span every included date.",
                    )}
                  </p>
                </div>
                <IosSwitch
                  checked={allDay}
                  onChange={updateAllDay}
                  label={t("하루 종일", "All day")}
                />
              </div>

              <div className="space-y-3">
                <section className="rounded-[18px] border border-ink/[0.08] bg-white p-4 shadow-[0_10px_28px_-26px_rgba(0,0,0,0.35)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/35 text-[12px] font-bold text-ink">
                      1
                    </span>
                    <h3 className="text-[16px] font-bold text-ink">
                      {t("시작", "Start")}
                    </h3>
                  </div>
                  <div className={`grid gap-3 ${allDay ? "grid-cols-1" : "grid-cols-2"}`}>
                    <NativeField
                      label={t("시작 날짜", "Start date")}
                      type="date"
                      value={startDate}
                      min={minimumDate}
                      onChange={updateStartDate}
                    />
                    {!allDay && (
                      <NativeField
                        label={t("시작 시각", "Start time")}
                        type="time"
                        value={startTime}
                        onChange={updateStartTime}
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-[18px] border border-ink/[0.08] bg-white p-4 shadow-[0_10px_28px_-26px_rgba(0,0,0,0.35)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink/[0.07] text-[12px] font-bold text-ink">
                      2
                    </span>
                    <h3 className="text-[16px] font-bold text-ink">
                      {t("종료", "End")}
                    </h3>
                  </div>
                  <div className={`grid gap-3 ${allDay ? "grid-cols-1" : "grid-cols-2"}`}>
                    <NativeField
                      label={t("종료 날짜", "End date")}
                      type="date"
                      value={endDate}
                      min={startDate || minimumDate}
                      onChange={updateEndDate}
                    />
                    {!allDay && (
                      <NativeField
                        label={t("종료 시각", "End time")}
                        type="time"
                        value={endTime}
                        onChange={setEndTime}
                      />
                    )}
                  </div>
                </section>
              </div>

              <div
                className={`mt-3 rounded-[16px] border px-4 py-3.5 ${
                  rangeValid
                    ? "border-primary/30 bg-primary/12"
                    : "border-red-200 bg-red-50"
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-2.5">
                  <Clock3
                    size={17}
                    className={rangeValid ? "mt-0.5 text-ink" : "mt-0.5 text-red-600"}
                  />
                  <div>
                    <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-ink-soft/70">
                      {t("일정 기간", "Schedule range")}
                    </p>
                    <p className={`mt-1 text-[14px] font-semibold leading-relaxed ${
                      rangeValid ? "text-ink" : "text-red-700"
                    }`}>
                      {range && rangeValid
                        ? formatRangeSummary(range.start, range.end, allDay, locale)
                        : t(
                            "종료는 시작보다 뒤여야 해요.",
                            "The end must be after the start.",
                          )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-[16px] border border-ink/[0.07] bg-ink/[0.025] p-4">
                <label className="block">
                  <FieldLabel>{t("반복", "Repeat")}</FieldLabel>
                  <select
                    aria-label={t("반복", "Repeat")}
                    value={repeat}
                    onChange={(event) => setRepeat(event.target.value as RepeatKey)}
                    className="h-12 w-full rounded-[14px] border border-ink/[0.08] bg-white px-3 text-[15px] font-semibold text-ink input-focus-ring"
                  >
                    {repeatOptions.map((option) => (
                      <option key={option} value={option}>
                        {repeatLabel(option, t)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </motion.div>
          )}

          {step === "reminder" && (
            <motion.div
              key="reminder"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={STEP_FADE}
            >
              <button
                type="button"
                onClick={() => setStep("time")}
                className="mb-3 text-[13px] font-medium text-ink-soft/75 touch-press"
              >
                {t("← 일정 기간", "← Schedule range")}
              </button>
              <h2 className="mb-1 text-[19px] font-bold tracking-[-0.025em] text-ink">
                {t("언제 알려드릴까요?", "When should I remind you?")}
              </h2>
              {range && (
                <p className="mb-4 text-[13px] leading-relaxed text-ink-soft">
                  {formatRangeSummary(range.start, range.end, allDay, locale)}
                </p>
              )}
              <div className="space-y-2">
                {reminderOptions.map((option) => (
                  <ChoiceButton
                    key={option.key}
                    active={reminder === option.key}
                    onClick={() => setReminder(option.key)}
                  >
                    {option.label}
                  </ChoiceButton>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sheet-cta-bar shrink-0 border-t border-ink/[0.08] bg-white/98 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        {step === "when" && (
          <button
            type="button"
            onClick={() => setStep("time")}
            disabled={!startDate}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {t("시간과 종료 정하기", "Add time and end")}
          </button>
        )}
        {step === "time" && (
          <button
            type="button"
            onClick={() => setStep("reminder")}
            disabled={!rangeValid}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
          >
            {t("알림 정하기", "Set a reminder")}
          </button>
        )}
        {step === "reminder" && (
          <button
            type="button"
            onClick={handleDone}
            disabled={!rangeValid}
            className="touch-press flex w-full flex-col items-center justify-center gap-1 rounded-full bg-ink py-3.5 text-white shadow-[0_4px_20px_-4px_oklch(0_0_0/0.35)] disabled:opacity-40"
          >
            <span className="text-[16px] font-semibold tracking-[-0.01em]">
              {t("일정에 추가", "Add to schedule")}
            </span>
            {range && rangeValid && (
              <span className="max-w-full truncate px-2 text-[11px] font-medium text-white/70">
                {formatRangeSummary(range.start, range.end, allDay, locale)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
