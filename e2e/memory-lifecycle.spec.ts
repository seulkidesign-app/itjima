import { test, expect } from "@playwright/test";
import type { ArchiveItem, InboxItem, ScheduleItem } from "../src/lib/store";
import {
  confirmResurface,
  createCapturedMemory,
  getMemoryTemporalState,
  isMemoryDue,
  isMemoryDueToday,
  keepMemory,
  migrateLegacyBucketsToMemories,
  reopenMemory,
  resolveMemory,
  snoozeMemory,
  findMemoryByLegacy,
} from "../src/lib/memory";
import {
  ensureCanonicalMemoriesMigrated,
  getMemoryMigrationState,
  readLocalMemories,
  withMemoryLocalStorage,
  MEMORY_MIGRATION_VERSION,
} from "./memory-local-harness";

const TZ = "Asia/Seoul";

function captured(content = "hello") {
  return createCapturedMemory({
    id: "mem-1",
    content: { text: content, images: [] },
    resurface_timezone: TZ,
  });
}

test.describe("Memory lifecycle (pure)", () => {
  test("1. inbox maps to captured", () => {
    const inbox: InboxItem = {
      id: "in-1",
      text: "inbox thought",
      images: ["img-a"],
      created_at: "2026-07-01T00:00:00.000Z",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [inbox], schedules: [], archive: [] },
      [],
      TZ,
    );
    expect(memories).toHaveLength(1);
    expect(memories[0].status).toBe("captured");
    expect(memories[0].content.images).toEqual(["img-a"]);
    expect(memories[0].provenance?.legacy_source).toBe("inbox");
  });

  test("2. valid schedule maps to waiting", () => {
    const schedule: ScheduleItem = {
      id: "sc-1",
      text: "dentist",
      start_time: "2026-07-20T01:00:00.000Z",
      end_time: "2026-07-20T02:00:00.000Z",
      alarm: false,
      created_at: "2026-07-01T00:00:00.000Z",
      status: "active",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [], schedules: [schedule], archive: [] },
      [],
      TZ,
    );
    expect(memories[0].status).toBe("waiting");
    expect(memories[0].resurface_precision).toBe("exact");
    expect(memories[0].resurface_at).toBe("2026-07-20T01:00:00.000Z");
  });

  test("3. completed schedule maps to resolved/completed", () => {
    const schedule: ScheduleItem = {
      id: "sc-done",
      text: "done task",
      start_time: "2026-07-20T01:00:00.000Z",
      end_time: "2026-07-20T02:00:00.000Z",
      alarm: false,
      created_at: "2026-07-01T00:00:00.000Z",
      status: "done",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [], schedules: [schedule], archive: [] },
      [],
      TZ,
    );
    expect(memories[0].status).toBe("resolved");
    expect(memories[0].resolution_kind).toBe("completed");
  });

  test("4. schedule without valid date maps to captured", () => {
    const schedule: ScheduleItem = {
      id: "sc-bad",
      text: "floating",
      start_time: "not-a-date",
      end_time: "not-a-date",
      alarm: false,
      created_at: "2026-07-01T00:00:00.000Z",
      status: "active",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [], schedules: [schedule], archive: [] },
      [],
      TZ,
    );
    expect(memories[0].status).toBe("captured");
  });

  test("5. archive maps to kept", () => {
    const archive: ArchiveItem = {
      id: "ar-1",
      text: "saved",
      images: [],
      created_at: "2026-07-01T00:00:00.000Z",
      raw_text: "saved raw",
      source_id: "in-old",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [], schedules: [], archive: [archive] },
      [],
      TZ,
    );
    expect(memories[0].status).toBe("kept");
    expect(memories[0].content.raw_text).toBe("saved raw");
    expect(memories[0].provenance?.source_id).toBe("in-old");
  });

  test("6. duplicate migration is idempotent", () => {
    const inbox: InboxItem = {
      id: "dup",
      text: "once",
      images: [],
      created_at: "2026-07-01T00:00:00.000Z",
    };
    const buckets = { inbox: [inbox], schedules: [], archive: [] };
    const first = migrateLegacyBucketsToMemories(buckets, [], TZ);
    const second = migrateLegacyBucketsToMemories(buckets, first.memories, TZ);
    expect(first.memories).toHaveLength(1);
    expect(second.memories).toHaveLength(1);
    expect(second.added).toBe(0);
  });

  test("7. same legacy id in different buckets both preserved", () => {
    const sharedId = "shared-id";
    const inbox: InboxItem = {
      id: sharedId,
      text: "from inbox",
      images: [],
      created_at: "2026-07-01T00:00:00.000Z",
    };
    const archive: ArchiveItem = {
      id: sharedId,
      text: "from archive",
      images: [],
      created_at: "2026-07-02T00:00:00.000Z",
    };
    const { memories } = migrateLegacyBucketsToMemories(
      { inbox: [inbox], schedules: [], archive: [archive] },
      [],
      TZ,
    );
    expect(memories).toHaveLength(2);
    expect(
      findMemoryByLegacy(memories, "inbox", sharedId)?.content.text,
    ).toBe("from inbox");
    expect(
      findMemoryByLegacy(memories, "archive", sharedId)?.content.text,
    ).toBe("from archive");
  });

  test("8. captured → waiting", () => {
    const next = confirmResurface(captured(), {
      precision: "exact",
      resurface_at: "2026-07-20T09:00:00.000Z",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(next.ok).toBe(true);
    if (next.ok) {
      expect(next.value.status).toBe("waiting");
      expect(next.value.resurface_at).toBe("2026-07-20T09:00:00.000Z");
    }
  });

  test("9. captured → kept", () => {
    const next = keepMemory(captured());
    expect(next.ok).toBe(true);
    if (next.ok) expect(next.value.status).toBe("kept");
  });

  test("10. waiting → snooze updates resurface and count", () => {
    const waiting = confirmResurface(captured(), {
      precision: "exact",
      resurface_at: "2026-07-20T09:00:00.000Z",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    const snoozed = snoozeMemory(waiting.value, {
      precision: "exact",
      resurface_at: "2026-07-21T09:00:00.000Z",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(snoozed.ok).toBe(true);
    if (snoozed.ok) {
      expect(snoozed.value.snooze_count).toBe(1);
      expect(snoozed.value.resurface_at).toBe("2026-07-21T09:00:00.000Z");
    }
  });

  test("11. waiting → resolved/completed", () => {
    const waiting = confirmResurface(captured(), {
      precision: "day",
      resurface_on: "2026-07-20",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    const done = resolveMemory(waiting.value, "completed");
    expect(done.ok).toBe(true);
    if (done.ok) {
      expect(done.value.status).toBe("resolved");
      expect(done.value.resolution_kind).toBe("completed");
    }
  });

  test("12. waiting → resolved/no_longer_needed", () => {
    const waiting = confirmResurface(captured(), {
      precision: "day",
      resurface_on: "2026-07-20",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    const done = resolveMemory(waiting.value, "no_longer_needed");
    expect(done.ok).toBe(true);
    if (done.ok) expect(done.value.resolution_kind).toBe("no_longer_needed");
  });

  test("13. exact due uses timestamp", () => {
    const memory = {
      ...captured(),
      status: "waiting" as const,
      resurface_precision: "exact" as const,
      resurface_at: "2026-07-20T09:00:00.000Z",
      resurface_on: null,
    };
    expect(
      isMemoryDue(memory, new Date("2026-07-20T08:59:59.000Z"), TZ),
    ).toBe(false);
    expect(isMemoryDue(memory, new Date("2026-07-20T09:00:00.000Z"), TZ)).toBe(
      true,
    );
  });

  test("14. day due uses timezone local date", () => {
    const memory = {
      ...captured(),
      status: "waiting" as const,
      resurface_precision: "day" as const,
      resurface_at: null,
      resurface_on: "2026-07-20",
    };
    expect(
      isMemoryDueToday(memory, new Date("2026-07-19T14:00:00.000Z"), TZ),
    ).toBe(false);
    expect(
      isMemoryDueToday(memory, new Date("2026-07-19T15:00:00.000Z"), TZ),
    ).toBe(true);
  });

  test("15. midnight boundary avoids UTC-only Today exposure", () => {
    const memory = {
      ...captured(),
      status: "waiting" as const,
      resurface_precision: "day" as const,
      resurface_at: null,
      resurface_on: "2026-07-20",
      resurface_timezone: TZ,
    };
    const stillPreviousSeoulDay = new Date("2026-07-19T14:59:59.000Z");
    expect(getMemoryTemporalState(memory, stillPreviousSeoulDay, TZ)).toBe(
      "not_due",
    );
    const seoulMidnight = new Date("2026-07-19T15:00:00.000Z");
    expect(getMemoryTemporalState(memory, seoulMidnight, TZ)).toBe("due_today");
  });

  test("invalid transition returns typed error", () => {
    const kept = keepMemory(captured());
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    const invalid = confirmResurface(kept.value, {
      precision: "day",
      resurface_on: "2026-07-20",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.error.code).toBe("INVALID_TRANSITION");
  });

  test("reopen resolved memory to captured", () => {
    const waiting = confirmResurface(captured(), {
      precision: "day",
      resurface_on: "2026-07-20",
      resurface_timezone: TZ,
      resurface_reason_source: "manual",
    });
    expect(waiting.ok).toBe(true);
    if (!waiting.ok) return;
    const resolved = resolveMemory(waiting.value, "completed");
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const reopened = reopenMemory(resolved.value);
    expect(reopened.ok).toBe(true);
    if (reopened.ok) expect(reopened.value.status).toBe("captured");
  });
});

test.describe("Memory local migration", () => {
  test("16. guest → user merge avoids duplicate provenance", () => {
    withMemoryLocalStorage(
      (storage) => {
        storage.setItem(
          "itjima.guest.inbox",
          JSON.stringify([
            {
              id: "guest-in",
              text: "guest thought",
              images: [],
              created_at: "2026-07-01T00:00:00.000Z",
            },
          ]),
        );
        storage.setItem(
          "itjima.user-1.inbox",
          JSON.stringify([
            {
              id: "user-in",
              text: "user thought",
              images: [],
              created_at: "2026-07-02T00:00:00.000Z",
            },
          ]),
        );
      },
      () => {
        ensureCanonicalMemoriesMigrated("user-1");
        const merged = readLocalMemories("user-1");
        expect(merged.length).toBeGreaterThanOrEqual(2);
        const legacyIds = merged.map((m) => m.provenance?.legacy_id);
        expect(legacyIds).toContain("guest-in");
        expect(legacyIds).toContain("user-in");
      },
    );
  });

  test("17. legacy payload and migration marker preserved", () => {
    withMemoryLocalStorage(
      (storage) => {
        storage.setItem(
          "itjima.guest.archive",
          JSON.stringify([
            {
              id: "ar-payload",
              text: "archive payload",
              images: ["img-1"],
              created_at: "2026-07-01T00:00:00.000Z",
              brain_mirror: {
                title: "mirror",
                items: ["line"],
                suggestedDateText: "",
                suggestedAction: "",
                confidence: 0.8,
                version: 1,
                isCurrent: true,
              },
            },
          ]),
        );
      },
      () => {
        ensureCanonicalMemoriesMigrated(null);
        const marker = getMemoryMigrationState(null);
        const memories = readLocalMemories(null);
        expect(marker?.version).toBe(MEMORY_MIGRATION_VERSION);
        expect(marker?.status).toBe("complete");
        const memory = memories.find(
          (m) => m.provenance?.legacy_id === "ar-payload",
        );
        expect(memory?.content.images).toEqual(["img-1"]);
        expect(memory?.provenance?.legacy_payload).toBeTruthy();
        expect(memory?.content.brain_mirror?.title).toBe("mirror");
      },
    );
  });

  test("local migration running twice does not duplicate", () => {
    withMemoryLocalStorage(
      (storage) => {
        storage.setItem(
          "itjima.guest.inbox",
          JSON.stringify([
            {
              id: "once",
              text: "single",
              images: [],
              created_at: "2026-07-01T00:00:00.000Z",
            },
          ]),
        );
      },
      () => {
        ensureCanonicalMemoriesMigrated(null);
        expect(readLocalMemories(null)).toHaveLength(1);
        ensureCanonicalMemoriesMigrated(null);
        expect(readLocalMemories(null)).toHaveLength(1);
      },
    );
  });
});
