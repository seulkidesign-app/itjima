import { describe, it } from "vitest";
import { understandNaturalLanguage } from "@/lib/nlSchedule";
import { detectDate } from "@/lib/dateDetect";
import { scheduleConfirmationReasons } from "@/lib/nlScheduleSafety";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { cleanScheduleTitle, hasNaturalScheduleTime } from "@/lib/naturalScheduleDraft";

const NOW = new Date(2026, 7, 30, 10, 0, 0); // 2026-08-30 10:00 local

const cases: Array<[string, string]> = [
  ["① date-only", "내일 청소"],
  ["① date-only", "9월 3일 청소"],
  ["② daypart", "내일 오후에 청소"],
  ["② daypart", "내일 오전에 병원"],
  ["② daypart", "오늘 오후 청소"],
  ["③ title", "3시에 청소"],
  ["③ title", "오전 10시에 청소"],
  ["③ title", "다다음 주 월요일 청소"],
  ["③ title", "1시간 반 뒤에 출발"],
  ["③ title", "이번 주말 저녁에 영화"],
  ["③ title", "오전 9시~오후 6시 근무"],
  ["③ title", "내일 엄마 병원 10시에 같이 가기"],
  ["③ title", "2026년 9월 3일 청소"],
  ["④ semantic", "내일 병원 안 가"],
  ["④ semantic", "금요일 회의 취소"],
  ["④ semantic", "내일 운동하지 말기"],
  ["④ semantic", "내일 일정 뭐지?"],
  ["④ semantic", "금요일에 뭐 있었지?"],
  ["④ semantic", "내일 병원 갈까"],
  ["④ semantic", "내일 운동할까"],
  ["⑤ range", "3시부터 5시까지 회의"],
  ["⑤ range", "오전 9시~오후 6시 근무"],
  ["⑤ range", "2시-3시 병원"],
  ["⑤ range", "14:00~15:30 미팅"],
  ["⑤ range", "오후 3시부터 5시까지 회의"],
  ["⑥ multi", "월요일 병원 화요일 미팅"],
  ["⑥ multi", "9월 3일 병원, 9월 5일 미팅"],
  ["⑥ multi", "오늘 청소하고 내일 빨래"],
  ["⑦ deadline", "오후 5시까지 제출"],
  ["⑦ deadline", "금요일까지 포트폴리오 수정"],
  ["⑧ vocab", "내일 밤에 약 먹기"],
  ["⑧ vocab", "정오에 점심"],
  ["⑧ vocab", "자정에 약 먹기"],
  ["⑧ vocab", "새벽 2시에 출발"],
  ["⑧ vocab", "낮 12시에 점심"],
  ["⑧ vocab", "오늘 세시 회의"],
  ["⑧ vocab", "세시반 병원"],
  ["⑧ vocab", "낼 3시 병원"],
  ["⑧ vocab", "금욜 병원"],
  ["⑧ vocab", "담주 월욜 병원"],
  ["⑧ vocab", "월요일마다 오후 3시 운동"],
  ["⑧ vocab", "격주 월요일 오후 3시 회의"],
  ["⑧ vocab", "2주마다 오후 3시 회의"],
  ["⑧ vocab", "3일마다 오후 3시 약 먹기"],
  ["⑨ past", "지난주 월요일 회의"],
  ["⑨ past", "8월 20일 약 먹기"],
  ["asset", "내일 3시 병원"],
  ["asset", "나중에 청소"],
  ["asset", "10분 뒤에 전화"],
];

function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

describe("temporary Claude NL report recheck", () => {
  it("prints current v0.2 parser outputs", () => {
    for (const [group, input] of cases) {
      const nl = understandNaturalLanguage(input, "ko");
      const det = detectDate(input);
      const reasons = scheduleConfirmationReasons(input, NOW);
      const auto = evaluateTimedAutoCommit(input, "ko", NOW);
      console.log(JSON.stringify({
        group,
        input,
        intent: nl.intent,
        confidence: nl.confidence,
        explicitTime: hasNaturalScheduleTime(input),
        detectedStart: iso(det?.start),
        reasons,
        auto: auto.ok ? "COMMIT" : auto.reason,
        autoStart: auto.ok ? iso(auto.draft.start) : null,
        autoEnd: auto.ok ? iso(auto.draft.end) : null,
        title: cleanScheduleTitle(input),
      }));
    }
  });
});
