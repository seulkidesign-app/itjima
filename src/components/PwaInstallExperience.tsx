import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Download,
  MoreVertical,
  PlusSquare,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { useT } from "@/lib/i18n";
import {
  getPwaInstallSnapshot,
  requestPwaInstall,
  subscribePwaInstall,
} from "@/lib/pwaInstall";
import { tap } from "@/lib/haptics";

const DISMISSED_UNTIL_KEY = "itjima_pwa_install_dismissed_until";
const DISMISS_DAYS = 7;

function readDismissedUntil(): number {
  if (typeof window === "undefined") return 0;
  const value = Number(window.localStorage.getItem(DISMISSED_UNTIL_KEY));
  return Number.isFinite(value) ? value : 0;
}

function rememberDismissal() {
  const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1_000;
  window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
}

export function PwaInstallExperience() {
  const t = useT();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const mode = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    () => "manual",
  );
  const [visible, setVisible] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (mode === "installed") {
      setVisible(false);
      return;
    }

    const eligibleRoute = pathname === "/about" || pathname === "/";
    const dismissedOnAppHome =
      pathname === "/" && Date.now() < readDismissedUntil();
    if (!eligibleRoute || dismissedOnAppHome) {
      setVisible(false);
      return;
    }

    const delay = pathname === "/about" ? 900 : 4_500;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [mode, pathname]);

  if (mode === "installed" || !visible) return null;

  const description =
    mode === "ios"
      ? t(
          "Safari 공유 버튼에서 홈 화면에 추가하면 앱처럼 바로 열려요.",
          "Use Safari's Share menu to add Itjima to your Home Screen.",
        )
      : mode === "prompt"
        ? t(
            "한 번 추가하면 주소 입력 없이 앱처럼 바로 열 수 있어요.",
            "Install once and open Itjima like an app without typing the address.",
          )
        : t(
            "브라우저 메뉴의 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.",
            "Choose Install app or Add to Home Screen from your browser menu.",
          );

  const handleInstall = async () => {
    tap();
    if (mode !== "prompt") {
      setGuideOpen(true);
      return;
    }

    const outcome = await requestPwaInstall();
    if (outcome === "accepted") {
      setVisible(false);
      toast.success(t("홈 화면에 추가했어요", "Itjima was installed"));
      return;
    }
    if (outcome === "dismissed") {
      toast(
        t(
          "랜딩페이지에서 언제든 다시 추가할 수 있어요",
          "You can install it later from the landing page",
        ),
      );
      return;
    }
    setGuideOpen(true);
  };

  const dismiss = () => {
    tap();
    if (pathname === "/") rememberDismissal();
    setVisible(false);
  };

  return (
    <>
      <aside
        data-testid="pwa-install-nudge"
        className={`fixed left-3 right-3 z-[85] mx-auto max-w-[520px] rounded-[22px] border border-black/[0.09] bg-white/95 p-3.5 shadow-[0_18px_50px_rgba(0,0,0,.16)] backdrop-blur-xl ${
          pathname === "/about"
            ? "bottom-3 sm:bottom-5"
            : "bottom-[calc(88px+env(safe-area-inset-bottom))] sm:bottom-5"
        }`}
        aria-label={t("잊지마 홈 화면 추가 안내", "Install Itjima")}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-primary text-ink shadow-card">
            <Smartphone size={21} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[15px] font-black tracking-[-0.02em] text-ink">
              {t("홈 화면에 추가하기", "Add Itjima to your home screen")}
            </strong>
            <p className="mt-1 text-[12px] font-medium leading-[1.55] text-ink-soft">
              {description}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("설치 안내 닫기", "Dismiss install tip")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/[0.05]"
          >
            <X size={17} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          data-testid="pwa-install-action"
          onClick={() => void handleInstall()}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[15px] bg-primary px-4 text-[13px] font-black text-ink"
        >
          <Download size={17} strokeWidth={2.3} aria-hidden />
          {mode === "prompt"
            ? t("지금 추가", "Install now")
            : t("추가 방법 보기", "See how to install")}
        </button>
      </aside>

      <BottomSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        maxHeight="72dvh"
        title={t("홈 화면에 추가", "Add to Home Screen")}
      >
        <div className="px-5 pb-8 pt-2" data-testid="pwa-install-guide">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-primary/25 text-ink">
            <Smartphone size={27} strokeWidth={2.1} aria-hidden />
          </div>
          <h2 className="mt-4 text-center text-[21px] font-black tracking-[-0.035em] text-ink">
            {t("잊지마를 앱처럼 열기", "Open Itjima like an app")}
          </h2>
          <p className="mx-auto mt-2 max-w-[30rem] text-center text-[13px] leading-relaxed text-ink-soft">
            {t(
              "설치하면 홈 화면에서 바로 열 수 있고 전체 화면으로 사용할 수 있어요.",
              "Install it to open from your home screen and use it in a full-screen app window.",
            )}
          </p>

          <ol className="mt-6 space-y-3">
            {mode === "ios" ? (
              <>
                <GuideStep
                  icon={<Share2 size={18} aria-hidden />}
                  number="1"
                  title={t(
                    "Safari의 공유 버튼 누르기",
                    "Tap Safari's Share button",
                  )}
                  detail={t(
                    "화면 아래의 네모와 위쪽 화살표 아이콘이에요.",
                    "It is the square icon with an upward arrow.",
                  )}
                />
                <GuideStep
                  icon={<PlusSquare size={18} aria-hidden />}
                  number="2"
                  title={t(
                    "‘홈 화면에 추가’ 선택",
                    "Choose Add to Home Screen",
                  )}
                  detail={t(
                    "메뉴를 아래로 조금 내리면 보여요.",
                    "Scroll the share menu a little if needed.",
                  )}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="3"
                  title={t(
                    "오른쪽 위 ‘추가’ 누르기",
                    "Tap Add in the top-right",
                  )}
                  detail={t(
                    "이제 홈 화면의 잊지마 아이콘으로 열 수 있어요.",
                    "You can now open Itjima from its home-screen icon.",
                  )}
                />
              </>
            ) : (
              <>
                <GuideStep
                  icon={<MoreVertical size={18} aria-hidden />}
                  number="1"
                  title={t("브라우저 메뉴 열기", "Open the browser menu")}
                  detail={t(
                    "주소창 옆의 메뉴 아이콘을 눌러요.",
                    "Use the menu icon next to the address bar.",
                  )}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="2"
                  title={t("‘앱 설치’ 선택", "Choose Install app")}
                  detail={t(
                    "기기에 따라 ‘홈 화면에 추가’로 표시될 수 있어요.",
                    "Some devices call this Add to Home Screen.",
                  )}
                />
              </>
            )}
          </ol>
        </div>
      </BottomSheet>
    </>
  );
}

function GuideStep({
  icon,
  number,
  title,
  detail,
}: {
  icon: ReactNode;
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3 rounded-[17px] border border-ink/[0.07] bg-ink/[0.025] p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white text-ink shadow-card">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[13px] font-bold text-ink">
          {number}. {title}
        </strong>
        <span className="mt-1 block text-[11px] leading-relaxed text-ink-soft">
          {detail}
        </span>
      </span>
    </li>
  );
}
