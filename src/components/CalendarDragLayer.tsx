import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, GripVertical } from "lucide-react";
import type { ScheduleItem } from "@/lib/store";
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

    const dayFromPoint = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest("[data-cal-day]");
      if (!el) return null;
      const day = Number(el.getAttribute("data-cal-day"));
      return Number.isFinite(day) ? day : null;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      posRef.current = { x: e.clientX, y: e.clientY };
      const day = dayFromPoint(e.clientX, e.clientY);
      hoverRef.current = day;
      setHoverDay(day);
      setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : null));
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return;
      const day = hoverRef.current;
      if (day != null) {
        hapticConfirm();
        setDropped(true);
        window.setTimeout(() => setDropped(false), 280);
        onDropToDate(drag.groupIds, day, month, year);
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
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scrollEl = scrollParent ?? document.documentElement;
      const now = Date.now();

      if (y < EDGE_ZONE) scrollEl.scrollTop -= SCROLL_STEP;
      if (y > vh - EDGE_ZONE) scrollEl.scrollTop += SCROLL_STEP;

      if (onEdgeMonth) {
        if (x < EDGE_ZONE && now - monthEdgeAt.current > MONTH_EDGE_COOLDOWN_MS) {
          monthEdgeAt.current = now;
          onEdgeMonth(-1);
        } else if (
          x > vw - EDGE_ZONE &&
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

  const startDrag = (e: ReactPointerEvent, item: ScheduleItem) => {
    e.preventDefault();
    e.stopPropagation();
    tick();
    const groupIds = getDragGroup?.(item) ?? [item.id];
    posRef.current = { x: e.clientX, y: e.clientY };
    monthEdgeAt.current = 0;
    setDrag({
      id: item.id,
      item,
      groupIds,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pinned: pinned(item.id),
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  return (
    <>
      {children({
        startDrag,
        hoverDay,
        draggingId: drag?.id ?? null,
        draggingIds: drag?.groupIds ?? [],
      })}
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
    const el = ref.current;
    if (!el) return;
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      const oy = getComputedStyle(node).overflowY;
      if (oy === "auto" || oy === "scroll") {
        setParent(node);
        return;
      }
      node = node.parentElement;
    }
    setParent(document.documentElement);
  }, [ref]);

  return parent;
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
  onDragStart?: (e: ReactPointerEvent, item: ScheduleItem) => void;
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

  const onDown = (e: ReactPointerEvent) => {
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

  return (
    <motion.button
      type="button"
      data-cal-day={day}
      onClick={onSelect}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      animate={{
        scale: isHover ? 1.04 : 1,
        backgroundColor: isHover
          ? "oklch(0.92 0.08 95 / 0.55)"
          : isSelected
            ? "oklch(0.97 0.03 95 / 0.9)"
            : "transparent",
      }}
      transition={{ duration: isHover ? 0.12 : 0.15, ...SPRING_SNAP_BACK }}
      className={`relative flex min-h-[52px] flex-col items-stretch rounded-[14px] p-1.5 text-left transition-shadow ${
        isHover
          ? "ring-1 ring-primary/40"
          : isSelected
            ? "ring-1 ring-primary/30"
            : isToday
              ? "ring-1 ring-ink/10"
              : "hover:bg-ink/[0.03]"
      }`}
    >
      <span
        className={`text-[11px] font-semibold leading-none tabular-nums ${
          isWeekend ? "text-ink-soft/55" : "text-ink-soft"
        } ${isToday && !isSelected ? "text-ink" : ""}`}
      >
        {day}
      </span>

      {hasEvents && firstEvent && (
        <div
          role="presentation"
          onPointerDown={(e) => {
            e.stopPropagation();
            if (onDragStart) onDragStart(e, firstEvent);
          }}
          onClick={(e) => e.stopPropagation()}
          className="mt-auto flex touch-none items-center gap-0.5 rounded-[9px] bg-primary/45 px-1.5 py-1 active:scale-[0.97]"
        >
          <GripVertical
            size={9}
            strokeWidth={2.5}
            className="shrink-0 text-ink/45"
            aria-hidden
          />
          <span className="line-clamp-1 text-[10px] font-semibold leading-tight text-ink">
            {preview}
            {eventCount > 1 ? ` +${eventCount - 1}` : ""}
          </span>
        </div>
      )}
    </motion.button>
  );
}
