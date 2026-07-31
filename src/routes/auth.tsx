import {
  Outlet,
  createFileRoute,
  useNavigate,
  Link,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  authDebug,
  authDebugAuthStateChange,
  authDebugGetSession,
} from "@/lib/authDebug";
import { useLang, useT } from "@/lib/i18n";
import {
  consumeOAuthError,
  mapAuthError,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
  sendPasswordResetEmail,
  oauthDiag,
} from "@/lib/oauth";

export const Route = createFileRoute("/auth")({
  component: AuthRouteShell,
});

/** Parent shell — must render Outlet so /auth/callback can mount. */
function AuthRouteShell() {
  const isCallback = useRouterState({
    select: (state) => state.location.pathname.startsWith("/auth/callback"),
  });
  if (isCallback) return <Outlet />;
  return <AuthLoginPage />;
}

function AuthLoginPage() {
  const t = useT();
  const { lang } = useLang();
  const navigate = useNavigate();
  const emailId = useId();
  const passwordId = useId();
  const passwordHelpId = useId();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const busy = loading || googleLoading;
  const submitDisabled = busy || !email.trim() || password.length < 6;

  useEffect(() => {
    document.title = t("로그인 — Itjima (잊지마)", "Sign in — Itjima (잊지마)");
  }, [t]);

  useEffect(() => {
    authDebug("auth.tsx: page mounted", {
      oauthErrorPending: Boolean(sessionStorage.getItem("itjima.oauth.lastError")),
    });
  }, []);

  useEffect(() => {
    const message = consumeOAuthError();
    if (message) {
      authDebug("auth.tsx: consumed OAuth error from callback failure", {
        message,
      });
      setOauthError(message);
      toast.error(message, { duration: 10000 });
    }
  }, []);

  useEffect(() => {
    let settled = false;

    const finish = (hasSession: boolean, via: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      oauthDiag("auth:loading:done", { hasSession, via });
      if (hasSession) {
        authDebug("auth.tsx: navigate → / (session resolved)", { via });
        void navigate({ to: "/" });
      } else {
        authDebug("auth.tsx: no session — showing login form", { via });
        setReady(true);
      }
    };

    oauthDiag("auth:loading:start", {});

    void authDebugGetSession("auth.tsx:mount_check", () =>
      supabase.auth.getSession(),
    ).then(({ data }) => {
      if (data.session?.user) finish(true, "getSession");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      authDebugAuthStateChange(event, session, "auth.tsx");
      if (event === "INITIAL_SESSION") {
        finish(Boolean(session?.user), "INITIAL_SESSION");
      } else if (event === "SIGNED_IN" && session?.user) {
        finish(true, "SIGNED_IN");
      }
    });

    const timer = window.setTimeout(() => finish(false, "timeout"), 8000);

    return () => {
      settled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle("/");
      if (result.error) {
        toast.error(mapAuthError(result.error.message, lang));
        setGoogleLoading(false);
        return;
      }
      if (!result.redirected) {
        setGoogleLoading(false);
        await navigate({ to: "/" });
      }
    } catch {
      toast.error(
        t(
          "로그인 실패. 다시 시도해 주세요.",
          "Sign-in failed. Please try again.",
        ),
      );
      setGoogleLoading(false);
    }
  };

  const onEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length < 6 || busy) return;

    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await signUpWithEmail(trimmedEmail, password);
        if (error) throw error;

        if (data.session) {
          toast.success(
            t("회원가입 완료! 환영해요.", "Account created! Welcome!"),
          );
          await navigate({ to: "/" });
        } else if (data.user && !data.user.confirmed_at) {
          toast.success(
            t(
              "회원가입 완료! 이메일 인증 링크를 눌러 주세요.",
              "Account created! Confirm it from the email we sent.",
            ),
            { duration: 8000 },
          );
          setMode("signin");
        } else {
          toast.success(
            t(
              "회원가입 완료! 로그인해 주세요.",
              "Account created! Please sign in.",
            ),
          );
          setMode("signin");
        }
      } else {
        const { error } = await signInWithEmail(trimmedEmail, password);
        if (error) throw error;
        toast.success(t("환영해요!", "Welcome back!"));
        await navigate({ to: "/" });
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("오류가 발생했어요", "Something went wrong");
      toast.error(mapAuthError(message, lang));
    } finally {
      setLoading(false);
    }
  };

  const onForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error(t("이메일을 먼저 입력해 주세요", "Enter your email first"));
      document.getElementById(emailId)?.focus();
      return;
    }

    setLoading(true);
    try {
      const { error } = await sendPasswordResetEmail(trimmed);
      if (error) throw error;
      toast.success(
        t(
          "비밀번호 재설정 링크를 보냈어요. 메일함을 확인해 주세요.",
          "Password reset link sent. Check your inbox.",
        ),
        { duration: 8000 },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : t("오류가 발생했어요", "Something went wrong");
      toast.error(mapAuthError(message, lang));
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
          aria-hidden
        />
        <span className="text-[13px] text-ink-soft">
          {t("확인 중…", "Checking session…")}
        </span>
      </div>
    );
  }

  return (
    <main className="relative flex h-full min-h-full flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
      {googleLoading && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm"
          role="status"
          aria-live="assertive"
        >
          <div className="flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/30 border-t-white"
              aria-hidden
            />
            <span className="text-[15px] font-semibold text-white">
              {t("로그인 중…", "Signing in…")}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center text-sm font-medium text-ink-soft"
        >
          {t("← 닫기", "← Close")}
        </Link>
        <div className="text-[15px] font-bold text-ink" aria-label="Itjima">
          It<span className="text-primary">Jima</span>
        </div>
        <div className="w-12" aria-hidden />
      </div>

      {oauthError && (
        <div
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[13px] leading-relaxed text-red-800"
          role="alert"
        >
          {oauthError}
        </div>
      )}

      <div className="mt-10 text-center">
        <h1 className="text-[26px] font-extrabold leading-tight text-ink">
          {mode === "signin"
            ? t("다시 만나서 반가워요", "Good to see you again")
            : t("일정을 어디서든 이어가세요", "Keep your plans across devices")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t(
            "로그인하면 일정과 할 일을 여러 기기에서 동기화할 수 있어요.",
            "Sign in to sync schedules and tasks across devices.",
          )}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={busy}
        className="mt-8 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-[15px] font-semibold text-ink shadow-card transition active:scale-[0.98] disabled:opacity-60"
      >
        {googleLoading ? (
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
            aria-hidden
          />
        ) : (
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
        )}
        {t("Google로 계속하기", "Continue with Google")}
      </button>

      <div className="my-5 flex items-center gap-3 text-[11px] font-medium text-ink-soft">
        <div className="h-px flex-1 bg-ink/10" aria-hidden />
        {t("또는 이메일로", "or with email")}
        <div className="h-px flex-1 bg-ink/10" aria-hidden />
      </div>

      <form onSubmit={onEmail} className="space-y-3" noValidate={false}>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-[12px] font-semibold text-ink-soft">
            {t("이메일", "Email")}
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("name@example.com", "name@example.com")}
            className="min-h-[52px] w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-soft/60 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor={passwordId} className="mb-1.5 block text-[12px] font-semibold text-ink-soft">
            {t("비밀번호", "Password")}
          </label>
          <input
            id={passwordId}
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            enterKeyHint="go"
            aria-describedby={passwordHelpId}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("6자 이상", "6 or more characters")}
            className="min-h-[52px] w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3.5 text-[16px] text-ink placeholder:text-ink-soft/60 outline-none focus:border-blue-500"
          />
          <p id={passwordHelpId} className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
            {mode === "signup"
              ? t("6자 이상 입력해 주세요.", "Use at least 6 characters.")
              : t("가입할 때 사용한 비밀번호를 입력해 주세요.", "Enter the password for this account.")}
          </p>
        </div>

        {mode === "signin" && (
          <button
            type="button"
            onClick={() => void onForgotPassword()}
            disabled={busy}
            className="flex min-h-11 w-full items-center justify-end py-1 text-right text-[12px] font-medium text-ink-soft"
          >
            {t("비밀번호를 잊으셨나요?", "Forgot password?")}
          </button>
        )}

        <button
          type="submit"
          disabled={submitDisabled}
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-primary px-4 py-3.5 text-[15px] font-bold text-ink shadow-card transition active:scale-[0.98] disabled:bg-ink/[0.08] disabled:text-ink-soft disabled:shadow-none"
        >
          {loading ? (
            <span
              className="h-5 w-5 animate-spin rounded-full border-2 border-ink/20 border-t-ink"
              aria-label={t("처리 중", "Working")}
            />
          ) : mode === "signin" ? (
            t("로그인", "Sign in")
          ) : (
            t("회원가입", "Sign up")
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setOauthError(null);
        }}
        disabled={busy}
        className="mt-4 min-h-11 text-center text-[13px] font-medium text-ink-soft"
      >
        {mode === "signin"
          ? t("처음이신가요? 회원가입", "New here? Create an account")
          : t("이미 계정이 있나요? 로그인", "Already have an account? Sign in")}
      </button>

      <p className="mt-auto pt-8 text-center text-[11px] leading-relaxed text-ink-soft">
        {t(
          "로그인 없이도 사용할 수 있어요. 로그인하면 일정과 할 일이 기기 간 동기화됩니다.",
          "You can use Itjima without signing in. An account syncs schedules and tasks across devices.",
        )}
      </p>
    </main>
  );
}
