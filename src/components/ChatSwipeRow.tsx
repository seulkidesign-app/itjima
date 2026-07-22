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

/** Shared with `.swipe-pill-btn` width in styles.css */
const BTN = 48;
const GAP_BUBBLE = 10;
const BTN_GAP = 8;
/** 10 + 48 + 8 + 48 — full tray width behind the bubble */
export const CHAT_SWIPE_OPEN_DISTANCE = GAP_BUBBLE + BTN + BTN_GAP + BTN;
const OPEN_AT = Math.round(CHAT_SWIPE_OPEN_DISTANCE * 0.4);

function rubber(value: number, limit: number) {
  const abs = Math.abs(value);
  if (abs <= limit) return value;
  return Math.sign(value) * (limit + (abs - limit) * 0.15);
}

function clampOffset(value: number, isOpen: boolean) {
  if (value > 0) return 0;
  const banded = rubber(value, CHAT_SWIPE_OPEN_DISTANCE);
  const clamped = Math.max(-CHAT_SWIPE_OPEN_DISTANCE, Math.min(0, banded));
  if (isOpen) return clamped;
  return clamped;
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
  const [isOpen, setIsOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const offsetRef = useRef(0);
  const startX = useRef(0);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  offsetRef.current = offsetX;

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
    setIsOpen(false);
    if (rowId && onOpenRowChange) onOpenRowChange(null);
    springX(0);
  }, [rowId, onOpenRowChange, springX]);

  const snapOpen = useCallback(() => {
    setIsOpen(true);
    if (rowId && onOpenRowChange) onOpenRowChange(rowId);
    springX(-CHAT_SWIPE_OPEN_DISTANCE);
    tickDebounced();
  }, [rowId, onOpenRowChange, springX]);

  const commit = useCallback(
    (action: "schedule" | "archive") => {
      if (acting) return;
      setActing(true);
      confirmHaptic();
      if (action === "schedule") onSwipeRight();
      else onSwipeLeft();
      setIsOpen(false);
      setActing(false);
      offsetRef.current = 0;
      setOffsetX(0);
      if (rowId && onOpenRowChange) onOpenRowChange(null);
    },
    [acting, onSwipeLeft, onSwipeRight, rowId, onOpenRowChange],
  );

  useEffect(() => {
    if (!rowId || openRowId === undefined) return;
    if (openRowId !== rowId && isOpen) dismiss();
  }, [openRowId, rowId, isOpen, dismiss]);

  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, dismiss]);

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

    x = clampOffset(x, isOpen);

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

    if (isOpen) {
      if (x > -OPEN_AT * 0.45) dismiss();
      else springX(-CHAT_SWIPE_OPEN_DISTANCE);
      return;
    }

    if (x <= -OPEN_AT) {
      snapOpen();
      return;
    }
    if (!moved.current && onTap) onTap();
    springX(0);
  };

  const trayOpacity = isOpen ? 1 : clamp01(-offsetX / OPEN_AT);
  const showTray = isOpen || offsetX < -2;

  return (
    <div
      ref={rowRef}
      className="swipe-row relative w-full min-w-0 py-0.5"
      style={{ touchAction: dragging ? "none" : "pan-y" }}
    >
      <div className="relative ml-auto w-fit max-w-full">
        {showTray && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[1] flex items-center"
            style={{ width: CHAT_SWIPE_OPEN_DISTANCE }}
          >
            <div className="flex items-center" style={{ width: CHAT_SWIPE_OPEN_DISTANCE }}>
              <span
                className="block shrink-0"
                style={{ width: GAP_BUBBLE }}
                aria-hidden
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  tapHaptic();
                  commit("schedule");
                }}
                className="swipe-pill-btn swipe-pill-schedule pointer-events-auto shrink-0"
                style={{
                  opacity: trayOpacity,
                  pointerEvents: trayOpacity > 0.5 ? "auto" : "none",
                  transform: `scale(${0.88 + trayOpacity * 0.12})`,
                }}
                aria-label={t("나중에 다시 꺼내기", "Bring back later")}
              >
                <Calendar size={20} strokeWidth={2.25} />
              </button>
              <span
                className="block shrink-0"
                style={{ width: BTN_GAP }}
                aria-hidden
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  tapHaptic();
                  commit("archive");
                }}
                className="swipe-pill-btn swipe-pill-archive pointer-events-auto shrink-0"
                style={{
                  opacity: trayOpacity,
                  pointerEvents: trayOpacity > 0.5 ? "auto" : "none",
                  transform: `scale(${0.88 + trayOpacity * 0.12})`,
                }}
                aria-label={t("보관함에 넣기", "Move to archive")}
              >
                <Archive size={20} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        )}

        <div
          data-chat-swipe-handle
          data-offset-x={Math.round(offsetX * 100) / 100}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="relative z-[2] min-w-0 shrink-0 touch-none select-none will-change-transform"
          style={{
            transform:
              offsetX === 0 ? undefined : `translate3d(${offsetX}px, 0, 0)`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
