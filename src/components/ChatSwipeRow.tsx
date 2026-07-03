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

const ACTION_W = 88;
const DELETE_H = 56;
const OPEN_AT = 36;
const MAX_DRAG_X = 120;

function rubber(value: number, limit: number) {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  return Math.sign(value) * (limit + (abs - limit) * 0.22);
}

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

  const snapOpen = useCallback(
    (side: Side) => {
      setPending(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      const target =
        side === "right"
          ? { x: ACTION_W, y: 0 }
          : side === "left"
            ? { x: -ACTION_W, y: 0 }
            : { x: 0, y: DELETE_H };
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
      const out =
        side === "right"
          ? { x: ACTION_W + 48, y: 0 }
          : side === "left"
            ? { x: -ACTION_W - 48, y: 0 }
            : { x: 0, y: DELETE_H + 40 };
      springTo(out, () => {
        if (side === "right") onSwipeRight();
        else if (side === "left") onSwipeLeft();
        else onSwipeDown?.();
        setPending(null);
        setActing(false);
        offsetRef.current = { x: 0, y: 0 };
        setOffset({ x: 0, y: 0 });
        if (rowId && onOpenRowChange) onOpenRowChange(null);
      });
    },
    [
      acting,
      onSwipeDown,
      onSwipeLeft,
      onSwipeRight,
      rowId,
      onOpenRowChange,
      springTo,
    ],
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
    if (Math.abs(x) > 4 || Math.abs(y) > 4) {
      moved.current = true;
      clearLongPress();
    }

    if (pending === "right" && x < 0) x = 0;
    if (pending === "left" && x > 0) x = 0;
    if (pending === "down" && y < 0) y = 0;

    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (!pending && absY > absX && absY > 8 && onSwipeDown) {
      y = Math.max(0, rubber(y, DELETE_H));
      x = 0;
    } else {
      y = 0;
      x = rubber(x, MAX_DRAG_X);
    }

    offsetRef.current = { x, y };
    setOffset({ x, y });
    if (absX > 12 || absY > 12) tick();
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
      const hold =
        pending === "down" ? absY >= OPEN_AT * 0.55 : absX >= OPEN_AT * 0.55;
      if (!hold) dismiss();
      return;
    }

    if (onSwipeDown && absY > absX && absY >= OPEN_AT) {
      snapOpen("down");
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
    springTo({ x: 0, y: 0 });
  };

  const showSchedule = offset.x > 2 || pending === "right";
  const showArchive = offset.x < -2 || pending === "left";
  const showDelete = offset.y > 2 || pending === "down";

  return (
    <div
      ref={rowRef}
      className="relative w-full overflow-hidden rounded-[24px]"
    >
      {showSchedule && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("right");
          }}
          className="touch-press absolute bottom-0 left-0 top-0 z-0 flex w-[88px] items-center justify-center bg-primary text-[14px] font-extrabold text-ink"
          aria-label={t("일정", "Schedule")}
        >
          {t("일정", "Schedule")}
        </button>
      )}

      {showArchive && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("left");
          }}
          className="touch-press absolute bottom-0 right-0 top-0 z-0 flex w-[88px] items-center justify-center bg-blue-500 text-[14px] font-extrabold text-white"
          aria-label={t("보관", "Archive")}
        >
          {t("보관", "Archive")}
        </button>
      )}

      {showDelete && onSwipeDown && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            commit("down");
          }}
          className="touch-press absolute bottom-0 left-0 right-0 z-0 flex h-14 items-center justify-center gap-1.5 bg-red-500 text-[14px] font-extrabold text-white"
          aria-label={t("삭제", "Delete")}
        >
          <Trash2 size={16} strokeWidth={2.4} />
          {t("삭제", "Delete")}
        </button>
      )}

      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative z-[1] w-full touch-none select-none bg-white"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px)`,
          transition: draggingRef.current || acting ? "none" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
