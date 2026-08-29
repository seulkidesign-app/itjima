import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import {
  useArchive,
  useInbox,
  useSchedules,
  useUserId,
  type ScheduleItem,
} from "@/lib/store";
import { ScheduleCompactRow } from "@/components/ScheduleCompactRow";
import { ThoughtDetailSheet } from "@/components/ThoughtDetailSheet";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { ReminderSheet } from "@/components/ReminderSheet";
import { ScheduleAlarmSheet } from "@/components/ScheduleAlarmSheet";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { SyncIndicator } from "@/components/SyncIndicator";
import { ScheduleNotificationOnboardingSheet } from "@/components/ScheduleNotificationOnboardingSheet";
import { NotificationDeniedHelpSheet } from "@/components/NotificationDeniedHelpSheet";
import { IosInstallHint } from "@/components/IosInstallHint";

import { useT, useLang } from "@/lib/i18n";
import { allCloudSynced } from "@/lib/syncFeedback";
import {
  clearReminderOffset,
  formatAlarmLabel,
  presetToAlarmAt,
  type AlarmPreset,
} from "@/lib/scheduleReminders";
import {
  resolveScheduleAllDayFlags,
  scheduleAllDayFieldsFromConfirm,
} from "@/lib/scheduleTime";
import { classifySchedule, isMissed } from "@/lib/scheduleGroups";
import {
  canonicalIdFromSchedule,
  completeRecord,
  deleteRecord,
  syncRecordTemporal,
  undoCompleteRecord,
  undoDeleteRecord,
  type CanonicalMutationOps,
} from "@/lib/canonicalMutations";
import {
  dedupeScheduleProjections,
  findScheduleProjection,
} from "@/lib/scheduleProjection";
import { showUndoToast } from "@/lib/undoToast";
import {
  cancelScheduleReminders,
  syncScheduleReminderDetailed,
} from "@/lib/push/scheduledRemindersSync";
import {
  buildDeniedSaveCopy,
  buildInstallGuideSaveCopy,
  completeScheduleSaveWithNotifications,
  markNotificationOnboardingSeen,
  shouldOfferNotificationOnboarding,
  type PendingScheduleSave,
  type ScheduleSaveOutcome,
} from "@/lib/push/scheduleNotificationSave";
import {
  inferReminderKeyFromSchedule,
  scheduleHasSpecificTime,
} from "@/lib/push/scheduleNotificationDefaults";
import { isIosSafariTab } from "@/lib/alarmAvailability";
import { executeDirectPushEnableFlow } from "@/lib/push/directPushEnableFlow";
import {
  ensurePushSubscription,
  hasActivePushSubscription,
} from "@/lib/push/pushSubscription";
import { confirm as hapticConfirm } from "@/lib/haptics";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/schedule")({
  component: Schedule,
});

const scheduleToast = {
  style: { marginTop: "calc(env(safe-area-inset-top, 0px) + 56px)" },
} as const;

const OPEN_BROWSE = "itjima:open-browse";

function Schedule() {
  const t = useT();
  const { lang } = useLang();
  const userId = useUserId();
  const { items, update, remove, add, syncState, retrySync } = useSchedules();
  const inbox = useInbox();
  const archive = useArchive();

  const [sheet, setSheet] = useState<{
    open: boolean;
    edit?: ScheduleItem;
  }>({ open: false });
  const [detailSchedule, setDetailSchedule] = useState<ScheduleItem | null>(
    null,
  );
  const [reminderSheet, setReminderSheet] = useState<ScheduleItem | null>(null);
  const [alarmSheet, setAlarmSheet] = useState<ScheduleItem | null>(null);
  const [notificationOnboarding, setNotificationOnboarding] = useState<{
    pending: PendingScheduleSave;
    fireAt: Date;
  } | null>(null);
  const [onboardingBusy, setOnboardingBusy] = useState(false);
  const [deniedHelpOpen, setDeniedHelpOpen] = useState(false);
  const [iosInstallHintOpen, setIosInstallHintOpen] = useState(false);

  const mutationOps = useCallback((): CanonicalMutationOps => {
    return {
      getInboxById: (id) => inbox.allItems.find((it) => it.id === id),
      updateInbox: (id, patch) => inbox.update(id, patch),
      softDeleteInbox: (id) => inbox.softDelete(id),
      getSchedules: () => {
        try {
          const key = `itjima.${userId ?? "guest"}.schedules`;
          return JSON.parse(localStorage.getItem(key) || "[]") as ScheduleItem[];
        } catch {
          return items;
        }
      },
      updateSchedule: (id, patch) => update(id, patch),
      removeSchedule: (id) => remove(id),
      addSchedule: async (payload) => add(payload),
    };
  }, [inbox, items, update, remove, add, userId]);

  const activeItems = useMemo(
    () =>
      dedupeScheduleProjections(items.filter((item) => item.status !== "done"))
        .slice()
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
        ),
    [items],
  );

  const doneItems = useMemo(
    () =>
      dedupeScheduleProjections(items.filter((item) => item.status === "done"))
        .slice()
        .sort(
          (a, b) =>
            new Date(b.end_time).getTime() - new Date(a.end_time).getTime(),
        ),
    [items],
  );

  const todayItems = useMemo(
    () =>
      activeItems.filter((item) => {
        if (isMissed(item)) return false;
        const bucket = classifySchedule(item.start_time);
        return bucket === "now" || bucket === "today";
      }),
    [activeItems],
  );

  const upcomingItems = useMemo(
    () =>
      activeItems.filter((item) => {
        if (isMissed(item)) return false;
        const bucket = classifySchedule(item.start_time);
        return bucket !== "now" && bucket !== "today";
      }),
    [activeItems],
  );

  const pastItems = useMemo(
    () => activeItems.filter((item) => isMissed(item)),
    [activeItems],
  );

  useEffect(() => {
    const id = sessionStorage.getItem("itjima.openScheduleEdit");
    if (!id) return;
    const target = findScheduleProjection(items, id);
    if (!target) return;
    sessionStorage.removeItem("itjima.openScheduleEdit");
    setSheet({ open: true, edit: target });
  }, [items]);

  const persistScheduleItem = async (
    pending: PendingScheduleSave,
    alarmPayload: { alarm: boolean; alarm_at?: string | null },
  ): Promise<ScheduleItem> => {
    const allDayFields = scheduleAllDayFieldsFromConfirm({
      allDay: pending.allDay,
      startAllDay: pending.startAllDay,
      endAllDay: pending.endAllDay,
    });

    if (pending.edit) {
      const recordId = canonicalIdFromSchedule(pending.edit);
      const hasCanonical = inbox.allItems.some((item) => item.id === recordId);

      if (hasCanonical) {
        await syncRecordTemporal(
          recordId,
          {
            text: pending.text,
            start_time: pending.start.toISOString(),
            end_time: pending.end.toISOString(),
            all_day: allDayFields.all_day,
          },
          mutationOps(),
        );
        await update(pending.edit.id, {
          text: pending.text,
          start_time: pending.start.toISOString(),
          end_time: pending.end.toISOString(),
          ...allDayFields,
          repeat: pending.repeat ?? null,
          ...alarmPayload,
          source_id: recordId,
        });
      } else {
        await update(pending.edit.id, {
          text: pending.text,
          start_time: pending.start.toISOString(),
          end_time: pending.end.toISOString(),
          ...allDayFields,
          repeat: pending.repeat ?? null,
          ...alarmPayload,
        });
      }

      return {
        ...pending.edit,
        text: pending.text,
        start_time: pending.start.toISOString(),
        end_time: pending.end.toISOString(),
        ...allDayFields,
        repeat: pending.repeat ?? null,
        ...alarmPayload,
      };
    }

    const { item } = await add({
      text: pending.text,
      start_time: pending.start.toISOString(),
      end_time: pending.end.toISOString(),
      ...allDayFields,
      repeat: pending.repeat ?? null,
      ...alarmPayload,
    });
    track("schedule_created", {
      source: "manual",
      text_length: pending.text.length,
    });
    return item as ScheduleItem;
  };

  const applySaveOutcome = (outcome: ScheduleSaveOutcome, isEdit: boolean) => {
    if (!outcome.ok) {
      toast.error(
        outcome.errorMessage ?? t("남기지 못했어요", "Couldn't keep it"),
        scheduleToast,
      );
      return;
    }

    if (outcome.showDeniedGuide) {
      const copy = buildDeniedSaveCopy(lang === "en" ? "en" : "ko");
      toast.warning(copy.headline, {
        ...scheduleToast,
        description: copy.detail,
        action: {
          label: lang === "ko" ? "방법 보기" : "How to enable",
          onClick: () => setDeniedHelpOpen(true),
        },
      });
    } else if (outcome.showInstallGuide) {
      const copy = buildInstallGuideSaveCopy(lang === "en" ? "en" : "ko");
      toast.message(copy.headline, {
        ...scheduleToast,
        description: copy.detail,
        action: {
          label: lang === "ko" ? "추가 방법" : "How to add",
          onClick: () => setIosInstallHintOpen(true),
        },
      });
    } else if (outcome.successCopy?.detail) {
      toast.success(outcome.successCopy.headline, {
        ...scheduleToast,
        description: outcome.successCopy.detail,
      });
    } else if (outcome.successCopy?.headline) {
      toast.success(outcome.successCopy.headline, scheduleToast);
    } else {
      toast.success(
        isEdit ? t("수정했어요", "Updated") : t("일정에 추가했어요", "Added to schedule"),
        scheduleToast,
      );
    }

    setSheet({ open: false });
    setNotificationOnboarding(null);
  };

  const runScheduleSave = async (
    pending: PendingScheduleSave,
    opts?: {
      requestPermission?: () => Promise<NotificationPermission>;
      skipNotificationPrep?: boolean;
    },
  ) => {
    try {
      const outcome = await completeScheduleSaveWithNotifications(
        userId,
        pending,
        lang === "en" ? "en" : "ko",
        (alarm) => persistScheduleItem(pending, alarm),
        opts,
      );
      applySaveOutcome(outcome, Boolean(pending.edit));
    } catch {
      toast.error(t("남기지 못했어요", "Couldn't keep it"), scheduleToast);
    }
  };

  const closedAppReminderReady = async () => {
    if (!userId || Notification.permission !== "granted") return false;
    const push = await ensurePushSubscription(userId);
    if (!push.ok) return false;
    return hasActivePushSubscription(userId);
  };

  const armAlarmAt = async (schedule: ScheduleItem, at: Date) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted") {
        toast.error(
          t(
            "알림을 켠 뒤 시간을 정해 주세요.",
            "Turn on notifications before setting a time.",
          ),
          scheduleToast,
        );
        return;
      }
    }

    if (at.getTime() <= Date.now()) {
      toast.error(
        t(
          "알림 시간이 이미 지났어요. 다시 골라 주세요.",
          "That reminder time already passed. Pick another.",
        ),
        scheduleToast,
      );
      return;
    }

    try {
      clearReminderOffset(schedule.id);
      await update(schedule.id, { alarm: true, alarm_at: at.toISOString() });
      const updated: ScheduleItem = {
        ...schedule,
        created_at: schedule.created_at,
        status: schedule.status ?? "active",
        alarm: true,
        alarm_at: at.toISOString(),
      };

      if (userId) {
        const sync = await syncScheduleReminderDetailed(userId, updated);
        if (!sync.ok || !sync.queued) {
          toast.error(
            t(
              "알림 예약에 실패했어요. 다시 골라 주세요.",
              "Couldn't queue the reminder. Pick another time.",
            ),
            scheduleToast,
          );
          return;
        }

        const when = formatAlarmLabel(at, lang === "en" ? "en" : "ko");
        if (await closedAppReminderReady()) {
          toast.success(
            t(`${when}에 알려드릴게요`, `I'll remind you ${when}`),
            scheduleToast,
          );
        } else {
          toast.message(
            t(
              "앱을 열어두면 알려드릴게요. 닫힌 앱 알림은 기기 연결이 필요해요.",
              "I'll notify you while the app is open. Closed-app alerts need device setup.",
            ),
            scheduleToast,
          );
        }
        return;
      }

      toast.message(
        t("앱을 열어두면 알려드릴게요", "I'll notify you while the app is open"),
        scheduleToast,
      );
    } catch {
      toast.error(t("알림을 설정하지 못했어요", "Couldn't set reminder"));
    }
  };

  const armFromPreset = async (schedule: ScheduleItem, preset: AlarmPreset) => {
    await armAlarmAt(schedule, presetToAlarmAt(preset));
  };

  const disarmReminder = async (schedule: ScheduleItem) => {
    clearReminderOffset(schedule.id);
    await update(schedule.id, { alarm: false, alarm_at: null });
    if (userId) await cancelScheduleReminders(userId, schedule.id);
  };

  const markDone = async (schedule: ScheduleItem) => {
    try {
      const recordId = canonicalIdFromSchedule(schedule);
      if (inbox.allItems.some((item) => item.id === recordId)) {
        await completeRecord(recordId, mutationOps());
      } else {
        await update(schedule.id, { status: "done" });
      }
      if (userId) await cancelScheduleReminders(userId, schedule.id);
      hapticConfirm();
      track("schedule_completed", { text_length: schedule.text.length });
      showUndoToast(
        t("완료했어요", "Completed"),
        async () => {
          if (inbox.allItems.some((item) => item.id === recordId)) {
            await undoCompleteRecord(recordId, mutationOps());
          } else {
            await update(schedule.id, { status: "active" });
          }
        },
        { undoLabel: t("되돌리기", "Undo") },
      );
    } catch {
      toast.error(t("완료하지 못했어요", "Couldn't mark done"));
    }
  };

  const undoDone = async (schedule: ScheduleItem) => {
    try {
      const recordId = canonicalIdFromSchedule(schedule);
      if (inbox.allItems.some((item) => item.id === recordId)) {
        await undoCompleteRecord(recordId, mutationOps());
      } else {
        await update(schedule.id, { status: "active" });
      }
      toast.success(t("다시 열어 뒀어요", "Marked active again"), scheduleToast);
    } catch {
      toast.error(t("되돌리지 못했어요", "Couldn't undo"));
    }
  };

  const deleteSchedule = async (schedule: ScheduleItem) => {
    try {
      if (userId) await cancelScheduleReminders(userId, schedule.id);
      const recordId = canonicalIdFromSchedule(schedule);
      if (inbox.allItems.some((item) => item.id === recordId)) {
        const snapshot = await deleteRecord(recordId, mutationOps());
        if (snapshot) {
          showUndoToast(t("삭제했어요", "Deleted"), async () => {
            await undoDeleteRecord(snapshot, mutationOps());
          });
        }
        return;
      }
      await remove(schedule.id);
      toast(t("삭제했어요", "Deleted"));
    } catch {
      toast.error(t("삭제하지 못했어요", "Couldn't delete"));
    }
  };

  const moveToArchive = async (schedule: ScheduleItem) => {
    try {
      const { cloudSynced: archiveSynced } = await archive.add({
        text: schedule.raw_text ?? schedule.text,
        images: [],
        source_id: schedule.source_id ?? schedule.id,
        raw_text: schedule.raw_text ?? schedule.text,
        brain_mirror: schedule.brain_mirror ?? null,
      });
      if (userId) await cancelScheduleReminders(userId, schedule.id);
      const scheduleSynced = await remove(schedule.id);
      const recordId = schedule.source_id || schedule.id;
      if (inbox.allItems.some((item) => item.id === recordId)) {
        await inbox.softDelete(recordId);
      }
      if (allCloudSynced(archiveSynced, scheduleSynced)) {
        toast.success(t("보관했어요", "Saved to vault"), scheduleToast);
      }
    } catch {
      toast.error(t("보관하지 못했어요", "Couldn't archive"));
    }
  };

  const hasAnySchedule =
    todayItems.length > 0 ||
    upcomingItems.length > 0 ||
    pastItems.length > 0 ||
    doneItems.length > 0;

  return (
    <div className="flex h-full flex-col bg-[var(--canvas,#faf8f5)]">
      <SyncIndicator
        syncing={syncState === "syncing"}
        error={syncState === "error"}
        onRetry={retrySync}
      />

      <header className="sticky top-0 z-10 shrink-0 bg-[var(--canvas,#faf8f5)]">
        <div className="mx-auto flex w-full max-w-[680px] items-center justify-between px-5 pb-4 pt-6">
          <h1 className="page-title inline-flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full bg-primary"
              aria-hidden
            />
            {t("내 일정", "My schedule")}
          </h1>
          <button
            type="button"
            data-testid="schedule-open-search"
            onClick={() => window.dispatchEvent(new Event(OPEN_BROWSE))}
            aria-label={t("기록 검색", "Search records")}
            className="touch-press grid h-11 w-11 place-items-center rounded-full bg-ink/[0.035] text-ink"
          >
            <Search size={20} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-[680px] flex-1 overflow-y-auto px-5 pb-28"
        data-testid="schedule-unified-view"
      >
        {syncState === "syncing" && items.length === 0 ? (
          <ScheduleListSkeleton />
        ) : !hasAnySchedule ? (
          <Empty />
        ) : (
          <div className="flex flex-col gap-7 pb-3">
            <section data-testid="schedule-section-today">
              <h2 className="section-title mb-2 px-0.5">{t("오늘", "Today")}</h2>
              {todayItems.length > 0 ? (
                <ul className="flex flex-col gap-2.5" data-testid="schedule-today-list">
                  {todayItems.map((schedule) => (
                    <ScheduleCompactRow
                      key={schedule.id}
                      s={schedule}
                      onComplete={() => markDone(schedule)}
                      onEdit={() => setSheet({ open: true, edit: schedule })}
                      onOpenDetail={() => setDetailSchedule(schedule)}
                      onAlarm={() => setAlarmSheet(schedule)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-3 text-[14px] text-ink-soft">
                  {t("오늘 일정이 없어요", "Nothing on today")}
                </p>
              )}
            </section>

            <section data-testid="schedule-section-upcoming">
              <h2 className="section-title mb-2 px-0.5">
                {t("다가오는 일정", "Upcoming")}
              </h2>
              {upcomingItems.length > 0 ? (
                <ul className="flex flex-col gap-2.5" data-testid="schedule-upcoming-list">
                  {upcomingItems.map((schedule) => (
                    <ScheduleCompactRow
                      key={schedule.id}
                      s={schedule}
                      onComplete={() => markDone(schedule)}
                      onEdit={() => setSheet({ open: true, edit: schedule })}
                      onOpenDetail={() => setDetailSchedule(schedule)}
                      onAlarm={() => setAlarmSheet(schedule)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-1 py-3 text-[14px] text-ink-soft">
                  {t("다가오는 일정이 없어요", "Nothing upcoming")}
                </p>
              )}
            </section>

            {pastItems.length > 0 && (
              <CollapsibleSection
                title={t("지난 일정", "Past")}
                items={pastItems}
                onComplete={markDone}
                onOpenDetail={setDetailSchedule}
                onEdit={(schedule) => setSheet({ open: true, edit: schedule })}
              />
            )}

            {doneItems.length > 0 && (
              <DoneSection
                items={doneItems}
                onUndo={undoDone}
                onOpenDetail={setDetailSchedule}
                onEdit={(schedule) => setSheet({ open: true, edit: schedule })}
                t={t}
              />
            )}
          </div>
        )}
      </main>

      {reminderSheet && (
        <ReminderSheet
          open
          schedule={reminderSheet}
          onClose={() => setReminderSheet(null)}
          onConfirmAt={(iso) => {
            void armAlarmAt(reminderSheet, new Date(iso));
            setReminderSheet(null);
          }}
        />
      )}

      <ScheduleAlarmSheet
        schedule={alarmSheet}
        open={Boolean(alarmSheet)}
        onClose={() => setAlarmSheet(null)}
        userId={userId}
        armed={alarmSheet?.alarm ?? false}
        onSelectPreset={async (schedule, preset) => {
          await armFromPreset(schedule, preset);
        }}
        onCustom={(schedule) => {
          setReminderSheet(schedule);
          setAlarmSheet(null);
        }}
        onDisarm={() => {
          if (alarmSheet) void disarmReminder(alarmSheet);
        }}
      />

      <ThoughtDetailSheet
        item={
          detailSchedule
            ? {
                id: canonicalIdFromSchedule(detailSchedule),
                text: detailSchedule.raw_text || detailSchedule.text,
                images: [],
                created_at: detailSchedule.created_at,
                status: detailSchedule.status === "done" ? "done" : "active",
                start_time: detailSchedule.start_time,
                end_time: detailSchedule.end_time,
                all_day: detailSchedule.all_day ?? null,
                brain_mirror: detailSchedule.brain_mirror ?? null,
                raw_text: detailSchedule.raw_text ?? null,
              }
            : null
        }
        open={Boolean(detailSchedule)}
        onClose={() => setDetailSchedule(null)}
        onSchedule={() => {
          const schedule = detailSchedule;
          setDetailSchedule(null);
          if (schedule) setSheet({ open: true, edit: schedule });
        }}
        onArchive={() => {
          const schedule = detailSchedule;
          setDetailSchedule(null);
          if (schedule) void moveToArchive(schedule);
        }}
        onDelete={() => {
          const schedule = detailSchedule;
          setDetailSchedule(null);
          if (schedule) void deleteSchedule(schedule);
        }}
        onSaveEdit={async (_item, text) => {
          const schedule = detailSchedule;
          if (!schedule) return;
          await update(schedule.id, { text, raw_text: text });
          const recordId = canonicalIdFromSchedule(schedule);
          if (inbox.allItems.some((item) => item.id === recordId)) {
            await inbox.update(recordId, { text, raw_text: text });
          }
          toast.success(t("고쳤어요", "Saved your edit"));
        }}
        onClearTemporal={async () => {
          const schedule = detailSchedule;
          setDetailSchedule(null);
          if (!schedule) return;
          const recordId = canonicalIdFromSchedule(schedule);
          if (inbox.allItems.some((item) => item.id === recordId)) {
            await syncRecordTemporal(recordId, null, mutationOps());
          } else {
            if (userId) await cancelScheduleReminders(userId, schedule.id);
            await remove(schedule.id);
          }
          toast.success(t("날짜·시간을 지웠어요", "Removed date & time"));
        }}
      />

      <ScheduleSheet
        open={sheet.open}
        initialText={sheet.edit?.text}
        initialStart={sheet.edit ? new Date(sheet.edit.start_time) : undefined}
        initialEnd={sheet.edit ? new Date(sheet.edit.end_time) : undefined}
        initialAllDay={sheet.edit?.all_day}
        initialStartAllDay={
          sheet.edit ? resolveScheduleAllDayFlags(sheet.edit).startAllDay : undefined
        }
        initialEndAllDay={
          sheet.edit ? resolveScheduleAllDayFlags(sheet.edit).endAllDay : undefined
        }
        initialRepeat={sheet.edit?.repeat}
        initialReminderKey={
          sheet.edit ? inferReminderKeyFromSchedule(sheet.edit) : undefined
        }
        saveLabel={sheet.edit ? t("저장", "Save") : undefined}
        onClose={() => setSheet({ open: false })}
        onSave={async (text, start, end, opts) => {
          const reminderMin =
            opts?.reminderMinutes ?? opts?.alarmMinutesBefore ?? null;
          const startAllDay = opts?.startAllDay ?? opts?.allDay ?? false;
          const endAllDay = opts?.endAllDay ?? opts?.allDay ?? false;
          const hasTime = scheduleHasSpecificTime(startAllDay, endAllDay);
          const wantsAlarm = reminderMin != null;
          const pending: PendingScheduleSave = {
            text,
            start,
            end,
            reminderMinutes: reminderMin,
            allDay: opts?.allDay ?? false,
            startAllDay,
            endAllDay,
            repeat: opts?.repeat ?? null,
            isNew: !sheet.edit,
            edit: sheet.edit,
          };

          if (
            shouldOfferNotificationOnboarding(wantsAlarm, hasTime, pending.isNew, {
              needsIosInstall: isIosSafariTab(),
            })
          ) {
            setNotificationOnboarding({
              pending,
              fireAt: new Date(start.getTime() - reminderMin! * 60 * 1000),
            });
            setSheet({ open: false });
            return;
          }

          await runScheduleSave(pending);
        }}
      />

      <ScheduleNotificationOnboardingSheet
        open={notificationOnboarding != null}
        fireAt={notificationOnboarding?.fireAt ?? null}
        lang={lang === "en" ? "en" : "ko"}
        busy={onboardingBusy}
        needsInstall={isIosSafariTab()}
        onClose={() => {
          if (!onboardingBusy) setNotificationOnboarding(null);
        }}
        onEnableAndSave={() => {
          if (!notificationOnboarding || onboardingBusy) return;
          void (async () => {
            try {
              if (isIosSafariTab()) {
                setOnboardingBusy(true);
                const outcome = await completeScheduleSaveWithNotifications(
                  userId,
                  notificationOnboarding.pending,
                  lang === "en" ? "en" : "ko",
                  (alarm) => persistScheduleItem(notificationOnboarding.pending, alarm),
                  { skipNotificationPrep: true },
                );
                applySaveOutcome(
                  { ...outcome, showInstallGuide: true },
                  Boolean(notificationOnboarding.pending.edit),
                );
                return;
              }

              if (userId) {
                const enabled = await executeDirectPushEnableFlow(
                  userId,
                  lang === "en" ? "en" : "ko",
                );
                setOnboardingBusy(true);
                if (!enabled.ok && enabled.errorMessage) {
                  toast.error(enabled.errorMessage, scheduleToast);
                }
                await runScheduleSave(notificationOnboarding.pending, {
                  requestPermission: async () =>
                    enabled.permission === "unsupported"
                      ? "default"
                      : enabled.permission,
                });
                return;
              }

              const permission =
                Notification.permission === "default"
                  ? await Notification.requestPermission()
                  : Notification.permission;
              setOnboardingBusy(true);
              await runScheduleSave(notificationOnboarding.pending, {
                requestPermission: async () => permission,
              });
            } finally {
              setOnboardingBusy(false);
            }
          })();
        }}
        onSaveWithoutNotification={() => {
          if (!notificationOnboarding || onboardingBusy) return;
          setOnboardingBusy(true);
          markNotificationOnboardingSeen();
          void (async () => {
            try {
              await runScheduleSave(
                { ...notificationOnboarding.pending, reminderMinutes: null },
                { skipNotificationPrep: true },
              );
            } finally {
              setOnboardingBusy(false);
            }
          })();
        }}
      />

      <NotificationDeniedHelpSheet
        open={deniedHelpOpen}
        onClose={() => setDeniedHelpOpen(false)}
      />
      <IosInstallHint
        open={iosInstallHintOpen}
        onClose={() => setIosInstallHintOpen(false)}
      />
    </div>
  );
}

function CollapsibleSection({
  title,
  items,
  onComplete,
  onOpenDetail,
  onEdit,
}: {
  title: string;
  items: ScheduleItem[];
  onComplete: (schedule: ScheduleItem) => void;
  onOpenDetail: (schedule: ScheduleItem) => void;
  onEdit: (schedule: ScheduleItem) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-ink/[0.06] pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="touch-press flex min-h-11 w-full items-center justify-between px-0.5 text-left text-[12px] font-semibold text-ink-soft"
      >
        <span>{title} · {items.length}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2.5 overflow-hidden"
          >
            {items.map((schedule) => (
              <ScheduleCompactRow
                key={schedule.id}
                s={schedule}
                inPastSection
                onComplete={() => onComplete(schedule)}
                onEdit={() => onEdit(schedule)}
                onOpenDetail={() => onOpenDetail(schedule)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function DoneSection({
  items,
  onUndo,
  onOpenDetail,
  onEdit,
  t,
}: {
  items: ScheduleItem[];
  onUndo: (schedule: ScheduleItem) => void;
  onOpenDetail: (schedule: ScheduleItem) => void;
  onEdit: (schedule: ScheduleItem) => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="border-t border-ink/[0.06] pt-3">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="touch-press flex min-h-11 w-full items-center justify-between px-0.5 text-left text-[12px] font-semibold text-ink-soft"
      >
        <span>{t("완료", "Done")} · {items.length}</span>
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-col gap-2.5 overflow-hidden"
          >
            {items.map((schedule) => (
              <ScheduleCompactRow
                key={schedule.id}
                s={schedule}
                done
                onComplete={() => onUndo(schedule)}
                onEdit={() => onEdit(schedule)}
                onOpenDetail={() => onOpenDetail(schedule)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function Empty() {
  const t = useT();
  return (
    <div
      className="flex min-h-[46dvh] flex-col items-center justify-center px-8 text-center"
      role="status"
      data-testid="schedule-empty"
    >
      <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
        {t("아직 일정이 없어요.", "No schedules yet.")}
      </p>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-ink-soft">
        {t(
          "시간이 포함된 기록은 여기에 자동으로 나타나요.",
          "Timed records show up here automatically.",
        )}
      </p>
      <Link
        to="/app"
        data-testid="schedule-empty-capture"
        className="touch-press mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-[14px] font-bold text-ink"
      >
        {t("남기러 가기", "Go capture")}
      </Link>
    </div>
  );
}
