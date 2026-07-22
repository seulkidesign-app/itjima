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
import { useArchive, useSchedules, type ScheduleItem } from "@/lib/store";
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
import {
  partitionTodaySchedules,
  pickTodaySuggestion,
  formatTodaySpotlightTime,
} from "@/lib/todaySuggestions";
import { scheduleStatusBadge } from "@/lib/dateDetect";
import { MOTION_CRAFT } from "@/lib/motionLanguage";
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
  groupSchedulesForFeel,
  feelSectionLabel,
  scheduleFeelDot,
  isMissed,
  sectionLabel,
  classifySchedule,
} from "@/lib/scheduleGroups";
import { scheduleDisplayTitle, rawPreview } from "@/lib/thoughtProvenance";
import { SPRING_TAB, SPRING_SNAP_BACK } from "@/lib/motion";
import { toast } from "sonner";
import { useT, useLang } from "@/lib/i18n";
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
  const { items, update, remove, add, syncState, retrySync } = useSchedules();
  const archive = useArchive();
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
      if (perm === "granted") {
        toast.success(
          t(
            "앱을 열어두면 그때 알려드릴게요",
            "I'll remind you while the app is open",
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

  const feelSections = useMemo(
    () => groupSchedulesForFeel(activeItems, pins),
    [activeItems, pins],
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
      const scheduleSynced = await remove(s.id);
      if (pins.has(s.id)) togglePin(s.id);
      if (allCloudSynced(archiveSynced, scheduleSynced)) {
        toast.success(t("생각 지도로 옮겼어요", "Moved to thought map"), scheduleToast);
      }
    } catch {
      toast.error(t("옮기지 못했어요", "Couldn't move"));
    }
  };

  const cardProps = (s: ScheduleItem) => ({
    s,
    pinned: pins.has(s.id),
    missed: isMissed(s),
    done: s.status === "done",
    onPin: () => {
      togglePin(s.id);
      haptic(8);
    },
    onEdit: () => setSheet({ open: true, edit: s }),
    onComplete: () => markDone(s),
    onMoveToArchive: () => moveDoneToArchive(s),
    onAlarm: () => setAlarmSheet(s),
    onTimer: () => setTimerSheet(s),
    onDisarm: () => disarmReminder(s),
    onDelete: async () => {
      try {
        const deleted = await remove(s.id);
        if (pins.has(s.id)) togglePin(s.id);
        if (deleted) toast(t("내려놨어요", "Let go"));
      } catch {
        toast.error(t("내려놓지 못했어요", "Couldn't let go"));
      }
    },
  });

  return (
    <div className="flex h-full flex-col bg-white">
      <SyncIndicator
        syncing={syncState === "syncing"}
        error={syncState === "error"}
        onRetry={retrySync}
      />
      <div className="sticky top-0 z-10 shrink-0 bg-white">
        <div className={`px-5 ${tab === "today" ? "pb-4 pt-6" : "pb-3 pt-5"}`}>
          <h1 className="page-title">{t("할 일", "Tasks")}</h1>
          <p
            className={`leading-relaxed text-ink-soft ${
              tab === "today"
                ? "page-eyebrow mt-2.5 max-w-[20rem]"
                : "mt-1.5 text-[13px]"
            }`}
          >
            {t(
              "해야 할 생각을 잊지 않도록",
              "So you don't forget thoughts that need to be done",
            )}
          </p>
        </div>
        <div className="px-5 pb-3">
          <LayoutGroup>
            <div
              className="flex w-full items-end border-b border-ink/10"
              role="tablist"
            >
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
                  className={`relative min-h-11 px-4 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-colors duration-200 ${
                    tab === k ? "text-ink" : "text-ink-soft"
                  }`}
                >
                  {label}
                  {tab === k && (
                    <motion.span
                      layoutId="schedule-tab-underline"
                      className="absolute inset-x-1 -bottom-px h-[3px] rounded-full bg-ink"
                      transition={SPRING_TAB}
                    />
                  )}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                id="schedule-tab-cal"
                aria-selected={tab === "cal"}
                aria-controls="schedule-panel-cal"
                onClick={() => setTab("cal")}
                className={`relative ml-auto min-h-11 px-3 py-2 text-[12px] font-medium tracking-[-0.01em] transition-colors duration-200 ${
                  tab === "cal" ? "text-ink-soft" : "text-ink-soft/45"
                }`}
              >
                {t("달력", "Calendar")}
                {tab === "cal" && (
                  <motion.span
                    layoutId="schedule-tab-underline-cal"
                    className="absolute inset-x-1 -bottom-px h-[2px] rounded-full bg-ink/25"
                    transition={SPRING_TAB}
                  />
                )}
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
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
              activeItems={activeItems}
              archiveItems={archive.items}
              doneCount={doneItems.length}
              ScheduleCard={ScheduleCard}
              cardProps={cardProps}
              DoneSection={DoneSection}
              doneItems={doneItems}
            />
          )
        ) : tab === "list" ? (
          feelSections.length === 0 && doneItems.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-6 animate-fade-in">
              {feelSections.map((sec) => (
                <section key={sec.key}>
                  <h2 className="mb-3 text-[15px] font-bold text-ink">
                    {feelSectionLabel(sec.key, lang)}
                  </h2>
                  <ul className="flex flex-col gap-0.5">
                    {sec.items.map((s) => (
                      <ScheduleFeelRow
                        key={s.id}
                        s={s}
                        dot={scheduleFeelDot(s, pins)}
                        onComplete={() => markDone(s)}
                        onEdit={() => setSheet({ open: true, edit: s })}
                      />
                    ))}
                  </ul>
                </section>
              ))}
              {doneItems.length > 0 && (
                <DoneSection items={doneItems} cardProps={cardProps} t={t} />
              )}
              <ScheduleFeelHint />
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
                const deleted = await remove(s.id);
                if (pins.has(s.id)) togglePin(s.id);
                if (deleted) toast(t("내려놨어요", "Let go"));
              } catch {
                toast.error(t("내려놓지 못했어요", "Couldn't let go"));
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
          className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-float touch-press"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
          aria-label={t("할 일 추가", "Add task")}
        >
          <Plus size={26} strokeWidth={2.5} />
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
              toast.success(t("다듬었어요", "Refined"), scheduleToast);
            } else {
              await add({
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                ...allDayFields,
                repeat: opts?.repeat ?? null,
                ...alarmPayload,
              });
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

function ScheduleFeelRow({
  s,
  dot,
  onComplete,
  onEdit,
}: {
  s: ScheduleItem;
  dot: "filled" | "hollow";
  onComplete: () => void;
  onEdit: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const title = scheduleDisplayTitle(s);
  const flowDateLabel = formatScheduleTimeLoose(new Date(s.start_time), lang);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [acting, setActing] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  dxRef.current = dx;

  const onDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (acting) return;
    dragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (!dragging.current || acting) return;
    const next = Math.max(0, Math.min(100, e.clientX - startX.current));
    dxRef.current = next;
    setDx(next);
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dxRef.current >= 64) {
      setActing(true);
      animate(dxRef.current, 120, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          dxRef.current = v;
          setDx(v);
        },
        onComplete: () => {
          hapticConfirm();
          onComplete();
          setActing(false);
          dxRef.current = 0;
          setDx(0);
        },
      });
      return;
    }
    if (dxRef.current < 8) onEdit();
    animate(dxRef.current, 0, {
      type: "spring",
      stiffness: 420,
      damping: 32,
      onUpdate: (v) => {
        dxRef.current = v;
        setDx(v);
      },
    });
  };

  return (
    <li
      className="relative flex touch-none select-none items-center gap-3 rounded-[14px] px-1 py-3 active:bg-ink/[0.03]"
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${t("밀면 다녀온 기억, 탭하면 다듬기", "Swipe to let go, tap to refine")}`}
      style={{
        transform: `translateX(${dx}px)`,
        transition: dragging.current || acting ? "none" : undefined,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEdit();
        } else if (e.key === " ") {
          e.preventDefault();
          onComplete();
        }
      }}
    >
      {dx > 20 && (
        <div
          className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-ink"
          style={{ opacity: Math.min(1, dx / 64) }}
        >
          ✓
        </div>
      )}
      <span
        className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full ${
          dot === "filled" ? "bg-ink" : "border-2 border-ink/25 bg-transparent"
        }`}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-semibold text-ink">
          {title}
        </span>
        <span className="block text-[12px] text-ink-soft">
          {flowDateLabel}
        </span>
      </span>
    </li>
  );
}

function ScheduleFeelHint() {
  const t = useT();
  return (
    <p className="mt-2 px-1 text-[11px] text-ink-soft/70">
      {t("→ 밀면 다녀온 기억 · 탭하면 다듬기", "→ Swipe to let go · Tap to refine")}
    </p>
  );
}

type ScheduleCardProps = {
  s: ScheduleItem;
  pinned: boolean;
  missed?: boolean;
  done?: boolean;
  emphasize?: boolean;
  timer?: boolean;
  onPin: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onMoveToArchive?: () => void;
  onAlarm: () => void;
  onTimer: () => void;
  onDisarm: () => void;
  onDelete: () => void;
};

type ScheduleCardBaseProps = Omit<ScheduleCardProps, "emphasize" | "timer">;

function ScheduleCard({
  s,
  pinned,
  missed,
  done,
  emphasize,
  timer,
  onPin,
  onEdit,
  onComplete,
  onMoveToArchive,
  onAlarm,
  onTimer,
  onDisarm,
  onDelete,
}: ScheduleCardProps) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const rel = formatScheduleTimeLoose(start, lang);
  const r = remainingUntil(start);
  const dotColor =
    !r.past && r.ms > 0 && r.ms < 10 * 60_000
      ? "bg-red-500"
      : !r.past && start.toDateString() === new Date().toDateString()
        ? "bg-primary"
        : "bg-ink/25";
  const title = scheduleDisplayTitle(s);
  const preview = rawPreview(s);
  const alarmAt = s.alarm ? effectiveAlarmAt(s) : null;
  const timerEnd = getActiveTimerEnd(s.id);
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const dragging = useRef(false);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [acting, setActing] = useState(false);
  const startX = useRef(0);

  dxRef.current = dx;

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (done || acting) return;
    // Taps that start on a nested action control (pin/timer/alarm/delete)
    // must never be captured by the card's swipe gesture — capturing here
    // routes all subsequent pointer events (and often the resulting click)
    // through the card, silently swallowing the button press.
    if ((e.target as HTMLElement).closest("[data-card-action]")) return;
    dragging.current = true;
    longFired.current = false;
    startX.current = e.clientX;
    clearPress();
    pressTimer.current = window.setTimeout(() => {
      if (dragging.current && !acting) {
        longFired.current = true;
        onEdit();
      }
    }, 480);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || acting || done) return;
    const next = Math.max(0, Math.min(120, e.clientX - startX.current));
    if (next > 8) clearPress();
    dxRef.current = next;
    setDx(next);
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    clearPress();
    if (longFired.current) {
      dxRef.current = 0;
      setDx(0);
      return;
    }
    if (dxRef.current >= 72) {
      setActing(true);
      animate(dxRef.current, 140, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          dxRef.current = v;
          setDx(v);
        },
        onComplete: () => {
          onComplete();
          setActing(false);
          dxRef.current = 0;
          setDx(0);
        },
      });
      return;
    }
    animate(dxRef.current, 0, {
      type: "spring",
      stiffness: 420,
      damping: 32,
      onUpdate: (v) => {
        dxRef.current = v;
        setDx(v);
      },
    });
  };

  const swipeHint = dx > 24;

  return (
    <div className="relative">
      {swipeHint && !done && (
        <div
          className="pointer-events-none absolute left-3 top-1/2 z-0 flex -translate-y-1/2 items-center gap-1 rounded-full bg-primary/90 px-3 py-1.5 text-[12px] font-extrabold text-ink shadow-card"
          style={{ opacity: Math.min(1, dx / 72) }}
        >
          <Check size={14} strokeWidth={3} />
          {t("다녀옴", "Done")}
        </div>
      )}
      <div
        className={`card-radius shadow-card px-[18px] py-5 transition ${
          done ? "opacity-50" : ""
        } ${emphasize || timer ? "ring-2 ring-primary/30 bg-primary/10" : pinned ? "bg-primary/15 ring-2 ring-primary/40" : "glass"} ${
          missed && !done ? "border-l-4 border-primary/40" : ""
        }`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging.current || acting ? "none" : undefined,
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (done) onMoveToArchive?.();
              else onComplete();
            }}
            className={`touch-target mt-1 flex shrink-0 items-center justify-center rounded-full border-2 ${
              done
                ? "border-primary bg-primary text-ink"
                : "border-ink/20 hover:border-primary"
            }`}
            aria-label={
              done ? t("생각 지도에 남기기", "Save to thought map") : t("다녀옴", "Done")
            }
          >
            {done ? (
              <Archive size={13} strokeWidth={2.25} />
            ) : (
              <span
                className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
                aria-hidden
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
            {timer ? (
              <>
                <p className="text-[12px] text-ink-soft">
                  {t("다음에 떠올릴 것", "Next up")}
                </p>
                <div className="mt-1 text-[17px] font-bold leading-snug text-ink">
                  {title}
                </div>
                <p className="mt-1.5 text-[13.5px] text-ink-soft">
                  {formatTodaySpotlightTime(s.start_time, lang)}
                </p>
                <span className="mt-2 inline-block rounded-full bg-ink/[0.04] px-2.5 py-1 text-[12px] text-ink-soft">
                  {scheduleStatusBadge(s.start_time, lang)}
                </span>
              </>
            ) : (
              <>
            <div className="flex flex-wrap items-center gap-2">
              {pinned && (
                <Pin size={12} className="fill-primary text-primary" />
              )}
              <span
                className={`font-num font-bold text-ink ${emphasize || timer ? "text-[18px]" : "text-[14px]"}`}
              >
                {rel}
              </span>
              {missed && !done && (
                <span className="rounded-full bg-primary/25 px-2 py-0.5 text-[10px] font-bold text-ink">
                  {t("그때가 지났어요", "That moment passed")}
                </span>
              )}
            </div>
            <div className="mt-1 text-[15px] font-semibold leading-snug text-ink">
              {title}
            </div>
            {preview && preview !== title && (
              <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-soft">
                {preview}
              </p>
            )}
            <div className="mt-1.5 text-meta">
              {fmt(start, locale)} → {fmt(end, locale)}
            </div>
            {alarmAt && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDisarm();
                }}
                className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/30 px-2 py-0.5 text-[11px] font-bold text-ink"
              >
                <Bell size={11} /> {formatAlarmLabel(alarmAt, lang)}
              </button>
            )}
            {timerEnd && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[11px] font-bold text-ink">
                <Timer size={11} /> {formatTimerLabel(timerEnd, lang)}
              </span>
            )}
              </>
            )}
          </div>
          {!done && (
            <div
              data-card-action
              className="flex shrink-0 flex-col items-end gap-2"
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-card-action
                  onClick={(e) => {
                    e.stopPropagation();
                    onPin();
                  }}
                  aria-label={t("고정", "Pin")}
                  className={`touch-target rounded-full transition ${
                    pinned ? "bg-primary text-ink" : "bg-white/70 text-ink-soft"
                  }`}
                >
                  <Pin size={14} className={pinned ? "fill-current" : ""} />
                </button>
                <button
                  type="button"
                  data-card-action
                  onClick={(e) => {
                    e.stopPropagation();
                    onTimer();
                  }}
                  aria-label={t("타이머", "Timer")}
                  className={`touch-target rounded-full transition ${
                    timerEnd ? "bg-ink text-white" : "bg-white/70 text-ink-soft"
                  }`}
                >
                  <Timer size={14} />
                </button>
              </div>
              {/* Alarm: iOS-style pill toggle. On = filled yellow, knob right.
                  Tap toggles on/off directly when an alarm time already
                  exists; if none is set yet, tap opens the alarm sheet
                  to choose a time (first-time setup only). */}
              <button
                type="button"
                data-card-action
                onClick={(e) => {
                  e.stopPropagation();
                  onAlarm();
                }}
                aria-label={
                  s.alarm ? t("알림 끄기", "Turn off reminder") : t("알림 켜기", "Turn on reminder")
                }
                aria-pressed={!!s.alarm}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
                  s.alarm ? "bg-primary" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-card transition-all duration-200 ${
                    s.alarm ? "left-7" : "left-1"
                  }`}
                >
                  {s.alarm ? (
                    <Bell size={13} className="text-ink" />
                  ) : (
                    <BellOff size={13} className="text-ink-soft" />
                  )}
                </span>
              </button>
            </div>
          )}
        </div>
        {!done && (
          <div data-card-action className="mt-2 flex justify-end">
            <button
              type="button"
              data-card-action
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="touch-target text-[12px] font-medium text-ink-soft hover:text-ink"
              aria-label={t("삭제", "Delete")}
            >
              {t("삭제", "Delete")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FlowedPastSection({
  items,
  cardProps,
  t,
  lang,
}: {
  items: ScheduleItem[];
  cardProps: (
    s: ScheduleItem,
  ) => Omit<ComponentProps<typeof ScheduleCard>, "emphasize" | "timer">;
  t: ReturnType<typeof useT>;
  lang: "ko" | "en";
}) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  const locale = lang === "en" ? "en-US" : "ko-KR";
  const visible = open ? items : items.slice(0, 1);

  return (
    <section className="mt-6 border-t border-ink/[0.06] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-1 py-1.5 text-[14px] text-ink-soft touch-press"
      >
        <span>{t("흘러간 것", "Flowed past")}</span>
        <span className="text-[13px]">
          {items.length} {open ? "▴" : "▾"}
        </span>
      </button>
      <div className="flex flex-col">
        {visible.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between px-1 py-3.5 text-[15px] text-ink/45"
          >
            <span className="min-w-0 truncate pr-3">
              {scheduleDisplayTitle(s)}
            </span>
            <span className="shrink-0 text-[12.5px] text-ink-soft">
              {new Date(s.end_time).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScheduleTodayPanel({
  todayItems,
  flowedItems,
  activeItems,
  archiveItems,
  doneCount,
  ScheduleCard,
  cardProps,
  DoneSection,
  doneItems,
}: {
  todayItems: ScheduleItem[];
  flowedItems: ScheduleItem[];
  activeItems: ScheduleItem[];
  archiveItems: import("@/lib/store").ArchiveItem[];
  doneCount: number;
  ScheduleCard: ComponentType<ScheduleCardProps>;
  cardProps: (s: ScheduleItem) => ScheduleCardBaseProps;
  DoneSection: ComponentType<{
    items: ScheduleItem[];
    cardProps: (s: ScheduleItem) => ScheduleCardBaseProps;
    t: ReturnType<typeof useT>;
  }>;
  doneItems: ScheduleItem[];
}) {
  const t = useT();
  const { lang } = useLang();
  const suggestion = pickTodaySuggestion(
    todayItems,
    activeItems,
    archiveItems,
    lang,
  );
  const spotlight = todayItems[0] ?? null;
  const alsoToday = todayItems.slice(1);

  return (
    <div className="flex flex-col gap-8 animate-craft-in px-0.5 pb-4 pt-3">
      {spotlight && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={MOTION_CRAFT}
          className="mx-1 rounded-[24px] border border-ink/[0.03] bg-primary/[0.08] px-[22px] py-5"
        >
          <p className="text-[12px] text-ink-soft">
            {t("다음에 떠올릴 것", "Next up")}
          </p>
          <p className="mt-2 text-[17px] font-bold leading-snug text-ink">
            {scheduleDisplayTitle(spotlight)}
          </p>
          <p className="mt-1.5 text-[13.5px] text-ink-soft">
            {formatTodaySpotlightTime(spotlight.start_time, lang)}
          </p>
          <span className="mt-2.5 inline-block rounded-full bg-ink/[0.04] px-2.5 py-1 text-[12px] text-ink-soft">
            {scheduleStatusBadge(spotlight.start_time, lang)}
          </span>
        </motion.section>
      )}

      {suggestion && (
        <div className="craft-suggestion mx-0.5 px-4 py-3.5">
          <p className="text-[14px] leading-[1.65] tracking-[0.005em] text-ink/88">
            {lang === "en" ? suggestion.messageEn : suggestion.messageKo}
          </p>
        </div>
      )}

      {alsoToday.length > 0 && (
        <section className="flex flex-col gap-3 px-0.5">
          <p className="text-[12px] font-medium tracking-[0.02em] text-ink-soft/65">
            {t("오늘 더 있어요", "Also today")}
          </p>
          <div className="flex flex-col gap-3 opacity-[0.82]">
            {alsoToday.map((s) => (
              <ScheduleCard key={s.id} {...cardProps(s)} timer />
            ))}
          </div>
        </section>
      )}

      <FlowedPastSection
        items={flowedItems}
        cardProps={cardProps}
        t={t}
        lang={lang}
      />

      {doneItems.length > 0 && (
        <DoneSection items={doneItems} cardProps={cardProps} t={t} />
      )}

      {todayItems.length === 0 && doneCount === 0 && flowedItems.length === 0 && (
        <p className="px-4 text-center text-[14px] leading-[1.7] text-ink-soft/85">
          {t(
            "오늘은 특별히 떠올릴 게 없어요. 괜찮아요.",
            "Nothing needs your attention today — and that's okay.",
          )}
        </p>
      )}
    </div>
  );
}

function DoneSection({
  items,
  cardProps,
  t,
}: {
  items: ScheduleItem[];
  cardProps: (
    s: ScheduleItem,
  ) => Omit<ComponentProps<typeof ScheduleCard>, "emphasize" | "timer">;
  t: ReturnType<typeof useT>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-2 w-full px-1 text-left text-[11px] font-semibold tracking-[-0.01em] text-ink-soft/80 touch-press"
      >
        {t("다녀온 기억", "Memories you let go")} · {items.length}{" "}
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
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col gap-3 overflow-hidden"
          >
            {items.map((s) => (
              <ScheduleCard key={s.id} {...cardProps(s)} done />
            ))}
          </motion.div>
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
        <div ref={calendarRef} className="relative space-y-4">
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
              className="touch-pan-y"
            >
              <div className="mb-4 flex items-center justify-between px-0.5">
                <button
                  type="button"
                  onClick={() => goMonth(-1)}
                  className="touch-press rounded-full px-2 py-1 text-[15px] text-ink-soft/70 hover:text-ink"
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
                  className="touch-press rounded-full px-2 py-1 text-[15px] text-ink-soft/70 hover:text-ink"
                  aria-label={t("다음 달", "Next month")}
                >
                  ›
                </button>
              </div>

              {!monthHasEvents && (
                <div className="mb-5 flex flex-col items-center py-6 text-center">
                  <span className="text-[2.5rem]" aria-hidden>
                    🌿
                  </span>
                  <p className="mt-3 text-[15px] font-semibold text-ink">
                    {t("아무것도 없어요.", "Nothing planned.")}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-soft/80">
                    {t(
                      "날짜를 길게 눌러 바로 추가해 보세요",
                      "Long-press a day to add something",
                    )}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold">
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
                              <div key={`${wi}-${i}`} className="min-h-[52px]" />
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
            <div className="space-y-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => onQuickAdd(defaultStartForDay(y, m, selected))}
                className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-primary/25 py-3 text-[14px] font-bold text-ink touch-press"
              >
                <Plus size={16} strokeWidth={2.5} />
                {t("그때 남기기", "Remember for then")}
              </motion.button>

              <div className="rounded-[16px] px-1">
                <div className="mb-2 flex items-center justify-between gap-2">
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
                  <p className="py-2 text-[12px] text-ink-soft/70">
                    {t("이 날은 비어 있어요.", "Nothing on this day.")}
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
            className="fixed inset-0 z-40 bg-ink/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
      className={`flex cursor-grab items-start gap-2 rounded-[14px] px-2 py-2 touch-none transition active:cursor-grabbing ${
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
      <span className="flex-1 text-[13px] leading-snug text-ink">{s.text}</span>
    </li>
  );
}

function Empty() {
  return (
    <EmptyState
      emoji="🌙"
      titleKo="아직 그때가 없어요"
      titleEn="Nothing anchored yet"
      hintKo="생각을 오른쪽으로 밀거나, 마음에 드는 날에 남겨 보세요"
      hintEn="Swipe a thought right, or leave it on a day that feels right"
    />
  );
}
