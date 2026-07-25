import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate } from "framer-motion";
import type { ScheduleItem } from "@/lib/store";
import { formatUpcomingScheduleTime } from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { isMissed } from "@/lib/scheduleGroups";
import { useT, useLang } from "@/lib/i18n";
import { haptic, confirm as hapticConfirm } from "@/lib/haptics";
import { Check } from "lucide-react";

export type ScheduleCompactRowProps = {
  s: ScheduleItem;
  pinned?: boolean;
  done?: boolean;
  onComplete: () => void;
  onEdit: () => void;
};

export function ScheduleCompactRow({
  s,
  pinned,
  done,
  onComplete,
  onEdit,
}: ScheduleCompactRowProps) {
  const t = useT();
  const { lang } = useLang();
  const title = scheduleDisplayTitle(s);
  const timeLabel = formatUpcomingScheduleTime(new Date(s.start_time), lang);
  const missed = !done && isMissed(s);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [acting, setActing] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  dxRef.current = dx;

  const onDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (acting || done) return;
    dragging.current = true;
    startX.current = e.clientX;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (!dragging.current || acting || done) return;
    const next = Math.max(0, Math.min(100, e.clientX - startX.current));
    dxRef.current = next;
    setDx(next);
  };

  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (!done && dxRef.current >= 64) {
      setActing(true);
      animate(dxRef.current, 120, {
        type: "spring",
        stiffness: 340,
        damping: 28,
        onUpdate: (v) => {
          dxRef.current = v;
          setDx(v);
        },
        onComplete: () => {
          hapticConfirm();
          onComplete();
          setActing(false);
          dxRef.current = 0;
          setDx(0);
        },
      });
      return;
    }
    if (dxRef.current < 8) onEdit();
    animate(dxRef.current, 0, {
      type: "spring",
      stiffness: 420,
      damping: 32,
      onUpdate: (v) => {
        dxRef.current = v;
        setDx(v);
      },
    });
  };

  return (
    <li
      className={`relative flex min-h-[44px] touch-none select-none items-center gap-3 border-b border-ink/[0.05] px-1 py-2.5 last:border-b-0 active:bg-ink/[0.02] ${
        done ? "opacity-50" : ""
      }`}
      role="button"
      tabIndex={0}
      aria-label={`${title}. ${t("탭하면 다듬기", "Tap to refine")}`}
      style={{
        transform: `translateX(${dx}px)`,
        transition: dragging.current || acting ? "none" : undefined,
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onEdit();
        } else if (e.key === " " && !done) {
          e.preventDefault();
          onComplete();
        }
      }}
    >
      {dx > 20 && !done && (
        <div
          className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-ink"
          style={{ opacity: Math.min(1, dx / 64) }}
        >
          <Check size={12} strokeWidth={3} />
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!done) onComplete();
        }}
        disabled={done}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-[1.5px] touch-press ${
          done
            ? "border-primary bg-primary text-ink"
            : pinned
              ? "border-primary/70 bg-primary/15"
              : "border-ink/18 bg-white"
        }`}
        aria-label={done ? t("완료됨", "Done") : t("다녀옴", "Mark done")}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </button>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink ${
            done ? "line-through decoration-ink/20" : ""
          }`}
        >
          {title}
        </span>
        {(timeLabel || missed || pinned) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] tabular-nums text-ink-soft/75">
            {timeLabel && <span>{timeLabel}</span>}
            {missed && (
              <span className="text-ink-soft/80">
                {t("그때가 지났어요", "That moment passed")}
              </span>
            )}
            {pinned && !done && (
              <span className="text-ink-soft/70">{t("고정", "Pinned")}</span>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

export type LaterInboxRowProps = {
  text: string;
  onOpen: () => void;
};

export function LaterInboxRow({ text, onOpen }: LaterInboxRowProps) {
  const t = useT();
  const preview = text.split("\n")[0]?.trim() ?? text;

  return (
    <li
      className="flex min-h-[44px] items-center gap-3 rounded-[var(--radius-sm)] border-b border-ink/[0.05] px-1 py-2.5 last:border-b-0 active:bg-ink/[0.03]"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 bg-white"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-ink">
          {preview}
        </span>
        <span className="mt-0.5 block text-caption text-ink-soft/80">
          {t("날짜 없음", "No date")}
        </span>
      </span>
    </li>
  );
}
