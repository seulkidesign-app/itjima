import { User, Info, MessageSquarePlus, Globe, Shield, LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BottomSheet } from "./BottomSheet";
import { AboutSheet } from "./AboutSheet";
import { FeedbackSheet } from "./FeedbackSheet";
import { useT, LanguageToggle } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { tap } from "@/lib/haptics";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SettingsSheet({ open, onClose }: Props) {
  const t = useT();
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [pendingSheet, setPendingSheet] = useState<"about" | "feedback" | null>(
    null,
  );

  useEffect(() => {
    if (open || !pendingSheet) return;
    if (pendingSheet === "about") setAboutOpen(true);
    if (pendingSheet === "feedback") setFeedbackOpen(true);
    setPendingSheet(null);
  }, [open, pendingSheet]);

  return (
    <>
      <BottomSheet open={open} onClose={onClose} maxHeight="70dvh">
        <div className="px-5 pb-8 pt-2">
          <h2 className="text-[17px] font-bold text-ink">
            {t("설정", "Settings")}
          </h2>
          <div className="mt-4 flex flex-col gap-1">
            {!userId && (
              <Link
                to="/auth"
                onClick={() => {
                  tap();
                  onClose();
                }}
                className="flex items-center gap-3 rounded-[18px] px-3 py-3.5 text-[14px] font-medium text-ink active:bg-ink/[0.04]"
              >
                <User size={18} />
                {t("로그인", "Sign in")}
              </Link>
            )}
            {userId && (
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  toast(t("로그아웃됨", "Signed out"));
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3.5 text-left text-[14px] font-medium text-ink active:bg-ink/[0.04]"
              >
                <LogOut size={18} />
                {t("로그아웃", "Sign out")}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                tap();
                onClose();
                setPendingSheet("about");
              }}
              className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3.5 text-left text-[14px] font-medium text-ink active:bg-ink/[0.04]"
            >
              <Info size={18} />
              {t("서비스 소개", "About Itjima")}
            </button>
            <button
              type="button"
              onClick={() => {
                tap();
                onClose();
                setPendingSheet("feedback");
              }}
              className="flex w-full items-center gap-3 rounded-[18px] px-3 py-3.5 text-left text-[14px] font-medium text-ink active:bg-ink/[0.04]"
            >
              <MessageSquarePlus size={18} />
              {t("문의 · 피드백", "Contact · Feedback")}
            </button>
            {isAdmin && (
              <Link
                to="/admin"
                onClick={onClose}
                className="flex items-center gap-3 rounded-[18px] px-3 py-3.5 text-[14px] font-medium text-ink active:bg-ink/[0.04]"
              >
                <Shield size={18} />
                {t("관리자", "Admin")}
              </Link>
            )}
            <div className="flex items-center gap-3 rounded-[18px] px-3 py-3.5 text-[14px] font-medium text-ink">
              <Globe size={18} />
              <span className="flex-1">{t("언어", "Language")}</span>
              <LanguageToggle />
            </div>
          </div>
        </div>
      </BottomSheet>
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </>
  );
}
