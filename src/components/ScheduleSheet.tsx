import { useState } from "react";
import { WheelPicker } from "./WheelPicker";
import { useT } from "@/lib/i18n";
import type { RepeatRule } from "@/lib/store";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export type ScheduleSaveOptions = {
  allDay?: boolean;
  repeat?: RepeatRule | null;
};

function snapMinute(m: number) {
  return MINUTE_STEPS.reduce((best, v) => (Math.abs(v - m) < Math.abs(best - m) ? v : best));
}

function dateToPicker(d: Date) {
  return [d.getMonth() + 1, d.getDate(), d.getHours(), snapMinute(d.getMinutes())];
}

function dateToDatePicker(d: Date) {
  return [d.getMonth() + 1, d.getDate()];
}

const REPEAT_RULES: RepeatRule[] = ["daily", "weekly", "monthly", "yearly"];

export function ScheduleSheet({
  open,
  initialText = "",
  initialStart,
  initialEnd,
  initialAllDay,
  initialRepeat,
  saveLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  initialText?: string;
  initialStart?: Date;
  initialEnd?: Date;
  initialAllDay?: boolean;
  initialRepeat?: RepeatRule | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: (text: string, start: Date, end: Date, opts?: ScheduleSaveOptions) => void;
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
  const [allDay, setAllDay] = useState(initialAllDay ?? false);
  const [repeat, setRepeat] = useState(!!initialRepeat);
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(initialRepeat ?? "weekly");
  const [dateOnly, setDateOnly] = useState(dateToDatePicker(now));

  if (!open) return null;

  const colDef = [
    { label: t("월", "Mo"), values: Array.from({ length: 12 }, (_, i) => i + 1) },
    { label: t("일", "Day"), values: Array.from({ length: 31 }, (_, i) => i + 1) },
    { label: t("시", "Hr"), values: Array.from({ length: 24 }, (_, i) => i), pad: 2 },
    { label: t("분", "Min"), values: MINUTE_STEPS, pad: 2 },
  ];

  const dateColDef = [
    { label: t("월", "Mo"), values: Array.from({ length: 12 }, (_, i) => i + 1) },
    { label: t("일", "Day"), values: Array.from({ length: 31 }, (_, i) => i + 1) },
  ];

  const handleSave = () => {
    const y = new Date().getFullYear();
    let s: Date;
    let e: Date;
    if (allDay) {
      s = new Date(y, dateOnly[0] - 1, dateOnly[1], 0, 0, 0, 0);
      e = new Date(y, dateOnly[0] - 1, dateOnly[1], 23, 59, 59, 999);
    } else {
      s = new Date(y, start[0] - 1, start[1], start[2], start[3]);
      e = new Date(y, end[0] - 1, end[1], end[2], end[3]);
      if (e <= s) e.setTime(s.getTime() + 60 * 60 * 1000);
    }
    onSave(text.trim() || t("새 일정", "New event"), s, e, {
      allDay,
      repeat: repeat ? repeatRule : null,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
      <div className="flex-1 bg-ink/40 backdrop-blur-[2px] animate-fade-in" />
      <div
        className="animate-slide-up max-h-[88vh] overflow-y-auto rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-2.5 shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("일정 제목", "Event title")}
          className="mb-4 w-full rounded-[24px] bg-ink/[0.04] px-3.5 py-3 text-[16px] font-semibold text-ink placeholder:text-ink-soft/60 focus:outline-none focus:bg-ink/[0.06] focus:shadow-[0_0_0_2px_#FFE033]"
        />
        <label className="mb-3 flex items-center gap-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          {t("하루 종일", "All day")}
        </label>
        <label className="mb-3 flex items-center gap-2.5 text-[14px] text-ink">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} />
          {t("반복", "Repeat")}
        </label>
        {repeat && (
          <div className="mb-4 flex flex-wrap gap-2">
            {REPEAT_RULES.map((rule) => (
              <button
                key={rule}
                type="button"
                onClick={() => setRepeatRule(rule)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                  repeatRule === rule ? "bg-primary text-ink" : "bg-ink/[0.06] text-ink-soft"
                }`}
              >
                {rule === "daily"
                  ? t("매일", "Daily")
                  : rule === "weekly"
                    ? t("매주", "Weekly")
                    : rule === "monthly"
                      ? t("매월", "Monthly")
                      : t("매년", "Yearly")}
              </button>
            ))}
          </div>
        )}
        {allDay ? (
          <>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {t("날짜", "Date")}
            </div>
            <WheelPicker columns={dateColDef} value={dateOnly} onChange={setDateOnly} />
          </>
        ) : (
          <>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {t("시작", "Start")}
            </div>
            <WheelPicker columns={colDef} value={start} onChange={setStart} />
            <div className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {t("종료", "End")}
            </div>
            <WheelPicker columns={colDef} value={end} onChange={setEnd} />
          </>
        )}
        <button
          onClick={handleSave}
          className="mt-5 w-full rounded-full bg-ink py-4 text-[15px] font-bold text-background active:scale-[0.98] transition"
        >
          {saveLabel ?? t("일정 등록", "Save event")}
        </button>
      </div>
    </div>
  );
}
