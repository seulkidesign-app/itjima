import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Archive, Calendar } from "lucide-react";
import { animate } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import {
  SWIPE_COMMIT,
  SWIPE_PREVIEW,
  MAX_ROTATE,
  dragProgress,
  indicatorScale,
  cardScale,
  cardShadowBlur,
  SPRING_SNAP_BACK,
} from "@/lib/motion";

type Side = "left" | "right";

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
  const cardRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [pending, setPending] = useState<Side | null>(null);
  const [flying, setFlying] = useState(false);
  const draggingRef = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
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

  const springBack = (to = 0) => {
    animate(dx, to, {
      ...SPRING_SNAP_BACK,
      onUpdate: setDx,
    });
  };

  const commit = (side: Side) => {
    confirmHaptic();
    setFlying(true);
    setPending(null);
    const w = width();
    const target = side === "right" ? w * 1.5 : -w * 1.5;
    animate(dx, target, {
      type: "spring",
      stiffness: 280,
      damping: 26,
      onUpdate: setDx,
      onComplete: () => {
        if (side === "right") onSwipeRight();
        else onSwipeLeft();
        setDx(0);
        setFlying(false);
      },
    });
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || flying || pending) return;
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
          onLongPress();
        }
      }, 480);
    }
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || flying) return;
    const next = e.clientX - startX.current;
    if (Math.abs(next) > 8 || Math.abs(e.clientY - startY.current) > 8) {
      moved.current = true;
      clearLongPress();
    }
    setDx(next);
    if (Math.abs(next) > 20) tick();
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    clearLongPress();
    if (longFired.current) {
      springBack(0);
      return;
    }

    const w = width();
    const abs = Math.abs(dx);
    if (abs >= w * SWIPE_COMMIT) {
      commit(dx > 0 ? "right" : "left");
      return;
    }
    if (abs >= w * SWIPE_PREVIEW) {
      const side: Side = dx > 0 ? "right" : "left";
      setPending(side);
      springBack(side === "right" ? ACTION_SNAP : -ACTION_SNAP);
      return;
    }
    springBack(0);
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPending(null);
        springBack(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const w = width();
  const rightProgress = dx > 0 ? dragProgress(dx, w) : pending === "right" ? 1 : 0;
  const leftProgress = dx < 0 ? dragProgress(-dx, w) : pending === "left" ? 1 : 0;
  const progress = Math.max(rightProgress, leftProgress);
  const rotate = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx * (MAX_ROTATE / (w * 0.45))));
  const scale = draggingRef.current || flying ? cardScale(progress) : 1;
  const shadow = cardShadowBlur(progress);

  const renderIndicator = (side: Side, prog: number) => {
    const scaleInd = indicatorScale(prog);
    const isRight = side === "right";
    return (
      <div
        className={`absolute inset-y-0 flex w-1/2 items-center ${isRight ? "left-0 justify-start pl-5" : "right-0 justify-end pr-5"}`}
        style={{ opacity: scaleInd }}
      >
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-2 backdrop-blur-md ${isRight ? "bg-primary/80" : "bg-blue-500/75"}`}
          style={{ transform: `scale(${scaleInd})` }}
        >
          {isRight ? (
            <Calendar size={16} className="text-ink" />
          ) : (
            <Archive size={16} className="text-white" />
          )}
          <span className={`text-[12px] font-extrabold ${isRight ? "text-ink" : "text-white"}`}>
            {isRight ? t("일정", "Schedule") : t("보관", "Archive")}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div ref={rowRef} className="relative flex justify-end">
      <div className="absolute inset-y-0 left-0 right-0 overflow-hidden rounded-[22px]">
        {renderIndicator("right", rightProgress)}
        {renderIndicator("left", leftProgress)}
      </div>

      {pending === "right" && (
        <button
          type="button"
          onClick={() => commit("right")}
          className="touch-press absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-primary px-3 py-2 text-[12px] font-bold text-ink shadow-card"
        >
          {t("일정", "Schedule")}
        </button>
      )}
      {pending === "left" && (
        <button
          type="button"
          onClick={() => commit("left")}
          className="touch-press absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-blue-500 px-3 py-2 text-[12px] font-bold text-white shadow-card"
        >
          {t("보관", "Archive")}
        </button>
      )}

      <div
        ref={cardRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="relative z-[1] w-full touch-none select-none"
        style={{
          transform: `translateX(${dx}px) rotate(${rotate}deg) scale(${scale})`,
          boxShadow: progress > 0 ? `0 ${shadow}px ${shadow * 1.2}px rgba(0,0,0,${0.06 + progress * 0.08})` : undefined,
          transition: draggingRef.current || flying ? "none" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
