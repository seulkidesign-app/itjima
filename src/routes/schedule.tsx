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
import { animate } from "framer-motion";
import { useArchive, useSchedules, type ScheduleItem } from "@/lib/store";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { ReminderSheet } from "@/components/ReminderSheet";
import { ScheduleAlarmSheet } from "@/components/ScheduleAlarmSheet";
import { ScheduleTimerSheet } from "@/components/ScheduleTimerSheet";
import {
  CalendarDragLayer,
  CalendarDayCell,
} from "@/components/CalendarDragLayer";
import { ScheduleListSkeleton } from "@/components/Skeleton";
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
  scheduleDotStatus,
} from "@/lib/scheduleTime";
import {
  groupSchedules,
  isMissed,
  sectionLabel,
  classifySchedule,
} from "@/lib/scheduleGroups";
import { scheduleDisplayTitle, rawPreview } from "@/lib/thoughtProvenance";
import { toast } from "sonner";
import { useT, useLang } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptic, confirm as hapticConfirm } from "@/lib/haptics";

export const Route = createFileRoute("/schedule")({
  component: Schedule,
});

// Pinned IDs live locally (avoids cloud schema change)
const PIN_KEY = "itjima.schedule.pinned";
function readPins(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function writePins(ids: Set<string>) {
  localStorage.setItem(PIN_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent("itjima:pins"));
}

function usePins() {
  const [pins, setPins] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPins(readPins());
    const h = () => setPins(readPins());
    window.addEventListener("itjima:pins", h);
    return () => window.removeEventListener("itjima:pins", h);
  }, []);
  const toggle = (id: string) => {
    const next = new Set(pins);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writePins(next);
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
  const { items, update, remove, add, syncState } = useSchedules();
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
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    clearReminderOffset(s.id);
    await update(s.id, { alarm: true, alarm_at: at.toISOString() });
    toast.success(t("알림을 예약했어요", "Reminder set"));
  };

  const armFromPreset = async (s: ScheduleItem, preset: AlarmPreset) => {
    await armAlarmAt(s, presetToAlarmAt(preset));
  };

  const disarmReminder = async (s: ScheduleItem) => {
    clearReminderOffset(s.id);
    await update(s.id, { alarm: false, alarm_at: null });
  };

  const startTimer = async (s: ScheduleItem, preset: TimerPreset) => {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setActiveTimer(s.id, presetToTimerEnd(preset));
    toast.success(t("타이머 시작", "Timer started"));
  };

  const stopTimer = (s: ScheduleItem) => {
    clearActiveTimer(s.id);
    toast(t("타이머 종료", "Timer stopped"));
  };

  const listSections = useMemo(
    () => groupSchedules(activeItems, pins),
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
    const s = new Date(it.start_time);
    const e = new Date(it.end_time);
    const dur = e.getTime() - s.getTime();
    const ns = new Date(year, month, day, s.getHours(), s.getMinutes());
    const ne = new Date(ns.getTime() + dur);
    await update(id, {
      start_time: ns.toISOString(),
      end_time: ne.toISOString(),
    });
    hapticConfirm();
    toast.success(t("날짜가 옮겨졌어요", "Date moved"));
  };

  const markDone = async (s: ScheduleItem) => {
    await update(s.id, { status: "done" });
    hapticConfirm();
    track("schedule_completed", { text_length: s.text.length });
    toast.success(t("완료했어요", "Marked done"));
  };

  const moveDoneToArchive = async (s: ScheduleItem) => {
    await archive.add({
      text: s.raw_text ?? s.text,
      images: [],
      source_id: s.source_id ?? s.id,
      raw_text: s.raw_text ?? s.text,
      brain_mirror: s.brain_mirror ?? null,
    });
    await remove(s.id);
    if (pins.has(s.id)) togglePin(s.id);
    toast.success(t("기억으로 옮겼어요", "Moved to Memory"));
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
    onDelete: () => {
      remove(s.id);
      if (pins.has(s.id)) togglePin(s.id);
      toast(t("삭제됨", "Deleted"));
    },
  });

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white">
        <div className="px-5 pb-3 pt-6">
          <div className="nrc-eyebrow">{t("나의 일정", "My Schedule")}</div>
          <h1 className="page-title mt-1">{t("계획", "Plan")}</h1>
        </div>
        <div className="px-5 pb-3">
          <div className="inline-flex border-b border-ink/10">
            {(
              [
                ["list", t("리스트", "List")],
                ["today", t("오늘", "Today")],
                ["cal", t("캘린더", "Calendar")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.16em] transition ${
                  tab === k ? "text-ink" : "text-ink-soft"
                }`}
              >
                {label}
                <span
                  className={`absolute inset-x-0 -bottom-px h-[3px] transition-all ${
                    tab === k ? "bg-ink" : "bg-transparent"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 pb-6">
        {syncState === "syncing" && items.length === 0 ? (
          <ScheduleListSkeleton />
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
          listSections.length === 0 && doneItems.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-5">
              {listSections.map((sec) => (
                <section key={sec.key}>
                  <h2 className="mb-2 px-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
                    {sectionLabel(sec.key, lang)}
                  </h2>
                  <div className="flex flex-col gap-3">
                    {sec.items.map((s) => (
                      <ScheduleCard
                        key={s.id}
                        {...cardProps(s)}
                        emphasize={sec.key === "now"}
                      />
                    ))}
                  </div>
                </section>
              ))}
              {doneItems.length > 0 && (
                <DoneSection items={doneItems} cardProps={cardProps} t={t} />
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
            onDropToDate={moveEventToDate}
          />
        )}
      </div>

      <button
        onClick={() => setSheet({ open: true })}
        className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-float touch-press transition"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        aria-label={t("새 일정", "New event")}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

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
          if (sheet.edit) {
            await update(sheet.edit.id, {
              text,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              all_day: opts?.allDay ?? false,
              repeat: opts?.repeat ?? null,
            });
            toast.success(t("수정됐어요", "Updated"));
          } else {
            await add({
              text,
              start_time: start.toISOString(),
              end_time: end.toISOString(),
              alarm: false,
              all_day: opts?.allDay ?? false,
              repeat: opts?.repeat ?? null,
            });
            track("schedule_created", {
              source: "manual",
              text_length: text.length,
            });
            toast.success(t("등록됐어요", "Added"));
          }
          setSheet({ open: false });
        }}
      />
    </div>
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
    dot === "urgent"
      ? "bg-red-500"
      : dot === "today"
        ? "bg-primary"
        : "bg-ink/25";

  return (
    <div className="relative">
      {swipeHint && !done && (
        <div
          className="pointer-events-none absolute left-3 top-1/2 z-0 flex -translate-y-1/2 items-center gap-1 rounded-full bg-primary/90 px-3 py-1.5 text-[12px] font-extrabold text-ink shadow-card"
          style={{ opacity: Math.min(1, dx / 72) }}
        >
          <Check size={14} strokeWidth={3} />
          {t("완료", "Done")}
        </div>
      )}
      <div
        className={`card-radius shadow-card px-[18px] py-5 transition ${
          done ? "opacity-50" : ""
        } ${emphasize || timer ? "ring-2 ring-primary/30 bg-primary/10" : pinned ? "bg-primary/15 ring-2 ring-primary/40" : "glass"} ${
          missed && !done ? "border-l-4 border-amber-300/80" : ""
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
            className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
              done
                ? "border-primary bg-primary text-ink"
                : "border-ink/20 hover:border-primary"
            }`}
            aria-label={t("완료", "Done")}
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
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {t("시간 지남", "Past due")}
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
              {fmt(start)} → {fmt(end)}
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
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
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
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
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
                className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                  s.alarm ? "bg-primary text-ink" : "bg-white/70 text-ink-soft"
                }`}
              >
                {s.alarm ? <Bell size={14} /> : <BellOff size={14} />}
              </button>
            </div>
          )}
        </div>
        {!done && (
          <p className="mt-3 text-[10px] text-ink-soft/80">
            {t(
              "→ 밀어 완료 · 길게 눌러 수정",
              "→ Swipe to complete · Hold to edit",
            )}
          </p>
        )}
        {!done && (
          <div className="mt-2 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="text-[12px] font-medium text-ink-soft hover:text-ink"
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
        className="mb-2 w-full px-1 text-left text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft"
      >
        {t("완료됨", "Done")} · {items.length} {open ? "▾" : "▸"}
      </button>
      {open && (
        <div className="flex flex-col gap-3">
          {items.map((s) => (
            <ScheduleCard key={s.id} {...cardProps(s)} done />
          ))}
        </div>
      )}
    </section>
  );
}

function fmt(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
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
      ? ["S", "M", "T", "W", "T", "F", "S"]
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
              {t(
                "💡 일정을 끌어 다른 날로 옮겨보세요",
                "💡 Drag an event onto another day",
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
                  {t("이 날은 여유로워요.", "This day is wide open.")}
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
  const t = useT();
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center text-center px-4">
      <div className="text-5xl">🗓</div>
      <div className="mt-3 text-[17px] font-bold text-ink">
        {t("시간이 비어 있어요.", "Your calendar is open.")}
      </div>
      <div className="mt-1 text-sm text-ink-soft">
        {t(
          "생각을 오른쪽으로 밀거나 + 로 채워보세요.",
          "Swipe a thought right or tap + when you're ready.",
        )}
      </div>
    </div>
  );
}
