import type { NlIntent, ScheduleConfidence } from "@/lib/nlSchedule";

export type NlParsingPath = "rule";

export type NlDebugSnapshot = {
  intent: NlIntent;
  confidenceTier: ScheduleConfidence;
  hasDate: boolean;
  hasTime: boolean;
  sensitive: boolean;
  parsingPath: NlParsingPath;
  acknowledged: boolean;
};

let debugEnabled: boolean | null = null;

/** Test-only reset for debug flag cache. */
export function resetNlDebugCache(): void {
  debugEnabled = null;
}

/** Dev/beta only — never in production unless VITE_NL_BETA=true. */
function isNlDebugAllowed(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_E2E === "true" ||
    import.meta.env.VITE_NL_BETA === "true"
  );
}

/** Dev/beta only — ?nlDebug=1 or localStorage itjima.nl.debug=1 */
export function isNlDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (!isNlDebugAllowed()) return false;
  if (debugEnabled !== null) return debugEnabled;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("nlDebug") === "1") {
      debugEnabled = true;
      return true;
    }
    debugEnabled = localStorage.getItem("itjima.nl.debug") === "1";
    return debugEnabled;
  } catch {
    debugEnabled = false;
    return false;
  }
}

export function setNlDebugEnabled(on: boolean): void {
  if (!isNlDebugAllowed()) return;
  debugEnabled = on;
  if (typeof window === "undefined") return;
  if (on) localStorage.setItem("itjima.nl.debug", "1");
  else localStorage.removeItem("itjima.nl.debug");
}
