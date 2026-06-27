import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";
import { dismissLogin } from "@/lib/store";
import { useT } from "@/lib/i18n";

export function LoginSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const onGoogle = async () => {
    setLoading(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      alert(t("로그인 실패. 다시 시도해주세요.", "Sign-in failed. Please try again."));
      setLoading(false);
      return;
    }
    if (!r.redirected && !r.error) {
      setLoading(false);
      onClose();
    }
    // if redirected, loading stays true until page redirects
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col" onClick={onClose}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            <span className="text-[14px] font-semibold text-white">{t("로그인 중...", "Signing in...")}</span>
          </div>
        </div>
      )}

      {/* Dim overlay */}
      <div
        className="flex-1 transition-opacity duration-300"
        style={{ background: "rgba(0,0,0,0.5)" }}
      />

      {/* Sheet */}
      <div
        className="glass-strong animate-slide-up rounded-t-[28px] px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-ink/15" />
        <div className="text-center">
          <div className="text-[22px] font-bold text-ink">
            {t("기기 간에 동기화할까요?", "Sync across devices?")}
          </div>
          <div className="mt-1 text-sm text-ink-soft">
            {t("로그인하면 어디서든 생각을 이어갈 수 있어요.", "Sign in to keep your thoughts on any device.")}
          </div>
        </div>
        <button
          onClick={onGoogle}
          disabled={loading}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-ink shadow-card active:scale-[0.98] transition disabled:opacity-60"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 43.5c5 0 9.4-1.7 12.8-4.6l-5.9-5c-2 1.4-4.4 2.1-6.9 2.1-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.5 4.4-4.5 5.9l5.9 5C40.3 36.4 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"/>
            </svg>
          )}
          {t("Google 로그인", "Continue with Google")}
        </button>
        <button
          onClick={() => { dismissLogin(); onClose(); }}
          className="mt-2 w-full rounded-2xl py-3 text-sm font-medium text-ink-soft"
        >
          {t("나중에 할게요", "Maybe later")}
        </button>
      </div>
    </div>
  );
}
