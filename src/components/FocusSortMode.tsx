import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Trash2, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { confirm as confirmHaptic, tick } from "@/lib/haptics";
import type { InboxItem } from "@/lib/store";

const H_COMMIT = 0.35;
const V_COMMIT = 0.3;

type Props = {
  open: boolean;
  items: InboxItem[];
  onClose: () => void;
  onSchedule: (item: InboxItem) => void | Promise<void>;
  onArchive: (item: InboxItem) => void | Promise<void>;
  onSoftDelete: (item: InboxItem) => void | Promise<void>;
};

type ExitDir = "left" | "right" | "down";

export function FocusSortMode({
  open,
  items,
  onClose,
  onSchedule,
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

  const flyAway = async (dir: ExitDir) => {
    if (!current || exiting) return;
    setExiting(true);
    confirmHaptic();
    const w = cardW();
    const h = cardH();
    if (dir === "right") setOffset({ x: w * 1.6, y: 40 });
    else if (dir === "left") setOffset({ x: -w * 1.6, y: 40 });
    else setOffset({ x: 0, y: h * 1.2 });

    await new Promise((r) => window.setTimeout(r, 280));
    if (dir === "right") await onSchedule(current);
    else if (dir === "left") await onArchive(current);
    else await onSoftDelete(current);
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
    if (!crossed.current && (Math.abs(x) > 20 || y > 20)) {
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
      setOffset({ x: 0, y: 0 });
      setDeleteAsk(true);
      return;
    }
    if (x > w * H_COMMIT) {
      void flyAway("right");
      return;
    }
    if (x < -w * H_COMMIT) {
      void flyAway("left");
      return;
    }
    setOffset({ x: 0, y: 0 });
  };

  const rotate = offset.x * 0.06;
  const labelRight = Math.min(1, offset.x / (cardW() * H_COMMIT));
  const labelLeft = Math.min(1, -offset.x / (cardW() * H_COMMIT));
  const labelDown = Math.min(1, offset.y / (cardH() * V_COMMIT));

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
          className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.06] text-ink-soft"
          aria-label={t("닫기", "Close")}
        >
          <X size={18} />
        </button>
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-10">
        {!finished && current ? (
          <>
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              aria-hidden
            >
              <span
                className="absolute left-6 text-[28px] font-black text-primary"
                style={{ opacity: labelRight }}
              >
                {t("일정", "Schedule")}
              </span>
              <span
                className="absolute right-6 text-[28px] font-black text-ink/70"
                style={{ opacity: labelLeft }}
              >
                {t("보관", "Archive")}
              </span>
              <span
                className="absolute bottom-16 text-[24px] font-black text-ink-soft"
                style={{ opacity: labelDown }}
              >
                {t("삭제", "Delete")}
              </span>
            </div>

            <div
              ref={cardRef}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              className="focus-sort-card w-full max-w-[340px] touch-none select-none px-7 py-8 shadow-float"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
                transition: dragging || exiting
                  ? "none"
                  : "transform 0.38s cubic-bezier(0.34, 1.55, 0.64, 1)",
              }}
            >
              {current.images?.length > 0 && (
                <div className="mb-4 flex gap-2 overflow-x-auto">
                  {current.images.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-20 w-20 rounded-[20px] object-cover" />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap text-[18px] font-semibold leading-[1.65] text-ink">
                {current.text || t("(이미지만)", "(image only)")}
              </p>
              {current.brain_mirror?.title && (
                <p className="mt-4 text-[13px] text-ink-soft">🧠 {current.brain_mirror.title}</p>
              )}
              <button
                type="button"
                onClick={() => setDeleteAsk(true)}
                className="mt-6 flex items-center gap-2 text-[13px] font-medium text-ink-soft"
              >
                <Trash2 size={15} /> {t("삭제 / 건너뛰기", "Delete / skip")}
              </button>
            </div>

            <p className="mt-6 text-center text-[12px] text-ink-soft">
              {t("← 보관 · → 일정 · ↓ 삭제", "← Archive · → Schedule · ↓ Delete")}
            </p>
          </>
        ) : (
          <div className="text-center px-4">
            <div className="text-5xl">✨</div>
            <p className="mt-4 text-[18px] font-bold text-ink">
              {t("정리 끝. 머리가 조금 가벼워졌어요.", "All sorted. Your mind feels lighter.")}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="pill-yellow mt-8 px-8 py-3.5"
            >
              {t("홈으로", "Back home")}
            </button>
          </div>
        )}
      </div>

      {deleteAsk && current && (
        <div className="absolute inset-0 z-[70] flex flex-col" onClick={() => setDeleteAsk(false)}>
          <div className="flex-1 bg-ink/40 backdrop-blur-[2px]" />
          <div
            className="animate-slide-up rounded-t-[28px] bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[17px] font-bold text-ink">
              {t("이 생각을 삭제할까요?", "Delete this thought?")}
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {t("삭제해도 기기에 잠시 보관됩니다.", "Soft delete — recoverable on this device.")}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteAsk(false)}
                className="flex-1 rounded-full bg-white/70 py-3.5 text-[15px] font-semibold text-ink"
              >
                {t("취소", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteAsk(false);
                  void flyAway("down");
                }}
                className="flex-1 rounded-full bg-ink py-3.5 text-[15px] font-bold text-white"
              >
                {t("삭제", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
