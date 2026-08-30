/**
 * P0-A NL fullsweep fixture corpus (36-group historical audit + contract overrides).
 * Expectations mirror hotfix/nl-safety-main semantic safety — not pre-hotfix auto behavior.
 */

export type FullsweepGrade = "FULL_PASS" | "SAFE" | "TITLE_FAIL" | "FAIL";

export type FullsweepCase = {
  category: string;
  input: string;
  /** Expected hasNaturalScheduleTime */
  explicitTime: boolean;
  /** Expected evaluateTimedAutoCommit(...).ok */
  auto: boolean;
  /** Expected shouldShowInlinePromise — only assert when defined */
  inlinePromise?: boolean;
  /** If auto true, expected start hour (local) */
  autoStartHour?: number;
  autoStartMinute?: number;
  /** If auto true and range, expected end hour */
  autoEndHour?: number;
  /** If set, scheduleConfirmationReasons must include this when auto=false */
  confirmationReason?: "assumed_meridiem";
  /** Known title-debt: if temporal OK but title mangled, grade TITLE_FAIL */
  titleDebt?: boolean;
  /** Substrings that cleanScheduleTitle must still contain when auto=true (unless titleDebt) */
  titleMustContain?: string[];
  /** Clock for evaluation; evening used for past-time-only */
  now?: "morning" | "evening";
};

function c(
  category: string,
  input: string,
  partial: Omit<FullsweepCase, "category" | "input">,
): FullsweepCase {
  return { category, input, ...partial };
}

/** Blocked / quiet helpers — no clock fabricated */
const blocked = (category: string, input: string, extra: Partial<FullsweepCase> = {}) =>
  c(category, input, { explicitTime: false, auto: false, ...extra });

const quiet = (category: string, input: string, extra: Partial<FullsweepCase> = {}) =>
  c(category, input, {
    explicitTime: false,
    auto: false,
    inlinePromise: false,
    ...extra,
  });

const quietClock = (category: string, input: string, extra: Partial<FullsweepCase> = {}) =>
  c(category, input, {
    explicitTime: true,
    auto: false,
    inlinePromise: false,
    ...extra,
  });

const exact = (
  category: string,
  input: string,
  hour: number,
  extra: Partial<FullsweepCase> = {},
) =>
  c(category, input, {
    explicitTime: true,
    auto: true,
    autoStartHour: hour,
    ...extra,
  });

const bareAmbiguous = (
  category: string,
  input: string,
  extra: Partial<FullsweepCase> = {},
) =>
  c(category, input, {
    explicitTime: false,
    auto: false,
    confirmationReason: "assumed_meridiem",
    ...extra,
  });

export const NL_FULLSWEEP_CASES: FullsweepCase[] = [
  // —— 01 date-only ——
  ...[
    "오늘 청소",
    "내일 청소",
    "모레 청소",
    "글피 청소",
    "어제 청소했어",
    "월요일 청소",
    "이번 금요일 청소",
    "다음 주 월요일 청소",
    "이번 주에 청소",
    "다음 주에 청소",
    "이번 달에 병원 가기",
    "다음 달에 치과 가기",
    "9월 3일 청소",
    "9/3 청소",
    "9월에 건강검진",
    "이번 달 말에 월세 내기",
    "다음 달 초에 병원 가기",
    "9월 중순에 여행 가기",
    "9월 말에 보험 갱신",
  ].map((input) => blocked("01-date-only", input)),
  blocked("01-date-only", "다다음 주 월요일 청소", { titleDebt: true }),
  blocked("01-date-only", "2026년 9월 3일 청소", { titleDebt: true }),

  // —— 02 time-only exact ——
  bareAmbiguous("02-time-only", "3시에 청소"),
  exact("02-time-only", "오전 10시에 청소", 10),
  exact("02-time-only", "오후 3시에 청소", 15),
  bareAmbiguous("02-time-only", "10시에 회의"),
  bareAmbiguous("02-time-only", "3시 반에 병원"),
  bareAmbiguous("02-time-only", "3시 20분에 전화"),
  bareAmbiguous("02-time-only", "9시에 출근"),
  exact("02-time-only", "18시에 운동", 18),
  ...["아침에 운동", "오전에 청소", "오후에 청소", "저녁에 운동", "밤에 약 먹기"].map(
    (input) => blocked("02-time-only-daypart", input),
  ),

  // —— 02b past-time-only (evening now) ——
  ...[
    "오전 10시에 청소",
    "오후 3시에 청소",
    "18시에 운동",
    "3pm meeting",
  ].map((input) =>
    c("02b-past-time-only", input, {
      explicitTime: true,
      auto: false,
      now: "evening",
    }),
  ),

  // —— 03 date + exact / daypart ——
  bareAmbiguous("03-date-exact", "오늘 3시에 청소"),
  exact("03-date-exact", "오늘 오후 3시에 청소", 15),
  bareAmbiguous("03-date-exact", "내일 3시에 치과", { inlinePromise: true }),
  exact("03-date-exact", "내일 오후 3시에 치과", 15, {
    titleMustContain: ["치과"],
  }),
  exact("03-date-exact", "내일 오후 3시 치과", 15, {
    titleMustContain: ["치과"],
  }),
  exact("03-date-exact", "모레 오전 10시에 회의", 10),
  exact("03-date-exact", "이번 금요일 오후 2시에 미팅", 14),
  exact("03-date-exact", "다음 주 월요일 오전 9시에 출근", 9),
  exact("03-date-exact", "9월 3일 오후 4시에 치과", 16),
  bareAmbiguous("03-date-exact", "9/3 4시 치과"),
  exact("03-date-exact", "9월 3일 16시에 치과", 16),
  exact("03-date-exact", "2026년 9월 3일 오후 4시 치과", 16),
  exact("03-date-exact", "내일 오후 3시 반 치과", 15, {
    autoStartMinute: 30,
    titleMustContain: ["치과"],
  }),
  ...[
    "내일 아침에 운동",
    "내일 오전에 병원",
    "내일 오후에 청소",
    "내일 저녁에 친구 만나기",
    "내일 밤에 약 먹기",
  ].map((input) => blocked("03-date-daypart", input)),

  // —— 04 relative offsets ——
  c("04-relative-offset", "10분 뒤에 전화", {
    explicitTime: true,
    auto: true,
    titleMustContain: ["전화"],
  }),
  c("04-relative-offset", "10분 뒤에 세탁기 끄기", {
    explicitTime: true,
    auto: true,
    titleMustContain: ["세탁기"],
  }),
  c("04-relative-offset", "한 시간 뒤에 약 먹기", {
    explicitTime: true,
    auto: true,
    titleMustContain: ["약"],
  }),
  c("04-relative-offset", "두 시간 후에 운동하기", {
    explicitTime: true,
    auto: true,
    titleMustContain: ["운동"],
  }),
  c("04-relative-offset", "90분 뒤에 전화", {
    explicitTime: true,
    auto: true,
    titleMustContain: ["전화"],
  }),
  c("04-relative-offset", "1시간 반 뒤에 출발", {
    explicitTime: false,
    auto: false,
    confirmationReason: "assumed_meridiem",
    titleDebt: true,
  }),
  ...["조금 있다가 전화하기", "이따가 청소", "잠시 후에 확인하기", "나중에 전화하기"].map(
    (input) => blocked("04-relative-offset", input),
  ),

  // —— 05 now / immediate ——
  ...[
    "지금 약 먹기",
    "지금 전화하기",
    "지금 출발",
    "바로 전화하기",
    "지금부터 운동",
    "지금 회의 시작",
  ].map((input) => blocked("05-now-immediate", input)),

  // —— 06 relative day + daypart ——
  ...[
    "오늘 아침 운동",
    "오늘 오전 회의",
    "오늘 오후 청소",
    "오늘 저녁 친구 만나기",
    "오늘 밤 약 먹기",
    "내일 아침 운동",
    "내일 오전 병원",
    "내일 오후 청소",
    "내일 저녁 약속",
    "내일 밤 출발",
    "모레 아침 출근",
    "다음 주 월요일 오전 미팅",
  ].map((input) => blocked("06-relative-daypart", input)),
  blocked("06-relative-daypart", "이번 주말 저녁에 영화", { titleDebt: true }),

  // —— 07 approximate / before / after ——
  ...[
    "3시쯤 병원",
    "3시경 회의",
    "3시쯤 전화하기",
    "3시 전까지 제출",
    "3시 전에 출발",
    "3시 이후에 전화",
    "3시 넘어서 전화",
    "3시부터 회의",
  ].map((input) => bareAmbiguous("07-approximate", input)),
  blocked("07-approximate", "세 시 정도에 출발"),
  quietClock("07-approximate", "오후 3시쯤 병원"),
  // deadline-ish bare until → not auto
  c("07-approximate", "3시까지 회의", {
    explicitTime: false,
    auto: false,
    inlinePromise: false,
    confirmationReason: "assumed_meridiem",
  }),

  // —— 08 deadlines (never auto-commit as start) ——
  ...[
    "오늘까지 보고서 제출",
    "내일까지 보고서 제출",
    "금요일까지 포트폴리오 수정",
    "다음 주까지 지원서 작성",
    "9월 3일까지 신청",
    "이번 달 말까지 결제",
    "퇴근 전까지 보고서 보내기",
  ].map((input) => quiet("08-deadline", input)),
  quietClock("08-deadline", "오후 5시까지 제출"),
  quietClock("08-deadline", "내일 오후 5시까지 제출"),
  c("08-deadline", "3시까지 회의", {
    explicitTime: false,
    auto: false,
    inlinePromise: false,
    confirmationReason: "assumed_meridiem",
  }),

  // —— 09 ranges ——
  bareAmbiguous("09-ranges", "3시부터 4시까지 회의"),
  bareAmbiguous("09-ranges", "5시부터 6시까지 운동"),
  bareAmbiguous("09-ranges", "3시부터 5시까지 회의"),
  bareAmbiguous("09-ranges", "내일 5시부터 6시까지 운동", {
    inlinePromise: true,
  }),
  exact("09-ranges", "오후 3시부터 5시까지 회의", 15, { autoEndHour: 17 }),
  exact("09-ranges", "오후 5시부터 6시까지 운동", 17, { autoEndHour: 18 }),
  exact("09-ranges", "내일 오후 5시부터 6시까지 운동", 17, {
    autoEndHour: 18,
  }),
  exact("09-ranges", "오후 3시부터 오후 5시까지 회의", 15, {
    autoEndHour: 17,
  }),
  exact("09-ranges", "월요일 오전 10시부터 11시까지 회의", 10, {
    autoEndHour: 11,
  }),
  exact("09-ranges", "9월 3일 14시부터 16시까지 교육", 14, {
    autoEndHour: 16,
  }),
  c("09-ranges", "2시-3시 병원", {
    explicitTime: false,
    auto: false,
  }),
  quietClock("09-ranges", "14:00~15:30 미팅"),
  c("09-ranges", "오전 9시~오후 6시 근무", {
    explicitTime: true,
    auto: false,
    titleDebt: true,
  }),

  // —— 10 multi-day durations ——
  ...[
    "3일 동안 운동",
    "일주일 동안 약 먹기",
    "월요일부터 금요일까지 출근",
    "9월 1일부터 9월 5일까지 여행",
    "오늘부터 금요일까지 휴가",
    "다음 주 내내 출장",
    "이번 주말 여행",
  ].map((input) => blocked("10-multi-day", input)),

  // —— 11 recurrence ——
  ...[
    "매일 운동",
    "매일 아침 운동",
    "매주 월요일 운동",
    "매주 월수금 운동",
    "화요일 목요일마다 수영",
    "매달 1일 월세 내기",
    "매월 마지막 날 결제",
    "매년 8월 22일 생일",
  ].map((input) => quiet("11-recurrence", input)),
  quietClock("11-recurrence", "매일 오전 8시에 약 먹기"),
  quiet("11-recurrence", "매일 밤 10시에 약 먹기"),
  ...[
    "매주 금요일 오후 3시 회의",
    "월요일마다 오후 3시 운동",
    "이틀에 한 번 오후 3시 운동",
    "3일마다 오후 3시 약 먹기",
    "격주 월요일 오후 3시 회의",
    "2주마다 오후 3시 회의",
  ].map((input) => quietClock("11-recurrence", input)),

  // —— 12 frequency without rule ——
  ...[
    "가끔 운동하기",
    "자주 물 마시기",
    "틈날 때 운동하기",
    "시간 날 때 청소하기",
    "생각날 때 엄마한테 전화하기",
  ].map((input) => blocked("12-frequency", input)),

  // —— 13 behavior-relative ——
  ...[
    "밥 먹고 청소",
    "점심 먹고 약 먹기",
    "저녁 먹고 산책",
    "운동 끝나고 샤워",
    "회의 끝나고 전화",
    "병원 갔다 와서 약 사기",
    "일 끝나고 장보기",
    "퇴근하고 운동",
    "집에 가서 빨래",
    "도착하면 전화",
    "출근 전에 약 먹기",
    "자기 전에 약 먹기",
    "밥 먹기 전에 약 먹기",
    "회의 전에 자료 보내기",
    "퇴근 전에 보고서 제출",
  ].map((input) => blocked("13-behavior-relative", input)),

  // —— 14-16 location / person / weather ——
  ...[
    "회사 도착하면 전화",
    "집 도착하면 빨래",
    "병원 가면 보험 물어보기",
    "마트 가면 우유 사기",
    "강남 도착하면 연락하기",
    "집 나갈 때 택배 챙기기",
    "엄마 만나면 이것 물어보기",
    "민수 만나면 돈 주기",
    "팀장님 만나면 휴가 얘기하기",
    "의사 만나면 약 물어보기",
    "비 오면 우산 챙기기",
    "날씨 좋으면 산책하기",
    "눈 오면 차 확인하기",
    "미세먼지 괜찮으면 러닝하기",
  ].map((input) => quiet("14-location-person-weather", input)),

  // —— 17-19 colloquial / spacing / typos ——
  ...[
    "낼 3시 병원",
    "금욜 병원",
    "담주 월욜 병원",
    "세시반 병원",
    "내일3시병원",
    "다음주 월요일3시병원",
    "3시반병원",
    "내알 병원",
    "낼 3시 뱡원",
    "오눌 3시 회의",
    "다음주 월요릴 미팅",
  ].map((input) => blocked("17-colloquial-typo", input)),
  c("17-colloquial-typo", "오후 세시 회의", {
    explicitTime: false,
    auto: false,
  }),
  c("17-colloquial-typo", "오후 세시 병웜", {
    explicitTime: false,
    auto: false,
  }),
  exact("17-colloquial-typo", "오후3시회의", 15, {
    titleMustContain: ["회의"],
  }),

  // —— 20 mixed EN/KO ——
  exact("20-mixed-en-ko", "내일 3pm 회의", 15, {
    titleMustContain: ["회의"],
  }),
  blocked("20-mixed-en-ko", "tomorrow 3시 회의"),
  blocked("20-mixed-en-ko", "Monday 병원"),
  blocked("20-mixed-en-ko", "next Monday 병원"),
  blocked("20-mixed-en-ko", "9/3 meeting"),
  exact("20-mixed-en-ko", "3pm meeting", 15, {
    titleMustContain: ["meeting"],
  }),
  blocked("20-mixed-en-ko", "내일 meeting"),
  exact("20-mixed-en-ko", "Friday 2pm 회의", 14, {
    titleMustContain: ["회의"],
  }),

  // —— 21 mixed meridiem + colon ——
  quietClock("21-meridiem-colon", "오후 03:00 병원"),

  // —— 22 bare 1-12 AM/PM ambiguous ——
  bareAmbiguous("22-bare-hour", "내일 3시 병원", { inlinePromise: true }),
  bareAmbiguous("22-bare-hour", "내일 8시 운동", { inlinePromise: true }),
  bareAmbiguous("22-bare-hour", "오늘 7시 약속", { inlinePromise: true }),
  bareAmbiguous("22-bare-hour", "12시에 밥"),
  bareAmbiguous("22-bare-hour", "12시 반에 회의"),
  bareAmbiguous("22-bare-hour", "내일 엄마 병원 10시에 같이 가기", {
    inlinePromise: true,
    titleDebt: true,
  }),

  // —— 23 explicit past ——
  ...[
    "어제 오후 3시 병원",
    "지난주 월요일 오후 3시 회의",
    "8월 20일 오후 3시 약 먹기",
    "2025년 9월 3일 오후 4시 치과",
  ].map((input) => quietClock("23-past-references", input)),

  // —— 24-25 undated / vague future ——
  ...[
    "청소하기",
    "빨래하기",
    "엄마한테 전화하기",
    "책 사기",
    "포트폴리오 수정",
    "병원 예약",
    "나중에 청소",
    "언젠가 여행 가기",
    "조만간 병원 가기",
    "곧 엄마한테 전화",
    "기회 되면 운동",
    "시간 되면 전화",
    "이번에 한번 병원 가야겠다",
  ].map((input) => blocked("24-undated-vague", input)),

  // —— 25b vague future + clock ——
  ...[
    "나중에 오후 3시 청소",
    "언젠가 오후 3시 여행 계획",
    "시간 되면 오후 3시 전화",
  ].map((input) => quietClock("25b-vague-future-clock", input)),

  // —— 26 title preservation ——
  exact("26-title-preservation", "내일 오후 3시 강남에서 치과", 15, {
    titleMustContain: ["강남", "치과"],
  }),
  exact("26-title-preservation", "내일 오후 3시 김원장님 치과", 15, {
    titleMustContain: ["김원장님", "치과"],
  }),
  exact("26-title-preservation", "내일 오후 3시 치과 가서 스케일링", 15, {
    titleMustContain: ["치과", "스케일링"],
  }),
  exact("26-title-preservation", "내일 오후 2시 회사에서 팀 미팅", 14, {
    titleMustContain: ["회사", "팀 미팅"],
  }),

  // —— 27-28 multiple times / dates ——
  ...[
    "내일 3시에 병원 갔다가 5시에 민수 만나기",
    "2시에 회의하고 4시에 병원",
  ].map((input) =>
    c("27-multiple-times", input, {
      explicitTime: false,
      auto: false,
    }),
  ),
  ...[
    "월요일 병원 화요일 미팅",
    "오늘 청소하고 내일 빨래",
    "이번 주 금요일 회의 다음 주 월요일 발표",
    "9월 3일 병원, 9월 5일 미팅",
  ].map((input) => blocked("27-multiple-times", input)),

  // —— 29 one clock, multiple actions ——
  exact("29-multi-action", "내일 오후 3시에 병원하고 약국 가기", 15, {
    titleMustContain: ["병원", "약국"],
  }),

  // —— 30 edit / cancel ——
  ...[
    "아니 내일 말고 모레",
    "3시 말고 4시",
    "오후야",
    "다음 주 월요일로 바꿔줘",
    "그거 취소",
    "아까 일정 삭제",
  ].map((input) => quiet("30-edit-cancel", input)),
  quietClock("30-edit-cancel", "오전 10시로"),
  quietClock("30-edit-cancel", "병원 일정 오후 4시로 변경"),

  // —— 31 negation ——
  ...[
    "내일 병원 안 가",
    "오늘 청소 안 해",
    "금요일 회의 취소",
    "내일 운동하지 말기",
    "3시 약속 없어짐",
  ].map((input) => quiet("31-negation", input)),
  quietClock("31-negation", "내일 오후 3시 병원 안 가"),

  // —— 32 questions ——
  ...[
    "내일 일정 뭐지?",
    "내일 병원 몇 시였지?",
    "금요일에 뭐 있었지?",
    "3시에 뭐 하지?",
    "다음 주 일정 보여줘",
  ].map((input) => quiet("32-questions", input)),
  quietClock("32-questions", "내일 오후 3시에 뭐 하지?"),

  // —— 33 tentative ——
  ...[
    "내일 병원 갈까",
    "내일 운동할까",
    "주말에 여행 갈지도",
    "다음 주에 병원 갈 것 같아",
    "오후에 운동할 수도 있음",
    "금요일쯤 미팅 잡을 듯",
  ].map((input) => quiet("33-tentative", input)),
  quietClock("33-tentative", "내일 오후 3시 운동할 수도 있음"),

  // —— 34-35 committed / memory ——
  exact("34-committed-memory", "내일 오후 3시 병원 예약", 15, {
    titleMustContain: ["병원"],
  }),
  exact("34-committed-memory", "내일 오후 3시에 만나기로 했어", 15),
  exact("34-committed-memory", "아 맞다 내일 오후 3시 병원", 15, {
    titleMustContain: ["병원"],
  }),
  exact("34-committed-memory", "엄마 병원 내일 오전 10시였음", 10, {
    titleMustContain: ["엄마", "병원"],
  }),

  // —— 36 long exact NL ——
  exact(
    "36-long-exact",
    "아 맞다 내일 오후 3시에 강남 치과 가서 스케일링 받아야 함",
    15,
    {
      titleMustContain: ["강남 치과", "스케일링"],
    },
  ),

  // —— broad period + clock (unresolved calendar day) ——
  ...[
    "이번 주 오후 3시에 청소",
    "다음 주 오후 3시에 청소",
    "이번 달 오후 3시에 병원",
    "다음 달 오후 3시에 치과",
    "9월 중순 오후 3시에 여행 준비",
    "9월 말 오후 3시에 보험 갱신",
    "다다음 주 오후 3시에 청소",
  ].map((input) => quietClock("37-broad-period-clock", input)),

];
