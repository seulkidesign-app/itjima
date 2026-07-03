import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Trash2 } from "lucide-react";
import { animate } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { SPRING_SNAP_BACK } from "@/lib/motion";

type Side = "left" | "right" | "down";

const REVEAL_X = 80;
const REVEAL_Y = 72;
const OPEN_AT = 32;
const MAX_DRAG_X = 110;
const MAX_DRAG_Y = 96;
const MAX_ROTATE = 2.5;

export function ChatSwipeRow({
  children,
  rowId,
  openRowId,
  onOpenRowChange,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
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
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onTap?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [pending, setPending] = useState<Side | null>(null);
  const [acting, setActing] = useState(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const start = useRef({ x: 0, y: 0 });
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  offsetRef.current = offset;

  const springTo = useCallback(
    (to: { x: number; y: number }, onDone?: () => void) => {
      const from = offsetRef.current;
      let done = 0;
      const check = () => {
        done += 1;
        if (done >= 2) onDone?.();
      };
      animate(from.x, to.x, {
        ...SPRING_SNAP_BACK,
        onUpdate: (v) => {
          offsetRef.current = { ...offsetRef.current, x: v };
          setOffset((o) => ({ ...o, x: v }));
        },
        onComplete: check,
      });
      animate(from.y, to.y, {
        ...SPRING_SNAP_BACK,
        onUpdate: (v) => {
          offsetRef.current = { ...offsetRef.current, y: v };
          setOffset((o) => ({ ...o, y: v }));
        },
        onComplete: check,
      });
    },
    [],
  );

  const dismiss = useCallback(() => {
    setPending(null);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springTo({ x: 0, y: 0 });
  }, [rowId, onOpenRowChange, springTo]);

  const openSide = useCallback(
    (side: Side) => {
      setPending(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      const target =
        side === "right"
          ? { x: REVEAL_X, y: 0 }
          : side === "left"
            ? { x: -REVEAL_X, y: 0 }
            : { x: 0, y: REVEAL_Y };
      springTo(target);
      tick();
    },
    [rowId, onOpenRowChange, springTo],
  );

  const commit = useCallback(
    (side: Side) => {
      if (acting) return;
      setActing(true);
      confirmHaptic();
      const from = offsetRef.current;
      const target =
        side === "right"
          ? { x: from.x + 48, y: from.y }
          : side === "left"
            ? { x: from.x - 48, y: from.y }
            : { x: from.x, y: from.y + 48 };
      animate(from.x, target.x, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          offsetRef.current = { ...offsetRef.current, x: v };
          setOffset((o) => ({ ...o, x: v }));
        },
      });
      animate(from.y, target.y, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          offsetRef.current = { ...offsetRef.current, y: v };
          setOffset((o) => ({ ...o, y: v }));
        },
        onComplete: () => {
          if (side === "right") onSwipeRight();
          else if (side === "left") onSwipeLeft();
          else onSwipeDown?.();
          setPending(null);
          setActing(false);
          offsetRef.current = { x: 0, y: 0 };
          setOffset({ x: 0, y: 0 });
          if (rowId && onOpenRowChange) onOpenRowChange(null);
        },
      });
    },
    [acting, onSwipeDown, onSwipeLeft, onSwipeRight, rowId, onOpenRowChange],
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
    start.current = { x: e.clientX, y: e.clientY };
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
    let x = e.clientX - start.current.x;
    let y = e.clientY - start.current.y;
    if (Math.abs(x) > 6 || Math.abs(y) > 6) {
      moved.current = true;
      clearLongPress();
    }
    if (pending === "right" && x < 0) x = 0;
    if (pending === "left" && x > 0) x = 0;
    if (pending === "down" && y < 0) y = 0;
    if (!onSwipeDown && y > 0) y *= 0.25;
    x = Math.max(-MAX_DRAG_X, Math.min(MAX_DRAG_X, x));
    y = Math.max(0, Math.min(MAX_DRAG_Y, y));
    offsetRef.current = { x, y };
    setOffset({ x, y });
    if (Math.abs(x) > 14 || y > 14) tick();
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
    if (longFired.current) return;

    const { x, y } = offsetRef.current;
    const absX = Math.abs(x);
    const absY = y;

    if (pending) {
      const open =
        pending === "down" ? absY >= OPEN_AT * 0.6 : absX >= OPEN_AT * 0.6;
      if (!open) dismiss();
      else openSide(pending);
      return;
    }

    if (onSwipeDown && absY > absX && absY >= OPEN_AT) {
      openSide("down");
      return;
    }
    if (absX >= OPEN_AT) {
      openSide(x > 0 ? "right" : "left");
      return;
    }
    if (!moved.current && onTap) onTap();
    springTo({ x: 0, y: 0 });
  };

  const side: Side | null =
    pending ??
    (offset.y > OPEN_AT * 0.45 && onSwipeDown
      ? "down"
      : offset.x > OPEN_AT * 0.4
        ? "right"
        : offset.x < -OPEN_AT * 0.4
          ? "left"
          : null);

  const revealProgress = pending
    ? 1
    : side === "down"
      ? Math.min(1, offset.y / REVEAL_Y)
      : Math.min(1, Math.abs(offset.x) / REVEAL_X);

  const rotate =
    side === "right"
      ? Math.min(MAX_ROTATE, offset.x * 0.04)
      : side === "left"
        ? Math.max(-MAX_ROTATE, offset.x * 0.04)
        : 0;
  const scale = draggingRef.current ? 1 + revealProgress * 0.012 : 1;

  return (
    <div ref={rowRef} className="relative flex justify-end">
      {side === "right" && (
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

      {side === "left" && (
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

      {side === "down" && onSwipeDown && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("down");
          }}
          className="touch-press absolute bottom-0 left-1/2 z-10 flex -translate-x-1/2 translate-y-full items-center gap-1.5 rounded-full bg-red-500 px-4 py-2.5 text-[13px] font-extrabold text-white shadow-card transition-[transform,opacity] duration-150"
          style={{
            opacity: revealProgress,
            transform: `translate(-50%, 100%) scale(${0.88 + revealProgress * 0.12})`,
          }}
        >
          <Trash2 size={14} strokeWidth={2.4} />
          {t("삭제", "Delete")}
        </button>
      )}

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative z-[1] w-full touch-none select-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${scale})`,
          transition: draggingRef.current || acting ? "none" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
