import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { useLang, useT } from "@/lib/i18n";
import {
  isIosSafariTab,
  readNotificationPermission,
  resolveAlarmSheetView,
  type AlarmSheetView,
} from "@/lib/alarmAvailability";
import {
  executeDirectPushEnableFlow,
  type PushEnableStep,
} from "@/lib/push/directPushEnableFlow";
import { isStandalonePwa } from "@/lib/push/pushSubscription";
import { probeStoredRegistration } from "@/lib/push/deviceNotificationEnable";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  /** When set, render steps from a flow that already ran (e.g. Settings first tap). */
  initialSteps?: PushEnableStep[] | null;
};

function readStandaloneMatches(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function DeviceNotificationSheet({
  open,
  onClose,
  userId,
  initialSteps = null,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [view, setView] = useState<AlarmSheetView>("default");
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);
  const [steps, setSteps] = useState<PushEnableStep[]>([]);
  const [running, setRunning] = useState(false);
  const [permissionLabel, setPermissionLabel] = useState<string>("—");
  const [standaloneLabel, setStandaloneLabel] = useState<string>("—");

  const refreshDiagnostics = useCallback(() => {
    const perm = readNotificationPermission();
    const iosTab = isIosSafariTab();
    setView(resolveAlarmSheetView(perm, iosTab));
    const permission =
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported";
    setPermissionLabel(permission);
    const standaloneInfo = JSON.stringify({
      matchMediaStandalone: readStandaloneMatches(),
      navigatorStandalone:
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      resolvedStandalone: isStandalonePwa(),
    });
    setStandaloneLabel(standaloneInfo);
    console.info("[itjima:push] sheet_diagnostics", {
      permission,
      standalone: standaloneInfo,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatusMessage(null);
    refreshDiagnostics();
    if (initialSteps?.length) setSteps(initialSteps);
    if (userId) void probeStoredRegistration(userId).then(setRegistered);
  }, [open, userId, initialSteps, refreshDiagnostics]);

  const handleEnableClick = () => {
    if (running) return;
    if (!userId) {
      setError(
        t(
          "알림을 켜려면 먼저 로그인해 주세요.",
          "Sign in first to turn on notifications.",
        ),
      );
      return;
    }

    setError(null);
    setStatusMessage(null);

    void (async () => {
      const result = await executeDirectPushEnableFlow(userId, lang);
      setSteps(result.steps);
      setRunning(false);
      refreshDiagnostics();
      setView(
        resolveAlarmSheetView(readNotificationPermission(), isIosSafariTab()),
      );

      if (!result.pushSubscribed) {
        setRegistered(false);
        setError(result.errorMessage ?? t("알림 연결에 실패했어요.", "Couldn't connect notifications."));
        return;
      }

      setRegistered(true);
      setStatusMessage(
        t(
          "이 기기가 등록됐어요. push_subscriptions에 저장됐습니다.",
          "This device is registered and saved to push_subscriptions.",
        ),
      );
    })();
  };

  const isIos =
    isIosSafariTab() || /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const showEnableButton = view !== "ios_install" && view !== "unsupported";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78dvh"
      title={t("알림 설정", "Notification settings")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-primary/20 text-ink">
            <Bell size={18} strokeWidth={2.1} aria-hidden />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">
              {t("알림 설정", "Notification settings")}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {t(
                "버튼을 누르면 iOS 권한창 → 푸시 구독 → DB 저장 순으로 진행돼요.",
                "Tap the button to run iOS permission → push subscribe → DB save in one direct flow.",
              )}
            </p>
          </div>
        </div>

        <div
          className="rounded-[14px] bg-ink/[0.04] px-3 py-2 text-[12px] leading-relaxed text-ink-soft"
          data-testid="push-live-diagnostics"
        >
          <p>
            <span className="font-semibold text-ink">standalone: </span>
            {standaloneLabel}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-ink">Notification.permission: </span>
            {permissionLabel}
          </p>
        </div>

        {view === "ios_install" && (
          <ol className="mt-3 space-y-2 text-[13px] text-ink-soft">
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

        {steps.length > 0 && (
          <ol
            className="mt-3 space-y-1.5 text-[12px] text-ink-soft"
            data-testid="push-enable-steps"
          >
            {steps.map((entry) => (
              <li
                key={entry.id}
                className={entry.ok ? "text-ink-soft" : "text-red-600"}
              >
                {entry.ok ? "✓" : "✗"} {entry.label}: {entry.detail}
              </li>
            ))}
          </ol>
        )}

        {showEnableButton && (
          <button
            type="button"
            data-testid="settings-enable-notifications-button"
            disabled={running}
            onClick={handleEnableClick}
            className="touch-press mt-4 w-full rounded-[20px] bg-ink py-3.5 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {running
              ? t("진행 중…", "Working…")
              : t("알림 설정", "Notification settings")}
          </button>
        )}

        {view === "denied" && (
          <>
            <button
              type="button"
              data-testid="settings-denied-help-button"
              onClick={() => setShowDeniedHelp((value) => !value)}
              className="touch-press mt-3 w-full rounded-[20px] bg-ink/[0.06] px-4 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("설정 방법 보기", "How to change settings")}
            </button>
            {showDeniedHelp && (
              <div className="mt-3 rounded-[16px] bg-ink/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                {isIos ? (
                  <>
                    <p>{t("1. iPhone 설정 앱", "1. Open iPhone Settings")}</p>
                    <p className="mt-1">{t("2. 알림 → 잊지마", "2. Notifications → Itjima")}</p>
                    <p className="mt-1">{t("3. 알림 허용", "3. Allow Notifications")}</p>
                  </>
                ) : (
                  <>
                    <p>{t("1. 사이트 설정", "1. Site settings")}</p>
                    <p className="mt-1">{t("2. 알림 → 허용", "2. Notifications → Allow")}</p>
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

/** Callable from Settings on first tap — no modal open before requestPermission. */
export async function runDirectPushEnableFromSettings(
  userId: string,
  lang: "ko" | "en",
) {
  return executeDirectPushEnableFlow(userId, lang);
}
