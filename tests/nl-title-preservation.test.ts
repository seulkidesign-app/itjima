import { describe, expect, it } from "vitest";
import { cleanScheduleTitle } from "@/lib/naturalScheduleDraft";

const expectTitle = (input: string, expected: string) => {
  expect(cleanScheduleTitle(input), input).toBe(expected);
};

describe("NL title preservation P0-B", () => {
  describe("SUPPORTED CLEAN — metadata/clarification-owned temporal spans are removed atomically", () => {
    const cases: Array<[string, string]> = [
      ["오전 10시에 청소", "청소"],
      ["오후 3시에 청소", "청소"],
      ["내일 오후 3시 치과", "치과"],
      ["내일 오후 3시에 치과", "치과"],
      ["모레 오전 10시에 회의", "회의"],
      ["이번 금요일 오후 2시에 미팅", "미팅"],
      ["다음 주 월요일 오전 9시에 출근", "출근"],
      ["9월 3일 오후 4시에 치과", "치과"],
      ["2026년 9월 3일 오후 4시 치과", "치과"],
      ["내일 오후 3시 반 치과", "치과"],
      ["10분 뒤에 전화", "전화"],
      ["10분 뒤에 세탁기 끄기", "세탁기 끄기"],
      ["한 시간 뒤에 약 먹기", "약 먹기"],
      ["두 시간 후에 운동하기", "운동하기"],
      ["90분 뒤에 전화", "전화"],
      ["오후 3시부터 5시까지 회의", "회의"],
      ["오후 5시부터 6시까지 운동", "운동"],
      ["내일 오후 5시부터 6시까지 운동", "운동"],
      ["오후 3시부터 오후 5시까지 회의", "회의"],
      ["월요일 오전 10시부터 11시까지 회의", "회의"],
      ["9월 3일 14시부터 16시까지 교육", "교육"],
      // Bare AM/PM is a supported clarification path, not an unsupported syntax.
      ["내일 3시 병원", "병원"],
      ["5시부터 6시까지 운동", "운동"],
      ["내일 5시부터 6시까지 운동", "운동"],
      ["Dentist tomorrow at 3pm", "Dentist"],
      ["Meet at the clinic tomorrow 3pm", "Meet at the clinic"],
      ["Call mom in 2 hours", "Call mom"],
    ];

    for (const [input, expected] of cases) {
      it(input, () => expectTitle(input, expected));
    }
  });

  describe("RAW PRESERVE — unsupported/unsafe temporal language is never partially deleted", () => {
    const cases = [
      "다다음 주 월요일 청소",
      "2026년 9월 3일 청소",
      "1시간 반 뒤에 출발",
      "이번 주말 저녁에 영화",
      "오전 9시~오후 6시 근무",
      "다음주쯤 보기",
      "Watch it next week or so",
      "Meet Maya this weekend",
      "오후 3시쯤 병원",
      "오후 3시경 회의",
      "3시쯤 병원",
      "3시경 회의",
      "세 시 정도에 출발",
      "오후 5시까지 제출",
      "내일 오후 5시까지 제출",
      "오늘까지 보고서 제출",
      "금요일까지 포트폴리오 수정",
      "월요일마다 오후 3시 운동",
      "격주 월요일 오후 3시 회의",
      "2주마다 오후 3시 회의",
      "3일마다 오후 3시 약 먹기",
      "14:00~15:30 미팅",
      "2시-3시 병원",
      "내일 오후에 청소",
      "어제 오후 3시 병원",
      "오후 03:00 병원",
    ];

    for (const input of cases) {
      it(input, () => expectTitle(input, input));
    }
  });

  describe("SEMANTIC QUIET — non-capture meaning stays verbatim", () => {
    const cases = [
      "내일 오후 3시 병원 안 가",
      "내일 오후 3시에 뭐 하지?",
      "내일 오후 3시 운동할 수도 있음",
      "나중에 오후 3시 청소",
      "내일 오후 3시 병원 취소",
      "내일 오후 3시 대신 5시 어때?",
    ];

    for (const input of cases) {
      it(input, () => expectTitle(input, input));
    }
  });

  it("removes a supported clock together with its attached Korean scheduling particle", () => {
    expectTitle("내일 엄마 병원 10시에 같이 가기", "엄마 병원 같이 가기");
  });

  it("never mistakes 시 inside 시간 for an exact clock token", () => {
    expectTitle("1시간 반 뒤에 출발", "1시간 반 뒤에 출발");
  });
});
