import {
  subscribePush,
  showLocalTestNotification,
  type PushSubscribeResult,
} from "@/lib/push/pushSubscription";

export type AlarmEnableResult = {
  ok: boolean;
  pushSubscribed: boolean;
  testNotificationShown: boolean;
  subscribe?: PushSubscribeResult;
};

export type AlarmEnableDeps = {
  userId: string;
  requestPermission: () => Promise<NotificationPermission>;
  subscribePush?: typeof subscribePush;
  showTestNotification?: typeof showLocalTestNotification;
};

/**
 * Runs after the user taps "알림 켜기". The caller must await
 * `requestPermission()` as the first async operation in the click handler
 * and pass the result here when granted.
 *
 * Local display test only — does not verify server push delivery.
 */
export async function completeAlarmEnableAfterGrant(
  userId: string,
  deps?: Partial<
    Pick<AlarmEnableDeps, "subscribePush" | "showTestNotification">
  >,
): Promise<AlarmEnableResult> {
  const doSubscribe = deps?.subscribePush ?? subscribePush;
  const doTest = deps?.showTestNotification ?? showLocalTestNotification;

  const push = await doSubscribe(userId);
  if (!push.ok) {
    return {
      ok: false,
      pushSubscribed: false,
      testNotificationShown: false,
      subscribe: push,
    };
  }

  const testNotificationShown = await doTest();

  return {
    ok: push.ok,
    pushSubscribed: push.ok,
    testNotificationShown,
    subscribe: push,
  };
}

/** Full enable flow for unit tests — enforces requestPermission runs first. */
export async function runAlarmEnableFlow(
  deps: AlarmEnableDeps,
): Promise<
  AlarmEnableResult & { permission: NotificationPermission | "unsupported" }
> {
  const permission = await deps.requestPermission();
  if (permission !== "granted") {
    return {
      ok: false,
      permission,
      pushSubscribed: false,
      testNotificationShown: false,
    };
  }

  const result = await completeAlarmEnableAfterGrant(deps.userId, deps);
  return { ...result, permission };
}
