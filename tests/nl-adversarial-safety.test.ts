import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";

const NOW = new Date(2026, 7, 30, 10, 0, 0, 0);

type AttackCase = {
  category: string;
  input: string;
};

const attacks: AttackCase[] = [];
const add = (category: string, inputs: string[]) => {
  for (const input of inputs) attacks.push({ category, input });
};

const actions = ["회의", "병원", "전화", "청소", "영화 보기"];
const datePrefixes = ["", "오늘 ", "내일 ", "모레 "];

// Invalid / contradictory clock values must never be normalized into a plausible time.
for (const date of datePrefixes) {
  for (const clock of [
    "오후 25시",
    "오후 99시",
    "오전 13시",
    "오전 24시",
    "오후 0시",
    "오전 0시",
    "24시",
    "25시",
    "99시",
  ]) {
    add("invalid_clock_ko", actions.slice(0, 2).map((action) => `${date}${clock} ${action}`));
  }
}

for (const date of ["", "today ", "tomorrow "]) {
  for (const clock of ["25pm", "99am", "13pm", "24am", "00pm", "27:00", "99:30"]) {
    add("invalid_clock_en", [`${date}${clock} meeting`]);
  }
}

// Durations are not wall clocks. In particular, 오후/오전 before N시간 must not
// make N시간 look like N시.
for (const date of ["", "오늘 ", "내일 "]) {
  for (const duration of ["오후 2시간", "오후 3시간", "오전 4시간", "오전 10시간"] ) {
    add("duration_not_clock", [
      `${date}${duration} 영화 보기`,
      `${date}${duration} 공부하기`,
    ]);
  }
}

// Multiple competing date/time anchors must not be collapsed to one arbitrary choice.
add("contradictory_time", [
  "내일 오후 3시 아니 4시 병원",
  "내일 오후 3시 또는 오후 4시 병원",
  "내일 오후 3시나 오후 4시 병원",
  "내일 오전 3시 또는 오후 3시 병원",
  "오늘 오후 3시 아니 내일 오후 3시 회의",
  "오후 2시 아니 3시 아니 4시 회의",
  "Meet tomorrow at 3pm or 4pm",
  "Meeting at 3pm, maybe 4pm",
]);

add("contradictory_date", [
  "오늘 내일 오후 3시 회의",
  "내일 모레 오후 3시 회의",
  "월요일 화요일 오후 3시 회의",
  "이번 금요일 다음 월요일 오후 3시 회의",
  "today tomorrow at 3pm meeting",
  "Monday Tuesday at 3pm meeting",
]);

// Unsupported or self-conflicting ranges should remain raw / require clarification.
add("range_attack", [
  "오후 5시부터 4시까지 운동",
  "오전 11시부터 10시까지 회의",
  "오후 3시부터 오전 2시까지 청소",
  "3시부터 4시까지 아니 5시까지",
  "3시~4시~5시 회의",
  "3시-4시-5시 회의",
  "15:00-14:00 meeting",
  "15:00~14:00 meeting",
]);

// Deadline/repeat/approximate semantics must not become one exact start.
add("deadline_repeat_approx", [
  "내일까지 오후 3시 보고서 제출",
  "오후 3시까지 회의 준비",
  "내일 오후 5시 전까지 병원 예약하기",
  "금요일까지 매일 오후 3시 작업",
  "매일 오후 3시 말고 오늘만 오후 4시",
  "매주 월요일인데 이번 주만 화요일 오후 3시",
  "격주 월요일 오후 3시부터 다음달까지",
  "월요일마다 오후 3시쯤 운동",
  "내일 오후 3시쯤 병원",
  "내일 오후 3시 정도에 병원",
  "tomorrow around 3pm hospital",
  "tomorrow 3pm-ish hospital",
]);

// Semantic quiet: a clock token does not override negation/question/edit/condition.
add("semantic_quiet", [
  "내일 오후 3시에 병원 안 가",
  "내일 오후 3시에 병원 가야 하나?",
  "내일 오후 3시 일정 삭제해",
  "내일 오후 3시였나 기억이 안 나",
  "내일 오후 3시에 병원이라고 저장하지 마",
  "내일 오후 3시 아니고 그냥 메모",
  "비 오면 내일 오후 3시에 운동",
  "도착하면 오후 3시에 전화",
  "Maybe tomorrow at 3pm meeting",
  "Don't schedule tomorrow at 3pm",
]);

// Unicode / malformed paste should fail closed rather than invent a normalized clock.
add("unicode_malformed", [
  "내일 오후 ３시 병원",
  "내일 오후 3：00 병원",
  "내일 오후 3️⃣시 병원",
  "내일 오후 ③시 병원",
  "내일 오후 3시???!!! 병원",
  "내일\t오후\n3시 병원",
  "tomorrow ３pm meeting",
  "tomorrow 3：00 pm meeting",
]);

// Multi-clause attachment: the parser cannot safely assume a clock in one clause
// belongs to a different action in the same sentence.
add("multi_clause_attachment", [
  "오후 3시 드라마 보고 청소하기",
  "내일 오후 3시 엄마 만나고 저녁에 운동",
  "오후 2시 영화 보고 5시에 장보기",
  "내일 오후 3시 회의 끝나고 청소하기",
  "Meet Maya at 3pm and clean the house later",
  "Watch a movie at 3pm and call mom later",
]);

// Long / pasted contradictory input should remain safe.
const longTail = " 메모".repeat(80);
add("long_input", [
  `내일 오후 3시 아니 오후 4시 병원${longTail}`,
  `오늘 내일 오후 3시 회의${longTail}`,
  `오후 25시 회의${longTail}`,
  `내일 오후 2시간 영화 보기${longTail}`,
]);

// Corpus-size floor: this test is intentionally generated as a matrix so new
// invalid-clock/action/date combinations cannot silently disappear.
describe("P0-D adversarial natural-language schedule safety", () => {
  it("keeps every adversarial case out of timed auto-commit", () => {
    const failures = attacks
      .map((c) => ({ ...c, decision: evaluateTimedAutoCommit(c.input, /[가-힣]/.test(c.input) ? "ko" : "en", NOW) }))
      .filter((r) => r.decision.ok);

    console.log(JSON.stringify({
      total: attacks.length,
      unsafeAutoCommits: failures.length,
      failures: failures.map((f) => ({ category: f.category, input: f.input, decision: f.decision })),
    }));

    expect(attacks.length).toBeGreaterThanOrEqual(150);
    expect(failures).toEqual([]);
  });

  it("does not achieve safety by blocking canonical happy paths", () => {
    const happy = [
      ["내일 오후 3시 회의", "ko"],
      ["내일 오후 3시 치과", "ko"],
      ["오늘 오후 6시 전화", "ko"],
      ["10분 뒤에 전화", "ko"],
      ["오후 5시부터 6시까지 운동", "ko"],
      ["tomorrow at 3pm meeting", "en"],
    ] as const;

    for (const [input, lang] of happy) {
      expect(evaluateTimedAutoCommit(input, lang, NOW).ok, input).toBe(true);
    }
  });
});
