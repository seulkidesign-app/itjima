import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { checkIsAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  const t = useT();
  const userId = useUserId();
  const [isAdmin, setIsAdmin] = useState(false);
  const [category, setCategory] = useState<"bug" | "suggestion" | "praise" | "other">("suggestion");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.title = t("정보 — ItJima", "About — ItJima");
  }, [t]);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    checkIsAdmin().then((r) => setIsAdmin(r.isAdmin)).catch(() => setIsAdmin(false));
  }, [userId]);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: userId,
        category,
        message: message.trim(),
        page_path: window.location.pathname,
        user_agent: navigator.userAgent,
      });
      if (error) throw error;
      toast.success(t("피드백 감사해요!", "Thanks for your feedback!"));
      setMessage("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("전송 실패", "Failed to send"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-6 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="nrc-eyebrow">{t("앱 정보", "About the app")}</div>
      <h1 className="nrc-headline">
        It<span className="text-primary">Jima</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        {t(
          "머릿속 생각을 빠르게 적고, 스와이프로 정리하는 멘탈 인박스예요. 로그인하면 기기 간 동기화돼요.",
          "A mental inbox to capture thoughts fast and sort them with a swipe. Sign in to sync across devices.",
        )}
      </p>

      <div className="mt-6 space-y-2">
        {!userId && (
          <Link to="/auth" className="pill-black block text-center">
            {t("로그인 / 회원가입", "Sign in / Sign up")}
          </Link>
        )}
        {isAdmin && (
          <Link to="/admin" className="pill-yellow block text-center">
            {t("관리자", "Admin")}
          </Link>
        )}
      </div>

      <form onSubmit={submitFeedback} className="mt-8 space-y-3 rounded-2xl border border-ink/8 bg-white p-4 shadow-card">
        <h2 className="text-[15px] font-bold text-ink">{t("피드백 보내기", "Send feedback")}</h2>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          className="w-full rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink"
        >
          <option value="bug">{t("버그", "Bug")}</option>
          <option value="suggestion">{t("제안", "Suggestion")}</option>
          <option value="praise">{t("칭찬", "Praise")}</option>
          <option value="other">{t("기타", "Other")}</option>
        </select>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={t("무엇이든 알려주세요", "Tell us anything")}
          className="w-full resize-none rounded-xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5 text-sm text-ink placeholder:text-ink-soft"
        />
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-ink disabled:opacity-60"
        >
          {sending ? t("전송 중...", "Sending...") : t("보내기", "Send")}
        </button>
      </form>
    </div>
  );
}
