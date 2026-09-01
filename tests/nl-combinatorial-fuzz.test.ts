import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import {
  buildTemporalCompletionDraft,
  hasUnsupportedClockLikeResidue,
} from "@/lib/nlTemporalCompletion";
import { understandNaturalLanguage } from "@/lib/nlSchedule";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

const DATES = ["내일", "모레", "금요일", "9월 5일"] as const;
const ACTIONS = ["회의", "운동", "병원 가기", "서류 제출", "엄마한테 전화"] as const;
const DAYPARTS = ["아침", "오전", "오후", "저녁", "밤"] as const;

const EXACT_TIMES = [
  { text: "오전 8시", hour: 8, minute: 0 },
  { text: "오전 8시 30분", hour: 8, minute: 30 },
  { text: "오후 3시", hour: 15, minute: 0 },
  { text: "오후 3시 반", hour: 15, minute: 30 },
  { text: "13시", hour: 13, minute: 0 },
  { text: "13시 20분", hour: 13, minute: 20 },
  { text: "20시", hour: 20, minute: 0 },
] as const;

function forms(date: string, time: string, action: string): string[] {
  return [
    `${date} ${time} ${action}`,
    `${date} ${time}에 ${action}`,
    `  ${date}  ${time}  ${action}  `,
    `${date}, ${time} ${action}`,
    `${date} ${time} ${action}!`,
    `${date} ${action} ${time}`,
  ];
}

function dateOnlyForms(date: string, action: string): string[] {
  return [
    `${date} ${action}`,
    `${date}에 ${action}`,
    `  ${date}  ${action}  `,
    `${date}, ${action}`,
    `${date} ${action}!`,
  ];
}

function daypartForms(date: string, daypart: string, action: string): string[] {
  return [
    `${date} ${daypart} ${action}`,
    `${date} ${daypart}에 ${action}`,
    `  ${date}  ${daypart}  ${action}  `,
    `${date}, ${daypart} ${action}`,
    `${date} ${daypart} ${action}!`,
  ];
}

function dateKey(input: string): string | null {
  if (input.includes("내일")) return "tomorrow";
  if (input.includes("모레")) return "day_after_tomorrow";
  if (input.includes("금요일")) return "friday";
  if (input.includes("9월 5일")) return "sep5";
  return null;
}

function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function expectedDateFor(input: string): string {
  switch (dateKey(input)) {
    case "tomorrow":
      return "2026-09-02";
    case "day_after_tomorrow":
      return "2026-09-03";
    case "friday":
      return "2026-09-04";
    case "sep5":
      return "2026-09-05";
    default:
      throw new Error(`missing expected date for ${input}`);
  }
}

function exactTimestampFingerprint(d: Date): string {
  return `${localYmd(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function assertNeverCreates(input: string) {
  const timed = evaluateTimedAutoCommit(input, "ko", NOW);
  const completion = buildTemporalCompletionDraft(input, "ko", NOW);
  if (timed.ok || completion) {
    throw new Error(
      `unsafe create: ${JSON.stringify({
        input,
        timed: timed.ok ? exactTimestampFingerprint(timed.draft.start) : timed.reason,
        completion: completion
          ? `${exactTimestampFingerprint(completion.start)} allDay=${completion.options.allDay}`
          : null,
      })}`,
    );
  }
}

describe("combinatorial natural-language fuzz audit", () => {
  it("never auto-commits an explicit exact form to the wrong timestamp", () => {
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];

    for (const date of DATES) {
      for (const time of EXACT_TIMES) {
        for (const action of ACTIONS) {
          for (const input of forms(date, time.text, action)) {
            total += 1;
            const decision = evaluateTimedAutoCommit(input, "ko", NOW);
            if (!decision.ok) {
              unsupported.push(`${input.trim()} => ${decision.reason}`);
              continue;
            }
            supported += 1;
            expect(localYmd(decision.draft.start), input).toBe(expectedDateFor(input));
            expect(decision.draft.start.getHours(), input).toBe(time.hour);
            expect(decision.draft.start.getMinutes(), input).toBe(time.minute);
          }
        }
      }
    }

    console.log(
      JSON.stringify({
        audit: "exact-benign-variation",
        total,
        supported,
        unsupported: total - supported,
        supportRate: supported / total,
        unsupportedSample: unsupported.slice(0, 30),
      }),
    );
  });

  it("rejects invalid hour/minute combinations across dates and actions", () => {
    const invalidClocks = [
      "24시",
      "25시",
      "99시",
      "13시 60분",
      "13시 61분",
      "13시 66분",
      "20시 75분",
      "23시 99분",
      "오전 13시",
      "오후 13시",
      "오후 3시 60분",
      "오전 8시 99분",
    ];
    let total = 0;
    for (const date of DATES) {
      for (const clock of invalidClocks) {
        for (const action of ACTIONS) {
          total += 1;
          assertNeverCreates(`${date} ${clock} ${action}`);
        }
      }
    }
    console.log(JSON.stringify({ audit: "invalid-clock", total }));
  });

  it("never guesses AM/PM for bare Korean 1-12 clocks", () => {
    let total = 0;
    for (const date of DATES) {
      for (let hour = 1; hour <= 12; hour += 1) {
        for (const action of ACTIONS) {
          total += 1;
          assertNeverCreates(`${date} ${hour}시 ${action}`);
          assertNeverCreates(`${date} ${hour}시에 ${action}`);
        }
      }
    }
    console.log(JSON.stringify({ audit: "bare-1-12-meridiem", total: total * 2 }));
  });

  it("never collapses two distinct clocks into one schedule", () => {
    const pairs = [
      ["오전 8시", "오후 3시"],
      ["13시", "17시"],
      ["오후 3시", "오후 5시"],
      ["오전 9시 30분", "오후 2시 20분"],
    ] as const;
    const connectors = ["하고", "그리고", ",", "/"] as const;
    let total = 0;
    for (const date of DATES) {
      for (const [a, b] of pairs) {
        for (const connector of connectors) {
          for (const action of ACTIONS) {
            total += 1;
            assertNeverCreates(`${date} ${a} ${action} ${connector} ${b} ${action}`);
          }
        }
      }
    }
    console.log(JSON.stringify({ audit: "multiple-clocks", total }));
  });

  it("never creates schedules from cancel/query/negation wrappers", () => {
    const suffixes = [
      "취소",
      "취소해",
      "저장하지 마",
      "일정에 넣지 마",
      "하지마",
      "말고",
      "뭐였지?",
      "맞아?",
      "였나?",
      "기억나?",
    ] as const;
    let total = 0;
    for (const date of DATES) {
      for (const time of ["오전 8시", "오후 3시", "13시"] as const) {
        for (const action of ACTIONS) {
          for (const suffix of suffixes) {
            total += 1;
            assertNeverCreates(`${date} ${time} ${action} ${suffix}`);
          }
        }
      }
    }
    console.log(JSON.stringify({ audit: "non-create-semantics", total }));
  });

  it("keeps repeat, deadline, broad period, conflicting-date and past forms fail-closed", () => {
    const unsafe = [
      "매주 금요일 오후 3시 회의",
      "매일 오후 3시 약 먹기",
      "내일 오후 3시까지 보고서 제출",
      "금요일 오후 3시 전까지 서류 제출",
      "이번 주 오후 3시 운동",
      "다음 주 오후 3시 회의",
      "오늘 내일 오후 3시 회의",
      "내일 모레 오후 3시 회의",
      "어제 오후 3시 회의",
      "8월 31일 오후 3시 회의",
      "지난 금요일 오후 3시 회의",
    ];
    for (const input of unsafe) assertNeverCreates(input);
    console.log(JSON.stringify({ audit: "semantic-fail-closed", total: unsafe.length }));
  });

  it("date-only completion never invents a visible clock", () => {
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];
    for (const date of DATES) {
      for (const action of ACTIONS) {
        for (const input of dateOnlyForms(date, action)) {
          total += 1;
          expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
          const draft = buildTemporalCompletionDraft(input, "ko", NOW);
          if (!draft) {
            unsupported.push(input.trim());
            continue;
          }
          supported += 1;
          expect(draft.options.allDay, input).toBe(true);
          expect(localYmd(draft.start), input).toBe(expectedDateFor(input));
          expect(draft.start.getHours(), input).toBe(0);
          expect(draft.start.getMinutes(), input).toBe(0);
        }
      }
    }
    console.log(
      JSON.stringify({
        audit: "date-only-completion",
        total,
        supported,
        unsupported: total - supported,
        supportRate: supported / total,
        unsupportedSample: unsupported.slice(0, 30),
      }),
    );
  });

  it("date plus daypart stays fuzzy and never becomes an exact clock", () => {
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];
    for (const date of DATES) {
      for (const daypart of DAYPARTS) {
        for (const action of ACTIONS) {
          for (const input of daypartForms(date, daypart, action)) {
            total += 1;
            expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
            const draft = buildTemporalCompletionDraft(input, "ko", NOW);
            if (!draft) {
              unsupported.push(input.trim());
              continue;
            }
            supported += 1;
            expect(draft.options.allDay, input).toBe(true);
            expect(localYmd(draft.start), input).toBe(expectedDateFor(input));
            expect(draft.start.getHours(), input).toBe(0);
            expect(draft.start.getMinutes(), input).toBe(0);
          }
        }
      }
    }
    console.log(
      JSON.stringify({
        audit: "daypart-fuzzy-completion",
        total,
        supported,
        unsupported: total - supported,
        supportRate: supported / total,
        unsupportedSample: unsupported.slice(0, 30),
      }),
    );
  });

  it("standalone dayparts ask for a day and 이따가 asks for time", () => {
    for (const daypart of DAYPARTS) {
      for (const action of ACTIONS) {
        const input = `${daypart}에 ${action}`;
        const nl = understandNaturalLanguage(input, "ko");
        expect(nl.intent, input).toBe("schedule_clarify");
        expect(nl.clarifyMissing, input).toBe("day");
        expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
        expect(buildTemporalCompletionDraft(input, "ko", NOW), input).toBeNull();
      }
    }

    for (const phrase of ["이따가", "좀 있다"] as const) {
      for (const action of ACTIONS) {
        const input = `${phrase} ${action}`;
        const nl = understandNaturalLanguage(input, "ko");
        if (phrase === "이따가") {
          expect(nl.intent, input).toBe("schedule_clarify");
          expect(nl.clarifyMissing, input).toBe("time");
        }
        expect(evaluateTimedAutoCommit(input, "ko", NOW).ok, input).toBe(false);
      }
    }
  });

  it("noun collisions and clock look-alikes never become temporal schedules", () => {
    const collisions = [
      "두 시안 비교",
      "세 시안 정리",
      "네 시안 검토",
      "제2시안 수정",
      "오후 세시안 비교",
    ];
    for (const input of collisions) assertNeverCreates(input);

    const lookalikes = [
      "내일 ３시 회의",
      "내일 ３：３０ 회의",
      "내일 3️⃣시 회의",
      "내일 ８pm 회의",
    ];
    for (const input of lookalikes) {
      expect(hasUnsupportedClockLikeResidue(input), input).toBe(true);
      assertNeverCreates(input);
    }
  });
});
