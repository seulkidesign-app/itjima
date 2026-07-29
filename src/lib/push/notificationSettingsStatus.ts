import { readNotificationPermission } from "@/lib/alarmAvailability";
import { isDevicePushRegisteredForCurrentUser } from "@/lib/push/pushSubscriptionAccount";
import { getSessionUserId } from "@/lib/push/pushSubscriptionAccount";

export type NotificationSettingsStatus =
  | "active"
  | "setup_needed"
  | "blocked";

export async function getNotificationSettingsStatus(): Promise<NotificationSettingsStatus> {
  const permission = readNotificationPermission();
  if (permission === "denied") return "blocked";
  if (permission === "unsupported") return "setup_needed";

  const userId = await getSessionUserId();
  if (!userId) return "setup_needed";

  if (permission === "granted") {
    const registered = await isDevicePushRegisteredForCurrentUser();
    return registered ? "active" : "setup_needed";
  }

  return "setup_needed";
}
