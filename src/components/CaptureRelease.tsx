import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT, useLang } from "@/lib/i18n";
import { confirm as confirmHaptic, haptic } from "@/lib/haptics";
import {
  isBrainMirrorCandidate,
  type BrainMirrorResult,
} from "@/lib/brainMirror";
import { fetchBrainMirror } from "@/lib/brainMirrorApi";
import { isChatFiller } from "@/lib/junkDetect";
import { buildCalmInterpretation } from "@/lib/mirrorSentence";
import {
  buildPromiseCard,
  type PromiseCard,
} from "@/lib/promiseCard";
import {
  useInbox,
  setInboxBrainMirror,
  type InboxItem,
} from "@/lib/store";
import { EASE_OUT_APP } from "@/lib/motion";

type Phase = "emerge" | "understand" | "mirror" | "interactive" | "exit";

type Props = {
  item: InboxItem;
  pendingSchedule?: boolean;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSchedule: (item: InboxItem) => void;
  onConfirmScheduleQuick: (item: InboxItem) => void | Promise<void>;
  onLetGo: (item: InboxItem) => void | Promise<void>;
  onComplete: () => void;
  variant?: "hero" | "overlay";
};

const UNDERSTAND_MS = 1000;
const MIRROR_TIMEOUT_MS = 8000;
const PHASE_SAFETY_MS = 3500;
const EMERGE = {
  duration: 0.88,
  ease: EASE_OUT_APP,
};

const MIRROR_REVEAL = {
  duration: 0.95,
  ease: EASE_OUT_APP,
};

const HINT_REVEAL = {
  duration: 0.65,
  ease: EASE_OUT_APP,
  delay: 0.35,
};

function advancePhase(current: Phase, next: Phase): Phase {
  if (current === "exit") return current;
  const order: Phase[] = ["emerge", "understand", "mirror", "interactive", "exit"];
  if (next === "exit") return "exit";
  if (order.indexOf(next) < order.indexOf(current)) return current;
  return next;
}

export function CaptureRelease({
  item,
  pendingSchedule = false,
  onArchive,
  onSchedule,
  onConfirmScheduleQuick,
  onLetGo,
  onComplete,
  variant = "overlay",
}: Props) {
  const t = useT();
  const { lang } = useLang();
  const inbox = useInbox();
  const inboxRef = useRef(inbox);
  inboxRef.current = inbox;
  const cardZoneRef = useRef<HTMLDivElement>(null);
  const actingRef = useRef(false);
  const completingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [phase, setPhase] = useState<Phase>("emerge");
  const [emergeY, setEmergeY] = useState(0);
  const [emergeReady, setEmergeReady] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const promiseCard = useMemo(
    () => buildPromiseCard(item.text, lang === "en" ? "en" : "ko"),
    [item.text, lang],
  );

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
    setEditOpen(false);
    setEmergeReady(false);
    completingRef.current = false;
    actingRef.current = false;

    schedule(() => setPhase((p) => advancePhase(p, "understand")), 320);

    void (async () => {
      if (
        item.text.trim().length >= 2 &&
        !isChatFiller(item.text) &&
        isBrainMirrorCandidate(item.text)
      ) {
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
            const mirror: BrainMirrorResult = outcome.result;
            const sentence = buildCalmInterpretation(
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
          /* quiet */
        }
      }

      const elapsed = performance.now() - t0;
      const wait = Math.max(0, UNDERSTAND_MS - elapsed);
      schedule(() => {
        setPhase((p) => advancePhase(p, "mirror"));
        schedule(() => setPhase((p) => advancePhase(p, "interactive")), 920);
      }, wait);
    })();

    schedule(() => {
      setPhase((p) => advancePhase(p, "interactive"));
    }, PHASE_SAFETY_MS);

    return () => {
      cancelled = true;
      ac.abort();
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [item.id, item.text, lang]);

  useEffect(() => {
    const measure = () => {
      const input = document.getElementById("capture-input");
      const shell = document.querySelector(".input-shell");
      const origin = input ?? shell;
      const zone = cardZoneRef.current;
      if (!origin || !zone) return;
      const originRect = origin.getBoundingClientRect();
      const zoneRect = zone.getBoundingClientRect();
      const originCenter = originRect.top + originRect.height / 2;
      const zoneCenter = zoneRect.top + zoneRect.height / 2;
      setEmergeY(originCenter - zoneCenter);
      setEmergeReady(true);
    };
    measure();
    requestAnimationFrame(measure);
  }, [item.id, variant]);

  const runPrimary = async (card: PromiseCard) => {
    if (actingRef.current || pendingSchedule) return;
    actingRef.current = true;
    confirmHaptic();
    try {
      switch (card.primaryAction) {
        case "confirm_schedule":
          await onConfirmScheduleQuick(item);
          break;
        case "archive":
          await onArchive(item);
          finishRelease();
          break;
        case "keep_task":
        case "keep_note":
          finishRelease();
          break;
      }
    } finally {
      actingRef.current = false;
    }
  };

  const runEdit = (card: PromiseCard) => {
    if (actingRef.current || pendingSchedule) return;
    if (card.editAction === "open_schedule_sheet") {
      confirmHaptic();
      onSchedule(item);
      return;
    }
    haptic(6);
    setEditOpen(true);
  };

  const shellClass =
    variant === "hero"
      ? "relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-8"
      : "pointer-events-auto fixed inset-0 z-[45] flex items-center justify-center px-6 pb-[116px] pt-16";

  const showPromise = phase !== "emerge" && phase !== "understand";
  const showActions = phase === "interactive" && !pendingSchedule;

  return (
    <div className={shellClass} aria-live="polite">
      {variant === "overlay" && (
        <motion.div
          className="pointer-events-auto absolute inset-0 bg-white/38 backdrop-blur-[4px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.72, ease: EASE_OUT_APP }}
          onClick={() => {
            if (!pendingSchedule && !editOpen) finishRelease();
          }}
        />
      )}

      <motion.div
        ref={cardZoneRef}
        className="pointer-events-auto relative z-[1] flex w-full max-w-[320px] flex-col items-center"
        onClick={(e) => e.stopPropagation()}
        initial={
          emergeReady
            ? { y: emergeY, opacity: 0.86 }
            : { y: emergeY, opacity: 0 }
        }
        animate={{ y: 0, opacity: 1 }}
        transition={EMERGE}
      >
        <div
          className={`relative w-full rounded-[32px] bg-white px-[26px] py-9 shadow-[0_2px_6px_rgba(0,0,0,0.035),0_10px_32px_-12px_rgba(0,0,0,0.08)] ring-1 ring-ink/[0.04] ${
            phase === "understand" ? "capture-shadow-held" : ""
          }`}
        >
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

          <p className="whitespace-pre-wrap text-[20px] font-semibold leading-[1.65] tracking-[-0.025em] text-ink">
            {item.text || t("(이미지만)", "(image only)")}
          </p>

          <AnimatePresence>
            {showPromise && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={MIRROR_REVEAL}
                className="mt-8 border-t border-ink/[0.06] pt-7"
                data-testid="promise-card"
              >
                <p className="text-[15px] font-semibold leading-snug text-ink">
                  {promiseCard.label}
                </p>
                <p className="mt-2.5 text-[15px] font-normal leading-[1.7] tracking-[0.01em] text-ink-soft">
                  {promiseCard.promise}
                </p>
                <p className="mt-3 text-[12px] font-medium text-primary">
                  {t("저장됨", "Saved")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={HINT_REVEAL}
              className="mt-6 flex w-full gap-2.5"
            >
              <button
                type="button"
                data-testid="promise-primary"
                onClick={() => void runPrimary(promiseCard)}
                className="pill-yellow touch-press min-h-[48px] flex-1 px-4 py-3 text-[14px] font-bold text-ink"
              >
                {promiseCard.primaryActionLabel}
              </button>
              <button
                type="button"
                data-testid="promise-edit"
                onClick={() => runEdit(promiseCard)}
                className="touch-press min-h-[48px] rounded-full border border-ink/12 bg-white px-5 py-3 text-[14px] font-semibold text-ink shadow-[0_1px_4px_oklch(0_0_0/0.04)]"
              >
                {promiseCard.editActionLabel}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editOpen && showActions && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 w-full rounded-[24px] border border-ink/8 bg-white p-2 shadow-float"
              data-testid="promise-edit-menu"
            >
              <EditMenuButton
                label={t("할 일로 잡기", "Set a time")}
                onClick={() => {
                  setEditOpen(false);
                  onSchedule(item);
                }}
              />
              <EditMenuButton
                label={t("생각 지도에 보관", "Save to thought map")}
                onClick={() => {
                  setEditOpen(false);
                  void (async () => {
                    await onArchive(item);
                    finishRelease();
                  })();
                }}
              />
              <EditMenuButton
                label={t("내려놓기", "Let go")}
                onClick={() => {
                  setEditOpen(false);
                  void (async () => {
                    await onLetGo(item);
                    finishRelease();
                  })();
                }}
              />
              <EditMenuButton
                label={t("여기에 두기", "Keep here")}
                onClick={() => {
                  setEditOpen(false);
                  finishRelease();
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function EditMenuButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-press w-full rounded-[18px] px-4 py-3.5 text-left text-[14px] font-medium text-ink active:bg-ink/[0.04]"
    >
      {label}
    </button>
  );
}
