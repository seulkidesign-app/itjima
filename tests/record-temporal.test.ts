import { describe, expect, it } from "vitest";
import {
  attachExactTemporalPatch,
  clearTemporalMetadataPatch,
  isStructuredTimedRecord,
  temporalStateFromAutoCommitReason,
} from "@/lib/recordTemporal";

describe("recordTemporal", () => {
  it("maps auto-commit block reasons to temporal_state", () => {
    expect(temporalStateFromAutoCommitReason("no_clock")).toBe("no_time");
    expect(temporalStateFromAutoCommitReason("date_only")).toBe("date_only");
    expect(temporalStateFromAutoCommitReason("assumed_meridiem")).toBe(
      "ambiguous",
    );
    expect(temporalStateFromAutoCommitReason("after_work_time")).toBe(
      "fuzzy_time",
    );
  });

  it("distinguishes structured timed records from undated ones", () => {
    expect(
      isStructuredTimedRecord({
        temporal_state: "exact_datetime",
        start_time: "2026-08-21T06:00:00.000Z",
        structured_at: "2026-08-20T01:00:00.000Z",
      }),
    ).toBe(true);
    expect(
      isStructuredTimedRecord({
        temporal_state: "ambiguous",
        start_time: null,
        structured_at: null,
      }),
    ).toBe(false);
    expect(
      isStructuredTimedRecord({
        temporal_state: "exact_datetime",
        start_time: null,
        structured_at: null,
      }),
    ).toBe(false);
  });

  it("attach/clear patches never invent a default clock", () => {
    const attached = attachExactTemporalPatch({
      start_time: "2026-08-21T06:00:00.000Z",
      end_time: "2026-08-21T07:00:00.000Z",
      all_day: false,
      text: "치과",
    });
    expect(attached.temporal_state).toBe("exact_datetime");
    expect(attached.start_time).toBe("2026-08-21T06:00:00.000Z");

    const cleared = clearTemporalMetadataPatch();
    expect(cleared).toMatchObject({
      start_time: null,
      end_time: null,
      temporal_state: "no_time",
      structured_at: null,
      clarification_state: "dismissed",
    });
  });
});
