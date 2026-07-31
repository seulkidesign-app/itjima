import { Plus, Share, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { useScrollLock } from "@/hooks/useScrollLock";

export function IosInstallHint({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement | null>(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      window.requestAnimationFrame(() => {
        if (previous?.isConnected) previous.focus({ preventScroll: true });
      });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] mx-auto flex max-w-[430px] items-end justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
      role="presentation"
    >
      <button
        type="button"
        aria-label={t("설치 안내 닫기", "Close install guide")}
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="ios-install-title"
        aria-describedby="ios-install-description"
        className="relative w-full rounded-[24px] bg-white p-5 shadow-float"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 id="ios-install-title" className="text-base font-bold text-ink">
            {t("홈 화면에 추가하는 법", "How to add to Home Screen")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("닫기", "Close")}
            className="touch-target shrink-0 rounded-full text-ink-soft"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-ink">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              1
            </span>
            <span className="flex-1">
              {t("Safari 하단의 ", "Tap the ")}
              <Share className="inline h-4 w-4 align-text-bottom" aria-hidden />
              {t(" 공유 버튼을 누르세요", " Share button at the bottom of Safari")}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              2
            </span>
            <span className="flex-1">
              {t("메뉴에서 ", "Pick ")}
              <Plus className="inline h-4 w-4 align-text-bottom" aria-hidden />{" "}
              <b>{t('"홈 화면에 추가"', '"Add to Home Screen"')}</b>
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              3
            </span>
            <span className="flex-1">
              {t("우측 상단 ", "Tap ")}
              <b>{t('"추가"', '"Add"')}</b>
              {t(" 탭하면 끝!", " in the top right — done!")}
            </span>
          </li>
        </ol>
        <p id="ios-install-description" className="mt-4 text-xs text-ink-soft">
          {t(
            "홈 화면 앱에서만 닫힌 앱 알림을 받을 수 있어요.",
            "Closed-app alerts only work from the Home Screen app.",
          )}
        </p>
      </div>
    </div>
  );
}
