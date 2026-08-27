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

  it("maps bare 3시 to 15:00, not 03:00", () => {
    const det = detectDate("내일 3시에 치과");
    expect(det).not.toBeNull();
    expect(det!.start.getHours()).toBe(15);
    expect(det!.label).toMatch(/오후\s*3시/);
  });

  it("keeps 오전 3시 as 03:00", () => {
    const det = detectDate("내일 오전 3시 비행기");
    expect(det!.start.getHours()).toBe(3);
  });

  it("keeps 오후 3시 as 15:00", () => {
    const det = detectDate("내일 오후 3시 치과");
    expect(det!.start.getHours()).toBe(15);
  });

  it("keeps bare 10시 as morning", () => {
    const det = detectDate("내일 10시 회의");
    expect(det!.start.getHours()).toBe(10);
  });

  it("accepts 24h-style 15시", () => {
    const det = detectDate("내일 15시 미팅");
    expect(det!.start.getHours()).toBe(15);
  });

  it("resolves 주말 to Saturday", () => {
    // 2026-07-31 is Friday → next Sat is Aug 1
    const det = detectDate("주말에 만나기");
    expect(det).not.toBeNull();
    expect(det!.start.getDay()).toBe(6);
  });

  it("bumps past timed today to tomorrow", () => {
    const det = detectDate("오늘 오전 9시 회의");
    expect(det!.start.getDate()).toBe(1); // Aug 1 after bump from Jul 31 9am past
    expect(det!.start.getHours()).toBe(9);
  });

  it("maps 퇴근 후 to evening", () => {
    const det = detectDate("오늘 퇴근 후 장보기");
    expect(det!.start.getHours()).toBe(18);
  });

  // V02-07 beta regressions
  it("maps 내일 3시 반 to 15:30 and keeps tomorrow", () => {
    const det = detectDate("내일 3시 반 치과");
    expect(det).not.toBeNull();
    expect(det!.start.getDate()).toBe(1); // Aug 1 (tomorrow from Jul 31)
    expect(det!.start.getHours()).toBe(15);
    expect(det!.start.getMinutes()).toBe(30);
    expect(det!.label).toMatch(/오후\s*3시\s*반|오후\s*3시\s*30분/);
  });

  it("maps bare 3시 반 to 15:30", () => {
    const det = detectDate("3시 반");
    expect(det!.start.getHours()).toBe(15);
    expect(det!.start.getMinutes()).toBe(30);
  });

  it("maps 3시 30분 to 15:30", () => {
    const det = detectDate("3시 30분");
    expect(det!.start.getHours()).toBe(15);
    expect(det!.start.getMinutes()).toBe(30);
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
