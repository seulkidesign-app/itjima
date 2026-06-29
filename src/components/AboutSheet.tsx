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
          <div className="text-sm text-ink-soft">{t("AI Memory", "AI Memory")}</div>
          <p className="mt-4 text-[14px] leading-relaxed text-ink">
            {t(
              "정리 앱이 아니에요. 머릿속에 떠다니는 생각을 던져두면, 잊어도 괜찮아요 — 제가 기억할게요.",
              "Not a productivity app. Drop what's on your mind and forget it — I'll remember for you.",
            )}
          </p>
          <div className="mt-5 space-y-2 text-[13px] text-ink-soft">
            <div>{t("길게 누르면 때로 남기기 · 기억으로 보내기", "Long-press: save for when · move to memory")}</div>
            <div>{t("긴 생각은 조용히 이해해 드려요", "Long thoughts get a quiet Brain Mirror")}</div>
          </div>

          <button
            onClick={() => setFeedbackOpen(true)}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/60 py-3 text-sm font-semibold text-ink hover:bg-white/80"
          >
            <MessageSquarePlus size={16} />
            {t("피드백 보내기", "Send feedback")}
          </button>
          <button
            onClick={onClose}
            className="mt-2 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-ink"
          >
            {t("확인", "Got it")}
          </button>
        </div>
      </div>
      <FeedbackSheet open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
