import { useT } from "@/lib/i18n";
import type { AlarmPreset } from "@/lib/scheduleReminders";

type Props = {
  onSelect: (preset: AlarmPreset) => void;
  onCustom: () => void;
  onDismiss: () => void;
};

export function ScheduleAlarmChips({ onSelect, onCustom, onDismiss }: Props) {
  const t = useT();

  const chips: { id: AlarmPreset | "custom"; label: string }[] = [
    { id: "10m", label: t("10분 뒤", "In 10 min") },
    { id: "30m", label: t("30분 뒤", "In 30 min") },
    { id: "1h", label: t("1시간 뒤", "In 1 hour") },
    { id: "tonight", label: t("오늘 저녁", "Tonight") },
    { id: "tomorrow_am", label: t("내일 아침", "Tomorrow AM") },
    { id: "custom", label: t("직접 설정", "Custom") },
  ];

  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      {chips.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            if (id === "custom") onCustom();
            else {
              onSelect(id);
              onDismiss();
            }
          }}
          className="rounded-full bg-primary/25 px-2.5 py-1 text-[11px] font-bold text-ink active:scale-95"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
