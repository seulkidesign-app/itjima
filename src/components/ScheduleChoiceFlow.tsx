import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BellOff,
  BellRing,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import {
  type WhenKey,
  type ReminderKey,
  type RepeatKey,
  baseDateForWhen,
  defaultEndFromStart,
  endOfDay,
  formatSuggestedMoment,
  inferWhenFromDate,
  reminderToMinutes,
  repeatKeyToRule,
  repeatLabel,
  repeatRuleToKey,
  startOfDay,
} from "@/lib/scheduleChoices";
import {
  formatScheduleConfigSummary,
  inferScheduleAllDayFlags,
  resolveScheduleAllDayFlags,
} from "@/lib/scheduleTime";
import type { RepeatRule } from "@/lib/store";
import {
  defaultReminderForNewSchedule,
  scheduleHasSpecificTime,
} from "@/lib/push/scheduleNotificationDefaults";
import { EASE_OUT_APP } from "@/lib/motion";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

const STEP_FADE = { duration: 0.22, ease: EASE_OUT_APP };
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type Step = "when" | "time" | "reminder";

export type ScheduleConfirmOptions = {
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
  thoughtText?: string;
  guidanceReason?: string | null;
  editMode?: boolean;
  initialReminderKey?: ReminderKey;
  onConfirm: (
    start: Date,
    end: Date,
    options: ScheduleConfirmOptions,
  ) => void;
};

function toDateValue(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function toTimeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function parseDateTime(dateValue: string, timeValue: string): Date {
  const date = parseDate(dateValue);
  const [hour, minute] = timeValue.split(":").map(Number);
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date;
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

function daySpan(startValue: string, endValue: string): number {
  if (!startValue || !endValue) return 0;
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endUtc - startUtc) / DAY_MS));
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatPickDateCta(date: Date, lang: "ko" | "en"): string {
  if (lang === "en") {
    return `${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
    })} selected`;
  }
  return `${date.getMonth() + 1}월 ${date.getDate()}일 선택`;
}

function formatDateLine(date: Date, lang: "ko" | "en"): string {
  return date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTimeLine(date: Date, lang: "ko" | "en"): string {
  return date.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatAlarmMoment(date: Date, lang: "ko" | "en"): string {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  if (date >= today && date < tomorrow) {
    return lang === "ko"
      ? `오늘 ${formatTimeLine(date, lang)}`
      : `Today at ${formatTimeLine(date, lang)}`;
  }
  if (date >= tomorrow && date < dayAfter) {
    return lang === "ko"
      ? `내일 ${formatTimeLine(date, lang)}`
      : `Tomorrow at ${formatTimeLine(date, lang)}`;
  }
  return lang === "ko"
    ? `${formatDateLine(date, lang)} ${formatTimeLine(date, lang)}`
    : `${formatDateLine(date, lang)} at ${formatTimeLine(date, lang)}`;
}

function Switch({
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
      className={`relative h-[31px] w-[51px] min-w-[51px] shrink-0 overflow-hidden rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-ink/15"
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-transform ${
          checked ? "translate-x-[20px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
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
          ? "bg-primary/30 text-ink ring-1 ring-primary/45"
          : "bg-ink/[0.035] text-ink ring-1 ring-ink/[0.05]"
      }`}
    >
      <span>{children}</span>
      {active && <Check size={17} strokeWidth={2.8} />}
    </button>
  );
}

function DateTimeField({
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
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[11px] font-bold text-ink-soft/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        min={min}
        step={type === "time" ? 60 : undefined}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-[14px] border border-ink/[0.08] bg-white px-3 text-[15px] font-bold tabular-nums text-ink input-focus-ring"
      />
    </label>
  );
}

function TimeBoundaryCard({
  title,
  timeEnabled,
  switchLabel,
  dateLabel,
  timeLabel,
  date,
  time,
  minDate,
  onTimeEnabledChange,
  onDateChange,
  onTimeChange,
}: {
  title: string;
  timeEnabled: boolean;
  switchLabel: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  minDate?: string;
  onTimeEnabledChange: (value: boolean) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-[20px] border border-ink/[0.08] bg-ink/[0.025] p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-bold text-ink">{title}</h3>
          <p className="mt-0.5 text-[12px] font-medium text-ink-soft/75">
            {timeEnabled ? timeLabel : dateLabel}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] font-bold text-ink-soft">
            {timeEnabled ? "시간" : "날짜만"}
          </span>
          <Switch
            checked={timeEnabled}
            onChange={onTimeEnabledChange}
            label={switchLabel}
          />
        </div>
      </div>

      <div
        className={`mt-3 grid min-w-0 gap-3 ${
          timeEnabled ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        }`}
      >
        <DateTimeField
          label={dateLabel}
          type="date"
          value={date}
          min={minDate}
          onChange={onDateChange}
        />
        {timeEnabled && (
          <DateTimeField
            label={timeLabel}
            type="time"
            value={time}
            onChange={onTimeChange}
          />
        )}
      </div>
    </section>
  );
}

function SchedulePickCalendar({
  viewYear,
  viewMonth,
  selected,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  lang,
}: {
  viewYear: number;
  viewMonth: number;
  selected: Date | null;
  onSelectDay: (day: number) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  lang: "ko" | "en";
}) {
  const today = startOfToday();
  const first = new Date(viewYear, viewMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthLabel =
    lang === "en"
      ? first.toLocaleString("en-US", { month: "long", year: "numeric" })
      : `${viewYear}년 ${viewMonth + 1}월`;
  const weekdays =
    lang === "en"
      ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
      : ["일", "월", "화", "수", "목", "금", "토"];

  const cells: Array<number | null> = [];
  for (let index = 0; index < startDay; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

  return (
    <div className="mt-3 overflow-hidden rounded-[18px] bg-ink/[0.035] p-3 ring-1 ring-ink/[0.05]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="touch-press flex h-9 w-9 items-center justify-center rounded-full text-ink-soft active:bg-ink/[0.06]"
          aria-label={lang === "en" ? "Previous month" : "이전 달"}
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        <span className="text-[15px] font-bold text-ink">{monthLabel}</span>
        <button
          type="button"
          onClick={onNextMonth}
          className="touch-press flex h-9 w-9 items-center justify-center rounded-full text-ink-soft active:bg-ink/[0.06]"
          aria-label={lang === "en" ? "Next month" : "다음 달"}
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-ink-soft/65">
        {weekdays.map((weekday) => (
          <span key={weekday} className="py-1">
            {weekday}
          </span>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} aria-hidden />;
          const date = new Date(viewYear, viewMonth, day, 0, 0, 0, 0);
          const isPast = date.getTime() < today.getTime();
          const isToday = sameCalendarDay(date, today);
          const isSelected = selected
            ? sameCalendarDay(date, selected)
            : false;

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDay(day)}
              className={`touch-press flex h-10 items-center justify-center rounded-[12px] text-[13px] font-semibold tabular-nums ${
                isPast
                  ? "cursor-not-allowed text-ink-soft/25"
                  : isSelected
                    ? "bg-primary text-ink"
                    : isToday
                      ? "text-ink ring-1 ring-ink/12"
                      : "text-ink-soft active:bg-ink/[0.05]"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const REPEAT_OPTIONS: RepeatKey[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

const REMINDER_OPTIONS: Array<{
  key: ReminderKey;
  ko: string;
  en: string;
}> = [
  { key: "at", ko: "시작할 때", en: "At start time" },
  { key: "5m", ko: "5분 전", en: "5 min before" },
  { key: "10m", ko: "10분 전", en: "10 min before" },
  { key: "30m", ko: "30분 전", en: "30 min before" },
  { key: "1h", ko: "1시간 전", en: "1 hour before" },
  { key: "1d", ko: "하루 전", en: "1 day before" },
  { key: "off", ko: "알림 없음", en: "No reminder" },
];

export function ScheduleChoiceFlow({
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
  thoughtText,
  guidanceReason,
  editMode,
  initialReminderKey,
  onConfirm,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en" : "ko";

  const [step, setStep] = useState<Step>("when");
  const [when, setWhen] = useState<WhenKey>("today");
  const [calendarView, setCalendarView] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [pickedCalendarDate, setPickedCalendarDate] = useState<Date | null>(
    null,
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [startTimeEnabled, setStartTimeEnabled] = useState(false);
  const [endTimeEnabled, setEndTimeEnabled] = useState(false);
  const [repeat, setRepeat] = useState<RepeatKey>("none");
  const [reminder, setReminder] = useState<ReminderKey>("off");

  useEffect(() => {
    if (!open) return;
    const seedStart = initialStart ?? suggestedStart ?? new Date();
    const seedEnd = initialEnd ?? defaultEndFromStart(seedStart);
    const seedWhen = inferWhenFromDate(seedStart);
    const resolved =
      initialStartAllDay !== undefined || initialEndAllDay !== undefined
        ? {
            startAllDay: initialStartAllDay ?? false,
            endAllDay: initialEndAllDay ?? false,
          }
        : editMode && initialStart && initialEnd
          ? resolveScheduleAllDayFlags({
              start_time: seedStart.toISOString(),
              end_time: seedEnd.toISOString(),
              all_day: initialAllDay,
              start_all_day: initialStartAllDay,
              end_all_day: initialEndAllDay,
            })
          : inferScheduleAllDayFlags(seedStart, seedEnd, initialAllDay);

    setWhen(seedWhen);
    setStartDate(toDateValue(seedStart));
    setEndDate(toDateValue(seedEnd));
    setStartTime(toTimeValue(seedStart));
    setEndTime(toTimeValue(seedEnd));
    setStartTimeEnabled(!resolved.startAllDay);
    setEndTimeEnabled(!resolved.endAllDay);
    setRepeat(repeatRuleToKey(initialRepeat));
    setReminder(
      editMode
        ? initialReminderKey ?? "off"
        : defaultReminderForNewSchedule(
            scheduleHasSpecificTime(
              resolved.startAllDay,
              resolved.endAllDay,
            ),
          ),
    );

    const picked = startOfDay(seedStart);
    setPickedCalendarDate(picked);
    setCalendarView({
      year: picked.getFullYear(),
      month: picked.getMonth(),
    });
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
    const start = startTimeEnabled
      ? parseDateTime(startDate, startTime)
      : startOfDay(parseDate(startDate));
    const end = endTimeEnabled
      ? parseDateTime(endDate, endTime)
      : endOfDay(parseDate(endDate));
    return { start, end };
  }, [
    endDate,
    endTime,
    endTimeEnabled,
    startDate,
    startTime,
    startTimeEnabled,
  ]);

  const validRange = Boolean(
    range &&
      range.end.getTime() > range.start.getTime() &&
      parseDate(endDate).getTime() >= parseDate(startDate).getTime(),
  );

  const startAllDay = !startTimeEnabled;
  const endAllDay = !endTimeEnabled;
  const bothAllDay = startAllDay && endAllDay;
  const reminderMinutes = reminderToMinutes(reminder);
  const alarmAt =
    range && reminderMinutes != null
      ? new Date(range.start.getTime() - reminderMinutes * MINUTE_MS)
      : null;

  const configSummary = range
    ? formatScheduleConfigSummary(
        startAllDay,
        endAllDay,
        range.start,
        range.end,
        locale,
      )
    : "";

  const momentPreview = range
    ? formatSuggestedMoment(range.start, locale, bothAllDay)
    : "";

  const shiftStartDate = (nextDate: string) => {
    if (!nextDate) return;
    const span = daySpan(startDate, endDate);
    setStartDate(nextDate);
    setEndDate(addDays(nextDate, span));
  };

  const chooseDate = (date: Date, key: WhenKey = "pick_date") => {
    const normalized = startOfDay(date);
    setWhen(key);
    setPickedCalendarDate(normalized);
    setCalendarView({
      year: normalized.getFullYear(),
      month: normalized.getMonth(),
    });
    shiftStartDate(toDateValue(normalized));
  };

  const quickDates: Array<{ key: WhenKey; ko: string; en: string }> = [
    { key: "today", ko: "오늘", en: "Today" },
    { key: "tomorrow", ko: "내일", en: "Tomorrow" },
    { key: "weekend", ko: "이번 주말", en: "This weekend" },
  ];

  const updateStartTime = (value: string) => {
    if (!value) return;
    setStartTime(value);
    if (!endTimeEnabled || !startDate || !endDate) return;
    const nextStart = parseDateTime(startDate, value);
    const currentEnd = parseDateTime(endDate, endTime);
    if (currentEnd.getTime() > nextStart.getTime()) return;
    const bumped = new Date(nextStart.getTime() + HOUR_MS);
    setEndDate(toDateValue(bumped));
    setEndTime(toTimeValue(bumped));
  };

  const applyDuration = (minutes: number) => {
    if (!startDate) return;
    const start = startTimeEnabled
      ? parseDateTime(startDate, startTime)
      : parseDateTime(startDate, "09:00");
    const end = new Date(start.getTime() + minutes * MINUTE_MS);
    setStartTimeEnabled(true);
    setEndTimeEnabled(true);
    if (!startTimeEnabled) setStartTime(toTimeValue(start));
    setEndDate(toDateValue(end));
    setEndTime(toTimeValue(end));
  };

  const applyNextDay = () => {
    if (!startDate) return;
    setEndDate(addDays(startDate, 1));
    if (startTimeEnabled) {
      setEndTimeEnabled(true);
      setEndTime(startTime);
    }
  };

  const goNext = () => {
    if (step === "when") {
      if (!pickedCalendarDate) return;
      setStep("time");
      return;
    }
    if (step === "time") {
      if (!validRange) return;
      if (!editMode) {
        setReminder(
          defaultReminderForNewSchedule(
            scheduleHasSpecificTime(startAllDay, endAllDay),
          ),
        );
      }
      setStep("reminder");
    }
  };

  const goBack = () => {
    if (step === "reminder") setStep("time");
    else if (step === "time") setStep("when");
  };

  const handleDone = () => {
    if (!range || !validRange) return;
    confirmHaptic();
    onConfirm(range.start, range.end, {
      reminderMinutes,
      allDay: bothAllDay,
      startAllDay,
      endAllDay,
      repeat: repeatKeyToRule(repeat),
    });
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="schedule-choice-flow"
    >
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {thoughtText && !editMode && step === "when" && (
          <div className="mb-3.5 rounded-[16px] border border-ink/[0.05] bg-ink/[0.03] px-4 py-3.5">
            <p className="text-[15px] font-medium leading-snug text-ink">
              {thoughtText}
            </p>
          </div>
        )}

        {!editMode && step === "when" && guidanceReason && (
          <div className="mb-[18px] flex items-start gap-2 rounded-2xl border border-primary/50 bg-[#FFFBE6] px-3.5 py-3">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-hidden
            />
            <p className="text-[14px] leading-[1.55] text-ink/75">
              {guidanceReason}
            </p>
          </div>
        )}

        {!editMode && step === "when" && (
          <>
            <h2 className="mb-1 text-[20px] font-black leading-[1.35] tracking-[-0.03em] text-ink">
              {t(
                "이 생각은 언제 다시 떠올리면 좋을까요?",
                "When would be a good moment to remember this?",
              )}
            </h2>
            {suggestionReason && (
              <p className="mb-3 text-[13px] leading-relaxed text-ink-soft">
                {suggestionReason}
              </p>
            )}
          </>
        )}

        {(step !== "when" || editMode) && (
          <input
            aria-label={t("일정 이름", "Schedule title")}
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder={t("뭐였더라?", "What was this again?")}
            className="mb-4 w-full rounded-[18px] border-0 bg-ink/[0.035] px-4 py-3.5 text-[16px] font-bold tracking-[-0.01em] text-ink placeholder:text-ink-soft/50 input-focus-ring focus:bg-ink/[0.05]"
          />
        )}

        <AnimatePresence mode="wait">
          {step === "when" && (
            <motion.div
              key="when"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={STEP_FADE}
            >
              <div className="mb-3 grid grid-cols-3 gap-2">
                {quickDates.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() =>
                      chooseDate(baseDateForWhen(option.key), option.key)
                    }
                    className={`touch-press rounded-full px-2 py-2.5 text-center text-[13px] font-bold ${
                      when === option.key
                        ? "bg-primary text-ink"
                        : "bg-ink/[0.03] text-ink-soft ring-1 ring-ink/[0.05]"
                    }`}
                  >
                    {t(option.ko, option.en)}
                  </button>
                ))}
              </div>

              <SchedulePickCalendar
                viewYear={calendarView.year}
                viewMonth={calendarView.month}
                selected={pickedCalendarDate}
                lang={locale}
                onSelectDay={(day) => {
                  tick();
                  chooseDate(
                    new Date(
                      calendarView.year,
                      calendarView.month,
                      day,
                      0,
                      0,
                      0,
                      0,
                    ),
                  );
                }}
                onPrevMonth={() => {
                  tick();
                  setCalendarView((current) =>
                    current.month === 0
                      ? { year: current.year - 1, month: 11 }
                      : { ...current, month: current.month - 1 },
                  );
                }}
                onNextMonth={() => {
                  tick();
                  setCalendarView((current) =>
                    current.month === 11
                      ? { year: current.year + 1, month: 0 }
                      : { ...current, month: current.month + 1 },
                  );
                }}
              />
            </motion.div>
          )}

          {step === "time" && (
            <motion.div
              key="time"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={STEP_FADE}
            >
              <button
                type="button"
                onClick={goBack}
                className="mb-3 text-[13px] font-semibold text-ink-soft/75 touch-press"
              >
                {t("← 날짜 다시 선택", "← Choose date again")}
              </button>

              <div className="mb-3 flex items-start gap-2 rounded-[16px] bg-primary/12 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                <CalendarDays size={17} className="mt-0.5 shrink-0 text-ink" />
                <p>
                  {t(
                    "시작일과 종료일을 먼저 확인하고, 시간이 필요할 때만 스위치를 켜세요.",
                    "Confirm the start and end dates, then turn on time only when needed.",
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <TimeBoundaryCard
                  title={t("시작", "Start")}
                  timeEnabled={startTimeEnabled}
                  switchLabel={t("시작 시간 설정", "Set start time")}
                  dateLabel={t("시작 날짜", "Start date")}
                  timeLabel={t("시작 시간", "Start time")}
                  date={startDate}
                  time={startTime}
                  minDate={editMode ? undefined : toDateValue(new Date())}
                  onTimeEnabledChange={setStartTimeEnabled}
                  onDateChange={(value) => {
                    setWhen("pick_date");
                    shiftStartDate(value);
                  }}
                  onTimeChange={updateStartTime}
                />

                <TimeBoundaryCard
                  title={t("종료", "End")}
                  timeEnabled={endTimeEnabled}
                  switchLabel={t("종료 시간 설정", "Set end time")}
                  dateLabel={t("종료 날짜", "End date")}
                  timeLabel={t("종료 시간", "End time")}
                  date={endDate}
                  time={endTime}
                  minDate={startDate}
                  onTimeEnabledChange={setEndTimeEnabled}
                  onDateChange={setEndDate}
                  onTimeChange={setEndTime}
                />
              </div>

              <div className="mt-3 rounded-[16px] border border-ink/[0.06] bg-white p-4">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-ink-soft/65">
                  {t("빠른 시간 설정", "Quick time")}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    [30, t("30분", "30m")],
                    [60, t("1시간", "1h")],
                    [120, t("2시간", "2h")],
                  ].map(([minutes, label]) => (
                    <button
                      key={String(minutes)}
                      type="button"
                      onClick={() => applyDuration(Number(minutes))}
                      className="touch-press rounded-full bg-ink/[0.045] px-2 py-2 text-[12px] font-bold text-ink-soft ring-1 ring-ink/[0.05] active:bg-primary/20 active:text-ink"
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={applyNextDay}
                    className="touch-press rounded-full bg-primary/18 px-2 py-2 text-[12px] font-bold text-ink ring-1 ring-primary/25 active:bg-primary/30"
                  >
                    {t("다음 날", "Next day")}
                  </button>
                </div>
              </div>

              <div
                className={`mt-3 rounded-[17px] border px-4 py-3.5 ${
                  validRange
                    ? "border-primary/35 bg-primary/13"
                    : "border-red-200 bg-red-50"
                }`}
                aria-live="polite"
              >
                <div className="flex items-start gap-2.5">
                  <Clock3
                    size={18}
                    className={validRange ? "mt-0.5 text-ink" : "mt-0.5 text-red-600"}
                  />
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.06em] text-ink-soft/65">
                      {t("최종 일정", "Final schedule")}
                    </p>
                    <p
                      className={`mt-1 text-[14px] font-bold leading-relaxed ${
                        validRange ? "text-ink" : "text-red-700"
                      }`}
                    >
                      {validRange
                        ? configSummary
                        : t(
                            "종료는 시작보다 뒤여야 해요.",
                            "The end must be after the start.",
                          )}
                    </p>
                  </div>
                </div>
              </div>

              <label className="mt-4 block rounded-[17px] border border-ink/[0.07] bg-ink/[0.025] p-4">
                <span className="mb-1.5 block text-[11px] font-bold text-ink-soft/70">
                  {t("반복", "Repeat")}
                </span>
                <select
                  aria-label={t("반복", "Repeat")}
                  value={repeat}
                  onChange={(event) =>
                    setRepeat(event.target.value as RepeatKey)
                  }
                  className="h-12 w-full rounded-[14px] border border-ink/[0.08] bg-white px-3 text-[15px] font-bold text-ink input-focus-ring"
                >
                  {REPEAT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {repeatLabel(option, t)}
                    </option>
                  ))}
                </select>
              </label>
            </motion.div>
          )}

          {step === "reminder" && (
            <motion.div
              key="reminder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={STEP_FADE}
            >
              <button
                type="button"
                onClick={goBack}
                className="mb-3 text-[13px] font-semibold text-ink-soft/75 touch-press"
              >
                {t("← 날짜와 시간", "← Date and time")}
              </button>

              <div
                className={`mb-4 overflow-hidden rounded-[22px] border p-5 ${
                  reminder === "off"
                    ? "border-ink/[0.08] bg-ink/[0.035]"
                    : "border-primary/45 bg-gradient-to-br from-primary/35 to-primary/12"
                }`}
                data-testid="focus-reminder-preview"
                data-reminder={reminder === "off" ? "off" : "on"}
              >
                <div className="flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.06em] text-ink-soft/70">
                  {reminder === "off" ? (
                    <BellOff size={17} strokeWidth={2.3} />
                  ) : (
                    <BellRing size={18} strokeWidth={2.5} className="text-ink" />
                  )}
                  {reminder === "off"
                    ? t("알림 없음", "No reminder")
                    : t("일정 알림 켜짐", "Schedule reminder on")}
                </div>
                <p className="mt-3 text-[23px] font-black leading-tight tracking-[-0.035em] text-ink">
                  {reminder === "off" || !alarmAt
                    ? t("알리지 않아요", "No alert will be sent")
                    : formatAlarmMoment(alarmAt, locale)}
                </p>
                <p className="mt-2 text-[13px] font-medium leading-relaxed text-ink-soft">
                  {configSummary}
                </p>
              </div>

              <div className="space-y-2">
                {REMINDER_OPTIONS.map((option) => (
                  <Choice
                    key={option.key}
                    active={reminder === option.key}
                    onClick={() => setReminder(option.key)}
                  >
                    {t(option.ko, option.en)}
                  </Choice>
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
            onClick={goNext}
            disabled={!pickedCalendarDate}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
          >
            {pickedCalendarDate
              ? formatPickDateCta(pickedCalendarDate, locale)
              : t("날짜 선택", "Choose a date")}
          </button>
        )}

        {step === "time" && (
          <button
            type="button"
            onClick={goNext}
            disabled={!validRange}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
          >
            {t("알림 정하기", "Set a reminder")}
          </button>
        )}

        {step === "reminder" && (
          <button
            type="button"
            onClick={handleDone}
            disabled={!validRange}
            className="touch-press flex w-full flex-col items-center justify-center gap-1 rounded-full bg-ink py-3.5 text-white shadow-[0_5px_22px_-5px_rgba(0,0,0,0.38)] disabled:opacity-40"
          >
            <span className="text-[16px] font-bold tracking-[-0.01em]">
              {t("일정에 추가", "Add to schedule")}
            </span>
            <span className="max-w-full truncate px-2 text-[11px] font-semibold text-white/70">
              {reminder === "off" || !alarmAt
                ? `${momentPreview} · ${t("알림 없음", "No reminder")}`
                : `${momentPreview} · ${formatAlarmMoment(alarmAt, locale)}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
