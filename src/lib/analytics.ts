// Lightweight analytics helper — fires to GA (gtag) and Microsoft Clarity if loaded.
// Safe to call in SSR (no-ops) and when scripts are blocked.

type Props = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function track(event: string, props: Props = {}) {
  if (typeof window === "undefined") return;
  try {
    // Google Analytics (gtag.js)
    if (typeof window.gtag === "function") {
      window.gtag("event", event, props);
    } else if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event, ...props });
    }
  } catch {
    // ignore
  }
  try {
    // Microsoft Clarity custom event + tags
    if (typeof window.clarity === "function") {
      window.clarity("event", event);
      Object.entries(props).forEach(([k, v]) => {
        if (v !== undefined) window.clarity!("set", k, String(v));
      });
    }
  } catch {
    // ignore
  }
}
