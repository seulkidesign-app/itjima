import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useScrollLock } from "@/hooks/useScrollLock";
import { FeedbackSheet } from "./FeedbackSheet";

export function AboutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  useScrollLock(open || feedbackOpen);
  if (!open && !feedbackOpen) return null;

  const closeFeedback = () => {
    setFeedbackOpen(false);
    onClose();
  };

  return (
    <>
      {open && !feedbackOpen && (
      <div className="fixed inset-0 z-50 flex flex-col" onClick={onClose}>
        <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-sheet-title"
          className="glass-strong animate-slide-up rounded-t-[28px] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
          <div id="about-sheet-title" className="text-[22px] font-semibold tracking-[-0.02em] text-ink">
            ItJima
          </div>
          <div className="text-sm text-ink-soft">
            {t("잊어도 되는 기억함", "A vault for forgotten thoughts")}
          </div>
          <p className="mt-4 text-[14px] leading-[1.6] text-ink/90">
            {t(
              "캘린더도 할 일 목록도 아닙니다. 머릿속에 떠오른 걸 여기에 남겨두세요. 오른쪽으로 밀면 다시 꺼낼 시점을 정하고, 왼쪽으로 밀면 보관함에 남겨둡니다.",
              "Not a calendar, not a to-do list. Leave what floats through your mind here — swipe right for when, swipe left to keep it safe.",
            )}
          </p>
          <div className="mt-5 space-y-2.5 text-[13px] leading-relaxed text-ink-soft">
            <div>
              {t("→ 오른쪽: 그때를 기억하기", "→ Swipe right: remember for then")}
            </div>
            <div>
              {t("← 왼쪽: 보관함에 저장", "← Swipe left: move to Archive")}
            </div>
            <div>
              {t(
                "길게 누르면 더 많은 선택",
                "Long-press for more options",
              )}
            </div>
          </div>

          <button
            onClick={() => setFeedbackOpen(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/60 py-3 text-sm font-semibold text-ink hover:bg-white/80 touch-press"
          >
            <MessageSquarePlus size={16} />
            {t("피드백 보내기", "Send feedback")}
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-bold text-ink touch-press"
          >
            {t("알겠어요", "Got it")}
          </button>
        </div>
      </div>
      )}
      <FeedbackSheet
        open={feedbackOpen}
        onClose={closeFeedback}
      />
    </>
  );
}
