import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Archive, Calendar, X } from "lucide-react";
import { animate, motion, AnimatePresence } from "framer-motion";
import { useT } from "@/lib/i18n";
import {
  confirm as confirmHaptic,
  tap as tapHaptic,
  tickDebounced,
  haptic,
} from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";
import {
  SWIPE_PREVIEW,
  dragProgress,
  cardShadowBlur,
  SPRING_SNAP_BACK,
} from "@/lib/motion";
import { MOTION_ARCHIVE, MOTION_SCHEDULE, MOTION_SUCCESS } from "@/lib/motionLanguage";
import { rubberBand, swipeRotation, swipeOpacity } from "@/lib/swipePhysics";
import { BrainMirrorReflectionBody } from "@/components/BrainMirrorReflection";

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
};

type ExitDir = "left" | "right";

const MAX_DRAG_X = 340;
const MAX_DRAG_Y = 140;
const NAV_DRAG = 64;
/** Easier commit than generic SwipeCard (~28% of card width). */
const COMMIT_RATIO = 0.28;
const COMMIT_PX = 88;

function sortNewestFirst(list: InboxItem[]) {
  return [...list].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

function isInteractiveTarget(node: EventTarget | null) {
  return (node as HTMLElement | null)?.closest?.("button,a,input,textarea");
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

function DeckCardBody({ item }: { item: InboxItem }) {
  const t = useT();
  const bm = item.brain_mirror;

  return (
    <>
      {item.images?.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className="h-20 w-20 rounded-[16px] object-cover shadow-card ring-1 ring-ink/8"
            />
          ))}
        </div>
      )}
      <p className="whitespace-pre-wrap text-[22px] font-semibold leading-[1.65] tracking-[-0.025em] text-ink">
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      {bm?.title && bm.items.length > 0 && (
        <div
          className="mt-5 border-t border-ink/[0.07] pt-4"
          role="complementary"
          aria-label={t("다시 이해하기", "Understand again")}
        >
          <BrainMirrorReflectionBody
            result={bm}
            showDateHint={Boolean(bm.suggestedDateText?.trim())}
            dateLabel={bm.suggestedDateText?.trim() || null}
          />
        </div>
      )}
    </>
  );
}

function SwipeStamp({
  side,
  progress,
  label,
}: {
  side: "schedule" | "archive";
  progress: number;
  label: string;
}) {
  if (progress < 0.15) return null;
  const opacity = Math.min(1, (progress - 0.15) * 2.2);
  return (
    <div
      className={`pointer-events-none absolute top-8 z-[2] rounded-xl border-[3px] px-3 py-1.5 text-[14px] font-extrabold uppercase tracking-[0.12em] ${
        side === "schedule"
          ? "right-5 rotate-12 border-primary bg-primary/10 text-primary"
          : "left-5 -rotate-12 border-ink bg-ink/[0.06] text-ink"
      }`}
      style={{ opacity }}
    >
      {label}
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
}: Props) {
  const t = useT();
  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const actingRef = useRef(false);
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
  const progress = current
    ? initialTotal.current - deck.length + cursor + 1
    : initialTotal.current;
  const locked = exiting || actingRef.current || !!pendingScheduleId;

  useEffect(() => {
    if (!open) return;
    const scroll = document.getElementById("phone-scroll");
    const prevOverflow = scroll?.style.overflow ?? "";
    const prevBody = document.body.style.overflow;
    if (scroll) scroll.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (scroll) scroll.style.overflow = prevOverflow;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !dragging) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dragging]);

  useEffect(() => {
    if (!finished) return;
    const id = window.setTimeout(() => onClose(), 2800);
    return () => window.clearTimeout(id);
  }, [finished, onClose]);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const ordered = sortNewestFirst(items);
      initialTotal.current = ordered.length;
      const startIdx = startItemId
        ? Math.max(0, ordered.findIndex((i) => i.id === startItemId))
        : 0;
      setDeck(ordered);
      setCursor(startIdx >= 0 ? startIdx : 0);
      setOffset({ x: 0, y: 0 });
      setCardOpacity(1);
      setExiting(false);
      actingRef.current = false;
      thresholdFired.current = null;
    }
    wasOpen.current = open;
    if (!open) {
      initialTotal.current = 0;
      setDeck([]);
      setCursor(0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
      actingRef.current = false;
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

  const commitThreshold = useCallback(
    () => Math.min(COMMIT_PX, cardW() * COMMIT_RATIO),
    [cardW],
  );

  const springBack = useCallback(() => {
    thresholdFired.current = null;
    previewFired.current = null;
    const from = offsetRef.current;
    animate(from.x, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => {
        setOffset((o) => ({ ...o, x: v }));
        setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
      },
    });
    animate(from.y, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
      onComplete: () => setCardOpacity(1),
    });
  }, []);

  const removeAtCursor = useCallback(() => {
    setDeck((d) => d.filter((_, i) => i !== cursor));
    thresholdFired.current = null;
  }, [cursor]);

  const openSchedule = useCallback(async () => {
    if (!current || actingRef.current) return;
    actingRef.current = true;
    setExiting(true);
    confirmHaptic();
    const w = cardW();
    const from = offsetRef.current;
    await animate(from.x, w * 0.45, {
      ...MOTION_SCHEDULE,
      velocity: velocity.current.x * 0.3,
      onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
    }).finished;
    onScheduleRequest(current);
    setExiting(false);
    actingRef.current = false;
  }, [cardW, current, onScheduleRequest]);

  const flyAwayCommit = useCallback(async () => {
    if (actingRef.current) return;
    actingRef.current = true;
    setExiting(true);
    confirmHaptic();
    const w = cardW();
    const from = offsetRef.current;
    await animate(from.x, w * 1.6, {
      ...MOTION_SCHEDULE,
      velocity: velocity.current.x * 0.4,
      onUpdate: (v) => {
        setOffset((o) => ({ ...o, x: v }));
        setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
      },
    }).finished;
    removeAtCursor();
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
    setExiting(false);
    actingRef.current = false;
  }, [cardW, removeAtCursor]);

  const flyAway = useCallback(
    async (dir: ExitDir) => {
      if (!current || actingRef.current) return;
      if (dir === "right") {
        await openSchedule();
        return;
      }
      actingRef.current = true;
      setExiting(true);
      confirmHaptic();
      const w = cardW();
      const from = offsetRef.current;
      await animate(from.x, -w * 1.6, {
        ...MOTION_ARCHIVE,
        velocity: velocity.current.x * 0.45,
        onUpdate: (v) => {
          setOffset((o) => ({ ...o, x: v }));
          setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
        },
      }).finished;

      const item = current;
      await onArchive(item);
      removeAtCursor();
      setOffset({ x: 0, y: 0 });
      setCardOpacity(1);
      setExiting(false);
      actingRef.current = false;
    },
    [cardW, current, onArchive, openSchedule, removeAtCursor],
  );

  const goNext = useCallback(() => {
    if (cursor >= deck.length - 1) {
      haptic([4, 8]);
      springBack();
      return;
    }
    haptic([6, 14, 6]);
    setCursor((c) => c + 1);
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
  }, [cursor, deck.length, springBack]);

  const goPrev = useCallback(() => {
    if (cursor <= 0) {
      haptic([4, 8]);
      springBack();
      return;
    }
    haptic([6, 14, 6]);
    setCursor((c) => c - 1);
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
  }, [cursor, springBack]);

  const handleScheduleTap = useCallback(() => {
    if (locked) return;
    tapHaptic();
    void flyAway("right");
  }, [flyAway, locked]);

  const handleArchiveTap = useCallback(() => {
    if (locked) return;
    tapHaptic();
    void flyAway("left");
  }, [flyAway, locked]);

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

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || !current) return;
    if (isInteractiveTarget(e.target)) return;
    setDragging(true);
    thresholdFired.current = null;
    previewFired.current = null;
    velocity.current = { x: 0, y: 0 };
    lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const horizontalDir = (x: number, y: number): ExitDir | null => {
    if (Math.abs(x) <= Math.abs(y)) return null;
    return x < 0 ? "left" : "right";
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || locked) return;
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
    const y = rubberBand(rawY, MAX_DRAG_Y);
    setOffset({ x, y });

    const w = cardW();
    const dir = horizontalDir(x, y);
    if (!dir) {
      previewFired.current = null;
      thresholdFired.current = null;
      return;
    }

    const mag = dragProgress(dir === "left" ? -x : x, w * COMMIT_RATIO * 2.2);
    if (mag >= SWIPE_PREVIEW && previewFired.current !== dir) {
      previewFired.current = dir;
      tickDebounced(48);
    }
    if (mag >= 0.85 && thresholdFired.current !== dir) {
      thresholdFired.current = dir;
      haptic([10, 18, 10]);
    }
    if (mag < SWIPE_PREVIEW) previewFired.current = null;
    if (mag < 0.85) thresholdFired.current = null;
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = commitThreshold();
    const { x, y } = offsetRef.current;
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    const vx = velocity.current.x;
    const vy = velocity.current.y;

    if (absX > absY) {
      if (x < 0 && (absX > threshold || vx < -450)) {
        void flyAway("left");
        return;
      }
      if (x > 0 && (absX > threshold || vx > 450)) {
        void flyAway("right");
        return;
      }
    } else {
      if (y > NAV_DRAG || vy > 420) {
        goNext();
        return;
      }
      if (y < -NAV_DRAG || vy < -420) {
        goPrev();
        return;
      }
    }
    springBack();
  };

  const scheduleProgress =
    offset.x > 0 ? Math.min(1, offset.x / commitThreshold()) : 0;
  const archiveProgress =
    offset.x < 0 ? Math.min(1, -offset.x / commitThreshold()) : 0;
  const progressMag = Math.max(scheduleProgress, archiveProgress);
  const rotate = dragging ? swipeRotation(offset.x, cardW()) * 0.65 : 0;
  const shadow = cardShadowBlur(progressMag);
  const stackPeek = deck.slice(cursor + 1, cursor + 3);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col bg-[#faf9f6]/92 backdrop-blur-[20px]"
          role="dialog"
          aria-modal="true"
          aria-label={t("하나씩", "One by one")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !dragging) onClose();
          }}
        >
          <div className="flex items-center justify-end px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                onClose();
              }}
              className="touch-target rounded-full bg-white/90 text-ink-soft shadow-card active:scale-95 active:text-ink transition-transform"
              aria-label={t("닫기", "Close")}
            >
              <X size={20} strokeWidth={2.25} />
            </button>
          </div>

          <div className="px-5 pb-3">
            <ProgressDots total={initialTotal.current} current={progress} />
          </div>

          <div className="relative flex flex-1 flex-col items-center px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
            {!finished && current ? (
              <>
                <div
                  ref={cardRef}
                  className="relative w-full max-w-[340px] min-h-[360px] shrink-0"
                >
                  {stackPeek
                    .slice()
                    .reverse()
                    .map((item, i) => (
                      <div
                        key={item.id}
                        className="focus-sort-card focus-sort-card-stack pointer-events-none absolute inset-x-0 mx-auto w-full px-7 py-6"
                        style={{
                          top: 10 + i * 10,
                          transform: `scale(${0.97 - i * 0.02})`,
                          opacity: 0.38 - i * 0.1,
                          zIndex: 1 + i,
                        }}
                      >
                        <p className="line-clamp-1 text-[14px] font-medium text-ink/45">
                          {item.text}
                        </p>
                      </div>
                    ))}

                  <div
                    key={current.id}
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    className={`focus-sort-card relative z-10 mx-auto flex min-h-[340px] w-full touch-none select-none flex-col overflow-hidden will-change-transform ${
                      pendingScheduleId === current.id
                        ? "ring-2 ring-primary/45 ring-offset-2"
                        : ""
                    }`}
                    style={{
                      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg)`,
                      opacity: cardOpacity,
                      boxShadow: `0 ${shadow}px ${shadow * 1.6}px -${shadow * 0.3}px rgba(0,0,0,${0.08 + progressMag * 0.1})`,
                    }}
                  >
                    <SwipeStamp
                      side="schedule"
                      progress={scheduleProgress}
                      label={t("그때", "When")}
                    />
                    <SwipeStamp
                      side="archive"
                      progress={archiveProgress}
                      label={t("기억함", "Kept")}
                    />

                    <div className="flex-1 px-7 pb-4 pt-8">
                      <DeckCardBody item={current} />
                    </div>

                    <div className="flex shrink-0 gap-2.5 border-t border-ink/[0.06] bg-white px-5 py-4">
                      <button
                        type="button"
                        disabled={locked}
                        onClick={handleScheduleTap}
                        className="touch-press flex-1 rounded-full bg-primary py-3.5 text-[15px] font-bold text-ink shadow-card transition-transform active:scale-[0.97] disabled:opacity-40"
                      >
                        {t("그때", "When")}
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={handleArchiveTap}
                        className="touch-press flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white shadow-card transition-transform active:scale-[0.97] disabled:opacity-40"
                      >
                        {t("기억함", "Kept")}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-center gap-10">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={handleArchiveTap}
                    className="swipe-pill-btn swipe-pill-archive h-14 w-14 transition-transform active:scale-90 disabled:opacity-40"
                    aria-label={t("기억함", "Kept")}
                  >
                    <Archive size={22} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={handleScheduleTap}
                    className="swipe-pill-btn swipe-pill-schedule h-14 w-14 transition-transform active:scale-90 disabled:opacity-40"
                    aria-label={t("그때", "When")}
                  >
                    <Calendar size={22} strokeWidth={2.25} />
                  </button>
                </div>

                <p className="mt-4 text-center text-[11px] font-medium text-ink-soft/70">
                  {t(
                    "← 기억함 · → 그때 · ↓ 다음 · ↑ 이전",
                    "← Kept · → When · ↓ next · ↑ previous",
                  )}
                </p>
              </>
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
                    "오늘은 더 남길 게 없네요",
                    "Nothing left to leave here for now",
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
