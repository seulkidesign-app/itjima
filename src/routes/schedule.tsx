import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Plus, Pin, Check, Bell, BellOff, Timer } from "lucide-react";
import { animate, motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { useArchive, useSchedules, type ScheduleItem } from "@/lib/store";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { ReminderSheet } from "@/components/ReminderSheet";
import { ScheduleAlarmSheet } from "@/components/ScheduleAlarmSheet";
import { ScheduleTimerSheet } from "@/components/ScheduleTimerSheet";
import {
  CalendarDragLayer,
  CalendarDayCell,
} from "@/components/CalendarDragLayer";
import { EmptyState } from "@/components/EmptyState";
import { SyncIndicator } from "@/components/SyncIndicator";
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
import { formatScheduleTimeLoose, scheduleDotStatus } from "@/lib/scheduleTime";
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
  const [tab, setTab] = useState<"today" | "list" | "cal">("list");
  const [sheet, setSheet] = useState<{ open: boolean; edit?: ScheduleItem }>({
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
        );
      } else if (perm === "denied") {
        toast.message(
          t(
            "알림은 꺼져 있지만, 그때는 기억해 둘게요",
            "Notifications off — we'll still remember when",
          ),
        );
      } else {
        toast.success(t("그때를 기억해 둘게요", "I'll remember this for then"));
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

  const todayTimerItems = useMemo(() => {
    return [...activeItems]
      .filter((s) => {
        const k = classifySchedule(s.start_time);
        return k === "now" || k === "today" || pins.has(s.id);
      })
      .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time));
  }, [activeItems, pins]);

  const moveEventToDate = async (
    id: string,
    day: number,
    month: number,
    year: number,
  ) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    try {
      const s = new Date(it.start_time);
      const e = new Date(it.end_time);
      const dur = e.getTime() - s.getTime();
      const ns = new Date(year, month, day, s.getHours(), s.getMinutes());
      const ne = new Date(ns.getTime() + dur);
      const moved = await update(id, {
        start_time: ns.toISOString(),
        end_time: ne.toISOString(),
      });
      hapticConfirm();
      if (moved) toast.success(t("날짜가 옮겨졌어요", "Date moved"));
    } catch {
      toast.error(t("날짜를 옮기지 못했어요", "Couldn't move date"));
    }
  };

  const markDone = async (s: ScheduleItem) => {
    try {
      const done = await update(s.id, { status: "done" });
      hapticConfirm();
      track("schedule_completed", { text_length: s.text.length });
      if (done) toast.success(t("다녀온 기억이에요", "You can let this go"));
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
        toast.success(t("기억함으로 옮겼어요", "Moved to Saved"));
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
        if (deleted) toast(t("삭제됨", "Deleted"));
      } catch {
        toast.error(t("삭제하지 못했어요", "Couldn't delete"));
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
        <div className="px-5 pb-3 pt-5">
          <h1 className="page-title">{t("그때", "When")}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
            {activeItems.length > 0
              ? t(
                  `${activeItems.length}가지를 기억하고 있어요`,
                  `${activeItems.length} moments to remember`,
                )
              : t("아직 날짜를 붙인 게 없어요", "Nothing dated yet")}
          </p>
        </div>
        <div className="px-5 pb-3">
          <LayoutGroup>
            <div className="inline-flex border-b border-ink/10" role="tablist">
              {(
                [
                  ["list", t("목록", "List"), "schedule-panel-list"],
                  ["today", t("오늘", "Today"), "schedule-panel-today"],
                  ["cal", t("캘린더", "Calendar"), "schedule-panel-cal"],
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
          <Empty />
        ) : tab === "today" ? (
          todayTimerItems.length === 0 && doneItems.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-3">
              {todayTimerItems.map((s) => (
                <ScheduleCard key={s.id} {...cardProps(s)} timer />
              ))}
              {doneItems.length > 0 && (
                <DoneSection items={doneItems} cardProps={cardProps} t={t} />
              )}
            </div>
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
            onDropToDate={moveEventToDate}
          />
        )}
          </motion.div>
        </AnimatePresence>
      </div>

      <motion.button
        onClick={() => setSheet({ open: true })}
        whileTap={{ scale: 0.94 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...SPRING_SNAP_BACK, delay: 0.15 }}
        className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-float touch-press"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        aria-label={t("새로 남기기", "Remember something new")}
      >
        <Plus size={26} strokeWidth={2.5} />
      </motion.button>

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
        initialStart={sheet.edit ? new Date(sheet.edit.start_time) : undefined}
        initialEnd={sheet.edit ? new Date(sheet.edit.end_time) : undefined}
        initialAllDay={sheet.edit?.all_day}
        initialRepeat={sheet.edit?.repeat}
        saveLabel={sheet.edit ? t("저장", "Save") : undefined}
        onClose={() => setSheet({ open: false })}
        onSave={async (text, start, end, opts) => {
          try {
            const alarmPayload =
              opts?.alarmMinutesBefore != null
                ? {
                    alarm: true,
                    alarm_at: new Date(
                      start.getTime() - opts.alarmMinutesBefore * 60 * 1000,
                    ).toISOString(),
                  }
                : { alarm: false };

            if (sheet.edit) {
              await update(sheet.edit.id, {
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                all_day: opts?.allDay ?? false,
                repeat: opts?.repeat ?? null,
                ...alarmPayload,
              });
              toast.success(t("수정됐어요", "Updated"));
            } else {
              await add({
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                all_day: opts?.allDay ?? false,
                repeat: opts?.repeat ?? null,
                ...alarmPayload,
              });
              track("schedule_created", {
                source: "manual",
                text_length: text.length,
              });
              toast.success(t("기억해 둘게요", "I'll remember this"));
            }
            setSheet({ open: false });
          } catch {
            toast.error(t("저장하지 못했어요", "Couldn't save"));
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
  const title = scheduleDisplayTitle(s);
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
      aria-label={`${title}. ${t("밀어 다녀옴, 탭하여 고치기", "Swipe when done, tap to edit")}`}
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
      <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-ink">
        {title}
      </span>
    </li>
  );
}

function ScheduleFeelHint() {
  const t = useT();
  return (
    <p className="mt-2 px-1 text-[11px] text-ink-soft/70">
      {t("→ 밀어 다녀옴 · 탭하여 고치기", "→ Swipe when done · Tap to edit")}
    </p>
  );
}

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
}: {
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
}) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en-US" : "ko-KR";
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const rel = formatScheduleTimeLoose(start, lang);
  const dot = scheduleDotStatus(start);
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
  const dotColor =
    dot === "urgent" ? "bg-ink" : dot === "today" ? "bg-primary" : "bg-ink/25";

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
            aria-label={t("다녀옴", "Done")}
          >
            {done ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <span
                className={`h-2.5 w-2.5 rounded-full ${dotColor}`}
                aria-hidden
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
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
          </div>
          {!done && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <button
                type="button"
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
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAlarm();
                }}
                aria-label={t("알림", "Reminder")}
                className={`touch-target rounded-full transition ${
                  s.alarm ? "bg-primary text-ink" : "bg-white/70 text-ink-soft"
                }`}
              >
                {s.alarm ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            </div>
          )}
        </div>
        {!done && (
          <div className="mt-2 flex justify-end">
            <button
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
        className="mb-2 w-full px-1 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft touch-press"
      >
        {t("다녀온 기억", "Let go")} · {items.length}{" "}
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
  onDropToDate,
}: {
  items: ScheduleItem[];
  pins: Set<string>;
  onTogglePin: (id: string) => void;
  onEdit: (s: ScheduleItem) => void;
  onDropToDate: (id: string, day: number, month: number, year: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const today = new Date();
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
  const eventsOf = (day: number) =>
    items.filter((s) => {
      const dt = new Date(s.start_time);
      return (
        dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day
      );
    });
  const [selected, setSelected] = useState<number | null>(today.getDate());
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

  return (
    <CalendarDragLayer
      month={m}
      year={y}
      pinned={(id) => pins.has(id)}
      onDropToDate={onDropToDate}
    >
      {({ startDrag, hoverDay, draggingId }) => (
        <div className="space-y-3">
          <div className="card-radius glass shadow-card p-3">
            <div className="mb-3 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() =>
                  setView((v) => ({
                    y: v.m === 0 ? v.y - 1 : v.y,
                    m: (v.m + 11) % 12,
                  }))
                }
                className="touch-press rounded-full px-2 py-0.5 text-sm text-ink-soft hover:bg-white/60"
              >
                ‹
              </button>
              <div className="text-sm font-bold text-ink">{monthLabel}</div>
              <button
                type="button"
                onClick={() =>
                  setView((v) => ({
                    y: v.m === 11 ? v.y + 1 : v.y,
                    m: (v.m + 1) % 12,
                  }))
                }
                className="touch-press rounded-full px-2 py-0.5 text-sm text-ink-soft hover:bg-white/60"
              >
                ›
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-soft">
              {weekdays.map((d, i) => (
                <div key={i}>{d}</div>
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-7 gap-0.5">
              {cells.map((c, i) => {
                if (!c) return <div key={i} className="aspect-square" />;
                const evs = eventsOf(c);
                const isToday =
                  c === today.getDate() &&
                  m === today.getMonth() &&
                  y === today.getFullYear();
                const isSel = c === selected;
                const preview = evs.length
                  ? `${pins.has(evs[0].id) ? "📌" : ""}${evs[0].text}`
                  : undefined;
                return (
                  <CalendarDayCell
                    key={i}
                    day={c}
                    hoverDay={hoverDay}
                    dragging={draggingId !== null}
                    isToday={isToday}
                    isSelected={isSel}
                    eventCount={evs.length}
                    preview={preview}
                    onSelect={() => {
                      setSelected(c);
                      haptic(6);
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 px-1 text-[10px] text-ink-soft/80">
              {items.length > 0 &&
                t(
                  "일정을 끌어 다른 날로 옮겨 보세요",
                  "Drag to another day if the timing shifts",
                )}
            </div>
          </div>

          {selected !== null && (
            <div className="card-radius glass-soft shadow-card p-3">
              <div className="mb-2 px-1 text-[12px] font-bold text-ink-soft">
                {new Date(y, m, selected).toLocaleDateString(locale, {
                  month: "short",
                  day: "numeric",
                  weekday: "short",
                })}
                <span className="ml-1 text-ink-soft/70">
                  · {selectedEvents.length}
                </span>
              </div>
              {selectedEvents.length === 0 ? (
                <div className="px-1 py-3 text-center text-[12px] text-ink-soft">
                  {t("이 날은 비어 있어요.", "Nothing on this day.")}
                </div>
              ) : (
                <ul className="space-y-1.5">
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
                        dragging={draggingId === s.id}
                        onClick={() => onEdit(s)}
                        onLongPress={() => onTogglePin(s.id)}
                        onDragStart={(e) => startDrag(e, s)}
                      />
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </CalendarDragLayer>
  );
}

function DayEventChip({
  s,
  pinned,
  dragging,
  onClick,
  onLongPress,
  onDragStart,
}: {
  s: ScheduleItem;
  pinned: boolean;
  dragging?: boolean;
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
    timer.current = window.setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, 500);
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
    if (!dragStarted.current && !fired.current) onClick();
    start.current = null;
    dragStarted.current = false;
  };

  return (
    <li
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      className={`flex cursor-grab items-start gap-2 rounded-[24px] px-2.5 py-2 touch-none transition active:cursor-grabbing ${
        dragging
          ? "opacity-30 scale-[0.98]"
          : pinned
            ? "bg-primary/30 ring-1 ring-primary"
            : "bg-white/70 hover:bg-white"
      }`}
    >
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
      emoji="🗓"
      titleKo="아직 그때가 없어요"
      titleEn="Nothing dated yet"
      hintKo="생각을 오른쪽으로 밀거나 + 로 날짜를 붙여 보세요"
      hintEn="Swipe a thought right, or tap + when a day comes to mind"
    />
  );
}
