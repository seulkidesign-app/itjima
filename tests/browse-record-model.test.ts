import { describe, expect, it } from "vitest";
import {
  getAllBrowseEntries,
  searchAllBrowseEntries,
} from "@/lib/browseRecordModel";
import type { InboxItem, ScheduleItem } from "@/lib/store";

const canonical: InboxItem = {
  id: "record-1",
  text: "내일 여행",
  images: [],
  created_at: "2026-09-01T09:00:00.000Z",
  status: "active",
  start_time: "2026-09-02T00:00:00.000Z",
  end_time: "2026-09-02T23:59:59.999Z",
  all_day: true,
  temporal_state: "date_only",
  structured_at: "2026-09-01T09:00:01.000Z",
};

const canonicalProjection: ScheduleItem = {
  id: "record-1",
  source_id: "record-1",
  text: "내일 여행",
  start_time: "2026-09-02T00:00:00.000Z",
  end_time: "2026-09-02T23:59:59.999Z",
  alarm: false,
  all_day: true,
  created_at: "2026-09-01T09:00:00.000Z",
  status: "active",
};

const standalone: ScheduleItem = {
  id: "legacy-schedule-1",
  text: "예전 수동 일정",
  start_time: "2026-08-01T06:00:00.000Z",
  end_time: "2026-08-01T07:00:00.000Z",
  alarm: false,
  created_at: "2026-08-01T01:00:00.000Z",
  status: "active",
};

describe("complete All records read model", () => {
  it("counts a canonical record once and includes standalone legacy/manual schedules", () => {
    const entries = getAllBrowseEntries(
      [canonical],
      [canonicalProjection, standalone],
    );

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.kind)).toEqual([
      "record",
      "schedule",
    ]);
    expect(entries.map((entry) => entry.text)).toEqual([
      "내일 여행",
      "예전 수동 일정",
    ]);
  });

  it("does not resurrect a schedule projection when its canonical record is deleted", () => {
    const deleted: InboxItem = {
      ...canonical,
      id: "deleted-record",
      status: "deleted",
    };
    const ghost: ScheduleItem = {
      ...canonicalProjection,
      id: "deleted-record",
      source_id: "deleted-record",
    };

    const entries = getAllBrowseEntries(
      [canonical, deleted],
      [canonicalProjection, ghost],
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "record",
      canonicalId: "record-1",
    });
  });

  it("dedupes old random-id and same-id projections before adding standalone schedules", () => {
    const oldProjection: ScheduleItem = {
      ...standalone,
      id: "legacy-random-id",
      source_id: "legacy-canonical-id",
    };
    const sameIdProjection: ScheduleItem = {
      ...standalone,
      id: "legacy-canonical-id",
      source_id: "legacy-canonical-id",
    };

    const entries = getAllBrowseEntries([], [oldProjection, sameIdProjection]);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "schedule",
      id: "legacy-canonical-id",
      canonicalId: "legacy-canonical-id",
    });
  });

  it("searches standalone schedules as well as canonical records", () => {
    const results = searchAllBrowseEntries(
      [canonical],
      [canonicalProjection, standalone],
      "수동",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      kind: "schedule",
      text: "예전 수동 일정",
    });
  });
});
