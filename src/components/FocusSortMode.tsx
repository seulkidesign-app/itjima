import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Archive, Calendar, Trash2, X } from "lucide-react";
import { animate, motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";
import { thoughtFirstLine } from "@/lib/brainMirror";
import {
  SWIPE_COMMIT,
  SWIPE_PREVIEW,
  MAX_ROTATE,
  dragProgress,
  cardShadowBlur,
  cardScale,
  indicatorScale,
  SPRING_SNAP_BACK,
  SPRING_DEFAULT,
} from "@/lib/motion";

type Props = {
  open: boolean;
  items: InboxItem[];
  startItemId?: string | null;
  pendingScheduleId?: string | null;
  scheduleCommittedId?: string | null;
  onScheduleCommitHandled?: () => void;
  onClose: () => void;
  onScheduleRequest: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSoftDelete?: (item: InboxItem) => void | Promise<void>;
};

type ExitDir = "left" | "right" | "up";

function sortOldestFirst(list: InboxItem[]) {
  return [...list].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
}

function DeckCard({ item }: { item: InboxItem }) {
  const t = useT();
  const bm = item.brain_mirror;
  const interpretive = bm?.suggestedAction?.trim();

  return (
    <>
      {item.images?.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-20 w-20 rounded-[20px] object-cover"
            />
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-[18px] font-semibold leading-[1.65] text-ink">
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      {bm?.title && (
        <div className="mt-4 border-t border-dashed border-ink/15 pt-3">
          <p className="text-[14px] font-semibold text-ink/85">{bm.title}</p>
          {bm.items.length > 1 && (
            <ul className="mt-1.5 space-y-1">
              {bm.items.slice(0, 4).map((line) => (
                <li key={line} className="text-[13px] text-ink/70">
                  · {line}
                </li>
              ))}
            </ul>
          )}
          {interpretive && (
            <p className="mt-2 text-[13px] text-ink-soft">{interpretive}</p>
          )}
        </div>
      )}
    </>
  );
}

function ProgressDots({ total, current }: { total: number; current: number }) {
  const max = Math.min(total, 12);
  if (total <= 0) return null;
  return (
    <div className="flex items-center justify-center gap-1.5" aria-hidden>
      {Array.from({ length: max }, (_, i) => {
        const idx =
          total <= max || max === 1
            ? i
            : Math.floor((i / (max - 1)) * (total - 1));
        const active = idx === current - 1;
        return (
          <span
            key={i}
            className={`rounded-full transition-all duration-200 ${
              active ? "h-2 w-2 bg-ink" : "h-1.5 w-1.5 bg-ink/20"
            }`}
          />
        );
      })}
    </div>
  );
}

export function FocusSortMode({
  open,
  items,
  startItemId,
  pendingScheduleId,
  scheduleCommittedId,
  onScheduleCommitHandled,
  onClose,
  onScheduleRequest,
  onArchive,
  onSoftDelete,
}: Props) {
  const t = useT();
  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const thresholdFired = useRef<ExitDir | null>(null);
  const [deck, setDeck] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  offsetRef.current = offset;

  const current = deck[cursor] ?? null;
  const finished = open && initialTotal.current > 0 && deck.length === 0;
  const progress = initialTotal.current
    ? initialTotal.current - deck.length + (current ? 1 : 0)
    : 0;

  useEffect(() => {
    if (!finished) return;
    const id = window.setTimeout(() => onClose(), 2000);
    return () => window.clearTimeout(id);
  }, [finished, onClose]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const ordered = sortOldestFirst(items);
      initialTotal.current = ordered.length;
      const startIdx = startItemId
        ? Math.max(
            0,
            ordered.findIndex((i) => i.id === startItemId),
          )
        : 0;
      setDeck(ordered);
      setCursor(startIdx >= 0 ? startIdx : 0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
      thresholdFired.current = null;
    }
    wasOpen.current = open;
    if (!open) {
      initialTotal.current = 0;
      setDeck([]);
      setCursor(0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    }
  }, [open, items, startItemId]);

  useEffect(() => {
    if (!open) return;
    setDeck((prev) => {
      const ids = new Set(items.map((i) => i.id));
      const next = prev.filter((i) => ids.has(i.id));
      if (next.length === prev.length) return prev;
      return next;
    });
  }, [items, open]);

  useEffect(() => {
    if (cursor >= deck.length && deck.length > 0) {
      setCursor(deck.length - 1);
    }
  }, [deck.length, cursor]);

  const cardW = useCallback(() => cardRef.current?.offsetWidth ?? 300, []);
  const cardH = useCallback(() => cardRef.current?.offsetHeight ?? 360, []);

  const springBack = useCallback(() => {
    thresholdFired.current = null;
    const from = offsetRef.current;
    animate(from.x, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
    });
    animate(from.y, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
    });
  }, []);

  const removeAtCursor = useCallback(() => {
    setDeck((d) => d.filter((_, i) => i !== cursor));
    thresholdFired.current = null;
  }, [cursor]);

  const flyAwayCommit = useCallback(async () => {
    if (exiting) return;
    setExiting(true);
    const w = cardW();
    const from = offsetRef.current;
    await Promise.all([
      animate(from.x, w * 1.7, {
        type: "spring",
        stiffness: 280,
        damping: 26,
        onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
      }).finished,
      animate(from.y, 24, {
        type: "spring",
        stiffness: 280,
        damping: 26,
        onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
      }).finished,
    ]);
    removeAtCursor();
    setOffset({ x: 0, y: 0 });
    setExiting(false);
  }, [cardW, exiting, removeAtCursor]);

  const openSchedule = useCallback(async () => {
    if (!current || exiting) return;
    setExiting(true);
    confirmHaptic();
    const w = cardW();
    const from = offsetRef.current;
    await animate(from.x, w * 0.42, {
      type: "spring",
      stiffness: 300,
      damping: 28,
      onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
    }).finished;
    onScheduleRequest(current);
    setExiting(false);
  }, [cardW, current, exiting, onScheduleRequest]);

  const flyAway = useCallback(
    async (dir: ExitDir) => {
      if (!current || exiting) return;
      if (dir === "right") {
        await openSchedule();
        return;
      }
      setExiting(true);
      confirmHaptic();
      const w = cardW();
      const h = cardH();
      const from = offsetRef.current;
      const targetX = dir === "left" ? -w * 1.7 : from.x;
      const targetY = dir === "up" ? -h * 1.4 : 24;

      await Promise.all([
        animate(from.x, targetX, {
          type: "spring",
          stiffness: 280,
          damping: 26,
          onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
        }).finished,
        animate(from.y, targetY, {
          type: "spring",
          stiffness: 280,
          damping: 26,
          onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
        }).finished,
      ]);

      const item = current;
      if (dir === "left") await onArchive(item);
      else await onSoftDelete?.(item);

      removeAtCursor();
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    },
    [
      cardH,
      cardW,
      current,
      exiting,
      onArchive,
      onSoftDelete,
      openSchedule,
      removeAtCursor,
    ],
  );

  const prevPending = useRef<string | null>(null);
  useEffect(() => {
    if (prevPending.current && !pendingScheduleId) springBack();
    prevPending.current = pendingScheduleId ?? null;
  }, [pendingScheduleId, springBack]);

  const commitHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!open) commitHandled.current = null;
  }, [open]);

  useEffect(() => {
    if (!scheduleCommittedId || !open) return;
    if (commitHandled.current === scheduleCommittedId) return;
    const idx = deck.findIndex((i) => i.id === scheduleCommittedId);
    if (idx < 0) {
      onScheduleCommitHandled?.();
      return;
    }
    commitHandled.current = scheduleCommittedId;
    void (async () => {
      if (idx !== cursor) setCursor(idx);
      await flyAwayCommit();
      onScheduleCommitHandled?.();
    })();
  }, [
    scheduleCommittedId,
    open,
    deck,
    cursor,
    flyAwayCommit,
    onScheduleCommitHandled,
  ]);

  if (!open) return null;

  const onDown = (e: PointerEvent) => {
    if (exiting || !current || pendingScheduleId) return;
    setDragging(true);
    thresholdFired.current = null;
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || exiting) return;
    let x = e.clientX - start.current.x;
    let y = e.clientY - start.current.y;
    const w = cardW();
    const h = cardH();
    x = Math.max(-w * 0.95, Math.min(w * 0.95, x));
    y = Math.max(-h * 0.65, Math.min(h * 0.35, y));
    setOffset({ x, y });

    const absX = Math.abs(x);
    const absY = Math.abs(y);
    let dir: ExitDir | null = null;
    if (absY > absX && y < 0 && absY > h * SWIPE_COMMIT) dir = "up";
    else if (absX > absY && x > w * SWIPE_COMMIT) dir = "right";
    else if (absX > absY && x < -w * SWIPE_COMMIT) dir = "left";

    if (dir && thresholdFired.current !== dir) {
      thresholdFired.current = dir;
      tick();
    } else if (!dir) {
      thresholdFired.current = null;
    }
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const w = cardW();
    const h = cardH();
    const { x, y } = offsetRef.current;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absY > absX && y < 0 && absY > h * SWIPE_COMMIT) {
      void flyAway("up");
      return;
    }
    if (x > w * SWIPE_COMMIT) {
      void flyAway("right");
      return;
    }
    if (x < -w * SWIPE_COMMIT) {
      void flyAway("left");
      return;
    }
    springBack();
  };

  const rightProgress = offset.x > 0 ? dragProgress(offset.x, cardW()) : 0;
  const leftProgress = offset.x < 0 ? dragProgress(-offset.x, cardW()) : 0;
  const upProgress = offset.y < 0 ? dragProgress(-offset.y, cardH()) : 0;
  const progressMag = Math.max(rightProgress, leftProgress, upProgress);
  const rotate = Math.max(
    -MAX_ROTATE,
    Math.min(MAX_ROTATE, offset.x * (MAX_ROTATE / (cardW() * 0.5))),
  );
  const scale = dragging || exiting ? cardScale(progressMag) : 1;
  const shadow = cardShadowBlur(progressMag);

  const behind1 = deck[cursor + 1];
  const behind2 = deck[cursor + 2];

  const zoneScale = (p: number) =>
    p > SWIPE_PREVIEW ? indicatorScale(p) : 0.92;

  const bgTint =
    rightProgress > leftProgress && rightProgress > upProgress
      ? `rgba(255, 224, 51, ${rightProgress * 0.12})`
      : leftProgress > rightProgress && leftProgress > upProgress
        ? `rgba(59, 130, 246, ${leftProgress * 0.1})`
        : upProgress > SWIPE_PREVIEW
          ? `rgba(239, 68, 68, ${upProgress * 0.08})`
          : "white";

  return (
    <div
      className="absolute inset-0 z-[60] flex flex-col transition-colors duration-150"
      style={{ backgroundColor: bgTint }}
    >
      <div className="flex items-center justify-between px-5 pb-3 pt-6">
        <ProgressDots total={initialTotal.current} current={progress} />
        <button
          type="button"
          onClick={onClose}
          className="touch-press flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.06] text-ink-soft"
          aria-label={t("닫기", "Close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-2">
        {!finished && current ? (
          <>
            <div className="relative flex w-full max-w-[340px] flex-1 items-center justify-center">
              {behind2 && (
                <div
                  className="focus-sort-card pointer-events-none absolute w-full scale-[0.9] opacity-25"
                  style={{ transform: "translateY(18px)" }}
                  aria-hidden
                >
                  <div className="px-7 py-6 opacity-80">
                    <p className="line-clamp-2 text-[15px] font-semibold text-ink">
                      {thoughtFirstLine(behind2.text)}
                    </p>
                  </div>
                </div>
              )}
              {behind1 && (
                <div
                  className="focus-sort-card pointer-events-none absolute w-full scale-[0.945] opacity-45"
                  style={{ transform: "translateY(10px)" }}
                  aria-hidden
                >
                  <div className="px-7 py-7 opacity-90">
                    <p className="line-clamp-2 text-[16px] font-semibold text-ink">
                      {thoughtFirstLine(behind1.text)}
                    </p>
                  </div>
                </div>
              )}

              {upProgress > SWIPE_PREVIEW && (
                <div
                  className="pointer-events-none absolute left-1/2 top-2 z-0 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-[12px] font-extrabold text-white shadow-card"
                  style={{
                    opacity: upProgress,
                    transform: `scale(${zoneScale(upProgress)})`,
                  }}
                >
                  <Trash2 size={14} />
                  {t("삭제", "Delete")}
                </div>
              )}
              {rightProgress > SWIPE_PREVIEW && (
                <div
                  className="pointer-events-none absolute right-2 top-1/2 z-0 -translate-y-1/2 rounded-full bg-primary px-3 py-1.5 text-[12px] font-extrabold text-ink shadow-card"
                  style={{
                    opacity: rightProgress,
                    transform: `scale(${zoneScale(rightProgress)})`,
                  }}
                >
                  {t("일정", "Schedule")}
                </div>
              )}
              {leftProgress > SWIPE_PREVIEW && (
                <div
                  className="pointer-events-none absolute left-2 top-1/2 z-0 -translate-y-1/2 rounded-full bg-blue-500 px-3 py-1.5 text-[12px] font-extrabold text-white shadow-card"
                  style={{
                    opacity: leftProgress,
                    transform: `scale(${zoneScale(leftProgress)})`,
                  }}
                >
                  {t("보관", "Archive")}
                </div>
              )}

              <motion.div
                ref={cardRef}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
                className={`focus-sort-card relative z-[1] w-full touch-none select-none px-7 py-8 ${
                  pendingScheduleId === current.id ? "opacity-40" : ""
                }`}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${scale})`,
                  boxShadow: `0 ${shadow}px ${shadow * 1.4}px -${shadow * 0.3}px rgba(0,0,0,${0.08 + progressMag * 0.1})`,
                  transition: dragging || exiting ? "none" : undefined,
                }}
              >
                <DeckCard item={current} />
              </motion.div>
            </div>

            <div className="mt-3 flex w-full max-w-[340px] overflow-hidden rounded-[20px] border border-ink/8">
              <button
                type="button"
                disabled={exiting || !!pendingScheduleId}
                onClick={() => void flyAway("left")}
                className="touch-press flex flex-1 flex-col items-center gap-1 bg-blue-500/10 py-3.5 text-blue-600 transition active:bg-blue-500/20 disabled:opacity-40"
                style={{
                  transform:
                    leftProgress > SWIPE_PREVIEW
                      ? `scale(${zoneScale(leftProgress)})`
                      : undefined,
                }}
              >
                <Archive size={22} strokeWidth={2.2} />
                <span className="text-[11px] font-bold">
                  {t("보관", "Archive")}
                </span>
              </button>
              <button
                type="button"
                disabled={exiting || !!pendingScheduleId}
                onClick={() => void flyAway("right")}
                className="touch-press flex flex-1 flex-col items-center gap-1 border-x border-ink/8 bg-primary/15 py-3.5 text-ink transition active:bg-primary/25 disabled:opacity-40"
                style={{
                  transform:
                    rightProgress > SWIPE_PREVIEW
                      ? `scale(${zoneScale(rightProgress)})`
                      : undefined,
                }}
              >
                <Calendar size={22} strokeWidth={2.2} />
                <span className="text-[11px] font-bold">
                  {t("일정", "Schedule")}
                </span>
              </button>
              <button
                type="button"
                disabled={exiting || !!pendingScheduleId}
                onClick={() => void flyAway("up")}
                className="touch-press flex flex-1 flex-col items-center gap-1 bg-red-500/10 py-3.5 text-red-600 transition active:bg-red-500/20 disabled:opacity-40"
                style={{
                  transform:
                    upProgress > SWIPE_PREVIEW
                      ? `scale(${zoneScale(upProgress)})`
                      : undefined,
                }}
              >
                <Trash2 size={20} strokeWidth={2.2} />
                <span className="text-[11px] font-bold">
                  {t("삭제", "Delete")}
                </span>
              </button>
            </div>
          </>
        ) : (
          <motion.div
            className="px-4 text-center"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...SPRING_DEFAULT, duration: 0.15 }}
          >
            <div className="text-5xl">✨</div>
            <p className="mt-4 text-[18px] font-bold text-ink">
              {t("머리가 가벼워졌어요", "Your mind feels lighter")}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
