import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useUserId, type ScheduleItem } from "@/lib/store";
import { bindInAppReminders } from "@/lib/scheduleReminders";

function readSchedules(key: string): ScheduleItem[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? (value as ScheduleItem[]) : [];
  } catch {
    return [];
  }
}

/**
 * Keep the pre-unification reminder contract: while the Schedule route is open,
 * locally armed reminders can still fire even when closed-app push is not ready.
 * This host reads the existing local schedule bucket directly so it does not
 * create a second useSchedules() cloud-sync subscription beside the route.
 */
export function ScheduleInAppReminderHost() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const userId = useUserId();
  const key = `itjima.${userId ?? "guest"}.schedules`;
  const [items, setItems] = useState<ScheduleItem[]>([]);

  useEffect(() => {
    if (!pathname.startsWith("/schedule")) {
      setItems([]);
      return;
    }

    const reload = () => setItems(readSchedules(key));
    const onUpdate = (event: Event) => {
      if ((event as CustomEvent).detail === key) reload();
    };

    reload();
    window.addEventListener("itjima:update", onUpdate as EventListener);
    return () => window.removeEventListener("itjima:update", onUpdate as EventListener);
  }, [key, pathname]);

  useEffect(() => {
    if (!pathname.startsWith("/schedule")) return;

    return bindInAppReminders(items, (title, body) => {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    });
  }, [items, pathname]);

  return null;
}
