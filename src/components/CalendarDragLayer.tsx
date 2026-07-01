import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin } from "lucide-react";
import type { ScheduleItem } from "@/lib/store";
import { SPRING_DEFAULT, SPRING_SNAP_BACK } from "@/lib/motion";
import { tick, confirm as hapticConfirm } from "@/lib/haptics";

type DragState = {
  id: string;
  item: ScheduleItem;
  pointerId: number;
  x: number;
  y: number;
  pinned: boolean;
};

type Props = {
  month: number;
  year: number;
  pinned: (id: string) => boolean;
  onDropToDate: (id: string, day: number, month: number, year: number) => void;
  children: (handlers: {
    startDrag: (e: ReactPointerEvent, item: ScheduleItem) => void;
    hoverDay: number | null;
    draggingId: string | null;
  }) => React.ReactNode;
};

export function CalendarDragLayer({
  month,
  year,
  pinned,
  onDropToDate,
  children,
}: Props) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);

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
        onDropToDate(drag.id, day, month, year);
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

  const startDrag = (e: ReactPointerEvent, item: ScheduleItem) => {
    e.preventDefault();
    tick();
    setDrag({
      id: item.id,
      item,
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      pinned: pinned(item.id),
    });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  return (
    <>
      {children({ startDrag, hoverDay, draggingId: drag?.id ?? null })}
      <AnimatePresence>
        {drag && (
          <motion.div
            key={drag.id}
            className="pointer-events-none fixed z-[100] flex max-w-[220px] items-start gap-2 rounded-[20px] bg-white px-3 py-2.5 shadow-float ring-2 ring-primary/40"
            style={{ left: drag.x, top: drag.y, x: "-50%", y: "-50%" }}
            initial={{ scale: 0.92, opacity: 0.85 }}
            animate={{ scale: 1.04, opacity: 1, rotate: 1.5 }}
            exit={{ scale: 0.88, opacity: 0 }}
            transition={SPRING_DEFAULT}
          >
            {drag.pinned && (
              <Pin size={11} className="mt-0.5 fill-primary text-primary" />
            )}
            <span className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
              {drag.item.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export function CalendarDayCell({
  day,
  hoverDay,
  dragging,
  isToday,
  isSelected,
  eventCount,
  preview,
  onSelect,
}: {
  day: number;
  hoverDay: number | null;
  dragging: boolean;
  isToday: boolean;
  isSelected: boolean;
  eventCount: number;
  preview?: string;
  onSelect: () => void;
}) {
  const isHover = hoverDay === day && dragging;

  return (
    <motion.button
      type="button"
      data-cal-day={day}
      onClick={onSelect}
      animate={{ scale: isHover ? 1.1 : 1 }}
      transition={SPRING_SNAP_BACK}
      className={`relative flex aspect-square flex-col items-stretch justify-start rounded-[24px] p-1 text-left transition-colors ${
        isHover
          ? "bg-primary/50 ring-2 ring-primary shadow-card"
          : isSelected
            ? "bg-primary text-ink shadow-card"
            : isToday
              ? "bg-primary/20 text-ink"
              : "text-ink hover:bg-white/60"
      }`}
    >
      <span className="text-[11px] font-bold leading-none">{day}</span>
      {eventCount > 0 && (
        <span
          className={`mt-0.5 line-clamp-2 text-[8px] font-medium leading-[1.1] ${
            isSelected ? "text-ink/80" : "text-ink-soft"
          }`}
        >
          {preview}
          {eventCount > 1 && (
            <span className="ml-0.5 opacity-70"> +{eventCount - 1}</span>
          )}
        </span>
      )}
    </motion.button>
  );
}
