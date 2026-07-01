import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
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
}: {
  children: ReactNode;
  onSwipe: (dir: Direction) => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT();
  const [dx, setDx] = useState(0);
  const [pending, setPending] = useState<Direction | null>(null);
  const [released, setReleased] = useState(false);
  const startX = useRef(0);
  const dragging = useRef(false);
  const lastTone = useRef<"yellow" | "red" | null>(null);
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
    // edge haptic ticks
    const tone = next > 30 ? "yellow" : next < -30 ? "red" : null;
    if (tone !== lastTone.current) {
      lastTone.current = tone;
      if (tone) tick();
    }
    if (!crossed.current && Math.abs(next) >= THRESHOLD) {
      crossed.current = true;
      tick();
    }
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (Math.abs(dx) >= THRESHOLD) {
      const dir: Direction = dx > 0 ? "right" : "left";
      // Snap to confirm offset; show confirm button
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
    confirmHaptic();
    setReleased(true);
    setDx(pending === "right" ? 600 : -600);
    setTimeout(() => onSwipe(pending), 220);
  };

  // Dismiss confirm with Escape
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending]);

  const tone = pending ?? (dx > 30 ? "right" : dx < -30 ? "left" : null);

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
          className="overflow-hidden rounded-[24px] border border-ink/10 bg-white"
          style={{
            boxShadow:
              tone === "right"
                ? "var(--shadow-yellow)"
                : tone === "left"
                  ? "var(--shadow-red)"
                  : "var(--shadow-card)",
            transition: "box-shadow 0.2s ease",
          }}
        >
          {children}
        </div>
        {tone === "right" && !pending && (
          <div className="pointer-events-none absolute -top-3 right-4 animate-swipe-label rounded-full bg-primary px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-ink">
            {t("→ 일정", "→ Schedule")}
          </div>
        )}
        {tone === "left" && !pending && (
          <div className="pointer-events-none absolute -top-3 left-4 animate-swipe-label rounded-full bg-ink px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
            {t("← 보관", "← Archive")}
          </div>
        )}
      </div>

      {/* Slide-to-confirm overlay (Apple-watch style two-step) */}
      {pending === "right" && (
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-[160px] items-center justify-start pl-3">
          <button
            onClick={finish}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-primary px-4 py-2.5 text-[13px] font-bold text-ink shadow-float animate-pop active:scale-95"
          >
            <Check size={16} strokeWidth={3} /> {t("일정 확정", "Confirm schedule")}
          </button>
          <button
            onClick={cancel}
            aria-label={t("취소", "Cancel")}
            className="pointer-events-auto ml-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-card active:scale-95"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {pending === "left" && (
        <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[180px] items-center justify-end pr-3">
          <button
            onClick={cancel}
            aria-label={t("취소", "Cancel")}
            className="pointer-events-auto mr-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-card active:scale-95"
          >
            <X size={16} />
          </button>
          <button
            onClick={finish}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2.5 text-[13px] font-bold text-destructive-foreground shadow-float animate-pop active:scale-95"
          >
            <Check size={16} strokeWidth={3} /> {t("보관 확정", "Confirm archive")}
          </button>
        </div>
      )}
    </div>
  );
}
