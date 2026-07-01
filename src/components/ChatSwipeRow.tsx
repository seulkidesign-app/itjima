import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animate } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { SPRING_SNAP_BACK } from "@/lib/motion";

type Side = "left" | "right";

const REVEAL = 80;
const OPEN_AT = 32;
const MAX_DRAG = 110;
const MAX_ROTATE = 2.5;

export function ChatSwipeRow({
  children,
  rowId,
  openRowId,
  onOpenRowChange,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  disabled,
}: {
  children: ReactNode;
  rowId?: string;
  openRowId?: string | null;
  onOpenRowChange?: (id: string | null) => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [pending, setPending] = useState<Side | null>(null);
  const [acting, setActing] = useState(false);
  const draggingRef = useRef(false);
  const dxRef = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  dxRef.current = dx;

  const springTo = useCallback((to: number, onDone?: () => void) => {
    animate(dxRef.current, to, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        dxRef.current = v;
        setDx(v);
      },
      onComplete: onDone,
    });
  }, []);

  const dismiss = useCallback(() => {
    setPending(null);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springTo(0);
  }, [rowId, onOpenRowChange, springTo]);

  const openSide = useCallback(
    (side: Side) => {
      setPending(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      springTo(side === "right" ? REVEAL : -REVEAL);
      tick();
    },
    [rowId, onOpenRowChange, springTo],
  );

  const commit = useCallback(
    (side: Side) => {
      if (acting) return;
      setActing(true);
      confirmHaptic();
      const from = dxRef.current;
      const target = side === "right" ? from + 48 : from - 48;
      animate(from, target, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          dxRef.current = v;
          setDx(v);
        },
        onComplete: () => {
          if (side === "right") onSwipeRight();
          else onSwipeLeft();
          setPending(null);
          setActing(false);
          dxRef.current = 0;
          setDx(0);
          if (rowId && onOpenRowChange) onOpenRowChange(null);
        },
      });
    },
    [acting, onSwipeLeft, onSwipeRight, rowId, onOpenRowChange],
  );

  useEffect(() => {
    if (!rowId || openRowId === undefined) return;
    if (openRowId !== rowId && pending) dismiss();
  }, [openRowId, rowId, pending, dismiss]);

  useEffect(() => {
    if (!pending) return;
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
  }, [pending, dismiss]);

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
    startY.current = e.clientY;
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
    let next = e.clientX - startX.current;
    if (Math.abs(next) > 6 || Math.abs(e.clientY - startY.current) > 6) {
      moved.current = true;
      clearLongPress();
    }
    if (pending === "right" && next < 0) next = 0;
    if (pending === "left" && next > 0) next = 0;
    next = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, next));
    dxRef.current = next;
    setDx(next);
    if (Math.abs(next) > 14) tick();
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
    if (longFired.current) return;

    const current = dxRef.current;
    const abs = Math.abs(current);

    if (pending) {
      if (abs < OPEN_AT * 0.6) dismiss();
      else openSide(pending);
      return;
    }

    if (abs >= OPEN_AT) {
      openSide(current > 0 ? "right" : "left");
      return;
    }
    springTo(0);
  };

  const side: Side | null =
    pending ??
    (dx > OPEN_AT * 0.4 ? "right" : dx < -OPEN_AT * 0.4 ? "left" : null);

  const revealProgress = pending ? 1 : Math.min(1, Math.abs(dx) / REVEAL);

  const rotate =
    side === "right"
      ? Math.min(MAX_ROTATE, dx * 0.04)
      : side === "left"
        ? Math.max(-MAX_ROTATE, dx * 0.04)
        : 0;
  const scale = draggingRef.current ? 1 + revealProgress * 0.012 : 1;

  const scheduleVisible = side === "right";
  const archiveVisible = side === "left";

  return (
    <div ref={rowRef} className="relative flex justify-end">
      {scheduleVisible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("right");
          }}
          className="touch-press absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-primary px-4 py-2.5 text-[13px] font-extrabold text-ink shadow-card transition-[transform,opacity] duration-150"
          style={{
            opacity: revealProgress,
            transform: `translateY(-50%) scale(${0.88 + revealProgress * 0.12})`,
          }}
        >
          {t("일정", "Schedule")}
        </button>
      )}

      {archiveVisible && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("left");
          }}
          className="touch-press absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-blue-500 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-card transition-[transform,opacity] duration-150"
          style={{
            opacity: revealProgress,
            transform: `translateY(-50%) scale(${0.88 + revealProgress * 0.12})`,
          }}
        >
          {t("보관", "Archive")}
        </button>
      )}

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative z-[1] w-full touch-none select-none"
        style={{
          transform: `translateX(${dx}px) rotate(${rotate}deg) scale(${scale})`,
          transition: draggingRef.current || acting ? "none" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
