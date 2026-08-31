/**
 * Pre-UT Red Team Gate fixtures.
 * Expectations enforce fail-closed / no silent corruption — not new expression coverage.
 */

export type RedTeamExpect =
  | {
      kind: "auto";
      hour: number;
      minute?: number;
      /** Local day offset from the case `now` (0=same day, 1=tomorrow). */
      dayOffset?: number;
      titleMustContain?: string[];
      expectedTitle?: string;
    }
  | {
      kind: "safe";
      /** When auto=false, title must still match if provided. */
      expectedTitle?: string;
      titleMustContain?: string[];
      /** Forbid committing these hours if somehow auto=true. */
      forbiddenHours?: number[];
    };

export type RedTeamCase = {
  family: string;
  input: string;
  lang?: "ko" | "en";
  /** Override evaluation clock; default RED_TEAM_NOW. */
  now?: Date;
  expect: RedTeamExpect;
};

/** Deterministic baseline: 2026-09-01 Tue 10:00 Asia/Seoul local. */
export const RED_TEAM_NOW = new Date(2026, 8, 1, 10, 0, 0, 0);

/** Monday evening — weekday past-time attacks. */
export const RED_TEAM_MONDAY_EVENING = new Date(2026, 7, 31, 20, 0, 0, 0);

const auto = (
  family: string,
  input: string,
  hour: number,
  extra: Omit<Extract<RedTeamExpect, { kind: "auto" }>, "kind" | "hour"> & {
    lang?: "ko" | "en";
    now?: Date;
  } = {},
): RedTeamCase => {
  const { lang, now, ...expectExtra } = extra;
  return {
    family,
    input,
    lang,
    now,
    expect: { kind: "auto", hour, ...expectExtra },
  };
};

const safe = (
  family: string,
  input: string,
  extra: Omit<Extract<RedTeamExpect, { kind: "safe" }>, "kind"> & {
    lang?: "ko" | "en";
    now?: Date;
  } = {},
): RedTeamCase => {
  const { lang, now, ...expectExtra } = extra;
  return {
    family,
    input,
    lang,
    now,
    expect: { kind: "safe", ...expectExtra },
  };
};

export const NL_PRE_UT_RED_TEAM_CASES: RedTeamCase[] = [
  // —— P0-A / P0-B bare 24h + minutes ——
  auto("p0a-valid-24h", "13시 회의", 13, { titleMustContain: ["회의"] }),
  auto("p0a-valid-24h", "13시 20분 회의", 13, {
    minute: 20,
    titleMustContain: ["회의"],
  }),
  auto("p0a-valid-24h", "13시 59분 회의", 13, {
    minute: 59,
    titleMustContain: ["회의"],
  }),
  auto("p0a-valid-24h", "13시 반 회의", 13, {
    minute: 30,
    titleMustContain: ["회의"],
  }),
  auto("p0a-valid-24h", "20시 05분 전화", 20, {
    minute: 5,
    titleMustContain: ["전화"],
  }),
  safe("p0a-invalid-minute", "13시 60분 회의", { forbiddenHours: [13] }),
  safe("p0a-invalid-minute", "13시 66분 회의", { forbiddenHours: [13, 14] }),
  safe("p0a-invalid-minute", "20시 75분 전화", { forbiddenHours: [20, 21] }),
  safe("p0a-invalid-minute", "23시 99분 회의", { forbiddenHours: [23, 0] }),
  auto("p0b-tomorrow-minute", "내일 13시 20분 회의", 13, {
    minute: 20,
    dayOffset: 1,
    titleMustContain: ["회의"],
  }),
  auto("p0b-tomorrow-minute", "내일 13시 반 회의", 13, {
    minute: 30,
    dayOffset: 1,
    titleMustContain: ["회의"],
  }),
  safe("p0b-tomorrow-minute", "내일 13시 70분 회의", {
    forbiddenHours: [13, 14],
  }),
  // Duration / clock-word protections must remain
  safe("p0a-duration-guard", "세시간 공부"),
  safe("p0a-duration-guard", "두 시간 영화"),
  safe("p0a-duration-guard", "오후 2시간 영화"),

  // —— P0-C compound / decimal / signed relative ——
  safe("p0c-compound-relative", "1시간 30분 뒤에 전화"),
  safe("p0c-compound-relative", "2시간 15분 후 회의"),
  safe("p0c-compound-relative", "1.5시간 뒤에 전화"),
  safe("p0c-compound-relative", "0.5시간 뒤에 전화"),
  safe("p0c-compound-relative", "-3시간 뒤에 전화"),
  safe("p0c-compound-relative", "+2시간 뒤에 전화"),
  // Happy single-unit contrast
  auto("p0c-happy-relative", "10분 뒤에 전화", 10, {
    minute: 10,
    titleMustContain: ["전화"],
  }),

  // —— P0-D mixed-format multi-clock ——
  safe("p0d-mixed-multi-clock", "내일 오후 3시 회의 4pm 병원"),
  safe("p0d-mixed-multi-clock", "내일 오후 3시 회의 16:00 병원"),
  safe("p0d-mixed-multi-clock", "내일 15:00 회의 4pm 병원"),
  safe("p0d-mixed-multi-clock", "오후 3시부터 5시까지 회의, 18:00 약속"),
  safe("p0d-mixed-multi-clock", "3pm 회의 오후 4시 병원"),
  safe("p0d-mixed-multi-clock", "15:00 meeting at 4pm", { lang: "en" }),
  // Legitimate single range contrast
  auto("p0d-happy-range", "오후 5시부터 6시까지 운동", 17, {
    titleMustContain: ["운동"],
  }),

  // —— P0-E multiple / contradictory date anchors ——
  safe("p0e-multi-date", "9월 3일 오후 3시 병원, 9월 5일 미팅"),
  safe("p0e-multi-date", "내일 오후 3시 병원, 9월 5일 미팅"),
  // 2026-09-03 is Thursday — weekday contradiction
  safe("p0e-weekday-contradiction", "9월 3일 금요일 오후 3시 병원"),
  safe("p0e-weekday-contradiction", "2026년 9월 3일 금요일 오후 3시 병원"),
  safe("p0e-weekday-contradiction", "목요일 9월 4일 오후 3시 병원"),
  // Consistent weekday+date may auto when otherwise safe (Thu 9/3)
  auto("p0e-consistent-weekday", "2026년 9월 3일 목요일 오후 3시 병원", 15, {
    titleMustContain: ["병원"],
  }),

  // —— P0-F calendar validity ——
  safe("p0f-invalid-calendar", "2027년 2월 30일 오후 3시 병원"),
  safe("p0f-invalid-calendar", "2027년 2월 29일 오후 3시 병원"),
  auto("p0f-leap-valid", "2028년 2월 29일 오후 3시 병원", 15, {
    titleMustContain: ["병원"],
  }),
  safe("p0f-invalid-calendar", "9월 31일 오후 3시 병원"),
  safe("p0f-invalid-calendar", "4월 31일 오후 3시 병원"),
  safe("p0f-invalid-calendar", "13월 1일 오후 3시 병원"),
  safe("p0f-invalid-calendar", "0월 10일 오후 3시 병원"),
  safe("p0f-invalid-calendar", "2월 0일 오후 3시 병원"),

  // —— P0-G before/after/approx/conditional ——
  safe("p0g-non-exact", "내일 오후 3시 전에 출발"),
  safe("p0g-non-exact", "내일 오후 3시 이전에 병원"),
  safe("p0g-non-exact", "내일 오후 3시 이후에 전화"),
  safe("p0g-non-exact", "내일 오후 3시 후에 전화"),
  safe("p0g-non-exact", "내일 오후 3시 전후로 전화"),
  safe("p0g-non-exact", "내일 오후 3시쯤 전화"),
  safe("p0g-non-exact", "내일 오후 3시 지나서 전화"),
  safe("p0g-non-exact", "내일 오후 3시 회의 끝나면 전화"),
  safe("p0g-non-exact", "내일 오후 3시 병원 갔다가 전화"),
  safe("p0g-non-exact", "내일 오후 3시 회의 끝난 뒤 전화"),

  // —— P0-H negation / retrieval / question ——
  safe("p0h-negation-query", "내일 오후 3시 회의 없음"),
  safe("p0h-negation-query", "내일 오후 3시 회의 없어"),
  safe("p0h-negation-query", "내일 오후 3시 병원 못 가"),
  safe("p0h-negation-query", "내일 오후 3시 회의 안 가"),
  safe("p0h-negation-query", "내일 오후 3시 뭐 있어"),
  safe("p0h-negation-query", "내일 오후 3시 일정 있나"),
  safe("p0h-negation-query", "내일 오후 3시 일정 있어"),
  safe("p0h-negation-query", "내일 오후 3시 뭐 있지"),
  safe("p0h-negation-query", "내일 오후 3시 회의 맞아"),
  safe("p0h-negation-query", "내일 오후 3시 회의 취소됐어"),
  safe("p0h-negation-query", "no meeting tomorrow at 3pm", { lang: "en" }),
  safe("p0h-negation-query", "what do I have tomorrow at 3pm", { lang: "en" }),
  safe("p0h-negation-query", "do I have anything tomorrow at 3pm", {
    lang: "en",
  }),
  safe("p0h-negation-query", "call mom after 3pm tomorrow", { lang: "en" }),

  // —— P0-I unsupported date residue + clock ——
  safe("p0i-unsupported-date", "낼 오후 3시 병원"),
  safe("p0i-unsupported-date", "금욜 오후 3시 병원"),
  safe("p0i-unsupported-date", "담주 오후 3시 회의"),
  safe("p0i-unsupported-date", "담주 월욜 오후 3시 병원"),
  safe("p0i-unsupported-date", "tomorow at 3pm meeting", { lang: "en" }),
  safe("p0i-unsupported-date", "tmrw at 3pm meeting", { lang: "en" }),

  // —— P0-J Korean clock-word noun collisions ——
  safe("p0j-noun-collision", "두 시안 비교"),
  safe("p0j-noun-collision", "한 시나리오 검토"),
  safe("p0j-noun-collision", "세 시리즈 보기"),
  safe("p0j-noun-collision", "한 시스템 점검"),
  safe("p0j-noun-collision", "두 시제품 검토"),
  safe("p0j-noun-collision", "오후 두 시안 비교"),
  safe("p0j-noun-collision", "오후 한 시나리오 검토"),
  safe("p0j-noun-collision", "오후 세 시리즈 확인"),
  safe("p0j-noun-collision", "내일 두 시안 정리"),
  // Bare 1–12 without meridiem stays ambiguous (existing contract).
  safe("p0j-real-clock-bare", "두 시 회의"),
  auto("p0j-real-clock", "오후 두 시 회의", 14, {
    titleMustContain: ["회의"],
  }),
  auto("p0j-real-clock", "오후 두 시 반 회의", 14, {
    minute: 30,
    titleMustContain: ["회의"],
  }),

  // —— P0-K past canonical timestamp ——
  safe("p0k-past-weekday", "월요일 오후 3시 회의", {
    now: RED_TEAM_MONDAY_EVENING,
    forbiddenHours: [15],
  }),
  safe("p0k-past-today", "오후 3시 회의", {
    now: RED_TEAM_MONDAY_EVENING,
    forbiddenHours: [15],
  }),
  safe("p0k-past-absolute", "2026년 8월 31일 오후 3시 회의", {
    now: RED_TEAM_MONDAY_EVENING,
    forbiddenHours: [15],
  }),
  auto("p0k-future-weekday", "월요일 오후 9시 회의", 21, {
    now: RED_TEAM_MONDAY_EVENING,
    titleMustContain: ["회의"],
  }),

  // —— HARDENING-A low-confidence / code-like title ——
  safe("hardening-a-title", "'; DROP TABLE schedules;-- 오후 3시", {
    expectedTitle: "'; DROP TABLE schedules;--",
  }),
  auto("hardening-a-happy", "오후 3시 회의", 15, {
    titleMustContain: ["회의"],
  }),
  auto("hardening-a-happy", "오후 세시 회의", 15, {
    titleMustContain: ["회의"],
  }),
  safe("hardening-a-happy", "오후 세시 병웜", {
    expectedTitle: "병웜",
  }),

  // —— HARDENING-B control characters ——
  auto("hardening-b-control", "오후 3시\t회의", 15, {
    expectedTitle: "회의",
  }),
  auto("hardening-b-control", "오후 3시\u0000회의", 15, {
    expectedTitle: "회의",
  }),
  auto("hardening-b-control", "오후 3시\u0007회의", 15, {
    expectedTitle: "회의",
  }),
];
