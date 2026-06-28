import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLang, useT } from "@/lib/i18n";
import {
  consumeOAuthError,
  mapAuthError,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "@/lib/oauth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  useEffect(() => {
    document.title = t("로그인 — ItJima", "Sign in — ItJima");
  }, [t]);

  useEffect(() => {
    const message = consumeOAuthError();
    if (message) {
      setOauthError(message);
      toast.error(message, { duration: 10000 });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) navigate({ to: "/" });
      else setReady(true);
    });
  }, [navigate]);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        navigate({ to: "/" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const r = await signInWithGoogle("/");
      if (r.error) {
        toast.error(mapAuthError(r.error.message, lang));
        setGoogleLoading(false);
        return;
      }
      if (!r.redirected) {
        setGoogleLoading(false);
        navigate({ to: "/" });
      }
    } catch {
      toast.error(t("로그인 실패. 다시 시도해주세요.", "Sign-in failed. Please try again."));
      setGoogleLoading(false);
    }
  };

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !pw) return;
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await signUpWithEmail(email.trim(), pw);
        if (error) throw error;

        if (data.session) {
          toast.success(t("회원가입 완료! 환영해요.", "Account created! Welcome!"));
          navigate({ to: "/" });
        } else if (data.user && !data.user.confirmed_at) {
          toast.success(
            t(
              "회원가입 완료! 이메일로 온 인증 링크를 눌러주세요.",
              "Account created! Please confirm via the email link.",
            ),
            { duration: 8000 },
          );
          setMode("signin");
        } else {
          toast.success(t("회원가입 완료! 로그인해 주세요.", "Account created! Please sign in."));
          setMode("signin");
        }
      } else {
        const { error } = await signInWithEmail(email.trim(), pw);
        if (error) throw error;
        toast.success(t("환영해요!", "Welcome back!"));
        navigate({ to: "/" });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("오류가 발생했어요", "Something went wrong");
      toast.error(mapAuthError(message, lang));
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-full flex-col px-6 pb-10 pt-[calc(env(safe-area-inset-top)+1rem)] relative">
      {googleLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
            <span className="text-[15px] font-semibold text-white">{t("로그인 중...", "Signing in...")}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm font-medium text-ink-soft">
          {t("← 닫기", "← Close")}
        </Link>
        <div className="text-[15px] font-bold text-ink">
          It<span className="text-primary">Jima</span>
        </div>
        <div className="w-12" />
      </div>

      {oauthError && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[13px] leading-relaxed text-red-800">
          {oauthError}
        </div>
      )}

      <div className="mt-10 text-center">
        <div className="text-[26px] font-extrabold leading-tight text-ink">
          {mode === "signin"
            ? t("다시 만나서 반가워요", "Good to see you again")
            : t("머릿속, 함께 비워요", "Let's empty your head together")}
        </div>
        <div className="mt-2 text-sm text-ink-soft">
          {t("로그인하면 어디서든 생각을 이어갈 수 있어요.", "Sign in to keep your thoughts on any device.")}
        </div>
      </div>

      <button
        onClick={onGoogle}
        disabled={googleLoading || loading}
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-60"
      >
        {googleLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.4 29.3 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5c10.8 0 19.5-8.7 19.5-19.5 0-1.2-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.6 1.1 7.6 2.9l5.7-5.7C33.6 6.3 29 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 43.5c5 0 9.4-1.7 12.8-4.6l-5.9-5c-2 1.4-4.4 2.1-6.9 2.1-5.2 0-9.6-3.1-11.3-7.5l-6.5 5C9.5 39.1 16.2 43.5 24 43.5z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.4-2.5 4.4-4.5 5.9l5.9 5C40.3 36.4 44 30.7 44 24c0-1.2-.1-2.3-.4-3.5z" />
          </svg>
        )}
        {t("Google로 계속하기", "Continue with Google")}
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-ink-soft">
        <div className="h-px flex-1 bg-white/60" />
        {t("또는 이메일로", "or with email")}
        <div className="h-px flex-1 bg-white/60" />
      </div>

      <form onSubmit={onEmail} className="space-y-2.5">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("이메일", "Email")}
          className="w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-soft outline-none focus:border-primary"
        />
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={t("비밀번호 (6자 이상)", "Password (6+ characters)")}
          className="w-full rounded-2xl border border-white/70 bg-white/85 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-soft outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full rounded-2xl bg-primary py-3.5 text-[15px] font-bold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-60"
        >
          {loading ? (
            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink" />
          ) : mode === "signin" ? (
            t("로그인", "Sign in")
          ) : (
            t("회원가입", "Sign up")
          )}
        </button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-4 text-center text-[13px] font-medium text-ink-soft"
      >
        {mode === "signin"
          ? t("처음이신가요? 회원가입", "New here? Create an account")
          : t("이미 계정이 있나요? 로그인", "Already have an account? Sign in")}
      </button>

      <div className="mt-auto pt-8 text-center text-[11px] text-ink-soft">
        {t(
          "로그인 없이도 사용 가능해요. 로그인하면 기기 간 동기화돼요.",
          "You can use it without signing in — signing in syncs across devices.",
        )}
      </div>
    </div>
  );
}
