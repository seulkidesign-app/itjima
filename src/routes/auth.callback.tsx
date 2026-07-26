import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { completeAuthCallback, oauthDiag } from "@/lib/oauth";
import { authDebug, authDebugNavigateToAuth } from "@/lib/authDebug";
import { useLang, useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const t = useT();
  const { lang } = useLang();
  const [message, setMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const started = useRef(false);

  useEffect(() => {
    document.title = t(
      "로그인 처리 중 — Itjima (잊지마)",
      "Signing in — Itjima (잊지마)",
    );
  }, [t]);

  useEffect(() => {
    if (started.current) {
      authDebug("auth.callback: effect skipped (started ref)", {
        strictModeRemountGuard: true,
      });
      return;
    }
    started.current = true;

    authDebug("auth.callback: effect started", {
      mountId: crypto.randomUUID().slice(0, 8),
    });
    oauthDiag("callback:page:started", {
      href: window.location.href,
      hasCode: new URLSearchParams(window.location.search).has("code"),
      authLoading: true,
    });

    (async () => {
      const result = await completeAuthCallback(lang);
      setAuthLoading(false);
      oauthDiag("callback:page:finished", {
        ok: result.ok,
        authLoading: false,
        nextPath: result.ok ? result.nextPath : null,
        message: result.ok ? null : result.message,
      });

      authDebug("auth.callback: completeAuthCallback result", {
        ok: result.ok,
        nextPath: result.ok ? result.nextPath : null,
        message: result.ok ? null : result.message,
      });

      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message, { duration: 8000 });
        authDebugNavigateToAuth("auth.callback.tsx:callback_failure", {
          failureMessage: result.message,
        });
        window.location.replace("/auth");
        return;
      }

      toast.success(
        t("로그인됐어요. 다시 만나서 반가워요!", "Signed in. Welcome back!"),
      );
      authDebug("auth.callback: redirect after success", {
        nextPath: result.nextPath || "/",
      });
      window.location.replace(result.nextPath || "/");
    })();
  }, [t, lang]);

  return (
    <div className="flex h-full min-h-full flex-col items-center justify-center px-6 text-center">
      {!message ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink/15 border-t-ink" />
          <p className="mt-4 text-[15px] font-semibold text-ink">
            {t("로그인 마무리 중...", "Finishing sign-in...")}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {authLoading
              ? t("잠시만 기다려 주세요.", "Just a moment.")
              : t("이동 중...", "Redirecting...")}
          </p>
        </>
      ) : (
        <>
          <p className="text-[15px] font-semibold text-ink">{message}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {t("로그인 화면으로 돌아갈게요.", "Returning to sign-in...")}
          </p>
        </>
      )}
    </div>
  );
}
