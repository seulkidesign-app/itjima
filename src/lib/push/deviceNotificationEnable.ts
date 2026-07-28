import { completeAlarmEnableAfterGrant } from "@/lib/alarmPermissionFlow";
import {
  describePushFailure,
  logPushDiagnostic,
  logPushFailure,
  summarizePushEnvironment,
} from "@/lib/push/pushDiagnostics";
import {
  ensurePushSubscription,
  hasStoredPushSubscription,
  pushSupportState,
  showLocalTestNotification,
  subscribePush,
  type PushSubscribeResult,
} from "@/lib/push/pushSubscription";

export type DeviceNotificationRegisterResult = {
  ok: boolean;
  pushSubscribed: boolean;
  testNotificationShown: boolean;
  permission: NotificationPermission | "unsupported";
  subscribe?: PushSubscribeResult;
  errorMessage?: string;
};

function permissionState(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

/** Runs after permission is granted — subscribe + optional local test notification. */
export async function registerDeviceAfterPermissionGrant(
  userId: string,
  lang: "ko" | "en",
): Promise<DeviceNotificationRegisterResult> {
  logPushDiagnostic("register_after_grant:start", {
    userId,
    env: summarizePushEnvironment(),
  });

  const result = await completeAlarmEnableAfterGrant(userId);
  if (!result.pushSubscribed) {
    logPushFailure("register_after_grant:subscribe_failed", {
      userId,
      subscribe: result.subscribe,
    });
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission: permissionState(),
      subscribe: result.subscribe,
      errorMessage: describePushFailure(
        result.subscribe ?? { state: "expired" },
        lang,
      ),
    };
  }

  if (!result.testNotificationShown) {
    logPushFailure("register_after_grant:local_test_failed", { userId });
  } else {
    logPushDiagnostic("register_after_grant:subscribe_ok", { userId });
  }

  return {
    ok: true,
    pushSubscribed: true,
    testNotificationShown: result.testNotificationShown,
    permission: permissionState(),
    subscribe: result.subscribe,
    errorMessage: result.testNotificationShown
      ? undefined
      : describePushFailure({ state: "expired", code: "local_test_failed" }, lang),
  };
}

/**
 * Request OS permission, then subscribe this device.
 * Must run directly from a user click handler.
 */
export async function requestPermissionAndRegisterDevice(
  userId: string,
  lang: "ko" | "en",
): Promise<DeviceNotificationRegisterResult> {
  logPushDiagnostic("register_with_permission_request:start", {
    userId,
    env: summarizePushEnvironment(),
  });

  const support = pushSupportState();
  if (support === "unsupported" || support === "not_installed") {
    const errorMessage = describePushFailure({ state: support }, lang);
    logPushFailure("register_with_permission_request:blocked", { support });
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission: permissionState(),
      errorMessage,
    };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    logPushFailure("register_with_permission_request:permission_denied", {
      permission,
    });
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission,
      errorMessage: describePushFailure({ state: permission }, lang),
    };
  }

  return registerDeviceAfterPermissionGrant(userId, lang);
}

/** Re-register when permission is already granted (Settings / granted alarm sheet). */
export async function refreshDeviceRegistration(
  userId: string,
  lang: "ko" | "en",
): Promise<DeviceNotificationRegisterResult> {
  logPushDiagnostic("refresh_registration:start", {
    userId,
    env: summarizePushEnvironment(),
  });

  const support = pushSupportState();
  if (support === "unsupported" || support === "not_installed") {
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission: permissionState(),
      errorMessage: describePushFailure({ state: support }, lang),
    };
  }

  if (Notification.permission !== "granted") {
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission: permissionState(),
      errorMessage: describePushFailure({ state: "default" }, lang),
    };
  }

  const subscribe = await subscribePush(userId);
  if (!subscribe.ok) {
    logPushFailure("refresh_registration:subscribe_failed", subscribe);
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      permission: permissionState(),
      subscribe,
      errorMessage: describePushFailure(subscribe, lang),
    };
  }

  const testNotificationShown = await showLocalTestNotification();
  logPushDiagnostic("refresh_registration:complete", {
    userId,
    testNotificationShown,
  });

  return {
    ok: true,
    pushSubscribed: true,
    testNotificationShown,
    permission: permissionState(),
    subscribe,
    errorMessage: testNotificationShown
      ? undefined
      : describePushFailure({ state: "expired", code: "local_test_failed" }, lang),
  };
}

export async function ensureStoredDeviceRegistration(
  userId: string,
  lang: "ko" | "en",
): Promise<DeviceNotificationRegisterResult> {
  const stored = await hasStoredPushSubscription(userId);
  if (stored) {
    const refresh = await refreshDeviceRegistration(userId, lang);
    return refresh.ok ? refresh : refresh;
  }

  if (Notification.permission === "granted") {
    return refreshDeviceRegistration(userId, lang);
  }

  return {
    ok: false,
    pushSubscribed: false,
    testNotificationShown: false,
    permission: permissionState(),
    errorMessage: describePushFailure({ state: "default" }, lang),
  };
}

export async function probeStoredRegistration(userId: string): Promise<boolean> {
  return hasStoredPushSubscription(userId);
}

export { ensurePushSubscription };
