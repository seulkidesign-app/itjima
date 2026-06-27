import { Archive, Calendar } from "lucide-react";
import { useState } from "react";
import type { InboxItem } from "@/lib/store";
import { SwipeCard } from "./SwipeCard";
import { useT } from "@/lib/i18n";

export function FocusMode({
  items,
  onSchedule,
  onArchive,
  onClose,
}: {
  items: InboxItem[];
  onSchedule: (it: InboxItem) => void;
  onArchive: (it: InboxItem) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [idx, setIdx] = useState(0);
  const current = items[idx];

  if (!current) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-sky/60 backdrop-blur-xl">
        <div className="text-[22px] font-bold text-ink">{t("정리 완료 ✨", "All sorted ✨")}</div>
        <button onClick={onClose} className="pill-yellow mt-4">{t("닫기", "Close")}</button>
      </div>
    );
  }

  const handle = (dir: "left" | "right") => {
    if (dir === "right") onSchedule(current);
    else onArchive(current);
    setIdx((i) => i + 1);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-sky/40 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 pt-5">
        <button onClick={onClose} className="pill-ghost">{t("닫기", "Close")}</button>
        <div className="text-sm font-semibold text-ink">
          {idx + 1} / {items.length}
        </div>
        <div className="w-14" />
      </div>
      <div className="flex flex-1 items-center justify-center px-6">
        <SwipeCard key={current.id} onSwipe={handle} className="w-full">
          <div className="p-6 min-h-[280px] flex items-center justify-center text-center">
            <p className="text-[18px] font-semibold leading-snug text-ink whitespace-pre-wrap">
              {current.text}
            </p>
          </div>
        </SwipeCard>
      </div>
      <div className="flex items-center justify-center gap-6 pb-10">
        <button
          onClick={() => handle("left")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-card text-destructive"
          aria-label={t("보관", "Archive")}
        >
          <Archive size={26} />
        </button>
        <button
          onClick={() => handle("right")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-card text-ink"
          aria-label={t("일정", "Schedule")}
        >
          <Calendar size={26} />
        </button>
      </div>
    </div>
  );
}
