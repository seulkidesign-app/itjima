import { supabase } from "@/integrations/supabase/client";
import {
  diagnoseServerPushTest,
  fetchServerPushTestRow,
  startServerPushTest,
  type ServerPushTestPhase,
  type ServerPushTestRow,
} from "@/lib/push/serverPushTest";

export type IosPwaPayloadKind = "minimal" | "schedule";

export type IosPwaDeliveryResult = {
  platform: string;
  attempted: boolean;
  accepted: boolean;
  statusCode: number | null;
  errorType: string | null;
  errorMessage: string | null;
};

export type IosPwaPushTestResponse = {
  ok: boolean;
  payloadKind?: IosPwaPayloadKind;
  accepted?: number;
  attempted?: number;
  deliveries?: IosPwaDeliveryResult[];
  error?: string;
};

export type IosPwaSubscriptionProbe = {
  platform: string;
  last_success_at: string | null;
  failure_count: number;
  updated_at: string;
};

export async function invokeIosPwaPushTest(
  payloadKind: IosPwaPayloadKind = "minimal",
): Promise<IosPwaPushTestResponse> {
  if (import.meta.env.VITE_E2E === "true") {
    return { ok: false, error: "e2e_disabled" };
  }

  const { data, error } = await supabase.functions.invoke("test-push-ios", {
    body: { payloadKind },
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

export function iosPwaDeliverySucceeded(
  deliveries: IosPwaDeliveryResult[] | undefined,
): boolean {
  return Boolean(deliveries?.some((row) => row.platform === "ios-pwa" && row.accepted));
}

export function formatIosPwaDeliverySummary(
  deliveries: IosPwaDeliveryResult[] | undefined,
  lang: "ko" | "en",
): string {
  const row = deliveries?.find((entry) => entry.platform === "ios-pwa");
  if (!row) {
    return lang === "ko"
      ? "ios-pwa 구독 결과가 없어요."
      : "No ios-pwa subscription result.";
  }
  if (row.accepted) {
    return lang === "ko"
      ? "Push 서비스가 ios-pwa 알림을 수락했어요."
      : "Push service accepted the ios-pwa notification.";
  }
  const detail = row.errorType ?? row.errorMessage ?? "unknown";
  return lang === "ko"
    ? `Push 서비스 거절 (${detail})`
    : `Push service rejected (${detail})`;
}

export type IosScheduledPushProbe = {
  reminderPhase: ServerPushTestPhase;
  iosLastSuccessAt: string | null;
  iosDeliveredAfterDue: boolean;
  macMaskedSent: boolean;
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
  };
}

export async function runIosPwaImmediatePushTest(
  payloadKind: IosPwaPayloadKind = "minimal",
): Promise<IosPwaPushTestResponse> {
  return invokeIosPwaPushTest(payloadKind);
}

export async function startIosPwaScheduledPushTest(
  userId: string | null,
): Promise<
  | { ok: true; row: ServerPushTestRow; resumed?: boolean }
  | { ok: false; phase: ServerPushTestPhase }
> {
  return startServerPushTest(userId);
}

export async function pollIosPwaScheduledPushTest(
  userId: string,
  rowId: string,
): Promise<IosScheduledPushProbe | null> {
  const row = await fetchServerPushTestRow(userId, rowId);
  if (!row) return null;
  return probeIosScheduledPushDelivery(userId, row);
}
