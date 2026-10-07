import { useEffect } from "react";
import { featureEnabled } from "@/lib/features";
import { beginRediscoveryStudyVisit } from "@/lib/rediscoveryStudy";

/**
 * Study visit tracking only.
 *
 * V03 must never hijack the user's capture flow by navigating away from Home.
 * Resurfacing is rendered inline on Home and remains user-initiated.
 */
export function RediscoveryStudyGate({ pathname }: { pathname: string }) {
  const enabled = featureEnabled("REDISCOVERY");
  const onHome = pathname === "/app";

  useEffect(() => {
    if (!enabled || !onHome) return;
    beginRediscoveryStudyVisit();
  }, [enabled, onHome]);

  return null;
}
