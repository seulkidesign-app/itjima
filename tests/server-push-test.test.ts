import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/push/pushSubscription", () => ({
  hasStoredPushSubscription: vi.fn(),
  ensurePushSubscription: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { hasStoredPushSubscription, ensurePushSubscription } from "@/lib/push/pushSubscription";
import { supabase } from "@/integrations/supabase/client";
import {
  buildServerPushTestUpsert,
  diagnoseServerPushTest,
  isServerPushTestScheduleId,
  SERVER_PUSH_TEST_CRON_STALE_MS,
  SERVER_PUSH_TEST_SCHEDULE_ID,
  SERVER_PUSH_TEST_TIMEOUT_MS,
  serverPushTestIdempotencyKey,
  serverPushTestMessage,
  startServerPushTest,
  type ServerPushTestRow,
} from "@/lib/push/serverPushTest";
import { buildReminderUpsert } from "@/lib/push/scheduledRemindersSync";
import type { ScheduleItem } from "@/lib/store";

function makeTestRow(
  overrides: Partial<ServerPushTestRow> = {},
): ServerPushTestRow {
  const now = Date.now();
  return {
    id: "row-1",
    status: "pending",
    attempt_count: 0,
    sent_at: null,
    created_at: new Date(now - 30_000).toISOString(),
    updated_at: new Date(now - 30_000).toISOString(),
    due_at_utc: new Date(now + 60_000).toISOString(),
    ...overrides,
  };
}

describe("scheduled_reminders schema", () => {
  it("uses a test schedule id without schedules FK (see migration comment)", () => {
    expect(isServerPushTestScheduleId(SERVER_PUSH_TEST_SCHEDULE_ID)).toBe(true);
  });
});

describe("server push test row", () => {
  it("builds idempotency keys scoped to the user", () => {
    const due = "2026-07-27T12:00:00.000Z";
    expect(serverPushTestIdempotencyKey("user-a", due)).toBe(
      "push-test:user-a:2026-07-27T12:00:00.000Z",
    );
    expect(serverPushTestIdempotencyKey("user-b", due)).not.toBe(
      serverPushTestIdempotencyKey("user-a", due),
    );
  });

  it("upsert uses the test schedule id and push-test idempotency prefix", () => {
    const due = new Date("2026-07-27T12:01:00.000Z");
    const row = buildServerPushTestUpsert("user-1", due);
    expect(row.schedule_id).toBe(SERVER_PUSH_TEST_SCHEDULE_ID);
    expect(row.idempotency_key.startsWith("push-test:user-1:")).toBe(true);
    expect(row.status).toBe("pending");
  });
});

describe("server push diagnostics", () => {
  it("reports sent when the row is sent", () => {
    const row = makeTestRow({ status: "sent", sent_at: new Date().toISOString() });
    expect(diagnoseServerPushTest(row)).toBe("sent");
    expect(serverPushTestMessage("sent", "ko")).toBe(
      "서버에서 테스트 알림을 보냈어요.",
    );
  });

  it("reports failed when the row failed", () => {
    const row = makeTestRow({ status: "failed" });
    expect(diagnoseServerPushTest(row)).toBe("failed");
    expect(serverPushTestMessage("failed", "ko")).toBe(
      "서버에서 알림을 보내지 못했어요.",
    );
  });

  it("reports cron_unknown when pending long after due time", () => {
    const now = Date.now();
    const row = makeTestRow({
      status: "pending",
      due_at_utc: new Date(
        now - SERVER_PUSH_TEST_CRON_STALE_MS - 1_000,
      ).toISOString(),
    });
    expect(diagnoseServerPushTest(row, now)).toBe("cron_unknown");
    expect(serverPushTestMessage("cron_unknown", "ko")).toBe(
      "예약 발송 서버가 아직 실행되지 않았어요.",
    );
  });

  it("reports waiting while pending before timeout", () => {
    const now = Date.now();
    const row = makeTestRow({
      status: "pending",
      created_at: new Date(now - 30_000).toISOString(),
      due_at_utc: new Date(now + 30_000).toISOString(),
    });
    expect(diagnoseServerPushTest(row, now)).toBe("waiting");
  });

  it("reports failed after the overall timeout", () => {
    const now = Date.now();
    const row = makeTestRow({
      status: "pending",
      created_at: new Date(now - SERVER_PUSH_TEST_TIMEOUT_MS - 1).toISOString(),
      due_at_utc: new Date(now - 5_000).toISOString(),
    });
    expect(diagnoseServerPushTest(row, now)).toBe("failed");
  });
});

describe("startServerPushTest guards", () => {
  beforeEach(() => {
    vi.mocked(hasStoredPushSubscription).mockReset();
    vi.mocked(ensurePushSubscription).mockReset();
    vi.mocked(supabase.from).mockReset();
  });

  it("does not run without login", async () => {
    const result = await startServerPushTest(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe("no_login");
  });

  it("does not run without notification permission", async () => {
    vi.stubGlobal("Notification", {
      permission: "default",
    });
    const result = await startServerPushTest("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe("no_permission");
    vi.unstubAllGlobals();
  });

  it("does not run when subscription is missing", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.mocked(hasStoredPushSubscription).mockResolvedValue(false);

    const result = await startServerPushTest("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe("no_subscription");
    expect(ensurePushSubscription).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("does not create a row when subscription save fails", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.mocked(hasStoredPushSubscription).mockResolvedValue(true);
    vi.mocked(ensurePushSubscription).mockResolvedValue({
      ok: false,
      state: "expired",
    });

    const result = await startServerPushTest("user-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.phase).toBe("subscription_save_failed");
    expect(supabase.from).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("reuses an in-flight test instead of creating duplicates", async () => {
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.mocked(hasStoredPushSubscription).mockResolvedValue(true);
    vi.mocked(ensurePushSubscription).mockResolvedValue({
      ok: true,
      state: "granted",
    });

    const activeRow = {
      id: "row-active",
      status: "pending" as const,
      attempt_count: 0,
      sent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      due_at_utc: new Date(Date.now() + 60_000).toISOString(),
    };

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lt: vi.fn().mockResolvedValue({ error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: activeRow, error: null }),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    const fromMock = vi.fn(() => chain);
    vi.mocked(supabase.from).mockImplementation(fromMock as never);

    const [first, second] = await Promise.all([
      startServerPushTest("user-1"),
      startServerPushTest("user-1"),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.row.id).toBe(first.row.id);
    }
    vi.unstubAllGlobals();
  });
});

describe("regular reminders stay separate from server push tests", () => {
  it("does not build regular reminder rows without alarm permission path", () => {
    const schedule: ScheduleItem = {
      id: "real-schedule",
      text: "회의",
      start_time: "2026-07-27T12:00:00.000Z",
      end_time: "2026-07-27T13:00:00.000Z",
      alarm: false,
      created_at: "2026-07-26T00:00:00.000Z",
    };
    expect(buildReminderUpsert("user-1", schedule)).toBeNull();
    expect(schedule.id).not.toBe(SERVER_PUSH_TEST_SCHEDULE_ID);
  });
});

describe("local vs server messaging", () => {
  it("does not use server-success wording for local-only phases", () => {
    expect(serverPushTestMessage("waiting", "ko")).not.toContain("기기");
    expect(serverPushTestMessage("sent", "ko")).not.toMatch(
      /앱을 닫아도|서버 연결 정상|예약 알림 정상/,
    );
  });
});
