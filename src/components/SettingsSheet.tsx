import {
  Bell,
  Clock3,
  Database,
  Globe,
  LogOut,
  Shield,
  User,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";
import { BottomSheet } from "./BottomSheet";
import {
  DeviceNotificationSheet,
  runDirectPushEnableFromSettings,
} from "./DeviceNotificationSheet";
import { DataPrivacySheet } from "./DataPrivacySheet";
import { useT, LanguageToggle, useLang } from "@/lib/i18n";
import type { PushEnableStep } from "@/lib/push/directPushEnableFlow";
import { resolveUserTimezone } from "@/lib/push/timezone";
import { useUserId } from "@/lib/store";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { signOutWithPushCleanup } from "@/lib/push/pushSignOut";
import { isDevicePushRegisteredForCurrentUser } from "@/lib/push/pushSubscription";
import { tap } from "@/lib/haptics";
import {
  focusComposer,
  hasUnsentComposerContent,
} from "@/lib/composerSafety";
import { clearComposerDraft } from "@/lib/composerDraft";

type Props = {
  open: boolean;
  onClose: () => void;
};

const rowClass =
  "itjima-settings-row flex min-h-[54px] w-full items-center gap-3 px-3.5 text-left text-[14px] font-medium text-ink transition-colors active:bg-ink/[0.04]";

export function SettingsSheet({ open, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const timezone = resolveUserTimezone();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [dataPrivacyOpen, setDataPrivacyOpen] = useState(false);
  const [notificationSteps, setNotificationSteps] = useState<
    PushEnableStep[] | null
  >(null);
  const [notificationFailed, setNotificationFailed] = useState(false);

  const handleNotificationSettings = () => {
    tap();
    if (!userId) {
      toast.error(
        t(
          "알림을 켜려면 먼저 로그인해 주세요.",
          "Sign in first to turn on notifications.",
        ),
      );
      return;
    }

    void (async () => {
      const result = await runDirectPushEnableFromSettings(userId, lang);
      setNotificationSteps(result.steps);
      setNotificationFailed(!result.pushSubscribed);
      if (!result.pushSubscribed) {
        setNotificationOpen(true);
        if (result.errorMessage) toast.error(result.errorMessage);
        return;
      }
      const verified = await isDevicePushRegisteredForCurrentUser();
      if (!verified) {
        setNotificationFailed(true);
        setNotificationOpen(true);
        toast.error(
          t(
            "등록을 확인하지 못했어요. 다시 시도해 주세요.",
            "Couldn't verify registration. Please try again.",
          ),
        );
        return;
      }
      toast.success(
        t(
          "이 기기에서 알림을 받을 수 있어요.",
          "This device can receive notifications.",
        ),
      );
    })();
  };

  const handleSignOut = async () => {
    tap();

    if (hasUnsentComposerContent()) {
      toast.warning(
        t(
          "아직 남기지 않은 초안이 있어요. 먼저 확인해 주세요.",
          "You still have an uncaptured draft. Check it before signing out.",
        ),
      );
      onClose();
      if (!focusComposer()) {
        await navigate({ to: "/" });
        window.setTimeout(() => focusComposer(), 120);
      }
      return;
    }

    const { error } = await signOutWithPushCleanup("SettingsSheet.tsx");
    if (error) {
      toast.error(
        t(
          "로그아웃하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
          "Couldn't sign out. Check your connection and try again.",
        ),
      );
      return;
    }

    clearComposerDraft();
    toast(t("로그아웃됨", "Signed out"));
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="78dvh"
      title={t("설정", "Settings")}
    >
      <div className="px-5 pb-8 pt-1">
        <div className="px-1 pb-4">
          <h2 className="text-[22px] font-bold tracking-[-0.03em] text-ink">
            {t("설정", "Settings")}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            {t(
              "계정, 알림, 언어와 데이터 통제를 관리해요.",
              "Manage your account, reminders, language, and data controls.",
            )}
          </p>
        </div>

        <div className="itjima-settings-group overflow-hidden">
          {!userId && (
            <Link
              to="/auth"
              onClick={() => {
                tap();
                onClose();
              }}
              className={`${rowClass} border-b border-ink/[0.06]`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/20 text-ink">
                <User size={17} strokeWidth={2.1} aria-hidden />
              </span>
              <span className="flex-1">{t("로그인", "Sign in")}</span>
            </Link>
          )}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={onClose}
              className={`${rowClass} border-b border-ink/[0.06]`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
                <Shield size={17} strokeWidth={2.1} aria-hidden />
              </span>
              <span className="flex-1">{t("관리자", "Admin")}</span>
            </Link>
          )}

          <button
            type="button"
            data-testid="settings-notification-settings-row"
            onClick={handleNotificationSettings}
            className={`${rowClass} border-b border-ink/[0.06]`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/20 text-ink">
              <Bell size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex-1">
              {t("알림 설정", "Notification settings")}
            </span>
          </button>

          <div
            className={`${rowClass} border-b border-ink/[0.06]`}
            aria-label={t(`현재 시간대 ${timezone}`, `Current time zone ${timezone}`)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
              <Clock3 size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block">{t("시간대", "Time zone")}</span>
              <span className="mt-0.5 block truncate text-[11px] font-normal text-ink-soft">
                {t(
                  "기기 변경 시 알림을 자동 업데이트해요",
                  "Reminders update automatically when this changes",
                )}
              </span>
            </span>
            <span className="max-w-[8.5rem] truncate text-[11px] font-semibold text-ink-soft">
              {timezone}
            </span>
          </div>

          <button
            type="button"
            data-testid="settings-data-privacy-row"
            onClick={() => {
              tap();
              setDataPrivacyOpen(true);
            }}
            className={`${rowClass} border-b border-ink/[0.06]`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
              <Database size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex-1">{t("데이터와 개인정보", "Data & privacy")}</span>
          </button>

          <div className={rowClass}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.06] text-ink-soft">
              <Globe size={17} strokeWidth={2.1} aria-hidden />
            </span>
            <span className="flex-1">{t("언어", "Language")}</span>
            <LanguageToggle />
          </div>
        </div>

        {userId && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[16px] border border-red-500/10 bg-red-500/[0.06] px-4 text-[14px] font-semibold text-red-600 transition-colors active:bg-red-500/[0.1]"
          >
            <LogOut size={17} strokeWidth={2.1} aria-hidden />
            {t("로그아웃", "Sign out")}
          </button>
        )}
      </div>
      <DeviceNotificationSheet
        open={notificationOpen}
        onClose={() => setNotificationOpen(false)}
        userId={userId}
        initialSteps={notificationSteps}
        initialFailed={notificationFailed}
      />
      <DataPrivacySheet
        open={dataPrivacyOpen}
        onClose={() => setDataPrivacyOpen(false)}
        userId={userId}
      />
    </BottomSheet>
  );
}
