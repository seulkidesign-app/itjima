/**
 * Sync schedule reminders with the service worker for background delivery.
 * Falls back to in-tab timers when SW is unavailable.
 */
import type { ScheduleItem } from "@/lib/store";
import { effectiveAlarmAt } from "@/lib/scheduleReminders";
import { scheduleDisplayTitle } from "@/lib/thoughtProvenance";

const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function syncRemindersToServiceWorker(
  items: ScheduleItem[],
): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  if (!reg?.active) return false;

  const now = Date.now();
  const reminders = items
    .filter((s) => s.alarm && s.status !== "done")
    .map((s) => {
      const fireAt = effectiveAlarmAt(s);
      if (!fireAt) return null;
      const delay = fireAt.getTime() - now;
      if (delay <= 0 || delay > HORIZON_MS) return null;
      return {
        id: s.id,
        title: scheduleDisplayTitle(s),
        fireAt: fireAt.toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  reg.active.postMessage({ type: "SCHEDULE_REMINDERS", reminders });
  return true;
}

export async function cancelServiceWorkerReminder(id: string): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  reg?.active?.postMessage({ type: "CANCEL_REMINDER", id });
}

export function notificationPermissionState():
  | "granted"
  | "denied"
  | "default"
  | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}
