import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import type { AlarmPreset } from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";

type Props = {
  schedule: ScheduleItem | null;
  open: boolean;
  onClose: () => void;
  onSelectPreset: (preset: AlarmPreset) => void;
  onCustom: () => void;
  onDisarm?: () => void;
  armed?: boolean;
};

export function ScheduleAlarmSheet({
  schedule,
  open,
  onClose,
  onSelectPreset,
  onCustom,
  onDisarm,
  armed,
}: Props) {
  const t = useT();
  if (!schedule) return null;

  const presets: { id: AlarmPreset; label: string }[] = [
    { id: "10m", label: t("10분 뒤", "In 10 min") },
    { id: "30m", label: t("30분 뒤", "In 30 min") },
    { id: "1h", label: t("1시간 뒤", "In 1 hour") },
    { id: "tonight", label: t("오늘 저녁", "Tonight") },
    { id: "tomorrow_am", label: t("내일 아침", "Tomorrow AM") },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="62vh">
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[17px] font-bold text-ink">
          {t("빠른 알림", "Quick alarm")}
        </h2>
        <p className="mt-1 line-clamp-2 text-[14px] text-ink-soft">
          {scheduleDisplayTitle(schedule)}
        </p>
        <p className="mt-2 text-[12px] text-ink-soft">
          {t("앱을 열어두면 알려드려요.", "Works while the app stays open.")}
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
              className="touch-press w-full rounded-[20px] bg-ink/[0.04] px-4 py-3.5 text-left text-[15px] font-semibold text-ink"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onCustom();
              onClose();
            }}
            className="touch-press w-full rounded-[20px] bg-ink/[0.04] px-4 py-3.5 text-left text-[15px] font-semibold text-ink"
          >
            {t("직접 설정", "Custom time")}
          </button>
          {armed && onDisarm && (
            <button
              type="button"
              onClick={() => {
                onDisarm();
                onClose();
              }}
              className="touch-press mt-1 w-full rounded-[20px] bg-red-500/10 px-4 py-3.5 text-[15px] font-semibold text-red-600"
            >
              {t("알림 끄기", "Turn off alarm")}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
