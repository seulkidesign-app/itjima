import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { countdown, dDay, formatDateLabel } from "@/lib/dateDetect";
import { useT } from "@/lib/i18n";
import { useSchedules, type ScheduleItem } from "@/lib/store";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
});

function SchedulePage() {
  const t = useT();
  const { items, add, remove } = useSchedules();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.title = t("일정 — ItJima", "Schedule — ItJima");
  }, [t]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time)),
    [items],
  );

  const onSave = async (text: string, start: Date, end: Date) => {
    await add({
      text,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      alarm: false,
    } as Partial<ScheduleItem> & { text: string });
    setOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="nrc-eyebrow">{t("캘린더", "Calendar")}</div>
        <h1 className="nrc-headline">{t("일정", "Schedule")}</h1>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-soft">{t("등록된 일정이 없어요", "No events yet")}</p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((item) => {
              const start = new Date(item.start_time);
              const dd = dDay(start);
              return (
                <li key={item.id} className="rounded-2xl border border-ink/8 bg-white p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-bold text-ink">{item.text}</div>
                      <div className="mt-1 text-sm text-ink-soft">{formatDateLabel(start)}</div>
                      <div className="mt-1 text-[12px] font-semibold text-primary">
                        {countdown(start)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-num text-[22px] leading-none ${
                          dd.tone === "today" ? "text-primary" : dd.tone === "soon" ? "text-destructive" : "text-ink"
                        }`}
                      >
                        {dd.label}
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        className="mt-2 text-[11px] font-semibold text-ink-soft"
                      >
                        {t("삭제", "Delete")}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-float"
        aria-label={t("일정 추가", "Add event")}
      >
        <Plus size={24} strokeWidth={2.5} />
      </button>

      <ScheduleSheet open={open} onClose={() => setOpen(false)} onSave={onSave} />
    </div>
  );
}
