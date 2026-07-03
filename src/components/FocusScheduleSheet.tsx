import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import { detectDate } from "@/lib/dateDetect";
import { SPRING_DEFAULT } from "@/lib/motion";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";

const TIME_CHIPS = ["09:00", "13:00", "18:00"] as const;
type DayKey = "today" | "tomorrow" | "detected";
type AlarmKey = "30m" | "1h" | "off";

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (
    text: string,
    start: Date,
    end: Date,
    alarmMinutesBefore: number | null,
  ) => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function defaultStart(item: InboxItem): Date {
  const det =
    detectDate(item.text) ??
    (item.brain_mirror?.suggestedDateText
      ? detectDate(item.brain_mirror.suggestedDateText)
      : null);
  if (det) return det.start;
  const d = new Date();
  d.setMinutes(0, 0, 0);
  if (d.getHours() < 9) d.setHours(9, 0, 0, 0);
  else if (d.getHours() >= 18) {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

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
      className={`chip-select flex-1 rounded-full font-bold ${
        large ? "py-3.5 text-[18px]" : "py-2.5 text-[13px]"
      } ${
        active
          ? "chip-select-active bg-primary text-ink"
          : "bg-ink/[0.05] text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

export function FocusScheduleSheet({ item, open, onClose, onConfirm }: Props) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const detected = useMemo(
    () =>
      item
        ? (detectDate(item.text) ??
          (item.brain_mirror?.suggestedDateText
            ? detectDate(item.brain_mirror.suggestedDateText)
            : null))
        : null,
    [item],
  );

  const [title, setTitle] = useState("");
  const [editTitle, setEditTitle] = useState(false);
  const [day, setDay] = useState<DayKey>("today");
  const [timeChip, setTimeChip] = useState("09:00");
  const [alarm, setAlarm] = useState<AlarmKey>("30m");

  useEffect(() => {
    if (!open || !item) return;
    const start = defaultStart(item);
    setTitle(thoughtFirstLine(item.text));
    setEditTitle(false);
    if (detected) {
      setDay("detected");
      setTimeChip(
        `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`,
      );
    } else {
      const tomorrow = startOfDay(new Date());
      tomorrow.setDate(tomorrow.getDate() + 1);
      setDay(
        start.toDateString() === tomorrow.toDateString() ? "tomorrow" : "today",
      );
      const h = start.getHours();
      const match = TIME_CHIPS.find((c) => Number(c.split(":")[0]) === h);
      setTimeChip(match ?? TIME_CHIPS[0]);
    }
    setAlarm("30m");
  }, [open, item, detected]);

  if (!item) return null;

  const buildStart = (): Date => {
    const now = new Date();
    const base = startOfDay(now);
    if (day === "tomorrow") base.setDate(base.getDate() + 1);
    else if (day === "detected" && detected) return new Date(detected.start);
    const [h, m] = timeChip.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    return base;
  };

  const start = buildStart();
  const summaryTime = start.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const handleConfirm = () => {
    confirmHaptic();
    const s = buildStart();
    const e = new Date(s.getTime() + 60 * 60 * 1000);
    const alarmMin = alarm === "off" ? null : alarm === "1h" ? 60 : 30;
    onConfirm(title.trim() || thoughtFirstLine(item.text), s, e, alarmMin);
  };

  const dayOptions: { key: DayKey; label: string }[] = [
    { key: "today", label: t("오늘", "Today") },
    { key: "tomorrow", label: t("내일", "Tomorrow") },
  ];
  if (detected) {
    dayOptions.push({ key: "detected", label: detected.label });
  }

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="52vh">
      <motion.div
        className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...SPRING_DEFAULT, delay: 0.04 }}
      >
        {editTitle ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-4 w-full rounded-[16px] border border-ink/6 bg-ink/[0.03] px-4 py-3 text-[17px] font-semibold text-ink focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25"
            aria-label={t("일정 제목", "Event title")}
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditTitle(true)}
            className="mb-4 w-full rounded-[16px] bg-ink/[0.04] px-4 py-3 text-left text-[17px] font-semibold text-ink"
          >
            {title || thoughtFirstLine(item.text)}
          </button>
        )}

        {/* 1. 시간 */}
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          {t("시간", "Time")}
        </p>
        <div className="flex gap-2">
          {TIME_CHIPS.map((chip) => (
            <Chip
              key={chip}
              large
              active={timeChip === chip}
              onClick={() => setTimeChip(chip)}
            >
              {chip}
            </Chip>
          ))}
        </div>

        {/* 2. 날짜 */}
        <p className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          {t("날짜", "Date")}
        </p>
        <div className="flex gap-2">
          {dayOptions.map(({ key, label }) => (
            <Chip key={key} active={day === key} onClick={() => setDay(key)}>
              {label}
            </Chip>
          ))}
        </div>

        {/* 3. 알림 */}
        <p className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-soft">
          {t("알림", "Reminder")}
        </p>
        <div className="flex gap-2">
          {(
            [
              ["30m", t("30분 전", "30 min")],
              ["1h", t("1시간 전", "1 hr")],
              ["off", t("없음", "Off")],
            ] as const
          ).map(([key, label]) => (
            <Chip
              key={key}
              active={alarm === key}
              onClick={() => setAlarm(key)}
            >
              {label}
            </Chip>
          ))}
        </div>

        {/* 4. 완료 */}
        <button
          type="button"
          onClick={handleConfirm}
          className="touch-press mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-4 text-[16px] font-bold text-white shadow-[0_4px_20px_-4px_oklch(0_0_0/0.35)]"
        >
          <Check size={18} strokeWidth={3} />
          {t("완료", "Done")} · {summaryTime}
        </button>
      </motion.div>
    </BottomSheet>
  );
}
