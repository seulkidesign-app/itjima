import { useEffect, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { WheelPicker } from "./WheelPicker";
import { useT } from "@/lib/i18n";
import type { RepeatRule } from "@/lib/store";

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export type ScheduleSaveOptions = {
  allDay?: boolean;
  repeat?: RepeatRule | null;
};

function snapMinute(m: number) {
  return MINUTE_STEPS.reduce((best, v) =>
    Math.abs(v - m) < Math.abs(best - m) ? v : best,
  );
}

function dateToPicker(d: Date) {
  return [
    d.getMonth() + 1,
    d.getDate(),
    d.getHours(),
    snapMinute(d.getMinutes()),
  ];
}

function dateToDatePicker(d: Date) {
  return [d.getMonth() + 1, d.getDate()];
}

const SHOW_REPEAT_UI = false;

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
  onSave: (
    text: string,
    start: Date,
    end: Date,
    opts?: ScheduleSaveOptions,
  ) => void;
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
  const [repeatRule, setRepeatRule] = useState<RepeatRule>(
    initialRepeat ?? "weekly",
  );
  const [dateOnly, setDateOnly] = useState(dateToDatePicker(now));

  useEffect(() => {
    if (!open) return;
    const s = initialStart ?? new Date();
    const e =
      initialEnd ??
      (() => {
        const d = new Date(s);
        d.setHours(d.getHours() + 1);
        return d;
      })();
    setText(initialText);
    setStart(dateToPicker(s));
    setEnd(dateToPicker(e));
    setAllDay(initialAllDay ?? false);
    setRepeat(!!initialRepeat);
    setRepeatRule(initialRepeat ?? "weekly");
    setDateOnly(dateToDatePicker(s));
  }, [
    open,
    initialText,
    initialStart,
    initialEnd,
    initialAllDay,
    initialRepeat,
  ]);

  const colDef = [
    {
      label: t("월", "Mo"),
      values: Array.from({ length: 12 }, (_, i) => i + 1),
    },
    {
      label: t("일", "Day"),
      values: Array.from({ length: 31 }, (_, i) => i + 1),
    },
    {
      label: t("시", "Hr"),
      values: Array.from({ length: 24 }, (_, i) => i),
      pad: 2,
    },
    { label: t("분", "Min"), values: MINUTE_STEPS, pad: 2 },
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

  const handleSave = () => {
    const anchor = initialStart ?? new Date();
    const baseYear = anchor.getFullYear();
    let s: Date;
    let e: Date;
    if (allDay) {
      s = new Date(baseYear, dateOnly[0] - 1, dateOnly[1], 0, 0, 0, 0);
      e = new Date(baseYear, dateOnly[0] - 1, dateOnly[1], 23, 59, 59, 999);
    } else {
      s = new Date(baseYear, start[0] - 1, start[1], start[2], start[3]);
      e = new Date(baseYear, end[0] - 1, end[1], end[2], end[3]);
      if (e <= s) e.setTime(s.getTime() + 60 * 60 * 1000);
    }
    if (!initialStart) {
      const bump = (d: Date) => {
        if (d.getTime() < Date.now() - 60 * 60 * 1000) {
          return new Date(
            d.getFullYear() + 1,
            d.getMonth(),
            d.getDate(),
            d.getHours(),
            d.getMinutes(),
            d.getSeconds(),
            d.getMilliseconds(),
          );
        }
        return d;
      };
      s = bump(s);
      e = bump(e);
      if (e <= s) e.setTime(s.getTime() + 60 * 60 * 1000);
    }
    onSave(text.trim() || t("새 일정", "New event"), s, e, {
      allDay,
      repeat: SHOW_REPEAT_UI && repeat ? repeatRule : null,
    });
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="88vh">
      <div className="max-h-[calc(88vh-2rem)] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="mb-4 text-[17px] font-bold text-ink">
          {saveLabel ? t("일정 수정", "Edit event") : t("새 일정", "New event")}
        </h2>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("일정 제목", "Event title")}
          className="mb-4 w-full rounded-[24px] bg-ink/[0.04] px-3.5 py-3 text-[16px] font-semibold text-ink placeholder:text-ink-soft/60 focus:bg-ink/[0.06] focus:shadow-[0_0_0_2px_#FFE033] focus:outline-none"
        />
        <label className="mb-3 flex items-center gap-2.5 text-[14px] text-ink">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          {t("하루 종일", "All day")}
        </label>
        {SHOW_REPEAT_UI && (
          <>
            <label className="mb-3 flex items-center gap-2.5 text-[14px] text-ink">
              <input
                type="checkbox"
                checked={repeat}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              {t("반복", "Repeat")}
            </label>
            {repeat && (
              <div className="mb-4 flex flex-wrap gap-2">
                {(["daily", "weekly", "monthly", "yearly"] as RepeatRule[]).map(
                  (rule) => (
                    <button
                      key={rule}
                      type="button"
                      onClick={() => setRepeatRule(rule)}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                        repeatRule === rule
                          ? "bg-primary text-ink"
                          : "bg-ink/[0.06] text-ink-soft"
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
                  ),
                )}
              </div>
            )}
          </>
        )}
        {allDay ? (
          <>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              {t("날짜", "Date")}
            </div>
            <WheelPicker
              columns={dateColDef}
              value={dateOnly}
              onChange={setDateOnly}
            />
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
          className="mt-5 w-full rounded-full bg-ink py-4 text-[15px] font-bold text-background transition active:scale-[0.98]"
        >
          {saveLabel ?? t("일정 등록", "Save event")}
        </button>
      </div>
    </BottomSheet>
  );
}
