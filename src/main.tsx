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
import { oauthPkceStorageDiag } from "@/lib/oauth";
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
  oauthPkceStorageDiag("main:callback-bootstrap:before-getSession", {
    hasCode: new URLSearchParams(window.location.search).has("code"),
  });
  void authDebugGetSession("main.tsx:post-redirect-bootstrap", () =>
    supabase.auth.getSession(),
  ).then(() => {
    oauthPkceStorageDiag("main:callback-bootstrap:after-getSession");
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

if (typeof window !== "undefined") {
  if (import.meta.env.DEV && import.meta.env.VITE_E2E !== "true") {
    installAuthDebugInstrumentation(router);
  }
  void registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
