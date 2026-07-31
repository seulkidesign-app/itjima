import { Plus, Share } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import { formatReminderFireTime } from "@/lib/push/scheduleNotificationContent";

type Props = {
  open: boolean;
  fireAt: Date | null;
  lang: "ko" | "en";
  busy?: boolean;
  /** iPhone Safari tab — must install Home Screen PWA before push works. */
  needsInstall?: boolean;
  onEnableAndSave: () => void;
  onSaveWithoutNotification: () => void;
  onClose: () => void;
};

export function ScheduleNotificationOnboardingSheet({
  open,
  fireAt,
  lang,
  busy = false,
  needsInstall = false,
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
      maxHeight="78dvh"
      title={t("알림 안내", "Notification")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        {needsInstall ? (
          <>
            <h2 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
              {t(
                "알림을 받으려면 홈 화면에 추가해 주세요",
                "Add to Home Screen for notifications",
              )}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              {t(
                "아이폰에서는 홈 화면의 잊지마 앱에서만 닫힌 앱 알림을 받을 수 있어요.",
                "On iPhone, closed-app alerts only work from the Home Screen Itjima app.",
              )}
            </p>
            <ol className="mt-4 space-y-3 text-[13px] text-ink">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-ink">
                  1
                </span>
                <span className="flex-1 pt-0.5">
                  {t("Safari 하단의 ", "Tap the ")}
                  <Share className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  {t(" 공유 버튼", " Share button")}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-ink">
                  2
                </span>
                <span className="flex-1 pt-0.5">
                  {t("메뉴에서 ", "Pick ")}
                  <Plus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />{" "}
                  <b>{t('"홈 화면에 추가"', '"Add to Home Screen"')}</b>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-ink">
                  3
                </span>
                <span className="flex-1 pt-0.5">
                  {t(
                    "홈 화면의 잊지마로 다시 연 뒤, 알림을 켜 주세요",
                    "Reopen Itjima from Home Screen, then turn on alerts",
                  )}
                </span>
              </li>
            </ol>
            {timeHint && (
              <p className="mt-3 rounded-[14px] bg-primary/15 px-3 py-2 text-[13px] font-medium text-ink">
                {timeHint}
              </p>
            )}
            <button
              type="button"
              disabled={busy}
              data-testid="schedule-onboarding-save-install-later"
              onClick={onEnableAndSave}
              className="itjima-cta-primary touch-press mt-5 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
            >
              {busy
                ? t("저장하는 중…", "Saving…")
                : t("일정 저장 · 홈 화면에서 알림 켜기", "Save · enable alerts on Home Screen")}
            </button>
          </>
        ) : (
          <>
            <h2 className="text-[20px] font-bold tracking-[-0.03em] text-ink">
              {t("이 시간에 잊지마가 알려드릴까요?", "Should Itjima remind you then?")}
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              {t(
                "앱을 닫아도 일정 시간에 알려드려요. 한 번만 허용하면 됩니다.",
                "We'll notify you at the scheduled time, even when the app is closed. Allow once.",
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
          </>
        )}

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
