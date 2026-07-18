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

/** Shared with `.swipe-pill-btn` width in styles.css */
const BTN = 48;
const GAP = 10;
const OPEN_SLOT = BTN + GAP;
const OPEN_AT = 28;

function rubber(value: number, limit: number) {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  return Math.sign(value) * (limit + (abs - limit) * 0.15);
}

function clampOffset(value: number, openSide: Side | null) {
  const banded = rubber(value, OPEN_SLOT);
  if (openSide === "right") return Math.max(0, Math.min(banded, OPEN_SLOT));
  if (openSide === "left") return Math.min(0, Math.max(banded, -OPEN_SLOT));
  return Math.max(-OPEN_SLOT, Math.min(banded, OPEN_SLOT));
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function revealWidths(offsetX: number) {
  return {
    leftReveal: Math.max(0, Math.min(OPEN_SLOT, offsetX)),
    rightReveal: Math.max(0, Math.min(OPEN_SLOT, -offsetX)),
    bubbleTranslate: Math.min(0, offsetX),
  };
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

  const springX = useCallback((to: number, onDone?: () => void) => {
    animate(offsetRef.current, to, {
      ...(to === 0 ? SPRING_SNAP_BACK : SPRING_ROW),
      onUpdate: (v) => {
        offsetRef.current = v;
        setOffsetX(v);
      },
      onComplete: () => {
        offsetRef.current = to;
        setOffsetX(to);
        onDone?.();
      },
    });
  }, []);

  const dismiss = useCallback(() => {
    setOpenSide(null);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springX(0);
  }, [rowId, onOpenRowChange, springX]);

  const snapOpen = useCallback(
    (side: Side) => {
      setOpenSide(side);
      if (rowId && onOpenRowChange) onOpenRowChange(rowId);
      springX(openOffset(side));
      tickDebounced();
    },
    [rowId, onOpenRowChange, springX],
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

    x = clampOffset(x, openSide);

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
      const closedDistance = Math.abs(x);
      const openDistance = Math.abs(x - target);
      if (closedDistance < OPEN_AT * 0.4 || openDistance > Math.abs(target) * 0.55) {
        dismiss();
      } else {
        springX(target);
      }
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

  const { leftReveal, rightReveal, bubbleTranslate } = revealWidths(offsetX);

  const scheduleOpacity =
    openSide === "right" ? 1 : clamp01(leftReveal / OPEN_AT);
  const archiveOpacity =
    openSide === "left" ? 1 : clamp01(rightReveal / OPEN_AT);
  const showSchedule = openSide === "right" || leftReveal > 2;
  const showArchive = openSide === "left" || rightReveal > 2;

  return (
    <div
      ref={rowRef}
      className="swipe-row relative w-full min-w-0 py-0.5"
      style={{ touchAction: dragging ? "none" : "pan-y" }}
    >
      {showArchive && (
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex items-center overflow-hidden"
          style={{ width: rightReveal }}
        >
          <div
            className="flex items-center justify-end"
            style={{ width: OPEN_SLOT }}
          >
            <span className="block shrink-0" style={{ width: GAP }} aria-hidden />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                tapHaptic();
                commit("left");
              }}
              className="swipe-pill-btn swipe-pill-archive pointer-events-auto shrink-0"
              style={{
                opacity: archiveOpacity,
                pointerEvents: archiveOpacity > 0.5 ? "auto" : "none",
                transform: `scale(${0.88 + archiveOpacity * 0.12})`,
              }}
              aria-label={t("생각 지도에 남기기", "Save to thought map")}
            >
              <Archive size={20} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      )}

      <div className="relative ml-auto flex min-w-0 max-w-full items-stretch justify-end">
        {showSchedule && (
          <div
            className="flex shrink-0 items-center overflow-hidden"
            style={{ width: leftReveal }}
          >
            <div className="flex items-center" style={{ width: OPEN_SLOT }}>
              <span className="block shrink-0" style={{ width: GAP }} aria-hidden />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  tapHaptic();
                  commit("right");
                }}
                className="swipe-pill-btn swipe-pill-schedule pointer-events-auto shrink-0"
                style={{
                  opacity: scheduleOpacity,
                  pointerEvents: scheduleOpacity > 0.5 ? "auto" : "none",
                  transform: `scale(${0.88 + scheduleOpacity * 0.12})`,
                }}
                aria-label={t("할 일로 보내기", "Send to tasks")}
              >
                <Calendar size={20} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )}

        <div
          data-chat-swipe-handle
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative z-[2] min-w-0 shrink-0 touch-none select-none will-change-transform"
          style={{
            transform:
              bubbleTranslate === 0
                ? undefined
                : `translate3d(${bubbleTranslate}px, 0, 0)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
