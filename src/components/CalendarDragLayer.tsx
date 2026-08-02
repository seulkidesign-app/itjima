import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical, Pin } from "lucide-react";
import { toast } from "sonner";
import {
  useSchedules,
  useUserId,
  type ScheduleItem,
} from "@/lib/store";
import { resolveScheduleAllDayFlags } from "@/lib/scheduleTime";
import { syncScheduleReminderDetailed } from "@/lib/push/scheduledRemindersSync";
import { useT } from "@/lib/i18n";
import { SPRING_DEFAULT, SPRING_SNAP_BACK } from "@/lib/motion";
import { tick, confirm as hapticConfirm } from "@/lib/haptics";

const EDGE_ZONE = 52;
const SCROLL_STEP = 11;
const MONTH_EDGE_COOLDOWN_MS = 680;

type DragState = {
  id: string;
  item: ScheduleItem;
  groupIds: string[];
  pointerId: number;
  x: number;
  y: number;
  pinned: boolean;
};

type CalendarTarget = {
  day: number;
  month: number;
  year: number;
  element: HTMLElement;
};

type ResizeEdge = "start" | "end";

type ResizeState = {
  item: ScheduleItem;
  edge: ResizeEdge;
  pointerId: number;
  x: number;
  y: number;
  target: CalendarTarget | null;
};

type Props = {
  month: number;
  year: number;
  pinned: (id: string) => boolean;
  getDragGroup?: (item: ScheduleItem) => string[];
  onDropToDate: (
    ids: string[],
    day: number,
    month: number,
    year: number,
  ) => void;
  onEdgeMonth?: (dir: -1 | 1) => void;
  scrollParent?: HTMLElement | null;
  children: (handlers: {
    startDrag: (e: ReactPointerEvent, item: ScheduleItem) => void;
    hoverDay: number | null;
    draggingId: string | null;
    draggingIds: string[];
  }) => React.ReactNode;
};

function targetFromPoint(x: number, y: number): CalendarTarget | null {
  const element = document
    .elementFromPoint(x, y)
    ?.closest<HTMLElement>("[data-cal-day]");
  if (!element) return null;

  const shell = element.closest<HTMLElement>(".calendar-experience-shell");
  const day = Number(element.dataset.calDay);
  const month = Number(shell?.dataset.calMonth);
  const year = Number(shell?.dataset.calYear);
  if (![day, month, year].every(Number.isFinite)) return null;
  return { day, month, year, element };
}

function dateWithOriginalTime(
  target: CalendarTarget,
  original: Date,
  allDay: boolean,
  edge: ResizeEdge,
): Date {
  if (allDay && edge === "start") {
    return new Date(target.year, target.month, target.day, 0, 0, 0, 0);
  }
  if (allDay && edge === "end") {
    return new Date(target.year, target.month, target.day, 23, 59, 59, 999);
  }
  return new Date(
    target.year,
    target.month,
    target.day,
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    original.getMilliseconds(),
  );
}

export function CalendarDragLayer({
  month,
  year,
  pinned,
  getDragGroup,
  onDropToDate,
  onEdgeMonth,
  scrollParent,
  children,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const [dropped, setDropped] = useState(false);
  const hoverRef = useRef<number | null>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const monthEdgeAt = useRef(0);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      posRef.current = { x: e.clientX, y: e.clientY };
      const target = targetFromPoint(e.clientX, e.clientY);
      hoverRef.current = target?.day ?? null;
      setHoverDay(target?.day ?? null);
      setDrag((current) =>
        current ? { ...current, x: e.clientX, y: e.clientY } : null,
      );
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const target = targetFromPoint(e.clientX, e.clientY);
      const day = target?.day ?? hoverRef.current;
      if (day != null) {
        hapticConfirm();
        setDropped(true);
        window.setTimeout(() => setDropped(false), 280);
        onDropToDate(
          drag.groupIds,
          day,
          target?.month ?? month,
          target?.year ?? year,
        );
      }
      setDrag(null);
      setHoverDay(null);
      hoverRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, month, year, onDropToDate]);

  useEffect(() => {
    if (!drag) return;
    let raf = 0;

    const loop = () => {
      const { x, y } = posRef.current;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollElement = scrollParent ?? document.documentElement;
      const now = Date.now();

      if (y < EDGE_ZONE) scrollElement.scrollTop -= SCROLL_STEP;
      if (y > viewportHeight - EDGE_ZONE) {
        scrollElement.scrollTop += SCROLL_STEP;
      }

      if (onEdgeMonth) {
        if (
          x < EDGE_ZONE &&
          now - monthEdgeAt.current > MONTH_EDGE_COOLDOWN_MS
        ) {
          monthEdgeAt.current = now;
          onEdgeMonth(-1);
        } else if (
          x > viewportWidth - EDGE_ZONE &&
          now - monthEdgeAt.current > MONTH_EDGE_COOLDOWN_MS
        ) {
          monthEdgeAt.current = now;
          onEdgeMonth(1);
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [drag, onEdgeMonth, scrollParent]);

  const startDrag = (event: ReactPointerEvent, item: ScheduleItem) => {
    event.preventDefault();
    event.stopPropagation();
    tick();
    const groupIds = getDragGroup?.(item) ?? [item.id];
    posRef.current = { x: event.clientX, y: event.clientY };
    monthEdgeAt.current = 0;
    setDrag({
      id: item.id,
      item,
      groupIds,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      pinned: pinned(item.id),
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  return (
    <>
      <div
        className="calendar-experience-shell"
        data-testid="calendar-experience"
        data-cal-month={month}
        data-cal-year={year}
      >
        {children({
          startDrag,
          hoverDay,
          draggingId: drag?.id ?? null,
          draggingIds: drag?.groupIds ?? [],
        })}
      </div>
      <AnimatePresence>
        {drag && (
          <motion.div
            key={drag.id}
            className="pointer-events-none fixed z-[100] flex max-w-[220px] items-center gap-1.5 rounded-[14px] bg-white px-2.5 py-2 shadow-[0_8px_28px_-6px_oklch(0_0_0/0.22)] ring-1 ring-ink/10"
            style={{ left: drag.x, top: drag.y, x: "-50%", y: "-50%" }}
            initial={{ scale: 0.94, opacity: 0.7, y: 4 }}
            animate={{ scale: 1.06, opacity: 1, y: -6, rotate: 1 }}
            exit={{
              scale: dropped ? 1.02 : 0.9,
              opacity: 0,
              y: dropped ? -2 : 8,
            }}
            transition={SPRING_DEFAULT}
          >
            {drag.pinned && (
              <Pin size={10} className="shrink-0 fill-primary text-primary" />
            )}
            <span className="line-clamp-1 text-[12px] font-semibold text-ink">
              {drag.item.text}
            </span>
            {drag.groupIds.length > 1 && (
              <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-ink">
                +{drag.groupIds.length - 1}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function useCalendarScrollParent(
  ref: RefObject<HTMLElement | null>,
): HTMLElement | null {
  const [parent, setParent] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let node: HTMLElement | null = element.parentElement;
    while (node) {
      const overflowY = getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        setParent(node);
        return;
      }
      node = node.parentElement;
    }
    setParent(document.documentElement);
  }, [ref]);

  return parent;
}

export function isMultiDaySchedule(item: ScheduleItem): boolean {
  const start = new Date(item.start_time);
  const end = new Date(item.end_time);
  return (
    start.getFullYear() !== end.getFullYear() ||
    start.getMonth() !== end.getMonth() ||
    start.getDate() !== end.getDate()
  );
}

export function scheduleRangeInMonth(
  item: ScheduleItem,
  year: number,
  month: number,
): { startDay: number; endDay: number } | null {
  const start = new Date(item.start_time);
  const end = new Date(item.end_time);
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
  if (end < monthStart || start > monthEnd) return null;
  const clipStart = start < monthStart ? monthStart : start;
  const clipEnd = end > monthEnd ? monthEnd : end;
  return {
    startDay: clipStart.getDate(),
    endDay: clipEnd.getDate(),
  };
}

type SpanSegment = {
  item: ScheduleItem;
  colStart: number;
  colSpan: number;
  roundLeft: boolean;
  roundRight: boolean;
  startHandle: boolean;
  endHandle: boolean;
  lane: number;
};

function assignSpanLanes(
  segments: Omit<SpanSegment, "lane">[],
): SpanSegment[] {
  const sorted = [...segments].sort(
    (a, b) => a.colStart - b.colStart || b.colSpan - a.colSpan,
  );
  const laneEnds: number[] = [];
  const placed: SpanSegment[] = [];
  for (const segment of sorted) {
    let lane = laneEnds.findIndex(
      (endColumn) => endColumn < segment.colStart,
    );
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(-1);
    }
    laneEnds[lane] = segment.colStart + segment.colSpan - 1;
    placed.push({ ...segment, lane });
  }
  return placed;
}

export function computeWeekSpanSegments(
  week: (number | null)[],
  items: ScheduleItem[],
  year: number,
  month: number,
): SpanSegment[] {
  const weekDays = week.filter((day): day is number => day != null);
  if (!weekDays.length) return [];
  const weekStart = weekDays[0];
  const weekEnd = weekDays[weekDays.length - 1];
  const raw: Omit<SpanSegment, "lane">[] = [];

  for (const item of items) {
    if (!isMultiDaySchedule(item)) continue;
    const range = scheduleRangeInMonth(item, year, month);
    if (!range) continue;
    const segmentStart = Math.max(range.startDay, weekStart);
    const segmentEnd = Math.min(range.endDay, weekEnd);
    if (segmentStart > segmentEnd) continue;
    const columnStart = week.indexOf(segmentStart);
    const columnEnd = week.indexOf(segmentEnd);
    if (columnStart < 0 || columnEnd < 0) continue;

    const actualStart = new Date(item.start_time);
    const actualEnd = new Date(item.end_time);
    const startIsInMonth =
      actualStart.getFullYear() === year && actualStart.getMonth() === month;
    const endIsInMonth =
      actualEnd.getFullYear() === year && actualEnd.getMonth() === month;

    raw.push({
      item,
      colStart: columnStart,
      colSpan: columnEnd - columnStart + 1,
      roundLeft: segmentStart === range.startDay,
      roundRight: segmentEnd === range.endDay,
      startHandle:
        startIsInMonth && segmentStart === actualStart.getDate(),
      endHandle: endIsInMonth && segmentEnd === actualEnd.getDate(),
    });
  }
  return assignSpanLanes(raw);
}

export function CalendarWeekSpanBars({
  segments,
  titleFor,
  draggingIds,
  onDragStart,
}: {
  segments: SpanSegment[];
  titleFor: (item: ScheduleItem) => string;
  draggingIds: string[];
  onDragStart: (event: ReactPointerEvent, item: ScheduleItem) => void;
}) {
  const t = useT();
  const userId = useUserId();
  const { update } = useSchedules();
  const [resize, setResize] = useState<ResizeState | null>(null);
  const resizeTargetRef = useRef<CalendarTarget | null>(null);
  const previousHoverRef = useRef<HTMLElement | null>(null);

  const clearResizeHover = () => {
    previousHoverRef.current?.removeAttribute("data-cal-resize-hover");
    previousHoverRef.current = null;
  };

  const showResizeHover = (
    target: CalendarTarget | null,
    edge: ResizeEdge,
  ) => {
    if (previousHoverRef.current === target?.element) return;
    clearResizeHover();
    if (target) {
      target.element.setAttribute("data-cal-resize-hover", edge);
      previousHoverRef.current = target.element;
    }
  };

  const saveResizedRange = async (
    item: ScheduleItem,
    edge: ResizeEdge,
    target: CalendarTarget,
  ) => {
    const start = new Date(item.start_time);
    const end = new Date(item.end_time);
    const flags = resolveScheduleAllDayFlags(item);
    const nextBoundary = dateWithOriginalTime(
      target,
      edge === "start" ? start : end,
      edge === "start" ? flags.startAllDay : flags.endAllDay,
      edge,
    );

    if (edge === "start" && nextBoundary.getTime() > end.getTime()) {
      toast.error(
        t(
          "시작일은 종료일보다 뒤로 갈 수 없어요.",
          "The start can't be after the end.",
        ),
      );
      return;
    }
    if (edge === "end" && nextBoundary.getTime() < start.getTime()) {
      toast.error(
        t(
          "종료일은 시작일보다 앞으로 갈 수 없어요.",
          "The end can't be before the start.",
        ),
      );
      return;
    }

    const patch: Partial<ScheduleItem> =
      edge === "start"
        ? { start_time: nextBoundary.toISOString() }
        : { end_time: nextBoundary.toISOString() };

    if (edge === "start" && item.alarm && item.alarm_at) {
      const alarm = new Date(item.alarm_at);
      const reminderOffset = start.getTime() - alarm.getTime();
      patch.alarm_at = new Date(
        nextBoundary.getTime() - reminderOffset,
      ).toISOString();
    }

    try {
      const updated = await update(item.id, patch);
      if (!updated) throw new Error("update_failed");
      hapticConfirm();

      if (userId && item.alarm) {
        await syncScheduleReminderDetailed(userId, {
          ...item,
          ...patch,
        });
      }

      toast.success(
        edge === "start"
          ? t("시작일을 바꿨어요", "Start date updated")
          : t("종료일을 바꿨어요", "End date updated"),
      );
    } catch {
      toast.error(
        t(
          "일정 기간을 바꾸지 못했어요.",
          "Couldn't update the schedule range.",
        ),
      );
    }
  };

  useEffect(() => {
    if (!resize) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== resize.pointerId) return;
      const target = targetFromPoint(event.clientX, event.clientY);
      resizeTargetRef.current = target;
      showResizeHover(target, resize.edge);
      setResize((current) =>
        current
          ? {
              ...current,
              x: event.clientX,
              y: event.clientY,
              target,
            }
          : null,
      );
    };

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== resize.pointerId) return;
      const target =
        targetFromPoint(event.clientX, event.clientY) ??
        resizeTargetRef.current;
      clearResizeHover();
      setResize(null);
      resizeTargetRef.current = null;
      if (target) {
        void saveResizedRange(resize.item, resize.edge, target);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      clearResizeHover();
    };
  }, [resize]);

  const startResize = (
    event: ReactPointerEvent,
    item: ScheduleItem,
    edge: ResizeEdge,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    tick();
    resizeTargetRef.current = null;
    setResize({
      item,
      edge,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      target: null,
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  if (!segments.length) return null;
  const laneCount = Math.max(...segments.map((segment) => segment.lane)) + 1;

  return (
    <>
      <div className="calendar-span-stack mt-0.5 space-y-0.5">
        {Array.from({ length: laneCount }, (_, lane) => (
          <div key={lane} className="calendar-span-lane grid grid-cols-7 gap-1">
            {segments
              .filter((segment) => segment.lane === lane)
              .map((segment) => {
                const hidden = draggingIds.includes(segment.item.id);
                return (
                  <div
                    key={`${segment.item.id}-${segment.colStart}-${segment.lane}`}
                    role="presentation"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onDragStart(event, segment.item);
                    }}
                    className={`calendar-span-bar group relative flex h-[18px] touch-none items-center gap-0.5 bg-primary/45 px-1.5 active:scale-[0.97] ${
                      segment.roundLeft ? "rounded-l-[9px]" : ""
                    } ${segment.roundRight ? "rounded-r-[9px]" : ""} ${
                      hidden ? "opacity-0" : ""
                    }`}
                    style={{
                      gridColumn: `${segment.colStart + 1} / span ${segment.colSpan}`,
                    }}
                  >
                    {segment.startHandle && (
                      <button
                        type="button"
                        data-testid="calendar-resize-start"
                        aria-label={t("시작일 조정", "Resize start date")}
                        className="calendar-resize-handle calendar-resize-handle-start"
                        onPointerDown={(event) =>
                          startResize(event, segment.item, "start")
                        }
                      >
                        <ChevronLeft size={11} strokeWidth={3} />
                      </button>
                    )}
                    {segment.roundLeft && !segment.startHandle && (
                      <GripVertical
                        size={9}
                        strokeWidth={2.5}
                        className="shrink-0 text-ink/45"
                        aria-hidden
                      />
                    )}
                    <span className="pointer-events-none line-clamp-1 min-w-0 flex-1 text-[10px] font-semibold leading-tight text-ink">
                      {titleFor(segment.item)}
                    </span>
                    {segment.endHandle && (
                      <button
                        type="button"
                        data-testid="calendar-resize-end"
                        aria-label={t("종료일 조정", "Resize end date")}
                        className="calendar-resize-handle calendar-resize-handle-end"
                        onPointerDown={(event) =>
                          startResize(event, segment.item, "end")
                        }
                      >
                        <ChevronRight size={11} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {resize && (
          <motion.div
            className="pointer-events-none fixed z-[110] rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold text-white shadow-float"
            style={{
              left: resize.x,
              top: resize.y,
              x: "-50%",
              y: "calc(-100% - 12px)",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
          >
            {resize.edge === "start"
              ? t("시작일 변경", "Change start")
              : t("종료일 변경", "Change end")}
            {resize.target
              ? ` · ${resize.target.month + 1}/${resize.target.day}`
              : ""}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function CalendarDayCell({
  day,
  weekday,
  hoverDay,
  dragging,
  isToday,
  isSelected,
  eventCount,
  preview,
  firstEvent,
  onSelect,
  onLongPressEmpty,
  onDragStart,
}: {
  day: number;
  weekday: number;
  hoverDay: number | null;
  dragging: boolean;
  isToday: boolean;
  isSelected: boolean;
  eventCount: number;
  preview?: string;
  firstEvent?: ScheduleItem;
  onSelect: () => void;
  onLongPressEmpty?: () => void;
  onDragStart?: (event: ReactPointerEvent, item: ScheduleItem) => void;
}) {
  const isHover = hoverDay === day && dragging;
  const isWeekend = weekday === 0 || weekday === 6;
  const hasEvents = eventCount > 0;
  const longTimer = useRef<number | null>(null);
  const moved = useRef(false);

  const clearLong = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const onDown = () => {
    moved.current = false;
    clearLong();
    if (!hasEvents && onLongPressEmpty) {
      longTimer.current = window.setTimeout(() => {
        if (!moved.current) onLongPressEmpty();
      }, 420);
    }
  };

  const onMove = () => {
    moved.current = true;
    clearLong();
  };

  const onUp = () => clearLong();

  const dragPreview = (event: ReactPointerEvent) => {
    if (!firstEvent || !onDragStart) return;
    onDragStart(event, firstEvent);
  };

  return (
    <motion.button
      type="button"
      data-cal-day={day}
      data-today={isToday ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
      data-has-events={hasEvents ? "true" : undefined}
      onClick={onSelect}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      animate={{
        scale: isHover ? 1.035 : 1,
        backgroundColor: isHover
          ? "oklch(0.93 0.075 95 / 0.78)"
          : isSelected
            ? "oklch(0.975 0.04 95 / 0.98)"
            : "transparent",
      }}
      transition={{ duration: isHover ? 0.12 : 0.15, ...SPRING_SNAP_BACK }}
      className={`calendar-day-cell relative flex min-h-[44px] flex-col items-stretch rounded-[var(--radius-sm)] p-1.5 text-left transition-shadow ${
        isHover
          ? "ring-2 ring-primary/55"
          : isSelected
            ? "ring-[1.5px] ring-ink/20 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]"
            : isToday
              ? "ring-1 ring-ink/16"
              : "hover:bg-ink/[0.03]"
      }`}
    >
      <span
        className={`calendar-day-number inline-flex text-[11px] font-semibold leading-none tabular-nums ${
          isWeekend ? "text-ink-soft/55" : "text-ink-soft"
        } ${isToday || isSelected ? "font-bold text-ink" : ""}`}
      >
        {day}
      </span>

      {hasEvents && (
        <div className="calendar-day-events mt-auto min-w-0 px-0.5 pb-0.5">
          <div
            className="calendar-day-dots flex items-center justify-center gap-0.5"
            aria-hidden
          >
            {Array.from({ length: Math.min(eventCount, 3) }, (_, index) => (
              <span
                key={index}
                className="h-1 w-1 rounded-full bg-primary/75"
              />
            ))}
          </div>
          {preview && (
            <div className="calendar-day-preview-row mt-1 hidden min-w-0 items-center gap-1">
              <span
                className="calendar-day-preview min-w-0 flex-1 truncate text-[10px] font-semibold leading-tight text-ink/78"
                onPointerDown={dragPreview}
              >
                {preview}
              </span>
              {eventCount > 1 && (
                <span className="calendar-day-more shrink-0 text-[9px] font-bold text-ink-soft/65">
                  +{eventCount - 1}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </motion.button>
  );
}
