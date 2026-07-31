import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient, router } from "./router";
import { installAuthDebugInstrumentation } from "@/lib/authDebug";
import "./styles.css";
import "./ui-polish.css";
import "./ui-components.css";
import "./ui-forms.css";
import "./ui-overlays.css";
import "./ui-pages.css";
import "./ui-desktop-fix.css";
import "./ui-apple-system.css";
import "./ui-decision-deck.css";
import "./ui-interactions.css";
import "./ui-layout-system.css";
import "./ui-design-qa.css";
import "./ui-controls-system.css";
import "./ui-fields-and-states.css";
import "./ui-premium.css";
import "./ui-wwdc-quality.css";
import "./ui-responsive-pro.css";

import { registerServiceWorker } from "@/lib/swReminders";
import { installPushSubscriptionAuthSync } from "@/lib/push/pushAuthSync";
import {
  logPushDiagnostic,
  summarizePushEnvironment,
} from "@/lib/push/pushDiagnostics";

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
  installPushSubscriptionAuthSync();
  if (import.meta.env.VITE_E2E !== "true") {
    logPushDiagnostic("boot", summarizePushEnvironment());
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
