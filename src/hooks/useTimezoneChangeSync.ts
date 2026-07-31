import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { resolveUserTimezone } from "@/lib/push/timezone";
import { syncAllScheduleReminders } from "@/lib/push/scheduledRemindersSync";
import { useSchedules, useUserId } from "@/lib/store";

export const TIMEZONE_STORAGE_KEY = "itjima.timezone";

export function shouldResyncForTimezoneChange(
  previous: string | null | undefined,
  current: string,
): boolean {
  return Boolean(previous && previous !== current);
}

function readStoredTimezone(): string | null {
  if (typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem(TIMEZONE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredTimezone(timezone: string) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone);
  } catch {
    // The current session can still use the resolved timezone.
  }
}

/**
 * Re-queues active server reminders when the device moves to a different IANA
 * timezone. This covers travel and daylight-saving-region changes without
 * forcing users to edit every schedule.
 */
export function useTimezoneChangeSync() {
  const t = useT();
  const userId = useUserId();
  const schedules = useSchedules();
  const runningRef = useRef(false);
  const schedulesRef = useRef(schedules.items);
  const syncStateRef = useRef(schedules.syncState);
  const userIdRef = useRef(userId);

  schedulesRef.current = schedules.items;
  syncStateRef.current = schedules.syncState;
  userIdRef.current = userId;

  useEffect(() => {
    const initial = resolveUserTimezone();
    if (!readStoredTimezone()) writeStoredTimezone(initial);

    const check = async () => {
      if (runningRef.current) return;
      const current = resolveUserTimezone();
      const previous = readStoredTimezone();
      if (!shouldResyncForTimezoneChange(previous, current)) {
        if (!previous) writeStoredTimezone(current);
        return;
      }

      const currentUserId = userIdRef.current;
      if (currentUserId && syncStateRef.current === "syncing") {
        // Wait until cloud schedules have been merged before changing the stored
        // timezone; the effect reruns when syncState becomes ready or error.
        return;
      }

      runningRef.current = true;
      try {
        if (currentUserId) {
          await syncAllScheduleReminders(
            currentUserId,
            schedulesRef.current.filter(
              (schedule) => schedule.alarm && schedule.status !== "done",
            ),
          );
        }
        writeStoredTimezone(current);
        toast.success(
          t(
            `시간대를 ${current} 기준으로 업데이트했어요`,
            `Updated reminders for ${current}`,
          ),
          { duration: 3200 },
        );
      } finally {
        runningRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    const onFocus = () => void check();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    const timer = window.setTimeout(() => void check(), 800);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [schedules.syncState, t, userId]);
}
