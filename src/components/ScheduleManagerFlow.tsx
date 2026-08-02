import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BellOff, BellRing, CalendarDays, Check, Clock3 } from "lucide-react";
import { useT, useLang } from "@/lib/i18n";
import {
  type ReminderKey,
  type RepeatKey,
  type WhenKey,
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

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

type Step = "date" | "range" | "reminder";

type ConfirmOptions = {
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
  onConfirm: (start: Date, end: Date, options: ConfirmOptions) => void;
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
  const [hours, minutes] = timeValue.split(":").map(Number);
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

function localEndOfDay(value: string): Date {
  const date = parseDate(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

function calendarDayDiff(startValue: string, endValue: string): number {
  if (!startValue || !endValue) return 0;
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  const startOrdinal = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endOrdinal = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.max(0, Math.round((endOrdinal - startOrdinal) / DAY_MS));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(date: Date, lang: "ko" | "en"): string {
  return date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(date: Date, lang: "ko" | "en"): string {
  return date.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(milliseconds: number, lang: "ko" | "en"): string {
  const minutes = Math.max(1, Math.round(milliseconds / MINUTE_MS));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(lang === "ko" ? `${days}일` : `${days}d`);
  if (hours) parts.push(lang === "ko" ? `${hours}시간` : `${hours}h`);
  if (rest || parts.length === 0) {
    parts.push(lang === "ko" ? `${rest}분` : `${rest}m`);
  }
  return parts.join(" ");
}

function formatRange(
  start: Date,
  end: Date,
  startAllDay: boolean,
  endAllDay: boolean,
  lang: "ko" | "en",
): string {
  if (startAllDay && endAllDay) {
    const includedDays =
      Math.round(
        (startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS,
      ) + 1;
    if (sameDay(start, end)) {
      return lang === "ko"
        ? `${formatDate(start, lang)} · 하루 종일`
        : `${formatDate(start, lang)} · All day`;
    }
    return lang === "ko"
      ? `${formatDate(start, lang)} → ${formatDate(end, lang)} · ${includedDays}일`
      : `${formatDate(start, lang)} → ${formatDate(end, lang)} · ${includedDays} days`;
  }

  if (!startAllDay && !endAllDay) {
    const duration = formatDuration(end.getTime() - start.getTime(), lang);
    if (sameDay(start, end)) {
      return `${formatDate(start, lang)} · ${formatTime(start, lang)}–${formatTime(
        end,
        lang,
      )} · ${duration}`;
    }
    return `${formatDate(start, lang)} ${formatTime(
      start,
      lang,
    )} → ${formatDate(end, lang)} ${formatTime(end, lang)} · ${duration}`;
  }

  const allDayLabel = lang === "ko" ? "하루 종일" : "All day";
  const startLabel = `${formatDate(start, lang)} · ${
    startAllDay ? allDayLabel : formatTime(start, lang)
  }`;
  const endLabel = `${formatDate(end, lang)} · ${
    endAllDay ? allDayLabel : formatTime(end, lang)
  }`;
  return `${startLabel} → ${endLabel}`;
}

function formatAlarmMoment(date: Date, lang: "ko" | "en"): string {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  if (date >= today && date < tomorrow) {
    return lang === "ko"
      ? `오늘 ${formatTime(date, lang)}`
      : `Today at ${formatTime(date, lang)}`;
  }
  if (date >= tomorrow && date < dayAfter) {
    return lang === "ko"
      ? `내일 ${formatTime(date, lang)}`
      : `Tomorrow at ${formatTime(date, lang)}`;
  }
  return lang === "ko"
    ? `${formatDate(date, lang)} ${formatTime(date, lang)}`
    : `${formatDate(date, lang)} at ${formatTime(date, lang)}`;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12px] font-bold text-ink-soft/75">
      {children}
    </span>
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
    <label className="min-w-0 flex-1">
      <FieldLabel>{label}</FieldLabel>
      <input
        aria-label={label}
        type={type}
        value={value}
        min={min}
        step={type === "time" ? 60 : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-[14px] border border-ink/[0.09] bg-white px-3 text-[15px] font-bold tabular-nums text-ink shadow-[0_1px_2px_rgba(0,0,0,0.02)] input-focus-ring"
      />
    </label>
  );
}

function Switch({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
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
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.18)] transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function Choice({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
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
          ? "bg-primary/30 text-ink ring-1 ring-primary/45"
          : "bg-ink/[0.035] text-ink ring-1 ring-ink/[0.05]"
      }`}
    >
      <span>{children}</span>
      {active && <Check size={17} strokeWidth={2.8} />}
    </button>
  );
}

function BoundaryCard({
  index,
  title,
  allDay,
  allDayLabel,
  dateLabel,
  timeLabel,
  date,
  time,
  minDate,
  onAllDayChange,
  onDateChange,
  onTimeChange,
}: {
  index: number;
  title: string;
  allDay: boolean;
  allDayLabel: string;
  dateLabel: string;
  timeLabel: string;
  date: string;
  time: string;
  minDate?: string;
  onAllDayChange: (value: boolean) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}) {
  return (
    <section className="rounded-[20px] border border-ink/[0.09] bg-white p-4 shadow-[0_12px_30px_-28px_rgba(0,0,0,0.4)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-black text-ink ${
              index === 1 ? "bg-primary/40" : "bg-ink/[0.08]"
            }`}
          >
            {index}
          </span>
          <h3 className="text-[16px] font-bold text-ink">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-ink-soft">
            {allDayLabel}
          </span>
          <Switch
            checked={allDay}
            label={allDayLabel}
            onChange={onAllDayChange}
          />
        </div>
      </div>
      <div className={`grid gap-3 ${allDay ? "grid-cols-1" : "grid-cols-2"}`}>
        <DateTimeField
          label={dateLabel}
          type="date"
          value={date}
          min={minDate}
          onChange={onDateChange}
        />
        {!allDay && (
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

const reminderOptions: Array<{
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

const repeatOptions: RepeatKey[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

export function ScheduleManagerFlow({
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
  const [step, setStep] = useState<Step>("date");
  const [when, setWhen] = useState<WhenKey>("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [startAllDay, setStartAllDay] = useState(false);
  const [endAllDay, setEndAllDay] = useState(false);
  const [repeat, setRepeat] = useState<RepeatKey>("none");
  const [reminder, setReminder] = useState<ReminderKey>("at");

  useEffect(() => {
    if (!open) return;
    const seedStart = initialStart ?? suggestedStart ?? new Date();
    const seedEnd = initialEnd ?? defaultEndFromStart(seedStart);
    const flags = resolveScheduleAllDayFlags({
      start_time: seedStart.toISOString(),
      end_time: seedEnd.toISOString(),
      all_day: initialAllDay,
      start_all_day: initialStartAllDay,
      end_all_day: initialEndAllDay,
    });

    setWhen(inferWhenFromDate(seedStart));
    setStartDate(toDateValue(seedStart));
    setEndDate(toDateValue(seedEnd));
    setStartTime(toTimeValue(seedStart));
    setEndTime(toTimeValue(seedEnd));
    setStartAllDay(flags.startAllDay);
    setEndAllDay(flags.endAllDay);
    setRepeat(repeatRuleToKey(initialRepeat));
    setReminder(
      editMode
        ? initialReminderKey ?? "off"
        : defaultReminderForNewSchedule(
            scheduleHasSpecificTime(flags.startAllDay, flags.endAllDay),
          ),
    );
    setStep("date");
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
    return {
      start: startAllDay
        ? parseDate(startDate)
        : parseDateTime(startDate, startTime),
      end: endAllDay
        ? localEndOfDay(endDate)
        : parseDateTime(endDate, endTime),
    };
  }, [
    endAllDay,
    endDate,
    endTime,
    startAllDay,
    startDate,
    startTime,
  ]);

  const validRange = Boolean(
    range &&
      range.end.getTime() > range.start.getTime() &&
      parseDate(endDate).getTime() >= parseDate(startDate).getTime(),
  );

  const reminderMinutes = reminderToMinutes(reminder);
  const alarmAt =
    range && reminderMinutes != null
      ? new Date(range.start.getTime() - reminderMinutes * MINUTE_MS)
      : null;
  const minimumDate = editMode ? undefined : toDateValue(new Date());

  const shiftStartDate = (nextDate: string) => {
    if (!nextDate) return;
    const span = calendarDayDiff(startDate, endDate);
    setStartDate(nextDate);
    setEndDate(addDays(nextDate, span));
  };

  const applyQuickDate = (key: WhenKey) => {
    setWhen(key);
    shiftStartDate(toDateValue(startOfDay(baseDateForWhen(key))));
  };

  const updateStartDate = (value: string) => {
    setWhen("pick_date");
    shiftStartDate(value);
  };

  const updateStartTime = (value: string) => {
    if (!value) return;
    const duration =
      range && validRange && !startAllDay && !endAllDay
        ? Math.max(HOUR_MS, range.end.getTime() - range.start.getTime())
        : HOUR_MS;
    const nextStart = parseDateTime(startDate, value);
    const nextEnd = new Date(nextStart.getTime() + duration);
    setStartTime(value);
    if (!endAllDay) {
      setEndDate(toDateValue(nextEnd));
      setEndTime(toTimeValue(nextEnd));
    }
  };

  const applyDuration = (minutes: number) => {
    if (!range || startAllDay || endAllDay) return;
    const nextEnd = new Date(range.start.getTime() + minutes * MINUTE_MS);
    setEndDate(toDateValue(nextEnd));
    setEndTime(toTimeValue(nextEnd));
  };

  const applyNextDay = () => {
    if (!range || startAllDay || endAllDay) return;
    const nextEnd = new Date(range.start);
    nextEnd.setDate(nextEnd.getDate() + 1);
    setEndDate(toDateValue(nextEnd));
    setEndTime(toTimeValue(nextEnd));
  };

  const changeStartAllDay = (value: boolean) => {
    setStartAllDay(value);
    if (!editMode) {
      setReminder(
        defaultReminderForNewSchedule(
          scheduleHasSpecificTime(value, endAllDay),
        ),
      );
    }
  };

  const changeEndAllDay = (value: boolean) => {
    setEndAllDay(value);
    if (!editMode) {
      setReminder(
        defaultReminderForNewSchedule(
          scheduleHasSpecificTime(startAllDay, value),
        ),
      );
    }
  };

  const finish = () => {
    if (!range || !validRange) return;
    confirmHaptic();
    onConfirm(range.start, range.end, {
      reminderMinutes,
      allDay: startAllDay && endAllDay,
      startAllDay,
      endAllDay,
      repeat: repeatKeyToRule(repeat),
    });
  };

  const quickDates: Array<{ key: WhenKey; ko: string; en: string }> = [
    { key: "today", ko: "오늘", en: "Today" },
    { key: "tomorrow", ko: "내일", en: "Tomorrow" },
    { key: "weekend", ko: "이번 주말", en: "This weekend" },
  ];
  const allDayLabel = t("하루 종일", "All-day");

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="schedule-manager-flow">
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {step === "date" && (
          <div>
            <h2 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
              {t("언제 시작하나요?", "When does it start?")}
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
              {suggestionReason ??
                t(
                  "먼저 시작 날짜만 고르세요. 종료는 다음 화면에서 바로 정할 수 있어요.",
                  "Pick the start date first. Set the end on the next screen.",
                )}
            </p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {quickDates.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => applyQuickDate(option.key)}
                  className={`touch-press rounded-full px-2 py-2.5 text-[13px] font-bold ${
                    when === option.key
                      ? "bg-primary text-ink"
                      : "bg-ink/[0.035] text-ink-soft ring-1 ring-ink/[0.05]"
                  }`}
                >
                  {t(option.ko, option.en)}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[20px] border border-ink/[0.08] bg-ink/[0.025] p-4">
              <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-ink">
                <CalendarDays size={18} strokeWidth={2.3} />
                {t("시작 날짜", "Start date")}
              </div>
              <DateTimeField
                label={t("날짜", "Date")}
                type="date"
                value={startDate}
                min={minimumDate}
                onChange={updateStartDate}
              />
            </div>
          </div>
        )}

        {step === "range" && (
          <div>
            <button
              type="button"
              onClick={() => setStep("date")}
              className="mb-3 text-[13px] font-semibold text-ink-soft/75 touch-press"
            >
              {t("← 시작 날짜", "← Start date")}
            </button>

            <input
              aria-label={t("일정 이름", "Schedule title")}
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={t("뭐였더라?", "What was this again?")}
              className="mb-4 w-full rounded-[16px] border border-ink/[0.08] bg-white px-4 py-3.5 text-[16px] font-bold text-ink placeholder:text-ink-soft/45 input-focus-ring"
            />

            <div className="space-y-3">
              <BoundaryCard
                index={1}
                title={t("시작", "Start")}
                allDay={startAllDay}
                allDayLabel={allDayLabel}
                dateLabel={t("시작 날짜", "Start date")}
                timeLabel={t("시작 시각", "Start time")}
                date={startDate}
                time={startTime}
                minDate={minimumDate}
                onAllDayChange={changeStartAllDay}
                onDateChange={updateStartDate}
                onTimeChange={updateStartTime}
              />

              <BoundaryCard
                index={2}
                title={t("종료", "End")}
                allDay={endAllDay}
                allDayLabel={allDayLabel}
                dateLabel={t("종료 날짜", "End date")}
                timeLabel={t("종료 시각", "End time")}
                date={endDate}
                time={endTime}
                minDate={startDate || minimumDate}
                onAllDayChange={changeEndAllDay}
                onDateChange={setEndDate}
                onTimeChange={setEndTime}
              />
            </div>

            {!startAllDay && !endAllDay && (
              <div className="mt-3 rounded-[17px] border border-ink/[0.07] bg-ink/[0.025] p-4">
                <FieldLabel>{t("빠른 종료", "Quick end")}</FieldLabel>
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
            )}

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
                    {range && validRange
                      ? formatRange(
                          range.start,
                          range.end,
                          startAllDay,
                          endAllDay,
                          locale,
                        )
                      : t(
                          "종료는 시작보다 뒤여야 해요.",
                          "The end must be after the start.",
                        )}
                  </p>
                </div>
              </div>
            </div>

            <label className="mt-4 block rounded-[17px] border border-ink/[0.08] bg-ink/[0.025] p-4">
              <FieldLabel>{t("반복", "Repeat")}</FieldLabel>
              <select
                aria-label={t("반복", "Repeat")}
                value={repeat}
                onChange={(event) => setRepeat(event.target.value as RepeatKey)}
                className="h-12 w-full rounded-[14px] border border-ink/[0.08] bg-white px-3 text-[15px] font-bold text-ink input-focus-ring"
              >
                {repeatOptions.map((option) => (
                  <option key={option} value={option}>
                    {repeatLabel(option, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {step === "reminder" && (
          <div>
            <button
              type="button"
              onClick={() => setStep("range")}
              className="mb-3 text-[13px] font-semibold text-ink-soft/75 touch-press"
            >
              {t("← 일정 시간", "← Schedule time")}
            </button>

            <div
              className={`mb-4 overflow-hidden rounded-[22px] border p-5 shadow-[0_18px_46px_-36px_rgba(0,0,0,0.5)] ${
                reminder === "off"
                  ? "border-ink/[0.08] bg-ink/[0.035]"
                  : "border-primary/45 bg-gradient-to-br from-primary/35 to-primary/12"
              }`}
              data-testid="reminder-preview"
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
                {reminder === "off"
                  ? t(
                      "일정은 저장되지만 기기 알림은 울리지 않아요.",
                      "The schedule is saved, but no device alert will sound.",
                    )
                  : t(
                      "저장할 때 이 기기의 알림 권한도 함께 확인해요.",
                      "We'll verify this device's notification access when you save.",
                    )}
              </p>
            </div>

            {range && (
              <div className="mb-4 rounded-[15px] border border-ink/[0.07] bg-white px-4 py-3 text-[13px] font-semibold leading-relaxed text-ink-soft">
                {formatRange(
                  range.start,
                  range.end,
                  startAllDay,
                  endAllDay,
                  locale,
                )}
              </div>
            )}

            <div className="space-y-2">
              {reminderOptions.map((option) => (
                <Choice
                  key={option.key}
                  active={reminder === option.key}
                  onClick={() => setReminder(option.key)}
                >
                  {t(option.ko, option.en)}
                </Choice>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="sheet-cta-bar shrink-0 border-t border-ink/[0.08] bg-white/98 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
        {step === "date" && (
          <button
            type="button"
            onClick={() => setStep("range")}
            disabled={!startDate}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
          >
            {t("시간과 종료 정하기", "Add time and end")}
          </button>
        )}
        {step === "range" && (
          <button
            type="button"
            onClick={() => setStep("reminder")}
            disabled={!validRange}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white disabled:opacity-40"
          >
            {t("알림 정하기", "Set a reminder")}
          </button>
        )}
        {step === "reminder" && (
          <button
            type="button"
            onClick={finish}
            disabled={!validRange}
            className="touch-press flex w-full flex-col items-center justify-center gap-1 rounded-full bg-ink py-3.5 text-white shadow-[0_5px_22px_-5px_rgba(0,0,0,0.38)] disabled:opacity-40"
          >
            <span className="text-[16px] font-bold tracking-[-0.01em]">
              {t("일정에 추가", "Add to schedule")}
            </span>
            <span className="max-w-full truncate px-2 text-[11px] font-semibold text-white/70">
              {reminder === "off" || !alarmAt
                ? t("알림 없음", "No reminder")
                : `${t("알림", "Alert")} · ${formatAlarmMoment(alarmAt, locale)}`}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
