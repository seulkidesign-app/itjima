import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { animate, motion, AnimatePresence } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import {
  confirm as confirmHaptic,
  haptic,
  tickDebounced,
} from "@/lib/haptics";
import {
  isBrainMirrorCandidate,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { buildCalmInterpretation } from "@/lib/mirrorSentence";
import {
  useInbox,
  setInboxBrainMirror,
  type InboxItem,
} from "@/lib/store";
import {
  SWIPE_PREVIEW,
  dragProgress,
  cardShadowBlur,
  SPRING_SNAP_BACK,
  EASE_OUT_APP,
} from "@/lib/motion";
import {
  MOTION_ARCHIVE,
  MOTION_SCHEDULE,
  MOTION_DELETE,
  MOTION_THINKING,
} from "@/lib/motionLanguage";
import {
  rubberBand,
  swipeRotation,
  swipeOpacity,
} from "@/lib/swipePhysics";

type Phase = "emerge" | "understand" | "mirror" | "interactive" | "exit";
type ExitDir = "left" | "right" | "up";

type Props = {
  item: InboxItem;
  pendingSchedule?: boolean;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onComplete: () => void;
  /** Centered when inbox is empty; overlay when list exists */
  variant?: "hero" | "overlay";
};

const MAX_DRAG_X = 320;
const MAX_DRAG_Y = 160;
const COMMIT_PX = 88;
const UNDERSTAND_MS = 1000;
const MIRROR_TIMEOUT_MS = 8000;
const PHASE_SAFETY_MS = 3500;

function advancePhase(current: Phase, next: Phase): Phase {
  if (current === "exit") return current;
  const order: Phase[] = ["emerge", "understand", "mirror", "interactive", "exit"];
  if (next === "exit") return "exit";
  if (order.indexOf(next) < order.indexOf(current)) return current;
  return next;
}

function SwipeStamp({
  dir,
  progress,
  label,
}: {
  dir: ExitDir;
  progress: number;
  label: string;
}) {
  if (progress < 0.12) return null;
  const opacity = Math.min(1, (progress - 0.12) * 2.4);
  const base =
    "pointer-events-none absolute z-[2] rounded-xl border-[3px] px-3 py-1.5 text-[13px] font-extrabold uppercase tracking-[0.1em]";
  const pos =
    dir === "left"
      ? "left-5 top-1/2 -translate-y-1/2 -rotate-12 border-ink bg-ink/[0.06] text-ink"
      : dir === "right"
        ? "right-5 top-1/2 -translate-y-1/2 rotate-12 border-primary bg-primary/10 text-primary"
        : "left-1/2 top-6 -translate-x-1/2 -rotate-3 border-meta/40 bg-meta/8 text-meta";
  return (
    <div className={`${base} ${pos}`} style={{ opacity }}>
      {label}
    </div>
  );
}

export function CaptureRelease({
  item,
  pendingSchedule = false,
  onArchive,
  onSchedule,
  onLetGo,
  onComplete,
  variant = "overlay",
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const inbox = useInbox();
  const inboxRef = useRef(inbox);
  inboxRef.current = inbox;
  const cardRef = useRef<HTMLDivElement>(null);
  const actingRef = useRef(false);
  const completingRef = useRef(false);
  const thresholdFired = useRef<ExitDir | null>(null);
  const previewFired = useRef<ExitDir | null>(null);
  const velocity = useRef({ x: 0, y: 0 });
  const lastMove = useRef({ x: 0, y: 0, t: 0 });
  const start = useRef({ x: 0, y: 0 });
  const offsetRef = useRef({ x: 0, y: 0 });
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<Phase>("emerge");
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [cardOpacity, setCardOpacity] = useState(1);

  offsetRef.current = offset;

  const interactive = phase === "interactive" || phase === "mirror";
  const locked =
    exiting ||
    actingRef.current ||
    pendingSchedule ||
    phase === "emerge" ||
    phase === "understand" ||
    phase === "exit";

  const cardW = useCallback(
    () => cardRef.current?.offsetWidth ?? 300,
    [],
  );

  const commitThreshold = useCallback(
    () => Math.max(COMMIT_PX, cardW() * 0.28),
    [cardW],
  );

  const springBack = useCallback(() => {
    animate(0, 1, {
      duration: 0.32,
      ease: EASE_OUT_APP,
      onUpdate: (p) => {
        const ease = 1 - Math.pow(1 - p, 3);
        setOffset({
          x: offsetRef.current.x * (1 - ease),
          y: offsetRef.current.y * (1 - ease),
        });
      },
      onComplete: () => setOffset({ x: 0, y: 0 }),
    });
  }, []);

  useEffect(() => {
    if (!pendingSchedule) springBack();
  }, [pendingSchedule, springBack]);

  const finishRelease = useCallback(() => {
    if (completingRef.current) return;
    completingRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    let cancelled = false;
    const timers: number[] = [];
    const t0 = performance.now();

    const schedule = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => {
        if (!cancelled && !ac.signal.aborted) fn();
      }, ms);
      timers.push(id);
    };

    setPhase("emerge");
    setInterpretation(null);
    setOffset({ x: 0, y: 0 });
    setCardOpacity(1);
    completingRef.current = false;
    actingRef.current = false;
    setExiting(false);

    schedule(() => setPhase((p) => advancePhase(p, "understand")), 280);

    void (async () => {
      let mirror: BrainMirrorResult | null = null;
      let sentence = buildCalmInterpretation(
        item.text,
        lang === "en" ? "en" : "ko",
      );

      if (item.text.trim().length >= 2 && isBrainMirrorCandidate(item.text)) {
        try {
          const outcome = await Promise.race([
            fetchBrainMirror(item.text, { signal: ac.signal }),
            new Promise<{ status: "skipped" }>((resolve) => {
              const id = window.setTimeout(
                () => resolve({ status: "skipped" }),
                MIRROR_TIMEOUT_MS,
              );
              timers.push(id);
            }),
          ]);
          if (outcome.status === "ok") {
            mirror = outcome.result;
            sentence = buildCalmInterpretation(
              item.text,
              lang === "en" ? "en" : "ko",
              mirror,
            );
            try {
              await setInboxBrainMirror(inboxRef.current, item.id, {
                ...mirror,
                title: sentence,
                items: [sentence],
                suggestedAction: sentence,
              });
            } catch {
              /* quiet */
            }
          }
        } catch {
          /* quiet — local sentence still shown */
        }
      }

      const elapsed = performance.now() - t0;
      const wait = Math.max(0, UNDERSTAND_MS - elapsed);
      schedule(() => {
        setInterpretation(sentence);
        setPhase((p) => advancePhase(p, "mirror"));
        schedule(() => setPhase((p) => advancePhase(p, "interactive")), 420);
      }, wait);
    })();

    schedule(() => {
      setInterpretation(
        (prev) =>
          prev ??
          buildCalmInterpretation(item.text, lang === "en" ? "en" : "ko"),
      );
      setPhase((p) => advancePhase(p, "interactive"));
    }, PHASE_SAFETY_MS);

    return () => {
      cancelled = true;
      ac.abort();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [item.id, item.text, lang]);

  const openScheduleSwipe = useCallback(async () => {
    if (actingRef.current) return;
    actingRef.current = true;
    setExiting(true);
    setDragging(false);
    confirmHaptic();
    try {
      const w = cardW();
      const from = offsetRef.current;
      await animate(from.x, w * 0.42, {
        ...MOTION_SCHEDULE,
        velocity: velocity.current.x * 0.3,
        onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
      }).finished;
      onSchedule(item);
    } finally {
      setExiting(false);
      actingRef.current = false;
    }
  }, [cardW, item, onSchedule]);

  const flyAway = useCallback(
    async (dir: ExitDir) => {
      if (actingRef.current) return;
      if (dir === "right") {
        await openScheduleSwipe();
        return;
      }

      actingRef.current = true;
      setExiting(true);
      setDragging(false);
      confirmHaptic();
      setPhase("exit");

      const { x, y } = offsetRef.current;
      const spring = dir === "left" ? MOTION_ARCHIVE : MOTION_DELETE;
      const target =
        dir === "left"
          ? { x: x - 420, y: y - 40 }
          : { x, y: y - 480 };

      try {
        await Promise.all([
          animate(x, target.x, {
            ...spring,
            onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
          }).finished,
          animate(y, target.y, {
            ...spring,
            onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
          }).finished,
          animate(cardOpacity, 0, {
            ...spring,
            onUpdate: (v) => setCardOpacity(v),
          }).finished,
        ]);
        if (dir === "left") await onArchive(item);
        else await onLetGo(item);
      } catch {
        /* still exit release overlay */
      } finally {
        actingRef.current = false;
        setExiting(false);
        finishRelease();
      }
    },
    [cardOpacity, finishRelease, item, onArchive, onLetGo, openScheduleSwipe],
  );

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (locked || !interactive) return;
    setDragging(true);
    thresholdFired.current = null;
    previewFired.current = null;
    velocity.current = { x: 0, y: 0 };
    lastMove.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const resolveDir = (x: number, y: number): ExitDir | null => {
    const absX = Math.abs(x);
    const absY = Math.abs(y);
    if (absY > absX && y < 0) return "up";
    if (absX > absY) return x < 0 ? "left" : "right";
    return null;
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

    const dir = resolveDir(x, y);
    if (!dir) {
      previewFired.current = null;
      thresholdFired.current = null;
      return;
    }

    const mag =
      dir === "up"
        ? dragProgress(-y, commitThreshold())
        : dragProgress(dir === "left" ? -x : x, commitThreshold());

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

    if (absY > absX && y < 0) {
      if (absY > threshold || vy < -420) {
        void flyAway("up");
        return;
      }
    } else if (absX >= absY) {
      if (x < 0 && (absX > threshold || vx < -450)) {
        void flyAway("left");
        return;
      }
      if (x > 0 && (absX > threshold || vx > 450)) {
        void flyAway("right");
        return;
      }
    }
    springBack();
  };

  const memoryProgress =
    offset.x < 0 ? Math.min(1, -offset.x / commitThreshold()) : 0;
  const scheduleProgress =
    offset.x > 0 ? Math.min(1, offset.x / commitThreshold()) : 0;
  const letGoProgress =
    offset.y < 0 ? Math.min(1, -offset.y / commitThreshold()) : 0;
  const progressMag = Math.max(memoryProgress, scheduleProgress, letGoProgress);
  const rotate = dragging ? swipeRotation(offset.x, cardW()) * 0.55 : 0;
  const shadow = cardShadowBlur(progressMag);
  const breathe =
    phase === "understand"
      ? { scale: [1, 1.018, 1, 1.012, 1], y: [0, -3, 0, -2, 0] }
      : { scale: 1, y: 0 };

  const shellClass =
    variant === "hero"
      ? "relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-8"
      : "pointer-events-none fixed inset-0 z-[45] flex items-center justify-center px-6 pb-24 pt-16";

  return (
    <div className={shellClass} aria-live="polite">
      {variant === "overlay" && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-white/55 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35 }}
        />
      )}

      <motion.div
        className="pointer-events-auto relative w-full max-w-[360px]"
        initial={{ opacity: 0, y: variant === "hero" ? 28 : 48, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE_OUT_APP }}
      >
        <motion.div
          ref={cardRef}
          className="relative touch-none select-none rounded-[28px] bg-white px-6 py-7 shadow-float ring-1 ring-ink/[0.06]"
          style={{
            opacity: swipeOpacity(Math.abs(offset.x) + Math.abs(offset.y) * 0.4, MAX_DRAG_X) * cardOpacity,
            boxShadow: `0 ${8 + shadow * 0.3}px ${shadow}px oklch(0 0 0 / ${0.08 + progressMag * 0.06})`,
            rotate,
            x: offset.x,
            y: offset.y,
          }}
          animate={breathe}
          transition={
            phase === "understand"
              ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
              : SPRING_SNAP_BACK
          }
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {phase === "understand" && (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-[28px] bg-primary/[0.03]"
              animate={{ opacity: [0.2, 0.45, 0.2] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <SwipeStamp
            dir="left"
            progress={memoryProgress}
            label={t("기억함", "Keep")}
          />
          <SwipeStamp
            dir="right"
            progress={scheduleProgress}
            label={t("그때", "When")}
          />
          <SwipeStamp
            dir="up"
            progress={letGoProgress}
            label={t("내려놓기", "Let go")}
          />

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

          <p className="whitespace-pre-wrap text-[22px] font-semibold leading-[1.6] tracking-[-0.025em] text-ink">
            {item.text || t("(이미지만)", "(image only)")}
          </p>

          <AnimatePresence>
            {interpretation && phase !== "emerge" && phase !== "understand" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: EASE_OUT_APP, ...MOTION_THINKING }}
                className="mt-5 border-t border-ink/[0.07] pt-4"
              >
                <p className="text-[15px] font-medium leading-relaxed text-ink-soft/90">
                  {interpretation}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {phase === "interactive" && !pendingSchedule && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mt-8 flex items-center justify-between px-2 text-[11px] font-semibold tracking-wide text-ink-soft/55"
            >
              <span>← {t("기억함", "Keep")}</span>
              <span>↑ {t("내려놓기", "Let go")}</span>
              <span>{t("그때", "When")} →</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
