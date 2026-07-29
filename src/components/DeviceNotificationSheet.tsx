import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { PushProblemDetails } from "./PushProblemDetails";
import { useLang, useT } from "@/lib/i18n";
import {
  isIosSafariTab,
  readNotificationPermission,
} from "@/lib/alarmAvailability";
import {
  executeDirectPushEnableFlow,
  type PushEnableStep,
} from "@/lib/push/directPushEnableFlow";
import {
  ensurePushSubscriptionForCurrentUser,
  showDeviceNotificationTest,
} from "@/lib/push/pushSubscription";
import {
  disconnectDevicePushForCurrentUser,
  isDevicePushRegisteredForCurrentUser,
} from "@/lib/push/pushSubscriptionAccount";
import {
  getNotificationSettingsStatus,
  type NotificationSettingsStatus,
} from "@/lib/push/notificationSettingsStatus";
import { notificationDeniedGuideSteps } from "@/lib/push/notificationDeniedGuide";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  initialSteps?: PushEnableStep[] | null;
  initialFailed?: boolean;
};

function statusLabel(
  status: NotificationSettingsStatus,
  t: ReturnType<typeof useT>,
): string {
  switch (status) {
    case "active":
      return t("알림 사용 중", "Notifications active");
    case "blocked":
      return t("이 기기에서 차단됨", "Blocked on this device");
    default:
      return t("설정 필요", "Setup needed");
  }
}

function statusDescription(
  status: NotificationSettingsStatus,
  t: ReturnType<typeof useT>,
): string {
  switch (status) {
    case "active":
      return t(
        "이 기기에서 일정 알림을 받을 수 있어요.",
        "This device can receive schedule notifications.",
      );
    case "blocked":
      return t(
        "브라우저에서 알림이 차단되어 있어요.",
        "Notifications are blocked in your browser.",
      );
    default:
      return t(
        "알림을 켜면 앱을 닫아도 일정 시간에 알려드려요.",
        "Turn on notifications to get reminders even when the app is closed.",
      );
  }
}

export function DeviceNotificationSheet({
  open,
  onClose,
  userId,
  initialSteps = null,
  initialFailed = false,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [status, setStatus] = useState<NotificationSettingsStatus>("setup_needed");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);
  const [steps, setSteps] = useState<PushEnableStep[]>([]);
  const [showProblemDetails, setShowProblemDetails] = useState(false);
  const [running, setRunning] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatus(await getNotificationSettingsStatus());
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatusMessage(null);
    setShowProblemDetails(false);
    setShowDeniedHelp(false);
    if (initialSteps?.length) setSteps(initialSteps);
    if (initialFailed && initialSteps?.length) {
      setShowProblemDetails(false);
    }
    void refreshStatus();
  }, [open, userId, initialSteps, initialFailed, refreshStatus]);

  const applyEnableResult = (
    result: Awaited<ReturnType<typeof executeDirectPushEnableFlow>>,
  ) => {
    setSteps(result.steps);
    void refreshStatus();

    if (!result.pushSubscribed) {
      setError(
        result.errorMessage ??
          t("알림 연결에 실패했어요.", "Couldn't connect notifications."),
      );
      setShowProblemDetails(false);
      return;
    }

    setError(null);
    setShowProblemDetails(false);
    setStatusMessage(
      t(
        "이 기기에서 알림을 받을 수 있어요.",
        "This device can receive notifications.",
      ),
    );
    void isDevicePushRegisteredForCurrentUser().then((active) => {
      if (!active) {
        setError(
          t(
            "등록을 확인하지 못했어요. 다시 시도해 주세요.",
            "Couldn't verify registration. Please try again.",
          ),
        );
      }
    });
  };

  const handleReconnect = () => {
    if (running || !userId) {
      if (!userId) {
        setError(
          t(
            "알림을 켜려면 먼저 로그인해 주세요.",
            "Sign in first to turn on notifications.",
          ),
        );
      }
      return;
    }

    setRunning(true);
    setError(null);
    setStatusMessage(null);
    setShowProblemDetails(false);

    void (async () => {
      try {
        if (readNotificationPermission() === "granted") {
          await ensurePushSubscriptionForCurrentUser();
          const registered = await isDevicePushRegisteredForCurrentUser();
          if (registered) {
            setStatusMessage(
              t("알림 연결이 복구됐어요.", "Notification connection restored."),
            );
            await refreshStatus();
            return;
          }
        }
        const result = await executeDirectPushEnableFlow(userId, lang);
        applyEnableResult(result);
      } finally {
        setRunning(false);
      }
    })();
  };

  const handleTestNotification = () => {
    if (running || !userId) return;
    setRunning(true);
    setError(null);
    setStatusMessage(null);
    void (async () => {
      try {
        const result = await showDeviceNotificationTest(userId);
        if (!result.ok) {
          setError(
            t(
              "테스트 알림을 보내지 못했어요.",
              "Couldn't send a test notification.",
            ),
          );
          await refreshStatus();
          return;
        }
        setStatusMessage(
          t("테스트 알림을 보냈어요.", "Test notification sent."),
        );
        await refreshStatus();
      } finally {
        setRunning(false);
      }
    })();
  };

  const handleDisconnect = () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setStatusMessage(null);
    void (async () => {
      try {
        await disconnectDevicePushForCurrentUser();
        setStatusMessage(
          t("이 기기 알림을 껐어요.", "Notifications turned off on this device."),
        );
        await refreshStatus();
      } finally {
        setRunning(false);
      }
    })();
  };

  const iosInstall = isIosSafariTab() && status === "setup_needed";
  const deniedSteps = notificationDeniedGuideSteps(lang === "en" ? "en" : "ko");

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78dvh"
      title={t("알림 설정", "Notification settings")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-[14px] ${
              status === "active"
                ? "bg-primary/25 text-ink"
                : status === "blocked"
                  ? "bg-red-500/10 text-red-700"
                  : "bg-ink/[0.06] text-ink-soft"
            }`}
          >
            {status === "active" ? (
              <BellRing size={18} strokeWidth={2.1} aria-hidden />
            ) : status === "blocked" ? (
              <BellOff size={18} strokeWidth={2.1} aria-hidden />
            ) : (
              <Bell size={18} strokeWidth={2.1} aria-hidden />
            )}
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">
              {statusLabel(status, t)}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {statusDescription(status, t)}
            </p>
          </div>
        </div>

        {iosInstall && (
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

        {error && steps.length > 0 && (
          <PushProblemDetails
            steps={steps}
            open={showProblemDetails}
            onToggle={() => setShowProblemDetails((value) => !value)}
            labels={{
              toggle: t("문제 확인하기", "Check what went wrong"),
            }}
          />
        )}

        {status === "active" && (
          <button
            type="button"
            data-testid="settings-test-notification-button"
            disabled={running}
            onClick={handleTestNotification}
            className="itjima-cta-primary touch-press mt-4 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {running
              ? t("진행 중…", "Working…")
              : t("테스트 알림 보내기", "Send test notification")}
          </button>
        )}

        {status !== "active" && status !== "blocked" && !iosInstall && (
          <button
            type="button"
            data-testid="settings-enable-notifications-button"
            disabled={running}
            onClick={handleReconnect}
            className="itjima-cta-primary touch-press mt-4 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {running
              ? t("진행 중…", "Working…")
              : t("이 기기 알림 다시 연결", "Reconnect notifications on this device")}
          </button>
        )}

        {status === "blocked" && (
          <>
            <p className="mt-3 rounded-[14px] bg-ink/[0.04] px-3 py-2.5 text-[13px] text-ink-soft">
              {t(
                "일정은 저장할 수 있지만, 알림을 받으려면 브라우저 설정에서 허용해야 해요.",
                "You can save schedules, but you'll need to allow notifications in browser settings.",
              )}
            </p>
            <button
              type="button"
              data-testid="settings-denied-help-button"
              onClick={() => setShowDeniedHelp((value) => !value)}
              className="itjima-card touch-press mt-3 w-full rounded-[20px] bg-ink/[0.04] px-4 py-3.5 text-[15px] font-semibold text-ink"
            >
              {t("알림 켜는 방법 보기", "How to turn notifications on")}
            </button>
            {showDeniedHelp && (
              <ol className="mt-3 space-y-2 rounded-[16px] bg-ink/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                {deniedSteps.map((step, index) => (
                  <li key={index}>
                    {index + 1}. {step.text}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {status === "active" && (
          <button
            type="button"
            data-testid="settings-disconnect-notifications-button"
            disabled={running}
            onClick={handleDisconnect}
            className="itjima-cta-secondary touch-press mt-3 w-full px-4 py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {t("이 기기 알림 끄기", "Turn off notifications on this device")}
          </button>
        )}

        {status === "setup_needed" && readNotificationPermission() === "granted" && (
          <button
            type="button"
            data-testid="settings-reconnect-granted-button"
            disabled={running}
            onClick={handleReconnect}
            className="itjima-cta-secondary touch-press mt-3 w-full px-4 py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {t("이 기기 알림 다시 연결", "Reconnect notifications on this device")}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

export async function runDirectPushEnableFromSettings(
  userId: string,
  lang: "ko" | "en",
) {
  return executeDirectPushEnableFlow(userId, lang);
}
