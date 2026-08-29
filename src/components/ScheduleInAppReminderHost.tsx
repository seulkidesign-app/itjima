import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSchedules } from "@/lib/store";
import { bindInAppReminders } from "@/lib/scheduleReminders";

/**
 * Keep the pre-unification reminder contract: while the Schedule route is open,
 * locally armed reminders can still fire even when closed-app push is not ready.
 */
export function ScheduleInAppReminderHost() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { items } = useSchedules();

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
