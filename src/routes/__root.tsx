import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { LanguageProvider } from "@/lib/i18n";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname.startsWith("/auth");

  return (
    <LanguageProvider>
      <div className="phone-frame">
        <div className={`flex h-full flex-col ${hideNav ? "" : "pb-[calc(3.5rem+env(safe-area-inset-bottom))]"}`}>
          <Outlet />
        </div>
        <BottomNav />
        <Toaster position="top-center" richColors closeButton />
      </div>
    </LanguageProvider>
  );
}
