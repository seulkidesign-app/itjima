import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
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
import { EASE_OUT_APP } from "@/lib/motion";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import {
  formatSuggestionCardParts,
  formatSuggestionPill,
  type ResolvedTiming,
} from "@/lib/dateDetect";

const STEP_FADE = { duration: 0.28, ease: EASE_OUT_APP };

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
  /** One calm reason from date detection — no AI. */
  suggestionReason?: string | null;
  thoughtText?: string;
  flowMode?: "suggested" | "manual";
  onFlowModeChange?: (mode: "suggested" | "manual") => void;
  aiSuggestion?: ResolvedTiming | null;
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

export function ScheduleChoiceFlow({
  open,
  title,
  onTitleChange,
  initialStart,
  initialEnd,
  initialAllDay,
  initialRepeat,
  suggestedStart,
  suggestionReason,
  thoughtText,
  flowMode = "manual",
  onFlowModeChange,
  aiSuggestion,
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
    setStep(flowMode === "suggested" ? "when" : "when");
  }, [open, initialStart, initialEnd, initialAllDay, initialRepeat, flowMode]);

  const seedFromSuggestion = (s: ResolvedTiming) => {
    setWhen(inferWhenFromDate(s.start));
    setPickDate([s.start.getMonth() + 1, s.start.getDate()]);
    setStartTime([s.start.getHours(), snapMinute(s.start.getMinutes())]);
    const end = defaultEndFromStart(s.start);
    setEndTime([end.getHours(), snapMinute(end.getMinutes())]);
  };

  const handleAcceptSuggestion = () => {
    if (!aiSuggestion) return;
    tick();
    seedFromSuggestion(aiSuggestion);
    setStep("reminder");
  };

  const handleRejectSuggestion = () => {
    tick();
    onFlowModeChange?.("manual");
  };

  const handleReturnToSuggestion = () => {
    tick();
    onFlowModeChange?.("suggested");
    setStep("when");
  };

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

  const showMomentHint = !editMode && !!suggestedStart && !suggestionReason;

  const calmReason =
    suggestionReason ??
    (showMomentHint
      ? t(
          "여유 있게 준비할 수 있는 순간을 골라봤어요.",
          "We picked a moment with room to breathe.",
        )
      : null);

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

  const nextLabel =
    step === "when"
      ? t("시간 보기", "Pick a time")
      : t("알림 정하기", "Set a reminder");

  const showSuggested =
    !editMode && flowMode === "suggested" && !!aiSuggestion && step === "when";

  const suggestionParts = aiSuggestion
    ? formatSuggestionCardParts(
        aiSuggestion.start,
        lang === "en" ? "en" : "ko",
      )
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
        {showSuggested && (
          <>
            {thoughtText && (
              <div className="mb-5 rounded-[16px] border border-ink/[0.05] bg-ink/[0.03] px-4 py-3.5">
                <p className="text-[15px] font-medium leading-snug text-ink">
                  {thoughtText}
                </p>
              </div>
            )}
            <h2 className="text-[17px] font-bold leading-[1.45] tracking-[-0.02em] text-ink">
              {t(
                "이 생각, 이때 다시 떠올릴까요?",
                "Shall we bring this thought back then?",
              )}
            </h2>
            <div className="shadow-card card-radius mt-4 border border-ink/[0.04] px-[26px] py-[30px]">
              <p className="text-[12.5px] text-ink-soft">
                {t("ItJima가 찾은 순간", "A moment ItJima found")}
              </p>
              {suggestionParts && (
                <>
                  <p className="mt-2.5 text-[24px] font-extrabold leading-[1.3] tracking-[-0.01em] text-ink">
                    {suggestionParts.dateLine}{" "}
                    <span className="text-[24px] font-extrabold">
                      {suggestionParts.timeLine}
                    </span>
                  </p>
                  <p className="mt-3.5 text-[15px] leading-[1.65] text-ink-soft">
                    {aiSuggestion.reason}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleAcceptSuggestion}
              className="touch-press mt-2 w-full rounded-full bg-primary py-[17px] text-[17px] font-bold text-ink"
            >
              {t("좋아요, 그때 맡겨둘게요", "Yes, leave it for then")}
            </button>
            <button
              type="button"
              onClick={handleRejectSuggestion}
              className="touch-press mt-0.5 w-full bg-transparent py-[15px] text-[15px] font-medium text-ink-soft"
            >
              {t("다시 생각할게요", "I'll think again")}
            </button>
          </>
        )}

        {!showSuggested && !editMode && step === "when" && (
          <div className="mb-4">
            <h2 className="text-[17px] font-semibold leading-[1.45] tracking-[-0.02em] text-ink">
              {t(
                "이 생각은 언제 다시 떠올리면 좋을까요?",
                "When would be a good moment to remember this?",
              )}
            </h2>
            {aiSuggestion && (
              <button
                type="button"
                onClick={handleReturnToSuggestion}
                className="touch-press mb-4 mt-3 inline-flex items-center gap-2 rounded-full border border-ink/[0.05] bg-ink/[0.03] px-4 py-2 text-[13.5px] text-ink-soft"
              >
                <span>
                  {t("↺ 제안으로 돌아가기 ·", "↺ Back to suggestion ·")}
                </span>
                <span className="font-semibold text-ink">
                  {formatSuggestionPill(
                    aiSuggestion.start,
                    lang === "en" ? "en" : "ko",
                  )}
                </span>
              </button>
            )}
            <div className="mt-3 rounded-[18px] bg-ink/[0.04] px-4 py-3.5 ring-1 ring-ink/[0.04]">
              <p className="text-[15px] font-medium leading-snug text-ink">
                {momentPreview}
              </p>
            </div>
            {calmReason && (
              <p className="mt-2.5 px-0.5 text-[13px] leading-relaxed text-ink-soft/70">
                {calmReason}
              </p>
            )}
          </div>
        )}

        {(step !== "when" || editMode) && !showSuggested && (
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={t("무엇을 기억할까요", "What to remember")}
            className="mb-4 w-full rounded-[18px] border-0 bg-ink/[0.035] px-4 py-3 text-[16px] font-medium tracking-[-0.01em] text-ink placeholder:text-ink-soft/50 input-focus-ring focus:bg-ink/[0.05]"
          />
        )}

        <AnimatePresence mode="wait">
          {!showSuggested && step === "when" && (
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
                      <p className="mb-2 text-[12px] font-medium text-ink-soft/65">
                        {t("시작", "Starts")}
                      </p>
                      <WheelPicker
                        columns={timeColDef}
                        value={startTime}
                        onChange={handleStartTimeChange}
                      />
                    </div>
                    <div className="px-4 py-3">
                      <p className="mb-2 text-[12px] font-medium text-ink-soft/65">
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
                <p className="mb-2 text-[12px] font-medium text-ink-soft/65">
                  {t("반복", "Repeat")}
                </p>
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
        {showSuggested ? null : step === "reminder" ? (
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
            className="touch-press w-full rounded-full bg-ink py-3.5 text-[15px] font-medium text-white"
          >
            {nextLabel}
          </button>
        )}
      </div>
    </div>
  );
}
