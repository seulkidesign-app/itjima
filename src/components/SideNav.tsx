import { Link, useRouterState } from "@tanstack/react-router";
import {
  Inbox,
  Calendar,
  Archive,
  Info,
  Shield,
  LogIn,
  LogOut,
  MessageSquarePlus,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/integrations/supabase/client";
import { AboutSheet } from "@/components/AboutSheet";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { tap } from "@/lib/haptics";

export function SideNav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const userId = useUserId();
  const isAdmin = useIsAdmin();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const items = [
    { to: "/", label: t("생각", "Thoughts"), Icon: Inbox },
    { to: "/schedule", label: t("그때", "When"), Icon: Calendar },
    { to: "/archive", label: t("기억함", "Kept"), Icon: Archive },
  ] as const;

  return (
    <aside className="hidden md:flex sticky top-0 h-dvh w-[240px] shrink-0 flex-col gap-2 px-5 py-8">
      <div className="px-2 pb-4 text-[24px] font-extrabold tracking-tight text-ink">
        It<span className="text-primary">Jima</span>
      </div>

      <nav className="flex flex-col gap-1">
        {items.map(({ to, label, Icon }) => {
          const active = path === to || (to !== "/" && path.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-[14px] font-semibold transition-all ${
                active
                  ? "bg-primary text-ink shadow-card"
                  : "text-ink-soft hover:bg-white/60"
              }`}
            >
              <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              {label}
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            to="/admin"
            className={`flex items-center gap-3 rounded-full px-3 py-2.5 text-[14px] font-semibold transition-all ${
              path.startsWith("/admin")
                ? "bg-ink text-white shadow-card"
                : "text-ink-soft hover:bg-white/60"
            }`}
          >
            <Shield size={18} />
            {t("관리자", "Admin")}
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="flex gap-1 px-1">
          <button
            type="button"
            aria-label={t("정보", "About")}
            className="touch-target rounded-full text-ink-soft hover:bg-white/60 hover:text-ink"
            onClick={() => {
              tap();
              setAboutOpen(true);
            }}
          >
            <Info size={18} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label={t("문의 · 피드백", "Contact · Feedback")}
            className="touch-target rounded-full text-ink-soft hover:bg-white/60 hover:text-ink"
            onClick={() => {
              tap();
              setFeedbackOpen(true);
            }}
          >
            <MessageSquarePlus size={18} strokeWidth={2.25} />
          </button>
        </div>
        <LanguageToggle className="self-start" />
        {userId ? (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast(t("로그아웃됨", "Signed out"));
            }}
            className="flex items-center gap-2 rounded-full glass shadow-card px-3 py-2.5 text-[13px] font-semibold text-ink-soft"
          >
            <LogOut size={16} /> {t("로그아웃", "Sign out")}
          </button>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-2 rounded-full bg-primary shadow-card px-3.5 py-2.5 text-[13px] font-bold text-ink"
          >
            <LogIn size={16} /> {t("로그인", "Sign in")}
          </Link>
        )}
      </div>
      <AboutSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </aside>
  );
}
