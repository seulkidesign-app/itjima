import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { detectDate } from "@/lib/dateDetect";

describe("detectDate Korean schedule parsing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T13:20:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not invent PM for bare 3시 — date only, no clock", () => {
    const det = detectDate("내일 3시에 치과");
    expect(det).not.toBeNull();
    expect(det!.start.getDate()).toBe(1); // Aug 1 (tomorrow)
    // Bare hour stays unresolved; daytime anchor only, not 15:00.
    expect(det!.start.getHours()).toBe(9);
    expect(det!.label).toBe("내일");
  });

  it("keeps 오전 3시 as 03:00", () => {
    const det = detectDate("내일 오전 3시 비행기");
    expect(det!.start.getHours()).toBe(3);
  });

  it("keeps 오후 3시 as 15:00", () => {
    const det = detectDate("내일 오후 3시 치과");
    expect(det!.start.getHours()).toBe(15);
  });

  it("does not invent a clock for bare 10시", () => {
    const det = detectDate("내일 10시 회의");
    expect(det!.start.getHours()).toBe(9);
    expect(det!.label).toBe("내일");
  });

  it("accepts 24h-style 15시", () => {
    const det = detectDate("내일 15시 미팅");
    expect(det!.start.getHours()).toBe(15);
  });

  it("does not invent Saturday for 주말", () => {
    expect(detectDate("주말에 만나기")).toBeNull();
  });

  it("preserves explicit 오늘 even when the clock is already past", () => {
    const det = detectDate("오늘 오전 9시 회의");
    expect(det!.start.getDate()).toBe(31); // Jul 31 — no silent bump to tomorrow
    expect(det!.start.getHours()).toBe(9);
  });

  it("does not invent 18:00 for 퇴근 후", () => {
    const det = detectDate("오늘 퇴근 후 장보기");
    expect(det).not.toBeNull();
    expect(det!.start.getHours()).toBe(9);
    expect(det!.label).toBe("오늘");
  });

  // V02-07 beta regressions — bare half-hour stays unresolved
  it("keeps tomorrow for 내일 3시 반 without inventing 15:30", () => {
    const det = detectDate("내일 3시 반 치과");
    expect(det).not.toBeNull();
    expect(det!.start.getDate()).toBe(1); // Aug 1 (tomorrow from Jul 31)
    expect(det!.start.getHours()).toBe(9);
    expect(det!.label).toBe("내일");
  });

  it("does not invent a clock for bare 3시 반 alone", () => {
    expect(detectDate("3시 반")).toBeNull();
  });

  it("does not invent a clock for bare 3시 30분 alone", () => {
    expect(detectDate("3시 30분")).toBeNull();
  });

  it("keeps 오전 3시 as 03:00 without a date phrase", () => {
    const det = detectDate("오전 3시");
    expect(det!.start.getHours()).toBe(3);
    expect(det!.start.getMinutes()).toBe(0);
  });

  it("keeps 오후 3시 as 15:00 without a date phrase", () => {
    const det = detectDate("오후 3시");
    expect(det!.start.getHours()).toBe(15);
    expect(det!.start.getMinutes()).toBe(0);
  });
});
