import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { animate } from "framer-motion";
import { useT } from "@/lib/i18n";
import { tickDebounced, confirm as confirmHaptic } from "@/lib/haptics";
import {
  rubberBand,
  swipeRotation,
  swipeOpacity,
  dragProgress,
  cardScale,
  cardShadowBlur,
  shouldSwipeCommit,
} from "@/lib/swipePhysics";
import { SPRING_SNAP_BACK, SPRING_CARD_EXIT } from "@/lib/motion";
import { Check, X } from "lucide-react";

type Direction = "left" | "right";

const THRESHOLD = 95;
const MAX_DRAG = 160;
const LONG_PRESS_MS = 450;
const MOVE_CANCEL = 10;
const SWIPE_CAPTURE = 10;

export function SwipeCard({
  children,
  onSwipe,
  onLongPress,
  disabled,
  className = "",
  mode = "confirm",
  bare = false,
  softLabels = false,
  leftLabel,
  rightLabel,
  leftConfirmLabel,
  rightConfirmLabel,
}: {
  children: ReactNode;
  onSwipe: (dir: Direction) => void;
  onLongPress?: () => void;
  disabled?: boolean;
  className?: string;
  mode?: "instant" | "confirm";
  bare?: boolean;
  softLabels?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  leftConfirmLabel?: string;
  rightConfirmLabel?: string;
}) {
  const t = useT();
  const cardRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [rotate, setRotate] = useState(0);
  const [scale, setScale] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const [shadow, setShadow] = useState(12);
  const [pending, setPending] = useState<Direction | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const lastX = useRef(0);
  const velocityX = useRef(0);
  const dragging = useRef(false);
  const pointerCaptured = useRef(false);
  const longPressFired = useRef(false);
  const longPressTimer = useRef<number | null>(null);
  const lastTone = useRef<"yellow" | "muted" | null>(null);
  const crossed = useRef(false);
  const acting = useRef(false);
  const dxRef = useRef(0);

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const cardW = () => cardRef.current?.offsetWidth ?? 320;

  const applyTransform = (
    x: number,
    opts?: { dragging?: boolean; exiting?: boolean },
  ) => {
    const w = cardW();
    const banded = rubberBand(x, MAX_DRAG);
    const progress = dragProgress(Math.abs(banded), w);
    dxRef.current = banded;
    setDx(banded);
    setRotate(swipeRotation(banded, w));
    setScale(opts?.exiting ? 0.92 : cardScale(progress));
    setOpacity(opts?.exiting ? 0 : swipeOpacity(Math.abs(banded), MAX_DRAG));
    setShadow(cardShadowBlur(progress));
  };

  const springTo = (x: number, onDone?: () => void) => {
    acting.current = true;
    animate(dxRef.current, x, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => applyTransform(v),
      onComplete: () => {
        acting.current = false;
        onDone?.();
      },
    });
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || pending || acting.current) return;
    dragging.current = true;
    pointerCaptured.current = false;
    longPressFired.current = false;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startTime.current = performance.now();
    lastX.current = e.clientX;
    velocityX.current = 0;
    crossed.current = false;
    cancelLongPress();
    if (onLongPress) {
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true;
        cancelLongPress();
        onLongPress();
      }, LONG_PRESS_MS);
    }
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    if (Math.abs(dx) > MOVE_CANCEL || Math.abs(dy) > MOVE_CANCEL) {
      cancelLongPress();
    }
    if (longPressFired.current) return;

    if (!pointerCaptured.current) {
      if (Math.abs(dx) > SWIPE_CAPTURE && Math.abs(dx) > Math.abs(dy)) {
        pointerCaptured.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else {
        return;
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - startTime.current);
    velocityX.current = ((e.clientX - lastX.current) / dt) * 1000;
    lastX.current = e.clientX;
    startTime.current = now;

    const next = dx;
    applyTransform(next, { dragging: true });

    const tone = next > 30 ? "yellow" : next < -30 ? "muted" : null;
    if (tone !== lastTone.current) {
      lastTone.current = tone;
      if (tone) tickDebounced();
    }
    if (!crossed.current && Math.abs(next) >= THRESHOLD) {
      crossed.current = true;
      tickDebounced(120);
    }
  };

  const commitSwipe = (dir: Direction) => {
    confirmHaptic();
    acting.current = true;
    animate(dxRef.current, dir === "right" ? 640 : -640, {
      ...SPRING_CARD_EXIT,
      onUpdate: (v) => applyTransform(v, { exiting: true }),
      onComplete: () => {
        acting.current = false;
        onSwipe(dir);
      },
    });
  };

  const onUp = () => {
    cancelLongPress();
    if (!dragging.current) return;
    dragging.current = false;

    if (longPressFired.current) {
      longPressFired.current = false;
      if (Math.abs(dxRef.current) > 0) springTo(0);
      lastTone.current = null;
      return;
    }

    if (!pointerCaptured.current) {
      lastTone.current = null;
      return;
    }

    const abs = Math.abs(dxRef.current);
    if (
      shouldSwipeCommit(abs, THRESHOLD, velocityX.current) &&
      !pending
    ) {
      const dir: Direction = dxRef.current > 0 ? "right" : "left";
      if (mode === "instant") {
        commitSwipe(dir);
        return;
      }
      setPending(dir);
      springTo(dir === "right" ? 140 : -140);
    } else if (!pending) {
      springTo(0);
    }
    lastTone.current = null;
  };

  const cancel = () => {
    setPending(null);
    springTo(0);
  };

  const finish = () => {
    if (!pending) return;
    commitSwipe(pending);
  };

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const tone = pending ?? (dx > 30 ? "right" : dx < -30 ? "left" : null);
  const rightText = rightLabel ?? t("→ 일정", "→ Schedule");
  const leftText = leftLabel ?? t("← 삭제", "← Delete");
  const labelOpacity = Math.min(1, dragProgress(Math.abs(dx), cardW()) * 1.4);
  const labelClass = softLabels
    ? "pointer-events-none absolute -top-2.5 rounded-full px-3 py-1 text-[12px] font-semibold shadow-card"
    : "pointer-events-none absolute -top-3 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest shadow-float";

  return (
    <div className="relative">
      {tone === "right" && !pending && (
        <div
          className={`${labelClass} right-4 bg-primary text-ink`}
          style={{ opacity: labelOpacity, transform: `scale(${0.9 + labelOpacity * 0.1})` }}
        >
          {rightText}
        </div>
      )}
      {tone === "left" && !pending && (
        <div
          className={`${labelClass} left-4 bg-ink text-white`}
          style={{ opacity: labelOpacity, transform: `scale(${0.9 + labelOpacity * 0.1})` }}
        >
          {leftText}
        </div>
      )}

      <div
        ref={cardRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`relative touch-pan-y select-none will-change-transform ${className}`}
        style={{
          transform: `translateX(${dx}px) rotate(${rotate}deg) scale(${scale})`,
          opacity,
          transition: dragging.current || acting.current ? "none" : undefined,
        }}
      >
        <div
          className={
            bare
              ? "overflow-visible"
              : "thought-card overflow-hidden rounded-[24px]"
          }
          style={
            bare
              ? undefined
              : {
                  boxShadow:
                    tone === "right"
                      ? "var(--shadow-yellow)"
                      : tone === "left"
                        ? "var(--shadow-muted)"
                        : `0 ${shadow}px ${shadow * 1.5}px -${shadow * 0.4}px oklch(0 0 0 / ${0.06 + shadow * 0.004})`,
                  transition: dragging.current ? "none" : "box-shadow 0.2s ease",
                }
          }
        >
          {children}
        </div>
      </div>

      {mode === "confirm" && pending === "right" && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[160px] items-center justify-start pl-3">
          <button
            type="button"
            onClick={finish}
            className="pointer-events-auto touch-target gap-1.5 rounded-full bg-primary px-4 text-[13px] font-bold text-ink shadow-float animate-pop"
          >
            <Check size={16} strokeWidth={3} />
            {rightConfirmLabel ?? t("일정", "Schedule")}
          </button>
          <button
            type="button"
            onClick={cancel}
            aria-label={t("취소", "Cancel")}
            className="pointer-events-auto touch-target ml-2 rounded-full bg-white/90 text-ink-soft shadow-card"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {mode === "confirm" && pending === "left" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[180px] items-center justify-end pr-3">
          <button
            type="button"
            onClick={cancel}
            aria-label={t("취소", "Cancel")}
            className="pointer-events-auto touch-target mr-2 rounded-full bg-white/90 text-ink-soft shadow-card"
          >
            <X size={16} />
          </button>
          <button
            type="button"
            onClick={finish}
            className="pointer-events-auto touch-target gap-1.5 rounded-full bg-ink px-4 text-[13px] font-bold text-white shadow-float animate-pop"
          >
            <Check size={16} strokeWidth={3} />
            {leftConfirmLabel ?? t("삭제", "Delete")}
          </button>
        </div>
      )}
    </div>
  );
}
