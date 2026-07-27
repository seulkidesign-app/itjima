import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import type { AlarmPreset } from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";
import { useUserId } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import {
  backgroundRemindersVerified,
  pushSupportState,
  showDeviceNotificationTest,
} from "@/lib/push/pushSubscription";
import { alarmAvailabilityHint } from "@/lib/alarmAvailability";

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
  const { lang } = useLang();
  const userId = useUserId();
  const [testing, setTesting] = useState(false);
  if (!schedule) return null;

  const eveningHasPassed = new Date().getHours() >= 18;
  const presets: { id: AlarmPreset; label: string }[] = [
    { id: "10m", label: t("10분 뒤", "In 10 min") },
    { id: "30m", label: t("30분 뒤", "In 30 min") },
    { id: "1h", label: t("1시간 뒤", "In 1 hour") },
    {
      id: "tonight",
      label: eveningHasPassed
        ? t("내일 저녁", "Tomorrow evening")
        : t("오늘 저녁", "Tonight"),
    },
    { id: "tomorrow_am", label: t("내일 아침", "Tomorrow AM") },
  ];

  const support = pushSupportState();
  const installRequired = support === "not_installed";
  const availability = alarmAvailabilityHint(
    support,
    Boolean(userId),
    lang === "en" ? "en" : "ko",
    backgroundRemindersVerified(),
  );

  const explainInstallation = () => {
    toast.message(
      t(
        "Safari의 공유 버튼에서 ‘홈 화면에 추가’를 누른 뒤, 홈 화면의 잊지마 앱에서 다시 설정해 주세요.",
        "In Safari, tap Share → Add to Home Screen, then reopen Itjima from its Home Screen icon.",
      ),
      { duration: 6500 },
    );
  };

  const choosePreset = (id: AlarmPreset) => {
    if (installRequired) {
      explainInstallation();
      return;
    }
    onSelectPreset(id);
    onClose();
  };

  const chooseCustom = () => {
    if (installRequired) {
      explainInstallation();
      return;
    }
    onCustom();
    onClose();
  };

  const testDeviceNotification = async () => {
    if (!userId || testing) return;
    if (installRequired) {
      explainInstallation();
      return;
    }

    setTesting(true);
    try {
      const result = await showDeviceNotificationTest(userId);
      if (result.ok) {
        toast.success(
          t(
            "테스트 알림을 보냈어요. 기기 연결은 정상이에요.",
            "Test notification sent. This device is connected.",
          ),
        );
      } else if (result.state === "denied") {
        toast.error(
          t(
            "아이폰 설정 → 알림 → 잊지마에서 알림을 허용해 주세요.",
            "Open iPhone Settings → Notifications → Itjima and allow notifications.",
          ),
          { duration: 6500 },
        );
      } else if (result.state === "not_installed") {
        explainInstallation();
      } else {
        toast.error(
          t(
            "알림 연결을 완료하지 못했어요. 홈 화면 앱에서 다시 시도해 주세요.",
            "Could not complete notification setup. Try again from the Home Screen app.",
          ),
        );
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="72dvh">
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[17px] font-bold text-ink">
          {t("빠른 알림", "Quick alarm")}
        </h2>
        <p className="mt-1 line-clamp-2 text-[14px] text-ink-soft">
          {scheduleDisplayTitle(schedule)}
        </p>

        {installRequired && (
          <div
            className="mt-3 rounded-[18px] border border-primary/35 bg-primary/12 px-3.5 py-3 text-[12px] leading-relaxed text-ink"
            role="alert"
          >
            <p className="font-bold">
              {t("아이폰 알림은 홈 화면 앱에서만 가능해요", "iPhone alerts require the Home Screen app")}
            </p>
            <ol className="mt-1.5 space-y-1 text-ink-soft">
              <li>{t("1. Safari 하단의 공유 버튼 누르기", "1. Tap Share in Safari")}</li>
              <li>{t("2. ‘홈 화면에 추가’ 선택하기", "2. Choose Add to Home Screen")}</li>
              <li>{t("3. 홈 화면의 잊지마로 다시 열기", "3. Reopen Itjima from its Home Screen icon")}</li>
            </ol>
          </div>
        )}

        <p className="mt-2 rounded-[14px] bg-ink/[0.035] px-3 py-2.5 text-[12px] leading-relaxed text-ink-soft">
          {availability}
        </p>

        {userId && !installRequired && (
          <button
            type="button"
            onClick={() => void testDeviceNotification()}
            disabled={testing}
            className="touch-press mt-3 w-full rounded-[18px] border border-ink/[0.08] bg-white px-4 py-3 text-[13px] font-semibold text-ink shadow-card disabled:opacity-50"
          >
            {testing
              ? t("알림 연결 확인 중...", "Checking notification setup...")
              : t("이 기기에서 테스트 알림 보내기", "Send a test notification on this device")}
          </button>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {presets.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-disabled={installRequired}
              onClick={() => choosePreset(id)}
              className={`touch-press w-full rounded-[20px] px-4 py-3.5 text-left text-[15px] font-semibold text-ink ${
                installRequired ? "bg-ink/[0.025] opacity-55" : "bg-ink/[0.04]"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-disabled={installRequired}
            onClick={chooseCustom}
            className={`touch-press w-full rounded-[20px] px-4 py-3.5 text-left text-[15px] font-semibold text-ink ${
              installRequired ? "bg-ink/[0.025] opacity-55" : "bg-ink/[0.04]"
            }`}
          >
            {t("직접 설정", "Custom time")}
          </button>
          {armed && onDisarm ? (
            <button
              type="button"
              onClick={() => {
                onDisarm();
                onClose();
              }}
              className="touch-press mt-1 w-full rounded-[20px] bg-ink/[0.06] px-4 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("알림 끄기", "Turn off alarm")}
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="touch-press mt-1 w-full rounded-[20px] px-4 py-3.5 text-[15px] font-medium text-ink-soft"
            >
              {t("알림 없이 둘게요", "No alarm for now")}
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
