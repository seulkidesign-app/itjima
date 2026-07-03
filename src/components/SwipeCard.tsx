import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useT } from "@/lib/i18n";
import { tick, confirm as confirmHaptic } from "@/lib/haptics";
import { Check, X } from "lucide-react";

type Direction = "left" | "right";

const THRESHOLD = 95;

export function SwipeCard({
  children,
  onSwipe,
  disabled,
  className = "",
  mode = "confirm",
  bare = false,
  leftLabel,
  rightLabel,
  leftConfirmLabel,
  rightConfirmLabel,
}: {
  children: ReactNode;
  onSwipe: (dir: Direction) => void;
  disabled?: boolean;
  className?: string;
  mode?: "instant" | "confirm";
  bare?: boolean;
  leftLabel?: string;
  rightLabel?: string;
  leftConfirmLabel?: string;
  rightConfirmLabel?: string;
}) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const [pending, setPending] = useState<Direction | null>(null);
  const [released, setReleased] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);
  const lastTone = useRef<"yellow" | "muted" | null>(null);
  const crossed = useRef(false);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || pending) return;
    dragging.current = true;
    startX.current = e.clientX;
    crossed.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const next = e.clientX - startX.current;
    setDx(next);
    const tone = next > 30 ? "yellow" : next < -30 ? "muted" : null;
    if (tone !== lastTone.current) {
      lastTone.current = tone;
      if (tone) tick();
    }
    if (!crossed.current && Math.abs(next) >= THRESHOLD) {
      crossed.current = true;
      tick();
    }
  };
  const commitSwipe = (dir: Direction) => {
    confirmHaptic();
    setReleased(true);
    setDx(dir === "right" ? 600 : -600);
    setTimeout(() => onSwipe(dir), 220);
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (Math.abs(dx) >= THRESHOLD) {
      const dir: Direction = dx > 0 ? "right" : "left";
      if (mode === "instant") {
        commitSwipe(dir);
        return;
      }
      setPending(dir);
      setDx(dir === "right" ? 140 : -140);
    } else {
      setDx(0);
    }
    lastTone.current = null;
  };

  const cancel = () => {
    setPending(null);
    setDx(0);
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

  return (
    <div className="relative">
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`relative touch-none select-none ${className}`}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dragging.current
            ? "none"
            : released
              ? "transform 0.22s ease-out"
              : "transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.2)",
        }}
      >
        <div
          className={
            bare
              ? "overflow-visible"
              : "overflow-hidden rounded-[24px] bg-white shadow-card"
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
                        : "var(--shadow-card)",
                  transition: "box-shadow 0.2s ease",
                }
          }
        >
          {children}
        </div>
        {tone === "right" && !pending && (
          <div className="pointer-events-none absolute -top-3 right-4 animate-swipe-label rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-ink">
            {rightText}
          </div>
        )}
        {tone === "left" && !pending && (
          <div className="pointer-events-none absolute -top-3 left-4 animate-swipe-label rounded-full bg-ink px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
            {leftText}
          </div>
        )}
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
