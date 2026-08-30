import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { shouldShowInlinePromise } from "@/lib/promiseCard";
import {
  hasExpandedRepeatIntent,
  hasPastDateReference,
  hasPastTimeOnlyClock,
  shouldKeepScheduleSemanticsQuiet,
} from "@/lib/nlSemanticSafety";

const MORNING = new Date(2026, 7, 30, 8, 0, 0);
const EVENING = new Date(2026, 7, 30, 20, 0, 0);

function blocked(text: string, now = MORNING) {
  const decision = evaluateTimedAutoCommit(text, "ko", now);
  expect(decision.ok, text).toBe(false);
}

function quiet(text: string, now = MORNING) {
  blocked(text, now);
  expect(shouldShowInlinePromise(text, "ko"), text).toBe(false);
}

describe("natural-language semantic schedule safety", () => {
  it("never fabricates clocks for date-only, daypart-only, vague, or contextual input", () => {
    for (const text of [
      "내일 청소",
      "내일 오전에 병원",
      "내일 오후에 청소",
      "오늘 저녁 친구 만나기",
      "밥 먹고 청소",
      "퇴근 전에 보고서 제출",
      "나중에 청소",
      "언젠가 여행 가기",
      "조금 있다가 전화하기",
      "이번 주 오후 3시에 청소",
      "다음 달 오후 3시에 치과",
      "다다음 주 오후 3시에 청소",
    ]) blocked(text);
  });

  it("keeps bare 1-12 clocks behind AM/PM ambiguity", () => {
    for (const text of [
      "내일 3시 병원",
      "내일 8시 운동",
      "오늘 7시 약속",
      "12시에 밥",
      "12시 반에 회의",
      "내일 5시부터 6시까지 운동",
    ]) blocked(text);
  });

  it("allows only genuinely resolved exact clocks", () => {
    const cases: Array<[string, number, number]> = [
      ["내일 오후 3시 치과", 15, 0],
      ["모레 오전 10시에 회의", 10, 0],
      ["9월 3일 16시에 치과", 16, 0],
      ["내일 오후 3시 반 치과", 15, 30],
      ["내일 3pm 회의", 15, 0],
      ["내일 오후 5시부터 6시까지 운동", 17, 0],
    ];

    for (const [text, hour, minute] of cases) {
      const decision = evaluateTimedAutoCommit(text, "ko", MORNING);
      expect(decision.ok, text).toBe(true);
      if (!decision.ok) continue;
      expect(decision.draft.start.getHours(), text).toBe(hour);
      expect(decision.draft.start.getMinutes(), text).toBe(minute);
      expect(decision.draft.options.allDay, text).toBe(false);
    }
  });

  it("does not create a past-today schedule from time-only input", () => {
    expect(hasPastTimeOnlyClock("오전 10시에 청소", EVENING)).toBe(true);
    for (const text of [
      "오전 10시에 청소",
      "오후 3시에 청소",
      "18시에 운동",
      "3pm meeting",
    ]) blocked(text, EVENING);
  });

  it("does not reinterpret explicit past references as today or next year", () => {
    expect(hasPastDateReference("어제 오후 3시 병원", MORNING)).toBe(true);
    expect(hasPastDateReference("2025년 9월 3일 오후 4시 치과", MORNING)).toBe(true);
    for (const text of [
      "어제 오후 3시 병원",
      "지난주 월요일 오후 3시 회의",
      "8월 20일 오후 3시 약 먹기",
      "2025년 9월 3일 오후 4시 치과",
    ]) blocked(text);
  });

  it("blocks unsupported time ranges instead of silently keeping only the first clock", () => {
    for (const text of [
      "14:00~15:30 미팅",
      "2시-3시 병원",
      "3시부터 4시까지 회의",
    ]) blocked(text);
  });

  it("never inverts Korean PM plus colon notation into 03:00", () => {
    blocked("오후 03:00 병원");
  });

  it("recognizes recurrence dialects and never collapses them into one-off schedules", () => {
    const cases = [
      "매일 오전 8시에 약 먹기",
      "매주 금요일 오후 3시 회의",
      "월요일마다 오후 3시 운동",
      "3일마다 오후 3시 약 먹기",
      "격주 월요일 오후 3시 회의",
      "2주마다 오후 3시 회의",
    ];
    for (const text of cases) {
      expect(hasExpandedRepeatIntent(text), text).toBe(true);
      blocked(text);
      expect(shouldShowInlinePromise(text, "ko"), text).toBe(false);
    }
  });

  it("keeps edit/cancel utterances quiet instead of creating a new schedule", () => {
    for (const text of [
      "아니 내일 말고 모레",
      "3시 말고 4시",
      "오후야",
      "오전 10시로",
      "다음 주 월요일로 바꿔줘",
      "그거 취소",
      "아까 일정 삭제",
      "병원 일정 오후 4시로 변경",
    ]) quiet(text);
  });

  it("keeps negation and cancellation quiet", () => {
    for (const text of [
      "내일 병원 안 가",
      "오늘 청소 안 해",
      "금요일 회의 취소",
      "내일 운동하지 말기",
      "3시 약속 없어짐",
      "내일 오후 3시 병원 안 가",
    ]) {
      expect(shouldKeepScheduleSemanticsQuiet(text), text).toBe(true);
      quiet(text);
    }
  });

  it("treats schedule questions as retrieval language, not capture language", () => {
    for (const text of [
      "내일 일정 뭐지?",
      "내일 병원 몇 시였지?",
      "금요일에 뭐 있었지?",
      "3시에 뭐 하지?",
      "다음 주 일정 보여줘",
      "내일 오후 3시에 뭐 하지?",
    ]) quiet(text);
  });

  it("keeps tentative and possible plans quiet", () => {
    for (const text of [
      "내일 병원 갈까",
      "내일 운동할까",
      "주말에 여행 갈지도",
      "다음 주에 병원 갈 것 같아",
      "오후에 운동할 수도 있음",
      "금요일쯤 미팅 잡을 듯",
      "내일 오후 3시 운동할 수도 있음",
    ]) quiet(text);
  });

  it("keeps unsupported condition triggers quiet", () => {
    for (const text of [
      "회사 도착하면 전화",
      "엄마 만나면 이것 물어보기",
      "비 오면 우산 챙기기",
      "날씨 좋으면 산책하기",
      "미세먼지 괜찮으면 러닝하기",
    ]) quiet(text);
  });

  it("keeps vague-future plus exact-looking clocks from pinning to today", () => {
    for (const text of [
      "나중에 오후 3시 청소",
      "언젠가 오후 3시 여행 계획",
      "시간 되면 오후 3시 전화",
    ]) quiet(text);
  });

  it("preserves semantic title text for valid exact captures", () => {
    const decision = evaluateTimedAutoCommit(
      "아 맞다 내일 오후 3시에 강남 치과 가서 스케일링 받아야 함",
      "ko",
      MORNING,
    );
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    expect(decision.draft.text).toContain("강남 치과");
    expect(decision.draft.text).toContain("스케일링");
    expect(decision.draft.start.getHours()).toBe(15);
  });
});
