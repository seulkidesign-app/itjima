import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SideNav } from "@/components/SideNav";
import { TopNav } from "@/components/TopNav";
import { LanguageProvider } from "@/lib/i18n";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isFullPage = pathname.startsWith("/about");
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");

  // Supabase may return ?code= to Site URL instead of /auth/callback
  useEffect(() => {
    if (pathname.startsWith("/auth/callback")) return;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const hasOAuthReturn =
      params.has("code") ||
      params.has("error") ||
      hash.includes("access_token") ||
      hash.includes("error");
    if (hasOAuthReturn) {
      window.location.replace(`/auth/callback${window.location.search}${hash}`);
    }
  }, [pathname]);

  if (isAuth) {
    return (
      <LanguageProvider>
        <div className="phone-frame">
          <Outlet />
          <Toaster
            position="top-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.22 0.03 250)",
                color: "white",
                border: "none",
                borderRadius: 16,
              },
            }}
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
          <div className="phone-frame">
            <TopNav />
            <div
              id="phone-scroll"
              className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-[calc(env(safe-area-inset-top)+72px)]"
            >
              <Outlet />
            </div>
            <InstallPrompt />
          </div>
          <Toaster
            position="top-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.22 0.03 250)",
                color: "white",
                border: "none",
                borderRadius: 16,
              },
            }}
          />
        </div>
      )}
    </LanguageProvider>
  );
}
