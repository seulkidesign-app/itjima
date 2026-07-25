import { BRAND } from "@/lib/brand";

export function buildFeedbackDiagnostics() {
  if (typeof window === "undefined") {
    return {
      version: BRAND.appVersionLabel,
      platform: "unknown",
      browser: "unknown",
      viewport: "unknown",
      route: "/",
      timestamp: new Date().toISOString(),
    };
  }

  const ua = navigator.userAgent;
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";

  return {
    version: BRAND.appVersionLabel,
    platform: navigator.platform || "unknown",
    browser,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    route: window.location.pathname,
    timestamp: new Date().toISOString(),
  };
}

export function formatDiagnosticsBlock(diagnostics: ReturnType<typeof buildFeedbackDiagnostics>) {
  return `\n\n---\n${JSON.stringify(diagnostics, null, 0)}`;
}
