import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Plus,
  Pin,
  Check,
  Bell,
  BellOff,
  Timer,
  Copy,
  Trash2,
  Pencil,
  Move,
  CheckSquare,
  Archive,
} from "lucide-react";
import { animate, motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useSchedules, useArchive, useInbox, useUserId, type ScheduleItem } from "@/lib/store";
import {
  ScheduleCompactRow,
  LaterInboxRow,
} from "@/components/ScheduleCompactRow";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { ReminderSheet } from "@/components/ReminderSheet";
import { ScheduleAlarmSheet } from "@/components/ScheduleAlarmSheet";
import { ScheduleTimerSheet } from "@/components/ScheduleTimerSheet";
import {
  CalendarDragLayer,
  CalendarDayCell,
  CalendarWeekSpanBars,
  computeWeekSpanSegments,
  isMultiDaySchedule,
  scheduleRangeInMonth,
  useCalendarScrollParent,
} from "@/components/CalendarDragLayer";
import { EmptyState } from "@/components/EmptyState";
import { ScheduleListSkeleton } from "@/components/Skeleton";
import { SyncIndicator } from "@/components/SyncIndicator";
import { partitionTodaySchedules } from "@/lib/todaySuggestions";
import { useScrollLock } from "@/hooks/useScrollLock";
import { allCloudSynced } from "@/lib/syncFeedback";
import {
  bindInAppReminders,
  clearReminderOffset,
  clearActiveTimer,
  effectiveAlarmAt,
  formatAlarmLabel,
  formatTimerLabel,
  getActiveTimerEnd,
  presetToAlarmAt,
  presetToTimerEnd,
  setActiveTimer,
  type AlarmPreset,
  type TimerPreset,
} from "@/lib/scheduleReminders";
import {
  formatScheduleTimeLoose,
  remainingUntil,
  resolveScheduleAllDayFlags,
  scheduleAllDayFieldsFromConfirm,
  scheduleAllDayFieldsFromItem,
} from "@/lib/scheduleTime";
import {
  groupSchedulesForUpcoming,
  upcomingSectionLabel,
  isMissed,
  classifySchedule,
} from "@/lib/scheduleGroups";
import { scheduleDisplayTitle, rawPreview } from "@/lib/thoughtProvenance";
import { SPRING_SNAP_BACK, SHEET_BACKDROP_CLASS, SHEET_BACKDROP_FADE } from "@/lib/motion";
import { toast } from "sonner";
import { useT, useLang } from "@/lib/i18n";
import {
  cancelScheduleReminders,
  syncScheduleReminder,
} from "@/lib/push/scheduledRemindersSync";
import {
  ensurePushSubscription,
  hasActivePushSubscription,
} from "@/lib/push/pushSubscription";
import { track } from "@/lib/analytics";
import { haptic, confirm as hapticConfirm } from "@/lib/haptics";

export const Route = createFileRoute("/schedule")({
  component: Schedule,
});

const toastBtn =
  "touch-target shrink-0 rounded-full bg-primary px-4 text-xs font-bold text-ink";

const scheduleToast = {
  style: { marginTop: "calc(env(safe-area-inset-top, 0px) + 56px)" },
} as const;

function defaultStartForDay(y: number, m: number, d: number) {
  const now = new Date();
  const dt = new Date(y, m, d);
  if (
    y === now.getFullYear() &&
    m === now.getMonth() &&
    d === now.getDate()
  ) {
    dt.setHours(now.getHours() + 1, 0, 0, 0);
  } else {
    dt.setHours(9, 0, 0, 0);
  }
  return dt;
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setDate(d.getDate() - d.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function isSameWeek(a: Date, b: Date) {
  return startOfWeek(a).getTime() === startOfWeek(b).getTime();
}

import { readSchedulePins, writeSchedulePins } from "@/lib/archiveMeta";

function usePins() {
  const [pins, setPins] = useState<Set<string>>(() => readSchedulePins());
  useEffect(() => {
    const refresh = () => setPins(readSchedulePins());
    window.addEventListener("itjima:archive-meta", refresh);
    return () => window.removeEventListener("itjima:archive-meta", refresh);
  }, []);
  const toggle = (id: string) => {
    const next = new Set(pins);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeSchedulePins(next);
  };
  return { pins, toggle };
}

function useTimerTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    const h = () => setTick((n) => n + 1);
    window.addEventListener("itjima:timers", h);
    return () => {
      clearInterval(id);
      window.removeEventListener("itjima:timers", h);
    };
  }, []);
}

function Schedule() {
  const t = useT();
  const { lang } = useLang();
  const userId = useUserId();
  const { items, update, remove, add, syncState, retrySync } = useSchedules();
  const archive = useArchive();
  const inbox = useInbox();
  const [tab, setTab] = useState<"today" | "list" | "cal">("today");
  const [sheet, setSheet] = useState<{
    open: boolean;
    edit?: ScheduleItem;
    draftStart?: Date;
  }>({
    open: false,
  });
  const [reminderSheet, setReminderSheet] = useState<ScheduleItem | null>(null);
  const [alarmSheet, setAlarmSheet] = useState<ScheduleItem | null>(null);
  const [timerSheet, setTimerSheet] = useState<ScheduleItem | null>(null);
  useTimerTick();
  const { pins, toggle: togglePin } = usePins();

  const activeItems = useMemo(
    () => items.filter((s) => s.status !== "done"),
    [items],
  );
  const doneItems = useMemo(
    () => items.filter((s) => s.status === "done"),
    [items],
  );

  useEffect(() => {
    return bindInAppReminders(items, (title, body) => {
      if (Notification.permission === "granted") {
        new Notification(title, { body });
      }
    });
  }, [items]);

  const closedAppReminderReady = async (): Promise<boolean> => {
    if (!userId) return false;
    const push = await ensurePushSubscription(userId);
    if (!push.ok) return false;
    return hasActivePushSubscription(userId);
  };

  const armAlarmAt = async (s: ScheduleItem, at: Date) => {
    try {
      let perm: NotificationPermission | "unsupported" = "unsupported";
      if ("Notification" in window) {
        perm =
          Notification.permission === "default"
            ? await Notification.requestPermission()
            : Notification.permission;
      }
      clearReminderOffset(s.id);
      await update(s.id, { alarm: true, alarm_at: at.toISOString() });
      const updated: ScheduleItem = {
        ...s,
        alarm: true,
        alarm_at: at.toISOString(),
      };

      if (userId) {
        await syncScheduleReminder(userId, updated);
      }

      const closedApp = userId ? await closedAppReminderReady() : false;

      if (closedApp) {
        toast.success(
          t(
            "설정한 시간에 알림을 보낼게요",
            "Reminder set for the time you chose",
          ),
          scheduleToast,
        );
      } else if (perm === "granted") {
        toast.message(
          t(
            "앱을 열어두면 알려드릴게요",
            "I'll notify you while the app is open",
          ),
          scheduleToast,
        );
      } else if (perm === "denied") {
        toast.message(
          t(
            "알림은 꺼져 있지만, 그때는 기억해 둘게요",
            "Notifications off — we'll still remember when",
          ),
          scheduleToast,
        );
      } else {
        toast.success(t("그때 다시 떠올릴게요", "I'll remember this for then"), scheduleToast);
      }
    } catch {
      toast.error(t("알림을 설정하지 못했어요", "Couldn't set reminder"));
    }
  };

  const armFromPreset = async (s: ScheduleItem, preset: AlarmPreset) => {
    await armAlarmAt(s, presetToAlarmAt(preset));
  };

  const disarmReminder = async (s: ScheduleItem) => {
    clearReminderOffset(s.id);
    await update(s.id, { alarm: false, alarm_at: null });
    if (userId) await cancelScheduleReminders(userId, s.id);
  };

  const startTimer = async (s: ScheduleItem, preset: TimerPreset) => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setActiveTimer(s.id, presetToTimerEnd(preset));
      toast.success(
        t(
          "앱을 열어두면 알려드릴게요",
          "I'll notify you while the app is open",
        ),
        scheduleToast,
      );
    } catch {
      toast.error(t("타이머를 시작하지 못했어요", "Couldn't start timer"));
    }
  };

  const stopTimer = (s: ScheduleItem) => {
    clearActiveTimer(s.id);
    toast(t("타이머 종료", "Timer stopped"));
  };

  const upcomingSections = useMemo(
    () => groupSchedulesForUpcoming(activeItems, pins),
    [activeItems, pins],
  );

  const laterInboxItems = useMemo(
    () => inbox.items.filter((it) => it.decision === "later"),
    [inbox.items],
  );

  const { today: todayActive, flowed: flowedPast } = useMemo(
    () => partitionTodaySchedules(activeItems, pins),
    [activeItems, pins],
  );

  const todayTimerItems = useMemo(() => {
    return todayActive.filter((s) => {
      const k = classifySchedule(s.start_time);
      return k === "now" || k === "today" || pins.has(s.id);
    });
  }, [todayActive, pins]);

  const moveEventsToDate = async (
    ids: string[],
    day: number,
    month: number,
    year: number,
  ) => {
    if (!ids.length) return;
    const snapshots: { id: string; prevStart: string; prevEnd: string }[] = [];
    try {
      for (const id of ids) {
        const it = items.find((x) => x.id === id);
        if (!it) continue;
        snapshots.push({
          id,
          prevStart: it.start_time,
          prevEnd: it.end_time,
        });
        const s = new Date(it.start_time);
        const e = new Date(it.end_time);
        const dur = e.getTime() - s.getTime();
        const ns = new Date(year, month, day, s.getHours(), s.getMinutes());
        const ne = new Date(ns.getTime() + dur);
        await update(id, {
          start_time: ns.toISOString(),
          end_time: ne.toISOString(),
        });
      }
      if (snapshots.length) {
        const count = snapshots.length;
        toast.custom(
          (toastId) => (
            <div className="flex items-center gap-3 rounded-[24px] bg-ink px-4 py-3 text-white shadow-float">
              <span className="text-sm">
                {count > 1
                  ? t(
                      `${count}개 일정이 옮겨졌어요`,
                      `${count} schedules moved`,
                    )
                  : t("날짜가 옮겨졌어요", "Date moved")}
              </span>
              <button
                type="button"
                onClick={() => {
                  for (const snap of snapshots) {
                    void update(snap.id, {
                      start_time: snap.prevStart,
                      end_time: snap.prevEnd,
                    });
                  }
                  toast.dismiss(toastId);
                }}
                className={toastBtn}
              >
                {t("되돌리기", "Undo")}
              </button>
            </div>
          ),
          { duration: 5000 },
        );
      }
    } catch {
      toast.error(t("날짜를 옮기지 못했어요", "Couldn't move date"));
    }
  };

  const duplicateSchedule = async (s: ScheduleItem) => {
    try {
      await add({
        text: s.text,
        start_time: s.start_time,
        end_time: s.end_time,
        ...scheduleAllDayFieldsFromItem(s),
        repeat: s.repeat,
        raw_text: s.raw_text,
        brain_mirror: s.brain_mirror,
        source_id: s.source_id,
        alarm: false,
        status: "active",
      });
      toast.success(t("복사됐어요", "Copied here"));
    } catch {
      toast.error(t("복사하지 못했어요", "Couldn't copy"));
    }
  };

  const openQuickAdd = (date: Date) => {
    setSheet({ open: true, draftStart: date });
  };

  const markDone = async (s: ScheduleItem) => {
    try {
      const done = await update(s.id, { status: "done" });
      if (userId) await cancelScheduleReminders(userId, s.id);
      hapticConfirm();
      track("schedule_completed", { text_length: s.text.length });
      if (done) toast.success(t("다녀온 기억이에요", "You can let this go"), scheduleToast);
    } catch {
      toast.error(t("완료하지 못했어요", "Couldn't mark done"));
    }
  };

  const moveDoneToArchive = async (s: ScheduleItem) => {
    try {
      const { cloudSynced: archiveSynced } = await archive.add({
        text: s.raw_text ?? s.text,
        images: [],
        source_id: s.source_id ?? s.id,
        raw_text: s.raw_text ?? s.text,
        brain_mirror: s.brain_mirror ?? null,
      });
      if (userId) await cancelScheduleReminders(userId, s.id);
      const scheduleSynced = await remove(s.id);
      if (pins.has(s.id)) togglePin(s.id);
      if (allCloudSynced(archiveSynced, scheduleSynced)) {
        toast.success(t("생각 지도로 옮겼어요", "Moved to thought map"), scheduleToast);
      }
    } catch {
      toast.error(t("옮기지 못했어요", "Couldn't move"));
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <SyncIndicator
        syncing={syncState === "syncing"}
        error={syncState === "error"}
        onRetry={retrySync}
      />
      <div className="sticky top-0 z-10 shrink-0 bg-white">
        <div className="px-5 pb-3 pt-6">
          <h1 className="page-title">{t("일정", "Schedule")}</h1>
          <p className="page-eyebrow mt-2.5 max-w-[22rem] leading-relaxed text-ink-soft">
            {t(
              "오늘과 다가올 일을 한곳에서 볼 수 있어요.",
              "Today and what's coming — in one place.",
            )}
          </p>
        </div>
        <div className="px-5 pb-2">
          <LayoutGroup>
            <div className="segment-nav" role="tablist">
              {(
                [
                  ["today", t("오늘", "Today"), "schedule-panel-today"],
                  ["list", t("예정", "Upcoming"), "schedule-panel-list"],
                ] as const
              ).map(([k, label, panelId]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  id={`schedule-tab-${k}`}
                  aria-selected={tab === k}
                  aria-controls={panelId}
                  onClick={() => setTab(k)}
                  className={`segment-nav-item ${
                    tab === k ? "segment-nav-item-active" : "segment-nav-item-inactive"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                id="schedule-tab-cal"
                aria-selected={tab === "cal"}
                aria-controls="schedule-panel-cal"
                onClick={() => setTab("cal")}
                className={`segment-nav-item shrink-0 flex-none px-3 ${
                  tab === "cal" ? "segment-nav-item-active" : "segment-nav-item-inactive"
                }`}
              >
                {t("달력", "Calendar")}
              </button>
            </div>
          </LayoutGroup>
        </div>
      </div>

      <div className="flex-1 px-5 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            id={
              tab === "list"
                ? "schedule-panel-list"
                : tab === "today"
                  ? "schedule-panel-today"
                  : "schedule-panel-cal"
            }
            role="tabpanel"
            aria-labelledby={`schedule-tab-${tab}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
          >
        {syncState === "syncing" && items.length === 0 ? (
          <ScheduleListSkeleton />
        ) : tab === "today" ? (
          activeItems.length === 0 && doneItems.length === 0 ? (
            <Empty />
          ) : (
            <ScheduleTodayPanel
              todayItems={todayTimerItems}
              flowedItems={flowedPast}
              doneCount={doneItems.length}
              doneItems={doneItems}
              pins={pins}
              onComplete={markDone}
              onEdit={(s) => setSheet({ open: true, edit: s })}
            />
          )
        ) : tab === "list" ? (
          upcomingSections.length === 0 &&
          laterInboxItems.length === 0 &&
          doneItems.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-5 animate-fade-in pb-2">
              {upcomingSections.map((sec) => (
                <section key={sec.key} data-testid={`upcoming-section-${sec.key}`}>
                  <h2 className="section-title mb-1.5 px-0.5">
                    {upcomingSectionLabel(sec.key, lang)}
                  </h2>
                  <ul className="flex flex-col">
                    {sec.items.map((s) => (
                      <ScheduleCompactRow
                        key={s.id}
                        s={s}
                        pinned={pins.has(s.id)}
                        onComplete={() => markDone(s)}
                        onEdit={() => setSheet({ open: true, edit: s })}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              {laterInboxItems.length > 0 && (
                <section
                  data-testid="upcoming-section-noDate"
                  className="rounded-[var(--radius-md)] bg-ink/[0.025] px-1 py-0.5"
                >
                  <h2 className="section-title mb-1.5 px-1.5 pt-1">
                    {upcomingSectionLabel("noDate", lang)}
                  </h2>
                  <ul className="flex flex-col">
                    {laterInboxItems.map((it) => (
                      <LaterInboxRow
                        key={it.id}
                        text={it.text}
                        onOpen={() =>
                          toast.message(
                            t(
                              "던지기에서 다시 정리할 수 있어요",
                              "You can sort this again from Throw",
                            ),
                          )
                        }
                      />
                    ))}
                  </ul>
                </section>
              )}
              {doneItems.length > 0 && (
                <DoneSection
                  items={doneItems}
                  onComplete={markDone}
                  onEdit={(s) => setSheet({ open: true, edit: s })}
                  t={t}
                />
              )}
            </div>
          )
        ) : (
          <CalendarGrid
            items={activeItems}
            pins={pins}
            onTogglePin={(id) => {
              togglePin(id);
              haptic(8);
            }}
            onEdit={(s) => setSheet({ open: true, edit: s })}
            onQuickAdd={openQuickAdd}
            onDelete={async (s) => {
              try {
                if (userId) await cancelScheduleReminders(userId, s.id);
                const deleted = await remove(s.id);
                if (pins.has(s.id)) togglePin(s.id);
                if (deleted) toast(t("삭제했어요", "Deleted"));
              } catch {
                toast.error(t("삭제하지 못했어요", "Couldn't delete"));
              }
            }}
            onDuplicate={duplicateSchedule}
            onDropToDate={moveEventsToDate}
          />
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      {tab !== "cal" && (
        <motion.button
          onClick={() => setSheet({ open: true })}
          whileTap={{ scale: 0.94 }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_SNAP_BACK, delay: 0.15 }}
          className="absolute right-5 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-primary/95 text-ink shadow-card touch-press"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          aria-label={t("할 일 추가", "Add task")}
        >
          <Plus size={20} strokeWidth={2.25} />
        </motion.button>
      )}

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
        open={!!alarmSheet}
        onClose={() => setAlarmSheet(null)}
        armed={alarmSheet?.alarm ?? false}
        onSelectPreset={(preset) => {
          if (alarmSheet) void armFromPreset(alarmSheet, preset);
        }}
        onCustom={() => {
          if (alarmSheet) setReminderSheet(alarmSheet);
        }}
        onDisarm={() => {
          if (alarmSheet) void disarmReminder(alarmSheet);
        }}
      />

      <ScheduleTimerSheet
        schedule={timerSheet}
        open={!!timerSheet}
        onClose={() => setTimerSheet(null)}
        active={timerSheet ? !!getActiveTimerEnd(timerSheet.id) : false}
        onSelectPreset={(preset) => {
          if (timerSheet) void startTimer(timerSheet, preset);
        }}
        onClear={() => {
          if (timerSheet) stopTimer(timerSheet);
        }}
      />

      <ScheduleSheet
        open={sheet.open}
        initialText={sheet.edit?.text}
        initialStart={
          sheet.edit
            ? new Date(sheet.edit.start_time)
            : sheet.draftStart
        }
        initialEnd={sheet.edit ? new Date(sheet.edit.end_time) : undefined}
        initialAllDay={sheet.edit?.all_day}
        initialStartAllDay={
          sheet.edit
            ? resolveScheduleAllDayFlags(sheet.edit).startAllDay
            : undefined
        }
        initialEndAllDay={
          sheet.edit
            ? resolveScheduleAllDayFlags(sheet.edit).endAllDay
            : undefined
        }
        initialRepeat={sheet.edit?.repeat}
        saveLabel={sheet.edit ? t("다듬기", "Refine") : undefined}
        onClose={() => setSheet({ open: false })}
        onSave={async (text, start, end, opts) => {
          try {
            const reminderMin =
              opts?.reminderMinutes ?? opts?.alarmMinutesBefore ?? null;
            const alarmPayload =
              reminderMin != null
                ? {
                    alarm: true,
                    alarm_at: new Date(
                      start.getTime() - reminderMin * 60 * 1000,
                    ).toISOString(),
                  }
                : { alarm: false };

            const allDayFields = scheduleAllDayFieldsFromConfirm({
              allDay: opts?.allDay ?? false,
              startAllDay: opts?.startAllDay ?? opts?.allDay ?? false,
              endAllDay: opts?.endAllDay ?? opts?.allDay ?? false,
            });

            if (sheet.edit) {
              await update(sheet.edit.id, {
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                ...allDayFields,
                repeat: opts?.repeat ?? null,
                ...alarmPayload,
              });
              if (userId) {
                const edited: ScheduleItem = {
                  ...sheet.edit,
                  text,
                  start_time: start.toISOString(),
                  end_time: end.toISOString(),
                  ...allDayFields,
                  repeat: opts?.repeat ?? null,
                  ...alarmPayload,
                };
                await syncScheduleReminder(userId, edited);
              }
              toast.success(t("다듬었어요", "Refined"), scheduleToast);
            } else {
              const { item } = await add({
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                ...allDayFields,
                repeat: opts?.repeat ?? null,
                ...alarmPayload,
              });
              if (userId && alarmPayload.alarm) {
                await syncScheduleReminder(userId, item as ScheduleItem);
              }
              track("schedule_created", {
                source: "manual",
                text_length: text.length,
              });
              toast.success(t("그때 다시 떠올릴게요", "I'll remember this for then"), scheduleToast);
            }
            setSheet({ open: false });
          } catch {
            toast.error(t("남기지 못했어요", "Couldn't keep it"));
          }
        }}
      />
    </div>
  );
}

function FlowedPastSection({
  items,
  onEdit,
  t,
}: {
  items: ScheduleItem[];
  onEdit: (s: ScheduleItem) => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  const { lang } = useLang();
  if (!items.length) return null;

  const locale = lang === "en" ? "en-US" : "ko-KR";
  const visible = open ? items : items.slice(0, 2);

  return (
    <section className="mt-4 border-t border-ink/[0.06] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-0.5 py-1.5 text-[13px] font-semibold text-ink-soft touch-press"
      >
        <span>{t("지난 일정", "Past")}</span>
        <span className="text-[12px]">
          {items.length} {open ? "▴" : "▾"}
        </span>
      </button>
      <ul className="flex flex-col">
        {visible.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 border-b border-ink/[0.05] px-0.5 py-2.5 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onEdit(s)}
              className="min-w-0 flex-1 truncate text-left text-[14px] text-ink/55 touch-press"
            >
              {scheduleDisplayTitle(s)}
            </button>
            <span className="shrink-0 text-[12px] text-ink-soft">
              {new Date(s.end_time).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScheduleTodayPanel({
  todayItems,
  flowedItems,
  doneCount,
  doneItems,
  pins,
  onComplete,
  onEdit,
}: {
  todayItems: ScheduleItem[];
  flowedItems: ScheduleItem[];
  doneCount: number;
  doneItems: ScheduleItem[];
  pins: Set<string>;
  onComplete: (s: ScheduleItem) => void;
  onEdit: (s: ScheduleItem) => void;
}) {
  const t = useT();

  return (
    <div className="flex flex-col animate-fade-in pb-2 pt-1">
      {todayItems.length > 0 ? (
        <ul className="flex flex-col" data-testid="schedule-today-list">
          {todayItems.map((s) => (
            <ScheduleCompactRow
              key={s.id}
              s={s}
              pinned={pins.has(s.id)}
              onComplete={() => onComplete(s)}
              onEdit={() => onEdit(s)}
            />
          ))}
        </ul>
      ) : (
        doneCount === 0 &&
        flowedItems.length === 0 && (
          <p className="px-1 py-5 text-center text-secondary leading-relaxed">
            {t(
              "오늘 할 일이 생기면 여기에 모여요.",
              "When something needs your day, it gathers here.",
            )}
          </p>
        )
      )}

      <FlowedPastSection items={flowedItems} onEdit={onEdit} t={t} />

      {doneItems.length > 0 && (
        <DoneSection
          items={doneItems}
          onComplete={onComplete}
          onEdit={onEdit}
          t={t}
        />
      )}
    </div>
  );
}

function DoneSection({
  items,
  onComplete,
  onEdit,
  t,
}: {
  items: ScheduleItem[];
  onComplete: (s: ScheduleItem) => void;
  onEdit: (s: ScheduleItem) => void;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 border-t border-ink/[0.06] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 w-full px-0.5 text-left text-[12px] font-semibold tracking-[-0.01em] text-ink-soft/80 touch-press"
      >
        {t("완료", "Done")} · {items.length}{" "}
        <motion.span
          animate={{ rotate: open ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="inline-block"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col overflow-hidden"
          >
            {items.map((s) => (
              <ScheduleCompactRow
                key={s.id}
                s={s}
                done
                onComplete={() => onComplete(s)}
                onEdit={() => onEdit(s)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </section>
  );
}

function fmt(d: Date, locale: string) {
  return d.toLocaleString(locale, {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function CalendarGrid({
  items,
  pins,
  onTogglePin,
  onEdit,
  onQuickAdd,
  onDelete,
  onDuplicate,
  onDropToDate,
}: {
  items: ScheduleItem[];
  pins: Set<string>;
  onTogglePin: (id: string) => void;
  onEdit: (s: ScheduleItem) => void;
  onQuickAdd: (date: Date) => void;
  onDelete: (s: ScheduleItem) => void;
  onDuplicate: (s: ScheduleItem) => void;
  onDropToDate: (
    ids: string[],
    day: number,
    month: number,
    year: number,
  ) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const today = new Date();
  const calendarRef = useRef<HTMLDivElement>(null);
  const scrollParent = useCalendarScrollParent(calendarRef);
  const [view, setView] = useState({
    y: today.getFullYear(),
    m: today.getMonth(),
  });
  const { y, m } = view;
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDay }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    const row = cells.slice(i, i + 7);
    while (row.length < 7) row.push(null);
    weeks.push(row);
  }
  const eventsOf = (day: number) =>
    items.filter((s) => {
      const dt = new Date(s.start_time);
      return (
        dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day
      );
    });
  const singleDayEventsOf = (day: number) =>
    eventsOf(day).filter((s) => !isMultiDaySchedule(s));
  const multiDayInMonth = items.filter(
    (s) => scheduleRangeInMonth(s, y, m) != null && isMultiDaySchedule(s),
  );
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [menuFor, setMenuFor] = useState<ScheduleItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [monthDir, setMonthDir] = useState<1 | -1>(1);
  const swipeRef = useRef({ x: 0, active: false, locked: false });
  const monthLabel =
    lang === "en"
      ? new Date(y, m, 1).toLocaleString("en-US", {
          month: "long",
          year: "numeric",
        })
      : `${y}년 ${m + 1}월`;
  const weekdays =
    lang === "en"
      ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
      : ["일", "월", "화", "수", "목", "금", "토"];

  const selectedEvents = selected ? eventsOf(selected) : [];
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const monthHasEvents = items.some((s) => scheduleRangeInMonth(s, y, m) != null);
  const viewingTodayMonth =
    y === today.getFullYear() && m === today.getMonth();
  const selectedDate =
    selected != null ? new Date(y, m, selected) : new Date(y, m, 1);
  const showTodayBtn =
    !viewingTodayMonth ||
    (selected != null && !isSameWeek(selectedDate, today));

  const goMonth = (dir: 1 | -1) => {
    setMonthDir(dir);
    setView((v) => ({
      y: dir === 1 && v.m === 11 ? v.y + 1 : dir === -1 && v.m === 0 ? v.y - 1 : v.y,
      m: (v.m + dir + 12) % 12,
    }));
    haptic(6);
  };

  const goToday = () => {
    setView({ y: today.getFullYear(), m: today.getMonth() });
    setSelected(today.getDate());
    haptic(6);
  };

  const onSwipeDown = (e: ReactPointerEvent) => {
    swipeRef.current = { x: e.clientX, active: true, locked: false };
  };
  const onSwipeMove = (e: ReactPointerEvent) => {
    if (!swipeRef.current.active || swipeRef.current.locked) return;
    const dx = e.clientX - swipeRef.current.x;
    if (Math.abs(dx) > 52) {
      swipeRef.current.locked = true;
      goMonth(dx < 0 ? 1 : -1);
    }
  };
  const onSwipeUp = () => {
    swipeRef.current.active = false;
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setPicked(new Set());
  };

  const enterSelectMode = (initial?: ScheduleItem) => {
    setSelectMode(true);
    setPicked(initial ? new Set([initial.id]) : new Set());
    haptic(6);
  };

  const togglePick = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    haptic(6);
  };

  const resolveDragGroup = (item: ScheduleItem) => {
    if (selectMode && picked.size > 0 && picked.has(item.id)) {
      return [...picked];
    }
    return [item.id];
  };

  return (
    <CalendarDragLayer
      month={m}
      year={y}
      pinned={(id) => pins.has(id)}
      getDragGroup={resolveDragGroup}
      scrollParent={scrollParent}
      onEdgeMonth={(dir) => goMonth(dir === 1 ? 1 : -1)}
      onDropToDate={(ids, day, month, year) => {
        onDropToDate(ids, day, month, year);
        exitSelectMode();
      }}
    >
      {({ startDrag, hoverDay, draggingIds }) => (
        <div ref={calendarRef} className="relative space-y-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${y}-${m}`}
              initial={{ opacity: 0, x: monthDir * 28 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: monthDir * -28 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              onPointerDown={onSwipeDown}
              onPointerMove={onSwipeMove}
              onPointerUp={onSwipeUp}
              onPointerCancel={onSwipeUp}
              className="touch-pan-y rounded-[var(--radius-md)] border border-ink/[0.05] bg-ink/[0.015] p-3"
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => goMonth(-1)}
                  className="touch-target flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-ink-soft/70 hover:bg-ink/[0.04] hover:text-ink touch-press"
                  aria-label={t("이전 달", "Previous month")}
                >
                  ‹
                </button>
                <div className="text-[15px] font-bold tracking-[-0.02em] text-ink">
                  {monthLabel}
                </div>
                <button
                  type="button"
                  onClick={() => goMonth(1)}
                  className="touch-target flex h-11 w-11 items-center justify-center rounded-full text-[20px] text-ink-soft/70 hover:bg-ink/[0.04] hover:text-ink touch-press"
                  aria-label={t("다음 달", "Next month")}
                >
                  ›
                </button>
              </div>

              {!monthHasEvents && (
                <div className="mb-4 flex flex-col items-center py-4 text-center">
                  <span className="text-[2.5rem]" aria-hidden>
                    🌿
                  </span>
                  <p className="mt-3 text-[15px] font-semibold text-ink">
                    {t("이 달은 한가해요.", "A quiet month.")}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft/80">
                    {t(
                      "날짜를 길게 눌러 바로 추가해 보세요",
                      "Long-press a day to add something",
                    )}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold tracking-[-0.01em]">
                {weekdays.map((d, i) => (
                  <div
                    key={i}
                    className={
                      i === 0 || i === 6 ? "text-ink-soft/45" : "text-ink-soft/70"
                    }
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="mt-1 space-y-0.5">
                {weeks.map((week, wi) => {
                  const spanSegments = computeWeekSpanSegments(
                    week,
                    multiDayInMonth,
                    y,
                    m,
                  );
                  return (
                    <div key={wi}>
                      <div className="grid grid-cols-7 gap-1">
                        {week.map((c, i) => {
                          if (!c) {
                            return (
                              <div key={`${wi}-${i}`} className="min-h-[44px]" />
                            );
                          }
                          const evs = singleDayEventsOf(c);
                          const weekday = (startDay + c - 1) % 7;
                          const isToday =
                            c === today.getDate() &&
                            m === today.getMonth() &&
                            y === today.getFullYear();
                          const isSel = c === selected;
                          const preview = evs.length
                            ? scheduleDisplayTitle(evs[0])
                            : undefined;
                          return (
                            <CalendarDayCell
                              key={`${wi}-${i}`}
                              day={c}
                              weekday={weekday}
                              hoverDay={hoverDay}
                              dragging={draggingIds.length > 0}
                              isToday={isToday}
                              isSelected={isSel}
                              eventCount={evs.length}
                              preview={preview}
                              firstEvent={evs[0]}
                              onSelect={() => {
                                setSelected(c);
                                haptic(6);
                              }}
                              onLongPressEmpty={() =>
                                onQuickAdd(defaultStartForDay(y, m, c))
                              }
                              onDragStart={startDrag}
                            />
                          );
                        })}
                      </div>
                      <CalendarWeekSpanBars
                        segments={spanSegments}
                        titleFor={scheduleDisplayTitle}
                        draggingIds={draggingIds}
                        onDragStart={startDrag}
                      />
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 px-1 text-[11px] text-ink-soft/70">
                {t(
                  "→ 노란 블록을 눌러 다른 날로 옮길 수 있어요",
                  "→ Press and drag a yellow block to move it to another day",
                )}
              </p>
            </motion.div>
          </AnimatePresence>

          {showTodayBtn && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={goToday}
              className="fixed left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[12px] font-bold text-white shadow-float touch-press"
              style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
            >
              {t("오늘", "Today")}
            </motion.button>
          )}

          {selected !== null && (
            <div className="space-y-3 border-t-2 border-primary/15 pt-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => onQuickAdd(defaultStartForDay(y, m, selected))}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-primary/20 py-3 text-[14px] font-bold text-ink touch-press"
              >
                <Plus size={16} strokeWidth={2.5} />
                {t("그때 남기기", "Remember for then")}
              </motion.button>

              <div className="rounded-[var(--radius-md)] border border-ink/[0.05] bg-ink/[0.015] px-1 py-1">
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1.5 pt-0.5">
                  <div className="text-[12px] font-semibold text-ink-soft">
                    {new Date(y, m, selected).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    })}
                    {selectedEvents.length > 0 && (
                      <span className="ml-1 text-ink-soft/60">
                        · {selectedEvents.length}
                      </span>
                    )}
                  </div>
                  {selectedEvents.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        selectMode ? exitSelectMode() : enterSelectMode()
                      }
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold touch-press ${
                        selectMode
                          ? "bg-ink text-white"
                          : "bg-ink/[0.06] text-ink-soft"
                      }`}
                    >
                      {selectMode
                        ? t("닫기", "Close")
                        : t("고르기", "Pick")}
                    </button>
                  )}
                </div>
                {selectMode && picked.size > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-2 text-[11px] font-semibold text-primary"
                  >
                    {t(
                      `${picked.size}개 · 끌어서 함께 옮기기`,
                      `${picked.size} picked · drag to move together`,
                    )}
                  </motion.p>
                )}
                {selectedEvents.length === 0 ? (
                  <p className="min-h-[72px] py-3 text-[13px] text-ink-soft/70">
                    {t("이 날은 비어 있어요.", "Nothing here yet.")}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {selectedEvents
                      .slice()
                      .sort(
                        (a, b) =>
                          +new Date(a.start_time) - +new Date(b.start_time),
                      )
                      .map((s) => (
                        <DayEventChip
                          key={s.id}
                          s={s}
                          pinned={pins.has(s.id)}
                          dragging={draggingIds.includes(s.id)}
                          selectMode={selectMode}
                          selected={picked.has(s.id)}
                          onToggleSelect={() => togglePick(s.id)}
                          onClick={() => onEdit(s)}
                          onLongPress={() => setMenuFor(s)}
                          onDragStart={(e) => startDrag(e, s)}
                        />
                      ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          <ScheduleEventMenu
            item={menuFor}
            onClose={() => setMenuFor(null)}
            onEdit={() => {
              if (menuFor) onEdit(menuFor);
              setMenuFor(null);
            }}
            onMove={() => {
              setMenuFor(null);
              toast.message(
                t("끌어 다른 날로 옮겨 보세요", "Drag to another day"),
                { duration: 3000 },
              );
            }}
            onMultiSelect={() => {
              if (menuFor) enterSelectMode(menuFor);
              setMenuFor(null);
            }}
            onDuplicate={() => {
              if (menuFor) onDuplicate(menuFor);
              setMenuFor(null);
            }}
            onDelete={() => {
              if (menuFor) onDelete(menuFor);
              setMenuFor(null);
            }}
            onPin={() => {
              if (menuFor) onTogglePin(menuFor.id);
              setMenuFor(null);
            }}
            pinned={menuFor ? pins.has(menuFor.id) : false}
          />
        </div>
      )}
    </CalendarDragLayer>
  );
}

function ScheduleEventMenu({
  item,
  pinned,
  onClose,
  onEdit,
  onMove,
  onMultiSelect,
  onDuplicate,
  onDelete,
  onPin,
}: {
  item: ScheduleItem | null;
  pinned: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMove: () => void;
  onMultiSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  const t = useT();
  useScrollLock(!!item);
  if (!item) return null;

  const actions = [
    { key: "edit", label: t("다듬기", "Refine"), icon: Pencil, onClick: onEdit },
    { key: "move", label: t("옮기기", "Move"), icon: Move, onClick: onMove },
    {
      key: "multi",
      label: t("여러 개 고르기", "Pick several"),
      icon: CheckSquare,
      onClick: onMultiSelect,
    },
    {
      key: "dup",
      label: t("복사", "Copy"),
      icon: Copy,
      onClick: onDuplicate,
    },
    {
      key: "pin",
      label: pinned ? t("핀 해제", "Unpin") : t("핀", "Pin"),
      icon: Pin,
      onClick: onPin,
    },
    {
      key: "del",
      label: t("삭제하기", "Delete"),
      icon: Trash2,
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.button
            type="button"
            aria-label={t("닫기", "Close")}
            className={`fixed inset-0 z-40 ${SHEET_BACKDROP_CLASS}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SHEET_BACKDROP_FADE}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal
            className="fixed inset-x-4 z-50 rounded-[20px] bg-white p-2 shadow-float"
            style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={SPRING_SNAP_BACK}
          >
            <p className="truncate px-3 py-2 text-[13px] font-semibold text-ink-soft">
              {scheduleDisplayTitle(item)}
            </p>
            {actions.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={a.onClick}
                className={`flex w-full items-center gap-3 rounded-[14px] px-3 py-3 text-left text-[15px] font-semibold touch-press active:bg-ink/[0.04] ${
                  a.danger ? "text-red-600" : "text-ink"
                }`}
              >
                <a.icon size={18} strokeWidth={2} />
                {a.label}
              </button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DayEventChip({
  s,
  pinned,
  dragging,
  selectMode,
  selected,
  onToggleSelect,
  onClick,
  onLongPress,
  onDragStart,
}: {
  s: ScheduleItem;
  pinned: boolean;
  dragging?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onClick: () => void;
  onLongPress: () => void;
  onDragStart: (e: ReactPointerEvent) => void;
}) {
  const st = new Date(s.start_time);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragStarted = useRef(false);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onDown = (e: ReactPointerEvent) => {
    fired.current = false;
    dragStarted.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    if (!selectMode) {
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, 500);
    }
  };

  const onMove = (e: ReactPointerEvent) => {
    if (!start.current || dragStarted.current || fired.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.hypot(dx, dy) > 10) {
      dragStarted.current = true;
      clearTimer();
      onDragStart(e);
    }
  };

  const onUp = () => {
    clearTimer();
    if (!dragStarted.current && !fired.current) {
      if (selectMode) onToggleSelect?.();
      else onClick();
    }
    start.current = null;
    dragStarted.current = false;
  };

  return (
    <li
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      className={`flex cursor-grab items-start gap-2 rounded-[var(--radius-sm)] border-b border-ink/[0.05] px-2 py-2.5 touch-none transition active:cursor-grabbing ${
        dragging
          ? "scale-[0.98] opacity-30"
          : selected
            ? "bg-primary/25 ring-1 ring-primary/50"
            : pinned
              ? "bg-primary/20"
              : "hover:bg-ink/[0.03]"
      }`}
    >
      {selectMode && (
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
            selected
              ? "border-primary bg-primary text-ink"
              : "border-ink/20 bg-transparent"
          }`}
          aria-hidden
        >
          {selected && <Check size={11} strokeWidth={3} />}
        </span>
      )}
      {pinned && <Pin size={11} className="mt-1 fill-primary text-primary" />}
      <span className="mt-0.5 rounded-full bg-primary/30 px-1.5 py-0.5 text-[10px] font-bold text-ink">
        {st.getHours().toString().padStart(2, "0")}:
        {st.getMinutes().toString().padStart(2, "0")}
      </span>
      <span className="flex-1 break-words text-left text-[14px] font-medium leading-snug text-ink">
        {scheduleDisplayTitle(s)}
      </span>
    </li>
  );
}

function Empty() {
  return (
    <EmptyState
      emoji="🌙"
      titleKo="아직 그때가 없어요"
      titleEn="Nothing to bring back yet"
      hintKo="그때가 되면, 여기에 모여요."
      hintEn="When the moment comes, it'll gather here."
    />
  );
}
