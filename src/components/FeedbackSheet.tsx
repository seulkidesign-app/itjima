import { useEffect, useState } from "react";
import {
  Bug,
  Lightbulb,
  Heart,
  HelpCircle,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { confirm as hapticConfirm } from "@/lib/haptics";
import { BottomSheet } from "@/components/BottomSheet";

type Category = "question" | "bug" | "suggestion" | "praise" | "other";

const CATEGORIES: {
  key: Category;
  icon: typeof Bug;
  ko: string;
  en: string;
}[] = [
  { key: "question", icon: HelpCircle, ko: "문의", en: "Ask" },
  { key: "bug", icon: Bug, ko: "버그", en: "Bug" },
  { key: "suggestion", icon: Lightbulb, ko: "제안", en: "Idea" },
  { key: "praise", icon: Heart, ko: "칭찬", en: "Love" },
  { key: "other", icon: MessageSquare, ko: "기타", en: "Other" },
];

export function FeedbackSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [category, setCategory] = useState<Category>("suggestion");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory("suggestion");
    setMessage("");
    setEmail("");
  }, [open]);

  const submit = async () => {
    const msg = message.trim();
    if (msg.length < 2) {
      toast.error(t("내용을 조금 더 적어주세요", "Please write a bit more"));
      return;
    }
    if (msg.length > 2000) {
      toast.error(
        t("2000자 이내로 적어주세요", "Keep it under 2000 characters"),
      );
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error(t("이메일 형식이 올바르지 않아요", "Invalid email"));
      return;
    }
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const { error } = await supabase.from("feedback").insert({
        user_id: userId,
        email: email.trim() || null,
        category,
        message: msg,
        user_agent:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 500)
            : null,
        page_path:
          typeof window !== "undefined" ? window.location.pathname : null,
      });
      if (error) throw error;
      hapticConfirm();
      toast.success(
        t("피드백 고마워요! 잘 읽을게요 🙌", "Thanks for the feedback!"),
      );
      onClose();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : t("전송 실패", "Failed to send"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="88dvh"
      title={t("문의 · 피드백", "Contact · Feedback")}
    >
      <div className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
        <div className="mb-3">
          <div className="text-[18px] font-bold text-ink">
            {t("문의 · 피드백", "Contact · Feedback")}
          </div>
          <div className="text-xs text-ink-soft">
            {t(
              "궁금한 점이나 의견을 남겨주세요",
              "Questions or thoughts — drop them here",
            )}
          </div>
        </div>

        <div className="mb-3 grid grid-cols-5 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-full py-2 text-[11px] font-semibold transition ${
                  active
                    ? "bg-primary text-ink shadow-card"
                    : "bg-white/50 text-ink-soft hover:bg-white/70"
                }`}
              >
                <Icon size={16} />
                {t(c.ko, c.en)}
              </button>
            );
          })}
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={t(
            "어떤 점이 좋았나요? 어떤 점이 불편했나요?",
            "What did you like? What was annoying?",
          )}
          className="w-full resize-none rounded-[24px] bg-white/60 px-3.5 py-3 text-[14px] leading-relaxed text-ink placeholder:text-ink-soft/70 input-focus-ring"
        />
        <div className="mt-1 text-right text-[10px] text-ink-soft">
          {message.length} / 2000
        </div>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={255}
          placeholder={t(
            "답장 받을 이메일 (선택)",
            "Email for reply (optional)",
          )}
          className="mt-2 w-full rounded-full bg-white/60 px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-soft/70 input-focus-ring"
        />

        <button
          onClick={submit}
          disabled={submitting || message.trim().length < 2}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-ink shadow-card disabled:opacity-50"
        >
          <Send size={15} />
          {submitting ? t("전송 중...", "Sending...") : t("보내기", "Send")}
        </button>
      </div>
    </BottomSheet>
  );
}
