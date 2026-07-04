import {
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { maybeRouteOAuthCallback } from "@/lib/oauth";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SideNav } from "@/components/SideNav";
import { TopNav } from "@/components/TopNav";
import { LanguageProvider } from "@/lib/i18n";
import { useArchiveMetaSync } from "@/hooks/useArchiveMetaSync";

const calmToastOptions = {
  style: {
    background: "rgba(255,255,255,0.96)",
    color: "#111111",
    border: "1px solid oklch(0 0 0 / 0.06)",
    borderRadius: 20,
    boxShadow:
      "0 2px 8px oklch(0 0 0 / 0.04), 0 12px 32px -8px oklch(0 0 0 / 0.1)",
    fontSize: 14,
    fontWeight: 500,
  },
} as const;

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullPage = pathname.startsWith("/about");
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");

  useArchiveMetaSync();

  useEffect(() => {
    maybeRouteOAuthCallback();
  }, [pathname]);

  if (isAuth) {
    return (
      <LanguageProvider>
        <div className="phone-frame">
          <Outlet />
          <Toaster
            position="top-center"
            theme="light"
            toastOptions={calmToastOptions}
          />
        </div>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      {isFullPage ? (
        <>
          <Outlet />
          <Toaster position="top-center" richColors closeButton />
        </>
      ) : isAdmin ? (
        <div className="flex min-h-dvh w-full">
          <SideNav />
          <main className="min-w-0 flex-1 overflow-x-hidden">
            <Outlet />
          </main>
          <Toaster position="top-center" richColors closeButton />
        </div>
      ) : (
        <div className="md:flex md:items-start md:justify-center md:gap-6">
          <SideNav />
          <div className="phone-frame flex flex-col">
            <TopNav />
            <div
              id="phone-scroll"
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
            >
              <Outlet />
            </div>
            <InstallPrompt />
          </div>
          <Toaster
            position="top-center"
            theme="light"
            toastOptions={calmToastOptions}
          />
        </div>
      )}
    </LanguageProvider>
  );
}
