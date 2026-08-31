import { describe, expect, it } from "vitest";
import {
  buildTemporalShadowAudit,
  observeTemporalShadow,
} from "@/lib/nlTemporalShadow";

const NOW = new Date(2026, 7, 30, 10, 0, 0, 0);

describe("P0-E temporal model shadow integration", () => {
  it("agrees on a canonical exact clock", () => {
    const start = new Date(2026, 7, 31, 15, 0, 0, 0);
    const audit = buildTemporalShadowAudit(
      "내일 오후 3시 회의",
      NOW,
      { ok: true, start },
      start,
    );

    expect(audit.mismatch).toBe("none");
    expect(audit.modelPrecision).toBe("exact_clock");
    expect(audit.modelResolvedTimed).toBe(true);
    expect(audit.modelHour).toBe(15);
  });

  it("detects when legacy and the model disagree on the clock", () => {
    const audit = buildTemporalShadowAudit(
      "내일 오후 3시 회의",
      NOW,
      { ok: true, start: new Date(2026, 7, 31, 14, 0, 0, 0) },
      new Date(2026, 7, 31, 14, 0, 0, 0),
    );

    expect(audit.mismatch).toBe("legacy_clock_disagreement");
    expect(audit.modelHour).toBe(15);
    expect(audit.legacyHour).toBe(14);
  });

  it("detects an unsafe legacy auto when the model remains ambiguous", () => {
    const start = new Date(2026, 7, 31, 3, 0, 0, 0);
    const audit = buildTemporalShadowAudit(
      "내일 3시 병원",
      NOW,
      { ok: true, start },
      start,
    );

    expect(audit.mismatch).toBe("legacy_auto_model_unresolved");
    expect(audit.modelAmbiguities).toContain("missing_meridiem");
  });

  it("surfaces a model-resolved opportunity that legacy blocks for a temporal reason", () => {
    const start = new Date(2026, 7, 31, 15, 0, 0, 0);
    const audit = buildTemporalShadowAudit(
      "내일 오후 3시 회의",
      NOW,
      { ok: false, reason: "no_clock" },
      start,
    );

    expect(audit.mismatch).toBe("legacy_block_model_resolved");
  });

  it("records daypart information that a legacy midnight date anchor flattens", () => {
    const audit = buildTemporalShadowAudit(
      "내일 오후에 밥먹기",
      NOW,
      { ok: false, reason: "no_clock" },
      new Date(2026, 7, 31, 0, 0, 0, 0),
    );

    expect(audit.mismatch).toBe("legacy_date_only_model_daypart");
    expect(audit.modelPrecision).toBe("daypart");
    expect(audit.modelDaypart).toBe("afternoon");
    expect(audit.modelResolvedTimed).toBe(false);
  });

  it("does not treat deadline or recurrence semantics as auto-ready", () => {
    const deadline = buildTemporalShadowAudit(
      "내일 오후 5시까지 제출",
      NOW,
      { ok: false, reason: "deadline" },
      new Date(2026, 7, 31, 17, 0, 0, 0),
    );
    const repeat = buildTemporalShadowAudit(
      "월요일마다 오후 3시 운동",
      NOW,
      { ok: false, reason: "repeat" },
      new Date(2026, 7, 31, 15, 0, 0, 0),
    );

    expect(deadline.mismatch).toBe("none");
    expect(deadline.modelHasDeadline).toBe(true);
    expect(repeat.mismatch).toBe("none");
    expect(repeat.modelHasRecurrence).toBe(true);
  });

  it("agrees on supported relative offsets", () => {
    const start = new Date(NOW.getTime() + 10 * 60_000);
    const audit = buildTemporalShadowAudit(
      "10분 뒤에 전화",
      NOW,
      { ok: true, start },
      start,
    );

    expect(audit.mismatch).toBe("none");
    expect(audit.modelPrecision).toBe("relative_offset");
  });

  it("keeps observation non-authoritative and returns an audit in SSR", () => {
    const result = observeTemporalShadow(
      "내일 오후 3시 회의",
      "ko",
      NOW,
      { ok: true, start: new Date(2026, 7, 31, 15, 0, 0, 0) },
      new Date(2026, 7, 31, 15, 0, 0, 0),
    );

    expect(result?.mismatch).toBe("none");
  });
});
