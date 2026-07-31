import { supabase } from "@/integrations/supabase/client";
import {
  diagnoseServerPushTest,
  SERVER_PUSH_TEST_CRON_STALE_MS,
  type ServerPushTestPhase,
  type ServerPushTestRow,
} from "@/lib/push/serverPushTest";

export const IOS_PWA_SCHEDULED_TEST_DELAY_MS = 3 * 60 * 1000;

export type IosPwaDeliveryResult = {
  platform: string;
  attempted: boolean;
  accepted: boolean;
  statusCode: number | null;
  errorType: string | null;
  errorMessage: string | null;
  deliveryId?: string;
  serverSentAt?: string;
};

export type IosPwaPushTestResponse = {
  ok: boolean;
  accepted?: number;
  attempted?: number;
  deliveries?: IosPwaDeliveryResult[];
  deliveryId?: string;
  serverSentAt?: string;
  scheduledReminder?: {
    due_at_utc: string;
    idempotency_key: string;
  } | null;
  error?: string;
};

export type IosPwaSubscriptionProbe = {
  platform: string;
  last_success_at: string | null;
  failure_count: number;
  updated_at: string;
};

export type IosPwaSwProbe = {
  scope: string;
  activeScriptUrl: string | null;
  waiting: boolean;
  controller: boolean;
  cacheVersion: string | null;
};

export async function invokeIosPwaBackgroundPushTest(): Promise<IosPwaPushTestResponse> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: false, error: "e2e_disabled" };
  }

  const { data, error } = await supabase.functions.invoke("test-push-ios", {
    body: { includeScheduledTest: true },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return (data ?? { ok: false, error: "empty_response" }) as IosPwaPushTestResponse;
}

export async function probeIosPwaSubscription(): Promise<IosPwaSubscriptionProbe | null> {
  if (import.meta.env.VITE_E2E === "true") return null;

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("platform, last_success_at, failure_count, updated_at")
    .eq("platform", "ios-pwa")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as IosPwaSubscriptionProbe;
}

export async function probeIosPwaServiceWorker(): Promise<IosPwaSwProbe | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ?? null;
  if (!registration) return null;

  return {
    scope: registration.scope,
    activeScriptUrl: registration.active?.scriptURL ?? null,
    waiting: Boolean(registration.waiting),
    controller: Boolean(navigator.serviceWorker.controller),
    cacheVersion: registration.active?.scriptURL?.includes("sw.js")
      ? "sw.js"
      : null,
  };
}

export function iosPwaDeliverySucceeded(
  deliveries: IosPwaDeliveryResult[] | undefined,
): boolean {
  return Boolean(deliveries?.some((row) => row.platform === "ios-pwa" && row.accepted));
}

export function formatIosPwaDeliverySummary(
  response: Pick<
    IosPwaPushTestResponse,
    "deliveries" | "deliveryId" | "serverSentAt" | "scheduledReminder"
  >,
  lang: "ko" | "en",
): string {
  const row = response.deliveries?.find((entry) => entry.platform === "ios-pwa");
  if (!row) {
    return lang === "ko"
      ? "ios-pwa 구독 결과가 없어요."
      : "No ios-pwa subscription result.";
  }

  const status =
    row.statusCode != null ? `HTTP ${row.statusCode}` : row.errorType ?? "unknown";

  if (row.accepted) {
    const due = response.scheduledReminder?.due_at_utc;
    const dueLabel = due
      ? new Date(due).toLocaleTimeString(lang === "en" ? "en-US" : "ko-KR", {
          hour: "numeric",
          minute: "2-digit",
        })
      : null;
    const base =
      lang === "ko"
        ? `Push 수락 (${status}). 즉시 테스트를 보냈어요.`
        : `Push accepted (${status}). Immediate test sent.`;
    if (!dueLabel) return base;
    return lang === "ko"
      ? `${base} ${dueLabel} 예약 테스트가 등록됐어요.`
      : `${base} Scheduled test registered for ${dueLabel}.`;
  }

  return lang === "ko"
    ? `Push 거절 (${status})`
    : `Push rejected (${status})`;
}

export type IosScheduledPushProbe = {
  reminderPhase: ServerPushTestPhase;
  iosLastSuccessAt: string | null;
  iosDeliveredAfterDue: boolean;
  macMaskedSent: boolean;
  scheduledDueAt: string | null;
};

export async function probeIosScheduledPushDelivery(
  userId: string,
  row: ServerPushTestRow,
): Promise<IosScheduledPushProbe> {
  const reminderPhase = diagnoseServerPushTest(row);
  const ios = await probeIosPwaSubscription();
  const dueMs = Date.parse(row.due_at_utc);
  const iosSuccessMs = ios?.last_success_at
    ? Date.parse(ios.last_success_at)
    : Number.NaN;
  const iosDeliveredAfterDue =
    Number.isFinite(iosSuccessMs) &&
    Number.isFinite(dueMs) &&
    iosSuccessMs >= dueMs - 5_000;

  return {
    reminderPhase,
    iosLastSuccessAt: ios?.last_success_at ?? null,
    iosDeliveredAfterDue,
    macMaskedSent: reminderPhase === "sent" && !iosDeliveredAfterDue,
    scheduledDueAt: row.due_at_utc,
  };
}

export async function pollIosPwaScheduledPushTest(
  userId: string,
  dueAtUtc: string,
): Promise<IosScheduledPushProbe | null> {
  const { data } = await supabase
    .from("scheduled_reminders")
    .select("id, status, due_at_utc, sent_at, created_at, updated_at, attempt_count")
    .eq("user_id", userId)
    .eq("schedule_id", "00000000-0000-4000-a000-000000000001")
    .eq("due_at_utc", dueAtUtc)
    .maybeSingle();

  if (!data) return null;

  const row = data as ServerPushTestRow;
  return probeIosScheduledPushDelivery(userId, row);
}

export function isIosScheduledProbeTerminal(probe: IosScheduledPushProbe): boolean {
  if (probe.iosDeliveredAfterDue) return true;
  const dueMs = Date.parse(probe.scheduledDueAt ?? "");
  if (!Number.isFinite(dueMs)) return false;
  return Date.now() >= dueMs + SERVER_PUSH_TEST_CRON_STALE_MS;
}
