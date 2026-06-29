import { Link, useRouterState } from "@tanstack/react-router";
import { Archive, Calendar, Home, Info } from "lucide-react";
import { useT } from "@/lib/i18n";

const tabs = [
  { to: "/", icon: Home, labelKo: "지금", labelEn: "Now" },
  { to: "/schedule", icon: Calendar, labelKo: "때", labelEn: "When" },
  { to: "/archive", icon: Archive, labelKo: "기억", labelEn: "Memory" },
  { to: "/about", icon: Info, labelKo: "정보", labelEn: "About" },
] as const;

export function BottomNav() {
  const t = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (pathname.startsWith("/auth")) return null;

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-40 border-t border-ink/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="flex items-stretch justify-around px-2 pt-1">
        {tabs.map(({ to, icon: Icon, labelKo, labelEn }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-wide transition ${
                active ? "text-ink" : "text-ink-soft"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{t(labelKo, labelEn)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
