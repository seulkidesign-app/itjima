import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Archive, CalendarClock, Hand, X } from "lucide-react";
import { animate, motion, AnimatePresence } from "framer-motion";
import { useLang, useT } from "@/lib/i18n";
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
  resolveDragAxis,
  shouldCommitDrag,
  type DragAxis,
} from "@/lib/decision";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { SPRING_SNAP_BACK } from "@/lib/motion";
import { MOTION_ARCHIVE, MOTION_SCHEDULE, MOTION_SUCCESS } from "@/lib/motionLanguage";
import {
  SWIPE_DRAG_START_PX,
  SWIPE_EDGE_EXCLUSION_PX,
  SWIPE_KEEP_RATIO,
  SWIPE_MAX_DRAG_X,
  SWIPE_MAX_DRAG_Y,
  SWIPE_MAX_ROTATE,
  SWIPE_PREVIEW_PROGRESS,
  SWIPE_THRESHOLD_PROGRESS,
  STACK_OFFSET_Y,
  STACK_OPACITY,
  STACK_SCALE,
} from "@/lib/swipeInteraction";
import { rubberBand, swipeOpacity } from "@/lib/swipePhysics";
import {
  trackSwipeCardShown,
  trackSwipeCancelled,
  trackSwipeCommitted,
  trackSwipeSessionCompleted,
  trackSwipeSessionStarted,
  trackSwipeStarted,
  trackSwipeTutorialShown,
  trackSwipeUndoUsed,
} from "@/lib/swipeAnalytics";
import { track } from "@/lib/analytics";
import {
  isSwipeTutorialDone,
  markSwipeTutorialDone,
} from "@/lib/swipeTutorial";
import { showUndoToast } from "@/lib/undoToast";
import { DeckCardContent } from "@/components/DeckCardContent";
import { SwipeTutorial } from "@/components/SwipeTutorial";

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
  source: DecisionSource;
  position: number;
  total: number;
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
  onCapture?: () => void;
};

const EMPTY_COUNTS: SessionCounts = { today: 0, later: 0, archive: 0 };

function sortNewestFirst(list: InboxItem[]) {
  return [...list].sort(
    (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
  );
}

function isInteractiveTarget(node: EventTarget | null) {
  return (node as HTMLElement | null)?.closest?.(
    "button,a,input,textarea,[data-no-drag]",
  );
}

function outcomeSwipeLabel(outcome: DecisionOutcome, t: ReturnType<typeof useT>) {
  if (outcome === "today") return t("일정으로", "To schedule");
  if (outcome === "archive") return t("보관함으로", "To vault");
  return t("지금은 그대로", "Keep here");
}

function toastForOutcome(outcome: DecisionOutcome, t: ReturnType<typeof useT>) {
  if (outcome === "today") return t("일정으로 보냈어요", "Moved to schedule");
  if (outcome === "archive") return t("보관함에 넣었어요", "Saved to vault");
  return t("그대로 두었어요", "Kept here");
}

function directionForOutcome(outcome: DecisionOutcome): "right" | "left" | "down" {
  if (outcome === "today") return "right";
  if (outcome === "archive") return "left";
  return "down";
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
          <span
            key={i}
            className={`rounded-full transition-all duration-200 ${
              active
                ? "h-2 w-6 bg-ink"
                : done
                  ? "h-1.5 w-1.5 bg-ink/40"
                  : "h-1.5 w-1.5 bg-ink/12"
            }`}
          />
        );
      })}
    </div>
  );
}

function OutcomeAffordance({
  outcome,
  progress,
  label,
  reducedMotion,
}: {
  outcome: DecisionOutcome;
  progress: number;
  label: string;
  reducedMotion: boolean;
}) {
  if (progress < SWIPE_PREVIEW_PROGRESS) return null;
  const opacity = Math.min(1, (progress - SWIPE_PREVIEW_PROGRESS) * 2.2);
  const scale = reducedMotion ? 1 : 1 + progress * 0.08;

  const pos =
    outcome === "today"
      ? "right-5 top-1/2 -translate-y-1/2"
      : outcome === "archive"
        ? "left-5 top-1/2 -translate-y-1/2"
        : "bottom-6 left-1/2 -translate-x-1/2";

  const Icon =
    outcome === "today"
      ? CalendarClock
      : outcome === "archive"
        ? Archive
        : Hand;

  return (
    <div
      data-testid="decision-outcome-label"
      data-outcome={outcome}
      className={`pointer-events-none absolute z-[2] flex flex-col items-center gap-1 ${pos}`}
      style={{ opacity }}
    >
      <Icon
        size={22}
        strokeWidth={2}
        className="text-ink/70"
        style={{ transform: `scale(${scale})` }}
        aria-hidden
      />
      <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink shadow-card">
        {label}
      </span>
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
  onCapture,
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const uiLang = lang === "en" ? "en" : "ko";
  const reducedMotion = useRef(false);

  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const sessionStartedAt = useRef<number | null>(null);
  const completionTrackedRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const actingRef = useRef(false);
  const previewFired = useRef<DecisionOutcome | null>(null);
  const thresholdFired = useRef<DecisionOutcome | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMove = useRef({ x: 0, y: 0, t: 0 });
  const start = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragAxisRef = useRef<DragAxis>(null);
  const pointerActive = useRef(false);
  const cardShownRef = useRef<string | null>(null);
  const snapAnimRef = useRef<{ stop: () => void }[]>([]);

  const stopSnapAnimations = useCallback(() => {
    for (const anim of snapAnimRef.current) anim.stop();
    snapAnimRef.current = [];
  }, []);

  const [deck, setDeck] = useState<InboxItem[]>([]);
  const [cursor, setCursor] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragAxis, setDragAxis] = useState<DragAxis>(null);
  const [exiting, setExiting] = useState(false);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [sessionCounts, setSessionCounts] = useState<SessionCounts>(EMPTY_COUNTS);
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");

  offsetRef.current = offset;
  dragAxisRef.current = dragAxis;

  const current = deck[cursor] ?? null;
  const decidedCount =
    sessionCounts.today + sessionCounts.later + sessionCounts.archive;
  const isEmpty = open && initialTotal.current === 0;
  const finished =
    open && initialTotal.current > 0 && deck.length === 0 && decidedCount > 0;
  const progress = current
    ? initialTotal.current - deck.length + cursor + 1
    : initialTotal.current;
  const locked = exiting || actingRef.current;

  useEffect(() => {
    reducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

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
      if (locked || !current) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        void applyDecision("today", "keyboard");
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        void applyDecision("archive", "keyboard");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        void applyDecision("later", "keyboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      sessionStartedAt.current = Date.now();
      completionTrackedRef.current = false;
      cardShownRef.current = null;
      if (ordered.length > 0) {
        trackSwipeSessionStarted(ordered.length);
        const tutorial = !isSwipeTutorialDone();
        setShowTutorial(tutorial);
        if (tutorial) trackSwipeTutorialShown();
      } else {
        setShowTutorial(false);
      }
    }
    wasOpen.current = open;
    if (!open) {
      initialTotal.current = 0;
      sessionStartedAt.current = null;
      completionTrackedRef.current = false;
      setDeck([]);
      setCursor(0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
      actingRef.current = false;
      setSessionCounts(EMPTY_COUNTS);
      setUndoSnapshot(null);
      setShowTutorial(false);
      cardShownRef.current = null;
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

  useEffect(() => {
    if (!current || cardShownRef.current === current.id) return;
    cardShownRef.current = current.id;
    const nl = understandNaturalLanguage(current.text, uiLang);
    trackSwipeCardShown({
      predictedIntent: nl.intent,
      hasBrainMirror: nl.confidence !== "low" && nl.intent !== "keep",
    });
  }, [current, uiLang]);

  useEffect(() => {
    if (!finished || completionTrackedRef.current) return;
    completionTrackedRef.current = true;
    const durationMs = Math.max(
      0,
      Date.now() - (sessionStartedAt.current ?? Date.now()),
    );
    trackSwipeSessionCompleted({
      scheduledCount: sessionCounts.today,
      archivedCount: sessionCounts.archive,
      keptCount: sessionCounts.later,
      durationMs,
    });
    track("decision_completed", {
      total: decidedCount,
      today_count: sessionCounts.today,
      later_count: sessionCounts.later,
      archive_count: sessionCounts.archive,
      duration_ms: durationMs,
    });
  }, [finished, decidedCount, sessionCounts]);

  const cardW = useCallback(() => cardRef.current?.offsetWidth ?? 320, []);
  const cardH = useCallback(() => cardRef.current?.offsetHeight ?? 360, []);

  const springBack = useCallback(() => {
    stopSnapAnimations();
    previewFired.current = null;
    thresholdFired.current = null;
    setDragAxis(null);
    dragAxisRef.current = null;
    const from = offsetRef.current;
    snapAnimRef.current.push(
      animate(from.x, 0, {
        ...SPRING_SNAP_BACK,
        onUpdate: (v) => {
          setOffset((o) => ({ ...o, x: v }));
          setCardOpacity(swipeOpacity(Math.abs(v), SWIPE_MAX_DRAG_X));
        },
      }),
    );
    snapAnimRef.current.push(
      animate(from.y, 0, {
        ...SPRING_SNAP_BACK,
        onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
        onComplete: () => setCardOpacity(1),
      }),
    );
  }, [stopSnapAnimations]);

  const removeAtCursor = useCallback(() => {
    setDeck((d) => d.filter((_, i) => i !== cursor));
    previewFired.current = null;
    thresholdFired.current = null;
    setDragAxis(null);
  }, [cursor]);

  const flyTarget = (outcome: DecisionOutcome, w: number, h: number) => {
    if (outcome === "today") return { x: w * 1.5, y: 0 };
    if (outcome === "archive") return { x: -w * 1.5, y: 0 };
    return { x: 0, y: h * 0.85 };
  };

  const applyDecision = useCallback(
    async (outcome: DecisionOutcome, source: DecisionSource | "keyboard") => {
      if (!current || actingRef.current || locked) return;
      actingRef.current = true;
      setExiting(true);
      confirmHaptic();

      const inputMethod =
        source === "swipe"
          ? "gesture"
          : source === "keyboard"
            ? "keyboard"
            : "button";

      const snapshot: UndoSnapshot = {
        item: { ...current },
        cursor,
        outcome,
        source: source === "keyboard" ? "button" : source,
        position: progress,
        total: initialTotal.current,
      };

      const w = cardW();
      const h = cardH();
      const from = offsetRef.current;
      const target = flyTarget(outcome, w, h);
      const motion =
        outcome === "archive" ? MOTION_ARCHIVE : MOTION_SCHEDULE;

      await animate(from.x, target.x, {
        ...motion,
        velocity: velocity.current.x * 0.35,
        onUpdate: (v) => {
          setOffset((o) => ({ ...o, x: v }));
          setCardOpacity(swipeOpacity(Math.abs(v), SWIPE_MAX_DRAG_X));
        },
      }).finished;
      await animate(from.y, target.y, {
        ...motion,
        velocity: velocity.current.y * 0.35,
        onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
      }).finished;

      try {
        const meta: DecisionMeta = {
          source: source === "keyboard" ? "button" : source,
          position: progress,
          total: initialTotal.current,
        };
        trackSwipeCommitted(outcome, inputMethod);
        track(`decision_${outcome}`, {
          item_id: current.id,
          source: meta.source,
          position: progress,
          total: initialTotal.current,
        });
        const result = await onDecide(outcome, current, meta);
        if (result?.scheduleId) snapshot.scheduleId = result.scheduleId;
        if (result?.archiveId) snapshot.archiveId = result.archiveId;
        setUndoSnapshot(snapshot);
        setSessionCounts((c) => ({ ...c, [outcome]: c[outcome] + 1 }));
        removeAtCursor();

        const msg = toastForOutcome(outcome, t);
        setLiveMessage(msg);
        showUndoToast(msg, () => void handleUndoRef.current?.(), {
          undoLabel: t("되돌리기", "Undo"),
        });
      } catch {
        springBack();
      } finally {
        setOffset({ x: 0, y: 0 });
        setCardOpacity(1);
        setExiting(false);
        actingRef.current = false;
        setDragAxis(null);
      }
    },
    [cardH, cardW, current, cursor, locked, onDecide, progress, removeAtCursor, springBack, t],
  );

  const handleUndoRef = useRef<(() => Promise<void>) | null>(null);

  const handleUndo = useCallback(async () => {
    if (!undoSnapshot || actingRef.current) return;
    actingRef.current = true;
    tapHaptic();
    try {
      trackSwipeUndoUsed(undoSnapshot.outcome);
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
      setLiveMessage(t("방금 결정을 되돌렸어요", "Restored your last decision"));
    } finally {
      actingRef.current = false;
    }
  }, [onUndo, t, undoSnapshot]);

  handleUndoRef.current = handleUndo;

  const commitFromRelease = useCallback(
    (x: number, y: number, vx: number, vy: number, axis: DragAxis) => {
      const w = cardW();
      const h = cardH();
      const outcome = shouldCommitDrag(x, y, vx, vy, w, h, axis);
      if (outcome) {
        void applyDecision(outcome, "swipe");
        return true;
      }
      return false;
    },
    [applyDecision, cardH, cardW],
  );

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || !current) return;
    if (isInteractiveTarget(e.target)) return;
    const edgeX = e.clientX;
    const vw = typeof window !== "undefined" ? window.innerWidth : 400;
    if (
      edgeX < SWIPE_EDGE_EXCLUSION_PX ||
      edgeX > vw - SWIPE_EDGE_EXCLUSION_PX
    ) {
      return;
    }
    pointerActive.current = true;
    stopSnapAnimations();
    setDragging(false);
    previewFired.current = null;
    thresholdFired.current = null;
    velocity.current = { x: 0, y: 0 };
    lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    start.current = { x: e.clientX, y: e.clientY };
    setDragAxis(null);
    dragAxisRef.current = null;
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!pointerActive.current || locked) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (
      !dragging &&
      Math.abs(dx) < SWIPE_DRAG_START_PX &&
      Math.abs(dy) < SWIPE_DRAG_START_PX
    ) {
      return;
    }
    if (!dragging) {
      setDragging(true);
      if (showTutorial) {
        setShowTutorial(false);
        markSwipeTutorialDone();
      }
    }

    const now = performance.now();
    const dt = Math.max(1, now - lastMove.current.t);
    velocity.current = {
      x: (e.clientX - lastMove.current.x) / dt,
      y: (e.clientY - lastMove.current.y) / dt,
    };
    lastMove.current = { x: e.clientX, y: e.clientY, t: now };

    const axis = resolveDragAxis(dx, dy, dragAxisRef.current);
    if (axis && axis !== dragAxisRef.current) {
      setDragAxis(axis);
      dragAxisRef.current = axis;
    }

    const rawX = axis === "vertical" ? 0 : dx;
    const rawY = axis === "horizontal" ? 0 : dy;
    const x = rubberBand(rawX, SWIPE_MAX_DRAG_X);
    const y = rubberBand(rawY, SWIPE_MAX_DRAG_Y);
    setOffset({ x, y });

    const w = cardW();
    const h = cardH();
    const preview = previewDragOutcome(x, y, w, h, dragAxisRef.current);
    if (!preview) {
      previewFired.current = null;
      thresholdFired.current = null;
      return;
    }

    if (previewFired.current !== preview) {
      trackSwipeStarted(directionForOutcome(preview));
    }

    const mag = dragProgressForOutcome(x, y, preview, w, h);
    if (mag >= SWIPE_PREVIEW_PROGRESS && previewFired.current !== preview) {
      previewFired.current = preview;
      tickDebounced(48);
    }
    if (mag >= SWIPE_THRESHOLD_PROGRESS && thresholdFired.current !== preview) {
      thresholdFired.current = preview;
      haptic([10, 18, 10]);
    }
    if (mag < SWIPE_PREVIEW_PROGRESS) previewFired.current = null;
    if (mag < SWIPE_THRESHOLD_PROGRESS) thresholdFired.current = null;
  };

  const onUp = () => {
    if (!pointerActive.current) return;
    pointerActive.current = false;
    if (!dragging) return;
    setDragging(false);
    const { x, y } = offsetRef.current;
    const axis = dragAxisRef.current;
    if (!commitFromRelease(x, y, velocity.current.x, velocity.current.y, axis)) {
      trackSwipeCancelledSafe(axis, x, y);
      springBack();
    }
  };

  function trackSwipeCancelledSafe(axis: DragAxis, x: number, y: number) {
    if (axis === "horizontal") {
      if (x > 0) trackSwipeCancelled("right");
      else if (x < 0) trackSwipeCancelled("left");
    } else if (axis === "vertical" && y > 0) {
      trackSwipeCancelled("down");
    }
  }

  const w = cardW();
  const h = cardH();
  const previewOutcome = previewDragOutcome(
    offset.x,
    offset.y,
    w,
    h,
    dragAxis,
  );
  const previewProgress = previewOutcome
    ? dragProgressForOutcome(offset.x, offset.y, previewOutcome, w, h)
    : 0;
  const rotate =
    dragging && dragAxis !== "vertical" && !reducedMotion.current
      ? Math.max(
          -SWIPE_MAX_ROTATE,
          Math.min(
            SWIPE_MAX_ROTATE,
            offset.x * (SWIPE_MAX_ROTATE / (w * 0.5)),
          ),
        )
      : 0;
  const scale = dragging ? 1 - previewProgress * 0.02 : 1;
  const stackPeek = deck.slice(cursor + 1, cursor + 3);

  const actionBtnBase =
    "touch-press flex h-11 min-h-[44px] min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[12px] font-bold transition-transform active:scale-[0.97] disabled:opacity-40 sm:text-[13px]";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex flex-col overflow-x-hidden bg-[#fafaf8]/94 backdrop-blur-[16px]"
          role="dialog"
          aria-modal="true"
          aria-label={t("하나씩", "One by one")}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !dragging) onClose();
          }}
        >
          <div
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {liveMessage}
          </div>

          <div className="flex items-center justify-end px-[var(--space-4)] pb-2 pt-[max(var(--space-4),env(safe-area-inset-top))] sm:px-5">
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                onClose();
              }}
              className="touch-target flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-ink-soft shadow-card active:scale-95 active:text-ink transition-transform"
              aria-label={t("닫기", "Close")}
            >
              <X size={20} strokeWidth={2.25} />
            </button>
          </div>

          {!isEmpty && (
            <div className="px-[var(--space-4)] pb-3 sm:px-5">
              <ProgressDots total={initialTotal.current} current={progress} />
            </div>
          )}

          <div className="relative flex flex-1 flex-col items-center px-[var(--space-4)] pb-[max(var(--space-6),env(safe-area-inset-bottom))] pt-2 sm:px-6">
            {isEmpty ? (
              <div
                className="flex w-full max-w-[320px] flex-1 flex-col items-center justify-center px-4 text-center"
                data-testid="decision-deck-empty"
              >
                <p className="text-[20px] font-bold tracking-[-0.02em] text-ink">
                  {t("정리할 생각이 아직 없어요.", "Nothing to sort yet.")}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {t(
                    "홈에서 떠오른 생각을 대충 던져보세요.",
                    "Drop a thought on Home first.",
                  )}
                </p>
                {onCapture && (
                  <button
                    type="button"
                    className="pill-yellow mt-6 min-h-[44px] px-6 py-2.5 text-[14px] font-bold text-ink"
                    onClick={() => {
                      tapHaptic();
                      onClose();
                      onCapture();
                    }}
                  >
                    {t("생각 남기기", "Drop a thought")}
                  </button>
                )}
              </div>
            ) : !finished && current ? (
              <>
                <div
                  ref={cardRef}
                  className="relative w-full max-w-[340px] min-h-[min(360px,52dvh)] shrink-0"
                >
                  {showTutorial && (
                    <SwipeTutorial onDismiss={() => setShowTutorial(false)} />
                  )}

                  {stackPeek
                    .slice()
                    .reverse()
                    .map((item, i) => (
                      <div
                        key={item.id}
                        className="focus-sort-card focus-sort-card-stack pointer-events-none absolute inset-x-0 mx-auto w-full px-6 py-5"
                        style={{
                          top: STACK_OFFSET_Y[i] ?? 20,
                          transform: `scale(${STACK_SCALE[i] ?? 0.94})`,
                          opacity: STACK_OPACITY[i] ?? 0.22,
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
                    className="focus-sort-card relative z-10 mx-auto flex min-h-[min(320px,48dvh)] w-full touch-pan-y select-none flex-col overflow-hidden will-change-transform"
                    style={{
                      transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${rotate}deg) scale(${scale})`,
                      opacity: cardOpacity,
                      boxShadow: `0 ${8 + previewProgress * 16}px ${20 + previewProgress * 20}px -8px rgba(0,0,0,${0.06 + previewProgress * 0.08})`,
                    }}
                  >
                    {previewOutcome && (
                      <OutcomeAffordance
                        outcome={previewOutcome}
                        progress={previewProgress}
                        label={outcomeSwipeLabel(previewOutcome, t)}
                        reducedMotion={reducedMotion.current}
                      />
                    )}

                    <div className="flex-1 overflow-y-auto px-5 pb-3 pt-6 sm:px-6">
                      <DeckCardContent item={current} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex w-full max-w-[340px] gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-archive"
                    aria-label={t(
                      "현재 생각을 보관함으로 이동",
                      "Move current thought to vault",
                    )}
                    className={`${actionBtnBase} border-ink/12 bg-ink/[0.04] text-ink-soft shadow-card`}
                    onClick={() => void applyDecision("archive", "button")}
                  >
                    <Archive size={15} strokeWidth={2.25} className="shrink-0" />
                    {t("보관", "Vault")}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-later"
                    aria-label={t(
                      "현재 생각을 그대로 두기",
                      "Keep current thought here",
                    )}
                    className={`${actionBtnBase} border-ink/10 bg-white/95 text-ink shadow-card`}
                    onClick={() => void applyDecision("later", "button")}
                  >
                    <Hand size={15} strokeWidth={2.25} className="shrink-0" />
                    {t("그대로", "Keep")}
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    data-testid="decision-btn-today"
                    aria-label={t(
                      "현재 생각을 일정으로 이동",
                      "Move current thought to schedule",
                    )}
                    className={`${actionBtnBase} border-primary/35 bg-primary/20 text-ink shadow-card`}
                    onClick={() => void applyDecision("today", "button")}
                  >
                    <CalendarClock size={15} strokeWidth={2.25} className="shrink-0" />
                    {t("일정", "Schedule")}
                  </button>
                </div>

                <p className="mt-3 text-center text-caption text-ink-soft/75">
                  {t(
                    "← 보관 · ↓ 그대로 · 일정 →",
                    "← Vault · ↓ Keep · Schedule →",
                  )}
                </p>
              </>
            ) : (
              <motion.div
                data-testid="decision-deck-complete"
                className="w-full max-w-[320px] px-4 pb-2 text-center"
                initial={{ opacity: 0, scale: 0.98, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={MOTION_SUCCESS}
              >
                <p className="text-[22px] font-bold tracking-[-0.03em] text-ink">
                  {t("머릿속이 조금 가벼워졌어요.", "A little lighter now.")}
                </p>
                <p className="mt-3 text-[15px] font-medium tabular-nums text-ink-soft">
                  {t(
                    `일정 ${sessionCounts.today} · 보관 ${sessionCounts.archive} · 그대로 ${sessionCounts.later}`,
                    `Schedule ${sessionCounts.today} · Vault ${sessionCounts.archive} · Kept ${sessionCounts.later}`,
                  )}
                </p>
                <button
                  type="button"
                  className="pill-yellow mt-6 min-h-[44px] w-full px-6 py-2.5 text-[14px] font-bold text-ink"
                  onClick={() => {
                    tapHaptic();
                    onClose();
                  }}
                >
                  {t("홈으로 돌아가기", "Back to Home")}
                </button>
              </motion.div>
            )}

            {undoSnapshot && (
              <button
                type="button"
                data-testid="decision-undo"
                disabled={locked}
                onClick={() => void handleUndo()}
                className="mt-4 min-h-[44px] text-[13px] font-semibold text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
                aria-label={t("마지막 결정을 되돌리기", "Undo last decision")}
              >
                {t("되돌리기", "Undo")}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
