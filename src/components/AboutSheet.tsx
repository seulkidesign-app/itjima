import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { useT } from "@/lib/i18n";
import { FeedbackSheet } from "./FeedbackSheet";
import { BottomSheet } from "./BottomSheet";
import { BrandLogo } from "./BrandLogo";

export function AboutSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const closeFeedback = () => {
    setFeedbackOpen(false);
    onClose();
  };

  return (
    <>
      <BottomSheet
        open={open && !feedbackOpen}
        onClose={onClose}
        maxHeight="76dvh"
        title={t("Itjima 제품 정보", "About Itjima")}
      >
        <div className="sheet-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-1">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ink/38">
            {t("자연어 일정 캡처", "Natural-language scheduling")}
          </p>
          <div className="mt-3 flex items-center gap-3">
            <BrandLogo size="native" />
            <span className="text-[13px] font-bold text-ink-soft">잊지마</span>
          </div>
          <p className="mt-3 text-[14px] leading-[1.65] text-ink/78">
            {t(
              "말하듯 일정과 할 일을 남기면 확실한 정보는 채우고, 애매한 날짜와 시간만 확인해요.",
              "Say a plan or task naturally. Itjima fills what is clear and asks only about ambiguous dates and times.",
            )}
          </p>

          <div className="mt-5 space-y-2.5 rounded-[18px] bg-ink/[0.035] p-4 text-[13px] leading-relaxed text-ink-soft">
            <p>{t("• 확실한 일정은 한 번에 추가", "• Add clear schedules in one tap")}</p>
            <p>{t("• 오전·오후와 주말 날짜는 확인", "• Confirm AM/PM and weekend day")}</p>
            <p>{t("• 설정에서 데이터 내려받기·삭제", "• Export or delete data from Settings")}</p>
          </div>

          <button
            type="button"
            onClick={() => setFeedbackOpen(true)}
            className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-4 text-sm font-semibold text-ink shadow-card touch-press"
          >
            <MessageSquarePlus size={16} aria-hidden />
            {t("피드백 보내기", "Send feedback")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-4 text-sm font-bold text-ink touch-press"
          >
            {t("완료", "Done")}
          </button>
        </div>
      </BottomSheet>
      <FeedbackSheet open={feedbackOpen} onClose={closeFeedback} />
    </>
  );
}
