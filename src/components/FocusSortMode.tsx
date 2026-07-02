import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  Archive,
  Calendar,
  ChevronDown,
  ChevronUp,
  Pause,
  X,
} from "lucide-react";
import { animate, motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";
import {
  SWIPE_COMMIT,
  SWIPE_PREVIEW,
  MAX_ROTATE,
  dragProgress,
  cardShadowBlur,
  cardScale,
  SPRING_SNAP_BACK,
  SPRING_DEFAULT,
} from "@/lib/motion";

type Props = {
  open: boolean;
  items: InboxItem[];
  onClose: () => void;
  onScheduleRequest: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSoftDelete?: (item: InboxItem) => void | Promise<void>;
};

type ExitDir = "left" | "right";

const V_NAV = 0.22;

function sortOldestFirst(list: InboxItem[]) {
  return [...list].sort(
    (a, b) => +new Date(a.created_at) - +new Date(b.created_at),
  );
}

function DeckCard({ item, compact }: { item: InboxItem; compact?: boolean }) {
  const t = useT();
  return (
    <>
      {item.images?.length > 0 && (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {item.images.map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className={`rounded-[20px] object-cover ${compact ? "h-16 w-16" : "h-20 w-20"}`}
            />
          ))}
        </div>
      )}
      <p
        className={`whitespace-pre-wrap font-semibold leading-[1.65] text-ink ${compact ? "line-clamp-3 text-[15px]" : "text-[18px]"}`}
      >
        {item.text || t("(이미지만)", "(image only)")}
      </p>
      {item.brain_mirror?.title && (
        <p
          className={`mt-3 text-ink-soft ${compact ? "text-[12px]" : "text-[13px]"}`}
        >
          🧠 {item.brain_mirror.title}
        </p>
      )}
    </>
  );
}

function ActionButton({
  onClick,
  disabled,
  children,
  className = "",
  size = "lg",
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "h-[60px] w-[60px]" : "h-[52px] w-[52px]";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`touch-press flex ${dim} items-center justify-center rounded-full bg-white shadow-float disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function FocusSortMode({
  open,
  items,
  onClose,
  onScheduleRequest,
  onArchive,
}: Props) {
  const t = useT();
  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
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
    if (open && !wasOpen.current) {
      const ordered = sortOldestFirst(items);
      initialTotal.current = ordered.length;
      setDeck(ordered);
      setCursor(0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    }
    wasOpen.current = open;
    if (!open) {
      initialTotal.current = 0;
      setDeck([]);
      setCursor(0);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    }
  }, [open, items]);

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
  }, [cursor]);

  const flyAway = useCallback(
    async (dir: ExitDir) => {
      if (!current || exiting) return;
      setExiting(true);
      confirmHaptic();
      const w = cardW();
      const targetX = dir === "right" ? w * 1.7 : -w * 1.7;
      const from = offsetRef.current;
      await Promise.all([
        animate(from.x, targetX, {
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
      const item = current;
      if (dir === "right") onScheduleRequest(item);
      else await onArchive(item);
      removeAtCursor();
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    },
    [cardW, current, exiting, onArchive, onScheduleRequest, removeAtCursor],
  );

  const holdCurrent = useCallback(async () => {
    if (!current || exiting || deck.length <= 1) return;
    setExiting(true);
    tick();
    const h = cardH();
    const from = offsetRef.current;
    await animate(from.y, -h * 0.45, {
      type: "spring",
      stiffness: 300,
      damping: 26,
      onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
    }).finished;
    setDeck((d) => {
      const next = [...d];
      const [item] = next.splice(cursor, 1);
      next.push(item);
      return next;
    });
    setOffset({ x: 0, y: 0 });
    setExiting(false);
  }, [cardH, current, cursor, deck.length, exiting]);

  const navigate = useCallback(
    async (dir: "prev" | "next") => {
      if (exiting || dragging) return;
      const nextCursor = dir === "prev" ? cursor - 1 : cursor + 1;
      if (nextCursor < 0 || nextCursor >= deck.length) {
        springBack();
        return;
      }
      setExiting(true);
      tick();
      const h = cardH();
      const targetY = dir === "prev" ? h * 0.4 : -h * 0.4;
      const from = offsetRef.current;
      await animate(from.y, targetY, {
        type: "spring",
        stiffness: 320,
        damping: 28,
        onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
      }).finished;
      setCursor(nextCursor);
      setOffset({ x: 0, y: 0 });
      setExiting(false);
    },
    [cardH, cursor, deck.length, dragging, exiting, springBack],
  );

  if (!open) return null;

  const onDown = (e: PointerEvent) => {
    if (exiting || !current) return;
    setDragging(true);
    start.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || exiting) return;
    let x = e.clientX - start.current.x;
    let y = e.clientY - start.current.y;
    const w = cardW();
    const h = cardH();
    const atFirst = cursor === 0;
    const atLast = cursor === deck.length - 1;
    if (atFirst && y > 0) y *= 0.35;
    if (atLast && y < 0) y *= 0.35;
    x = Math.max(-w * 0.95, Math.min(w * 0.95, x));
    y = Math.max(-h * 0.55, Math.min(h * 0.55, y));
    setOffset({ x, y });
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const w = cardW();
    const h = cardH();
    const { x, y } = offsetRef.current;
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    if (absY > absX && absY > h * V_NAV) {
      if (y < 0) void navigate("next");
      else void navigate("prev");
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
  const downProgress = offset.y > 0 ? dragProgress(offset.y, cardH()) : 0;
  const progressMag = Math.max(
    rightProgress,
    leftProgress,
    upProgress,
    downProgress,
  );
  const rotate = Math.max(
    -MAX_ROTATE,
    Math.min(MAX_ROTATE, offset.x * (MAX_ROTATE / (cardW() * 0.5))),
  );
  const scale = dragging || exiting ? cardScale(progressMag) : 1;
  const shadow = cardShadowBlur(progressMag);

  const behind1 = deck[cursor + 1];
  const behind2 = deck[cursor + 2];

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <div>
          <div className="nrc-eyebrow">{t("집중 정리", "Focus sort")}</div>
          {!finished && current && (
            <p className="font-num text-[15px] font-bold text-ink">
              {progress} / {initialTotal.current}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="touch-press flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.06] text-ink-soft"
          aria-label={t("닫기", "Close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-4">
        {!finished && current ? (
          <>
            <div className="relative flex w-full max-w-[340px] flex-1 items-center justify-center">
              {behind2 && (
                <div
                  className="focus-sort-card pointer-events-none absolute w-full scale-[0.9] opacity-25"
                  style={{ transform: "translateY(18px)" }}
                  aria-hidden
                >
                  <div className="px-7 py-6">
                    <DeckCard item={behind2} compact />
                  </div>
                </div>
              )}
              {behind1 && (
                <div
                  className="focus-sort-card pointer-events-none absolute w-full scale-[0.945] opacity-45"
                  style={{ transform: "translateY(10px)" }}
                  aria-hidden
                >
                  <div className="px-7 py-7">
                    <DeckCard item={behind1} compact />
                  </div>
                </div>
              )}

              {(upProgress > SWIPE_PREVIEW || downProgress > SWIPE_PREVIEW) && (
                <div className="pointer-events-none absolute left-1/2 top-3 z-0 flex -translate-x-1/2 flex-col items-center gap-1 text-ink-soft">
                  {upProgress > downProgress ? (
                    <>
                      <ChevronUp size={18} style={{ opacity: upProgress }} />
                      <span className="text-[11px] font-bold">
                        {t("다음", "Next")}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] font-bold">
                        {t("이전", "Prev")}
                      </span>
                      <ChevronDown
                        size={18}
                        style={{ opacity: downProgress }}
                      />
                    </>
                  )}
                </div>
              )}

              {rightProgress > SWIPE_PREVIEW && (
                <div
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary/90 px-3 py-1.5 text-[12px] font-extrabold text-ink shadow-card"
                  style={{ opacity: rightProgress }}
                >
                  {t("일정", "Schedule")}
                </div>
              )}
              {leftProgress > SWIPE_PREVIEW && (
                <div
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-blue-500 px-3 py-1.5 text-[12px] font-extrabold text-white shadow-card"
                  style={{ opacity: leftProgress }}
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
                className="focus-sort-card relative z-[1] w-full touch-none select-none px-7 py-8"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${scale})`,
                  boxShadow: `0 ${shadow}px ${shadow * 1.4}px -${shadow * 0.3}px rgba(0,0,0,${0.08 + progressMag * 0.1})`,
                  transition: dragging || exiting ? "none" : undefined,
                }}
              >
                <DeckCard item={current} />
              </motion.div>
            </div>

            <p className="mt-2 text-center text-[11px] text-ink-soft">
              {t(
                "↑↓ 메모 이동 · ← 보관 · → 일정",
                "↑↓ browse · ← Archive · → Schedule",
              )}
            </p>

            <div className="mt-4 flex items-end justify-center gap-5 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
              <ActionButton
                disabled={exiting}
                onClick={() => void flyAway("left")}
                className="text-blue-500"
              >
                <Archive size={26} strokeWidth={2.2} />
              </ActionButton>
              <ActionButton
                size="md"
                disabled={exiting || deck.length <= 1}
                onClick={() => void holdCurrent()}
                className="text-ink-soft"
                aria-label={t("보류", "Hold")}
              >
                <Pause size={22} strokeWidth={2.4} />
              </ActionButton>
              <ActionButton
                disabled={exiting}
                onClick={() => void flyAway("right")}
                className="text-primary"
              >
                <Calendar size={26} strokeWidth={2.2} />
              </ActionButton>
            </div>
            <p className="pb-1 text-center text-[10px] font-semibold tracking-wide text-ink-soft/80">
              {t("보관", "Archive")} · {t("보류", "Hold")} ·{" "}
              {t("일정", "Schedule")}
            </p>
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
              {t(
                "정리 끝. 머리가 조금 가벼워졌어요.",
                "All sorted. Your mind feels lighter.",
              )}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="touch-press pill-yellow mt-8 px-8 py-3.5"
            >
              {t("홈으로", "Back home")}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
