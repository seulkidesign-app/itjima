import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate } from "framer-motion";
import type { ScheduleItem } from "@/lib/store";
import {
  formatScheduleRangeLabel,
  resolveScheduleAllDayFlags,
} from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { isMissed } from "@/lib/scheduleGroups";
import { useT, useLang } from "@/lib/i18n";
import { haptic, confirm as hapticConfirm } from "@/lib/haptics";
import { SPRING_ROW, SPRING_SNAP_BACK } from "@/lib/motion";
import {
  effectiveAlarmAt,
  formatAlarmLabel,
} from "@/lib/scheduleReminders";
import { Check, Bell } from "lucide-react";

export type ScheduleCompactRowProps = {
  s: ScheduleItem;
  pinned?: boolean;
  done?: boolean;
  /** When true, suppress per-row overdue label (shown at section level). */
  inPastSection?: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onAlarm?: () => void;
};

function ReminderMeta({
  label,
  onOpen,
  t,
}: {
  label: string;
  onOpen?: () => void;
  t: ReturnType<typeof useT>;
}) {
  const content = (
    <>
      <Bell size={13} strokeWidth={2.2} aria-hidden />
      <span>{label}</span>
    </>
  );

  if (!onOpen) {
    return (
      <span className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[12px] font-medium text-ink-soft">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      className="touch-press mt-0.5 inline-flex min-h-11 max-w-full items-center gap-1 -ml-1 px-1 text-left text-[12px] font-medium text-ink-soft underline-offset-2 hover:underline"
      aria-label={`${t("알림", "Reminder")} · ${label}`}
    >
      {content}
    </button>
  );
}

export function ScheduleCompactRow({
  s,
  pinned,
  done,
  inPastSection = false,
  onComplete,
  onEdit,
  onAlarm,
}: ScheduleCompactRowProps) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en" : "ko";
  const title = scheduleDisplayTitle(s);
  const flags = resolveScheduleAllDayFlags(s);
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const displayTime = formatScheduleRangeLabel(
    start,
    end,
    flags.startAllDay,
    flags.endAllDay,
    locale,
  );
  const alarmAt = effectiveAlarmAt(s);
  const alarmLabel = alarmAt
    ? formatAlarmLabel(alarmAt, locale)
    : t("시간 확인 필요", "Check time");
  const missed = !done && !inPastSection && isMissed(s);
  const dxRef = useRef(0);
  const [dx, setDx] = useState(0);
  const [acting, setActing] = useState(false);
  const dragging = useRef(false);
  const startX = useRef(0);
  dxRef.current = dx;

  const onDown = (e: ReactPointerEvent<HTMLLIElement>) => {
    if (acting || done) return;
    if ((e.target as HTMLElement).closest("button")) return;
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
        ...SPRING_ROW,
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
    animate(dxRef.current, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        dxRef.current = v;
        setDx(v);
      },
    });
  };

  return (
    <li
      className={`relative flex min-h-[52px] touch-none select-none items-start gap-1 border-b border-ink/[0.06] px-0.5 py-2.5 last:border-b-0 ${
        done ? "opacity-50" : ""
      }`}
      data-gesture={dragging.current || acting ? "true" : undefined}
      data-reminder={s.alarm ? "on" : "off"}
      data-testid="schedule-compact-row"
      style={{
        transform: `translate3d(${dx}px, 0, 0)`,
        transition: dragging.current || acting ? "none" : undefined,
        willChange: dragging.current || acting ? "transform" : "auto",
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {dx > 20 && !done && (
        <div
          className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 text-[12px] font-semibold text-ink-soft"
          style={{ opacity: Math.min(1, dx / 64) }}
        >
          <Check size={14} strokeWidth={2.8} />
        </div>
      )}

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onComplete();
        }}
        className="touch-press grid h-11 w-11 shrink-0 place-items-center rounded-full"
        aria-label={done ? t("완료 취소", "Undo complete") : t("완료", "Complete")}
        data-testid="schedule-row-complete"
      >
        <span
          className={`grid h-[18px] w-[18px] place-items-center rounded-full border-2 ${
            done
              ? "border-ink bg-ink text-white"
              : "border-ink/25 bg-white"
          }`}
          aria-hidden
        >
          {done && <Check size={11} strokeWidth={3} />}
        </span>
      </button>

      <span className="min-w-0 flex-1 pt-2.5">
        {/* Time-first hierarchy (Figma 24) */}
        <span className="block text-[15px] font-semibold tabular-nums leading-snug tracking-[-0.01em] text-ink">
          {displayTime}
        </span>
        <span
          className={`mt-0.5 block text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink ${
            done ? "line-through decoration-ink/20 text-ink-soft" : ""
          }`}
        >
          {title}
        </span>
        {s.alarm && !done && (
          <ReminderMeta label={alarmLabel} onOpen={onAlarm} t={t} />
        )}
        {missed && (
          <span className="mt-0.5 block text-[12px] font-medium text-ink-soft/80">
            {t("지남", "Past")}
          </span>
        )}
        {pinned && !done && (
          <span className="mt-0.5 block text-[12px] font-medium text-ink-soft/70">
            {t("고정", "Pinned")}
          </span>
        )}
      </span>

      {!done && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            haptic(6);
            onEdit();
          }}
          className="touch-press mt-0.5 inline-flex h-11 min-w-11 shrink-0 items-center justify-center px-2 text-[13px] font-medium text-ink-soft"
          aria-label={t(`${title} 수정`, `Edit ${title}`)}
          data-testid="schedule-row-edit"
        >
          {t("수정", "Edit")}
        </button>
      )}
    </li>
  );
}

export type LaterInboxRowProps = {
  text: string;
  onOpen: () => void;
};

/** Undated inbox row — same grammar as Capture “남긴 것”. */
export function LaterInboxRow({ text, onOpen }: LaterInboxRowProps) {
  const t = useT();
  const preview = text.split("\n")[0]?.trim() ?? text;

  return (
    <li
      className="flex min-h-[52px] items-start gap-2 border-b border-ink/[0.06] px-0.5 py-3 last:border-b-0"
      data-testid="later-inbox-row"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-snug text-ink">
          {preview}
        </span>
        <button
          type="button"
          onClick={onOpen}
          className="touch-press mt-1 min-h-11 -ml-1 px-1 text-left text-[13px] font-medium text-ink-soft underline-offset-2 hover:underline"
        >
          {t("시간 정하기", "Set a time")}
        </button>
      </span>
    </li>
  );
}
