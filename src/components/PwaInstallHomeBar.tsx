import { useState, useSyncExternalStore, type ReactNode } from "react";
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

function initialTarget(): GuideTarget {
  if (typeof navigator === "undefined") return "chrome-desktop";
  if (isIosDevice()) return "ios";
  if (/Android/i.test(navigator.userAgent)) return "chrome-android";
  return "chrome-desktop";
}

export function PwaInstallHomeBar() {
  const t = useT();
  const mode = useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    () => "manual",
  );
  const [dismissed, setDismissed] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTarget, setGuideTarget] = useState<GuideTarget>(initialTarget);

  if (mode === "installed" || dismissed) return null;

  const openGuide = () => {
    tap();
    setGuideTarget(initialTarget());
    setGuideOpen(true);
  };

  const installNow = async () => {
    tap();
    const outcome = await requestPwaInstall();
    if (outcome === "accepted") {
      setDismissed(true);
      toast.success(t("잊지마를 앱으로 설치했어요", "Itjima was installed"));
      return;
    }
    if (outcome === "dismissed") {
      toast(t("설치를 취소했어요", "Installation was cancelled"));
      return;
    }
    openGuide();
  };

  return (
    <>
      <section
        className="pwa-install-home-bar mx-3 mt-2 flex-none rounded-[18px] border border-ink/[0.08] bg-white px-3 py-2.5 shadow-card sm:mx-5 sm:mt-3"
        data-testid="pwa-install-home-bar"
        aria-label={t("잊지마 앱 설치 안내", "Install Itjima")}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-primary/25 text-ink">
            <Smartphone size={18} strokeWidth={2.2} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-black tracking-[-0.02em] text-ink">
              {t("잊지마를 앱으로 설치", "Install Itjima as an app")}
            </strong>
            <span className="mt-0.5 block truncate text-[11px] font-medium text-ink-soft">
              {t("PC·Android Chrome 설치 방법", "Desktop and Android Chrome steps")}
            </span>
          </div>
          {mode === "prompt" && (
            <button
              type="button"
              data-testid="pwa-home-install-action"
              onClick={() => void installNow()}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-[12px] bg-primary px-2.5 text-[11px] font-black text-ink"
            >
              <Download size={14} strokeWidth={2.4} aria-hidden />
              {t("설치", "Install")}
            </button>
          )}
          <button
            type="button"
            data-testid="pwa-home-guide-action"
            onClick={openGuide}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-[12px] border border-ink/[0.09] bg-white px-2.5 text-[11px] font-black text-ink"
          >
            {t("방법", "Steps")}
          </button>
          <button
            type="button"
            onClick={() => {
              tap();
              setDismissed(true);
            }}
            aria-label={t("설치 안내 닫기", "Dismiss install guide")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      </section>

      <BottomSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        maxHeight="84dvh"
        title={t("Chrome 설치 방법", "Install with Chrome")}
      >
        <div className="px-5 pb-8 pt-2" data-testid="pwa-home-install-guide">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-primary/25 text-ink">
            <Download size={27} strokeWidth={2.1} aria-hidden />
          </div>
          <h2 className="mt-4 text-center text-[21px] font-black tracking-[-0.035em] text-ink">
            {t("잊지마를 앱처럼 열기", "Open Itjima like an app")}
          </h2>
          <p className="mx-auto mt-2 max-w-[32rem] text-center text-[13px] leading-relaxed text-ink-soft">
            {t(
              "설치하면 주소를 다시 입력하지 않고 홈 화면이나 바탕화면에서 바로 열 수 있어요.",
              "Install once to open Itjima directly from your home screen or desktop.",
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
              testId="pwa-home-guide-desktop-tab"
            >
              {t("PC Chrome", "Desktop")}
            </GuideTab>
            <GuideTab
              active={guideTarget === "chrome-android"}
              onClick={() => setGuideTarget("chrome-android")}
              testId="pwa-home-guide-android-tab"
            >
              Android
            </GuideTab>
            <GuideTab
              active={guideTarget === "ios"}
              onClick={() => setGuideTarget("ios")}
              testId="pwa-home-guide-ios-tab"
            >
              iPhone
            </GuideTab>
          </div>

          <ol className="mt-4 space-y-3" data-testid={`pwa-home-guide-${guideTarget}`}>
            {guideTarget === "chrome-desktop" && (
              <>
                <GuideStep
                  icon={<MonitorDown size={18} aria-hidden />}
                  number="1"
                  title={t("주소창 오른쪽 설치 아이콘 누르기", "Click the install icon in the address bar")}
                  detail={t("모니터나 다운로드 모양 아이콘이 보이면 바로 눌러요.", "Click the monitor or download-shaped icon when it appears.")}
                />
                <GuideStep
                  icon={<MoreVertical size={18} aria-hidden />}
                  number="2"
                  title={t("아이콘이 없으면 오른쪽 위 ⋮ 열기", "If it is missing, open ⋮")}
                  detail={t("‘전송, 저장 및 공유’ 또는 ‘저장 및 공유’ → ‘페이지를 앱으로 설치’를 선택해요. Chrome 버전에 따라 ‘앱 설치’로 표시될 수 있어요.", "Choose Save and share → Install page as app. Some Chrome versions show Install app.")}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="3"
                  title={t("설치 확인", "Confirm Install")}
                  detail={t("별도 앱 창이 열리고 바탕화면 또는 앱 목록에 잊지마가 생겨요.", "Itjima opens in its own window and appears in your app list.")}
                />
              </>
            )}

            {guideTarget === "chrome-android" && (
              <>
                <GuideStep
                  icon={<Smartphone size={18} aria-hidden />}
                  number="1"
                  title={t("Android의 Chrome 앱에서 itjima.app 열기", "Open itjima.app in Android Chrome")}
                  detail={t("카카오톡이나 인스타 내부 브라우저가 아니라 Chrome 앱에서 열어요.", "Use the Chrome app rather than an in-app browser.")}
                />
                <GuideStep
                  icon={<MoreVertical size={18} aria-hidden />}
                  number="2"
                  title={t("오른쪽 위 ⋮ 누르기", "Tap ⋮ in the top-right")}
                  detail={t("Chrome 페이지 메뉴가 열려요.", "Chrome's page menu opens.")}
                />
                <GuideStep
                  icon={<PlusSquare size={18} aria-hidden />}
                  number="3"
                  title={t("‘앱 설치’ 또는 ‘홈 화면에 추가’ 선택", "Choose Install app or Add to Home screen")}
                  detail={t("기기와 Chrome 버전에 따라 이름이 다를 수 있어요.", "The wording varies by device and Chrome version.")}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="4"
                  title={t("설치 또는 추가 누르기", "Tap Install or Add")}
                  detail={t("홈 화면의 잊지마 아이콘으로 바로 실행할 수 있어요.", "Open Itjima from its new home-screen icon.")}
                />
              </>
            )}

            {guideTarget === "ios" && (
              <>
                <GuideStep
                  icon={<Share2 size={18} aria-hidden />}
                  number="1"
                  title={t("공유 버튼 누르기", "Tap the Share button")}
                  detail={t("Chrome 또는 Safari의 네모와 위쪽 화살표 아이콘을 눌러요.", "Tap the square icon with an upward arrow in Chrome or Safari.")}
                />
                <GuideStep
                  icon={<PlusSquare size={18} aria-hidden />}
                  number="2"
                  title={t("‘홈 화면에 추가’ 선택", "Choose Add to Home Screen")}
                  detail={t("Chrome에서 보이지 않으면 Safari로 itjima.app을 열어 같은 과정을 진행해요.", "If it is missing in Chrome, open itjima.app in Safari and repeat these steps.")}
                />
                <GuideStep
                  icon={<Download size={18} aria-hidden />}
                  number="3"
                  title={t("오른쪽 위 ‘추가’ 누르기", "Tap Add in the top-right")}
                  detail={t("홈 화면에서 잊지마를 앱처럼 열 수 있어요.", "Open Itjima like an app from your Home Screen.")}
                />
              </>
            )}
          </ol>

          {mode === "prompt" && guideTarget !== "ios" && (
            <button
              type="button"
              onClick={() => void installNow()}
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
