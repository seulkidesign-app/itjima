import { useEffect, useState } from "react";
import { WheelPicker } from "./WheelPicker";
import type { ScheduleItem } from "@/lib/store";
import { useT } from "@/lib/i18n";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function snapMinute(m: number) {
  return MINUTE_STEPS.reduce((best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best));
}

function dateToPicker(d: Date) {
  return [d.getMonth() + 1, d.getDate(), d.getHours(), snapMinute(d.getMinutes())];
}

type Props = {
  schedule?: ScheduleItem;
  onClose: () => void;
  /** Legacy: offset before event start */
  onConfirm?: (offset: "at" | "10m" | "1h") => void;
  /** Custom absolute alarm time */
  onConfirmAt?: (iso: string) => void;
};

export function ReminderSheet({ schedule, onClose, onConfirm, onConfirmAt }: Props) {
  const t = useT();
  const base = schedule ? new Date(schedule.start_time) : new Date();
  const [picker, setPicker] = useState(() => dateToPicker(base));

  const colDef = [
    { label: t("월", "Mo"), values: Array.from({ length: 12 }, (_, i) => i + 1) },
    { label: t("일", "Day"), values: Array.from({ length: 31 }, (_, i) => i + 1) },
    { label: t("시", "Hr"), values: Array.from({ length: 24 }, (_, i) => i), pad: 2 },
    { label: t("분", "Min"), values: MINUTE_STEPS, pad: 2 },
  ];

  const save = () => {
    const at = new Date(base.getFullYear(), picker[0] - 1, picker[1], picker[2], picker[3]);
    if (onConfirmAt) {
      onConfirmAt(at.toISOString());
    } else if (onConfirm) {
      onConfirm("at");
    }
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2.5 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
        <h2 className="text-[17px] font-bold text-ink">{t("알림 시간", "Reminder time")}</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {t("앱을 열어두면 알려드려요.", "Works while the app stays open.")}
        </p>
        <div className="mt-4">
          <WheelPicker columns={colDef} value={picker} onChange={setPicker} />
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
          >
            {t("취소", "Cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
          >
            {t("저장", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}
