import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { completeAuthCallback } from "@/lib/oauth";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const t = useT();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    document.title = t("로그인 처리 중 — ItJima", "Signing in — ItJima");
  }, [t]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const result = await completeAuthCallback();

      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message, { duration: 8000 });
        window.location.replace("/auth");
        return;
      }

      toast.success(
        t("로그인됐어요. 다시 만나서 반가워요!", "Signed in. Welcome back!"),
      );
      window.location.replace(result.nextPath || "/");
    })();
  }, [t]);

  return (
    <div className="flex h-full min-h-full flex-col items-center justify-center px-6 text-center">
      {!message ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ink/15 border-t-ink" />
          <p className="mt-4 text-[15px] font-semibold text-ink">
            {t("로그인 마무리 중...", "Finishing sign-in...")}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {t("잠시만 기다려 주세요.", "Just a moment.")}
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
