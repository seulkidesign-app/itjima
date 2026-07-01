import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { supabase } from "./integrations/supabase/client";
import { queryClient, router } from "./router";
import "./styles.css";

// Start PKCE exchange as early as possible on the OAuth callback route
if (
  typeof window !== "undefined" &&
  window.location.pathname === "/auth/callback"
) {
  void supabase.auth.getSession();
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
