import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft } from "lucide-react";
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
import type { RepeatRule } from "@/lib/store";
import { MOTION_STEP } from "@/lib/motionLanguage";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

type Step = "when" | "time" | "reminder";

export type ScheduleConfirmOptions = {
  reminderMinutes: number | null;
  allDay: boolean;
  repeat: RepeatRule | null;
};

type Props = {
  open: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  /** When set, shows the quiet “we picked a moment” hint (detect / default). */
  suggestedStart?: Date;
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

function StepLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-[12px] font-medium tracking-[-0.01em] text-ink-soft/75">
      {children}
    </p>
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

export function ScheduleChoiceFlow({
  open,
  title,
  onTitleChange,
  initialStart,
  initialEnd,
  initialAllDay,
  initialRepeat,
  suggestedStart,
  editMode,
  onConfirm,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const [step, setStep] = useState<Step>("when");
  const [when, setWhen] = useState<WhenKey>("today");
  const [allDay, setAllDay] = useState(false);
  const [repeat, setRepeat] = useState<RepeatKey>("none");
  const [reminder, setReminder] = useState<ReminderKey>("30m");
  const [pickDate, setPickDate] = useState<[number, number]>([
    new Date().getMonth() + 1,
    new Date().getDate(),
  ]);
  const [startTime, setStartTime] = useState<[number, number]>([9, 0]);
  const [endTime, setEndTime] = useState<[number, number]>([10, 0]);

  useEffect(() => {
    if (!open) return;
    const seed = initialStart ?? new Date();
    const seedEnd = initialEnd ?? defaultEndFromStart(seed);
    setWhen(inferWhenFromDate(seed));
    setPickDate([seed.getMonth() + 1, seed.getDate()]);
    setAllDay(initialAllDay ?? false);
    setRepeat(repeatRuleToKey(initialRepeat));
    setStartTime([seed.getHours(), snapMinute(seed.getMinutes())]);
    setEndTime([seedEnd.getHours(), snapMinute(seedEnd.getMinutes())]);
    setReminder("30m");
    setStep("when");
  }, [open, initialStart, initialEnd, initialAllDay, initialRepeat]);

  const buildBaseDate = (): Date => {
    let base = baseDateForWhen(when);
    if (when === "pick_date") {
      const y = new Date().getFullYear();
      base = new Date(y, pickDate[0] - 1, pickDate[1], 0, 0, 0, 0);
    }
    return base;
  };

  const buildRange = (): { start: Date; end: Date } => {
    const base = buildBaseDate();
    if (allDay) {
      const start = startOfDay(base);
      return { start, end: endOfDay(base) };
    }
    const start = applyTimeToDate(base, "custom", startTime[0], startTime[1]);
    let end = applyTimeToDate(base, "custom", endTime[0], endTime[1]);
    if (end.getTime() <= start.getTime()) {
      end = defaultEndFromStart(start);
    }
    return { start, end };
  };

  const { start, end } = buildRange();

  const dateSummary = start.toLocaleDateString(locale, {
    weekday: when === "today" ? undefined : "short",
    month: when === "pick_date" ? "short" : undefined,
    day: when === "pick_date" ? "numeric" : undefined,
  });

  const momentPreview = formatSuggestedMoment(
    start,
    lang === "en" ? "en" : "ko",
    allDay,
  );

  const showMomentHint = !editMode && !!suggestedStart;

  const whenOptions: { key: WhenKey; label: string }[] = [
    { key: "today", label: t("오늘", "Today") },
    { key: "tomorrow", label: t("내일", "Tomorrow") },
    { key: "weekend", label: t("이번 주말", "This weekend") },
    { key: "next_week", label: t("다음 주", "Next week") },
    { key: "pick_date", label: t("날짜 선택", "Pick date") },
  ];

  const dateColDef = [
    {
      label: t("월", "Mo"),
      values: Array.from({ length: 12 }, (_, i) => i + 1),
    },
    {
      label: t("일", "Day"),
      values: Array.from({ length: 31 }, (_, i) => i + 1),
    },
  ];

  const timeColDef = [
    {
      label: t("시", "Hr"),
      values: Array.from({ length: 24 }, (_, i) => i),
      pad: 2,
    },
    { label: t("분", "Min"), values: [...MINUTE_STEPS], pad: 2 },
  ];

  const goNext = () => {
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
    if (!editMode && !allDay && s.getTime() < Date.now() - 60 * 60 * 1000) {
      s = new Date(s);
      s.setFullYear(s.getFullYear() + 1);
      e = allDay ? endOfDay(s) : defaultEndFromStart(s);
    }
    onConfirm(s, e, {
      reminderMinutes: reminderToMinutes(reminder),
      allDay,
      repeat: repeatKeyToRule(repeat),
    });
  };

  const stepIndex = step === "when" ? 0 : step === "time" ? 1 : 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {!editMode && (
          <div className="mb-5">
            <h2 className="text-[17px] font-semibold leading-[1.45] tracking-[-0.02em] text-ink">
              {t(
                "이 생각은 언제 다시 떠올리면 좋을까요?",
                "When would be a good moment to remember this?",
              )}
            </h2>
            {showMomentHint && (
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft/80">
                {t(
                  "여유 있게 준비할 수 있는 순간을 골라봤어요.",
                  "We picked a moment with room to breathe.",
                )}
              </p>
            )}
            <div className="mt-3 rounded-[18px] bg-ink/[0.04] px-4 py-3.5 ring-1 ring-ink/[0.04]">
              <p className="text-[15px] font-medium leading-snug text-ink">
                {momentPreview}
              </p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft/70">
                {t("필요하면 바로 바꿀 수 있어요.", "Change it anytime.")}
              </p>
            </div>
          </div>
        )}

        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t("무엇을 기억할까요", "What to remember")}
          className="mb-5 w-full rounded-[20px] border border-transparent bg-ink/[0.04] px-4 py-3.5 text-[18px] font-semibold tracking-[-0.02em] text-ink placeholder:text-ink-soft/55 input-focus-ring focus:border-primary/30 focus:bg-white"
        />

        <div className="mb-4 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                i <= stepIndex ? "bg-ink/70" : "bg-ink/8"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "when" && (
            <motion.div
              key="when"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={MOTION_STEP}
            >
              <StepLabel>{t("언제", "When")}</StepLabel>
              <div className="flex flex-col gap-1.5">
                {whenOptions.map(({ key, label }) => (
                  <Chip
                    key={key}
                    large
                    active={when === key}
                    onClick={() => setWhen(key)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
              {when === "pick_date" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 overflow-hidden"
                >
                  <WheelPicker
                    columns={dateColDef}
                    value={pickDate}
                    onChange={setPickDate}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {step === "time" && (
            <motion.div
              key="time"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={MOTION_STEP}
            >
              <button
                type="button"
                onClick={goBack}
                className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink-soft touch-press"
              >
                <ChevronLeft size={16} />
                {t("언제", "When")}
              </button>

              <StepLabel>{t("시간", "Time")}</StepLabel>

              <SettingsGroup>
                <SettingsRow
                  label={t("하루 종일", "All-day")}
                  trailing={
                    <IosSwitch
                      checked={allDay}
                      onChange={setAllDay}
                      label={t("하루 종일", "All-day")}
                    />
                  }
                  border={!allDay}
                />
                {!allDay && (
                  <>
                    <div className="border-b border-ink/[0.06] px-4 py-3">
                      <p className="mb-2 text-[13px] font-semibold text-ink-soft">
                        {t("시작", "Starts")}
                      </p>
                      <WheelPicker
                        columns={timeColDef}
                        value={startTime}
                        onChange={handleStartTimeChange}
                      />
                    </div>
                    <div className="px-4 py-3">
                      <p className="mb-2 text-[13px] font-semibold text-ink-soft">
                        {t("종료", "Ends")}
                      </p>
                      <WheelPicker
                        columns={timeColDef}
                        value={endTime}
                        onChange={setEndTime}
                      />
                    </div>
                  </>
                )}
              </SettingsGroup>

              {allDay && (
                <p className="mt-3 px-1 text-[14px] font-medium text-ink-soft">
                  {dateSummary} · {t("하루 종일", "All-day")}
                </p>
              )}

              <div className="mt-4">
                <StepLabel>{t("반복", "Repeat")}</StepLabel>
                <SettingsGroup>
                  {REPEAT_OPTIONS.map((key, i) => {
                    const active = repeat === key;
                    const isLast = i === REPEAT_OPTIONS.length - 1;
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
                  })}
                </SettingsGroup>
              </div>
            </motion.div>
          )}

          {step === "reminder" && (
            <motion.div
              key="reminder"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={MOTION_STEP}
            >
              <button
                type="button"
                onClick={goBack}
                className="mb-3 flex items-center gap-1 text-[13px] font-medium text-ink-soft touch-press"
              >
                <ChevronLeft size={16} />
                {t("시간", "Time")}
              </button>
              <StepLabel>{t("알림", "Reminder")}</StepLabel>
              <div className="flex flex-wrap gap-2 pb-2">
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
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-semibold text-white"
          >
            {t("다음", "Next")}
          </button>
        )}
      </div>
    </div>
  );
}
