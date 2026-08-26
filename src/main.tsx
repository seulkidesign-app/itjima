import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient, router } from "./router";
import { installAuthDebugInstrumentation } from "@/lib/authDebug";
import "./pwaLaunchRedirect";
import "./styles.css";
import "./ui-polish.css";
import "./ui-components.css";
import "./ui-forms.css";
import "./ui-overlays.css";
import "./ui-pages.css";
import "./ui-desktop-fix.css";
import "./ui-apple-system.css";
import "./ui-decision-deck.css";
import "./ui-decision-deck-touch-fix.css";
import "./ui-interactions.css";
import "./ui-layout-system.css";
import "./ui-design-qa.css";
import "./ui-controls-system.css";
import "./ui-fields-and-states.css";
import "./ui-premium.css";
import "./ui-wwdc-quality.css";
import "./ui-responsive-pro.css";
import "./ui-responsive-master.css";
import "./ui-adaptive-navigation.css";
import "./ui-mobile-light-contract.css";
import "./ui-layout-viewport-polish.css";
import "./ui-calendar-experience.css";
import "./ui-home-fixed-composer.css";
import "./ui-schedule-final-polish.css";
import "./ui-landing-scroll-fix.css";
import "./ui-landing-interactions.css";
import "./ui-landing-brand-system.css";
import "./ui-landing-footer-headline-polish.css";
import "./ui-landing-silicon-polish.css";
import "./ui-landing-brand-fidelity.css";
import "./ui-landing-wow-motion.css";
import "./ui-landing-fixed-glass-nav.css";
import "./ui-landing-ai-luminous-polish.css";
import "./ui-pwa-install-experience.css";
import "./ui-interaction-craft.css";
import "./ui-landing-ai-editorial.css";
import "./ui-landing-swipe-motion.css";
import "./ui-landing-mobile-trust-fix.css";
import "./ui-final-surface-guard.css";
import "./ui-quietly-organized.css";
import "./landingHeroMotion";

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
  // iOS can aggressively reuse Add-to-Home-Screen metadata. Use a fresh
  // manifest identity and let the manifest own the install icon instead of
  // an apple-touch-icon override.
  document
    .querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
    .forEach((node) => node.remove());
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = "/manifest-v3.webmanifest";

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
