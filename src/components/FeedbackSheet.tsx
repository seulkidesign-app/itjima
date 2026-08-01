import { useEffect, useState } from "react";
import {
  Bug,
  Lightbulb,
  MessageSquare,
  Send,
  Frown,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { confirm as hapticConfirm } from "@/lib/haptics";
import { BottomSheet } from "@/components/BottomSheet";
import { track } from "@/lib/analytics";
import {
  buildFeedbackDiagnostics,
  formatDiagnosticsBlock,
} from "@/lib/feedbackDiagnostics";
import {
  clearFeedbackDraft,
  readFeedbackDraft,
  writeFeedbackDraft,
} from "@/lib/feedbackDraft";
import type { Database } from "@/integrations/supabase/types";

type Category = Database["public"]["Enums"]["feedback_category"];

type UiCategory = {
  key: Category;
  icon: typeof Bug;
  ko: string;
  en: string;
};

const CATEGORIES: UiCategory[] = [
  { key: "question", icon: Frown, ko: "불편한 점", en: "Pain point" },
  { key: "suggestion", icon: Lightbulb, ko: "아이디어", en: "Idea" },
  { key: "bug", icon: Bug, ko: "오류", en: "Bug" },
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
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  useEffect(() => {
    if (!open) return;
    track("feedback_opened");
    const saved = readFeedbackDraft();
    if (saved) {
      setCategory(saved.category as Category);
      setMessage(saved.message);
      setEmail(saved.email);
      setIncludeDiagnostics(saved.includeDiagnostics);
    } else {
      setCategory("suggestion");
      setMessage("");
      setEmail("");
      setIncludeDiagnostics(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sync = () => setOffline(!navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    writeFeedbackDraft({
      category,
      message,
      email,
      includeDiagnostics,
    });
  }, [open, category, message, email, includeDiagnostics]);

  const submit = async () => {
    const msg = message.trim();
    if (msg.length < 2) {
      toast.error(t("두세 마디만 더 적어 주세요", "A few more words would help"));
      return;
    }
    if (msg.length > 2000) {
      toast.error(
        t("2000자 이내로 적어주세요", "Keep it under 2000 characters"),
      );
      return;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error(t("이메일 주소를 다시 확인해 주세요", "Check that email address"));
      return;
    }
    if (offline) {
      toast.error(
        t(
          "오프라인이에요. 연결되면 다시 보내 주세요",
          "You're offline. Try again when connected",
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const diagnostics = includeDiagnostics
        ? formatDiagnosticsBlock(buildFeedbackDiagnostics())
        : "";
      const { error } = await supabase.from("feedback").insert({
        user_id: userId,
        email: email.trim() || null,
        category,
        message: `${msg}${diagnostics}`.slice(0, 4000),
        user_agent:
          typeof navigator !== "undefined"
            ? navigator.userAgent.slice(0, 500)
            : null,
        page_path:
          typeof window !== "undefined" ? window.location.pathname : null,
      });
      if (error) throw error;
      hapticConfirm();
      track("feedback_submitted", { category });
      clearFeedbackDraft();
      toast.success(
        t("고마워요, 꼭 읽을게요", "Thanks — we'll read every word"),
      );
      onClose();
    } catch (e: unknown) {
      toast.error(
        e instanceof Error
          ? e.message
          : t("못 보냈어요 · 한 번 더", "Didn't go through — try once more"),
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
      title={t("의견 보내기", "Share your thoughts")}
    >
      <div className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-4">
        <div className="mb-3">
          <div className="text-[18px] font-bold text-ink">
            {t("의견 보내기", "Share your thoughts")}
          </div>
          <div className="text-xs text-ink-soft">
            {t(
              "불편한 점이나 아이디어를 알려주세요",
              "Tell us what's wrong or what you'd like",
            )}
          </div>
        </div>

        {offline && (
          <div
            role="status"
            className="mb-3 rounded-[16px] bg-meta/10 px-3.5 py-2.5 text-[13px] font-medium text-meta"
          >
            {t(
              "오프라인이에요 · 적은 건 기기에 남아 있어요",
              "Offline — your draft stays on this device",
            )}
          </div>
        )}

        <div className="mb-3 grid grid-cols-4 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
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

        <textarea aria-label={t(
            "어떤 점이 불편했나요? 어떤 아이디어가 있나요?",
            "What was annoying? What would you improve?",
          )}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder={t(
            "어떤 점이 불편했나요? 어떤 아이디어가 있나요?",
            "What was annoying? What would you improve?",
          )}
          className="w-full resize-none rounded-[24px] bg-white/60 px-3.5 py-3 text-[14px] leading-relaxed text-ink placeholder:text-ink-soft/70 input-focus-ring"
        />
        <div className="mt-1 text-right text-[10px] text-ink-soft">
          {message.length} / 2000
        </div>

        <input aria-label={t(
            "답장 받을 이메일 (선택)",
            "Email for reply (optional)",
          )}
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

        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            checked={includeDiagnostics}
            onChange={(e) => setIncludeDiagnostics(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink/20"
          />
          <span>
            {t(
              "진단 정보 포함 (생각 내용 제외)",
              "Include diagnostics (never your thoughts)",
            )}
          </span>
        </label>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || message.trim().length < 2 || offline}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-ink shadow-card disabled:opacity-50"
        >
          <Send size={15} />
          {submitting ? t("전송 중...", "Sending...") : t("보내기", "Send")}
        </button>
      </div>
    </BottomSheet>
  );
}
