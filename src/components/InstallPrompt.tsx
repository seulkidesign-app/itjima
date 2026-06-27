import { useEffect, useState } from "react";
import { X, Share, Plus, Download } from "lucide-react";
import { useT } from "@/lib/i18n";
import { track } from "@/lib/analytics";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "itjima_install_dismissed_at";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true
  );
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
}

function recentlyDismissed() {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    const days = (Date.now() - Number(v)) / 86400000;
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const t = useT();
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);


  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
      setShow(true);
    };
    const onInstalled = () => {
      track("pwa_installed", { platform: isIOS() ? "ios" : "android" });
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    if (isIOS()) {
      const t = setTimeout(() => setShow(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBIP);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setShow(false);
    setIosHint(false);
  };

  const install = async () => {
    if (bip) {
      track("pwa_install_prompted", { platform: "android" });
      await bip.prompt();
      const res = await bip.userChoice;
      track("pwa_install_choice", { platform: "android", outcome: res.outcome });
      dismiss();
    } else if (isIOS()) {
      track("pwa_install_prompted", { platform: "ios" });
      setIosHint(true);
    }
  };

  if (!show) return null;

  return (
    <>
      <div className="fixed left-1/2 bottom-24 z-40 w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-xl">
        <button
          onClick={dismiss}
          aria-label={t("닫기", "Close")}
          className="absolute right-2 top-2 rounded-full p-1 text-ink-soft hover:bg-ink/5"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-3 pr-6">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow text-ink">
            <Download className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t("홈 화면에 추가", "Add to Home Screen")}</p>
            <p className="truncate text-xs text-ink-soft">{t("앱처럼 한 번에 열어요", "Open it like a native app")}</p>
          </div>
          <button
            onClick={install}
            className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white"
          >
            {t("추가", "Add")}
          </button>
        </div>
      </div>

      {iosHint && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6"
          onClick={dismiss}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">{t("홈 화면에 추가하는 법", "How to add to Home Screen")}</h3>
              <button onClick={dismiss} aria-label={t("닫기", "Close")} className="rounded-full p-1 text-ink-soft">
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-ink">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
                  1
                </span>
                <span className="flex-1">
                  {t("Safari 하단의 ", "Tap the ")}<Share className="inline h-4 w-4 align-text-bottom" />{t(" 공유 버튼을 누르세요", " Share button at the bottom of Safari")}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
                  2
                </span>
                <span className="flex-1">
                  {t("메뉴에서 ", "Pick ")}<Plus className="inline h-4 w-4 align-text-bottom" /> <b>{t("\"홈 화면에 추가\"", "\"Add to Home Screen\"")}</b>{t(" 선택", "")}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow text-xs font-bold text-ink">
                  3
                </span>
                <span className="flex-1">{t("우측 상단 ", "Tap ")}<b>{t("\"추가\"", "\"Add\"")}</b>{t(" 탭하면 끝!", " in the top right — done!")}</span>
              </li>
            </ol>
            <p className="mt-4 text-xs text-ink-soft">
              {t("※ Chrome이 아닌 Safari에서 열어야 추가할 수 있어요.", "※ Must be opened in Safari (not Chrome) to install.")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
