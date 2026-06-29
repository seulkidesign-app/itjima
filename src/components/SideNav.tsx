import { Link, useRouterState } from "@tanstack/react-router";
import { Inbox, Calendar, Archive, Shield, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useT, LanguageToggle } from "@/lib/i18n";
import { useUserId } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";

export function SideNav() {
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const userId = useUserId();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      return;
    }
    let alive = true;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setIsAdmin(!!data);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const items = [
    { to: "/", label: t("지금", "Now"), Icon: Inbox },
    { to: "/schedule", label: t("때", "When"), Icon: Calendar },
    { to: "/archive", label: t("기억", "Memory"), Icon: Archive },
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
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-all ${
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
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-all ${
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
        <LanguageToggle className="self-start" />
        {userId ? (
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              toast(t("로그아웃됨", "Signed out"));
            }}
            className="flex items-center gap-2 rounded-2xl glass shadow-card px-3 py-2.5 text-[13px] font-semibold text-ink-soft"
          >
            <LogOut size={16} /> {t("로그아웃", "Sign out")}
          </button>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-2 rounded-2xl bg-primary shadow-card px-3.5 py-2.5 text-[13px] font-bold text-ink"
          >
            <LogIn size={16} /> {t("이어가기", "Continue")}
          </Link>
        )}
      </div>
    </aside>
  );
}
