import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Archive, CalendarClock, Clock, X } from "lucide-react";
import { animate, motion, AnimatePresence } from "framer-motion";
import { useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import {
  confirm as confirmHaptic,
  tap as tapHaptic,
  tickDebounced,
  haptic,
} from "@/lib/haptics";
import type { DecisionOutcome, DecisionSource, InboxItem } from "@/lib/store";
import {
  dragProgressForOutcome,
  previewDragOutcome,
  resolveDragOutcome,
} from "@/lib/decision";
import {
  SWIPE_PREVIEW,
  cardShadowBlur,
  SPRING_SNAP_BACK,
} from "@/lib/motion";
import { MOTION_ARCHIVE, MOTION_SCHEDULE, MOTION_SUCCESS } from "@/lib/motionLanguage";
import { rubberBand, swipeRotation, swipeOpacity } from "@/lib/swipePhysics";
import { BrainMirrorReflectionBody } from "@/components/BrainMirrorReflection";

export type DecisionMeta = {
  source: DecisionSource;
  position: number;
  total: number;
};

export type DecisionResult = {
  scheduleId?: string;
  archiveId?: string;
};

export type UndoSnapshot = {
  item: InboxItem;
  cursor: number;
  outcome: DecisionOutcome;
  scheduleId?: string;
  archiveId?: string;
};

type SessionCounts = Record<DecisionOutcome, number>;

type Props = {
  open: boolean;
  items: InboxItem[];
  startItemId?: string | null;
  onClose: () => void;
  onDecide: (
    outcome: DecisionOutcome,
    item: InboxItem,
    meta: DecisionMeta,
  ) => Promise<DecisionResult | void>;
  onUndo: (snapshot: UndoSnapshot) => Promise<void>;
};

const MAX_DRAG_X = 340;
const MAX_DRAG_Y = 140;
const NAV_DRAG = 64;
const FLING_VX = 450;
const FLING_VY = 420;

const EMPTY_COUNTS: SessionCounts = { today: 0, later: 0, archive: 0 };

function sortNewestFirst(list: InboxItem[]) {
  return [...list].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

function isInteractiveTarget(node: EventTarget | null) {
  return (node as HTMLElement | null)?.closest?.("button,a,input,textarea");
}

function outcomeLabel(outcome: DecisionOutcome, t: ReturnType<typeof useT>) {
  if (outcome === "today") return t("오늘", "Today");
  if (outcome === "later") return t("나중", "Later");
  return t("보관", "Archive");
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

function OutcomeStamp({
  outcome,
  progress,
  label,
}: {
  outcome: DecisionOutcome;
  progress: number;
  label: string;
}) {
  if (progress < 0.12) return null;
  const opacity = Math.min(1, (progress - 0.12) * 2.4);
  const isLeft = outcome === "today";
  return (
    <div
      data-testid="decision-outcome-label"
      data-outcome={outcome}
      className={`pointer-events-none absolute top-8 z-[2] rounded-xl border-2 px-3 py-1.5 text-[14px] font-extrabold tracking-[0.08em] ${
        isLeft
          ? "left-5 -rotate-12 border-ink/25 bg-white/80 text-ink"
          : outcome === "later"
            ? "right-5 rotate-6 border-ink/20 bg-white/80 text-ink-soft"
            : "right-5 rotate-12 border-ink/30 bg-ink/[0.05] text-ink"
      }`}
      style={{ opacity }}
    >
      {label}
    </div>
  );
}

export function DecisionDeck({
  open,
  items,
  startItemId,
  onClose,
  onDecide,
  onUndo,
}: Props) {
  const t = useT();
  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const actingRef = useRef(false);
  const previewFired = useRef<DecisionOutcome | null>(null);
  const thresholdFired = useRef<DecisionOutcome | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMove = useRef({ x: 0, y: 0, t: 0 });
  const start = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });

  const [deck, setDeck] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [sessionCounts, setSessionCounts] = useState<SessionCounts>(EMPTY_COUNTS);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);

  offsetRef.current = offset;

  const current = deck[cursor] ?? null;
  const decidedCount =
    sessionCounts.today + sessionCounts.later + sessionCounts.archive;
  const finished =
    open && initialTotal.current > 0 && deck.length === 0 && decidedCount > 0;
  const progress = current
    ? initialTotal.current - deck.length + cursor + 1
    : initialTotal.current;
  const locked = exiting || actingRef.current;

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
      setSessionCounts(EMPTY_COUNTS);
      setUndoSnapshot(null);
      previewFired.current = null;
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
      setSessionCounts(EMPTY_COUNTS);
      setUndoSnapshot(null);
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

  const springBack = useCallback(() => {
    previewFired.current = null;
    thresholdFired.current = null;
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
    previewFired.current = null;
    thresholdFired.current = null;
  }, [cursor]);

  const flyOffsetFor = (outcome: DecisionOutcome, w: number) => {
    if (outcome === "today") return -w * 1.6;
    if (outcome === "later") return w * 0.95;
    return w * 1.6;
  };

  const applyDecision = useCallback(
    async (outcome: DecisionOutcome, source: DecisionSource) => {
      if (!current || actingRef.current || locked) return;
      actingRef.current = true;
      setExiting(true);
      confirmHaptic();

      const snapshot: UndoSnapshot = {
        item: { ...current },
        cursor,
        outcome,
      };

      const w = cardW();
      const from = offsetRef.current;
      const targetX = flyOffsetFor(outcome, w);
      const motion =
        outcome === "archive" ? MOTION_ARCHIVE : MOTION_SCHEDULE;

      await animate(from.x, targetX, {
        ...motion,
        velocity: velocity.current.x * 0.4,
        onUpdate: (v) => {
          setOffset((o) => ({ ...o, x: v }));
          setCardOpacity(swipeOpacity(Math.abs(v), MAX_DRAG_X));
        },
      }).finished;

      try {
        const meta: DecisionMeta = {
          source,
          position: progress,
          total: initialTotal.current,
        };
        track(`decision_${outcome}`, {
          item_id: current.id,
          source,
          position: progress,
          total: initialTotal.current,
        });
        const result = await onDecide(outcome, current, meta);
        if (result?.scheduleId) snapshot.scheduleId = result.scheduleId;
        if (result?.archiveId) snapshot.archiveId = result.archiveId;
        setUndoSnapshot(snapshot);
        setSessionCounts((c) => ({ ...c, [outcome]: c[outcome] + 1 }));
        removeAtCursor();
      } catch {
        springBack();
      } finally {
        setOffset({ x: 0, y: 0 });
        setCardOpacity(1);
        setExiting(false);
        actingRef.current = false;
      }
    },
    [
      cardW,
      current,
      cursor,
      locked,
      onDecide,
      progress,
      removeAtCursor,
      springBack,
    ],
  );

  const handleUndo = useCallback(async () => {
    if (!undoSnapshot || actingRef.current) return;
    actingRef.current = true;
    tapHaptic();
    try {
      await onUndo(undoSnapshot);
      setDeck((d) => {
        const next = [...d];
        next.splice(undoSnapshot.cursor, 0, undoSnapshot.item);
        return next;
      });
      setCursor(undoSnapshot.cursor);
      setSessionCounts((c) => ({
        ...c,
        [undoSnapshot.outcome]: Math.max(0, c[undoSnapshot.outcome] - 1),
      }));
      setUndoSnapshot(null);
      setOffset({ x: 0, y: 0 });
      setCardOpacity(1);
    } finally {
      actingRef.current = false;
    }
  }, [onUndo, undoSnapshot]);

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

  const commitFromRelease = useCallback(
    (x: number, y: number, vx: number, vy: number) => {
      const w = cardW();
      const absX = Math.abs(x);
      const absY = Math.abs(y);

      if (absX <= absY) {
        if (y > NAV_DRAG || vy > FLING_VY) {
          goNext();
          return true;
        }
        if (y < -NAV_DRAG || vy < -FLING_VY) {
          goPrev();
          return true;
        }
        return false;
      }

      const outcome = resolveDragOutcome(x, w);
      if (!outcome) return false;

      const committed =
        (outcome === "today" &&
          (x <= -w * 0.25 || vx < -FLING_VX || absX >= w * 0.25)) ||
        (outcome === "later" &&
          x >= w * 0.25 &&
          x < w * 0.65 &&
          (absX >= w * 0.25 || vx > FLING_VX * 0.7)) ||
        (outcome === "archive" &&
          (x >= w * 0.65 || vx > FLING_VX || absX >= w * 0.65));

      if (committed) {
        void applyDecision(outcome, "swipe");
        return true;
      }
      return false;
    },
    [applyDecision, cardW, goNext, goPrev],
  );

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || !current) return;
    if (isInteractiveTarget(e.target)) return;
    setDragging(true);
    previewFired.current = null;
    thresholdFired.current = null;
    velocity.current = { x: 0, y: 0 };
    lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
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
    const preview = previewDragOutcome(x, y, w);
    if (!preview) {
      previewFired.current = null;
      thresholdFired.current = null;
      return;
    }

    const mag = dragProgressForOutcome(x, preview, w);
    if (mag >= SWIPE_PREVIEW && previewFired.current !== preview) {
      previewFired.current = preview;
      tickDebounced(48);
    }
    if (mag >= 0.92 && thresholdFired.current !== preview) {
      thresholdFired.current = preview;
      haptic([10, 18, 10]);
    }
    if (mag < SWIPE_PREVIEW) previewFired.current = null;
    if (mag < 0.92) thresholdFired.current = null;
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const { x, y } = offsetRef.current;
    if (!commitFromRelease(x, y, velocity.current.x, velocity.current.y)) {
      springBack();
    }
  };

  const previewOutcome = previewDragOutcome(offset.x, offset.y, cardW());
  const previewProgress = previewOutcome
    ? dragProgressForOutcome(offset.x, previewOutcome, cardW())
    : 0;
  const rotate = dragging ? swipeRotation(offset.x, cardW()) * 0.65 : 0;
  const scale = dragging ? 1 - previewProgress * 0.025 : 1;
  const shadow = cardShadowBlur(previewProgress);
  const stackPeek = deck.slice(cursor + 1, cursor + 3);

  const actionBtn =
    "touch-press flex h-11 min-w-[5.5rem] flex-1 items-center justify-center gap-1.5 rounded-full border border-ink/10 bg-white/90 text-[13px] font-bold text-ink shadow-card transition-transform active:scale-[0.97] disabled:opacity-40";

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
                    data-testid="decision-deck-active-card"
                    onPointerDown={onDown}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                    className="focus-sort-card relative z-10 mx-auto flex min-h-[340px] w-full touch-none select-none flex-col overflow-hidden will-change-transform"
                    style={{
                      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${scale})`,
                      opacity: cardOpacity,
                      boxShadow: `0 ${shadow}px ${shadow * 1.6}px -${shadow * 0.3}px rgba(0,0,0,${0.08 + previewProgress * 0.1})`,
                    }}
                  >
                    {previewOutcome && (
                      <OutcomeStamp
                        outcome={previewOutcome}
                        progress={previewProgress}
                        label={outcomeLabel(previewOutcome, t)}
                      />
                    )}

                    <div className="flex-1 px-7 pb-4 pt-8">
                      <DeckCardBody item={current} />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex w-full max-w-[340px] gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-today"
                    aria-label={t("오늘로 결정", "Decide for today")}
                    className={actionBtn}
                    onClick={() => void applyDecision("today", "button")}
                  >
                    <CalendarClock size={16} strokeWidth={2.25} />
                    {t("오늘", "Today")}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-later"
                    aria-label={t("나중으로 결정", "Decide for later")}
                    className={actionBtn}
                    onClick={() => void applyDecision("later", "button")}
                  >
                    <Clock size={16} strokeWidth={2.25} />
                    {t("나중", "Later")}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-archive"
                    aria-label={t("보관함으로 보관", "Archive thought")}
                    className={actionBtn}
                    onClick={() => void applyDecision("archive", "button")}
                  >
                    <Archive size={16} strokeWidth={2.25} />
                    {t("보관", "Archive")}
                  </button>
                </div>

                <p className="mt-4 text-center text-[11px] font-medium text-ink-soft/70">
                  {t(
                    "← 오늘 · → 나중 · →→ 보관 · ↓ 다음 · ↑ 이전",
                    "← Today · → Later · →→ Archive · ↓ next · ↑ previous",
                  )}
                </p>
              </>
            ) : (
              <motion.div
                data-testid="decision-deck-complete"
                className="max-w-[320px] px-6 text-center"
                initial={{ opacity: 0, scale: 0.96, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={MOTION_SUCCESS}
              >
                <p className="text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {t("정리 끝", "All sorted")}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {t(
                    `${decidedCount}개의 생각을 결정했어요`,
                    `You decided ${decidedCount} thoughts`,
                  )}
                </p>
                <dl className="mt-6 space-y-2 text-left text-[14px] text-ink">
                  <div className="flex justify-between gap-4">
                    <dt>{t("오늘", "Today")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {sessionCounts.today}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{t("나중", "Later")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {sessionCounts.later}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>{t("보관", "Archive")}</dt>
                    <dd className="font-semibold tabular-nums">
                      {sessionCounts.archive}
                    </dd>
                  </div>
                </dl>
              </motion.div>
            )}

            {undoSnapshot && (
              <button
                type="button"
                data-testid="decision-undo"
                disabled={locked}
                onClick={() => void handleUndo()}
                className="mt-4 text-[13px] font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
              >
                {t("마지막 결정 되돌리기", "Undo last decision")}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
