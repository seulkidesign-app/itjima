import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WheelPicker } from "./WheelPicker";
import { useT, useLang } from "@/lib/i18n";
import {
  type WhenKey,
  type ReminderKey,
  type RepeatKey,
  baseDateForWhen,
  applyTimeToDate,
  reminderToMinutes,
  inferWhenFromDate,
  MINUTE_STEPS,
  snapMinute,
  endOfDay,
  defaultEndFromStart,
  repeatKeyToRule,
  repeatRuleToKey,
  repeatLabel,
  startOfDay,
  formatSuggestedMoment,
} from "@/lib/scheduleChoices";
import {
  inferScheduleAllDayFlags,
  resolveScheduleAllDayFlags,
  formatScheduleConfigSummary,
} from "@/lib/scheduleTime";
import type { RepeatRule } from "@/lib/store";
import { EASE_OUT_APP } from "@/lib/motion";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

const STEP_FADE = { duration: 0.28, ease: EASE_OUT_APP };

type Step = "when" | "time" | "reminder";

export type ScheduleConfirmOptions = {
  reminderMinutes: number | null;
  /** Both sides all-day — kept for callers that still read a single flag. */
  allDay: boolean;
  startAllDay: boolean;
  endAllDay: boolean;
  repeat: RepeatRule | null;
};

type Props = {
  open: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialStartAllDay?: boolean;
  initialEndAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  /** When set, shows the quiet “we picked a moment” hint (detect / default). */
  suggestedStart?: Date;
  /** One calm reason from date detection — no AI. */
  suggestionReason?: string | null;
  thoughtText?: string;
  /** High-confidence AI reason banner — no date claims. */
  guidanceReason?: string | null;
  editMode?: boolean;
  onConfirm: (start: Date, end: Date, options: ScheduleConfirmOptions) => void;
};

function Chip({
  active,
  onClick,
  children,
  large,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        tick();
        onClick();
      }}
      className={`chip-moment w-full rounded-full text-left font-medium transition-colors duration-200 ${
        large ? "px-4 py-3 text-[16px]" : "px-3 py-2.5 text-[13px]"
      } ${
        active
          ? "bg-primary text-ink"
          : "bg-ink/[0.03] text-ink-soft/85 ring-1 ring-ink/[0.05]"
      }`}
    >
      {children}
    </button>
  );
}

function IosSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
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
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-primary" : "bg-ink/15"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_1px_4px_oklch(0_0_0/0.18)] transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[16px] bg-ink/[0.04] ring-1 ring-ink/[0.05]">
      {children}
    </div>
  );
}

function SettingsRow({
  label,
  trailing,
  onClick,
  border,
}: {
  label: string;
  trailing: ReactNode;
  onClick?: () => void;
  border?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left ${
        border ? "border-b border-ink/[0.06]" : ""
      } ${onClick ? "touch-press active:bg-ink/[0.03]" : ""}`}
    >
      <span className="text-[16px] font-medium text-ink">{label}</span>
      {trailing}
    </Tag>
  );
}

const REPEAT_OPTIONS: RepeatKey[] = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatPickDateCta(d: Date, lang: "ko" | "en"): string {
  if (lang === "en") {
    const date = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const wd = d.toLocaleDateString("en-US", { weekday: "short" });
    return `${date} (${wd}) selected`;
  }
  const wd = d.toLocaleDateString("ko-KR", { weekday: "short" });
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${wd}) 선택`;
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

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mt-3 overflow-hidden rounded-[16px] bg-ink/[0.04] p-3 ring-1 ring-ink/[0.05]">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="touch-press flex h-8 w-8 items-center justify-center rounded-full text-ink-soft active:bg-ink/[0.06]"
          aria-label={lang === "en" ? "Previous month" : "이전 달"}
        >
          <ChevronLeft size={18} strokeWidth={2.25} />
        </button>
        <span className="text-[15px] font-semibold text-ink">{monthLabel}</span>
        <button
          type="button"
          onClick={onNextMonth}
          className="touch-press flex h-8 w-8 items-center justify-center rounded-full text-ink-soft active:bg-ink/[0.06]"
          aria-label={lang === "en" ? "Next month" : "다음 달"}
        >
          <ChevronRight size={18} strokeWidth={2.25} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-ink-soft/70">
        {weekdays.map((label) => (
          <span key={label} className="py-1">
            {label}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} aria-hidden />;
          }
          const date = new Date(viewYear, viewMonth, day);
          date.setHours(0, 0, 0, 0);
          const isPast = date.getTime() < today.getTime();
          const isToday = sameCalendarDay(date, today);
          const isSelected = selected ? sameCalendarDay(date, selected) : false;
          const weekday = date.getDay();
          const isWeekend = weekday === 0 || weekday === 6;

          return (
            <button
              key={day}
              type="button"
              disabled={isPast}
              onClick={() => onSelectDay(day)}
              className={`touch-press flex h-10 items-center justify-center rounded-[12px] text-[13px] font-semibold tabular-nums transition-colors ${
                isPast
                  ? "cursor-not-allowed text-ink-soft/25"
                  : isSelected
                    ? "bg-primary text-ink"
                    : isToday
                      ? "text-ink ring-1 ring-ink/10"
                      : isWeekend
                        ? "text-ink-soft/55 active:bg-ink/[0.05]"
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
  onConfirm,
}: Props) {
  const t = useT();
  const { lang } = useLang();

  const [step, setStep] = useState<Step>("when");
  const [when, setWhen] = useState<WhenKey>("today");
  const [startAllDay, setStartAllDay] = useState(false);
  const [endAllDay, setEndAllDay] = useState(false);
  const [repeat, setRepeat] = useState<RepeatKey>("none");
  const [reminder, setReminder] = useState<ReminderKey>("30m");
  const [calendarView, setCalendarView] = useState(() => {
    const now = new Date();
    return { y: now.getFullYear(), m: now.getMonth() };
  });
  const [pickedCalendarDate, setPickedCalendarDate] = useState<Date | null>(
    null,
  );
  const [startTime, setStartTime] = useState<[number, number]>([9, 0]);
  const [endTime, setEndTime] = useState<[number, number]>([10, 0]);

  useEffect(() => {
    if (!open) return;
    const seed = initialStart ?? new Date();
    const seedEnd = initialEnd ?? defaultEndFromStart(seed);
    const seedWhen = inferWhenFromDate(seed);
    setWhen(seedWhen);
    if (seedWhen === "pick_date") {
      const dayStart = startOfDay(seed);
      setPickedCalendarDate(dayStart);
      setCalendarView({ y: seed.getFullYear(), m: seed.getMonth() });
    } else {
      setPickedCalendarDate(null);
      const now = new Date();
      setCalendarView({ y: now.getFullYear(), m: now.getMonth() });
    }
    const resolved =
      initialStartAllDay !== undefined || initialEndAllDay !== undefined
        ? {
            startAllDay: initialStartAllDay ?? false,
            endAllDay: initialEndAllDay ?? false,
          }
        : editMode && initialStart && initialEnd
          ? resolveScheduleAllDayFlags({
              start_time: seed.toISOString(),
              end_time: seedEnd.toISOString(),
              all_day: initialAllDay,
              start_all_day: initialStartAllDay,
              end_all_day: initialEndAllDay,
            })
          : inferScheduleAllDayFlags(seed, seedEnd, initialAllDay);
    setStartAllDay(resolved.startAllDay);
    setEndAllDay(resolved.endAllDay);
    setRepeat(repeatRuleToKey(initialRepeat));
    setStartTime([seed.getHours(), snapMinute(seed.getMinutes())]);
    setEndTime([seedEnd.getHours(), snapMinute(seedEnd.getMinutes())]);
    setReminder("30m");
    setStep("when");
  }, [
    open,
    initialStart?.getTime(),
    initialEnd?.getTime(),
    initialAllDay,
    initialStartAllDay,
    initialEndAllDay,
    initialRepeat,
    editMode,
  ]);

  const buildBaseDate = (): Date => {
    let base = baseDateForWhen(when);
    if (when === "pick_date") {
      if (!pickedCalendarDate) {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      }
      return startOfDay(pickedCalendarDate);
    }
    return base;
  };

  const buildRange = (): { start: Date; end: Date } => {
    const base = buildBaseDate();
    const start = startAllDay
      ? startOfDay(base)
      : applyTimeToDate(base, "custom", startTime[0], startTime[1]);

    let end: Date;
    if (endAllDay) {
      end = endOfDay(startAllDay ? base : start);
    } else {
      end = applyTimeToDate(base, "custom", endTime[0], endTime[1]);
      if (end.getTime() <= start.getTime()) {
        end = defaultEndFromStart(start);
      }
    }
    return { start, end };
  };

  const bothAllDay = startAllDay && endAllDay;

  const { start, end } = buildRange();

  const momentPreview = formatSuggestedMoment(
    start,
    lang === "en" ? "en" : "ko",
    bothAllDay,
  );

  const configSummary = formatScheduleConfigSummary(
    startAllDay,
    endAllDay,
    start,
    end,
    lang === "en" ? "en" : "ko",
  );

  const whenOptions: { key: WhenKey; label: string }[] = [
    { key: "today", label: t("오늘", "Today") },
    { key: "tomorrow", label: t("내일", "Tomorrow") },
    { key: "weekend", label: t("이번 주말", "This weekend") },
    { key: "next_week", label: t("다음 주", "Next week") },
    { key: "pick_date", label: t("날짜 선택", "Pick date") },
  ];

  const timeColDef = [
    {
      label: t("시", "Hr"),
      values: Array.from({ length: 24 }, (_, i) => i),
      pad: 2,
    },
    { label: t("분", "Min"), values: [...MINUTE_STEPS], pad: 2 },
  ];

  const nextLabel =
    step === "when"
      ? t("시간 보기", "Pick a time")
      : t("알림 정하기", "Set a reminder");

  const canProceedWhen =
    step !== "when" || when !== "pick_date" || pickedCalendarDate != null;

  const whenStepCtaLabel =
    step === "when" && when === "pick_date" && pickedCalendarDate
      ? formatPickDateCta(pickedCalendarDate, lang === "en" ? "en" : "ko")
      : step === "when" && when === "pick_date"
        ? t("날짜를 선택해 주세요", "Choose a date")
        : nextLabel;

  const goNext = () => {
    if (step === "when" && when === "pick_date" && !pickedCalendarDate) return;
    if (step === "when") setStep("time");
    else if (step === "time") setStep("reminder");
  };

  const goBack = () => {
    if (step === "reminder") setStep("time");
    else if (step === "time") setStep("when");
  };

  const handleStartTimeChange = (v: [number, number]) => {
    setStartTime(v);
    const base = buildBaseDate();
    const nextStart = applyTimeToDate(base, "custom", v[0], v[1]);
    const curEnd = applyTimeToDate(base, "custom", endTime[0], endTime[1]);
    if (curEnd.getTime() <= nextStart.getTime()) {
      const bumped = defaultEndFromStart(nextStart);
      setEndTime([bumped.getHours(), snapMinute(bumped.getMinutes())]);
    }
  };

  const handleDone = () => {
    confirmHaptic();
    let { start: s, end: e } = buildRange();
    if (!editMode && !startAllDay && s.getTime() < Date.now() - 60 * 60 * 1000) {
      s = new Date(s);
      s.setFullYear(s.getFullYear() + 1);
      e = bothAllDay ? endOfDay(s) : defaultEndFromStart(s);
    }
    onConfirm(s, e, {
      reminderMinutes: reminderToMinutes(reminder),
      allDay: bothAllDay,
      startAllDay,
      endAllDay,
      repeat: repeatKeyToRule(repeat),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
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
          <h2 className="mb-3.5 text-[17px] font-bold leading-[1.45] tracking-[-0.02em] text-ink">
            {t(
              "이 생각은 언제 다시 떠올리면 좋을까요?",
              "When would be a good moment to remember this?",
            )}
          </h2>
        )}

        {(step !== "when" || editMode) && (
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t("무엇을 기억할까요", "What to remember")}
            className="mb-4 w-full rounded-[18px] border-0 bg-ink/[0.035] px-4 py-3 text-[16px] font-medium tracking-[-0.01em] text-ink placeholder:text-ink-soft/50 input-focus-ring focus:bg-ink/[0.05]"
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
              <div className="flex flex-col gap-1.5">
                {whenOptions.map(({ key, label }) => (
                  <Chip
                    key={key}
                    large
                    active={when === key}
                    onClick={() => {
                      if (key !== "pick_date") {
                        setPickedCalendarDate(null);
                      } else if (when !== "pick_date") {
                        setPickedCalendarDate(null);
                      }
                      setWhen(key);
                    }}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
              {when === "pick_date" && (
                <SchedulePickCalendar
                  viewYear={calendarView.y}
                  viewMonth={calendarView.m}
                  selected={pickedCalendarDate}
                  lang={lang === "en" ? "en" : "ko"}
                  onSelectDay={(day) => {
                    tick();
                    const picked = new Date(
                      calendarView.y,
                      calendarView.m,
                      day,
                      0,
                      0,
                      0,
                      0,
                    );
                    setPickedCalendarDate(picked);
                    setWhen("pick_date");
                  }}
                  onPrevMonth={() => {
                    tick();
                    setCalendarView((v) => {
                      if (v.m === 0) return { y: v.y - 1, m: 11 };
                      return { y: v.y, m: v.m - 1 };
                    });
                  }}
                  onNextMonth={() => {
                    tick();
                    setCalendarView((v) => {
                      if (v.m === 11) return { y: v.y + 1, m: 0 };
                      return { y: v.y, m: v.m + 1 };
                    });
                  }}
                />
              )}
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
                className="mb-4 text-[13px] font-medium text-ink-soft/70 touch-press"
              >
                {t("← 언제", "← When")}
              </button>

              <SettingsGroup>
                <SettingsRow
                  label={t("시작", "Start")}
                  trailing={
                    <IosSwitch
                      checked={startAllDay}
                      onChange={setStartAllDay}
                      label={t("하루 종일", "All-day")}
                    />
                  }
                  border={!startAllDay}
                />
                {!startAllDay && (
                  <div className="border-b border-ink/[0.06] px-4 py-3">
                    <WheelPicker
                      columns={timeColDef}
                      value={startTime}
                      onChange={(v) => {
                        if (v.length >= 2) handleStartTimeChange([v[0], v[1]]);
                      }}
                    />
                  </div>
                )}
                <SettingsRow
                  label={t("종료", "End")}
                  trailing={
                    <IosSwitch
                      checked={endAllDay}
                      onChange={setEndAllDay}
                      label={t("하루 종일", "All-day")}
                    />
                  }
                  border={!endAllDay}
                />
                {!endAllDay && (
                  <div className="px-4 py-3">
                    <WheelPicker
                      columns={timeColDef}
                      value={endTime}
                      onChange={(v) => {
                        if (v.length >= 2) setEndTime([v[0], v[1]]);
                      }}
                    />
                  </div>
                )}
              </SettingsGroup>

              <p className="mt-3 px-1 text-[14px] font-medium leading-[1.5] text-ink-soft">
                {configSummary}
              </p>

              <div className="mt-4">
                <SettingsGroup>
                  <SettingsRow
                    label={t("반복", "Repeat")}
                    trailing={
                      <IosSwitch
                        checked={repeat !== "none"}
                        onChange={(v) => {
                          tick();
                          setRepeat(v ? "daily" : "none");
                        }}
                        label={t("반복", "Repeat")}
                      />
                    }
                    border={repeat === "none"}
                  />
                  {repeat !== "none" && (
                    <>
                      {REPEAT_OPTIONS.filter((k) => k !== "none").map(
                        (key, i, arr) => {
                          const active = repeat === key;
                          const isLast = i === arr.length - 1;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                tick();
                                setRepeat(key);
                              }}
                              className={`flex w-full items-center justify-between px-4 py-3.5 text-left touch-press active:bg-ink/[0.03] ${
                                !isLast ? "border-b border-ink/[0.06]" : ""
                              }`}
                            >
                              <span
                                className={`text-[16px] ${
                                  active
                                    ? "font-semibold text-ink"
                                    : "font-medium text-ink"
                                }`}
                              >
                                {repeatLabel(key, t)}
                              </span>
                              {active && (
                                <Check
                                  size={18}
                                  strokeWidth={2.75}
                                  className="text-ink"
                                />
                              )}
                            </button>
                          );
                        },
                      )}
                    </>
                  )}
                </SettingsGroup>
              </div>
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
                className="mb-4 text-[13px] font-medium text-ink-soft/70 touch-press"
              >
                {t("← 시간", "← Time")}
              </button>
              <div className="flex flex-col gap-1.5 pb-2">
                {(
                  [
                    ["at", t("정각", "At time")],
                    ["5m", t("5분 전", "5 min")],
                    ["10m", t("10분 전", "10 min")],
                    ["30m", t("30분 전", "30 min")],
                    ["1h", t("1시간 전", "1 hr")],
                    ["1d", t("하루 전", "1 day")],
                    ["off", t("없음", "Off")],
                  ] as const
                ).map(([key, label]) => (
                  <Chip
                    key={key}
                    large
                    active={reminder === key}
                    onClick={() => setReminder(key as ReminderKey)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="sheet-cta-bar shrink-0 border-t border-ink/[0.08] bg-white/98 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        {step === "reminder" ? (
          <button
            type="button"
            onClick={handleDone}
            className="touch-press flex w-full flex-col items-center justify-center gap-1 rounded-full bg-ink py-4 text-white shadow-[0_4px_20px_-4px_oklch(0_0_0/0.35)]"
          >
            <span className="text-[16px] font-semibold tracking-[-0.01em]">
              {t("그때 맡겨둘게요", "I'll leave it for then")}
            </span>
            <span className="text-[12px] font-medium text-white/70">
              {momentPreview}
              {repeat !== "none" ? ` · ${repeatLabel(repeat, t)}` : ""}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={step === "when" && !canProceedWhen}
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-medium text-white disabled:opacity-40"
          >
            {step === "when" ? whenStepCtaLabel : nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
