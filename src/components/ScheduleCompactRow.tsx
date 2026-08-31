import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { animate } from "framer-motion";
import type { ScheduleItem } from "@/lib/store";
import {
  formatScheduleRangeLabel,
  resolveScheduleAllDayFlags,
} from "@/lib/scheduleTime";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";
import { cleanScheduleTitle } from "@/lib/naturalScheduleDraft";
import { parseCanonicalTemporalModel } from "@/lib/nlTemporalCalendarModel";
import { isMissed } from "@/lib/scheduleGroups";
import { useT, useLang } from "@/lib/i18n";
import { confirm as hapticConfirm } from "@/lib/haptics";
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
  inPastSection?: boolean;
  onComplete: () => void;
  onEdit: () => void;
  onOpenDetail?: () => void;
  onAlarm?: () => void;
};

function fuzzyDaypartLabel(text: string, lang: "ko" | "en"): string | null {
  const daypart = parseCanonicalTemporalModel(text).daypart;
  if (!daypart) return null;
  const ko = {
    morning: "오전",
    afternoon: "오후",
    evening: "저녁",
    night: "밤",
    dawn: "새벽",
    lunch: "점심",
    noon: "정오",
    midnight: "자정",
  } as const;
  const en = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    night: "Night",
    dawn: "Dawn",
    lunch: "Lunch",
    noon: "Noon",
    midnight: "Midnight",
  } as const;
  return lang === "en" ? en[daypart] : ko[daypart];
}

export function ScheduleCompactRow({
  s,
  pinned,
  done,
  inPastSection = false,
  onComplete,
  onEdit,
  onOpenDetail,
  onAlarm,
}: ScheduleCompactRowProps) {
  const t = useT();
  const { lang } = useLang();
  const locale = lang === "en" ? "en" : "ko";
  const rawTitle = scheduleDisplayTitle(s);
  const title = cleanScheduleTitle(rawTitle) || rawTitle;
  const flags = resolveScheduleAllDayFlags(s);
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const baseDisplayTime = formatScheduleRangeLabel(
    start,
    end,
    flags.startAllDay,
    flags.endAllDay,
    locale,
  );
  const fuzzyLabel =
    flags.startAllDay && flags.endAllDay
      ? fuzzyDaypartLabel(s.raw_text ?? s.text, locale)
      : null;
  const displayTime = fuzzyLabel
    ? baseDisplayTime.replace(locale === "ko" ? /종일/g : /All day/g, fuzzyLabel)
    : baseDisplayTime;
  const openDetail = onOpenDetail ?? onEdit;
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
      className={`quietly-schedule-card relative flex min-h-[52px] touch-none select-none items-start gap-2 ${
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
        aria-pressed={done ? "true" : "false"}
        data-testid="schedule-row-complete"
      >
        <span
          className={`grid h-[22px] w-[22px] place-items-center rounded-full border-2 transition-all duration-150 ${
            done
              ? "border-ink bg-ink text-white"
              : "border-ink/35 bg-white shadow-[inset_0_0_0_1px_rgba(26,26,31,0.02)]"
          }`}
          aria-hidden
        >
          {done && <Check size={13} strokeWidth={3} />}
        </span>
      </button>

      <div
        role="button"
        tabIndex={0}
        aria-label={t(`${title} 상세 열기`, `Open ${title}`)}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.stopPropagation();
        }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          event.stopPropagation();
          openDetail();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetail();
          }
        }}
        className="schedule-row-content min-w-0 flex-1 cursor-pointer pt-1.5 text-left touch-press"
        data-testid="schedule-row-open-detail"
      >
        <span className="schedule-row-meta block text-[12px] font-semibold tabular-nums leading-snug tracking-[-0.01em] text-primary">
          {displayTime}
        </span>
        <span
          className={`schedule-row-title mt-0.5 block text-[14px] font-semibold leading-snug tracking-[-0.01em] text-ink ${
            done ? "line-through decoration-ink/20 text-ink-soft" : ""
          }`}
        >
          {title}
        </span>
        {missed && (
          <span className="mt-0.5 block text-[11px] font-medium text-ink-soft/80">
            {t("지남", "Past")}
          </span>
        )}
        {pinned && !done && (
          <span className="mt-0.5 block text-[11px] font-medium text-ink-soft/70">
            {t("고정", "Pinned")}
          </span>
        )}
      </div>

      {s.alarm && !done && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onAlarm?.();
          }}
          className="touch-press mt-0.5 inline-flex h-11 min-w-11 shrink-0 items-center justify-center text-ink-soft"
          aria-label={`${t("알림", "Reminder")} · ${alarmLabel}`}
        >
          <Bell size={16} strokeWidth={2.2} aria-hidden />
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
