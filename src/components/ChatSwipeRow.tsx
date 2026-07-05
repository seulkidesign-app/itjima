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
import { SPRING_ROW, SPRING_SNAP_BACK } from "@/lib/motion";

type Side = "left" | "right";

const BTN = 48;
const GAP = 10;
const SLOT = BTN + GAP;
const OPEN_AT = 28;
const MAX_DRAG = 96;

function rubber(value: number, limit: number) {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  return Math.sign(value) * (limit + (abs - limit) * 0.18);
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
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  offsetRef.current = offsetX;

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
      offsetRef.current = 0;
      setOffsetX(0);
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
    offsetRef.current = x;
    setOffsetX(x);
    if (Math.abs(x) > 14) tickDebounced();
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
    if (longFired.current) return;

    const x = offsetRef.current;

    if (openSide) {
      if (Math.abs(x) < OPEN_AT * 0.35) dismiss();
      else springX(0);
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
    openSide === "right" ? 1 : clamp01(offsetX / SLOT);
  const archiveOpacity = openSide === "left" ? 1 : clamp01(-offsetX / SLOT);
  const showSchedule = openSide === "right" || offsetX > 2;
  const showArchive = openSide === "left" || offsetX < -2;
  const dragX = openSide ? 0 : offsetX;

  return (
    <div
      ref={rowRef}
      className="swipe-row relative w-full py-0.5"
      style={{ touchAction: "pan-y" }}
    >
      <div className="flex w-full items-center justify-end">
        <div
          className="flex shrink-0 items-center justify-end overflow-hidden transition-[width,margin] duration-150 ease-out"
          style={{
            width: showSchedule ? SLOT : 0,
            marginRight: showSchedule ? 0 : 0,
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit("right");
            }}
            className="swipe-pill-btn swipe-pill-schedule"
            style={{
              opacity: scheduleOpacity,
              pointerEvents: scheduleOpacity > 0.55 ? "auto" : "none",
              transform: `scale(${0.88 + scheduleOpacity * 0.12})`,
            }}
            aria-label={t("그때", "When")}
          >
            <Calendar size={20} strokeWidth={2.25} />
          </button>
        </div>

        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative z-[1] shrink-0 touch-none select-none will-change-transform"
          style={{
            transform: `translate3d(${dragX}px, 0, 0)`,
          }}
        >
          {children}
        </div>

        <div
          className="flex shrink-0 items-center overflow-hidden transition-[width,margin] duration-150 ease-out"
          style={{ width: showArchive ? SLOT : 0 }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              commit("left");
            }}
            className="swipe-pill-btn swipe-pill-archive"
            style={{
              opacity: archiveOpacity,
              pointerEvents: archiveOpacity > 0.55 ? "auto" : "none",
              transform: `scale(${0.88 + archiveOpacity * 0.12})`,
            }}
            aria-label={t("기억함", "Saved")}
          >
            <Archive size={20} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
