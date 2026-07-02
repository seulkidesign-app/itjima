import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import type { TimerPreset } from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";

type Props = {
  schedule: ScheduleItem | null;
  open: boolean;
  onClose: () => void;
  onSelectPreset: (preset: TimerPreset) => void;
  onClear?: () => void;
  active?: boolean;
};

export function ScheduleTimerSheet({
  schedule,
  open,
  onClose,
  onSelectPreset,
  onClear,
  active,
}: Props) {
  const t = useT();
  if (!schedule) return null;

  const presets: { id: TimerPreset; label: string }[] = [
    { id: "5m", label: t("5분 집중", "5 min focus") },
    { id: "15m", label: t("15분 집중", "15 min focus") },
    { id: "25m", label: t("25분 집중", "25 min focus") },
    { id: "45m", label: t("45분 집중", "45 min focus") },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="58vh">
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[17px] font-bold text-ink">
          {t("빠른 타이머", "Quick timer")}
        </h2>
        <p className="mt-1 line-clamp-2 text-[14px] text-ink-soft">
          {scheduleDisplayTitle(schedule)}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {presets.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                onSelectPreset(id);
                onClose();
              }}
              className="touch-press w-full rounded-[20px] bg-primary/20 px-4 py-3.5 text-left text-[15px] font-semibold text-ink"
            >
              {label}
            </button>
          ))}
          {active && onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="touch-press mt-1 w-full rounded-[20px] bg-ink/[0.06] px-4 py-3.5 text-[15px] font-semibold text-ink-soft"
            >
              {t("타이머 끄기", "Stop timer")}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
