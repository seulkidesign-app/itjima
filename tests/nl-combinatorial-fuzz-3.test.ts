import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { buildTemporalCompletionDraft } from "@/lib/nlTemporalCompletion";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);
const ACTIONS = ["회의", "운동", "병원 가기", "서류 제출", "엄마한테 전화"] as const;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function outcome(input: string, now = NOW) {
  const timed = evaluateTimedAutoCommit(input, "ko", now);
  if (timed.ok) return { kind: "timed" as const, draft: timed.draft };
  const completion = buildTemporalCompletionDraft(input, "ko", now);
  if (completion) return { kind: "completion" as const, draft: completion, reason: timed.reason };
  return { kind: "safe" as const, reason: timed.reason };
}

function assertNoCreate(input: string, now = NOW) {
  const result = outcome(input, now);
  if (result.kind !== "safe") {
    throw new Error(`unsafe create: ${input} => ${result.kind} ${result.draft.start.toISOString()}`);
  }
}

describe("combinatorial natural-language fuzz audit v3", () => {
  it("resolves future time-only inputs to today and blocks past ones", () => {
    const future = [
      ["오전 11시", 11, 0],
      ["오후 3시", 15, 0],
      ["13시", 13, 0],
      ["20시 30분", 20, 30],
      ["15:30", 15, 30],
    ] as const;
    const past = ["오전 8시", "오전 9시 59분", "08:00", "09:59"];

    for (const [clock, hour, minute] of future) {
      for (const action of ACTIONS) {
        const input = `${clock} ${action}`;
        const result = outcome(input);
        expect(result.kind, input).toBe("timed");
        if (result.kind !== "timed") continue;
        expect(ymd(result.draft.start), input).toBe("2026-09-01");
        expect(result.draft.start.getHours(), input).toBe(hour);
        expect(result.draft.start.getMinutes(), input).toBe(minute);
      }
    }
    for (const clock of past) {
      for (const action of ACTIONS) assertNoCreate(`${clock} ${action}`);
    }
  });

  it("keeps bare time-only 1-12 clocks ambiguous even when a future interpretation exists", () => {
    for (const hour of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      for (const action of ACTIONS) assertNoCreate(`${hour}시 ${action}`);
    }
  });

  it("resolves richer relative-day anchors without calendar drift", () => {
    const cases = [
      ["글피 오후 3시 회의", "2026-09-04", 15],
      ["이번 금요일 오후 3시 회의", "2026-09-04", 15],
      ["다음 주 월요일 오후 3시 회의", "2026-09-07", 15],
      ["다음 주 일요일 오전 8시 운동", "2026-09-13", 8],
    ] as const;
    for (const [input, date, hour] of cases) {
      const result = outcome(input);
      expect(result.kind, input).toBe("timed");
      if (result.kind !== "timed") continue;
      expect(ymd(result.draft.start), input).toBe(date);
      expect(result.draft.start.getHours(), input).toBe(hour);
    }
  });

  it("never rolls impossible calendar dates into a different valid day", () => {
    const impossible = [
      "2월 30일 오후 3시 회의",
      "2월 31일 오후 3시 회의",
      "4월 31일 오후 3시 회의",
      "9월 31일 오후 3시 회의",
      "11월 31일 오후 3시 회의",
      "13월 1일 오후 3시 회의",
      "0월 10일 오후 3시 회의",
      "2026년 2월 29일 오후 3시 회의",
      "2026년 13월 1일 오후 3시 회의",
      "2026년 9월 31일 오후 3시 회의",
    ];
    for (const input of impossible) assertNoCreate(input);
  });

  it("preserves explicit reminder semantics on deterministic exact schedules", () => {
    const cases = [
      ["내일 오후 3시 회의 알려줘", 0],
      ["내일 오후 3시 회의 5분 전에 알려줘", 5],
      ["내일 오후 3시 회의 10분 전에 알려줘", 10],
      ["내일 오후 3시 회의 30분 전에 알려줘", 30],
      ["내일 오후 3시 회의 1시간 전에 알려줘", 60],
      ["내일 오후 3시 회의 전날 알려줘", 1440],
      ["내일 오후 3시 회의 알림 끄기", null],
      ["내일 오후 3시 회의 알려주지 마", null],
    ] as const;

    for (const [input, reminder] of cases) {
      const result = outcome(input);
      expect(result.kind, input).toBe("timed");
      if (result.kind !== "timed") continue;
      expect(ymd(result.draft.start), input).toBe("2026-09-02");
      expect(result.draft.start.getHours(), input).toBe(15);
      expect(result.draft.options.reminderMinutes, input).toBe(reminder);
      expect(result.draft.reminderExplicit, input).toBe(true);
    }
  });

  it("does not let reminder numbers become extra schedule clocks", () => {
    const reminders = ["5분 전", "10분 전", "30분 전", "1시간 전", "하루 전", "전날"];
    for (const reminder of reminders) {
      for (const action of ACTIONS) {
        const input = `내일 오후 3시 ${action} ${reminder}에 알려줘`;
        const result = outcome(input);
        expect(result.kind, input).toBe("timed");
        if (result.kind !== "timed") continue;
        expect(result.draft.start.getHours(), input).toBe(15);
      }
    }
  });

  it("keeps conflicting or stacked meridiem text fail-closed", () => {
    const inputs = [
      "내일 오전 오후 3시 회의",
      "내일 오후 오전 3시 회의",
      "내일 오전 3시 오후 3시 회의",
      "내일 오후 3시 오전 4시 회의",
      "내일 15:30 오후 3시 회의",
      "내일 오전 8시 20시 회의",
    ];
    for (const input of inputs) assertNoCreate(input);
  });

  it("audits Korean-English mixed exact forms without accepting a wrong timestamp", () => {
    const cases = [
      ["내일 3pm meeting", "2026-09-02", 15],
      ["내일 at 3 pm meeting", "2026-09-02", 15],
      ["tomorrow 오후 3시 회의", "2026-09-02", 15],
      ["Friday 오후 3시 meeting", "2026-09-04", 15],
      ["금요일 at 3 pm 회의", "2026-09-04", 15],
    ] as const;
    const misses: string[] = [];
    for (const [input, date, hour] of cases) {
      const result = outcome(input);
      if (result.kind === "safe") {
        misses.push(`${input} => ${result.reason}`);
        continue;
      }
      if (result.kind === "completion") {
        throw new Error(`mixed exact collapsed to completion: ${input}`);
      }
      expect(ymd(result.draft.start), input).toBe(date);
      expect(result.draft.start.getHours(), input).toBe(hour);
    }
    console.log(JSON.stringify({ audit: "mixed-ko-en", total: cases.length, misses }));
  });

  it("keeps named but unsupported exact-ish instants safe", () => {
    const inputs = [
      "내일 정오 회의",
      "내일 자정 출발",
      "내일 새벽 운동",
      "내일 점심때 약 먹기",
      "내일 저녁 8시 운동",
      "내일 아침 8시 운동",
    ];
    for (const input of inputs) {
      const result = outcome(input);
      if (result.kind === "timed") {
        throw new Error(`named/fuzzy instant silently became exact: ${input} => ${result.draft.start.toISOString()}`);
      }
    }
  });

  it("stays calendar-correct across month and year boundaries", () => {
    const anchors = [
      [new Date(2026, 0, 31, 10, 0), "2026-02-01"],
      [new Date(2026, 1, 28, 10, 0), "2026-03-01"],
      [new Date(2026, 11, 31, 10, 0), "2027-01-01"],
    ] as const;
    for (const [now, expectedDate] of anchors) {
      const result = outcome("내일 오후 3시 회의", now);
      expect(result.kind).toBe("timed");
      if (result.kind !== "timed") continue;
      expect(ymd(result.draft.start)).toBe(expectedDate);
      expect(result.draft.start.getHours()).toBe(15);
    }
  });
});
