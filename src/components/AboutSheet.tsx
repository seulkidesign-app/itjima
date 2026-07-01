import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import { FeedbackSheet } from "./FeedbackSheet";

export function AboutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  if (!open) return null;
  return (
    <>
      <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
        <div className="flex-1 bg-ink/30 backdrop-blur-sm animate-fade-in" />
        <div
          className="glass-strong animate-slide-up rounded-t-[28px] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
          <div className="text-[22px] font-bold text-ink">ItJima</div>
          <div className="text-sm text-ink-soft">{t("머릿속 인박스", "Mental Inbox")}</div>
          <p className="mt-4 text-[14px] leading-relaxed text-ink">
            {t(
              "캘린더도 노트도 아닙니다. 머릿속에 떠다니는 생각을 빠르게 던져 두고, 오른쪽으로 밀면 일정, 왼쪽으로 밀면 보관.",
              "Not a calendar, not a notes app. Throw thoughts into your inbox — swipe right for schedule, swipe left to archive.",
            )}
          </p>
          <div className="mt-5 space-y-2 text-[13px] text-ink-soft">
            <div>{t("→ 오른쪽 스와이프: 일정으로", "→ Swipe right: schedule it")}</div>
            <div>{t("← 왼쪽 스와이프: 보관함으로", "← Swipe left: archive it")}</div>
            <div>{t("길게 누르면 메뉴, 두 개 이상이면 정리 모드", "Long-press for menu, 2+ items unlock Focus mode")}</div>
          </div>

          <button
            onClick={() => setFeedbackOpen(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-white/60 py-3 text-sm font-semibold text-ink hover:bg-white/80"
          >
            <MessageSquarePlus size={16} />
            {t("피드백 보내기", "Send feedback")}
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-full bg-primary py-3 text-sm font-bold text-ink"
          >
            {t("확인", "Got it")}
          </button>
        </div>
      </div>
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
