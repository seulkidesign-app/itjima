import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";

type Side = "left" | "right";

const WIDTH_COMMIT = 0.35;
const WIDTH_PARTIAL = 0.12;
const ACTION_SNAP = 76;

export function ChatSwipeRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  disabled,
}: {
  children: ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  const rowRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [pending, setPending] = useState<Side | null>(null);
  const [flying, setFlying] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const longTimer = useRef<number | null>(null);
  const longFired = useRef(false);
  const moved = useRef(false);

  const width = () => rowRef.current?.offsetWidth ?? 320;

  const clearLongPress = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current);
      longTimer.current = null;
    }
  };

  const commit = (side: Side) => {
    confirmHaptic();
    setFlying(true);
    setPending(null);
    const w = width();
    setDx(side === "right" ? w * 1.4 : -w * 1.4);
    window.setTimeout(() => {
      if (side === "right") onSwipeRight();
      else onSwipeLeft();
      setDx(0);
      setFlying(false);
    }, 240);
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || flying || pending) return;
    dragging.current = true;
    longFired.current = false;
    moved.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    clearLongPress();
    if (onLongPress) {
      longTimer.current = window.setTimeout(() => {
        if (dragging.current && !moved.current) {
          longFired.current = true;
          onLongPress();
        }
      }, 480);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current || flying) return;
    const next = e.clientX - startX.current;
    if (Math.abs(next) > 8 || Math.abs(e.clientY - startY.current) > 8) {
      moved.current = true;
      clearLongPress();
    }
    setDx(next);
    if (Math.abs(next) > 24) tick();
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    clearLongPress();
    if (longFired.current) {
      setDx(0);
      return;
    }

    const w = width();
    const abs = Math.abs(dx);
    if (abs >= w * WIDTH_COMMIT) {
      commit(dx > 0 ? "right" : "left");
      return;
    }
    if (abs >= w * WIDTH_PARTIAL) {
      const side: Side = dx > 0 ? "right" : "left";
      setPending(side);
      setDx(side === "right" ? ACTION_SNAP : -ACTION_SNAP);
      return;
    }
    setDx(0);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPending(null);
        setDx(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const w = width();
  const scheduleOpacity = dx > 0 ? Math.min(1, dx / (w * WIDTH_COMMIT)) : pending === "right" ? 1 : 0;
  const archiveOpacity = dx < 0 ? Math.min(1, -dx / (w * WIDTH_COMMIT)) : pending === "left" ? 1 : 0;

  return (
    <div ref={rowRef} className="relative flex justify-end">
      <div className="absolute inset-y-0 left-0 right-0 flex overflow-hidden rounded-[22px]">
        <div
          className="flex flex-1 items-center justify-start rounded-l-[22px] bg-primary/50 pl-4"
          style={{ opacity: scheduleOpacity }}
        >
          <span className="text-[13px] font-extrabold tracking-wide text-ink">
            {t("일정으로", "To Schedule")}
          </span>
        </div>
        <div
          className="flex flex-1 items-center justify-end rounded-r-[22px] bg-ink/12 pr-4"
          style={{ opacity: archiveOpacity }}
        >
          <span className="text-[13px] font-extrabold tracking-wide text-ink">
            {t("보관으로", "To Archive")}
          </span>
        </div>
      </div>

      {pending === "right" && (
        <button
          type="button"
          onClick={() => commit("right")}
          className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-ink shadow-card active:scale-95"
        >
          {t("일정", "Schedule")}
        </button>
      )}
      {pending === "left" && (
        <button
          type="button"
          onClick={() => commit("left")}
          className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-ink px-3 py-2 text-[12px] font-bold text-white shadow-card active:scale-95"
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
          transform: `translateX(${dx}px)`,
          transition: dragging.current || flying
            ? "none"
            : "transform 0.32s cubic-bezier(0.34, 1.45, 0.64, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
