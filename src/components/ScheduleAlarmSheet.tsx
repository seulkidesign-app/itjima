import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";
import { PushProblemDetails } from "./PushProblemDetails";
import { useT, useLang } from "@/lib/i18n";
import type { AlarmPreset } from "@/lib/scheduleReminders";
import type { ScheduleItem } from "@/lib/store";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import {
  canRequestNotificationPermission,
  canSelectAlarmPresets,
  isIosSafariTab,
  readNotificationPermission,
  resolveAlarmSheetView,
  type AlarmSheetView,
} from "@/lib/alarmAvailability";
import { completeAlarmEnableAfterGrant } from "@/lib/alarmPermissionFlow";
import { describePushFailure } from "@/lib/push/pushDiagnostics";
import {
  executeDirectPushEnableFlow,
  type PushEnableStep,
} from "@/lib/push/directPushEnableFlow";
import {
  ensurePushSubscription,
} from "@/lib/push/pushSubscription";
import {
  diagnoseServerPushTest,
  fetchLatestActiveServerPushTest,
  fetchServerPushTestRow,
  finalizeServerPushTestSession,
  isServerPushTestTerminalPhase,
  readActiveServerPushTestId,
  serverPushTestMessage,
  startServerPushTest,
  SERVER_PUSH_TEST_POLL_MS,
  SERVER_PUSH_TEST_TIMEOUT_MS,
  type ServerPushTestPhase,
  type ServerPushTestRow,
} from "@/lib/push/serverPushTest";

type Props = {
  schedule: ScheduleItem | null;
  open: boolean;
  onClose: () => void;
  userId: string | null;
  onSelectPreset: (schedule: ScheduleItem, preset: AlarmPreset) => Promise<void>;
  onCustom: (schedule: ScheduleItem) => void;
  onDisarm?: () => void;
  armed?: boolean;
};

const LOCAL_TEST_SUCCESS = {
  ko: "이 기기에서 알림을 표시할 수 있어요.",
  en: "This device can display notifications.",
} as const;

export function ScheduleAlarmSheet({
  schedule,
  open,
  onClose,
  userId,
  onSelectPreset,
  onCustom,
  onDisarm,
  armed,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const [view, setView] = useState<AlarmSheetView>("default");
  const [pushReady, setPushReady] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [showDeniedHelp, setShowDeniedHelp] = useState(false);
  const [localStatusMessage, setLocalStatusMessage] = useState<string | null>(
    null,
  );
  const [serverTestRow, setServerTestRow] = useState<ServerPushTestRow | null>(
    null,
  );
  const [serverTestPhase, setServerTestPhase] =
    useState<ServerPushTestPhase | null>(null);
  const [serverTesting, setServerTesting] = useState(false);
  const [enableSteps, setEnableSteps] = useState<PushEnableStep[]>([]);
  const [showEnableProblemDetails, setShowEnableProblemDetails] = useState(false);
  const pollRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const serverStartRef = useRef(false);

  const refreshView = useCallback(() => {
    const perm = readNotificationPermission();
    const iosTab = isIosSafariTab();
    setView(resolveAlarmSheetView(perm, iosTab));
    return { perm, iosTab, view: resolveAlarmSheetView(perm, iosTab) };
  }, []);

  const applyEnableResult = useCallback(
    (result: Awaited<ReturnType<typeof completeAlarmEnableAfterGrant>>) => {
      if (result.pushSubscribed) {
        setPushReady(true);
        if (result.testNotificationShown) {
          setLocalStatusMessage(LOCAL_TEST_SUCCESS[lang]);
        } else {
          setLocalStatusMessage(
            t(
              "이 기기가 등록됐어요. 테스트 알림은 표시되지 않았지만 서버 알림은 받을 수 있어요.",
              "This device is registered. The test banner didn't show, but server alerts can still arrive.",
            ),
          );
        }
        setEnableError(null);
        return;
      }

      setPushReady(false);
      setLocalStatusMessage(null);
      setEnableError(
        describePushFailure(result.subscribe ?? { state: "expired" }, lang),
      );
    },
    [lang, t],
  );

  const verifyGrantedState = useCallback(async () => {
    if (!userId) {
      setPushReady(false);
      return;
    }
    setChecking(true);
    setEnableError(null);
    try {
      const push = await ensurePushSubscription(userId);
      setPushReady(push.ok);
    } finally {
      setChecking(false);
    }
  }, [userId]);

  const stopServerPoll = useCallback(() => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const refreshServerTestStatus = useCallback(
    async (rowId: string) => {
      if (!userId) return;
      const row = await fetchServerPushTestRow(userId, rowId);
      if (!row) return;
      setServerTestRow(row);
      const phase = diagnoseServerPushTest(row);
      setServerTestPhase(phase);
      if (isServerPushTestTerminalPhase(phase)) {
        stopServerPoll();
        setServerTesting(false);
        await finalizeServerPushTestSession(userId, phase);
      }
    },
    [userId, stopServerPoll],
  );

  const startServerPoll = useCallback(
    (rowId: string) => {
      stopServerPoll();
      setServerTesting(true);
      void refreshServerTestStatus(rowId);
      pollRef.current = window.setInterval(() => {
        void refreshServerTestStatus(rowId);
      }, SERVER_PUSH_TEST_POLL_MS);
      timeoutRef.current = window.setTimeout(() => {
        void refreshServerTestStatus(rowId);
      }, SERVER_PUSH_TEST_TIMEOUT_MS);
    },
    [refreshServerTestStatus, stopServerPoll],
  );

  const resumeServerPushTest = useCallback(async () => {
    if (!userId) return;
    const storedId = readActiveServerPushTestId(userId);
    const row =
      (storedId ? await fetchServerPushTestRow(userId, storedId) : null) ??
      (await fetchLatestActiveServerPushTest(userId));
    if (!row) return;

    setServerTestRow(row);
    const phase = diagnoseServerPushTest(row);
    setServerTestPhase(phase);
    if (phase === "waiting") {
      startServerPoll(row.id);
    } else if (isServerPushTestTerminalPhase(phase)) {
      setServerTesting(false);
    }
  }, [userId, startServerPoll]);

  useEffect(() => {
    if (!open) return;
    setEnableError(null);
    setShowDeniedHelp(false);
    setLocalStatusMessage(null);
    setPushReady(false);

    const { view: nextView } = refreshView();
    if (nextView === "granted" && userId) {
      void verifyGrantedState();
      void resumeServerPushTest();
    }
  }, [open, userId, refreshView, verifyGrantedState, resumeServerPushTest]);

  useEffect(() => {
    if (!open) {
      stopServerPoll();
      setServerTesting(false);
    }
  }, [open, stopServerPoll]);

  useEffect(() => () => stopServerPoll(), [stopServerPoll]);

  const handleEnableNotifications = () => {
    if (requesting || !canRequestNotificationPermission(view)) return;
    if (!userId) {
      setEnableError(
        t(
          "알림을 켜려면 먼저 로그인해 주세요.",
          "Sign in first to turn on notifications.",
        ),
      );
      return;
    }

    setEnableError(null);
    setLocalStatusMessage(null);
    setShowEnableProblemDetails(false);

    void (async () => {
      const result = await executeDirectPushEnableFlow(userId, lang);
      setEnableSteps(result.steps);
      setRequesting(false);
      setView(resolveAlarmSheetView(readNotificationPermission(), isIosSafariTab()));
      applyEnableResult({
        ok: result.pushSubscribed,
        pushSubscribed: result.pushSubscribed,
        testNotificationShown: result.pushSubscribed,
        subscribe: result.subscribe,
      });
      if (!result.pushSubscribed) {
        setEnableError(result.errorMessage ?? describePushFailure({ state: "expired" }, lang));
        setShowEnableProblemDetails(false);
      }
    })();
  };

  const handleRegisterThisDevice = () => {
    if (!userId || requesting) return;
    setEnableError(null);
    setLocalStatusMessage(null);
    setShowEnableProblemDetails(false);

    void (async () => {
      const result = await executeDirectPushEnableFlow(userId, lang);
      setEnableSteps(result.steps);
      setRequesting(false);
      applyEnableResult({
        ok: result.pushSubscribed,
        pushSubscribed: result.pushSubscribed,
        testNotificationShown: result.pushSubscribed,
        subscribe: result.subscribe,
      });
      if (!result.pushSubscribed) {
        setEnableError(result.errorMessage ?? describePushFailure({ state: "expired" }, lang));
        setShowEnableProblemDetails(false);
      }
    })();
  };

  const handleLocalDisplayTest = async () => {
    if (!userId || requesting) return;
    await handleRegisterThisDevice();
  };

  const handleServerPushTest = async () => {
    if (serverTesting || requesting || serverStartRef.current) return;
    serverStartRef.current = true;
    setServerTesting(true);
    setServerTestPhase("waiting");

    try {
      const result = await startServerPushTest(userId);
      if (!result.ok) {
        setServerTestPhase(result.phase);
        setServerTesting(false);
        return;
      }

      setServerTestRow(result.row);
      setServerTestPhase(diagnoseServerPushTest(result.row));
      startServerPoll(result.row.id);
    } finally {
      serverStartRef.current = false;
    }
  };

  const presets: { id: AlarmPreset; label: string }[] = [
    { id: "10m", label: t("10분 뒤", "In 10 min") },
    { id: "30m", label: t("30분 뒤", "In 30 min") },
    { id: "1h", label: t("1시간 뒤", "In 1 hour") },
    { id: "tonight", label: t("오늘 저녁", "Tonight") },
    { id: "tomorrow_am", label: t("내일 아침", "Tomorrow AM") },
  ];

  const presetsEnabled = canSelectAlarmPresets(view, pushReady);
  const isIos = isIosSafariTab() || /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!schedule) return null;

  const titleForView = (): string => {
    switch (view) {
      case "ios_install":
        return t(
          "알림을 받으려면 홈 화면에 추가해 주세요",
          "Add to Home Screen for notifications",
        );
      case "default":
        return t("알림을 켜볼까요?", "Turn on notifications?");
      case "granted":
        return pushReady
          ? t("알림이 켜져 있어요", "Notifications are on")
          : t("알림을 확인하는 중", "Checking notifications");
      case "denied":
        return t("알림이 꺼져 있어요", "Notifications are off");
      default:
        return t("알림을 사용할 수 없어요", "Notifications unavailable");
    }
  };

  const descriptionForView = (): string | null => {
    switch (view) {
      case "ios_install":
        return t(
          "아이폰에서는 홈 화면의 잊지마 앱에서만 알림을 받을 수 있어요.",
          "On iPhone, notifications only work from the Itjima app on your Home Screen.",
        );
      case "default":
        return t(
          "한 번만 허용하면, 정한 시간에 다시 알려드려요.",
          "Allow once and we'll remind you at the time you pick.",
        );
      case "denied":
        return isIos
          ? t(
              "설정 → 알림 → 잊지마에서 알림을 허용해 주세요.",
              "Settings → Notifications → Itjima → Allow Notifications.",
            )
          : t(
              "주소창 왼쪽 사이트 설정 → 알림 → 허용으로 변경해 주세요.",
              "Use site settings (left of the address bar) → Notifications → Allow.",
            );
      default:
        return null;
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} maxHeight="78dvh">
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[17px] font-bold text-ink">{titleForView()}</h2>
        <p className="mt-1 line-clamp-2 text-[14px] text-ink-soft">
          {scheduleDisplayTitle(schedule)}
        </p>
        {descriptionForView() && (
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
            {descriptionForView()}
          </p>
        )}

        {view === "ios_install" && (
          <ol className="mt-4 space-y-2 text-[13px] text-ink-soft">
            <li className="flex gap-2">
              <span className="font-bold text-ink">1.</span>
              {t("Safari 공유 버튼", "Safari Share button")}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-ink">2.</span>
              {t("홈 화면에 추가", "Add to Home Screen")}
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-ink">3.</span>
              {t("홈 화면의 잊지마로 다시 열기", "Open Itjima from Home Screen")}
            </li>
          </ol>
        )}

        {localStatusMessage && (
          <p
            className="mt-3 rounded-[14px] bg-primary/20 px-3 py-2 text-[13px] font-medium text-ink"
            data-testid="alarm-local-status"
          >
            {localStatusMessage}
          </p>
        )}

        {enableError && (
          <p className="mt-3 text-[13px] text-red-600">{enableError}</p>
        )}

        {enableError && enableSteps.length > 0 && (
          <PushProblemDetails
            steps={enableSteps}
            open={showEnableProblemDetails}
            onToggle={() => setShowEnableProblemDetails((value) => !value)}
            labels={{
              toggle: t("문제 확인하기", "Check what went wrong"),
            }}
          />
        )}

        {view === "default" && (
          <button
            type="button"
            data-testid="alarm-enable-button"
            disabled={requesting}
            onClick={handleEnableNotifications}
            className="itjima-cta-primary touch-press mt-4 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {requesting
              ? t("연결하는 중…", "Connecting…")
              : t("이 기기에서 알림 켜기", "Turn on notifications on this device")}
          </button>
        )}

        {view === "granted" && !pushReady && (
          <button
            type="button"
            data-testid="alarm-register-device-button"
            disabled={requesting || checking}
            onClick={handleRegisterThisDevice}
            className="itjima-cta-primary touch-press mt-4 w-full py-3.5 text-[15px] font-semibold text-ink disabled:opacity-50"
          >
            {requesting || checking
              ? t("등록하는 중…", "Registering…")
              : t("이 기기에서 알림 켜기", "Turn on notifications on this device")}
          </button>
        )}

        {view === "denied" && (
          <button
            type="button"
            data-testid="alarm-denied-help-button"
            onClick={() => setShowDeniedHelp((v) => !v)}
            className="itjima-cta-secondary touch-press mt-4 w-full px-4 py-3.5 text-[15px] font-semibold text-ink"
          >
            {t("설정 방법 보기", "How to change settings")}
          </button>
        )}

        {view === "denied" && showDeniedHelp && (
          <div className="mt-3 rounded-[16px] bg-ink/[0.04] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
            {isIos ? (
              <>
                <p>{t("1. iPhone 설정 앱을 엽니다", "1. Open iPhone Settings")}</p>
                <p className="mt-1">
                  {t("2. 알림 → 잊지마", "2. Notifications → Itjima")}
                </p>
                <p className="mt-1">
                  {t("3. 알림 허용을 켭니다", "3. Turn on Allow Notifications")}
                </p>
                <p className="mt-2 text-[12px]">
                  {t(
                    "변경 후 홈 화면 앱에서 다시 열어 주세요.",
                    "After changing, reopen from the Home Screen app.",
                  )}
                </p>
              </>
            ) : (
              <>
                <p>
                  {t(
                    "1. 주소창 왼쪽 자물쇠/설정 아이콘을 누릅니다",
                    "1. Click the lock/settings icon left of the address bar",
                  )}
                </p>
                <p className="mt-1">
                  {t("2. 사이트 설정 → 알림", "2. Site settings → Notifications")}
                </p>
                <p className="mt-1">
                  {t("3. 허용으로 변경합니다", "3. Change to Allow")}
                </p>
                <p className="mt-2 text-[12px]">
                  {t("변경 후 이 페이지를 새로고침해 주세요.", "Refresh this page after changing.")}
                </p>
              </>
            )}
          </div>
        )}

        {view === "granted" && pushReady && (
          <div className="mt-4 space-y-2">
            <button
              type="button"
              data-testid="alarm-local-display-test-button"
              disabled={requesting || checking}
              onClick={() => void handleLocalDisplayTest()}
              className="itjima-cta-secondary touch-press w-full px-4 py-3 text-[14px] font-semibold text-ink disabled:opacity-50"
            >
              {checking || requesting
                ? t("확인하는 중…", "Checking…")
                : t(
                    "이 기기에서 알림 표시 테스트",
                    "Test notification display on this device",
                  )}
            </button>
            <button
              type="button"
              data-testid="alarm-server-push-test-button"
              disabled={serverTesting || requesting || !userId}
              onClick={() => void handleServerPushTest()}
              className="itjima-cta-secondary touch-press w-full px-4 py-3 text-[14px] font-semibold text-ink disabled:opacity-50"
            >
              {serverTesting
                ? t("서버 테스트 진행 중…", "Server test in progress…")
                : t("1분 뒤 예약 알림 테스트", "Scheduled push test in 1 min")}
            </button>
            {serverTestPhase && (
              <div
                className="rounded-[14px] bg-ink/[0.04] px-3 py-2 text-[13px] text-ink-soft"
                data-testid="alarm-server-status"
              >
                <p>{serverPushTestMessage(serverTestPhase, lang)}</p>
                {serverTestRow && (
                  <p className="mt-1 text-[11px] text-ink-soft/70">
                    {t(
                      `시도 ${serverTestRow.attempt_count}회`,
                      `${serverTestRow.attempt_count} attempt(s)`,
                    )}
                    {serverTestRow.sent_at
                      ? ` · ${t("보냄", "sent")} ${new Date(serverTestRow.sent_at).toLocaleTimeString()}`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {presets.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              data-testid={`alarm-preset-${id}`}
              disabled={!presetsEnabled}
              onClick={() => {
                if (!presetsEnabled) return;
                void onSelectPreset(schedule, id).then(() => onClose());
              }}
              className="itjima-card touch-press w-full px-4 py-3.5 text-left text-[15px] font-semibold text-ink disabled:opacity-40"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            data-testid="alarm-preset-custom"
            disabled={!presetsEnabled}
            onClick={() => {
              if (!presetsEnabled) return;
              onCustom(schedule);
            }}
            className="itjima-card touch-press w-full px-4 py-3.5 text-left text-[15px] font-semibold text-ink disabled:opacity-40"
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
              className="itjima-cta-secondary touch-press mt-1 w-full px-4 py-3.5 text-[15px] font-semibold text-ink"
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
