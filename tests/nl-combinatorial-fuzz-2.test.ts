import { describe, expect, it } from "vitest";
import { evaluateTimedAutoCommit } from "@/lib/nlAutoCommit";
import { buildTemporalCompletionDraft } from "@/lib/nlTemporalCompletion";

const NOW = new Date(2026, 8, 1, 10, 0, 0, 0);
const ACTIONS = ["회의", "운동", "병원 가기", "서류 제출", "엄마한테 전화"] as const;
const DATES = [
  { text: "내일", ymd: "2026-09-02" },
  { text: "모레", ymd: "2026-09-03" },
  { text: "금요일", ymd: "2026-09-04" },
  { text: "9월 5일", ymd: "2026-09-05" },
] as const;

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fingerprint(d: Date): string {
  return `${ymd(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function outcome(input: string):
  | { kind: "timed"; start: Date; end: Date }
  | { kind: "completion"; start: Date; end: Date; allDay: boolean }
  | { kind: "safe"; reason: string } {
  const timed = evaluateTimedAutoCommit(input, "ko", NOW);
  if (timed.ok) return { kind: "timed", start: timed.draft.start, end: timed.draft.end };
  const completion = buildTemporalCompletionDraft(input, "ko", NOW);
  if (completion) {
    return {
      kind: "completion",
      start: completion.start,
      end: completion.end,
      allDay: Boolean(completion.options.allDay),
    };
  }
  return { kind: "safe", reason: timed.reason };
}

function assertNoCreate(input: string) {
  const result = outcome(input);
  if (result.kind !== "safe") {
    throw new Error(
      `unsafe create: ${JSON.stringify({
        input,
        kind: result.kind,
        start: fingerprint(result.start),
        end: fingerprint(result.end),
      })}`,
    );
  }
}

function expectExactOrCoverage(
  input: string,
  expected: { date: string; hour: number; minute: number },
  unsupported: string[],
) {
  const result = outcome(input);
  if (result.kind === "safe") {
    unsupported.push(`${input.replaceAll("\n", "↵")} => ${result.reason}`);
    return false;
  }
  if (result.kind === "completion") {
    throw new Error(`exact input collapsed to fuzzy/date-only: ${input}`);
  }
  expect(ymd(result.start), input).toBe(expected.date);
  expect(result.start.getHours(), input).toBe(expected.hour);
  expect(result.start.getMinutes(), input).toBe(expected.minute);
  return true;
}

describe("combinatorial natural-language fuzz audit v2", () => {
  it("crosses all twelve spoken Korean clock words with meridiem, dates, actions and surface variation", () => {
    const words = [
      ["한", 1], ["두", 2], ["세", 3], ["네", 4], ["다섯", 5], ["여섯", 6],
      ["일곱", 7], ["여덟", 8], ["아홉", 9], ["열", 10], ["열한", 11], ["열두", 12],
    ] as const;
    const meridiems = ["오전", "오후"] as const;
    const surfaces = [
      (m: string, w: string) => `${m} ${w} 시`,
      (m: string, w: string) => `${m} ${w}시`,
      (m: string, w: string) => `${m}${w}시`,
      (m: string, w: string) => `${m}  ${w}  시`,
    ];
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];

    for (const date of DATES) {
      for (const [word, h12] of words) {
        for (const meridiem of meridiems) {
          const hour = meridiem === "오후"
            ? h12 === 12 ? 12 : h12 + 12
            : h12 === 12 ? 0 : h12;
          for (const surface of surfaces) {
            for (const action of ACTIONS) {
              total += 1;
              const input = `${date.text} ${surface(meridiem, word)} ${action}`;
              if (expectExactOrCoverage(input, { date: date.ymd, hour, minute: 0 }, unsupported)) {
                supported += 1;
              }
            }
          }
        }
      }
    }
    console.log(JSON.stringify({
      audit: "spoken-clock-cross",
      total,
      supported,
      unsupported: total - supported,
      supportRate: supported / total,
      unsupportedSample: unsupported.slice(0, 40),
    }));
  });

  it("audits colon clocks and blocks invalid or mixed-meridiem colon forms", () => {
    const valid = [
      ["08:00", 8, 0],
      ["13:20", 13, 20],
      ["15:30", 15, 30],
      ["20:45", 20, 45],
      ["23:59", 23, 59],
    ] as const;
    const invalid = ["24:00", "25:00", "12:60", "23:99", "99:99"];
    const mixed = ["오후 03:00", "오전 08:00", "오후 11:30"];
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];

    for (const date of DATES) {
      for (const [clock, hour, minute] of valid) {
        for (const action of ACTIONS) {
          for (const input of [
            `${date.text} ${clock} ${action}`,
            `${date.text} ${clock}에 ${action}`,
            `${date.text}\n${clock}\n${action}`,
          ]) {
            total += 1;
            if (expectExactOrCoverage(input, { date: date.ymd, hour, minute }, unsupported)) supported += 1;
          }
        }
      }
      for (const clock of invalid) {
        for (const action of ACTIONS) assertNoCreate(`${date.text} ${clock} ${action}`);
      }
      for (const clock of mixed) {
        for (const action of ACTIONS) assertNoCreate(`${date.text} ${clock} ${action}`);
      }
    }

    console.log(JSON.stringify({
      audit: "colon-clock-cross",
      total,
      supported,
      unsupported: total - supported,
      supportRate: total ? supported / total : 0,
      unsupportedSample: unsupported.slice(0, 40),
    }));
  });

  it("audits alternative absolute-date spellings without accepting wrong calendar dates", () => {
    const dateForms = [
      ["9/5", "2026-09-05"],
      ["9-5", "2026-09-05"],
      ["2026년 9월 5일", "2026-09-05"],
      ["2026년 09월 05일", "2026-09-05"],
    ] as const;
    const clocks = [
      ["오전 8시", 8, 0],
      ["오후 3시", 15, 0],
      ["20시", 20, 0],
    ] as const;
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];
    for (const [date, expectedDate] of dateForms) {
      for (const [clock, hour, minute] of clocks) {
        for (const action of ACTIONS) {
          total += 1;
          if (expectExactOrCoverage(`${date} ${clock} ${action}`, { date: expectedDate, hour, minute }, unsupported)) {
            supported += 1;
          }
        }
      }
    }
    console.log(JSON.stringify({
      audit: "absolute-date-spellings",
      total,
      supported,
      unsupported: total - supported,
      supportRate: supported / total,
      unsupportedSample: unsupported.slice(0, 40),
    }));
  });

  it("audits relative offsets and never lets non-create wrappers revive them", () => {
    const offsets = [
      ["30분 후", 30],
      ["30분 뒤", 30],
      ["1시간 후", 60],
      ["1시간 뒤", 60],
      ["2시간 후", 120],
      ["2시간 뒤", 120],
    ] as const;
    const wrappers = ["취소", "하지마", "저장하지 마", "맞나", "기억나"];
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];

    for (const [phrase, minutes] of offsets) {
      for (const action of ACTIONS) {
        total += 1;
        const input = `${phrase} ${action}`;
        const result = outcome(input);
        if (result.kind === "safe") {
          unsupported.push(`${input} => ${result.reason}`);
        } else if (result.kind === "completion") {
          throw new Error(`relative offset collapsed to all-day/fuzzy: ${input}`);
        } else {
          supported += 1;
          const expected = new Date(NOW.getTime() + minutes * 60_000);
          expect(result.start.getTime(), input).toBe(expected.getTime());
        }

        for (const wrapper of wrappers) assertNoCreate(`${input} ${wrapper}`);
      }
    }
    console.log(JSON.stringify({
      audit: "relative-offset",
      total,
      supported,
      unsupported: total - supported,
      supportRate: supported / total,
      unsupportedSample: unsupported.slice(0, 40),
    }));
  });

  it("keeps weekend and broad-period clocks unresolved instead of choosing a hidden day", () => {
    const periods = [
      "주말",
      "이번 주말",
      "다음 주말",
      "이번 주",
      "다음 주",
      "이번 달",
      "다음 달",
    ];
    const clocks = ["오전 8시", "오후 3시", "20시"];
    for (const period of periods) {
      for (const clock of clocks) {
        for (const action of ACTIONS) assertNoCreate(`${period} ${clock} ${action}`);
      }
    }
  });

  it("keeps approximate clocks non-exact across hedge spellings", () => {
    const hedges = ["쯤", "경", "무렵", "정도", "정도에"];
    const clocks = ["오전 8시", "오후 3시", "13시", "오후 세시"];
    for (const date of DATES) {
      for (const clock of clocks) {
        for (const hedge of hedges) {
          for (const action of ACTIONS) assertNoCreate(`${date.text} ${clock}${hedge} ${action}`);
        }
      }
    }
  });

  it("audits supported clock ranges and rejects reversed or malformed ranges", () => {
    const valid = [
      ["오전 8시부터 오전 9시까지", 8, 0, 9, 0],
      ["오후 3시부터 4시까지", 15, 0, 16, 0],
      ["오후 세시부터 네시까지", 15, 0, 16, 0],
    ] as const;
    const invalid = [
      "오후 5시부터 오후 3시까지",
      "13시 60분부터 14시까지",
      "오전 9시부터 오전 9시까지",
      "오후 3시부터 25시까지",
    ];
    let supported = 0;
    const unsupported: string[] = [];
    for (const date of DATES) {
      for (const [range, sh, sm, eh, em] of valid) {
        for (const action of ACTIONS) {
          const input = `${date.text} ${range} ${action}`;
          const result = outcome(input);
          if (result.kind === "safe") {
            unsupported.push(`${input} => ${result.reason}`);
            continue;
          }
          if (result.kind === "completion") throw new Error(`range collapsed to fuzzy: ${input}`);
          supported += 1;
          expect(ymd(result.start), input).toBe(date.ymd);
          expect(result.start.getHours(), input).toBe(sh);
          expect(result.start.getMinutes(), input).toBe(sm);
          expect(result.end.getHours(), input).toBe(eh);
          expect(result.end.getMinutes(), input).toBe(em);
        }
      }
      for (const range of invalid) {
        for (const action of ACTIONS) assertNoCreate(`${date.text} ${range} ${action}`);
      }
    }
    console.log(JSON.stringify({ audit: "clock-ranges", total: DATES.length * valid.length * ACTIONS.length, supported, unsupportedSample: unsupported.slice(0, 40) }));
  });

  it("audits newlines, emoji, brackets and punctuation around exact inputs without tolerating wrong timestamps", () => {
    const decorators = [
      (date: string, clock: string, action: string) => `${date}\n${clock}\n${action}`,
      (date: string, clock: string, action: string) => `📌 ${date} ${clock} ${action}`,
      (date: string, clock: string, action: string) => `${date} (${clock}) ${action}`,
      (date: string, clock: string, action: string) => `${date} · ${clock} · ${action}`,
      (date: string, clock: string, action: string) => `${date}: ${clock}, ${action}`,
      (date: string, clock: string, action: string) => `[${date}] [${clock}] ${action}`,
    ];
    const clocks = [
      ["오전 8시", 8, 0],
      ["오후 3시 반", 15, 30],
      ["20시", 20, 0],
    ] as const;
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];
    for (const date of DATES) {
      for (const [clock, hour, minute] of clocks) {
        for (const action of ACTIONS) {
          for (const decorate of decorators) {
            total += 1;
            const input = decorate(date.text, clock, action);
            if (expectExactOrCoverage(input, { date: date.ymd, hour, minute }, unsupported)) supported += 1;
          }
        }
      }
    }
    console.log(JSON.stringify({
      audit: "surface-decoration",
      total,
      supported,
      unsupported: total - supported,
      supportRate: supported / total,
      unsupportedSample: unsupported.slice(0, 40),
    }));
  });

  it("does not mistake numbers inside titles for extra clocks", () => {
    const titles = [
      "2차 면접",
      "3D 프린터 회의",
      "iPhone 17 수령",
      "v2 리뷰",
      "프로젝트 2026 킥오프",
      "5명 저녁 약속",
      "10페이지 읽기",
    ];
    let total = 0;
    let supported = 0;
    const unsupported: string[] = [];
    for (const date of DATES) {
      for (const title of titles) {
        total += 1;
        const input = `${date.text} 오후 3시 ${title}`;
        if (expectExactOrCoverage(input, { date: date.ymd, hour: 15, minute: 0 }, unsupported)) supported += 1;
      }
    }
    console.log(JSON.stringify({ audit: "numeric-title-collisions", total, supported, unsupportedSample: unsupported.slice(0, 40) }));
  });

  it("audits basic English exact forms and blocks English non-create semantics", () => {
    const exact = [
      ["tomorrow at 3 pm meeting", "2026-09-02", 15, 0],
      ["tomorrow 8 am workout", "2026-09-02", 8, 0],
      ["Friday at 3 pm meeting", "2026-09-04", 15, 0],
    ] as const;
    const unsupported: string[] = [];
    let supported = 0;
    for (const [input, date, hour, minute] of exact) {
      if (expectExactOrCoverage(input, { date, hour, minute }, unsupported)) supported += 1;
    }
    for (const input of [
      "tomorrow at 3 pm meeting cancelled",
      "tomorrow at 3 pm meeting?",
      "do I have a meeting tomorrow at 3 pm",
      "do not schedule tomorrow at 3 pm meeting",
      "cancel tomorrow at 3 pm meeting",
    ]) assertNoCreate(input);
    console.log(JSON.stringify({ audit: "english-basics", total: exact.length, supported, unsupportedSample: unsupported }));
  });
});
