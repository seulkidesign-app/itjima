import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { formatReminderFireTime } from "@/lib/push/scheduleNotificationContent";

type Props = {
  open: boolean;
  fireAt: Date | null;
  lang: "ko" | "en";
  busy?: boolean;
  onEnableAndSave: () => void;
  onSaveWithoutNotification: () => void;
  onClose: () => void;
};

export function ScheduleNotificationOnboardingSheet({
  open,
  fireAt,
  lang,
  busy = false,
  onEnableAndSave,
  onSaveWithoutNotification,
  onClose,
}: Props) {
  const t = useT();
  const timeHint =
    fireAt != null
      ? lang === "ko"
        ? `${formatReminderFireTime(fireAt, "ko")}에 알려드릴게요.`
        : `We'll remind you at ${formatReminderFireTime(fireAt, "en")}.`
      : null;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="72dvh"
      title={t("알림 안내", "Notification")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
          {t("이 시간에 잊지마가 알려드릴까요?", "Should Itjima remind you then?")}
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {t(
            "앱을 닫아도 일정 시간에 알려드려요.",
            "We'll notify you at the scheduled time, even when the app is closed.",
          )}
        </p>
        {timeHint && (
          <p className="mt-3 rounded-[14px] bg-primary/15 px-3 py-2 text-[13px] font-medium text-ink">
            {timeHint}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          data-testid="schedule-onboarding-enable-save"
          onClick={onEnableAndSave}
          className="itjima-cta-primary touch-press mt-5 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          {busy
            ? t("준비하는 중…", "Getting ready…")
            : t("알림 켜고 저장", "Turn on alerts and save")}
        </button>
        <button
          type="button"
          disabled={busy}
          data-testid="schedule-onboarding-save-without"
          onClick={onSaveWithoutNotification}
          className="itjima-cta-secondary touch-press mt-3 w-full px-4 py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
        >
          {t("알림 없이 저장", "Save without notifications")}
        </button>
      </div>
    </BottomSheet>
  );
}
