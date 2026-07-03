import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Archive, Calendar, Trash2 } from "lucide-react";
import { animate, motion, AnimatePresence } from "framer-motion";
import { useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tickDebounced, haptic } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";
import {
  SWIPE_COMMIT,
  SWIPE_PREVIEW,
  dragProgress,
  cardShadowBlur,
  indicatorScale,
  SPRING_SNAP_BACK,
} from "@/lib/motion";
import {
  MOTION_SUCCESS,
  exitSpring,
} from "@/lib/motionLanguage";
import {
  rubberBand,
  swipeRotation,
  swipeOpacity,
} from "@/lib/swipePhysics";

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

const MAX_DRAG_X = 420;
const MAX_DRAG_Y = 320;

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
        <div className="mb-5 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-24 w-24 rounded-[20px] object-cover shadow-card ring-1 ring-ink/8"
            />
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-[20px] font-semibold leading-[1.72] tracking-[-0.025em] text-ink">
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      {bm?.title && (
        <div className="mt-6 border-t border-dashed border-ink/12 pt-4">
          <p className="text-[15px] font-semibold text-ink/80">{bm.title}</p>
          {bm.items.length > 1 && (
            <ul className="mt-2 space-y-1.5">
              {bm.items.slice(0, 4).map((line) => (
                <li key={line} className="text-[14px] leading-relaxed text-ink/65">
                  · {line}
                </li>
              ))}
            </ul>
          )}
          {interpretive && (
            <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
              {interpretive}
            </p>
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
    <div
      className="flex items-center justify-center gap-1.5"
      aria-label={`${current} / ${total}`}
    >
      {Array.from({ length: max }, (_, i) => {
        const idx =
          total <= max || max === 1
            ? i
            : Math.floor((i / (max - 1)) * (total - 1));
        const active = idx === current - 1;
        const done = idx < current - 1;
        return (
          <motion.span
            key={i}
            layout
            className={`rounded-full ${
              active
                ? "h-2 w-6 bg-ink"
                : done
                  ? "h-1.5 w-1.5 bg-ink/40"
                  : "h-1.5 w-1.5 bg-ink/12"
            }`}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
          />
        );
      })}
    </div>
  );
}

function DestinationZone({
  side,
  progress,
  icon: Icon,
  label,
}: {
  side: "left" | "right" | "top";
  progress: number;
  icon: typeof Archive;
  label: string;
}) {
  const visible = progress > SWIPE_PREVIEW * 0.5;
  const scale = progress > SWIPE_PREVIEW ? indicatorScale(progress) : 0.85;

  const position =
    side === "left"
      ? "left-0 top-0 bottom-0 w-[28%]"
      : side === "right"
        ? "right-0 top-0 bottom-0 w-[28%]"
        : "left-0 right-0 top-0 h-[22%]";

  const bg =
    side === "right"
      ? `rgba(255, 224, 51, ${progress * 0.35})`
      : side === "left"
        ? `rgba(17, 17, 17, ${progress * 0.12})`
        : `rgba(17, 17, 17, ${progress * 0.08})`;

  return (
    <motion.div
      className={`pointer-events-none absolute z-0 flex items-center justify-center ${position}`}
      style={{ background: bg }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className={`flex flex-col items-center gap-2 ${
          side === "right"
            ? "text-ink"
            : side === "left"
              ? "text-ink"
              : "text-ink-soft"
        }`}
        style={{ scale }}
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            side === "right"
              ? "bg-primary shadow-float"
              : side === "left"
                ? "bg-white/90 shadow-card"
                : "bg-white/80 shadow-card"
          }`}
        >
          <Icon size={20} strokeWidth={2.25} />
        </div>
        <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]">
          {label}
        </span>
      </motion.div>
    </motion.div>
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
  const previewFired = useRef<ExitDir | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMove = useRef({ x: 0, y: 0, t: 0 });
  const [deck, setDeck] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [cardOpacity, setCardOpacity] = useState(1);
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
    const id = window.setTimeout(() => onClose(), 2800);
    return () => window.clearTimeout(id);
  }, [finished, onClose]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const ordered = sortOldestFirst(items);
      initialTotal.current = ordered.length;
      const startIdx = startItemId
        ? Math.max(0, ordered.findIndex((i) => i.id === startItemId))
        : 0;
      setDeck(ordered);
      setCursor(startIdx >= 0 ? startIdx : 0);
      setOffset({ x: 0, y: 0 });
      setCardOpacity(1);
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

  const cardW = useCallback(() => cardRef.current?.offsetWidth ?? 320, []);
  const cardH = useCallback(() => cardRef.current?.offsetHeight ?? 360, []);

  const springBack = useCallback(() => {
    thresholdFired.current = null;
    previewFired.current = null;
    const from = offsetRef.current;
    animate(from.x, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        const bandedX = rubberBand(v, MAX_DRAG_X);
        setOffset((o) => ({ ...o, x: bandedX }));
        setCardOpacity(swipeOpacity(Math.abs(bandedX), MAX_DRAG_X));
      },
    });
    animate(from.y, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        const bandedY = v < 0 ? rubberBand(v, MAX_DRAG_Y) : Math.max(0, v * 0.2);
        setOffset((o) => ({ ...o, y: bandedY }));
      },
      onComplete: () => setCardOpacity(1),
    });
  }, []);

  const removeAtCursor = useCallback(() => {
    setDeck((d) => d.filter((_, i) => i !== cursor));
    thresholdFired.current = null;
  }, [cursor]);

  const openSchedule = useCallback(async () => {
    if (!current || exiting) return;
    setExiting(true);
    const w = cardW();
    const spring = exitSpring("right");
    const from = offsetRef.current;
    await animate(from.x, w * 0.55, {
      ...spring,
      velocity: velocity.current.x * 0.3,
      onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
    }).finished;
    onScheduleRequest(current);
    setExiting(false);
  }, [cardW, current, exiting, onScheduleRequest]);

  const flyAwayCommit = useCallback(async () => {
    if (exiting) return;
    setExiting(true);
    const w = cardW();
    const spring = exitSpring("right");
    const from = offsetRef.current;
      await Promise.all([
        animate(from.x, w * 1.8, {
          ...spring,
          velocity: velocity.current.x * 0.4,
          onUpdate: (v) => {
            setOffset((o) => ({ ...o, x: v }));
            setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
          },
        }).finished,
      ]);
      setCardOpacity(0);
    removeAtCursor();
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
    setExiting(false);
  }, [cardW, exiting, removeAtCursor]);

  const flyAway = useCallback(
    async (dir: ExitDir) => {
      if (!current || exiting) return;
      if (dir === "right") {
        await openSchedule();
        return;
      }
      setExiting(true);
      const w = cardW();
      const h = cardH();
      const spring = exitSpring(dir);
      const from = offsetRef.current;
      const targetX = dir === "left" ? -w * 1.8 : from.x;
      const targetY = dir === "up" ? -h * 1.5 : Math.min(from.y, 40);

      await Promise.all([
        animate(from.x, targetX, {
          ...spring,
          velocity: velocity.current.x * 0.45,
          onUpdate: (v) => {
            setOffset((o) => ({ ...o, x: v }));
            setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
          },
        }).finished,
        animate(from.y, targetY, {
          ...spring,
          velocity: velocity.current.y * 0.35,
          onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
        }).finished,
      ]);
      if (dir === "up") setCardOpacity(0);

      const item = current;
      if (dir === "left") await onArchive(item);
      else await onSoftDelete?.(item);

      removeAtCursor();
      setOffset({ x: 0, y: 0 });
      setCardOpacity(1);
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

  const onDown = (e: PointerEvent) => {
    if (exiting || !current || pendingScheduleId) return;
    setDragging(true);
    thresholdFired.current = null;
    previewFired.current = null;
    velocity.current = { x: 0, y: 0 };
    lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const activeDir = (x: number, y: number): ExitDir | null => {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (absY > absX && y < 0) return "up";
    if (absX > absY && x > 0) return "right";
    if (absX > absY && x < 0) return "left";
    return null;
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || exiting) return;
    const now = performance.now();
    const dt = Math.max(1, now - lastMove.current.t);
    velocity.current = {
      x: (e.clientX - lastMove.current.x) / dt,
      y: (e.clientY - lastMove.current.y) / dt,
    };
    lastMove.current = { x: e.clientX, y: e.clientY, t: now };

    const rawX = e.clientX - start.current.x;
    const rawY = e.clientY - start.current.y;
    const x = rubberBand(rawX, MAX_DRAG_X);
    const y = rawY < 0 ? rubberBand(rawY, MAX_DRAG_Y) : rawY * 0.15;
    setOffset({ x, y });
    setCardOpacity(swipeOpacity(Math.abs(x), MAX_DRAG_X));

    const w = cardW();
    const h = cardH();
    const dir = activeDir(x, y);
    if (!dir) {
      previewFired.current = null;
      thresholdFired.current = null;
      return;
    }

    const mag =
      dir === "up"
        ? dragProgress(-y, h)
        : dragProgress(dir === "right" ? x : -x, w);

    if (mag >= SWIPE_PREVIEW && previewFired.current !== dir) {
      previewFired.current = dir;
      tickDebounced();
    }
    if (mag >= SWIPE_COMMIT && thresholdFired.current !== dir) {
      thresholdFired.current = dir;
      haptic([8, 16, 8]);
    }
    if (mag < SWIPE_PREVIEW) previewFired.current = null;
    if (mag < SWIPE_COMMIT) thresholdFired.current = null;
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const w = cardW();
    const h = cardH();
    const { x, y } = offsetRef.current;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const vx = velocity.current.x;

    if (
      absY > absX &&
      y < 0 &&
      (absY > h * SWIPE_COMMIT || velocity.current.y < -800)
    ) {
      confirmHaptic();
      void flyAway("up");
      return;
    }
    if (x > 0 && (x > w * SWIPE_COMMIT || vx > 600)) {
      confirmHaptic();
      void flyAway("right");
      return;
    }
    if (x < 0 && (absX > w * SWIPE_COMMIT || vx < -600)) {
      confirmHaptic();
      void flyAway("left");
      return;
    }
    springBack();
  };

  const rightProgress = offset.x > 0 ? dragProgress(offset.x, cardW()) : 0;
  const leftProgress = offset.x < 0 ? dragProgress(-offset.x, cardW()) : 0;
  const upProgress = offset.y < 0 ? dragProgress(-offset.y, cardH()) : 0;
  const progressMag = Math.max(rightProgress, leftProgress, upProgress);
  const rotate = swipeRotation(offset.x, cardW());
  const scale = dragging || exiting ? 1 + progressMag * 0.04 : 1;
  const shadow = cardShadowBlur(progressMag);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="absolute inset-0 z-[60] flex flex-col bg-white/78 backdrop-blur-[28px] backdrop-saturate-[1.4]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !dragging) onClose();
          }}
        >
          <div className="flex justify-center px-5 pb-2 pt-[max(1.25rem,env(safe-area-inset-top))]">
            <ProgressDots total={initialTotal.current} current={progress} />
          </div>

          <div className="relative flex flex-1 items-center justify-center px-8 pb-10">
            {!finished && current ? (
              <div className="relative flex h-full w-full max-w-[360px] items-center justify-center">
                <DestinationZone
                  side="left"
                  progress={leftProgress}
                  icon={Archive}
                  label={t("보관", "Archive")}
                />
                <DestinationZone
                  side="right"
                  progress={rightProgress}
                  icon={Calendar}
                  label={t("일정", "Schedule")}
                />
                <DestinationZone
                  side="top"
                  progress={upProgress}
                  icon={Trash2}
                  label={t("삭제", "Delete")}
                />

                <motion.div
                  ref={cardRef}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                  className={`focus-sort-card relative z-[1] w-full touch-none select-none px-9 py-10 will-change-transform ${
                    pendingScheduleId === current.id
                      ? "ring-2 ring-primary/35 ring-offset-4 ring-offset-transparent"
                      : ""
                  }`}
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${scale})`,
                    opacity: cardOpacity,
                    boxShadow: `0 ${shadow}px ${shadow * 1.5}px -${shadow * 0.35}px rgba(0,0,0,${0.07 + progressMag * 0.12})`,
                    transition: dragging || exiting ? "none" : undefined,
                  }}
                >
                  <DeckCard item={current} />
                </motion.div>
              </div>
            ) : (
              <motion.div
                className="max-w-[300px] px-6 text-center"
                initial={{ opacity: 0, scale: 0.94, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={MOTION_SUCCESS}
              >
                <motion.div
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={MOTION_SUCCESS}
                >
                  <span className="text-2xl" aria-hidden>
                    ✨
                  </span>
                </motion.div>
                <p className="mt-6 text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {t("머리가 가벼워졌어요", "Your mind feels lighter")}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {t(
                    "오늘은 더 버릴 생각이 없네요",
                    "Nothing left to sort for now",
                  )}
                </p>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
