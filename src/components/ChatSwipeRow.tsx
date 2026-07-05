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
import { tickDebounced, confirm as confirmHaptic, tap as tapHaptic } from "@/lib/haptics";
import { SPRING_ROW, SPRING_SNAP_BACK } from "@/lib/motion";

type Side = "left" | "right";

const GAP = 16;
const BTN = 48;
const OPEN_SLOT = BTN + GAP;
const OPEN_AT = 28;
const MAX_DRAG = 140;

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
  const [offsetX, setOffsetX] = useState(0);
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const [acting, setActing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  offsetRef.current = offsetX;

  const openOffset = (side: Side) => (side === "right" ? OPEN_SLOT : -OPEN_SLOT);

  const springX = useCallback(
    (to: number, onDone?: () => void) => {
      animate(offsetRef.current, to, {
        ...(openSide ? SPRING_ROW : SPRING_SNAP_BACK),
        onUpdate: (v) => {
          offsetRef.current = v;
          setOffsetX(v);
        },
        onComplete: onDone,
      });
    },
    [openSide],
  );

  const dismiss = useCallback(() => {
    setOpenSide(null);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springX(0);
  }, [rowId, onOpenRowChange, springX]);

  const snapOpen = useCallback(
    (side: Side) => {
      setOpenSide(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      const target = openOffset(side);
      offsetRef.current = target;
      setOffsetX(target);
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
      offsetRef.current = 0;
      setOffsetX(0);
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
    setDragging(true);
    longFired.current = false;
    moved.current = false;
    startX.current = e.clientX - offsetRef.current;
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

    if (Math.abs(x - offsetRef.current) > 6) {
      moved.current = true;
      clearLongPress();
      e.preventDefault();
    }

    if (openSide === "right") x = Math.max(openOffset("right"), x);
    if (openSide === "left") x = Math.min(openOffset("left"), x);

    if (!openSide) {
      x = rubber(x, MAX_DRAG);
    }

    offsetRef.current = x;
    setOffsetX(x);
    if (Math.abs(x) > 12) tickDebounced(48);
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    clearLongPress();
    if (longFired.current) return;

    const x = offsetRef.current;

    if (openSide) {
      const target = openOffset(openSide);
      if (Math.abs(x) < OPEN_AT * 0.4) dismiss();
      else springX(target);
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
    springX(0);
  };

  const scheduleOpacity =
    openSide === "right" ? 1 : clamp01(offsetX / OPEN_AT);
  const archiveOpacity =
    openSide === "left" ? 1 : clamp01(-offsetX / OPEN_AT);
  const showSchedule =
    openSide === "right" || (offsetX > 2 && openSide !== "left");
  const showArchive =
    openSide === "left" || (offsetX < -2 && openSide !== "right");

  return (
    <div
      ref={rowRef}
      className="swipe-row relative flex w-full justify-end py-0.5"
      style={{ touchAction: dragging ? "none" : "pan-y" }}
    >
      <div className="relative w-fit max-w-[min(340px,calc(100vw-4.5rem))]">
        {showSchedule && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tapHaptic();
              commit("right");
            }}
            className="swipe-pill-btn swipe-pill-schedule absolute top-1/2 z-[1] -translate-y-1/2"
            style={{
              left: GAP,
              opacity: scheduleOpacity,
              pointerEvents: scheduleOpacity > 0.5 ? "auto" : "none",
              transform: `translateY(-50%) scale(${0.88 + scheduleOpacity * 0.12})`,
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
              tapHaptic();
              commit("left");
            }}
            className="swipe-pill-btn swipe-pill-archive absolute top-1/2 z-[1] -translate-y-1/2"
            style={{
              right: GAP,
              opacity: archiveOpacity,
              pointerEvents: archiveOpacity > 0.5 ? "auto" : "none",
              transform: `translateY(-50%) scale(${0.88 + archiveOpacity * 0.12})`,
            }}
            aria-label={t("기억함", "Saved")}
          >
            <Archive size={20} strokeWidth={2.25} />
          </button>
        )}

        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative z-[2] w-fit touch-none select-none will-change-transform"
          style={{
            transform: `translate3d(${offsetX}px, 0, 0)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
