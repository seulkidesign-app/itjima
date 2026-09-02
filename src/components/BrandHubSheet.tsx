import { useEffect, useState, type ElementType } from "react";
import {
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Instagram,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { track } from "@/lib/analytics";
import { useNavigate } from "@tanstack/react-router";
import { BottomSheet } from "./BottomSheet";
import { FeedbackSheet } from "./FeedbackSheet";
import { IosInstallHint } from "./IosInstallHint";
import { BrandLogo } from "./BrandLogo";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { tap } from "@/lib/haptics";
import { resetSwipeTutorial } from "@/lib/swipeTutorial";
import { toast } from "sonner";

type RowProps = {
  icon: ElementType;
  title: string;
  description: string;
  onClick: () => void;
  expanded?: boolean;
  external?: boolean;
  ariaLabel?: string;
};

function BrandHubRow({
  icon: Icon,
  title,
  description,
  onClick,
  expanded,
  external,
  ariaLabel,
}: RowProps) {
  const t = useT();
  const label =
    ariaLabel ??
    (external
      ? `${title}. ${t("새 탭에서 열림", "Opens in a new tab")}`
      : title);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={expanded}
      className="flex min-h-[64px] w-full items-center gap-3.5 rounded-[18px] px-3 py-3 text-left transition-colors active:bg-ink/[0.045] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-ink/[0.055] text-ink">
        <Icon size={18} strokeWidth={2.05} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[15px] font-bold tracking-[-0.015em] text-ink">
          {title}
        </strong>
        <span className="mt-0.5 block text-[12px] leading-snug text-ink-soft">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-ink/25" aria-hidden>
        {external && <ExternalLink size={13} />}
        <ChevronRight
          size={16}
          className={`transition-transform ${expanded ? "rotate-90" : ""}`}
        />
      </span>
    </button>
  );
}

export function BrandHubSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const { canInstall, install, iosHintOpen, closeIosHint } = usePwaInstall();
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(false);

  useEffect(() => {
    if (!open) setWhatsNewOpen(false);
    else track("brand_hub_opened");
  }, [open]);

  useEffect(() => {
    if (open || !pendingFeedback) return;
    setFeedbackOpen(true);
    setPendingFeedback(false);
  }, [open, pendingFeedback]);

  const notes = BRAND.releaseNotes;
  const highlights = notes.highlights.ko.map((ko, index) =>
    t(ko, notes.highlights.en[index] ?? ko),
  );

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        maxHeight="76dvh"
        title={t("Itjima 제품 정보", "About Itjima")}
      >
        <div className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <section className="pt-1" aria-labelledby="brand-hub-title">
            <div className="flex items-start gap-3.5 rounded-[22px] border border-ink/[0.07] bg-white/75 p-4 shadow-card backdrop-blur-xl">
              <img
                src="/icons/itjima-192-v7.png"
                alt=""
                aria-hidden="true"
                draggable={false}
                className="h-12 w-12 shrink-0 rounded-[16px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-ink/38">
                  {t("자연어 일정 캡처", "Natural-language scheduling")}
                </p>
                <div id="brand-hub-title" className="mt-2 flex items-center gap-3">
                  <BrandLogo size="native" />
                  <span className="text-[12px] font-bold text-ink-soft">잊지마</span>
                </div>
                <p className="mt-2 text-[13px] leading-[1.6] text-ink-soft">
                  {t(BRAND.aboutIntro.ko, BRAND.aboutIntro.en)}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-5" aria-labelledby="brand-hub-actions">
            <h3
              id="brand-hub-actions"
              className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.13em] text-ink/38"
            >
              {t("제품", "Product")}
            </h3>
            <div className="itjima-settings-group overflow-hidden">
              {canInstall && (
                <BrandHubRow
                  icon={Download}
                  title={t("홈 화면에 추가", "Add to Home Screen")}
                  description={t(
                    "앱처럼 열고 닫힌 상태의 알림을 준비해요",
                    "Open it like an app and prepare closed-app reminders",
                  )}
                  onClick={() => {
                    tap();
                    void install();
                  }}
                />
              )}

              <BrandHubRow
                icon={ExternalLink}
                title={t("제품 소개 보기", "View product overview")}
                description={t(
                  "작동 방식과 데이터 통제를 확인해요",
                  "See how scheduling and data controls work",
                )}
                onClick={() => {
                  tap();
                  track("landing_opened");
                  onClose();
                  void navigate({ to: "/about" });
                }}
              />

              <BrandHubRow
                icon={MessageSquarePlus}
                title={t("피드백 보내기", "Send feedback")}
                description={t(
                  "버그, 불편함, 개선 아이디어를 알려주세요",
                  "Report a bug, friction, or product idea",
                )}
                onClick={() => {
                  tap();
                  track("feedback_opened");
                  onClose();
                  setPendingFeedback(true);
                }}
              />

              <BrandHubRow
                icon={WandSparkles}
                title={t("스와이프 안내 다시 보기", "Replay swipe guide")}
                description={t(
                  "다음 정리 화면에서 제스처 안내를 보여줘요",
                  "Show gesture guidance the next time you sort",
                )}
                onClick={() => {
                  tap();
                  resetSwipeTutorial();
                  toast.message(
                    t(
                      "다음 정리 화면에서 안내를 보여드릴게요.",
                      "The guide will appear next time you sort.",
                    ),
                  );
                }}
              />
            </div>
          </section>

          <section className="mt-5" aria-labelledby="brand-hub-trust">
            <h3
              id="brand-hub-trust"
              className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.13em] text-ink/38"
            >
              {t("신뢰와 업데이트", "Trust & updates")}
            </h3>
            <div className="itjima-settings-group overflow-hidden">
              <BrandHubRow
                icon={FileText}
                title={t("개인정보 처리방침", "Privacy policy")}
                description={t(
                  "수집 정보, 사용 목적, 데이터 권리를 확인해요",
                  "Review collection, use, and your data rights",
                )}
                external
                onClick={() => {
                  tap();
                  window.open(BRAND.privacyUrl, "_blank", "noopener,noreferrer");
                }}
              />

              <BrandHubRow
                icon={ShieldCheck}
                title={t("이용약관", "Terms of use")}
                description={t(
                  "베타 서비스와 알림의 한계를 확인해요",
                  "Review beta and reminder limitations",
                )}
                external
                onClick={() => {
                  tap();
                  window.open(BRAND.termsUrl, "_blank", "noopener,noreferrer");
                }}
              />

              <BrandHubRow
                icon={Instagram}
                title="Instagram"
                description={t(
                  "제품 업데이트와 제작 과정을 확인해요",
                  "Follow product updates and the build journey",
                )}
                external
                onClick={() => {
                  tap();
                  track("instagram_opened");
                  window.open(BRAND.instagramUrl, "_blank", "noopener,noreferrer");
                }}
              />

              <BrandHubRow
                icon={Sparkles}
                title={t("새 소식", "What's new")}
                description={t(notes.title.ko, notes.title.en)}
                expanded={whatsNewOpen}
                onClick={() => {
                  tap();
                  setWhatsNewOpen((value) => !value);
                }}
              />

              {whatsNewOpen && (
                <div className="mx-3 mb-3 rounded-[17px] bg-ink/[0.035] px-4 py-3.5">
                  <p className="text-[11px] font-bold text-ink-soft">
                    {notes.version} · {notes.date}
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {highlights.map((line) => (
                      <li
                        key={line}
                        className="flex gap-2 text-[13px] leading-snug text-ink/82"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <p className="mt-6 text-center text-[11px] font-medium text-ink/35">
            {t("버전", "Version")} {BRAND.appVersionLabel}
          </p>
        </div>
      </BottomSheet>

      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
      <IosInstallHint open={iosHintOpen} onClose={closeIosHint} />
    </>
  );
}
