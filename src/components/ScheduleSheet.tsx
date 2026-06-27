import { useState } from "react";
import { WheelPicker } from "./WheelPicker";
import { useT } from "@/lib/i18n";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function snapMinute(m: number) {
  return MINUTE_STEPS.reduce((best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best));
}

function dateToPicker(d: Date) {
  return [d.getMonth() + 1, d.getDate(), d.getHours(), snapMinute(d.getMinutes())];
}

export function ScheduleSheet({
  open,
  initialText = "",
  initialStart,
  initialEnd,
  saveLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  initialText?: string;
  initialStart?: Date;
  initialEnd?: Date;
  saveLabel?: string;
  onClose: () => void;
  onSave: (text: string, start: Date, end: Date) => void;
}) {
  const t = useT();
  const now = initialStart ?? new Date();
  const end0 =
    initialEnd ??
    (() => {
      const d = new Date(now);
      d.setHours(d.getHours() + 1);
      return d;
    })();
  const [text, setText] = useState(initialText);
  const [start, setStart] = useState(dateToPicker(now));
  const [end, setEnd] = useState(dateToPicker(end0));

  if (!open) return null;

  const colDef = [
    { label: t("월", "Mo"), values: Array.from({ length: 12 }, (_, i) => i + 1) },
    { label: t("일", "Day"), values: Array.from({ length: 31 }, (_, i) => i + 1) },
    { label: t("시", "Hr"), values: Array.from({ length: 24 }, (_, i) => i), pad: 2 },
    { label: t("분", "Min"), values: MINUTE_STEPS, pad: 2 },
  ];

  const handleSave = () => {
    const y = new Date().getFullYear();
    const s = new Date(y, start[0] - 1, start[1], start[2], start[3]);
    const e = new Date(y, end[0] - 1, end[1], end[2], end[3]);
    if (e <= s) e.setTime(s.getTime() + 60 * 60 * 1000);
    onSave(text.trim() || t("새 일정", "New event"), s, e);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        className="animate-slide-up max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2.5 shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("일정 제목", "Event title")}
          className="mb-4 w-full rounded-xl bg-ink/[0.04] px-3.5 py-3 text-[16px] font-semibold text-ink placeholder:text-ink-soft/60 focus:outline-none focus:bg-ink/[0.06]"
        />
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{t("시작", "Start")}</div>
        <WheelPicker columns={colDef} value={start} onChange={setStart} />
        <div className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{t("종료", "End")}</div>
        <WheelPicker columns={colDef} value={end} onChange={setEnd} />
        <button
          onClick={handleSave}
          className="mt-5 w-full rounded-2xl bg-ink py-4 text-[15px] font-bold text-background active:scale-[0.98] transition"
        >
          {saveLabel ?? t("일정 등록", "Save event")}
        </button>
      </div>
    </div>
  );
}
