import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { supabase } from "./integrations/supabase/client";
import { queryClient, router } from "./router";
import {
  authDebug,
  authDebugGetSession,
  installAuthDebugInstrumentation,
} from "@/lib/authDebug";
import "./styles.css";

import { registerServiceWorker } from "@/lib/swReminders";

// Start PKCE exchange as early as possible on the OAuth callback route
if (
  typeof window !== "undefined" &&
  window.location.pathname === "/auth/callback"
) {
  authDebug("main.tsx: bootstrap getSession on /auth/callback", {
    href: window.location.href,
  });
  void authDebugGetSession("main.tsx:post-redirect-bootstrap", () =>
    supabase.auth.getSession(),
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

if (typeof window !== "undefined" && import.meta.env.VITE_E2E !== "true") {
  installAuthDebugInstrumentation(router);
  void registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
