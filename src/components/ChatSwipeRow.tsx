import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Archive, Calendar } from "lucide-react";
import { animate } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tickDebounced, confirm as confirmHaptic } from "@/lib/haptics";
import { SPRING_SNAP_BACK } from "@/lib/motion";

type Side = "left" | "right";

const GAP = 16;
const OPEN_AT = 32;
const MAX_DRAG = 120;

function rubber(value: number, limit: number) {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  return Math.sign(value) * (limit + (abs - limit) * 0.15);
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

export function ChatSwipeRow({
  children,
  rowId,
  openRowId,
  onOpenRowChange,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  onTap,
  disabled,
}: {
  children: ReactNode;
  rowId?: string;
  openRowId?: string | null;
  onOpenRowChange?: (id: string | null) => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onLongPress?: () => void;
  onTap?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const [acting, setActing] = useState(false);
  const draggingRef = useRef(false);
  const dragRef = useRef(0);
  const startX = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  dragRef.current = dragX;

  const springDrag = useCallback((to: number, onDone?: () => void) => {
    animate(dragRef.current, to, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        dragRef.current = v;
        setDragX(v);
      },
      onComplete: onDone,
    });
  }, []);

  const dismiss = useCallback(() => {
    setOpenSide(null);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springDrag(0);
  }, [rowId, onOpenRowChange, springDrag]);

  const snapOpen = useCallback(
    (side: Side) => {
      setOpenSide(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      dragRef.current = 0;
      setDragX(0);
      tickDebounced();
    },
    [rowId, onOpenRowChange],
  );

  const commit = useCallback(
    (side: Side) => {
      if (acting) return;
      setActing(true);
      confirmHaptic();
      if (side === "right") onSwipeRight();
      else onSwipeLeft();
      setOpenSide(null);
      setActing(false);
      dragRef.current = 0;
      setDragX(0);
      if (rowId && onOpenRowChange) onOpenRowChange(null);
    },
    [acting, onSwipeLeft, onSwipeRight, rowId, onOpenRowChange],
  );

  useEffect(() => {
    if (!rowId || openRowId === undefined) return;
    if (openRowId !== rowId && openSide) dismiss();
  }, [openRowId, rowId, openSide, dismiss]);

  useEffect(() => {
    if (!openSide) return;
    const onDocDown = (e: Event) => {
      const target = e.target as Node;
      if (rowRef.current?.contains(target)) return;
      dismiss();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("pointerdown", onDocDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDocDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [openSide, dismiss]);

  const clearLongPress = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || acting) return;
    draggingRef.current = true;
    longFired.current = false;
    moved.current = false;
    startX.current = e.clientX;
    clearLongPress();
    if (onLongPress) {
      longTimer.current = window.setTimeout(() => {
        if (draggingRef.current && !moved.current) {
          longFired.current = true;
          dismiss();
          onLongPress();
        }
      }, 480);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || acting) return;
    let x = e.clientX - startX.current;

    if (Math.abs(x) > 8) {
      moved.current = true;
      clearLongPress();
    }

    if (openSide === "right" && x < 0) x = 0;
    if (openSide === "left" && x > 0) x = 0;

    x = rubber(x, MAX_DRAG);
    dragRef.current = x;
    setDragX(x);
    if (Math.abs(x) > 14) tickDebounced();
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
    if (longFired.current) return;

    const x = dragRef.current;

    if (openSide) {
      if (Math.abs(x) < OPEN_AT * 0.35) dismiss();
      else springDrag(0);
      return;
    }

    if (x >= OPEN_AT) {
      snapOpen("right");
      return;
    }
    if (x <= -OPEN_AT) {
      snapOpen("left");
      return;
    }
    if (!moved.current && onTap) onTap();
    springDrag(0);
  };

  const scheduleOpacity =
    openSide === "right" ? 1 : clamp01(dragX / OPEN_AT);
  const archiveOpacity = openSide === "left" ? 1 : clamp01(-dragX / OPEN_AT);
  const showSchedule =
    openSide === "right" || (dragX > 6 && openSide !== "left");
  const showArchive =
    openSide === "left" || (dragX < -6 && openSide !== "right");

  const pillStyle = (opacity: number) => ({
    opacity,
    pointerEvents: (opacity > 0.55 ? "auto" : "none") as "auto" | "none",
    transform: `translateY(-50%) scale(${0.86 + opacity * 0.14})`,
  });

  return (
    <div
      ref={rowRef}
      className="swipe-row relative flex w-full justify-end py-0.5"
      style={{ touchAction: "pan-y" }}
    >
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative shrink-0 touch-none select-none"
      >
        {showSchedule && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit("right");
            }}
            className="swipe-pill-btn swipe-pill-schedule absolute top-1/2 z-[2]"
            style={{
              right: `calc(100% + ${GAP}px)`,
              ...pillStyle(scheduleOpacity),
            }}
            aria-label={t("그때", "When")}
          >
            <Calendar size={20} strokeWidth={2.25} />
          </button>
        )}

        {showArchive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit("left");
            }}
            className="swipe-pill-btn swipe-pill-archive absolute top-1/2 z-[2]"
            style={{
              left: `calc(100% + ${GAP}px)`,
              ...pillStyle(archiveOpacity),
            }}
            aria-label={t("기억함", "Saved")}
          >
            <Archive size={20} strokeWidth={2.25} />
          </button>
        )}

        {children}
      </div>
    </div>
  );
}
