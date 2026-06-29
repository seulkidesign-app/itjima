import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Bell, BellOff, Pin } from "lucide-react";
import { useSchedules, type ScheduleItem } from "@/lib/store";
import { countdown, dDay } from "@/lib/dateDetect";
import { ScheduleSheet } from "@/components/ScheduleSheet";
import { toast } from "sonner";
import { useT, useLang } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { haptic, tick as hapticTick, confirm as hapticConfirm } from "@/lib/haptics";

export const Route = createFileRoute("/schedule")({
  component: Schedule,
});

// Pinned IDs live locally (avoids cloud schema change)
const PIN_KEY = "itjima.schedule.pinned";
function readPins(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]")); } catch { return new Set(); }
}
function writePins(ids: Set<string>) {
  localStorage.setItem(PIN_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent("itjima:pins"));
}

function usePins() {
  const [pins, setPins] = useState<Set<string>>(new Set());
  useEffect(() => {
    setPins(readPins());
    const h = () => setPins(readPins());
    window.addEventListener("itjima:pins", h);
    return () => window.removeEventListener("itjima:pins", h);
  }, []);
  const toggle = (id: string) => {
    const next = new Set(pins);
    if (next.has(id)) next.delete(id); else next.add(id);
    writePins(next);
  };
  return { pins, toggle };
}

function Schedule() {
  const t = useT();
  const { items, update, remove, add } = useSchedules();
  const [tab, setTab] = useState<"list" | "cal">("list");
  const [sheet, setSheet] = useState<{ open: boolean; edit?: ScheduleItem }>({ open: false });
  const [, tickN] = useState(0);
  const { pins, toggle: togglePin } = usePins();

  useEffect(() => {
    const id = setInterval(() => tickN((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Schedule simple in-tab notifications 1hr before start when alarm on
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const timers: number[] = [];
    items.forEach((s) => {
      if (!s.alarm) return;
      const fireAt = new Date(s.start_time).getTime() - 60 * 60 * 1000;
      const delay = fireAt - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        timers.push(
          window.setTimeout(() => {
            if (Notification.permission === "granted") {
              new Notification("⏰ ItJima", { body: t(`1시간 후: ${s.text}`, `In 1 hour: ${s.text}`) });
            }
          }, delay),
        );
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [items]);

  // List: pinned first, then upcoming (closest), then past
  const sorted = useMemo(() => {
    const now = Date.now();
    const arr = [...items];
    arr.sort((a, b) => {
      const ap = pins.has(a.id) ? 1 : 0;
      const bp = pins.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const at = +new Date(a.start_time);
      const bt = +new Date(b.start_time);
      const aFuture = at >= now;
      const bFuture = bt >= now;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      return aFuture ? at - bt : bt - at;
    });
    return arr;
  }, [items, pins]);

  const moveEventToDate = async (id: string, day: number, month: number, year: number) => {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const s = new Date(it.start_time);
    const e = new Date(it.end_time);
    const dur = e.getTime() - s.getTime();
    const ns = new Date(year, month, day, s.getHours(), s.getMinutes());
    const ne = new Date(ns.getTime() + dur);
    await update(id, { start_time: ns.toISOString(), end_time: ne.toISOString() } as any);
    hapticConfirm();
    toast.success(t("날짜가 옮겨졌어요", "Date moved"));
  };

  return (
    <div className="flex h-full flex-col bg-white pt-2">
      <div className="px-5 pb-3 pt-2">
        <div className="nrc-eyebrow">{t("다시 돌아올 때", "When it resurfaces")}</div>
        <h1 className="nrc-headline mt-1">{t("때", "When")}</h1>
      </div>
      <div className="px-5 pb-3">
        <div className="inline-flex border-b border-ink/10">
          {([
            ["cal", t("캘린더", "Calendar")],
            ["list", t("리스트", "List")],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k as "list" | "cal")}
              className={`relative px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.16em] transition ${
                tab === k ? "text-ink" : "text-ink-soft"
              }`}
            >
              {label}
              <span
                className={`absolute inset-x-0 -bottom-px h-[3px] transition-all ${
                  tab === k ? "bg-ink" : "bg-transparent"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-6">
        {tab === "list" ? (
          sorted.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-3">
              {sorted.map((s) => (
                <ScheduleCard
                  key={s.id}
                  s={s}
                  pinned={pins.has(s.id)}
                  onPin={() => { togglePin(s.id); haptic(8); }}
                  onEdit={() => setSheet({ open: true, edit: s })}
                  onToggle={async (alarm) => {
                    if (alarm && "Notification" in window && Notification.permission === "default") {
                      await Notification.requestPermission();
                    }
                    update(s.id, { alarm } as any);
                  }}
                  onDelete={() => {
                    remove(s.id);
                    if (pins.has(s.id)) togglePin(s.id);
                    toast(t("삭제됨", "Deleted"));
                  }}
                />
              ))}
            </div>
          )
        ) : (
          <CalendarGrid
            items={sorted}
            pins={pins}
            onTogglePin={(id) => { togglePin(id); haptic(8); }}
            onEdit={(s) => setSheet({ open: true, edit: s })}
            onDropToDate={moveEventToDate}
          />
        )}
      </div>

      <button
        onClick={() => setSheet({ open: true })}
        className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-ink shadow-float active:scale-95 transition"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        aria-label={t("새 일정", "New event")}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      {sheet.open && (
        <ScheduleSheet
          open
          initialText={sheet.edit?.text}
          initialStart={sheet.edit ? new Date(sheet.edit.start_time) : undefined}
          initialEnd={sheet.edit ? new Date(sheet.edit.end_time) : undefined}
          saveLabel={sheet.edit ? t("저장", "Save") : undefined}
          onClose={() => setSheet({ open: false })}
          onSave={async (text, start, end) => {
            if (sheet.edit) {
              await update(sheet.edit.id, {
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
              } as any);
              toast.success(t("수정됐어요", "Updated"));
            } else {
              await add({
                text,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                alarm: false,
              } as any);
              track("schedule_created", { source: "manual", text_length: text.length });
              toast.success(t("등록됐어요", "Added"));
            }
            setSheet({ open: false });
          }}
        />
      )}
    </div>
  );
}

function ScheduleCard({
  s,
  pinned,
  onPin,
  onEdit,
  onToggle,
  onDelete,
}: {
  s: ScheduleItem;
  pinned: boolean;
  onPin: () => void;
  onEdit: () => void;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const start = new Date(s.start_time);
  const end = new Date(s.end_time);
  const d = dDay(start);
  const pressTimer = useRef<number | null>(null);
  const longFired = useRef(false);

  const startPress = () => {
    longFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longFired.current = true;
      onPin();
    }, 500);
  };
  const endPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  return (
    <div
      className={`card-radius shadow-card p-4 transition ${
        pinned ? "bg-primary/15 ring-2 ring-primary/40" : "glass"
      }`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onClick={() => { if (!longFired.current) onEdit(); }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {pinned && <Pin size={12} className="fill-primary text-primary" />}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                d.tone === "today"
                  ? "bg-destructive text-white"
                  : d.tone === "soon"
                    ? "bg-primary text-ink"
                    : "bg-white/70 text-ink-soft"
              }`}
            >
              {lang === "en" ? translateDday(d.label) : d.label}
            </span>
            <span className="text-[12px] font-semibold text-ink">
              {lang === "en" ? translateCountdown(countdown(start)) : countdown(start)}
            </span>
          </div>
          <div className="mt-1.5 text-[16px] font-semibold leading-snug text-ink">{s.text}</div>
          <div className="mt-1 text-[12px] text-ink-soft">
            {fmt(start)} → {fmt(end)}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(!s.alarm); }}
          aria-label={t("알람 토글", "Toggle alarm")}
          className={`relative flex h-7 w-12 shrink-0 items-center rounded-full transition ${
            s.alarm ? "bg-primary" : "bg-white/70"
          }`}
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition ${
              s.alarm ? "translate-x-6" : "translate-x-1"
            }`}
          >
            {s.alarm ? <Bell size={11} /> : <BellOff size={11} className="text-ink-soft" />}
          </span>
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          className="text-[12px] font-medium text-ink-soft hover:text-ink"
        >
          {pinned ? t("핀 해제", "Unpin") : t("핀", "Pin")}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-[12px] font-medium text-ink-soft hover:text-destructive"
        >
          {t("삭제", "Delete")}
        </button>
      </div>
    </div>
  );
}

function translateDday(label: string) {
  if (label === "오늘") return "Today";
  if (label === "내일") return "Tomorrow";
  if (label === "어제") return "Yesterday";
  const m = label.match(/^D([+-]?\d+)$/);
  if (m) return label;
  return label;
}

function translateCountdown(label: string) {
  return label
    .replace(/(\d+)분 후/, "in $1m")
    .replace(/(\d+)시간 후/, "in $1h")
    .replace(/(\d+)일 후/, "in $1d")
    .replace(/(\d+)분 전/, "$1m ago")
    .replace(/(\d+)시간 전/, "$1h ago")
    .replace(/(\d+)일 전/, "$1d ago")
    .replace(/곧/, "soon")
    .replace(/지금/, "now");
}

function fmt(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function CalendarGrid({
  items,
  pins,
  onTogglePin,
  onEdit,
  onDropToDate,
}: {
  items: ScheduleItem[];
  pins: Set<string>;
  onTogglePin: (id: string) => void;
  onEdit: (s: ScheduleItem) => void;
  onDropToDate: (id: string, day: number, month: number, year: number) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { y, m } = view;
  const first = new Date(y, m, 1);
  const startDay = first.getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: startDay }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const eventsOf = (day: number) =>
    items.filter((s) => {
      const dt = new Date(s.start_time);
      return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === day;
    });
  const [selected, setSelected] = useState<number | null>(today.getDate());
  const [dragOver, setDragOver] = useState<number | null>(null);
  const monthLabel = lang === "en"
    ? new Date(y, m, 1).toLocaleString("en-US", { month: "long", year: "numeric" })
    : `${y}년 ${m + 1}월`;
  const weekdays = lang === "en"
    ? ["S", "M", "T", "W", "T", "F", "S"]
    : ["일", "월", "화", "수", "목", "금", "토"];

  const selectedEvents = selected ? eventsOf(selected) : [];
  const locale = lang === "en" ? "en-US" : "ko-KR";

  const onChipDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
    hapticTick();
  };
  const onCellDrop = (e: React.DragEvent, day: number) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    setDragOver(null);
    if (id) onDropToDate(id, day, m, y);
  };

  return (
    <div className="space-y-3">
      <div className="card-radius glass shadow-card p-3">
        <div className="mb-3 flex items-center justify-between px-1">
          <button
            onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))}
            className="rounded-full px-2 py-0.5 text-sm text-ink-soft hover:bg-white/60"
          >‹</button>
          <div className="text-sm font-bold text-ink">{monthLabel}</div>
          <button
            onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))}
            className="rounded-full px-2 py-0.5 text-sm text-ink-soft hover:bg-white/60"
          >›</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-ink-soft">
          {weekdays.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-0.5">
          {cells.map((c, i) => {
            if (!c) return <div key={i} className="aspect-square" />;
            const evs = eventsOf(c);
            const isToday =
              c === today.getDate() && m === today.getMonth() && y === today.getFullYear();
            const isSel = c === selected;
            const isDragOver = dragOver === c;
            return (
              <button
                key={i}
                onClick={() => { setSelected(c); haptic(6); }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(c); }}
                onDragLeave={() => setDragOver((d) => (d === c ? null : d))}
                onDrop={(e) => onCellDrop(e, c)}
                className={`relative flex aspect-square flex-col items-stretch justify-start rounded-lg p-1 text-left transition ${
                  isDragOver
                    ? "bg-primary/40 ring-2 ring-primary"
                    : isSel
                      ? "bg-primary text-ink shadow-card"
                      : isToday
                        ? "bg-primary/20 text-ink"
                        : "text-ink hover:bg-white/60"
                }`}
              >
                <span className="text-[11px] font-bold leading-none">{c}</span>
                {evs.length > 0 && (
                  <span
                    className={`mt-0.5 line-clamp-2 text-[8px] font-medium leading-[1.1] ${
                      isSel ? "text-ink/80" : "text-ink-soft"
                    }`}
                  >
                    {pins.has(evs[0].id) && "📌"}
                    {evs[0].text}
                    {evs.length > 1 && (
                      <span className="ml-0.5 opacity-70"> +{evs.length - 1}</span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-2 px-1 text-[10px] text-ink-soft/80">
          {t("💡 일정을 끌어서 다른 날짜로 옮길 수 있어요", "💡 Drag an event onto another day to move it")}
        </div>
      </div>

      {/* Selected day events */}
      {selected !== null && (
        <div className="card-radius glass-soft shadow-card p-3">
          <div className="mb-2 px-1 text-[12px] font-bold text-ink-soft">
            {new Date(y, m, selected).toLocaleDateString(locale, {
              month: "short",
              day: "numeric",
              weekday: "short",
            })}
            <span className="ml-1 text-ink-soft/70">· {selectedEvents.length}</span>
          </div>
          {selectedEvents.length === 0 ? (
            <div className="px-1 py-3 text-center text-[12px] text-ink-soft">
              {t("이날 일정이 없어요", "No events on this day")}
            </div>
          ) : (
            <ul className="space-y-1.5">
              {selectedEvents
                .slice()
                .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
                .map((s) => (
                  <DayEventChip
                    key={s.id}
                    s={s}
                    pinned={pins.has(s.id)}
                    onClick={() => onEdit(s)}
                    onLongPress={() => onTogglePin(s.id)}
                    onDragStart={(e) => onChipDragStart(e, s.id)}
                  />
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function DayEventChip({
  s,
  pinned,
  onClick,
  onLongPress,
  onDragStart,
}: {
  s: ScheduleItem;
  pinned: boolean;
  onClick: () => void;
  onLongPress: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const st = new Date(s.start_time);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const onDown = () => {
    fired.current = false;
    timer.current = window.setTimeout(() => { fired.current = true; onLongPress(); }, 500);
  };
  const onUp = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };
  return (
    <li
      draggable
      onDragStart={onDragStart}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onClick={() => { if (!fired.current) onClick(); }}
      className={`flex cursor-grab items-start gap-2 rounded-xl px-2.5 py-2 transition active:cursor-grabbing ${
        pinned ? "bg-primary/30 ring-1 ring-primary" : "bg-white/70 hover:bg-white"
      }`}
    >
      {pinned && <Pin size={11} className="mt-1 fill-primary text-primary" />}
      <span className="mt-0.5 rounded-md bg-primary/30 px-1.5 py-0.5 text-[10px] font-bold text-ink">
        {st.getHours().toString().padStart(2, "0")}:
        {st.getMinutes().toString().padStart(2, "0")}
      </span>
      <span className="flex-1 text-[13px] leading-snug text-ink">{s.text}</span>
    </li>
  );
}

function Empty() {
  const t = useT();
  return (
    <div className="flex h-full min-h-[50dvh] flex-col items-center justify-center text-center">
      <div className="text-5xl">🗓</div>
      <div className="mt-3 text-[17px] font-bold text-ink">{t("아직 일정이 없어요", "No events yet")}</div>
      <div className="mt-1 text-sm text-ink-soft">{t("생각을 오른쪽으로 밀거나 + 버튼으로 추가해요.", "Swipe a thought right or hit + to add one.")}</div>
    </div>
  );
}
