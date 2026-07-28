import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useLang, useT } from "@/lib/i18n";
import {
  canRequestNotificationPermission,
  isIosSafariTab,
  readNotificationPermission,
  resolveAlarmSheetView,
  type AlarmSheetView,
} from "@/lib/alarmAvailability";
import { describePushFailure } from "@/lib/push/pushDiagnostics";
import {
  probeStoredRegistration,
  refreshDeviceRegistration,
  requestPermissionAndRegisterDevice,
} from "@/lib/push/deviceNotificationEnable";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
};

const LOCAL_TEST_SUCCESS = {
  ko: "이 기기에서 알림을 표시할 수 있어요.",
  en: "This device can display notifications.",
} as const;

export function DeviceNotificationSheet({ open, onClose, userId }: Props) {
  const t = useT();
  const { lang } = useLang();
  const [view, setView] = useState<AlarmSheetView>("default");
  const [requesting, setRequesting] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);

  const refreshView = useCallback(() => {
    const perm = readNotificationPermission();
    const iosTab = isIosSafariTab();
    const nextView = resolveAlarmSheetView(perm, iosTab);
    setView(nextView);
    return nextView;
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatusMessage(null);
    setRegistered(false);
    const nextView = refreshView();
    if (userId && nextView === "granted") {
      void probeStoredRegistration(userId).then(setRegistered);
    }
  }, [open, userId, refreshView]);

  const handleEnable = async () => {
    if (requesting) return;
    if (!userId) {
      setError(
        t(
          "알림을 켜려면 먼저 로그인해 주세요.",
          "Sign in first to turn on notifications.",
        ),
      );
      return;
    }

    setRequesting(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result =
        view === "granted" && Notification.permission === "granted"
          ? await refreshDeviceRegistration(userId, lang)
          : await requestPermissionAndRegisterDevice(userId, lang);

      setView(resolveAlarmSheetView(readNotificationPermission(), isIosSafariTab()));

      if (!result.pushSubscribed) {
        setRegistered(false);
        setError(
          result.errorMessage ??
            describePushFailure(
              result.subscribe ?? { state: "expired" },
              lang,
            ),
        );
        return;
      }

      setRegistered(true);
      if (result.testNotificationShown) {
        setStatusMessage(LOCAL_TEST_SUCCESS[lang]);
      } else {
        setStatusMessage(
          t(
            "이 기기가 등록됐어요. 테스트 알림은 표시되지 않았지만 서버 알림은 받을 수 있어요.",
            "This device is registered. The test banner didn't show, but server alerts can still arrive.",
          ),
        );
      }
    } catch {
      setError(
        t(
          "알림 권한 요청에 실패했어요.",
          "Couldn't request notification permission.",
        ),
      );
    } finally {
      setRequesting(false);
    }
  };

  const isIos =
    isIosSafariTab() || /iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="72dvh"
      title={t("이 기기 알림", "Notifications on this device")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/20 text-ink">
            <Bell size={18} strokeWidth={2.1} aria-hidden />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">
              {view === "ios_install"
                ? t(
                    "홈 화면 앱에서 알림 켜기",
                    "Turn on notifications in the Home Screen app",
                  )
                : registered
                  ? t("이 기기가 등록됐어요", "This device is registered")
                  : t("이 기기에서 알림 켜기", "Turn on notifications on this device")}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {view === "ios_install"
                ? t(
                    "아이폰 Safari 탭에서는 Web Push를 지원하지 않아요. 홈 화면에 추가한 잊지마 앱에서만 가능해요.",
                    "Web Push doesn't work in an iPhone Safari tab. Use the Itjima app added to your Home Screen.",
                  )
                : t(
                    "Mac·Windows·Android·홈 화면 PWA마다 기기별로 한 번씩 등록해요. 다른 기기의 등록은 지우지 않아요.",
                    "Register each device once — Mac, Windows, Android, or Home Screen PWA. Other devices stay registered.",
                  )}
            </p>
          </div>
        </div>

        {view === "ios_install" && (
          <ol className="space-y-2 text-[13px] text-ink-soft">
            <li>1. {t("Safari 공유 버튼", "Safari Share button")}</li>
            <li>2. {t("홈 화면에 추가", "Add to Home Screen")}</li>
            <li>3. {t("홈 화면의 잊지마로 다시 열기", "Open Itjima from Home Screen")}</li>
          </ol>
        )}

        {statusMessage && (
          <p className="mt-3 rounded-[14px] bg-primary/20 px-3 py-2 text-[13px] font-medium text-ink">
            {statusMessage}
          </p>
        )}

        {error && <p className="mt-3 text-[13px] text-red-600">{error}</p>}

        {canRequestNotificationPermission(view) && (
          <button
            type="button"
            data-testid="settings-enable-notifications-button"
            disabled={requesting}
            onClick={() => void handleEnable()}
            className="touch-press mt-4 w-full rounded-[20px] bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {requesting
              ? t("연결하는 중…", "Connecting…")
              : t("이 기기에서 알림 켜기", "Turn on notifications on this device")}
          </button>
        )}

        {view === "granted" && (
          <button
            type="button"
            data-testid="settings-refresh-notifications-button"
            disabled={requesting}
            onClick={() => void handleEnable()}
            className="touch-press mt-4 w-full rounded-[20px] bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {requesting
              ? t("등록하는 중…", "Registering…")
              : registered
                ? t("이 기기 다시 등록", "Re-register this device")
                : t("이 기기에서 알림 켜기", "Turn on notifications on this device")}
          </button>
        )}

        {view === "denied" && (
          <>
            <button
              type="button"
              data-testid="settings-denied-help-button"
              onClick={() => setShowDeniedHelp((value) => !value)}
              className="touch-press mt-4 w-full rounded-[20px] bg-ink/[0.06] px-4 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("설정 방법 보기", "How to change settings")}
            </button>
            {showDeniedHelp && (
              <div className="mt-3 rounded-[16px] bg-ink/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                {isIos ? (
                  <>
                    <p>{t("1. iPhone 설정 앱", "1. Open iPhone Settings")}</p>
                    <p className="mt-1">{t("2. 알림 → 잊지마", "2. Notifications → Itjima")}</p>
                    <p className="mt-1">
                      {t("3. 알림 허용", "3. Allow Notifications")}
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      {t(
                        "1. 주소창 왼쪽 사이트 설정",
                        "1. Site settings left of the address bar",
                      )}
                    </p>
                    <p className="mt-1">
                      {t("2. 알림 → 허용", "2. Notifications → Allow")}
                    </p>
                    <p className="mt-2 text-[12px]">
                      {t("변경 후 새로고침", "Refresh after changing")}
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
