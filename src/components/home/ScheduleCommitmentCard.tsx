import {
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  Pencil,
  Repeat2,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import type { InboxItem } from "@/lib/store";
import {
  buildNaturalScheduleDraft,
  formatCommitmentDate,
  formatCommitmentReminder,
  formatCommitmentRepeat,
  formatCommitmentTime,
} from "@/lib/naturalScheduleDraft";
import {
  ensurePushSubscriptionForCurrentUser,
  pushSupportState,
} from "@/lib/push/pushSubscription";
import { useLang, useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { confirm as confirmHaptic } from "@/lib/haptics";

type Props = {
  item: InboxItem;
  onConfirm: (item: InboxItem) => void | Promise<void>;
  onAdjust: (item: InboxItem) => void;
  onDismiss: () => void;
};

async function prepareNotificationsBestEffort(
  hasReminder: boolean,
): Promise<"granted" | "skipped" | "blocked" | "unsupported"> {
  if (
    !hasReminder ||
    typeof window === "undefined" ||
    import.meta.env.VITE_E2E === "true"
  ) {
    return "skipped";
  }

  const support = pushSupportState();
  if (support === "not_installed" || support === "unsupported") {
    return "unsupported";
  }
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return "unsupported";
    }
  }
  if (permission !== "granted") return "blocked";

  try {
    const push = await ensurePushSubscriptionForCurrentUser();
    return push.ok ? "granted" : "unsupported";
  } catch {
    return "unsupported";
  }
}

export function ScheduleCommitmentCard({
  item,
  onConfirm,
  onAdjust,
  onDismiss,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const draft = buildNaturalScheduleDraft(item);
  const repeatLabel = formatCommitmentRepeat(draft.options.repeat, uiLang);
  const hasReminder = draft.options.reminderMinutes !== null;

  const confirm = async () => {
    confirmHaptic();
    track("commitment_card_confirmed", {
      has_reminder: hasReminder,
      reminder_minutes: draft.options.reminderMinutes ?? undefined,
      repeat: draft.options.repeat ?? undefined,
      all_day: draft.options.allDay,
      reminder_explicit: draft.reminderExplicit,
    });

    // Permission is requested from this real click. Saving never depends on
    // permission: the schedule is canonical even when this device cannot push.
    const notificationPromise = prepareNotificationsBestEffort(hasReminder);

    try {
      await onConfirm(item);
      onDismiss();
      const notification = await notificationPromise;
      if (hasReminder && notification === "blocked") {
        toast.message(
          t(
            "일정은 기억했어요. 기기 알림은 브라우저 설정에서 켜 주세요.",
            "The plan is saved. Enable browser notifications to receive alerts on this device.",
          ),
          { duration: 4200 },
        );
      } else if (hasReminder && notification === "unsupported") {
        toast.message(
          t(
            "일정은 기억했어요. 닫힌 앱 알림은 로그인·PWA 설치 후 사용할 수 있어요.",
            "The plan is saved. Closed-app alerts need a signed-in installed PWA.",
          ),
          { duration: 4200 },
        );
      }
    } catch {
      toast.error(
        t(
          "아직 기억하지 못했어요. 다시 눌러 주세요.",
          "Not saved yet. Please try again.",
        ),
      );
    }
  };

  return (
    <div
      className="commitment-card ml-1 w-full max-w-[min(360px,95%)] overflow-hidden rounded-[20px] border border-ink/8 bg-[#fafaf8] shadow-card"
      data-testid="schedule-commitment-card"
      data-reminder={draft.options.reminderMinutes ?? "off"}
      data-repeat={draft.options.repeat ?? "none"}
    >
      <div className="px-3.5 pb-2 pt-3.5">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-primary/55 text-ink">
            <Check size={15} strokeWidth={2.6} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[-0.01em] text-ink-soft">
              {t("이렇게 기억할게요", "I'll remember it like this")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              track("commitment_card_adjusted", {
                has_reminder: hasReminder,
                repeat: draft.options.repeat ?? undefined,
              });
              onAdjust(item);
            }}
            className="touch-press inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold text-ink-soft hover:bg-ink/[0.05]"
            data-testid="commitment-adjust"
          >
            <Pencil size={12} aria-hidden />
            {t("조금 수정", "Adjust")}
          </button>
        </div>

        <strong
          className="mt-2.5 block text-[16px] font-bold leading-snug tracking-[-0.02em] text-ink"
          data-testid="commitment-title"
        >
          {draft.text}
        </strong>
      </div>

      <div className="border-y border-ink/[0.06] bg-white/80 px-3.5 py-1">
        <CommitmentRow
          icon={<CalendarDays size={14} aria-hidden />}
          label={t("날짜", "Date")}
          value={formatCommitmentDate(draft.start, uiLang)}
          testId="commitment-date"
        />
        <CommitmentRow
          icon={<Clock3 size={14} aria-hidden />}
          label={t("시간", "Time")}
          value={formatCommitmentTime(
            draft.start,
            draft.options.allDay,
            uiLang,
          )}
          testId="commitment-time"
        />
        <CommitmentRow
          icon={<BellRing size={14} aria-hidden />}
          label={t("알림", "Reminder")}
          value={formatCommitmentReminder(
            draft.options.reminderMinutes,
            uiLang,
          )}
          testId="commitment-reminder"
        />
        {repeatLabel && (
          <CommitmentRow
            icon={<Repeat2 size={14} aria-hidden />}
            label={t("반복", "Repeat")}
            value={repeatLabel}
            testId="commitment-repeat"
          />
        )}
      </div>

      <div className="flex gap-2 p-3">
        <button
          type="button"
          data-testid="commitment-confirm"
          onClick={() => void confirm()}
          className="pill-yellow touch-press min-h-[44px] flex-1 px-4 py-2 text-[13px] font-bold text-ink"
        >
          {t("맞아요", "Looks right")}
        </button>
        <button
          type="button"
          data-testid="commitment-keep-in-inbox"
          onClick={onDismiss}
          className="touch-press min-h-[44px] rounded-full border border-ink/10 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink-soft"
        >
          {t("일단 둘게요", "Keep here")}
        </button>
      </div>
    </div>
  );
}

function CommitmentRow({
  icon,
  label,
  value,
  testId,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="flex min-h-[38px] items-center gap-2 border-b border-ink/[0.045] last:border-b-0">
      <span className="shrink-0 text-ink-soft">{icon}</span>
      <span className="w-[2.6rem] shrink-0 text-[10.5px] font-semibold text-ink-soft">
        {label}
      </span>
      <span
        className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink"
        data-testid={testId}
      >
        {value}
      </span>
    </div>
  );
}
