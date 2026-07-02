import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { BottomSheet } from "./BottomSheet";
import { WheelPicker } from "./WheelPicker";
import { useT } from "@/lib/i18n";
import type { InboxItem } from "@/lib/store";
import { SPRING_DEFAULT } from "@/lib/motion";

const TIME_CHIPS = ["09:00", "13:00", "18:00"] as const;

type Props = {
  item: InboxItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (start: Date, end: Date) => void;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function ScheduleQuickSheet({ item, open, onClose, onConfirm }: Props) {
  const t = useT();
  const [dayChoice, setDayChoice] = useState<
    "today" | "tomorrow" | "pick" | null
  >(null);
  const [pickDate, setPickDate] = useState(() => {
    const n = new Date();
    return [n.getMonth() + 1, n.getDate()];
  });
  const [step, setStep] = useState<"day" | "time">("day");
  const [customTime, setCustomTime] = useState(false);
  const [wheelTime, setWheelTime] = useState([9, 0]);

  useEffect(() => {
    if (!open) return;
    setDayChoice(null);
    setStep("day");
    setCustomTime(false);
    const n = new Date();
    setPickDate([n.getMonth() + 1, n.getDate()]);
    setWheelTime([9, 0]);
  }, [open, item?.id]);

  const reset = () => {
    setDayChoice(null);
    setStep("day");
    setCustomTime(false);
    const n = new Date();
    setPickDate([n.getMonth() + 1, n.getDate()]);
    setWheelTime([9, 0]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const baseDate = useMemo(() => {
    const now = new Date();
    if (dayChoice === "today") return startOfDay(now);
    if (dayChoice === "tomorrow") {
      const d = startOfDay(now);
      d.setDate(d.getDate() + 1);
      return d;
    }
    if (dayChoice === "pick") {
      return new Date(now.getFullYear(), pickDate[0] - 1, pickDate[1]);
    }
    return startOfDay(now);
  }, [dayChoice, pickDate]);

  const pickDay = (choice: "today" | "tomorrow" | "pick") => {
    setDayChoice(choice);
    if (choice !== "pick") setStep("time");
  };

  const applyTime = (hours: number, minutes: number) => {
    if (!item) return;
    const start = new Date(baseDate);
    start.setHours(hours, minutes, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    onConfirm(start, end);
    reset();
  };

  const applyChip = (chip: string) => {
    const [h, m] = chip.split(":").map(Number);
    applyTime(h, m);
  };

  if (!item) return null;

  return (
    <BottomSheet open={open} onClose={handleClose}>
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-primary" />
          <h2 className="text-[17px] font-bold text-ink">
            {t("일정으로", "To Schedule")}
          </h2>
        </div>
        <p className="mb-4 line-clamp-2 text-[14px] text-ink-soft">
          {item.text}
        </p>

        {step === "day" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_DEFAULT}
            className="space-y-2"
          >
            {(
              [
                ["today", t("오늘", "Today")],
                ["tomorrow", t("내일", "Tomorrow")],
                ["pick", t("날짜 선택", "Pick Date")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => pickDay(key)}
                className="touch-press flex w-full items-center gap-3 rounded-[20px] bg-ink/[0.04] px-4 py-3.5 text-left text-[15px] font-semibold text-ink"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${dayChoice === key ? "border-primary bg-primary" : "border-ink/20"}`}
                />
                {label}
              </button>
            ))}
            {dayChoice === "pick" && (
              <div className="pt-2">
                <WheelPicker
                  columns={[
                    {
                      label: t("월", "Mo"),
                      values: Array.from({ length: 12 }, (_, i) => i + 1),
                    },
                    {
                      label: t("일", "Day"),
                      values: Array.from({ length: 31 }, (_, i) => i + 1),
                    },
                  ]}
                  value={pickDate}
                  onChange={setPickDate}
                />
                <button
                  type="button"
                  onClick={() => setStep("time")}
                  className="touch-press mt-4 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink"
                >
                  {t("다음", "Next")}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {step === "time" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={SPRING_DEFAULT}
          >
            <div className="flex flex-wrap gap-2">
              {TIME_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => applyChip(chip)}
                  className="touch-press rounded-full bg-primary px-4 py-2.5 text-[14px] font-bold text-ink"
                >
                  {chip}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTime((v) => !v)}
                className="touch-press rounded-full bg-ink/[0.06] px-4 py-2.5 text-[14px] font-semibold text-ink-soft"
              >
                {t("직접", "Custom")}
              </button>
            </div>
            {customTime && (
              <div className="mt-4">
                <WheelPicker
                  columns={[
                    {
                      label: t("시", "Hr"),
                      values: Array.from({ length: 24 }, (_, i) => i),
                      pad: 2,
                    },
                    { label: t("분", "Min"), values: [0, 15, 30, 45], pad: 2 },
                  ]}
                  value={wheelTime}
                  onChange={setWheelTime}
                />
                <button
                  type="button"
                  onClick={() => applyTime(wheelTime[0], wheelTime[1])}
                  className="touch-press mt-4 w-full rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
                >
                  {t("저장", "Save")}
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setStep("day");
                setCustomTime(false);
              }}
              className="touch-press mt-4 text-[13px] font-medium text-ink-soft"
            >
              {t("← 날짜 다시", "← Change date")}
            </button>
          </motion.div>
        )}
      </div>
    </BottomSheet>
  );
}
