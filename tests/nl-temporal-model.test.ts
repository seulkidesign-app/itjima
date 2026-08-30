import { describe, expect, it } from "vitest";
import { parseNlTemporalModel } from "@/lib/nlTemporalModel";

// Fixed local audit clock keeps past/future expectations deterministic.
const NOW = new Date(2026, 7, 30, 10, 0, 0);

const parse = (text: string) => parseNlTemporalModel(text, NOW);

describe("P0-C natural-language temporal model", () => {
  it("keeps empty text neutral", () => {
    const m = parse("");
    expect(m.precision).toBe("none");
    expect(m.date).toBeNull();
    expect(m.exactClock).toBeNull();
    expect(m.range).toBeNull();
    expect(m.deadline).toBeNull();
    expect(m.recurrence).toBeNull();
  });

  it("models a daypart without inventing a clock", () => {
    const m = parse("내일 오후에 청소");
    expect(m.date?.kind).toBe("tomorrow");
    expect(m.daypart).toBe("afternoon");
    expect(m.exactClock).toBeNull();
    expect(m.bareClock).toBeNull();
    expect(m.precision).toBe("daypart");
  });

  it("keeps evening as a daypart rather than 18:00", () => {
    const m = parse("오늘 저녁 친구 만나기");
    expect(m.date?.kind).toBe("today");
    expect(m.daypart).toBe("evening");
    expect(m.exactClock).toBeNull();
  });

  it("parses an exact Korean clock separately from its date", () => {
    const m = parse("내일 오후 3시 치과");
    expect(m.date?.kind).toBe("tomorrow");
    expect(m.daypart).toBe("afternoon");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.precision).toBe("exact_clock");
  });

  it("recognizes a full YMD before partial month/day", () => {
    const m = parse("2026년 9월 3일 오후 4시 치과");
    expect(m.date?.kind).toBe("full_date");
    expect(m.date?.raw).toBe("2026년 9월 3일");
    expect(m.exactClock).toMatchObject({ hour24: 16, minute: 0 });
  });

  it("parses English AM/PM clocks", () => {
    const m = parse("Dentist tomorrow 3pm");
    expect(m.date?.kind).toBe("tomorrow");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
  });

  it("represents a bare clock as meridiem ambiguity", () => {
    const m = parse("내일 3시 병원");
    expect(m.date?.kind).toBe("tomorrow");
    expect(m.exactClock).toBeNull();
    expect(m.bareClock).toMatchObject({ hour: 3, minute: 0 });
    expect(m.ambiguities).toContain("missing_meridiem");
    expect(m.precision).toBe("ambiguous");
  });

  it("models a resolved canonical range as one temporal structure", () => {
    const m = parse("오후 5시부터 6시까지 운동");
    expect(m.range?.supportedSyntax).toBe(true);
    expect(m.range?.resolved).toBe(true);
    expect(m.range?.start).toMatchObject({ kind: "exact", hour24: 17, minute: 0 });
    expect(m.range?.end).toMatchObject({ kind: "exact", hour24: 18, minute: 0 });
    expect(m.range?.inheritedEndMeridiem).toBe(true);
    expect(m.precision).toBe("range");
  });

  it("models a canonical bare range as missing-meridiem ambiguity, not unsupported syntax", () => {
    const m = parse("5시부터 6시까지 운동");
    expect(m.range?.supportedSyntax).toBe(true);
    expect(m.range?.resolved).toBe(false);
    expect(m.ambiguities).toContain("missing_meridiem");
    expect(m.ambiguities).not.toContain("unsupported_range");
    expect(m.precision).toBe("ambiguous");
  });

  it("keeps unsupported tilde ranges explicit", () => {
    const m = parse("14:00~15:30 미팅");
    expect(m.range?.supportedSyntax).toBe(false);
    expect(m.range?.resolved).toBe(false);
    expect(m.ambiguities).toContain("unsupported_range");
    expect(m.precision).toBe("ambiguous");
  });

  it("models deadline separately while preserving the clock mention", () => {
    const m = parse("오후 5시까지 제출");
    expect(m.deadline).not.toBeNull();
    expect(m.exactClock).toMatchObject({ hour24: 17, minute: 0 });
    expect(m.precision).toBe("deadline");
  });

  it("models date-only deadlines without inventing a clock", () => {
    const m = parse("오늘까지 보고서 제출");
    expect(m.date?.kind).toBe("today");
    expect(m.deadline).not.toBeNull();
    expect(m.exactClock).toBeNull();
    expect(m.precision).toBe("deadline");
  });

  it("preserves date and clock inside a recurrence", () => {
    const m = parse("월요일마다 오후 3시 운동");
    expect(m.date?.kind).toBe("weekday");
    expect(m.recurrence?.kind).toBe("weekday");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.precision).toBe("recurrence");
  });

  it("recognizes interval recurrence without collapsing it to one event", () => {
    const m = parse("격주 월요일 오후 3시 회의");
    expect(m.recurrence?.kind).toBe("interval");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.precision).toBe("recurrence");
  });

  it("marks broad-date plus exact clock as unresolved day ambiguity", () => {
    const m = parse("다음 주 오후 3시에 청소");
    expect(m.date?.kind).toBe("next_week");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.ambiguities).toContain("broad_date");
    expect(m.precision).toBe("ambiguous");
  });

  it("keeps weekend under weekend-day ambiguity", () => {
    const m = parse("이번 주말 오후 3시에 영화");
    expect(m.date?.kind).toBe("weekend");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.ambiguities).toContain("weekend_day");
  });

  it("does not upgrade approximate clocks to exact clocks", () => {
    const m = parse("오후 3시쯤 병원");
    expect(m.exactClock).toBeNull();
    expect(m.ambiguities).toContain("approximate_time");
    expect(m.precision).toBe("ambiguous");
  });

  it("keeps mixed Korean meridiem + colon syntax unresolved", () => {
    const m = parse("오후 03:00 병원");
    expect(m.exactClock).toBeNull();
    expect(m.ambiguities).toContain("mixed_meridiem_colon");
  });

  it("models supported relative offsets without converting them to wall-clock text", () => {
    const m = parse("10분 뒤에 전화");
    expect(m.relativeOffset).toMatchObject({ amount: 10, unit: "minute" });
    expect(m.exactClock).toBeNull();
    expect(m.precision).toBe("relative_offset");
  });

  it("models English relative offsets", () => {
    const m = parse("Call mom in 2 hours");
    expect(m.relativeOffset).toMatchObject({ amount: 2, unit: "hour" });
    expect(m.precision).toBe("relative_offset");
  });

  it("keeps unsupported one-and-a-half-hour relative language explicit", () => {
    const m = parse("1시간 반 뒤에 출발");
    expect(m.relativeOffset).toBeNull();
    expect(m.ambiguities).toContain("unsupported_relative");
    expect(m.precision).toBe("ambiguous");
  });

  it("keeps named noon as semantic precision instead of silently mapping to 12:00", () => {
    const m = parse("내일 정오에 점심");
    expect(m.date?.kind).toBe("tomorrow");
    expect(m.daypart).toBe("noon");
    expect(m.exactClock).toBeNull();
    expect(m.precision).toBe("daypart");
  });

  it("preserves past-date semantics rather than moving them forward", () => {
    const m = parse("어제 오후 3시 병원");
    expect(m.date?.kind).toBe("yesterday");
    expect(m.exactClock).toMatchObject({ hour24: 15, minute: 0 });
    expect(m.ambiguities).toContain("past_reference");
    expect(m.precision).toBe("ambiguous");
  });

  it("marks an already-past time-only exact clock as past without changing the clock", () => {
    const m = parse("오전 9시 병원");
    expect(m.exactClock).toMatchObject({ hour24: 9, minute: 0 });
    expect(m.ambiguities).toContain("past_reference");
  });
});
