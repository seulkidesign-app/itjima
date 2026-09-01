import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useArchive, useInbox, useSchedules } from "@/lib/store";
import { featureEnabled } from "@/lib/features";
import {
  buildRediscoveryPool,
  pickRediscoveryCandidate,
} from "@/lib/rediscoveryPick";
import {
  beginRediscoveryStudyVisit,
  type RediscoveryStudyVisit,
} from "@/lib/rediscoveryStudy";

export function RediscoveryStudyGate({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const inbox = useInbox();
  const archive = useArchive();
  const schedules = useSchedules();
  const enabled = featureEnabled("REDISCOVERY");
  const onHome = pathname === "/app";
  const [visit, setVisit] = useState<RediscoveryStudyVisit | null>(null);

  const pool = useMemo(
    () =>
      enabled && onHome
        ? buildRediscoveryPool(inbox.items, archive.items)
        : [],
    [enabled, onHome, inbox.items, archive.items],
  );

  const candidate = useMemo(
    () =>
      enabled && onHome
        ? pickRediscoveryCandidate(pool, schedules.items)
        : null,
    [enabled, onHome, pool, schedules.items],
  );

  useEffect(() => {
    if (!enabled || !onHome) {
      setVisit(null);
      return;
    }
    setVisit(beginRediscoveryStudyVisit());
  }, [enabled, onHome]);

  useEffect(() => {
    if (
      !enabled ||
      !onHome ||
      !visit?.newVisit ||
      !visit.isReturnVisit ||
      !candidate
    ) {
      return;
    }

    void navigate({ to: "/rediscovery" });
  }, [enabled, onHome, visit, candidate, navigate]);

  return null;
}
