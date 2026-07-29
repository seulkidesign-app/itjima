import { BottomSheet } from "./BottomSheet";
import { useT, useLang } from "@/lib/i18n";
import { notificationDeniedGuideSteps } from "@/lib/push/notificationDeniedGuide";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NotificationDeniedHelpSheet({ open, onClose }: Props) {
  const t = useT();
  const { lang } = useLang();
  const steps = notificationDeniedGuideSteps(lang === "en" ? "en" : "ko");

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      maxHeight="72dvh"
      title={t("알림 켜기", "Turn on notifications")}
    >
      <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        <h2 className="text-[18px] font-bold tracking-[-0.02em] text-ink">
          {t("알림 켜는 방법", "How to turn notifications on")}
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li
              key={index}
              className="flex gap-3 text-[14px] leading-relaxed text-ink-soft"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/25 text-[12px] font-bold text-ink">
                {index + 1}
              </span>
              <span className="pt-0.5">{step.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </BottomSheet>
  );
}
