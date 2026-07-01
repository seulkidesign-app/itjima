import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Archive, Calendar, Trash2, X } from "lucide-react";
import { animate, motion } from "framer-motion";
import { useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";
import {
  SWIPE_COMMIT,
  SWIPE_PREVIEW,
  MAX_ROTATE,
  dragProgress,
  indicatorScale,
  cardShadowBlur,
  cardScale,
  SPRING_SNAP_BACK,
  SPRING_DEFAULT,
} from "@/lib/motion";

const V_COMMIT = 0.3;

type Props = {
  open: boolean;
  items: InboxItem[];
  onClose: () => void;
  onScheduleRequest: (item: InboxItem) => void;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSoftDelete: (item: InboxItem) => void | Promise<void>;
};

type ExitDir = "left" | "right" | "down";

function SwipeIndicator({
  side,
  progress,
  icon,
  label,
  colorClass,
}: {
  side: "left" | "right" | "bottom";
  progress: number;
  icon: ReactNode;
  label: string;
  colorClass: string;
}) {
  const scale = indicatorScale(progress);
  const ready = progress >= SWIPE_COMMIT;
  const pos =
    side === "left"
      ? "left-8 top-1/2 -translate-y-1/2"
      : side === "right"
        ? "right-8 top-1/2 -translate-y-1/2"
        : "bottom-20 left-1/2 -translate-x-1/2";

  return (
    <motion.div
      className={`pointer-events-none absolute flex flex-col items-center gap-1 ${pos} ${colorClass}`}
      style={{ scale, opacity: scale }}
      aria-hidden
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur-md ${ready ? "bg-white/90 shadow-float" : "bg-white/60"}`}
      >
        {icon}
      </div>
      <span className="text-[13px] font-extrabold tracking-wide">{label}</span>
    </motion.div>
  );
}

export function FocusSortMode({
  open,
  items,
  onClose,
  onScheduleRequest,
  onArchive,
  onSoftDelete,
}: Props) {
  const t = useT();
  const initialTotal = useRef(0);
  const wasOpen = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const start = useRef({ x: 0, y: 0 });
  const crossed = useRef(false);

  const current = items.length > 0 ? items[items.length - 1] : null;
  const total = initialTotal.current || items.length;
  const currentIndex = total - items.length + (current ? 1 : 0);
  const finished = open && total > 0 && items.length === 0;

  useEffect(() => {
    if (open && !wasOpen.current) {
      initialTotal.current = items.length;
    }
    wasOpen.current = open;
    if (!open) {
      initialTotal.current = 0;
      setOffset({ x: 0, y: 0 });
      setExiting(false);
      setDeleteAsk(false);
    }
  }, [open, items.length]);

  if (!open) return null;

  const cardW = () => cardRef.current?.offsetWidth ?? 300;
  const cardH = () => cardRef.current?.offsetHeight ?? 360;

  const springBack = () => {
    const el = cardRef.current;
    if (!el) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const from = { x: offset.x, y: offset.y };
    animate(from.x, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => setOffset((o) => ({ ...o, x: v })),
    });
    animate(from.y, 0, {
      ...SPRING_SNAP_BACK,
      onUpdate: (v) => setOffset((o) => ({ ...o, y: v })),
    });
  };

  const flyAway = async (dir: ExitDir) => {
    if (!current || exiting) return;
    setExiting(true);
    confirmHaptic();
    const w = cardW();
    const h = cardH();
    const target =
      dir === "right"
        ? { x: w * 1.8, y: 30 }
        : dir === "left"
          ? { x: -w * 1.8, y: 30 }
          : { x: 0, y: h * 1.3 };

    await Promise.all([
      animate(offset.x, target.x, {
        type: "spring",
        stiffness: 280,
        damping: 26,
      }).finished,
      animate(offset.y, target.y, {
        type: "spring",
        stiffness: 280,
        damping: 26,
      }).finished,
    ]);

    const item = current;
    if (dir === "right") onScheduleRequest(item);
    else if (dir === "left") await onArchive(item);
    else await onSoftDelete(item);

    setOffset({ x: 0, y: 0 });
    setExiting(false);
    crossed.current = false;
  };

  const onDown = (e: PointerEvent) => {
    if (exiting || !current || deleteAsk) return;
    setDragging(true);
    start.current = { x: e.clientX, y: e.clientY };
    crossed.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || exiting) return;
    const x = e.clientX - start.current.x;
    const y = Math.max(0, e.clientY - start.current.y);
    setOffset({ x, y });
    if (!crossed.current && (Math.abs(x) > 16 || y > 16)) {
      crossed.current = true;
      tick();
    }
  };

  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    const w = cardW();
    const h = cardH();
    const { x, y } = offset;

    if (y > h * V_COMMIT && y > Math.abs(x)) {
      springBack();
      setDeleteAsk(true);
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

  const absX = Math.abs(offset.x);
  const dragMag = Math.max(absX, offset.y);
  const progress = dragProgress(dragMag, cardW());
  const rightProgress = offset.x > 0 ? dragProgress(offset.x, cardW()) : 0;
  const leftProgress = offset.x < 0 ? dragProgress(-offset.x, cardW()) : 0;
  const downProgress = offset.y > 0 ? dragProgress(offset.y, cardH()) : 0;

  const rotate = Math.max(
    -MAX_ROTATE,
    Math.min(MAX_ROTATE, offset.x * (MAX_ROTATE / (cardW() * 0.5))),
  );
  const scale = dragging || exiting ? cardScale(progress) : 1;
  const shadow = cardShadowBlur(progress);

  return (
    <div className="absolute inset-0 z-[60] flex flex-col bg-white">
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <div>
          <div className="nrc-eyebrow">{t("집중 정리", "Focus sort")}</div>
          {!finished && current && (
            <p className="font-num text-[15px] font-bold text-ink">
              {currentIndex} / {total}
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

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10">
        {!finished && current ? (
          <>
            <SwipeIndicator
              side="right"
              progress={rightProgress}
              icon={<Calendar size={24} className="text-primary" />}
              label={t("일정", "Schedule")}
              colorClass="text-primary"
            />
            <SwipeIndicator
              side="left"
              progress={leftProgress}
              icon={<Archive size={24} className="text-blue-500" />}
              label={t("보관", "Archive")}
              colorClass="text-blue-500"
            />
            <SwipeIndicator
              side="bottom"
              progress={downProgress}
              icon={<Trash2 size={22} className="text-ink-soft" />}
              label={t("삭제", "Delete")}
              colorClass="text-ink-soft"
            />

            {items.length > 1 && (
              <motion.div
                className="focus-sort-card pointer-events-none absolute w-full max-w-[340px] scale-[0.96] opacity-40"
                initial={{ y: 12 }}
                animate={{ y: 0 }}
                transition={SPRING_DEFAULT}
                aria-hidden
              >
                <div className="h-24 rounded-[28px] bg-ink/[0.04]" />
              </motion.div>
            )}

            <motion.div
              ref={cardRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="focus-sort-card relative z-[1] w-full max-w-[340px] touch-none select-none px-7 py-8"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg) scale(${scale})`,
                boxShadow: `0 ${shadow}px ${shadow * 1.4}px -${shadow * 0.3}px rgba(0,0,0,${0.08 + progress * 0.1})`,
                transition: dragging || exiting ? "none" : undefined,
                backdropFilter:
                  progress > SWIPE_PREVIEW
                    ? `blur(${progress * 2}px)`
                    : undefined,
              }}
            >
              {current.images?.length > 0 && (
                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {current.images.map((src, i) => (
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
                {current.text || t("(이미지만)", "(image only)")}
              </p>
              {current.brain_mirror?.title && (
                <p className="mt-4 text-[13px] text-ink-soft">
                  🧠 {current.brain_mirror.title}
                </p>
              )}
              <button
                type="button"
                onClick={() => setDeleteAsk(true)}
                className="touch-press mt-6 flex items-center gap-2 text-[13px] font-medium text-ink-soft"
              >
                <Trash2 size={15} /> {t("삭제 / 건너뛰기", "Delete / skip")}
              </button>
            </motion.div>

            <p className="mt-6 text-center text-[12px] text-ink-soft">
              {rightProgress >= SWIPE_PREVIEW || leftProgress >= SWIPE_PREVIEW
                ? rightProgress >= SWIPE_COMMIT || leftProgress >= SWIPE_COMMIT
                  ? t("놓으면 확정", "Release to confirm")
                  : t("계속 밀어보세요", "Keep swiping")
                : t(
                    "← 보관 · → 일정 · ↓ 삭제",
                    "← Archive · → Schedule · ↓ Delete",
                  )}
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

      {deleteAsk && current && (
        <div
          className="absolute inset-0 z-[70] flex flex-col"
          onClick={() => setDeleteAsk(false)}
        >
          <div className="flex-1 bg-ink/40 backdrop-blur-md" />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={SPRING_DEFAULT}
            className="rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
            <p className="text-[17px] font-bold text-ink">
              {t("이 생각을 삭제할까요?", "Delete this thought?")}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {t(
                "삭제해도 기기에 잠시 보관됩니다.",
                "Soft delete — recoverable on this device.",
              )}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteAsk(false)}
                className="touch-press flex-1 rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
              >
                {t("취소", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteAsk(false);
                  void flyAway("down");
                }}
                className="touch-press flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
              >
                {t("삭제", "Delete")}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
