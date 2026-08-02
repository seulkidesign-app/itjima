import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Download,
  Menu,
  MonitorDown,
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
  isIosDevice,
  requestPwaInstall,
  subscribePwaInstall,
} from "@/lib/pwaInstall";
import { tap } from "@/lib/haptics";

type GuideTarget = "chrome-desktop" | "chrome-android" | "ios";

function defaultGuideTarget(): GuideTarget {
  if (typeof navigator === "undefined") return "chrome-desktop";
  if (isIosDevice()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "chrome-android";
  return "chrome-desktop";
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
  const [guideTarget, setGuideTarget] =
    useState<GuideTarget>(defaultGuideTarget);

  useEffect(() => {
    const eligibleRoute = pathname === "/about" || pathname === "/";
    setVisible(mode !== "installed" && eligibleRoute);
  }, [mode, pathname]);

  if (mode === "installed" || !visible) return null;

  const description =
    mode === "prompt"
      ? t(
          "Chrome 설치 창을 바로 열거나, PC·모바일 설치 과정을 자세히 볼 수 있어요.",
          "Open Chrome's install prompt now, or see the full desktop and mobile steps.",
        )
      : mode === "ios"
        ? t(
            "공유 메뉴에서 홈 화면에 추가하면 잊지마를 앱처럼 바로 열 수 있어요.",
            "Use the Share menu to add Itjima to your Home Screen.",
          )
        : t(
            "PC Chrome과 모바일 Chrome의 설치 위치를 단계별로 확인할 수 있어요.",
            "See exactly where to install Itjima in desktop and mobile Chrome.",
          );

  const openGuide = () => {
    tap();
    setGuideTarget(defaultGuideTarget());
    setGuideOpen(true);
  };

  const handleNativeInstall = async () => {
    tap();
    const outcome = await requestPwaInstall();
    if (outcome === "accepted") {
      setVisible(false);
      toast.success(t("잊지마를 앱으로 설치했어요", "Itjima was installed"));
      return;
    }
    if (outcome === "dismissed") {
      toast(
        t(
          "설치하지 않았어요. ‘자세한 방법’에서 다시 확인할 수 있어요.",
          "It was not installed. You can try again from Detailed steps.",
        ),
      );
      return;
    }
    openGuide();
  };

  const dismiss = () => {
    tap();
    setVisible(false);
  };

  return (
    <>
      <aside
        data-testid="pwa-install-nudge"
        className={`fixed left-3 right-3 z-[85] mx-auto max-w-[540px] rounded-[22px] border border-black/[0.09] bg-white/95 p-3.5 shadow-[0_18px_50px_rgba(0,0,0,.16)] backdrop-blur-xl ${
          pathname === "/about"
            ? "bottom-3 sm:bottom-5"
            : "bottom-[calc(88px+env(safe-area-inset-bottom))] sm:bottom-5"
        }`}
        aria-label={t("잊지마 앱 설치 안내", "Install Itjima")}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-primary text-ink shadow-card">
            <Smartphone size={21} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block text-[15px] font-black tracking-[-0.02em] text-ink">
              {t("Chrome에서 앱으로 설치", "Install Itjima in Chrome")}
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

        <div className={`mt-3 grid gap-2 ${mode === "prompt" ? "grid-cols-2" : "grid-cols-1"}`}>
          {mode === "prompt" && (
            <button
              type="button"
              data-testid="pwa-install-action"
              onClick={() => void handleNativeInstall()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] bg-primary px-3 text-[13px] font-black text-ink"
            >
              <Download size={17} strokeWidth={2.3} aria-hidden />
              {t("지금 설치", "Install now")}
            </button>
          )}
          <button
            type="button"
            data-testid="pwa-install-guide-action"
            onClick={openGuide}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[15px] px-3 text-[13px] font-black ${
              mode === "prompt"
                ? "border border-ink/[0.1] bg-white text-ink"
                : "bg-primary text-ink"
            }`}
          >
            <Menu size={17} strokeWidth={2.3} aria-hidden />
            {t("자세한 방법", "Detailed steps")}
          </button>
        </div>
      </aside>

      <BottomSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        maxHeight="84dvh"
        title={t("Chrome 설치 방법", "Install with Chrome")}
      >
        <div className="px-5 pb-8 pt-2" data-testid="pwa-install-guide">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-primary/25 text-ink">
            <Download size={27} strokeWidth={2.1} aria-hidden />
          </div>
          <h2 className="mt-4 text-center text-[21px] font-black tracking-[-0.035em] text-ink">
            {t("Chrome에서 잊지마 설치하기", "Install Itjima with Chrome")}
          </h2>
          <p className="mx-auto mt-2 max-w-[32rem] text-center text-[13px] leading-relaxed text-ink-soft">
            {t(
              "설치하면 주소를 다시 입력할 필요 없이 홈 화면이나 바탕화면에서 바로 열 수 있어요.",
              "After installation, open Itjima directly from your home screen or desktop.",
            )}
          </p>

          <div
            className="mt-5 grid grid-cols-3 gap-1 rounded-[14px] bg-ink/[0.045] p-1"
            role="tablist"
            aria-label={t("설치 기기 선택", "Choose installation device")}
          >
            <GuideTab
              active={guideTarget === "chrome-desktop"}
              onClick={() => setGuideTarget("chrome-desktop")}
              testId="pwa-guide-desktop-tab"
            >
              {t("PC Chrome", "Desktop")}
            </GuideTab>
            <GuideTab
              active={guideTarget === "chrome-android"}
              onClick={() => setGuideTarget("chrome-android")}
              testId="pwa-guide-android-tab"
            >
              {t("Android", "Android")}
            </GuideTab>
            <GuideTab
              active={guideTarget === "ios"}
              onClick={() => setGuideTarget("ios")}
              testId="pwa-guide-ios-tab"
            >
              {t("iPhone", "iPhone")}
            </GuideTab>
          </div>

          <ol className="mt-4 space-y-3" data-testid={`pwa-guide-${guideTarget}`}>
            {guideTarget === "chrome-desktop" && (
              <>
                <GuideStep
                  icon={<MonitorDown size={18} aria-hidden />}
                  number="1"
                  title={t(
                    "주소창 오른쪽의 설치 아이콘 찾기",
                    "Find the install icon in the address bar",
                  )}
                  detail={t(
                    "모니터 또는 다운로드 모양 아이콘이 보이면 눌러요.",
                    "Click the monitor or download-shaped icon if it appears.",
                  )}
                />
                <GuideStep
                  icon={<MoreVertical size={18} aria-hidden />}
                  number="2"
                  title={t(
                    "아이콘이 없으면 Chrome 메뉴 열기",
                    "If there is no icon, open Chrome's menu",
                  )}
                  detail={t(
                    "오른쪽 위 ⋮ → ‘전송, 저장 및 공유’ 또는 ‘저장 및 공유’ → ‘페이지를 앱으로 설치’를 선택해요. Chrome 버전에 따라 ‘앱 설치’로 보일 수 있어요.",
                    "Open ⋮ → Save and share → Install page as app. Some Chrome versions label it Install app.",
                  )}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="3"
                  title={t("설치 버튼 누르기", "Confirm Install")}
                  detail={t(
                    "별도 앱 창이 열리고 바탕화면이나 앱 목록에서 잊지마를 찾을 수 있어요.",
                    "Itjima opens in its own window and appears in your desktop app list.",
                  )}
                />
              </>
            )}

            {guideTarget === "chrome-android" && (
              <>
                <GuideStep
                  icon={<Smartphone size={18} aria-hidden />}
                  number="1"
                  title={t(
                    "Android Chrome에서 itjima.app 열기",
                    "Open itjima.app in Android Chrome",
                  )}
                  detail={t(
                    "카카오톡·인스타 내부 브라우저가 아니라 Chrome 앱에서 열어야 설치 메뉴가 잘 보여요.",
                    "Use the Chrome app, not an in-app browser from another service.",
                  )}
                />
                <GuideStep
                  icon={<MoreVertical size={18} aria-hidden />}
                  number="2"
                  title={t("오른쪽 위 ⋮ 누르기", "Tap ⋮ in the top-right")}
                  detail={t(
                    "Chrome의 페이지 메뉴가 열려요.",
                    "This opens Chrome's page menu.",
                  )}
                />
                <GuideStep
                  icon={<PlusSquare size={18} aria-hidden />}
                  number="3"
                  title={t(
                    "‘앱 설치’ 또는 ‘홈 화면에 추가’ 선택",
                    "Choose Install app or Add to Home screen",
                  )}
                  detail={t(
                    "기기와 Chrome 버전에 따라 문구가 다르게 표시될 수 있어요.",
                    "The exact wording depends on your device and Chrome version.",
                  )}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="4"
                  title={t("설치 또는 추가 누르기", "Tap Install or Add")}
                  detail={t(
                    "홈 화면에 생긴 잊지마 아이콘으로 바로 실행할 수 있어요.",
                    "Open Itjima anytime from its new home-screen icon.",
                  )}
                />
              </>
            )}

            {guideTarget === "ios" && (
              <>
                <GuideStep
                  icon={<Share2 size={18} aria-hidden />}
                  number="1"
                  title={t("Chrome의 공유 버튼 누르기", "Tap Chrome's Share button")}
                  detail={t(
                    "주소창 옆이나 메뉴 안의 네모와 위쪽 화살표 아이콘이에요.",
                    "Look for the square icon with an upward arrow near the address bar or in the menu.",
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
                    "보이지 않으면 공유 메뉴를 아래로 내려 보세요. 계속 없으면 Safari에서 itjima.app을 열어 같은 과정을 진행해요.",
                    "Scroll the Share menu if needed. If it is still missing, open itjima.app in Safari and repeat these steps.",
                  )}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="3"
                  title={t("오른쪽 위 ‘추가’ 누르기", "Tap Add in the top-right")}
                  detail={t(
                    "홈 화면에 생긴 잊지마 아이콘으로 앱처럼 열 수 있어요.",
                    "Use the new Itjima icon on your Home Screen to open it like an app.",
                  )}
                />
              </>
            )}
          </ol>

          {mode === "prompt" && guideTarget !== "ios" && (
            <button
              type="button"
              onClick={() => void handleNativeInstall()}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-primary px-4 text-[13px] font-black text-ink"
            >
              <Download size={18} aria-hidden />
              {t("Chrome 설치 창 바로 열기", "Open Chrome's install prompt")}
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

function GuideTab({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-testid={testId}
      onClick={onClick}
      className={`min-h-10 rounded-[11px] px-2 text-[12px] font-bold transition-colors ${
        active ? "bg-white text-ink shadow-card" : "text-ink-soft"
      }`}
    >
      {children}
    </button>
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
