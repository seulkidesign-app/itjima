import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { queryClient, router } from "./router";
import { installAuthDebugInstrumentation } from "@/lib/authDebug";
import "./pwaLaunchRedirect";
import "./composerMobileHotfix";
import "./mobileDockViewport";
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
import "./ui-post-72-final-polish.css";
import "./ui-brand-canonical.css";
import "./ui-capture-mobile-hotfix.css";
import "./ui-landing-mobile-type-hotfix.css";
import "./ui-home-docked-composer.css";
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
  const brandCacheKey = "20260906-1";
  const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = `/manifest-v7.webmanifest?v=${brandCacheKey}`;

  const faviconLink = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (faviconLink) faviconLink.href = `/favicon.svg?v=${brandCacheKey}`;

  const shortcutIconLink = document.querySelector<HTMLLinkElement>('link[rel="shortcut icon"]');
  if (shortcutIconLink) shortcutIconLink.href = `/favicon.svg?v=${brandCacheKey}`;

  const touchIconLink = document.querySelector<HTMLLinkElement>(
    'link[rel="apple-touch-icon"]',
  );
  if (touchIconLink) touchIconLink.href = `/apple-touch-icon-v7.png?v=${brandCacheKey}`;

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
