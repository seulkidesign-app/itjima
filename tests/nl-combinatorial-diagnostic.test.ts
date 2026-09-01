import { describe, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { buildTemporalCompletionDraft } from "@/lib/nlTemporalCompletion";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

function creates(input: string): string | null {
  const timed = evaluateTimedAutoCommit(input, "ko", NOW);
  const completion = buildTemporalCompletionDraft(input, "ko", NOW);
  if (timed.ok) {
    return `timed:${timed.draft.start.getFullYear()}-${String(timed.draft.start.getMonth() + 1).padStart(2, "0")}-${String(timed.draft.start.getDate()).padStart(2, "0")} ${String(timed.draft.start.getHours()).padStart(2, "0")}:${String(timed.draft.start.getMinutes()).padStart(2, "0")}`;
  }
  if (completion) return `completion:${completion.start.toISOString()}`;
  return null;
}

describe("expanded combinatorial diagnostics", () => {
  it("prints every non-create phrase that still creates", () => {
    const bases = [
      "내일 오전 8시 회의",
      "내일 오후 3시 운동",
      "금요일 13시 병원 가기",
      "9월 5일 20시 엄마한테 전화",
    ];
    const suffixes = [
      "일정에 넣지 마",
      "일정에 넣지마",
      "일정으로 넣지 마",
      "일정으로 넣지마",
      "저장하지 마",
      "저장하지마",
      "등록하지 마",
      "등록하지마",
      "추가하지 마",
      "추가하지마",
      "일정 잡지 마",
      "일정 잡지마",
      "취소",
      "취소해",
      "취소해줘",
      "취소했어",
      "취소할래",
      "없던 걸로 해",
      "삭제해",
      "삭제해줘",
      "뭐였더라",
      "몇 시였더라",
      "맞지",
      "맞나",
      "기억나",
      "언제였지",
      "언제더라",
    ];
    const prefixes = ["취소해 ", "삭제해 ", "저장하지 마: ", "일정에 넣지 마: "];

    const violations: Array<{ input: string; result: string }> = [];
    for (const base of bases) {
      for (const suffix of suffixes) {
        const input = `${base} ${suffix}`;
        const result = creates(input);
        if (result) violations.push({ input, result });
      }
      for (const prefix of prefixes) {
        const input = `${prefix}${base}`;
        const result = creates(input);
        if (result) violations.push({ input, result });
      }
    }
    console.log(JSON.stringify({ audit: "expanded-non-create", total: bases.length * (suffixes.length + prefixes.length), violations }));
  });

  it("prints every past-weekday phrase that resolves to the future", () => {
    const pastMarkers = ["지난", "저번", "지난번"];
    const weekdays = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
    const spacedWeeks = ["지난주", "지난 주", "저번주", "저번 주"];
    const violations: Array<{ input: string; result: string }> = [];

    for (const marker of pastMarkers) {
      for (const weekday of weekdays) {
        const input = `${marker} ${weekday} 오후 3시 회의`;
        const result = creates(input);
        if (result) violations.push({ input, result });
      }
    }
    for (const marker of spacedWeeks) {
      for (const weekday of weekdays) {
        const input = `${marker} ${weekday} 오후 3시 회의`;
        const result = creates(input);
        if (result) violations.push({ input, result });
      }
    }
    console.log(JSON.stringify({ audit: "expanded-past-weekday", total: pastMarkers.length * weekdays.length + spacedWeeks.length * weekdays.length, violations }));
  });
});
