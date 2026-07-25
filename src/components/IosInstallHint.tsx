import { Plus, Share, X } from "lucide-react";
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
  useScrollLock(open);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] mx-auto flex max-w-[430px] items-end justify-center bg-black/40 px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-[24px] bg-white p-5 shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 id="ios-install-title" className="text-base font-bold text-ink">
            {t("홈 화면에 추가하는 법", "How to add to Home Screen")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("닫기", "Close")}
            className="touch-target rounded-full text-ink-soft"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-ink">
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              1
            </span>
            <span className="flex-1">
              {t("Safari 하단의 ", "Tap the ")}
              <Share className="inline h-4 w-4 align-text-bottom" />
              {t(" 공유 버튼을 누르세요", " Share button at the bottom of Safari")}
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
              2
            </span>
            <span className="flex-1">
              {t("메뉴에서 ", "Pick ")}
              <Plus className="inline h-4 w-4 align-text-bottom" />{" "}
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
        <p className="mt-4 text-xs text-ink-soft">
          {t(
            "※ Chrome이 아닌 Safari에서 열어야 추가할 수 있어요.",
            "※ Must be opened in Safari (not Chrome) to install.",
          )}
        </p>
      </div>
    </div>
  );
}
