import { useEffect, useState, type ElementType } from "react";
import {
  ChevronRight,
  Download,
  ExternalLink,
  MessageSquarePlus,
  Sparkles,
  Megaphone,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { BottomSheet } from "./BottomSheet";
import { FeedbackSheet } from "./FeedbackSheet";
import { IosInstallHint } from "./IosInstallHint";
import { useT } from "@/lib/i18n";
import { BRAND } from "@/lib/brand";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { tap } from "@/lib/haptics";

type RowProps = {
  icon: ElementType;
  title: string;
  description: string;
  onClick?: () => void;
  chevron?: boolean;
  expanded?: boolean;
};

function BrandHubRow({
  icon: Icon,
  title,
  description,
  onClick,
  chevron = true,
  expanded,
}: RowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="flex w-full items-center gap-3.5 rounded-[20px] px-3 py-3.5 text-left active:bg-ink/[0.03]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-ink/[0.04]">
        <Icon size={18} className="text-ink" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </div>
        <div className="mt-0.5 text-[13px] leading-snug text-ink-soft">
          {description}
        </div>
      </div>
      {chevron && (
        <ChevronRight
          size={16}
          className={`shrink-0 text-ink/25 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
      )}
    </Tag>
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
    if (open) return;
    setWhatsNewOpen(false);
  }, [open]);

  useEffect(() => {
    if (open || !pendingFeedback) return;
    setFeedbackOpen(true);
    setPendingFeedback(false);
  }, [open, pendingFeedback]);

  const notes = BRAND.releaseNotes;
  const highlights = notes.highlights.ko.map((ko, i) =>
    t(ko, notes.highlights.en[i] ?? ko),
  );

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        maxHeight="65dvh"
        title={t("Itjima (잊지마)", "Itjima (잊지마)")}
      >
        <div className="sheet-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
          <div className="mb-5 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary text-[13px] font-black tracking-tight text-ink">
                IJ
              </div>
              <div>
                <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink">
                  {t("Itjima (잊지마)", "Itjima (잊지마)")}
                </h2>
                <p className="text-[13px] text-ink-soft">
                  {t("AI 기억 관리 · 생각 정리", "AI memory · thought organization")}
                </p>
              </div>
            </div>
          </div>

          <section className="mb-5 rounded-[22px] bg-ink/[0.025] px-4 py-4">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink/45">
              <Sparkles size={14} strokeWidth={2.25} />
              {t("About Itjima", "About Itjima")}
            </div>
            <p className="text-[14px] leading-[1.65] text-ink/90">
              {t(BRAND.aboutIntro.ko, BRAND.aboutIntro.en)}
            </p>
          </section>

          <div className="flex flex-col gap-0.5">
            {canInstall && (
              <BrandHubRow
                icon={Download}
                title={t("홈 화면에 추가", "Add to Home Screen")}
                description={t(
                  "앱처럼 한 번에 열어요",
                  "Open it like a native app",
                )}
                onClick={() => {
                  tap();
                  void install();
                }}
              />
            )}

            <BrandHubRow
              icon={MessageSquarePlus}
              title={t("피드백 보내기", "Send feedback")}
              description={t(
                "한 번 탭으로 의견 남기기",
                "Share a thought in one tap",
              )}
              onClick={() => {
                tap();
                onClose();
                setPendingFeedback(true);
              }}
            />

            <BrandHubRow
              icon={ExternalLink}
              title={t("웹사이트 방문", "Visit website")}
              description={t(
                "잊지마(Itjima) 소개 페이지",
                "Itjima (잊지마) landing page",
              )}
              onClick={() => {
                tap();
                onClose();
                void navigate({ to: "/about" });
              }}
            />

            <BrandHubRow
              icon={Megaphone}
              title={t("새 소식", "What's new")}
              description={t(notes.title.ko, notes.title.en)}
              expanded={whatsNewOpen}
              onClick={() => {
                tap();
                setWhatsNewOpen((v) => !v);
              }}
            />

            {whatsNewOpen && (
              <div className="mx-3 mb-2 mt-1 rounded-[18px] bg-ink/[0.025] px-4 py-3.5">
                <p className="text-[12px] font-semibold text-ink-soft">
                  {notes.version} · {notes.date}
                </p>
                <ul className="mt-2.5 space-y-2">
                  {highlights.map((line, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] leading-snug text-ink/85"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-[12px] font-medium text-ink/35">
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
