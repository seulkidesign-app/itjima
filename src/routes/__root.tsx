import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { maybeRouteOAuthCallback } from "@/lib/oauth";
import { authDebug } from "@/lib/authDebug";
import { SideNav } from "@/components/SideNav";
import { TopNav } from "@/components/TopNav";
import { DesktopAppNav } from "@/components/DesktopAppNav";
import { UsLaunchLanding } from "@/components/UsLaunchLanding";
import { PageTransition } from "@/components/PageTransition";
import { GlobalInteractions } from "@/components/GlobalInteractions";
import { ScheduleDeepLinkBridge } from "@/components/ScheduleDeepLinkBridge";
import { PwaInstallExperience } from "@/components/PwaInstallExperience";
import { PwaInstallHomeBar } from "@/components/PwaInstallHomeBar";
import { LanguageProvider, useLang } from "@/lib/i18n";
import { applyLandingSeo } from "@/lib/seo";
import { useArchiveMetaSync } from "@/hooks/useArchiveMetaSync";
import { useTimezoneChangeSync } from "@/hooks/useTimezoneChangeSync";
import { useScheduleReminderSync } from "@/hooks/useScheduleReminderSync";

const calmToastOptions = {
  style: {
    background: "var(--ij-surface-elevated, rgba(255,255,255,0.96))",
    color: "var(--ij-label, #111111)",
    border: "1px solid var(--ij-separator-soft, rgba(0,0,0,0.06))",
    borderRadius: 20,
    boxShadow:
      "0 2px 8px rgba(0,0,0,0.04), 0 12px 32px -8px rgba(0,0,0,0.1)",
    fontSize: 14,
    fontWeight: 560,
  },
} as const;

export const Route = createRootRoute({
  component: RootLayout,
});

function AppRuntimeServices() {
  useTimezoneChangeSync();
  useScheduleReminderSync();
  return (
    <>
      <GlobalInteractions />
      <ScheduleDeepLinkBridge />
    </>
  );
}

function RootLanding() {
  const { lang } = useLang();

  useEffect(() => {
    applyLandingSeo({ canonicalPath: "/", locale: lang });
  }, [lang]);

  return (
    <div className="itjima-launch-page">
      <UsLaunchLanding />
    </div>
  );
}

function readDesktopLayout() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches
  );
}

function useDesktopLayout() {
  const [isDesktop, setIsDesktop] = useState(readDesktopLayout);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}

function AppRouteOutlet({ routeKey }: { routeKey: string }) {
  return (
    <PageTransition routeKey={routeKey}>
      <Outlet />
    </PageTransition>
  );
}

function AdaptiveAppShell({ routeKey }: { routeKey: string }) {
  const isDesktop = useDesktopLayout();
  const showInstallBar = routeKey === "home";

  if (isDesktop) {
    return (
      <div
        className="itjima-desktop-shell flex h-dvh w-full overflow-hidden"
        data-layout="desktop"
        data-route={routeKey}
      >
        <div className="phone-frame itjima-desktop-style-scope contents">
          <DesktopAppNav />
          <div className="itjima-app-content flex min-h-0 min-w-0 flex-1 flex-col">
            {showInstallBar && <PwaInstallHomeBar />}
            <main
              id="phone-scroll"
              className="itjima-app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
            >
              <AppRouteOutlet routeKey={routeKey} />
            </main>
          </div>
        </div>
        <Toaster
          position="top-center"
          theme="system"
          toastOptions={calmToastOptions}
          offset={24}
        />
      </div>
    );
  }

  return (
    <div
      className="itjima-app-stage flex min-h-dvh w-full items-start justify-center"
      data-layout="touch"
      data-route={routeKey}
    >
      <div className="phone-frame itjima-responsive-frame itjima-app-workspace flex flex-col">
        <TopNav />
        {showInstallBar && <PwaInstallHomeBar />}
        <div className="itjima-app-content flex min-h-0 min-w-0 flex-1 flex-col">
          <main
            id="phone-scroll"
            className="itjima-app-scroll min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden"
          >
            <AppRouteOutlet routeKey={routeKey} />
          </main>
        </div>
      </div>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={calmToastOptions}
        offset={72}
      />
    </div>
  );
}

function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isRootLanding = pathname === "/";
  const isAboutLanding = pathname.startsWith("/about");
  const isFullPage = isRootLanding || isAboutLanding;
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");
  const mainRouteKey =
    pathname.startsWith("/schedule")
      ? "schedule"
      : pathname.startsWith("/archive")
        ? "archive"
        : pathname === "/app"
          ? "home"
          : pathname;

  useArchiveMetaSync();

  useEffect(() => {
    authDebug("__root: pathname", { pathname });
    maybeRouteOAuthCallback();
  }, [pathname]);

  useEffect(() => {
    if (!isFullPage) return;

    const routeAppLinks = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href='/']");
      if (!link || !link.closest(".itjima-launch-page")) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign("/app");
    };

    document.addEventListener("click", routeAppLinks, true);
    return () => document.removeEventListener("click", routeAppLinks, true);
  }, [isFullPage]);

  if (isAuth) {
    return (
      <LanguageProvider>
        <GlobalInteractions />
        <div className="phone-frame">
          <Outlet />
          <Toaster
            position="top-center"
            theme="system"
            toastOptions={calmToastOptions}
            offset={72}
          />
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <AppRuntimeServices />
      {isFullPage ? (
        <>
          {isRootLanding ? <RootLanding /> : <Outlet />}
          <PwaInstallExperience />
          <Toaster position="top-center" theme="system" richColors closeButton />
        </>
      ) : isAdmin ? (
        <div className="min-h-dvh w-full md:flex md:items-start">
          <SideNav />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="md:hidden">
              <TopNav />
            </div>
            <main
              id="phone-scroll"
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden md:min-h-dvh"
            >
              <Outlet />
            </main>
          </div>
          <Toaster position="top-center" theme="system" richColors closeButton />
        </div>
      ) : (
        <AdaptiveAppShell routeKey={mainRouteKey} />
      )}
    </LanguageProvider>
  );
}
