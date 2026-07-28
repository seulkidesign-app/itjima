import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { PushProblemDetails } from "./PushProblemDetails";
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
import { probeStoredRegistration } from "@/lib/push/deviceNotificationEnable";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string | null;
  initialSteps?: PushEnableStep[] | null;
  initialFailed?: boolean;
};

export function DeviceNotificationSheet({
  open,
  onClose,
  userId,
  initialSteps = null,
  initialFailed = false,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [view, setView] = useState<AlarmSheetView>("default");
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);
  const [steps, setSteps] = useState<PushEnableStep[]>([]);
  const [showProblemDetails, setShowProblemDetails] = useState(false);
  const [running, setRunning] = useState(false);

  const refreshView = useCallback(() => {
    const perm = readNotificationPermission();
    const iosTab = isIosSafariTab();
    setView(resolveAlarmSheetView(perm, iosTab));
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatusMessage(null);
    setShowProblemDetails(false);
    refreshView();
    if (initialSteps?.length) setSteps(initialSteps);
    if (initialFailed && initialSteps?.length) {
      setShowProblemDetails(false);
    }
    if (userId) void probeStoredRegistration(userId).then(setRegistered);
  }, [open, userId, initialSteps, initialFailed, refreshView]);

  const applyResult = (
    result: Awaited<ReturnType<typeof executeDirectPushEnableFlow>>,
  ) => {
    setSteps(result.steps);
    refreshView();
    setView(resolveAlarmSheetView(readNotificationPermission(), isIosSafariTab()));

    if (!result.pushSubscribed) {
      setRegistered(false);
      setError(
        result.errorMessage ??
          t("알림 연결에 실패했어요.", "Couldn't connect notifications."),
      );
      setShowProblemDetails(false);
      return;
    }

    setRegistered(true);
    setError(null);
    setShowProblemDetails(false);
    setStatusMessage(
      t(
        "이 기기에서 알림을 받을 수 있어요.",
        "This device can receive notifications.",
      ),
    );
  };

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
    setShowProblemDetails(false);

    void (async () => {
      const result = await executeDirectPushEnableFlow(userId, lang);
      setRunning(false);
      applyResult(result);
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
                "iPhone·iPad는 홈 화면 앱에서, Mac·Android·PC는 브라우저에서 바로 등록할 수 있어요.",
                "Register from the Home Screen app on iPhone/iPad, or directly in the browser on Mac, Android, and desktop.",
              )}
            </p>
          </div>
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

        {showEnableButton && (
          <button
            type="button"
            data-testid="settings-enable-notifications-button"
            disabled={running}
            onClick={handleEnableClick}
            className="itjima-cta-primary touch-press mt-4 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
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
              className="itjima-card touch-press mt-3 w-full rounded-[20px] bg-ink/[0.04] px-4 py-3.5 text-[15px] font-semibold text-ink"
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

export async function runDirectPushEnableFromSettings(
  userId: string,
  lang: "ko" | "en",
) {
  return executeDirectPushEnableFlow(userId, lang);
}
