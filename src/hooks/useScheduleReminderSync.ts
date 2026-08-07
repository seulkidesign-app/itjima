import { useEffect, useMemo, useRef } from "react";
import { useSchedules, useUserId } from "@/lib/store";
import { syncAllScheduleReminders } from "@/lib/push/scheduledRemindersSync";

/**
 * Server-reminder safety net.
 *
 * Schedule creation happens from several product surfaces (Home natural-language
 * confirmation, Decision Deck, calendar, manual editor). Rather than relying on
 * every caller to remember a second backend write, keep the server queue derived
 * from the canonical schedule store.
 */
export function useScheduleReminderSync() {
  const userId = useUserId();
  const schedules = useSchedules();
  const runningRef = useRef(false);
  const rerunRef = useRef(false);

  const fingerprint = useMemo(
    () =>
      schedules.items
        .map((item) =>
          [
            item.id,
            item.start_time,
            item.end_time,
            item.alarm ? "1" : "0",
            item.alarm_at ?? "",
            item.status ?? "active",
            item.repeat ?? "",
          ].join(":"),
        )
        .sort()
        .join("|"),
    [schedules.items],
  );

  useEffect(() => {
    if (!userId || schedules.syncState === "syncing") return;
    if (import.meta.env.VITE_E2E === "true") return;

    let disposed = false;
    let retryTimer: number | null = null;

    const run = async () => {
      if (disposed) return;
      if (runningRef.current) {
        rerunRef.current = true;
        return;
      }

      runningRef.current = true;
      try {
        const ok = await syncAllScheduleReminders(userId, schedules.items);
        if (!ok && !disposed) {
          retryTimer = window.setTimeout(() => void run(), 1_500);
        }
      } finally {
        runningRef.current = false;
        if (rerunRef.current && !disposed) {
          rerunRef.current = false;
          void run();
        }
      }
    };

    // Local schedule writes happen before the signed-in cloud write resolves.
    // A short debounce lets the canonical schedule row land first, while the
    // retry above covers slow/offline networks without losing the reminder.
    const timer = window.setTimeout(() => void run(), 700);

    const onOnline = () => void run();
    window.addEventListener("online", onOnline);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      window.removeEventListener("online", onOnline);
    };
  }, [fingerprint, schedules.syncState, userId]);
}
