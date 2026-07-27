import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BottomSheet } from "@/components/BottomSheet";
import { signInWithGoogle, mapAuthError } from "@/lib/oauth";
import { dismissLogin } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";

function currentReturnPath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function LoginSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);

  const closeSafely = () => {
    if (!loading) onClose();
  };

  const onGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle(currentReturnPath());
      if (result.error) {
        toast.error(mapAuthError(result.error.message, lang));
        setLoading(false);
        return;
      }
      if (!result.redirected) {
        setLoading(false);
        onClose();
      }
    } catch {
      toast.error(
        t(
          "로그인 연결에 문제가 있어요. 다시 시도해 주세요.",
          "Could not start sign-in. Please try again.",
        ),
      );
      setLoading(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={closeSafely}
      maxHeight="70dvh"
      title={t("로그인", "Sign in")}
    >
      <div className="relative px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-2">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex min-h-[22rem] flex-col items-center justify-center rounded-t-[28px] bg-white/92 backdrop-blur-xl"
            role="status"
            aria-live="polite"
          >
            <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-ink/15 border-t-ink" />
            <span className="mt-3 text-[14px] font-semibold text-ink">
              {t("로그인 중...", "Signing in...")}
            </span>
          </div>
        )}

        <div className="text-center">
          <div className="text-[22px] font-bold text-ink">
            {t(
              "기기 간에 이어갈까요?",
              "Keep your thoughts across devices?",
            )}
          </div>
          <div className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t(
              "로그인하면 어디서든 같은 기억함을 열 수 있어요.",
              "Sign in to open the same vault on any device.",
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void onGoogle()}
          disabled={loading}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white py-3.5 text-[15px] font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 43.5c5 0 9.4-1.7 12.8-4.6l-5.9-5c-2 1.4-4.4 2.1-6.9 2.1-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.5 4.4-4.5 5.9l5.9 5C40.3 36.4 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z"
            />
          </svg>
          {t("Google 로그인", "Continue with Google")}
        </button>

        <Link
          to="/auth"
          onClick={onClose}
          className="mt-2 block min-h-12 w-full rounded-full py-3 text-center text-sm font-semibold text-ink"
        >
          {t("이메일로 가입/로그인", "Sign in with email")}
        </Link>

        <button
          type="button"
          disabled={loading}
          onClick={() => {
            dismissLogin();
            onClose();
          }}
          className="mt-1 min-h-12 w-full rounded-full py-3 text-sm font-medium text-ink-soft disabled:opacity-50"
        >
          {t("나중에 할게요", "Maybe later")}
        </button>
      </div>
    </BottomSheet>
  );
}
