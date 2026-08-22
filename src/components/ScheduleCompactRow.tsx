import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate } from "framer-motion";
import type { ScheduleItem } from "@/lib/store";
import {
  formatUpcomingScheduleTime,
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
import { Check, BellRing, Pencil } from "lucide-react";

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

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDay(date: Date, lang: "ko" | "en"): string {
  return date.toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatRangeLabel(
  start: Date,
  end: Date,
  startAllDay: boolean,
  endAllDay: boolean,
  lang: "ko" | "en",
): string {
  const sameDay = sameCalendarDay(start, end);

  if (startAllDay && endAllDay) {
    if (sameDay) return lang === "ko" ? "종일" : "All day";
    return lang === "ko"
      ? `${formatDay(start, lang)} → ${formatDay(end, lang)} · 종일`
      : `${formatDay(start, lang)} → ${formatDay(end, lang)} · All day`;
  }

  const startTime = formatUpcomingScheduleTime(start, lang);
  const endTime = formatUpcomingScheduleTime(end, lang);

  if (sameDay) {
    return end.getTime() > start.getTime() + 30 * 60 * 1000
      ? `${startTime}–${endTime}`
      : startTime;
  }

  return `${formatDay(start, lang)} ${startTime} → ${formatDay(end, lang)} ${endTime}`;
}

function ReminderStatus({
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
      <BellRing size={13} strokeWidth={2.4} />
      <span>{t("알림 켜짐", "Reminder on")}</span>
      <span className="text-ink-soft/70">· {label}</span>
    </>
  );

  if (!onOpen) {
    return (
      <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/18 px-2 py-1 text-[11px] font-bold text-ink">
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
      className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-primary/22 px-2 py-1 text-[11px] font-bold text-ink ring-1 ring-primary/30 touch-press active:bg-primary/32"
      aria-label={`${t("알림 켜짐", "Reminder on")} · ${label}`}
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
  const displayTime = formatRangeLabel(
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
      className={`relative flex min-h-[52px] touch-none select-none items-center gap-3 border-b border-ink/[0.05] px-1 py-2.5 last:border-b-0 ${
        done ? "opacity-50" : ""
      }`}
      data-gesture={dragging.current || acting ? "true" : undefined}
      data-reminder={s.alarm ? "on" : "off"}
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
          className="pointer-events-none absolute left-0 top-1/2 z-0 -translate-y-1/2 rounded-full bg-primary/90 px-2.5 py-1 text-[11px] font-bold text-ink"
          style={{ opacity: Math.min(1, dx / 64) }}
        >
          <Check size={12} strokeWidth={3} />
        </div>
      )}

      <button
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (!done) onComplete();
        }}
        disabled={done}
        className={`touch-press flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold ${
          done
            ? "border-primary bg-primary text-ink"
            : "border-ink/12 bg-white text-ink"
        }`}
        aria-label={done ? t("완료됨", "Completed") : t("완료", "Complete")}
      >
        <Check size={12} strokeWidth={2.8} aria-hidden />
        <span>{done ? t("완료됨", "Done") : t("완료", "Done")}</span>
      </button>

      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] font-semibold tabular-nums leading-snug ${
            flags.startAllDay && flags.endAllDay
              ? "text-ink-soft/80"
              : "text-semantic-schedule"
          }`}
        >
          {displayTime}
        </span>
        <span
          className={`mt-0.5 block text-[16px] font-semibold leading-snug tracking-[-0.01em] text-ink ${
            done ? "line-through decoration-ink/20" : ""
          }`}
        >
          {title}
        </span>
        {s.alarm && !done && (
          <ReminderStatus label={alarmLabel} onOpen={onAlarm} t={t} />
        )}
        {(missed || pinned) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-soft/75">
            {missed && (
              <span className="status-chip status-chip--overdue">
                {t("지남", "Past")}
              </span>
            )}
            {pinned && !done && (
              <span className="text-ink-soft/70">{t("고정", "Pinned")}</span>
            )}
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
          className="touch-press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-ink-soft active:bg-ink/[0.04]"
          aria-label={t(`${title} 수정`, `Edit ${title}`)}
        >
          <Pencil size={12} strokeWidth={2.2} aria-hidden />
          <span>{t("수정", "Edit")}</span>
        </button>
      )}
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
    <li className="flex min-h-[52px] items-center gap-3 rounded-[var(--radius-sm)] border-b border-ink/[0.05] px-1 py-2.5 last:border-b-0">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink/15 bg-white"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-ink">
          {preview}
        </span>
        <span className="mt-0.5 block text-caption text-ink-soft/80">
          {t("시간을 정하지 않은 기록", "No time set")}
        </span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="touch-press min-h-9 shrink-0 rounded-full px-2.5 text-[11px] font-semibold text-ink-soft active:bg-ink/[0.04]"
      >
        {t("정리", "Organize")}
      </button>
    </li>
  );
}
