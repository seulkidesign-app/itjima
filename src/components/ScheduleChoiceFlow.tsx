import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { WheelPicker } from "./WheelPicker";
import { useT, useLang } from "@/lib/i18n";
import {
  type WhenKey,
  type TimeKey,
  type ReminderKey,
  baseDateForWhen,
  applyTimeToDate,
  reminderToMinutes,
  inferWhenFromDate,
  inferTimeFromDate,
} from "@/lib/scheduleChoices";
import { MOTION_STEP } from "@/lib/motionLanguage";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Step = "when" | "time" | "reminder";

type Props = {
  open: boolean;
  title: string;
  onTitleChange: (v: string) => void;
  initialStart?: Date;
  editMode?: boolean;
  onConfirm: (
    start: Date,
    end: Date,
    reminderMinutes: number | null,
  ) => void;
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
    <motion.button
      type="button"
      whileTap={{ scale: 0.96 }}
      onClick={() => {
        tick();
        onClick();
      }}
      className={`chip-select flex-1 rounded-full font-bold transition-colors ${
        large ? "py-3.5 text-[17px]" : "py-2.5 text-[13px]"
      } ${
        active
          ? "chip-select-active bg-primary text-ink shadow-card"
          : "bg-ink/[0.05] text-ink-soft"
      }`}
    >
      {children}
    </motion.button>
  );
}

function StepLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
      {children}
    </p>
  );
}

export function ScheduleChoiceFlow({
  open,
  title,
  onTitleChange,
  initialStart,
  editMode,
  onConfirm,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const [step, setStep] = useState<Step>("when");
  const [when, setWhen] = useState<WhenKey>("today");
  const [time, setTime] = useState<TimeKey>("morning");
  const [reminder, setReminder] = useState<ReminderKey>("30m");
  const [pickDate, setPickDate] = useState<[number, number]>([
    new Date().getMonth() + 1,
    new Date().getDate(),
  ]);
  const [customTime, setCustomTime] = useState<[number, number]>([9, 0]);

  useEffect(() => {
    if (!open) return;
    const seed = initialStart ?? new Date();
    setWhen(inferWhenFromDate(seed));
    setTime(inferTimeFromDate(seed));
    setPickDate([seed.getMonth() + 1, seed.getDate()]);
    setCustomTime([seed.getHours(), seed.getMinutes()]);
    setReminder("30m");
    setStep("when");
  }, [open, initialStart]);

  const buildStart = (): Date => {
    let base = baseDateForWhen(when);
    if (when === "pick_date") {
      const y = new Date().getFullYear();
      base = new Date(y, pickDate[0] - 1, pickDate[1], 0, 0, 0, 0);
    }
    if (time === "custom") {
      return applyTimeToDate(base, "custom", customTime[0], customTime[1]);
    }
    return applyTimeToDate(base, time);
  };

  const start = buildStart();
  const summaryTime = start.toLocaleTimeString(locale, {
    weekday: when === "today" ? undefined : "short",
    month: when === "pick_date" ? "short" : undefined,
    day: when === "pick_date" ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const whenOptions: { key: WhenKey; label: string }[] = [
    { key: "today", label: t("오늘", "Today") },
    { key: "tomorrow", label: t("내일", "Tomorrow") },
    { key: "weekend", label: t("이번 주말", "This weekend") },
    { key: "next_week", label: t("다음 주", "Next week") },
    { key: "pick_date", label: t("날짜 선택", "Pick date") },
  ];

  const timeOptions: { key: TimeKey; label: string }[] = [
    { key: "morning", label: t("아침", "Morning") },
    { key: "afternoon", label: t("오후", "Afternoon") },
    { key: "evening", label: t("저녁", "Evening") },
    { key: "custom", label: t("직접", "Custom") },
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
    { label: t("분", "Min"), values: MINUTE_STEPS, pad: 2 },
  ];

  const goNext = () => {
    if (step === "when") setStep("time");
    else if (step === "time") setStep("reminder");
  };

  const goBack = () => {
    if (step === "reminder") setStep("time");
    else if (step === "time") setStep("when");
  };

  const handleDone = () => {
    confirmHaptic();
    const s = buildStart();
    if (!editMode && s.getTime() < Date.now() - 60 * 60 * 1000) {
      s.setFullYear(s.getFullYear() + 1);
    }
    const e = new Date(s.getTime() + 60 * 60 * 1000);
    onConfirm(s, e, reminderToMinutes(reminder));
  };

  const stepIndex = step === "when" ? 0 : step === "time" ? 1 : 2;

  return (
    <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
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
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= stepIndex ? "bg-ink" : "bg-ink/10"
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
            <div className="flex flex-col gap-2">
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
            <button
              type="button"
              onClick={goNext}
              className="touch-press mt-5 w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
            >
              {t("다음", "Next")}
            </button>
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
            <StepLabel>{t("몇 시", "What time")}</StepLabel>
            <div className="grid grid-cols-2 gap-2">
              {timeOptions.map(({ key, label }) => (
                <Chip key={key} active={time === key} onClick={() => setTime(key)}>
                  {label}
                </Chip>
              ))}
            </div>
            {time === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 overflow-hidden"
              >
                <WheelPicker
                  columns={timeColDef}
                  value={customTime}
                  onChange={setCustomTime}
                />
              </motion.div>
            )}
            <button
              type="button"
              onClick={goNext}
              className="touch-press mt-5 w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
            >
              {t("다음", "Next")}
            </button>
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
              {t("몇 시", "What time")}
            </button>
            <StepLabel>{t("알림", "Reminder")}</StepLabel>
            <div className="flex gap-2">
              {(
                [
                  ["30m", t("30분 전", "30 min before")],
                  ["1h", t("1시간 전", "1 hr before")],
                  ["off", t("없음", "Off")],
                ] as const
              ).map(([key, label]) => (
                <Chip
                  key={key}
                  active={reminder === key}
                  onClick={() => setReminder(key)}
                >
                  {label}
                </Chip>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDone}
              className="touch-press mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-bold text-white shadow-[0_4px_20px_-4px_oklch(0_0_0/0.35)]"
            >
              <Check size={18} strokeWidth={3} />
              {t("남겨둘게요", "Keep it")} · {summaryTime}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
